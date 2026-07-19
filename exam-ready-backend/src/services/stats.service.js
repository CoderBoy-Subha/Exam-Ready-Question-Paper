import { statsRepo } from '../db/repositories.js'
import { redisClient } from '../cache/redisClient.js'

const CACHE_KEY = 'stats:public'
const CACHE_TTL_SECONDS = 60

export async function getPublicStats() {
  const cached = await redisClient.get(CACHE_KEY)
  if (cached) return JSON.parse(cached)

  const stats = await statsRepo.getPublicStats()
  await redisClient.set(CACHE_KEY, JSON.stringify(stats), { EX: CACHE_TTL_SECONDS })
  return stats
}
