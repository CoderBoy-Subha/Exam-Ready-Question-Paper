import { Outlet, Link, useLocation } from 'react-router-dom'
import BackgroundScene from './components/BackgroundScene.jsx'
import StepIndicator from './components/StepIndicator.jsx'
import Footer from './components/Footer.jsx'
import { useSessionCleanup } from './hooks/useSessionCleanup.js'
import styles from './App.module.css'

export default function App() {
  useSessionCleanup()
  const { pathname } = useLocation()
  const isHome = pathname === '/'

  return (
    <div className={styles.app}>
      <BackgroundScene />

      <header className={styles.header}>
        <Link to="/" className={styles.wordmark}>
          <span className={styles.wordmarkDrop} aria-hidden="true" />
          AI&nbsp;Based <em>Question Paper Generator</em>
        </Link>
        {!isHome && <StepIndicator />}
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <Footer />

    </div>
  )
}
