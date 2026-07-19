import { Routes, Route, Navigate, Outlet, Link, useLocation } from 'react-router-dom'
import BackgroundScene from './components/BackgroundScene.jsx'
import GlassPanel from './components/GlassPanel.jsx'
import StepIndicator from './components/StepIndicator.jsx'
import Home from './components/Home.jsx'
import UploadStep from './components/UploadStep.jsx'
import ConfigStep from './components/ConfigStep.jsx'
import PaperResult from './components/PaperResult.jsx'
import Footer from './components/Footer.jsx'
import { useSessionCleanup } from './hooks/useSessionCleanup.js'
import styles from './App.module.css'

function RootLayout() {
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


function StepPanel() {
  return (
    <GlassPanel className={styles.stage}>
      <Outlet />
    </GlassPanel>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<Home />} />
        <Route element={<StepPanel />}>
          <Route path="upload" element={<UploadStep />} />
          <Route path="configure" element={<ConfigStep />} />
          <Route path="paper/:generationId" element={<PaperResult />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
