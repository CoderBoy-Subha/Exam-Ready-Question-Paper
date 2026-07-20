import { useEffect, useRef, useState } from 'react'
import { getStats } from '../api/client.js'
import styles from './Footer.module.css'

const POLL_MS = 60_000 // matches the server-side cache window (services/stats.service.js)

// Animates from the PREVIOUS displayed value to the new one, not from
// zero every time — needed now that stats poll periodically. Without
// this, every silent background refresh would reset the numbers to 0
// and count back up, which reads as broken rather than "live".
function useCountUp(target, durationMs = 800) {
  const [value, setValue] = useState(target ?? 0)
  const fromRef = useRef(target ?? 0)
  const startRef = useRef(null)

  useEffect(() => {
    if (target == null) return undefined

    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setValue(target)
      fromRef.current = target
      return undefined
    }

    const from = fromRef.current
    if (from === target) return undefined // unchanged since last render — nothing to animate

    startRef.current = null
    let frame
    const step = (timestamp) => {
      if (startRef.current === null) startRef.current = timestamp
      const progress = Math.min(1, (timestamp - startRef.current) / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (progress < 1) {
        frame = requestAnimationFrame(step)
      } else {
        fromRef.current = target
      }
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])

  return value
}

function StatBlock({ value, label }) {
  const animated = useCountUp(value)
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value == null ? '—' : animated.toLocaleString()}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

function RatingBlock({ averageRating, ratingCount }) {
  const hasRating = averageRating != null && !Number.isNaN(Number(averageRating))
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>
        {hasRating ? (
          <>
            {Number(averageRating).toFixed(1)}
            <span className={styles.star} aria-hidden="true">
              &#10022;
            </span>
          </>
        ) : (
          '—'
        )}
      </span>
      <span className={styles.statLabel}>
        {ratingCount ? `Avg. rating · ${ratingCount.toLocaleString()} ratings` : 'Avg. rating'}
      </span>
    </div>
  )
}

export default function Footer() {
  const [stats, setStats] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    const fetchStats = () => {
      getStats()
        .then((data) => {
          if (!cancelled) {
            setStats(data)
            setFailed(false)
          }
        })
        .catch(() => {
          if (!cancelled) setFailed(true)
        })
    }

    fetchStats()

    // Keeps the numbers moving without a page reload.
    const intervalId = setInterval(fetchStats, POLL_MS)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchStats()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <div className={styles.wordmark}>
            <span className={styles.wordmarkDrop} aria-hidden="true" />
            AI&nbsp;Based <em>MCQ Generator</em>
          </div>
          <p className={styles.tagline}>Building exam-ready papers from your material, instantly.</p>
        </div>

        {!failed && (
          <div className={styles.stats}>
            <StatBlock value={stats?.visitorCount} label="Visitors" />
            <div className={styles.divider} aria-hidden="true" />
            <StatBlock value={stats?.totalVisits} label="Total visits" />
            <div className={styles.divider} aria-hidden="true" />
            <StatBlock value={stats?.papersGenerated} label="Papers generated" />
            <div className={styles.divider} aria-hidden="true" />
            <RatingBlock averageRating={stats?.averageRating} ratingCount={stats?.ratingCount} />
          </div>
        )}

        <div className={styles.bottom}>
          <span>&copy; {new Date().getFullYear()} AI Based MCQ Generator</span>
          <span className={styles.bottomDot} aria-hidden="true">&middot;</span>
          <span>Your files are processed for this session only, never stored permanently.</span>
        </div>
      </div>
    </footer>
  )
}
