import mammoth from 'mammoth'

/**
 * Converts a raw upload (multer memory-storage file) + contentSource
 * into the normalized payload shape that gets cached in Redis for the
 * session. Matches the two paths from the spec:
 *   - PDFs and images -> sent directly to Gemini (native support),
 *     so we just base64-encode the buffer and keep the mimeType.
 *   - .docx -> converted to plain text server-side first (Gemini
 *     doesn't accept .docx directly).
 *   - syllabus pasted as text -> used as-is, no file involved.
 *
 * Never writes anything to disk — multer uses memory storage, and the
 * buffer is only ever base64'd into the Redis payload or handed to
 * mammoth in-memory.
 */
export async function extractContent({ contentSource, file, syllabusText }) {
  if (!file) {
    if (contentSource !== 'syllabus' || !syllabusText?.trim()) {
      throw new Error('Either a file or syllabus text is required.')
    }
    return {
      fileFormat: 'text',
      payload: { kind: 'text', text: syllabusText.trim() },
    }
  }

  const fileFormat = detectFileFormat(file.mimetype)

  if (fileFormat === 'docx') {
    const { value: text } = await mammoth.extractRawText({ buffer: file.buffer })
    if (!text.trim()) {
      throw new Error('Could not extract any text from this Word document.')
    }
    return { fileFormat, payload: { kind: 'text', text: text.trim() } }
  }

  // pdf or image: Gemini processes these natively, so pass the bytes
  // straight through as inline data rather than extracting anything.
  return {
    fileFormat,
    payload: {
      kind: 'inline',
      mimeType: file.mimetype,
      base64: file.buffer.toString('base64'),
    },
  }
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
