import { useState } from 'react'

// Light-touch privacy disclosure near the point IP logging actually
// happens (every request, silently) — not a legal document, just an
// honest one-liner the person can dismiss.
export default function ConsentNotice() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="consentNotice" role="note">
      <span>
        We log your IP address and browser info to prevent abuse of the generator. No account,
        no tracking beyond that.
      </span>
      <button
        type="button"
        className="consentDismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss notice"
      >
        &times;
      </button>
    </div>
  )
}
