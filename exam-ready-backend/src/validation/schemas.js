import { z } from 'zod'
import { CONTENT_SOURCES, DIFFICULTIES, isValidCategoryCode } from '../shared/questionCategories.js'

const uuid = z.string().uuid()

export const uploadBodySchema = z.object({
  contentSource: z.enum(CONTENT_SOURCES),
  syllabusText: z.string().max(20_000).optional(),
  turnstileToken: z.string().optional(),
})

export const generationBodySchema = z.object({
  sessionId: uuid,
  targetTotalMarks: z.coerce.number().int().positive(),
  difficulty: z.enum(DIFFICULTIES),
  customInstructions: z.string().max(2000).optional().nullable(),
  questionCounts: z
    .record(z.string(), z.coerce.number().int().min(0))
    .refine((counts) => Object.keys(counts).every(isValidCategoryCode), {
      message: 'questionCounts contains an unknown category code',
    }),
  regenerateFrom: uuid.optional().nullable(),
  makeItDifferent: z.boolean().optional(),
})

export const ratingBodySchema = z.object({
  score: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional().nullable(),
  email: z.string().email().max(320).optional().nullable().or(z.literal('')),
})

export const cleanupBodySchema = z.object({
  sessionId: uuid,
})

export function validateBody(schema) {
  return function validateBodyMiddleware(req, res, next) {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({ message: 'Invalid request', details: result.error.issues })
    }
    req.body = result.data
    next()
  }
}
