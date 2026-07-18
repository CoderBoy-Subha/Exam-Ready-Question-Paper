import { AppError } from '../utils/AppError.js'
import { sessionsRepo, generationsRepo } from '../db/repositories.js'
import {
  getSessionContent,
  touchSessionContentTtl,
  setGenerationOutput,
  getGenerationOutput,
} from '../cache/redisClient.js'
import { generatePaper } from '../services/aiGeneration.service.js'
import { buildExportMeta, renderPdfBuffer, renderDocxBuffer } from '../services/paperExport.service.js'
import { computeTotalMarks } from '../shared/questionCategories.js'
import { env } from '../config/env.js'

export async function createGenerationHandler(req, res) {
  const {
    sessionId,
    targetTotalMarks,
    difficulty,
    customInstructions,
    questionCounts,
    regenerateFrom,
    makeItDifferent,
  } = req.body

  const session = await sessionsRepo.findActive(sessionId)
  if (!session) {
    throw AppError.gone('Your session has expired. Please upload your material again.')
  }

  const content = await getSessionContent(sessionId)
  if (!content) {
    throw AppError.gone('Your uploaded content has expired. Please upload again.')
  }

  // Server-side re-check of the marks cap. The frontend already gates
  // this (MarksVessel / the Generate button), so hitting this in
  // normal use means the client was bypassed — reject rather than
  // silently "adjust", since guessing a correction the user didn't
  // ask for is worse UX than a clear error asking them to fix counts.
  const computedTotal = computeTotalMarks(questionCounts)
  if (computedTotal !== targetTotalMarks) {
    throw AppError.badRequest(
      `Question counts sum to ${computedTotal} marks but the target is ${targetTotalMarks}. Adjust counts to match exactly.`,
    )
  }

  // Sliding-window renewal — a generate action counts as activity.
  await sessionsRepo.touch(sessionId, env.sessionTtlMinutes)
  await touchSessionContentTtl(sessionId)

  let previousQuestionPrompts
  if (regenerateFrom && makeItDifferent) {
    const previousPaper = await getGenerationOutput(regenerateFrom)
    if (previousPaper) {
      previousQuestionPrompts = previousPaper.sections.flatMap((s) => s.questions.map((q) => q.prompt))
    }
  }

  const generationId = await generationsRepo.create({
    sessionId,
    visitorId: req.visitorId,
    parentGenerationId: regenerateFrom || null,
    ipAddress: req.clientIp,
    contentSource: content.contentSource,
    fileFormat: content.fileFormat,
    targetTotalMarks,
    difficulty,
    customInstructions,
    turnstileVerified: true, // enforced once at upload time — see verifyTurnstile.js
    ttlMinutes: env.sessionTtlMinutes,
  })
  await generationsRepo.insertSelections(generationId, questionCounts)

  // Defense in depth: confirm via the DB's own validate_generation_marks()
  // too, even though we just checked the same thing in JS above.
  const dbValid = await generationsRepo.validateMarks(generationId)
  if (!dbValid) {
    await generationsRepo.markFailed(generationId, 'Marks validation failed at persistence layer')
    throw AppError.badRequest('Question counts do not sum to the target total.')
  }

  try {
    const { paper, meta } = await generatePaper({
      extractedContent: { fileFormat: content.fileFormat, payload: content.payload },
      config: { questionCounts, targetTotalMarks, difficulty, customInstructions },
      previousQuestionPrompts,
    })

    const exportMeta = buildExportMeta(paper, { difficulty })
    await setGenerationOutput(generationId, paper)
    await generationsRepo.markCompleted(generationId, meta)

    res.status(201).json({
      generationId,
      totalMarks: exportMeta.totalMarks,
      questionCount: exportMeta.questionCount,
      difficulty: exportMeta.difficulty,
      sections: paper.sections,
    })
  } catch (err) {
    await generationsRepo.markFailed(generationId, err.message)
    throw err
  }
}

export async function getGenerationHandler(req, res) {
  const { id } = req.params

  const paper = await getGenerationOutput(id)
  if (!paper) {
    throw AppError.gone('This paper is no longer available. It may have expired — try regenerating it.')
  }

  const generation = await generationsRepo.findById(id)
  const exportMeta = buildExportMeta(paper, { difficulty: generation?.difficulty || 'mixture' })

  res.json({
    generationId: id,
    totalMarks: exportMeta.totalMarks,
    questionCount: exportMeta.questionCount,
    difficulty: exportMeta.difficulty,
    sections: paper.sections,
  })
}

export async function downloadGenerationHandler(req, res) {
  const { id } = req.params
  const format = req.query.format

  if (!['pdf', 'docx'].includes(format)) {
    throw AppError.badRequest('format must be "pdf" or "docx"')
  }

  const paper = await getGenerationOutput(id)
  if (!paper) {
    throw AppError.gone('This paper is no longer available. It may have expired — try regenerating it.')
  }

  const generation = await generationsRepo.findById(id)
  const meta = buildExportMeta(paper, { difficulty: generation?.difficulty || 'mixture' })

  if (format === 'pdf') {
    const buffer = await renderPdfBuffer(paper, meta)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="exam-paper-${id}.pdf"`)
    return res.send(buffer)
  }

  const buffer = await renderDocxBuffer(paper, meta)
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  )
  res.setHeader('Content-Disposition', `attachment; filename="exam-paper-${id}.docx"`)
  return res.send(buffer)
}
