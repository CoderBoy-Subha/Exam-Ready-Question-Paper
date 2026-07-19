import { useNavigate } from 'react-router-dom'
import RippleButton from './RippleButton.jsx'
import HeroCarousel from './HeroCarousel.jsx'
import styles from './Home.module.css'

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className={styles.home}>
      <div className={styles.badge}>
        <span className={styles.badgeDiamond} aria-hidden="true" />
        Instant, examiner-quality papers
        <span className={styles.badgeDiamond} aria-hidden="true" />
      </div>

      <h1 className={styles.title}>
        AI Based <em>Question Paper Generator</em>
      </h1>

      <p className={styles.subtitle}>
        Turn your study material or syllabus into a ready-to-print exam paper in minutes.
      </p>

      <HeroCarousel />

      <div className={styles.ctaTop}>
        <RippleButton variant="primary" onClick={() => navigate('/upload')}>
          Start Generating Paper
        </RippleButton>
      </div>
    </div>
  )
}
