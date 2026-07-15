import { describe, it, expect, vi } from 'vitest'
import { env } from '../../src/config/env.js'
import { verifyTurnstileToken } from '../../src/middleware/verifyTurnstile.js'

// env.turnstileDisabled is true in the test .env (so integration tests
// don't need to fake Cloudflare); flip it locally per-test to exercise
// the real verification logic, then restore it.
function withTurnstileEnabled(fn) {
  return async () => {
    const original = env.turnstileDisabled
    env.turnstileDisabled = false
    try {
      await fn()
    } finally {
      env.turnstileDisabled = original
    }
  }
}

describe('verifyTurnstileToken', () => {
  it(
    'returns false when no token is provided',
    withTurnstileEnabled(async () => {
      const result = await verifyTurnstileToken(undefined, '1.2.3.4')
      expect(result).toBe(false)
    }),
  )

  it(
    'returns true when Cloudflare reports success',
    withTurnstileEnabled(async () => {
      const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
      const result = await verifyTurnstileToken('good-token', '1.2.3.4', fetchImpl)
      expect(result).toBe(true)
      expect(fetchImpl).toHaveBeenCalledWith(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        expect.objectContaining({ method: 'POST' }),
      )
    }),
  )

  it(
    'returns false when Cloudflare reports failure',
    withTurnstileEnabled(async () => {
      const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false }) })
      const result = await verifyTurnstileToken('bad-token', '1.2.3.4', fetchImpl)
      expect(result).toBe(false)
    }),
  )

  it(
    'returns false when the verify request itself fails',
    withTurnstileEnabled(async () => {
      const fetchImpl = vi.fn().mockResolvedValue({ ok: false })
      const result = await verifyTurnstileToken('token', '1.2.3.4', fetchImpl)
      expect(result).toBe(false)
    }),
  )

  it('short-circuits to true when Turnstile is disabled (test/dev default)', async () => {
    const result = await verifyTurnstileToken(undefined, '1.2.3.4')
    expect(result).toBe(true)
  })
})
