import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'

const { createApp } = await import('../../src/app.js')
const { connectRedis, disconnectRedis, redisClient } = await import('../../src/cache/redisClient.js')
const { pool } = await import('../../src/db/pool.js')

let app

beforeAll(async () => {
  await connectRedis()
  app = createApp()
})

afterAll(async () => {
  await disconnectRedis()
  await pool.end()
})

describe('GET /api/stats', () => {
  it('returns the four public stat fields as numbers', async () => {
    await redisClient.del('stats:public')

    const res = await request(app).get('/api/stats')

    expect(res.status).toBe(200)
    expect(typeof res.body.visitorCount).toBe('number')
    expect(typeof res.body.papersGenerated).toBe('number')
    expect(typeof res.body.ratingCount).toBe('number')
    expect(typeof res.body.averageRating).toBe('number')
  })

  it('serves the second request from cache (identical payload, no new DB round trip needed)', async () => {
    await redisClient.del('stats:public')

    const first = await request(app).get('/api/stats')
    const second = await request(app).get('/api/stats')

    expect(second.body).toEqual(first.body)
    const cached = await redisClient.get('stats:public')
    expect(JSON.parse(cached)).toEqual(first.body)
  })
})
