import { useEffect, useRef, useState } from 'react'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
const CALLBACK_NAME = '__onTurnstileLoad'
const LOAD_TIMEOUT_MS = 8000

let scriptLoadingPromise = null

// Loads the Turnstile script at most once for the page's lifetime,
// even across this component mounting/unmounting repeatedly as the
// user navigates to/from /upload. Uses the documented ?onload= query
// param rather than turnstile.ready() — Cloudflare's own docs note
// .ready() conflicts with async/defer on the script tag, which we
// want for non-blocking page load.
function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve()
  if (scriptLoadingPromise) return scriptLoadingPromise

  scriptLoadingPromise = new Promise((resolve) => {
    window[CALLBACK_NAME] = resolve
    const script = document.createElement('script')
    script.src = `${SCRIPT_SRC}?render=explicit&onload=${CALLBACK_NAME}`
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  })
  return scriptLoadingPromise
}

/**
 * Explicit-render wrapper around Cloudflare Turnstile.
 *
 * @param {string} siteKey
 * @param {(token: string) => void} onVerify - called with the token on success
 * @param {() => void} [onExpire] - token expired (tokens live 5 min) or errored
 * @param {() => void} [onUnavailable] - script didn't load in time (e.g. blocked
 *   by an ad/privacy blocker) — callers should fail open rather than permanently
 *   block legitimate users who can't load Cloudflare's script.
 * @param {'light'|'dark'|'auto'} [theme]
 */
export default function Turnstile({ siteKey, onVerify, onExpire, onUnavailable, theme = 'dark' }) {
  const containerRef = useRef(null)
  const [ready, setReady] = useState(false)

  // Refs so the render effect below doesn't need these in its
  // dependency array — inline callback props change identity on every
  // parent render, which would otherwise tear down and re-render the
  // widget (and silently invalidate any in-progress challenge) constantly.
  const onVerifyRef = useRef(onVerify)
  const onExpireRef = useRef(onExpire)
  const onUnavailableRef = useRef(onUnavailable)
  useEffect(() => {
    onVerifyRef.current = onVerify
    onExpireRef.current = onExpire
    onUnavailableRef.current = onUnavailable
  })

  useEffect(() => {
    let cancelled = false
    const timeoutId = setTimeout(() => {
      if (!cancelled && !window.turnstile) onUnavailableRef.current?.()
    }, LOAD_TIMEOUT_MS)

    loadTurnstileScript().then(() => {
      clearTimeout(timeoutId)
      if (!cancelled) setReady(true)
    })

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [])

  useEffect(() => {
    if (!ready || !containerRef.current || !siteKey) return undefined

    const widgetId = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme,
      size: 'flexible',
      callback: (token) => onVerifyRef.current?.(token),
      'expired-callback': () => {
        onExpireRef.current?.()
        window.turnstile.reset(widgetId)
      },
      'error-callback': () => {
        onExpireRef.current?.()
      },
    })

    return () => {
      window.turnstile.remove(widgetId)
    }
  }, [ready, siteKey, theme])

  return <div ref={containerRef} />
}
