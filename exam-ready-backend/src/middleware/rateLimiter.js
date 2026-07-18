import { AppError } from '../utils/AppError.js'
import { generationsRepo } from '../db/repositories.js'
import { env } from '../config/env.js'

// Gates the endpoint that actually spends AI-generation budget. Backed by
// the generations table (idx_generations_ip_created) rather than an
// in-memory counter, so the limit holds even across multiple server
// instances / restarts — see DESIGN.md from the schema deliverable.
export async function generationRateLimiter(req, res, next) {
  try {
    const count = await generationsRepo.countRecentByIp(req.clientIp, 1)
    if (count >= env.rateLimitMaxGenerationsPerHour) {
      throw AppError.tooManyRequests(
        `You've reached the limit of ${env.rateLimitMaxGenerationsPerHour} generations per hour. Please try again later.`,
      )
    }
    next()
  } catch (err) {
    next(err)
  }
}
