import { describe, it, expect, beforeAll } from 'vitest'
import { Document, Packer, Paragraph } from 'docx'
import { extractContent, detectFileFormat } from '../../src/services/fileExtraction.service.js'

let sampleDocxBuffer
let secondDocxBuffer

beforeAll(async () => {
  const doc1 = new Document({
    sections: [
      { children: [new Paragraph('Chapter 4: Photosynthesis converts light into chemical energy.')] },
    ],
  })
  sampleDocxBuffer = await Packer.toBuffer(doc1)

  const doc2 = new Document({
    sections: [{ children: [new Paragraph('Chapter 5: Cellular respiration releases stored energy.')] }],
  })
  secondDocxBuffer = await Packer.toBuffer(doc2)
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

describe('extractContent — single file (still works via the files array)', () => {
  it('extracts real text from a .docx buffer via mammoth', async () => {
    const result = await extractContent({
      contentSource: 'study_material',
      files: [
        {
          originalname: 'notes.docx',
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          buffer: sampleDocxBuffer,
        },
      ],
    })
    expect(result.fileFormat).toBe('docx')
    expect(result.payload.parts).toHaveLength(1)
    expect(result.payload.parts[0].kind).toBe('text')
    expect(result.payload.parts[0].text).toContain('Photosynthesis')
    expect(result.payload.parts[0].sourceName).toBe('notes.docx')
  })

  it('base64-encodes a PDF as inline data without altering its bytes', async () => {
    const fakePdfBytes = Buffer.from('%PDF-1.4 fake pdf content for testing purposes')
    const result = await extractContent({
      contentSource: 'study_material',
      files: [{ originalname: 'a.pdf', mimetype: 'application/pdf', buffer: fakePdfBytes }],
    })
    expect(result.fileFormat).toBe('pdf')
    expect(result.payload.parts[0].kind).toBe('inline')
    expect(Buffer.from(result.payload.parts[0].base64, 'base64').equals(fakePdfBytes)).toBe(true)
  })

  it('base64-encodes an image the same way', async () => {
    const fakeImageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]) // PNG magic bytes
    const result = await extractContent({
      contentSource: 'study_material',
      files: [{ originalname: 'diagram.png', mimetype: 'image/png', buffer: fakeImageBytes }],
    })
    expect(result.fileFormat).toBe('image')
    expect(result.payload.parts[0].mimeType).toBe('image/png')
  })

  it('uses pasted syllabus text as-is when no file is given', async () => {
    const result = await extractContent({ contentSource: 'syllabus', files: [], syllabusText: '  Unit 1: Algebra  ' })
    expect(result.fileFormat).toBe('text')
    expect(result.payload.parts[0].text).toBe('Unit 1: Algebra')
  })

  it('throws when neither files nor syllabus text are given', async () => {
    await expect(extractContent({ contentSource: 'syllabus', files: [], syllabusText: '' })).rejects.toThrow()
  })

  it('throws a readable error on an empty .docx (no extractable text)', async () => {
    const emptyDoc = new Document({ sections: [{ children: [] }] })
    const emptyBuffer = await Packer.toBuffer(emptyDoc)
    await expect(
      extractContent({
        contentSource: 'study_material',
        files: [
          {
            originalname: 'empty.docx',
            mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            buffer: emptyBuffer,
          },
        ],
      }),
    ).rejects.toThrow(/Could not extract/)
  })
})

describe('extractContent — multiple files', () => {
  it('produces one part per file, each labeled with its own source name', async () => {
    const fakePdfBytes = Buffer.from('%PDF-1.4 fake')
    const result = await extractContent({
      contentSource: 'study_material',
      files: [
        { originalname: 'ch4.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: sampleDocxBuffer },
        { originalname: 'ch5.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: secondDocxBuffer },
        { originalname: 'diagram.pdf', mimetype: 'application/pdf', buffer: fakePdfBytes },
      ],
    })

    expect(result.payload.parts).toHaveLength(3)
    expect(result.payload.parts.map((p) => p.sourceName)).toEqual(['ch4.docx', 'ch5.docx', 'diagram.pdf'])
    expect(result.payload.parts[0].text).toContain('Photosynthesis')
    expect(result.payload.parts[1].text).toContain('respiration')
    expect(result.payload.parts[2].kind).toBe('inline')
  })

  it('reports fileFormat as the shared format when every file matches', async () => {
    const result = await extractContent({
      contentSource: 'study_material',
      files: [
        { originalname: 'a.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: sampleDocxBuffer },
        { originalname: 'b.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: secondDocxBuffer },
      ],
    })
    expect(result.fileFormat).toBe('docx')
  })

  it('reports fileFormat as "mixed" when files differ in format', async () => {
    const fakePdfBytes = Buffer.from('%PDF-1.4 fake')
    const result = await extractContent({
      contentSource: 'study_material',
      files: [
        { originalname: 'a.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: sampleDocxBuffer },
        { originalname: 'b.pdf', mimetype: 'application/pdf', buffer: fakePdfBytes },
      ],
    })
    expect(result.fileFormat).toBe('mixed')
  })

  it('also counts pasted syllabus text as a distinct source when combined with files', async () => {
    const fakePdfBytes = Buffer.from('%PDF-1.4 fake')
    const result = await extractContent({
      contentSource: 'syllabus',
      files: [{ originalname: 'a.pdf', mimetype: 'application/pdf', buffer: fakePdfBytes }],
      syllabusText: 'Also cover unit 2',
    })
    expect(result.fileFormat).toBe('mixed')
    expect(result.payload.parts).toHaveLength(2)
    expect(result.payload.parts[0].sourceName).toBe('pasted text')
  })

  it('names the offending file when one of several fails extraction', async () => {
    const emptyDoc = new Document({ sections: [{ children: [] }] })
    const emptyBuffer = await Packer.toBuffer(emptyDoc)
    await expect(
      extractContent({
        contentSource: 'study_material',
        files: [
          { originalname: 'good.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: sampleDocxBuffer },
          { originalname: 'bad.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: emptyBuffer },
        ],
      }),
    ).rejects.toThrow(/"bad\.docx"/)
  })
})
