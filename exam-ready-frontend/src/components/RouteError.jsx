import { Link, useRouteError } from 'react-router-dom'
import GlassPanel from './GlassPanel.jsx'

// errorElement for the router (see main.jsx). Self-contained — an
// error at the root route means App (and its BackgroundScene) may not
// render at all, so this brings its own on-brand background rather
// than depending on anything else in the tree.
export default function RouteError() {
  const error = useRouteError()
  if (import.meta.env.DEV) console.error(error)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background:
          'radial-gradient(ellipse at 30% 20%, #1e3a5f 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, #2d1b69 0%, transparent 55%), #060612',
      }}
    >
      <GlassPanel style={{ maxWidth: 440, width: '100%', padding: '40px 32px', textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 24,
            margin: '0 0 10px',
            color: 'var(--text)',
          }}
        >
          Something went wrong
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 14, margin: '0 0 20px' }}>
          That page hit an unexpected error. You can head back and try again.
        </p>
        <Link to="/" style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
          &larr; Back to home
        </Link>
      </GlassPanel>
    </div>
  )
}
