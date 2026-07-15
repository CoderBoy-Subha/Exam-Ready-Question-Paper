import { Router } from 'express'
import multer from 'multer'
import { AppError } from '../utils/AppError.js'
import { asyncHandler } from '../middleware/errorHandler.js'
import { requireTurnstile } from '../middleware/verifyTurnstile.js'
import { generationRateLimiter } from '../middleware/rateLimiter.js'
import {
  validateBody,
  uploadBodySchema,
  generationBodySchema,
  ratingBodySchema,
  cleanupBodySchema,
} from '../validation/schemas.js'
import { uploadHandler } from '../controllers/upload.controller.js'
import { createGenerationHandler, downloadGenerationHandler } from '../controllers/generations.controller.js'
import { submitRatingHandler } from '../controllers/ratings.controller.js'
import { cleanupHandler } from '../controllers/cleanup.controller.js'
import { env } from '../config/env.js'

const ALLOWED_MIMETYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/png',
  'image/jpeg',
  'image/webp',
]

const upload = multer({
  storage: multer.memoryStorage(), // buffer only, in-process, never written to disk
  limits: { fileSize: env.uploadMaxFileSizeMb * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}`))
    }
    cb(null, true)
  },
})

// multer reports errors (bad mimetype, file too large) via a callback
// rather than a rejected promise, so asyncHandler can't catch them.
// This wrapper normalizes both into a proper AppError.
function handleUpload(fieldName) {
  const middleware = upload.single(fieldName)
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (!err) return next()
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(AppError.badRequest(`File exceeds the ${env.uploadMaxFileSizeMb}MB limit.`))
      }
      next(AppError.badRequest(err.message || 'Upload failed.'))
    })
  }
}

export const router = Router()

router.get('/health', (req, res) => res.json({ ok: true }))

router.post(
  '/upload',
  handleUpload('file'),
  validateBody(uploadBodySchema),
  requireTurnstile(),
  asyncHandler(uploadHandler),
)

router.post(
  '/generations',
  validateBody(generationBodySchema),
  generationRateLimiter,
  asyncHandler(createGenerationHandler),
)

router.get('/generations/:id/download', asyncHandler(downloadGenerationHandler))

router.post(
  '/generations/:id/ratings',
  validateBody(ratingBodySchema),
  asyncHandler(submitRatingHandler),
)

router.post('/cleanup', validateBody(cleanupBodySchema), asyncHandler(cleanupHandler))
