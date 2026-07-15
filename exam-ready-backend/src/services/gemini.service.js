import { GoogleGenAI, Type } from '@google/genai'
import { env } from '../config/env.js'
import { AppError } from '../utils/AppError.js'
import { CATEGORY_BY_CODE, computeTotalMarks } from '../shared/questionCategories.js'

// ---------------------------------------------------------------------
// This closes the spec's explicitly-flagged open item: "Exact Gemini
// output format contract". Decision: force structured JSON via
// responseMimeType + responseJsonSchema (see js-genai's own
// codegen_instructions.md — that's the current, documented pattern
// for @google/genai, not the deprecated @google/generative-ai
// package's genAI.getGenerativeModel().generateContent() shape).
// ---------------------------------------------------------------------

const paperResponseSchema = {
  type: Type.OBJECT,
  properties: {
    sections: {
      type: Type.ARRAY,
      description: 'Ordered sections of the paper, e.g. one per question type.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: 'e.g. "Section A — Multiple Choice"' },
          instructions: { type: Type.STRING, description: 'Short instruction line for this section.' },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                marks: { type: Type.INTEGER },
                difficulty: { type: Type.STRING, enum: ['easy', 'medium', 'hard'] },
                type: { type: Type.STRING, enum: ['mcq', 'subjective'] },
                prompt: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Present only for type "mcq" — exactly 4 options.',
                },
                answer: {
                  type: Type.STRING,
                  description: 'The correct option text for mcq, or a model answer for subjective.',
                },
              },
              required: ['marks', 'difficulty', 'type', 'prompt', 'answer'],
            },
          },
        },
        required: ['title', 'questions'],
      },
    },
  },
  required: ['sections'],
}

let sharedClient = null
function getClient() {
  if (!sharedClient) {
    sharedClient = new GoogleGenAI({ apiKey: env.geminiApiKey })
  }
  return sharedClient
}

function describeQuestionCounts(questionCounts) {
  return Object.entries(questionCounts)
    .filter(([, count]) => count > 0)
    .map(([code, count]) => {
      const cat = CATEGORY_BY_CODE[code]
      const kindLabel = cat.kind === 'mcq' ? 'Multiple Choice Question' : 'Subjective question'
      return `- ${count} × ${kindLabel}, ${cat.marks} mark${cat.marks > 1 ? 's' : ''} each`
    })
    .join('\n')
}

function buildPromptText({ config, previousQuestionPrompts }) {
  const totalMarks = computeTotalMarks(config.questionCounts)
  const totalQuestions = Object.values(config.questionCounts).reduce((a, b) => a + b, 0)

  let prompt = `You are generating an exam question paper. Follow the requirements exactly.

Question breakdown (produce EXACTLY these counts and mark values — this is a hard constraint):
${describeQuestionCounts(config.questionCounts)}
Total: ${totalMarks} marks across ${totalQuestions} questions.

Difficulty: ${config.difficulty === 'mixture' ? 'Mixture — split roughly evenly across easy, medium, and hard' : config.difficulty}.
`

  if (config.customInstructions?.trim()) {
    prompt += `\nAdditional constraints from the paper author: ${config.customInstructions.trim()}\n`
  }

  if (previousQuestionPrompts?.length) {
    prompt += `\nThis is a regeneration. Produce a DIFFERENT set of questions than before — vary the specific questions, phrasing, and examples while keeping the same structure, counts, and difficulty. Avoid repeating any of these previous prompts:\n${previousQuestionPrompts.map((p) => `- ${p}`).join('\n')}\n`
  }

  prompt += `\nGroup questions into sections by type (e.g. "Section A — Multiple Choice", "Section B — Short Answer", "Section C — Long Answer"). Base every question strictly on the provided source material.`

  return prompt
}

function buildContentParts({ extractedContent, promptText }) {
  const parts = [{ text: promptText }]

  if (extractedContent.payload.kind === 'inline') {
    parts.push({
      inlineData: {
        mimeType: extractedContent.payload.mimeType,
        data: extractedContent.payload.base64,
      },
    })
  } else {
    parts.unshift({ text: `Source material:\n"""\n${extractedContent.payload.text}\n"""\n` })
  }

  return [{ role: 'user', parts }]
}

function injectQuestionIds(paper) {
  paper.sections.forEach((section, si) => {
    section.questions.forEach((question, qi) => {
      question.id = `s${si}-q${qi}`
    })
  })
  return paper
}

function marksReconcile(paper, config) {
  const expectedTotal = computeTotalMarks(config.questionCounts)
  const actualTotal = paper.sections.reduce(
    (sum, s) => sum + s.questions.reduce((sSum, q) => sSum + (q.marks || 0), 0),
    0,
  )
  const expectedCount = Object.values(config.questionCounts).reduce((a, b) => a + b, 0)
  const actualCount = paper.sections.reduce((sum, s) => sum + s.questions.length, 0)
  return { ok: expectedTotal === actualTotal && expectedCount === actualCount, expectedTotal, actualTotal, expectedCount, actualCount }
}

async function callGemini({ client, contents, systemInstruction }) {
  const response = await client.models.generateContent({
    model: env.geminiModel,
    contents,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseJsonSchema: paperResponseSchema,
      temperature: 0.9,
    },
  })

  const text = response.text
  if (!text) {
    const blockReason = response.promptFeedback?.blockReason
    throw AppError.badGateway(
      blockReason
        ? `Gemini declined to generate a paper from this material (${blockReason}).`
        : 'Gemini returned an empty response.',
    )
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw AppError.badGateway('Gemini returned a response that was not valid JSON.')
  }
  return parsed
}

const SYSTEM_INSTRUCTION =
  'You are an experienced exam setter. Produce clear, unambiguous, well-scoped exam questions strictly grounded in the supplied source material. Never invent facts not supported by the material. Always match the requested question counts and mark values exactly.'

/**
 * @param {object} params
 * @param {object} params.extractedContent - { fileFormat, payload } from fileExtraction.service.js
 * @param {object} params.config - { questionCounts, targetTotalMarks, difficulty, customInstructions }
 * @param {string[]} [params.previousQuestionPrompts] - for "make it different" regeneration
 * @param {object} [params.client] - injectable GoogleGenAI-shaped client, for tests
 */
export async function generatePaper({ extractedContent, config, previousQuestionPrompts, client }) {
  const geminiClient = client || getClient()
  const promptText = buildPromptText({ config, previousQuestionPrompts })
  const contents = buildContentParts({ extractedContent, promptText })

  let paper = await callGemini({ client: geminiClient, contents, systemInstruction: SYSTEM_INSTRUCTION })
  let reconciliation = marksReconcile(paper, config)

  if (!reconciliation.ok) {
    // One corrective retry — Gemini occasionally drifts from an exact
    // count/mark spec. Cost of one extra call is worth not shipping a
    // paper that silently doesn't match what the user configured.
    const correctivePrompt = `${promptText}\n\nIMPORTANT: a previous attempt returned ${reconciliation.actualCount} questions totalling ${reconciliation.actualTotal} marks. You MUST return exactly ${reconciliation.expectedCount} questions totalling ${reconciliation.expectedTotal} marks — recheck the breakdown above and match it exactly.`
    const retryContents = buildContentParts({ extractedContent, promptText: correctivePrompt })
    paper = await callGemini({ client: geminiClient, contents: retryContents, systemInstruction: SYSTEM_INSTRUCTION })
    reconciliation = marksReconcile(paper, config)

    if (!reconciliation.ok) {
      throw AppError.badGateway(
        'Gemini could not produce a paper matching the requested mark scheme after a retry. Please try generating again.',
      )
    }
  }

  injectQuestionIds(paper)
  return { paper, meta: { model: env.geminiModel, ...reconciliation } }
}

// Exposed for tests / callers that want the raw schema or prompt logic
// without making a network call.
export const _internal = { paperResponseSchema, buildPromptText, buildContentParts, marksReconcile }
