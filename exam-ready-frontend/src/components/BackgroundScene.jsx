import styles from './BackgroundScene.module.css'

// Three softly blurred, slowly drifting color orbs over the nebula
// gradient — ambient only, matching the reference app's .orb1/.orb2/.orb3.
const ORBS = [
  { className: styles.orb1, top: '10%', left: '8%' },
  { className: styles.orb2, top: '55%', left: '78%' },
  { className: styles.orb3, top: '75%', left: '15%' },
]

export default function BackgroundScene() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.nebula} />
      {ORBS.map((orb, i) => (
        <span key={i} className={`${styles.orb} ${orb.className}`} style={{ top: orb.top, left: orb.left }} />
      ))}
    </div>
  )
}
