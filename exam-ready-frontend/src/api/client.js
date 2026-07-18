const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Request failed (${res.status})`)
  }
  return res.json()
}

export async function uploadSource({ contentSource, files, syllabusText, turnstileToken }) {
  const form = new FormData()
  form.append('contentSource', contentSource)
  ;(files || []).forEach((file) => form.append('files', file))
  if (syllabusText) form.append('syllabusText', syllabusText)
  if (turnstileToken) form.append('turnstileToken', turnstileToken)

  return request('/upload', { method: 'POST', body: form })
}

export async function generatePaper({ sessionId, config, regenerateFrom, makeItDifferent }) {
  return request('/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      targetTotalMarks: config.targetMarks,
      difficulty: config.difficulty,
      customInstructions: config.customInstructions,
      questionCounts: config.questionCounts,
      regenerateFrom: regenerateFrom ?? null,
      makeItDifferent: Boolean(makeItDifferent),
    }),
  })
}

export async function getGeneration(generationId) {
  return request(`/generations/${generationId}`)
}

export function getDownloadUrl(generationId, format) {
  return `${BASE_URL}/generations/${generationId}/download?format=${format}`
}

export async function submitRating(generationId, { score, comment, email }) {
  return request(`/generations/${generationId}/ratings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score, comment: comment || null, email: email || null }),
  })
}

// Public footer stats: { visitorCount, papersGenerated, ratingCount, averageRating }
export async function getStats() {
  return request('/stats')
}

export function sendCleanupBeacon(sessionId) {
  if (!sessionId || !navigator.sendBeacon) return false
  const blob = new Blob([JSON.stringify({ sessionId })], { type: 'application/json' })
  return navigator.sendBeacon(`${BASE_URL}/cleanup`, blob)
}
