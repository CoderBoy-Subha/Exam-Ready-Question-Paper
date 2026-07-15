import { describe, it, expect } from 'vitest'
import { renderPdfBuffer, renderDocxBuffer, buildExportMeta } from '../../src/services/paperExport.service.js'

const paper = {
  sections: [
    {
      title: 'Section A — MCQ',
      instructions: 'Choose one option.',
      questions: [
        {
          id: 's0-q0',
          marks: 1,
          type: 'mcq',
          prompt: 'What is 2+2?',
          options: ['3', '4', '5', '6'],
          answer: '4',
        },
      ],
    },
    {
      title: 'Section B — Short Answer',
      questions: [
        { id: 's1-q0', marks: 5, type: 'subjective', prompt: 'Explain gravity.', answer: 'Gravity is...' },
      ],
    },
  ],
}

describe('buildExportMeta', () => {
  it('computes total marks and question count from the paper', () => {
    const meta = buildExportMeta(paper, { difficulty: 'mixture' })
    expect(meta.totalMarks).toBe(6)
    expect(meta.questionCount).toBe(2)
    expect(meta.difficulty).toBe('mixture')
  })
})

describe('renderPdfBuffer', () => {
  it('produces a real, non-trivial PDF buffer', async () => {
    const buffer = await renderPdfBuffer(paper, buildExportMeta(paper, { difficulty: 'mixture' }))
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(500)
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-')
  })
})

describe('renderDocxBuffer', () => {
  it('produces a real, non-trivial DOCX buffer (zip container)', async () => {
    const buffer = await renderDocxBuffer(paper, buildExportMeta(paper, { difficulty: 'mixture' }))
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(500)
    // .docx files are zip archives -> PK magic bytes
    expect(buffer[0]).toBe(0x50)
    expect(buffer[1]).toBe(0x4b)
  })
})
