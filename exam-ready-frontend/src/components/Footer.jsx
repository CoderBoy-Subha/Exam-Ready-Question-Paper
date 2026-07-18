import { useEffect, useRef, useState } from 'react'
import { getStats } from '../api/client.js'
import styles from './Footer.module.css'

function useCountUp(target, durationMs = 800) {
  const [value, setValue] = useState(0)
  const startRef = useRef(null)

  useEffect(() => {
    if (target == null) return undefined

    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setValue(target)
      return undefined
    }

    startRef.current = null
    let frame
    const step = (timestamp) => {
      if (startRef.current === null) startRef.current = timestamp
      const progress = Math.min(1, (timestamp - startRef.current) / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) frame = requestAnimationFrame(step)
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
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>
        {averageRating == null ? (
          '—'
        ) : (
          <>
            {averageRating.toFixed(1)}
            <span className={styles.star} aria-hidden="true">
              &#10022;
            </span>
          </>
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
    getStats()
      .then((data) => {
        if (!cancelled) setStats(data)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <div className={styles.wordmark}>
            <span className={styles.wordmarkDrop} aria-hidden="true" />
            AI&nbsp;Based<em>Question Paper Generator</em>
          </div>
          <p className={styles.tagline}>Building exam-ready papers from your material, instantly.</p>
        </div>

        {!failed && (
          <div className={styles.stats}>
            <StatBlock value={stats?.visitorCount} label="Visitors" />
            <div className={styles.divider} aria-hidden="true" />
            <StatBlock value={stats?.papersGenerated} label="Papers generated" />
            <div className={styles.divider} aria-hidden="true" />
            <RatingBlock averageRating={stats?.averageRating} ratingCount={stats?.ratingCount} />
          </div>
        )}

        <div className={styles.bottom}>
          <span>&copy; {new Date().getFullYear()} AI Based Question Paper Generator</span>
          <span className={styles.bottomDot} aria-hidden="true">&middot;</span>
          <span>Your files are processed for this session only, never stored permanently.</span>
        </div>
      </div>
    </footer>
  )
}
