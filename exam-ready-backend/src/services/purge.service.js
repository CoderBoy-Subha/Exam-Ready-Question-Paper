import { sessionsRepo, purgeRepo } from '../db/repositories.js'
import { deleteSessionContent, deleteGenerationOutput } from '../cache/redisClient.js'

async function clearSessionPayload(sessionId) {
  const generationIds = await sessionsRepo.generationIdsForSession(sessionId)
  await Promise.all([
    deleteSessionContent(sessionId),
    ...generationIds.map((id) => deleteGenerationOutput(id)),
  ])
}

export async function purgeSessionNow(sessionId) {
  await clearSessionPayload(sessionId)
  await sessionsRepo.markPurgedNow(sessionId)
}

export async function runScheduledPurge() {
  const expiredSessionIds = await purgeRepo.purgeExpiredSessions()
  await Promise.all(expiredSessionIds.map((id) => clearSessionPayload(id)))
  return expiredSessionIds
}
