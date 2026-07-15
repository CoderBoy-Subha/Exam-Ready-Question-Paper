import { env } from '../config/env.js'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

// Exported separately from the middleware so tests can call it with an
// injected fetchImpl instead of hitting Cloudflare for real.
export async function verifyTurnstileToken(token, remoteIp, fetchImpl = globalThis.fetch) {
  if (env.turnstileDisabled) return true
  if (!token) return false

  const body = new URLSearchParams({ secret: env.turnstileSecretKey, response: token })
  if (remoteIp) body.append('remoteip', remoteIp)

  const res = await fetchImpl(VERIFY_URL, { method: 'POST', body })
  if (!res.ok) return false
  const data = await res.json()
  return Boolean(data.success)
}

// Applied to the upload route: one human check per session, rather
// than per generation. Repeated /generations calls against an already
// -verified session (including regenerates) are then capped by
// rateLimiter.js instead of re-checking Turnstile every time.
export function requireTurnstile({ fetchImpl } = {}) {
  return async function turnstileMiddleware(req, res, next) {
    try {
      if (env.turnstileDisabled) return next()
      const token = req.body?.turnstileToken
      const ok = await verifyTurnstileToken(token, req.clientIp, fetchImpl)
      if (!ok) {
        return res.status(400).json({ message: 'Bot verification failed. Please retry.' })
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}
