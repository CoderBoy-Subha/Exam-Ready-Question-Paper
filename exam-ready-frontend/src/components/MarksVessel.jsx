import { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { QUESTION_CATEGORIES } from '../utils/questionCategories.js'
import styles from './MarksVessel.module.css'

export default function MarksVessel() {
  const questionCounts = useSelector((s) => s.config.questionCounts)
  const targetMarks = useSelector((s) => s.config.targetMarks)
  const [bubbles, setBubbles] = useState([])
  const prevTotal = useRef(0)

  const currentTotal = useMemo(
    () =>
      QUESTION_CATEGORIES.reduce((sum, c) => sum + (questionCounts[c.code] || 0) * c.marks, 0),
    [questionCounts],
  )

  const scaleMax = Math.max(targetMarks, currentTotal, 1) * 1.08
  const fillPct = Math.min(100, (currentTotal / scaleMax) * 100)
  const targetPct = Math.min(100, (targetMarks / scaleMax) * 100)
  const isExact = currentTotal === targetMarks && targetMarks > 0
  const isOver = currentTotal > targetMarks

  useEffect(() => {
    if (currentTotal > prevTotal.current) {
      const id = Date.now() + Math.random()
      setBubbles((b) => [...b, { id }])
      window.setTimeout(() => {
        setBubbles((b) => b.filter((x) => x.id !== id))
      }, 900)
    }
    prevTotal.current = currentTotal
  }, [currentTotal])

  return (
    <div className={styles.wrap}>
      <div
        className={`${styles.track} ${isExact ? styles.exact : ''} ${isOver ? styles.over : ''}`}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={targetMarks}
        aria-valuenow={currentTotal}
        aria-label="Total marks configured"
      >
        <div className={styles.fill} style={{ width: `${fillPct}%` }}>
          <span className={styles.meniscus} aria-hidden="true" />
          {bubbles.map((b) => (
            <span key={b.id} className={styles.bubble} aria-hidden="true" />
          ))}
        </div>
        <div className={styles.targetMarker} style={{ left: `${targetPct}%` }}>
          <span className={styles.targetFlag} />
        </div>
        {isExact && <span className={styles.exactRipple} aria-hidden="true" />}
      </div>

      <div className={styles.readout}>
        <span className={styles.readoutNumbers}>
          <strong className={isOver ? styles.overNumber : undefined}>{currentTotal}</strong>
          <span className={styles.readoutDivider}>/</span>
          {targetMarks}
        </span>
        <span className={styles.readoutHint}>
          {isExact
            ? 'Level reached — ready to generate'
            : isOver
              ? `${currentTotal - targetMarks} marks over target`
              : `${targetMarks - currentTotal} marks to go`}
        </span>
      </div>
    </div>
  )
}
