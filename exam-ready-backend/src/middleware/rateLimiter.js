import { AppError } from '../utils/AppError.js'
import { generationsRepo } from '../db/repositories.js'
import { env } from '../config/env.js'

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
