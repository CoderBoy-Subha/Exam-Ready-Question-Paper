import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { sendCleanupBeacon } from '../api/client.js'

// Best-effort immediate cleanup: fires sendBeacon on tab hide / page
// hide so well-behaved exits get an instant delete server-side instead
// of waiting for the inactivity-timeout backstop.
export function useSessionCleanup() {
  const sessionId = useSelector((s) => s.upload.sessionId)

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        sendCleanupBeacon(sessionId)
      }
    }
    const handlePageHide = () => sendCleanupBeacon(sessionId)

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [sessionId])
}
