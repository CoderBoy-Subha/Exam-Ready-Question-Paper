import styles from './BackgroundScene.module.css'

// Ambient ONLY — ~0.5 opacity, slow 24-36s loops, ignored by
// prefers-reduced-motion. This is atmosphere, not a focal point; the
// ripple button and marks vessel are where the motion budget goes.
const DROPLETS = [
  { top: '8%', left: '12%', size: 180, delay: '0s', duration: '26s' },
  { top: '65%', left: '6%', size: 120, delay: '-6s', duration: '32s' },
  { top: '15%', left: '82%', size: 220, delay: '-12s', duration: '30s' },
  { top: '70%', left: '78%', size: 160, delay: '-3s', duration: '24s' },
  { top: '42%', left: '48%', size: 260, delay: '-18s', duration: '36s' },
]

export default function BackgroundScene() {
  return (
    <div className={styles.scene} aria-hidden="true">
      <div className={styles.wash} />
      {DROPLETS.map((d, i) => (
        <span
          key={i}
          className={styles.droplet}
          style={{
            top: d.top,
            left: d.left,
            width: d.size,
            height: d.size,
            animationDelay: d.delay,
            animationDuration: d.duration,
          }}
        />
      ))}
    </div>
  )
}
