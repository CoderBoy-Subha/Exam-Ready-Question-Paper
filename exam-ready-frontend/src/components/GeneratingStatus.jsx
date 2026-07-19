import { useEffect, useState } from 'react'
import styles from './GeneratingStatus.module.css'

const MESSAGES = [
  'Reading through what you uploaded…',
  'Mapping questions to your mark scheme…',
  'Balancing difficulty across the paper…',
  'Drafting answer options…',
  'Double-checking the answer key…',
  'Refining the wording…',
]

const ROTATE_MS = 2600

export default function GeneratingStatus({ title }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length)
    }, ROTATE_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div className={styles.pending}>
      <div className={styles.pendingDrop} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h2>{title}</h2>
      <p key={index} className={styles.rotatingText}>
        {MESSAGES[index]}
      </p>
    </div>
  )
}
