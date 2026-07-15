import { describe, it, expect, beforeAll } from 'vitest'
import { Document, Packer, Paragraph } from 'docx'
import { extractContent, detectFileFormat } from '../../src/services/fileExtraction.service.js'

let sampleDocxBuffer

beforeAll(async () => {
  const doc = new Document({
    sections: [
      { children: [new Paragraph('Chapter 4: Photosynthesis converts light into chemical energy.')] },
    ],
  })
  sampleDocxBuffer = await Packer.toBuffer(doc)
})

describe('detectFileFormat', () => {
  it('maps known mimetypes to the DB enum values', () => {
    expect(detectFileFormat('application/pdf')).toBe('pdf')
    expect(
      detectFileFormat('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ).toBe('docx')
    expect(detectFileFormat('application/msword')).toBe('docx')
    expect(detectFileFormat('image/png')).toBe('image')
    expect(detectFileFormat('image/jpeg')).toBe('image')
  })

  it('throws on an unsupported mimetype', () => {
    expect(() => detectFileFormat('audio/mpeg')).toThrow(/Unsupported file type/)
  })
})

describe('extractContent', () => {
  it('extracts real text from a .docx buffer via mammoth', async () => {
    const result = await extractContent({
      contentSource: 'study_material',
      file: {
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: sampleDocxBuffer,
      },
    })
    expect(result.fileFormat).toBe('docx')
    expect(result.payload.kind).toBe('text')
    expect(result.payload.text).toContain('Photosynthesis')
  })

  it('base64-encodes a PDF as inline data without altering its bytes', async () => {
    const fakePdfBytes = Buffer.from('%PDF-1.4 fake pdf content for testing purposes')
    const result = await extractContent({
      contentSource: 'study_material',
      file: { mimetype: 'application/pdf', buffer: fakePdfBytes },
    })
    expect(result.fileFormat).toBe('pdf')
    expect(result.payload.kind).toBe('inline')
    expect(Buffer.from(result.payload.base64, 'base64').equals(fakePdfBytes)).toBe(true)
  })

  it('base64-encodes an image the same way', async () => {
    const fakeImageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]) // PNG magic bytes
    const result = await extractContent({
      contentSource: 'study_material',
      file: { mimetype: 'image/png', buffer: fakeImageBytes },
    })
    expect(result.fileFormat).toBe('image')
    expect(result.payload.mimeType).toBe('image/png')
  })

  it('uses pasted syllabus text as-is when no file is given', async () => {
    const result = await extractContent({ contentSource: 'syllabus', syllabusText: '  Unit 1: Algebra  ' })
    expect(result.fileFormat).toBe('text')
    expect(result.payload.text).toBe('Unit 1: Algebra')
  })

  it('throws when neither a file nor syllabus text is given', async () => {
    await expect(extractContent({ contentSource: 'syllabus', syllabusText: '' })).rejects.toThrow()
  })

  it('throws a readable error on an empty .docx (no extractable text)', async () => {
    const emptyDoc = new Document({ sections: [{ children: [] }] })
    const emptyBuffer = await Packer.toBuffer(emptyDoc)
    await expect(
      extractContent({
        contentSource: 'study_material',
        file: {
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          buffer: emptyBuffer,
        },
      }),
    ).rejects.toThrow(/Could not extract/)
  })
})
