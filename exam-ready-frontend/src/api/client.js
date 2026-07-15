// Assumed backend contract — this was built ahead of the Express routes,
// so it's the single place to update if actual endpoint shapes differ.
// See README.md for the full contract list.

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

export async function uploadSource({ contentSource, file, syllabusText, turnstileToken }) {
  const form = new FormData()
  form.append('contentSource', contentSource)
  if (file) form.append('file', file)
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

export function sendCleanupBeacon(sessionId) {
  if (!sessionId || !navigator.sendBeacon) return false
  const blob = new Blob([JSON.stringify({ sessionId })], { type: 'application/json' })
  return navigator.sendBeacon(`${BASE_URL}/cleanup`, blob)
}
