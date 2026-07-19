import mammoth from 'mammoth'

export async function extractContent({ contentSource, files, syllabusText }) {
  const parts = []
  const formatsSeen = new Set()

  if (contentSource === 'syllabus' && syllabusText?.trim()) {
    parts.push({ kind: 'text', text: syllabusText.trim(), sourceName: 'pasted text' })
    formatsSeen.add('text')
  }

  for (const file of files || []) {
    const format = detectFileFormat(file.mimetype)
    formatsSeen.add(format)

    if (format === 'docx') {
      const { value: text } = await mammoth.extractRawText({ buffer: file.buffer })
      if (!text.trim()) {
        throw new Error(`Could not extract any text from "${file.originalname}".`)
      }
      parts.push({ kind: 'text', text: text.trim(), sourceName: file.originalname })
      continue
    }

    parts.push({
      kind: 'inline',
      mimeType: file.mimetype,
      base64: file.buffer.toString('base64'),
      sourceName: file.originalname,
    })
  }

  if (parts.length === 0) {
    throw new Error('Upload at least one file, or paste syllabus text.')
  }

  const fileFormat = formatsSeen.size === 1 ? [...formatsSeen][0] : 'mixed'
  return { fileFormat, payload: { parts } }
}

export function detectFileFormat(mimetype) {
  if (mimetype === 'application/pdf') return 'pdf'
  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword'
  ) {
    return 'docx'
  }
  if (mimetype?.startsWith('image/')) return 'image'
  throw new Error(`Unsupported file type: ${mimetype}`)
}
