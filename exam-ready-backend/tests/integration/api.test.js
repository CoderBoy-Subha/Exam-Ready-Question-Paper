import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('../../src/services/aiGeneration.service.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, generatePaper: vi.fn() }
})

const { generatePaper } = await import('../../src/services/aiGeneration.service.js')
const { createApp } = await import('../../src/app.js')
const { connectRedis, disconnectRedis } = await import('../../src/cache/redisClient.js')
const { pool } = await import('../../src/db/pool.js')
const { purgeSessionNow, runScheduledPurge } = await import('../../src/services/purge.service.js')
const { sessionsRepo, generationsRepo } = await import('../../src/db/repositories.js')

let app

// Distinct fake IPs per describe block so parallel/adjacent tests
// never collide on the same visitors row.
const HAPPY_PATH_IP = '198.51.100.10'
const VALIDATION_IP = '198.51.100.20'
const RATE_LIMIT_IP = '198.51.100.30'
const PURGE_IP = '198.51.100.40'
const MULTI_FILE_IP = '198.51.100.50'
const GET_ROUTE_IP = '198.51.100.60'

async function cleanupIp(ip) {
  await pool.query('DELETE FROM visitors WHERE ip_address = $1', [ip])
}

beforeAll(async () => {
  await connectRedis()
  app = createApp()
})

afterAll(async () => {
  await disconnectRedis()
  await pool.end()
})

afterEach(async () => {
  vi.clearAllMocks()
})

const mockPaper = {
  sections: [
    {
      title: 'Section A',
      questions: [
        {
          id: 's0-q0',
          marks: 1,
          type: 'mcq',
          difficulty: 'easy',
          prompt: 'Q1?',
          options: ['a', 'b', 'c', 'd'],
          answer: 'a',
        },
        {
          id: 's0-q1',
          marks: 1,
          type: 'mcq',
          difficulty: 'easy',
          prompt: 'Q2?',
          options: ['a', 'b', 'c', 'd'],
          answer: 'b',
        },
      ],
    },
  ],
}

describe('full happy path: upload -> generate -> download -> rate -> cleanup', () => {
  afterEach(async () => cleanupIp(HAPPY_PATH_IP))

  it('runs end to end and leaves the paper unavailable after cleanup', async () => {
    generatePaper.mockResolvedValue({ paper: mockPaper, meta: { ok: true, model: 'test-model' } })

    const uploadRes = await request(app)
      .post('/api/upload')
      .set('X-Forwarded-For', HAPPY_PATH_IP)
      .field('contentSource', 'syllabus')
      .field('syllabusText', 'Unit 1: Basic arithmetic and number theory.')

    expect(uploadRes.status).toBe(201)
    expect(uploadRes.body.sessionId).toBeTruthy()
    const { sessionId } = uploadRes.body

    const genRes = await request(app)
      .post('/api/generations')
      .set('X-Forwarded-For', HAPPY_PATH_IP)
      .send({
        sessionId,
        targetTotalMarks: 2,
        difficulty: 'easy',
        customInstructions: '',
        questionCounts: { MCQ_1: 2 },
      })

    expect(genRes.status).toBe(201)
    expect(genRes.body.totalMarks).toBe(2)
    expect(genRes.body.questionCount).toBe(2)
    expect(genRes.body.sections[0].questions).toHaveLength(2)
    const { generationId } = genRes.body

    const pdfRes = await request(app).get(`/api/generations/${generationId}/download?format=pdf`)
    expect(pdfRes.status).toBe(200)
    expect(pdfRes.headers['content-type']).toBe('application/pdf')
    expect(Buffer.from(pdfRes.body).subarray(0, 5).toString()).toBe('%PDF-')

    const docxRes = await request(app).get(`/api/generations/${generationId}/download?format=docx`)
    expect(docxRes.status).toBe(200)
    expect(docxRes.headers['content-type']).toContain('wordprocessingml')

    const ratingRes = await request(app)
      .post(`/api/generations/${generationId}/ratings`)
      .send({ score: 5, comment: 'Great paper!' })
    expect(ratingRes.status).toBe(200)
    expect(ratingRes.body).toEqual({ ok: true })

    // re-rating the same generation should upsert, not create a second row
    const reRatingRes = await request(app)
      .post(`/api/generations/${generationId}/ratings`)
      .send({ score: 3 })
    expect(reRatingRes.status).toBe(200)
    const { rows } = await pool.query('SELECT count(*)::int AS n, max(score) AS s FROM ratings WHERE generation_id = $1', [generationId])
    expect(rows[0].n).toBe(1)
    expect(rows[0].s).toBe(3)

    const cleanupRes = await request(app).post('/api/cleanup').send({ sessionId })
    expect(cleanupRes.status).toBe(204)

    const afterCleanupRes = await request(app).get(`/api/generations/${generationId}/download?format=pdf`)
    expect(afterCleanupRes.status).toBe(410)

    // Postgres metadata rows survive the purge — see schema.sql's
    // header comment: purge clears the Redis payload, not the rows.
    const generationRow = await generationsRepo.findById(generationId)
    expect(generationRow).not.toBeNull()
    expect(generationRow.purged_at).not.toBeNull()
    const ratingCount = await pool.query('SELECT count(*)::int AS n FROM ratings WHERE generation_id = $1', [generationId])
    expect(ratingCount.rows[0].n).toBe(1)
  })
})

describe('validation', () => {
  afterEach(async () => cleanupIp(VALIDATION_IP))

  it('rejects a generation whose counts do not sum to the target', async () => {
    const uploadRes = await request(app)
      .post('/api/upload')
      .set('X-Forwarded-For', VALIDATION_IP)
      .field('contentSource', 'syllabus')
      .field('syllabusText', 'Some syllabus text.')
    const { sessionId } = uploadRes.body

    const genRes = await request(app)
      .post('/api/generations')
      .set('X-Forwarded-For', VALIDATION_IP)
      .send({ sessionId, targetTotalMarks: 100, difficulty: 'easy', questionCounts: { MCQ_1: 2 } })

    expect(genRes.status).toBe(400)
    expect(generatePaper).not.toHaveBeenCalled()
  })

  it('rejects study_material uploaded as plain text (matches the DB CHECK constraint)', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('X-Forwarded-For', VALIDATION_IP)
      .field('contentSource', 'study_material')
      .field('syllabusText', 'this should be ignored since there is no file')

    expect(res.status).toBe(400)
  })

  it('returns 410 for a generation request against an unknown session', async () => {
    const res = await request(app)
      .post('/api/generations')
      .set('X-Forwarded-For', VALIDATION_IP)
      .send({
        sessionId: '00000000-0000-0000-0000-000000000000',
        targetTotalMarks: 1,
        difficulty: 'easy',
        questionCounts: { MCQ_1: 1 },
      })
    expect(res.status).toBe(410)
  })

  it('rejects an invalid request body with a 400 and issue details', async () => {
    const res = await request(app)
      .post('/api/generations')
      .set('X-Forwarded-For', VALIDATION_IP)
      .send({ sessionId: 'not-a-uuid', targetTotalMarks: -5, difficulty: 'impossible', questionCounts: {} })
    expect(res.status).toBe(400)
    expect(res.body.details).toBeTruthy()
  })
})

describe('rate limiting', () => {
  afterEach(async () => cleanupIp(RATE_LIMIT_IP))

  it('allows up to the configured limit then rejects with 429', async () => {
    generatePaper.mockResolvedValue({ paper: mockPaper, meta: { ok: true, model: 'test-model' } })
    // .env sets RATE_LIMIT_MAX_GENERATIONS_PER_HOUR=2 for this test run
    const uploadRes = await request(app)
      .post('/api/upload')
      .set('X-Forwarded-For', RATE_LIMIT_IP)
      .field('contentSource', 'syllabus')
      .field('syllabusText', 'Rate limit test material.')
    const { sessionId } = uploadRes.body
    const body = { sessionId, targetTotalMarks: 2, difficulty: 'easy', questionCounts: { MCQ_1: 2 } }

    const first = await request(app).post('/api/generations').set('X-Forwarded-For', RATE_LIMIT_IP).send(body)
    const second = await request(app).post('/api/generations').set('X-Forwarded-For', RATE_LIMIT_IP).send(body)
    const third = await request(app).post('/api/generations').set('X-Forwarded-For', RATE_LIMIT_IP).send(body)

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(third.status).toBe(429)
  })
})

describe('purge behavior', () => {
  afterEach(async () => cleanupIp(PURGE_IP))

  it('purgeSessionNow clears Redis content and stamps purged_at without deleting rows', async () => {
    generatePaper.mockResolvedValue({ paper: mockPaper, meta: { ok: true, model: 'test-model' } })

    const uploadRes = await request(app)
      .post('/api/upload')
      .set('X-Forwarded-For', PURGE_IP)
      .field('contentSource', 'syllabus')
      .field('syllabusText', 'Purge test material.')
    const { sessionId } = uploadRes.body

    const genRes = await request(app)
      .post('/api/generations')
      .set('X-Forwarded-For', PURGE_IP)
      .send({ sessionId, targetTotalMarks: 2, difficulty: 'easy', questionCounts: { MCQ_1: 2 } })
    const { generationId } = genRes.body

    await purgeSessionNow(sessionId)

    const dl = await request(app).get(`/api/generations/${generationId}/download?format=pdf`)
    expect(dl.status).toBe(410)

    const genRow = await generationsRepo.findById(generationId)
    expect(genRow.purged_at).not.toBeNull()
  })

  it('runScheduledPurge only sweeps sessions past their expiry', async () => {
    // A session backdated so it's already expired, created directly
    // via the repo (bypassing HTTP) so we control created_at/expires_at.
    const { rows } = await pool.query(
      `INSERT INTO sessions (visitor_id, created_at, expires_at)
       VALUES (NULL, now() - interval '2 hours', now() - interval '1 hour')
       RETURNING id`,
    )
    const expiredSessionId = rows[0].id

    const liveSession = await sessionsRepo.create({ visitorId: null, ttlMinutes: 45 })

    const purgedIds = await runScheduledPurge()

    expect(purgedIds).toContain(expiredSessionId)
    expect(purgedIds).not.toContain(liveSession.id)

    await pool.query('DELETE FROM sessions WHERE id IN ($1, $2)', [expiredSessionId, liveSession.id])
  })
})

describe('multi-file upload', () => {
  afterEach(async () => cleanupIp(MULTI_FILE_IP))

  it('accepts several files of different formats in one upload and reports fileCount', async () => {
    const uploadRes = await request(app)
      .post('/api/upload')
      .set('X-Forwarded-For', MULTI_FILE_IP)
      .field('contentSource', 'study_material')
      .attach('files', Buffer.from('%PDF-1.4 fake chapter one'), {
        filename: 'chapter1.pdf',
        contentType: 'application/pdf',
      })
      .attach('files', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'diagram.png',
        contentType: 'image/png',
      })

    expect(uploadRes.status).toBe(201)
    expect(uploadRes.body.fileCount).toBe(2)

    // the session's stored file_format should be 'mixed' since a pdf
    // and an image were uploaded together — confirmed via a generation
    // row, since fileFormat itself isn't returned by /upload.
    generatePaper.mockResolvedValue({ paper: mockPaper, meta: { ok: true, model: 'test-model' } })
    const genRes = await request(app)
      .post('/api/generations')
      .set('X-Forwarded-For', MULTI_FILE_IP)
      .send({
        sessionId: uploadRes.body.sessionId,
        targetTotalMarks: 2,
        difficulty: 'easy',
        questionCounts: { MCQ_1: 2 },
      })
    expect(genRes.status).toBe(201)

    const { rows } = await pool.query('SELECT file_format FROM generations WHERE id = $1', [genRes.body.generationId])
    expect(rows[0].file_format).toBe('mixed')

    // and the AI call should have received one Part per uploaded file
    const sentParts = generatePaper.mock.calls[0][0].extractedContent.payload.parts
    expect(sentParts).toHaveLength(2)
    expect(sentParts.map((p) => p.sourceName).sort()).toEqual(['chapter1.pdf', 'diagram.png'])
  })

  it('rejects a file whose format is not allowed for the chosen content source', async () => {
    const res = await request(app)
      .post('/api/upload')
      .set('X-Forwarded-For', MULTI_FILE_IP)
      .field('contentSource', 'study_material')
      .attach('files', Buffer.from('plain text file'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })

    expect(res.status).toBe(400)
  })

  it('rejects more files than the configured maximum', async () => {
    let req = request(app)
      .post('/api/upload')
      .set('X-Forwarded-For', MULTI_FILE_IP)
      .field('contentSource', 'study_material')
    // UPLOAD_MAX_FILES is 6 by default; attach one more than that
    for (let i = 0; i < 7; i++) {
      req = req.attach('files', Buffer.from(`%PDF-1.4 fake ${i}`), {
        filename: `f${i}.pdf`,
        contentType: 'application/pdf',
      })
    }
    const res = await req
    expect(res.status).toBe(400)
  })
})

describe('GET /api/generations/:id', () => {
  afterEach(async () => cleanupIp(GET_ROUTE_IP))

  it('returns the same paper shape as the create response, supporting refresh/deep-link', async () => {
    generatePaper.mockResolvedValue({ paper: mockPaper, meta: { ok: true, model: 'test-model' } })

    const uploadRes = await request(app)
      .post('/api/upload')
      .set('X-Forwarded-For', GET_ROUTE_IP)
      .field('contentSource', 'syllabus')
      .field('syllabusText', 'Refresh/deep-link test material.')

    const genRes = await request(app)
      .post('/api/generations')
      .set('X-Forwarded-For', GET_ROUTE_IP)
      .send({
        sessionId: uploadRes.body.sessionId,
        targetTotalMarks: 2,
        difficulty: 'easy',
        questionCounts: { MCQ_1: 2 },
      })
    const { generationId } = genRes.body

    const getRes = await request(app).get(`/api/generations/${generationId}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body).toEqual(genRes.body)
  })

  it('returns 410 for an id that was never generated or has expired', async () => {
    const res = await request(app).get('/api/generations/00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(410)
  })
})

describe('no response ever names the underlying AI vendor', () => {
  const NEUTRAL_IP = '198.51.100.70'
  afterEach(async () => cleanupIp(NEUTRAL_IP))

  it('a failed generation returns a vendor-neutral error message', async () => {
    const { AppError } = await import('../../src/utils/AppError.js')
    generatePaper.mockRejectedValue(
      AppError.badGateway('The AI engine returned a response that was not valid JSON.'),
    )

    const uploadRes = await request(app)
      .post('/api/upload')
      .set('X-Forwarded-For', NEUTRAL_IP)
      .field('contentSource', 'syllabus')
      .field('syllabusText', 'Vendor-neutral error test.')

    const genRes = await request(app)
      .post('/api/generations')
      .set('X-Forwarded-For', NEUTRAL_IP)
      .send({
        sessionId: uploadRes.body.sessionId,
        targetTotalMarks: 2,
        difficulty: 'easy',
        questionCounts: { MCQ_1: 2 },
      })

    expect(genRes.status).toBe(502)
    expect(JSON.stringify(genRes.body)).not.toMatch(/gemini/i)
  })
})
