import { AppError } from '../utils/AppError.js'
import { sessionsRepo } from '../db/repositories.js'
import { extractContent } from '../services/fileExtraction.service.js'
import { setSessionContent } from '../cache/redisClient.js'
import { env } from '../config/env.js'
import { VALID_FILE_FORMATS_BY_SOURCE } from '../shared/questionCategories.js'

export async function uploadHandler(req, res) {
  const { contentSource, syllabusText } = req.body
  const file = req.file

  if (!file && !(contentSource === 'syllabus' && syllabusText?.trim())) {
    throw AppError.badRequest('Upload a file, or paste syllabus text.')
  }

  let extracted
  try {
    extracted = await extractContent({ contentSource, file, syllabusText })
  } catch (err) {
    throw AppError.badRequest(err.message)
  }

  if (!VALID_FILE_FORMATS_BY_SOURCE[contentSource].includes(extracted.fileFormat)) {
    const sourceLabel = contentSource === 'study_material' ? 'Study material' : 'Syllabus'
    throw AppError.badRequest(`${sourceLabel} can't be uploaded as "${extracted.fileFormat}".`)
  }

  const session = await sessionsRepo.create({
    visitorId: req.visitorId,
    ttlMinutes: env.sessionTtlMinutes,
  })

  await setSessionContent(session.id, {
    contentSource,
    fileFormat: extracted.fileFormat,
    payload: extracted.payload,
  })

  res.status(201).json({ sessionId: session.id })
}
