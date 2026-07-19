import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { sendCleanupBeacon } from '../api/client.js'

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
