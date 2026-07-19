import { AppError } from '../utils/AppError.js'
import { sessionsRepo } from '../db/repositories.js'
import { extractContent, detectFileFormat } from '../services/fileExtraction.service.js'
import { setSessionContent } from '../cache/redisClient.js'
import { env } from '../config/env.js'
import { VALID_FILE_FORMATS_BY_SOURCE } from '../shared/questionCategories.js'

export async function uploadHandler(req, res) {
  const { contentSource, syllabusText } = req.body
  const files = req.files || []

  if (files.length === 0 && !(contentSource === 'syllabus' && syllabusText?.trim())) {
    throw AppError.badRequest('Upload at least one file, or paste syllabus text.')
  }

  for (const file of files) {
    let format
    try {
      format = detectFileFormat(file.mimetype)
    } catch (err) {
      throw AppError.badRequest(err.message)
    }
    if (!VALID_FILE_FORMATS_BY_SOURCE[contentSource].includes(format)) {
      const sourceLabel = contentSource === 'study_material' ? 'Study material' : 'Syllabus'
      throw AppError.badRequest(`${sourceLabel} can't include a "${format}" file ("${file.originalname}").`)
    }
  }

  let extracted
  try {
    extracted = await extractContent({ contentSource, files, syllabusText })
  } catch (err) {
    throw AppError.badRequest(err.message)
  }

  const session = await sessionsRepo.create({
    visitorId: req.visitorId,
    ttlMinutes: env.sessionTtlMinutes,
  })

  await setSessionContent(session.id, {
    contentSource,
    fileFormat: extracted.fileFormat, // may be 'mixed' when more than one distinct format was uploaded
    payload: extracted.payload,
  })

  res.status(201).json({ sessionId: session.id, fileCount: files.length })
}
