import { describe, it, expect, vi } from 'vitest'
import { generatePaper, _internal } from '../../src/services/aiGeneration.service.js'

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

describe('_internal.buildContentParts', () => {
  it('builds one text Part per text source and one inlineData Part per file source', () => {
    const extractedContent = {
      payload: {
        parts: [
          { kind: 'text', text: 'Chapter 1 notes', sourceName: 'notes.docx' },
          { kind: 'inline', mimeType: 'application/pdf', base64: 'AAAA', sourceName: 'chapter2.pdf' },
          { kind: 'inline', mimeType: 'image/png', base64: 'BBBB', sourceName: 'diagram.png' },
        ],
      },
    }
    const contents = _internal.buildContentParts({ extractedContent, promptText: 'PROMPT' })
    const parts = contents[0].parts

    expect(parts[0]).toEqual({ text: 'PROMPT' })
    expect(parts.some((p) => p.text?.includes('notes.docx') && p.text.includes('Chapter 1 notes'))).toBe(true)
    expect(parts.filter((p) => p.inlineData)).toHaveLength(2)
    expect(parts.find((p) => p.inlineData?.mimeType === 'application/pdf').inlineData.data).toBe('AAAA')
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

const singleTextSource = {
  fileFormat: 'text',
  payload: { parts: [{ kind: 'text', text: 'source material', sourceName: 'pasted text' }] },
}

describe('generatePaper', () => {
  it('returns a paper with stable injected ids on first-try success', async () => {
    const client = { models: { generateContent: vi.fn().mockResolvedValue(fakeResponse(goodSections)) } }
    const { paper, meta } = await generatePaper({
      extractedContent: singleTextSource,
      config: baseConfig,
      client,
    })
    expect(client.models.generateContent).toHaveBeenCalledTimes(1)
    expect(paper.sections[0].questions[0].id).toBe('s0-q0')
    expect(paper.sections[0].questions[2].id).toBe('s0-q2')
    expect(meta.ok).toBe(true)
  })

  it('sends every uploaded source as its own Part alongside the prompt text', async () => {
    const client = { models: { generateContent: vi.fn().mockResolvedValue(fakeResponse(goodSections)) } }
    const multiSource = {
      fileFormat: 'mixed',
      payload: {
        parts: [
          { kind: 'inline', mimeType: 'application/pdf', base64: 'ZmFrZQ==', sourceName: 'a.pdf' },
          { kind: 'inline', mimeType: 'image/png', base64: 'ZmFrZTI=', sourceName: 'b.png' },
          { kind: 'text', text: 'extra notes', sourceName: 'c.docx' },
        ],
      },
    }
    await generatePaper({ extractedContent: multiSource, config: baseConfig, client })
    const callArgs = client.models.generateContent.mock.calls[0][0]
    const parts = callArgs.contents[0].parts
    expect(parts.filter((p) => p.inlineData)).toHaveLength(2)
    expect(parts.some((p) => p.text?.includes('c.docx'))).toBe(true)
    expect(callArgs.config.responseMimeType).toBe('application/json')
  })

  it('retries once when the first response misses the mark scheme, then succeeds', async () => {
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce(fakeResponse(shortSections))
      .mockResolvedValueOnce(fakeResponse(goodSections))
    const client = { models: { generateContent } }

    const { paper } = await generatePaper({ extractedContent: singleTextSource, config: baseConfig, client })

    expect(generateContent).toHaveBeenCalledTimes(2)
    expect(paper.sections[0].questions).toHaveLength(3)
    const retryText = generateContent.mock.calls[1][0].contents[0].parts
      .map((p) => p.text)
      .filter(Boolean)
      .join('\n')
    expect(retryText).toMatch(/1 questions totalling 1 marks/)
  })

  it('throws a clear, vendor-neutral error if the retry also misses the mark scheme', async () => {
    const client = { models: { generateContent: vi.fn().mockResolvedValue(fakeResponse(shortSections)) } }

    await expect(
      generatePaper({ extractedContent: singleTextSource, config: baseConfig, client }),
    ).rejects.toThrow(/AI engine could not produce a paper/i)
  })

  it('throws a clear, vendor-neutral error when the response is not valid JSON', async () => {
    const client = { models: { generateContent: vi.fn().mockResolvedValue({ text: 'not json at all' }) } }
    await expect(
      generatePaper({ extractedContent: singleTextSource, config: baseConfig, client }),
    ).rejects.toThrow(/AI engine returned a response that was not valid JSON/)
  })

  it('throws a clear, vendor-neutral error when the response is empty (e.g. safety block)', async () => {
    const client = {
      models: { generateContent: vi.fn().mockResolvedValue({ text: '', promptFeedback: { blockReason: 'SAFETY' } }) },
    }
    await expect(
      generatePaper({ extractedContent: singleTextSource, config: baseConfig, client }),
    ).rejects.toThrow(/AI engine declined.*SAFETY/)
  })

  it('never mentions the underlying provider name in any thrown error', async () => {
    const client = { models: { generateContent: vi.fn().mockResolvedValue(fakeResponse(shortSections)) } }
    try {
      await generatePaper({ extractedContent: singleTextSource, config: baseConfig, client })
      throw new Error('expected generatePaper to throw')
    } catch (err) {
      expect(err.message).not.toMatch(/gemini/i)
    }
  })
})
