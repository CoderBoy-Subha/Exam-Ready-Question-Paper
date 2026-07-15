import { describe, it, expect, vi } from 'vitest'
import { generatePaper, _internal } from '../../src/services/gemini.service.js'

const baseConfig = {
  questionCounts: { MCQ_1: 2, SUB_5: 1 },
  targetTotalMarks: 7,
  difficulty: 'mixture',
  customInstructions: '',
}

function fakeResponse(sections) {
  return { text: JSON.stringify({ sections }) }
}

const goodSections = [
  {
    title: 'Section A',
    questions: [
      { marks: 1, difficulty: 'easy', type: 'mcq', prompt: 'Q1', options: ['a', 'b', 'c', 'd'], answer: 'a' },
      { marks: 1, difficulty: 'easy', type: 'mcq', prompt: 'Q2', options: ['a', 'b', 'c', 'd'], answer: 'b' },
      { marks: 5, difficulty: 'medium', type: 'subjective', prompt: 'Q3', answer: 'because...' },
    ],
  },
]

const shortSections = [
  {
    title: 'Section A',
    questions: [{ marks: 1, difficulty: 'easy', type: 'mcq', prompt: 'Q', answer: 'a' }],
  },
]

describe('_internal.buildPromptText', () => {
  it('includes the exact question breakdown from the requested config', () => {
    const prompt = _internal.buildPromptText({ config: baseConfig, previousQuestionPrompts: [] })
    expect(prompt).toContain('2 × Multiple Choice Question, 1 mark each')
    expect(prompt).toContain('1 × Subjective question, 5 marks each')
    expect(prompt).toContain('Total: 7 marks across 3 questions')
  })

  it('adds a variation instruction and prior prompts when regenerating', () => {
    const prompt = _internal.buildPromptText({
      config: baseConfig,
      previousQuestionPrompts: ['What is the capital of France?'],
    })
    expect(prompt).toMatch(/DIFFERENT set of questions/)
    expect(prompt).toContain('What is the capital of France?')
  })

  it('folds in custom instructions when provided', () => {
    const prompt = _internal.buildPromptText({
      config: { ...baseConfig, customInstructions: 'Focus on chapter 4' },
      previousQuestionPrompts: [],
    })
    expect(prompt).toContain('Focus on chapter 4')
  })
})

describe('_internal.marksReconcile', () => {
  it('passes when totals and counts match exactly', () => {
    const result = _internal.marksReconcile({ sections: goodSections }, baseConfig)
    expect(result.ok).toBe(true)
    expect(result.actualTotal).toBe(7)
    expect(result.actualCount).toBe(3)
  })

  it('fails when totals do not match', () => {
    const result = _internal.marksReconcile({ sections: shortSections }, baseConfig)
    expect(result.ok).toBe(false)
    expect(result.expectedTotal).toBe(7)
    expect(result.actualTotal).toBe(1)
  })
})

describe('generatePaper', () => {
  it('returns a paper with stable injected ids on first-try success', async () => {
    const client = { models: { generateContent: vi.fn().mockResolvedValue(fakeResponse(goodSections)) } }
    const { paper, meta } = await generatePaper({
      extractedContent: { fileFormat: 'text', payload: { kind: 'text', text: 'source material' } },
      config: baseConfig,
      client,
    })
    expect(client.models.generateContent).toHaveBeenCalledTimes(1)
    expect(paper.sections[0].questions[0].id).toBe('s0-q0')
    expect(paper.sections[0].questions[2].id).toBe('s0-q2')
    expect(meta.ok).toBe(true)
  })

  it('sends inline PDF/image data as a Part alongside the prompt text', async () => {
    const client = { models: { generateContent: vi.fn().mockResolvedValue(fakeResponse(goodSections)) } }
    await generatePaper({
      extractedContent: { fileFormat: 'pdf', payload: { kind: 'inline', mimeType: 'application/pdf', base64: 'ZmFrZQ==' } },
      config: baseConfig,
      client,
    })
    const callArgs = client.models.generateContent.mock.calls[0][0]
    const parts = callArgs.contents[0].parts
    expect(parts.some((p) => p.inlineData?.mimeType === 'application/pdf')).toBe(true)
    expect(callArgs.config.responseMimeType).toBe('application/json')
  })

  it('retries once when the first response misses the mark scheme, then succeeds', async () => {
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(shortSections))
      .mockResolvedValueOnce(fakeResponse(goodSections))
    const client = { models: { generateContent } }

    const { paper } = await generatePaper({
      extractedContent: { fileFormat: 'text', payload: { kind: 'text', text: 'source' } },
      config: baseConfig,
      client,
    })

    expect(generateContent).toHaveBeenCalledTimes(2)
    expect(paper.sections[0].questions).toHaveLength(3)
    // the corrective retry prompt should call out the specific mismatch —
    // check across all text parts, since buildContentParts unshifts the
    // source-material text ahead of the prompt text for text-based content.
    const retryText = generateContent.mock.calls[1][0].contents[0].parts
      .map((p) => p.text)
      .filter(Boolean)
      .join('\n')
    expect(retryText).toMatch(/1 questions totalling 1 marks/)
  })

  it('throws a clear error if the retry also misses the mark scheme', async () => {
    const client = { models: { generateContent: vi.fn().mockResolvedValue(fakeResponse(shortSections)) } }

    await expect(
      generatePaper({
        extractedContent: { fileFormat: 'text', payload: { kind: 'text', text: 'source' } },
        config: baseConfig,
        client,
      }),
    ).rejects.toThrow(/could not produce a paper/i)
  })

  it('throws a clear error when Gemini returns non-JSON text', async () => {
    const client = { models: { generateContent: vi.fn().mockResolvedValue({ text: 'not json at all' }) } }
    await expect(
      generatePaper({
        extractedContent: { fileFormat: 'text', payload: { kind: 'text', text: 'source' } },
        config: baseConfig,
        client,
      }),
    ).rejects.toThrow(/not valid JSON/)
  })

  it('throws a clear error when the response is empty (e.g. safety block)', async () => {
    const client = {
      models: { generateContent: vi.fn().mockResolvedValue({ text: '', promptFeedback: { blockReason: 'SAFETY' } }) },
    }
    await expect(
      generatePaper({
        extractedContent: { fileFormat: 'text', payload: { kind: 'text', text: 'source' } },
        config: baseConfig,
        client,
      }),
    ).rejects.toThrow(/SAFETY/)
  })
})
