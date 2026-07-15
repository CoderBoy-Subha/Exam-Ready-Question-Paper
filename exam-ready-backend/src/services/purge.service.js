import { sessionsRepo, purgeRepo } from '../db/repositories.js'
import { deleteSessionContent, deleteGenerationOutput } from '../cache/redisClient.js'

/** Clears the ephemeral Redis payload for a session and every generation output under it. */
async function clearSessionPayload(sessionId) {
  const generationIds = await sessionsRepo.generationIdsForSession(sessionId)
  await Promise.all([
    deleteSessionContent(sessionId),
    ...generationIds.map((id) => deleteGenerationOutput(id)),
  ])
}

/**
 * Immediate, on-demand purge for one session — the cleanup endpoint's
 * job (sendBeacon on tab close). Same soft-purge semantics as the
 * scheduled sweep: clears Redis, stamps purged_at, leaves the
 * Postgres metadata row in place.
 */
export async function purgeSessionNow(sessionId) {
  await clearSessionPayload(sessionId)
  await sessionsRepo.markPurgedNow(sessionId)
}

/**
 * The inactivity-timeout backstop. Calls the DB's own
 * purge_expired_sessions() (schema.sql) to atomically find + mark
 * expired sessions, then clears the matching Redis keys — Postgres
 * can't reach into Redis itself, so that half always happens here.
 */
export async function runScheduledPurge() {
  const expiredSessionIds = await purgeRepo.purgeExpiredSessions()
  await Promise.all(expiredSessionIds.map((id) => clearSessionPayload(id)))
  return expiredSessionIds
}
