import { createClient } from 'redis'
import { env } from '../config/env.js'

// This is where the actual uploaded/extracted content and generated
// papers live — deliberately NOT in Postgres. See schema.sql's header
// comment and the DB design doc: Postgres has backups/WAL, so a
// DELETE there doesn't mean "gone" the way the retention requirement
// implies. Redis with a TTL does — the key just evaporates, which is
// what makes the inactivity timeout a true backstop rather than
// something a cron job has to race.

export const redisClient = createClient({ url: env.redisUrl })

redisClient.on('error', (err) => {
  console.error('Redis client error', err)
})

export async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect()
  }
}

export async function disconnectRedis() {
  if (redisClient.isOpen) {
    await redisClient.quit()
  }
}

const ttlSeconds = () => env.sessionTtlMinutes * 60

const sessionContentKey = (sessionId) => `session:${sessionId}:content`
const generationOutputKey = (generationId) => `generation:${generationId}:output`

/**
 * content shape:
 *   { contentSource, fileFormat,
 *     payload: { kind: 'inline', mimeType, base64 } | { kind: 'text', text } }
 */
export async function setSessionContent(sessionId, content) {
  await redisClient.set(sessionContentKey(sessionId), JSON.stringify(content), { EX: ttlSeconds() })
}

export async function getSessionContent(sessionId) {
  const raw = await redisClient.get(sessionContentKey(sessionId))
  return raw ? JSON.parse(raw) : null
}

/** Sliding-window renewal, called alongside sessionsRepo.touch(). */
export async function touchSessionContentTtl(sessionId) {
  await redisClient.expire(sessionContentKey(sessionId), ttlSeconds())
}

export async function deleteSessionContent(sessionId) {
  await redisClient.del(sessionContentKey(sessionId))
}

export async function setGenerationOutput(generationId, paper) {
  await redisClient.set(generationOutputKey(generationId), JSON.stringify(paper), { EX: ttlSeconds() })
}

export async function getGenerationOutput(generationId) {
  const raw = await redisClient.get(generationOutputKey(generationId))
  return raw ? JSON.parse(raw) : null
}

export async function deleteGenerationOutput(generationId) {
  await redisClient.del(generationOutputKey(generationId))
}
