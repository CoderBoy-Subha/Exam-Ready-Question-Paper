import { AppError } from '../utils/AppError.js'
import { generationsRepo, ratingsRepo } from '../db/repositories.js'

export async function submitRatingHandler(req, res) {
  const { id } = req.params
  const { score, comment, email } = req.body

  const generation = await generationsRepo.findById(id)
  if (!generation) {
    throw AppError.notFound('Generation not found.')
  }

  await ratingsRepo.upsert({ generationId: id, score, comment, email: email || null })
  res.json({ ok: true })
}
