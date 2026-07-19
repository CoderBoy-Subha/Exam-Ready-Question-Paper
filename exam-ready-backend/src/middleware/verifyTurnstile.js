import { env } from '../config/env.js'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

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
