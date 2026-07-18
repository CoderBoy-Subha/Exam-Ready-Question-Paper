import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import BackgroundScene from './components/BackgroundScene.jsx'
import GlassPanel from './components/GlassPanel.jsx'
import StepIndicator from './components/StepIndicator.jsx'
import UploadStep from './components/UploadStep.jsx'
import ConfigStep from './components/ConfigStep.jsx'
import PaperResult from './components/PaperResult.jsx'
import ConsentNotice from './components/ConsentNotice.jsx'
import { useSessionCleanup } from './hooks/useSessionCleanup.js'
import styles from './App.module.css'

function Layout() {
  useSessionCleanup()

  return (
    <div className={styles.app}>
      <BackgroundScene />

      <header className={styles.header}>
        <div className={styles.wordmark}>
          <span className={styles.wordmarkDrop} aria-hidden="true" />
          AI&nbsp;Based <em>Question Paper Generator</em>
        </div>
        <StepIndicator />
      </header>

      <main className={styles.main}>
        <GlassPanel className={styles.stage}>
          <Outlet />
        </GlassPanel>
      </main>

      {/*<ConsentNotice />*/}
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/upload" replace />} />
        <Route path="upload" element={<UploadStep />} />
        <Route path="configure" element={<ConfigStep />} />
        <Route path="paper/:generationId" element={<PaperResult />} />
        <Route path="*" element={<Navigate to="/upload" replace />} />
      </Route>
    </Routes>
  )
}
