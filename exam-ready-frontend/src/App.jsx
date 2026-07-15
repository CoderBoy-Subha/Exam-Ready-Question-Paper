import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import BackgroundScene from './components/BackgroundScene.jsx'
import GlassPanel from './components/GlassPanel.jsx'
import StepIndicator from './components/StepIndicator.jsx'
import UploadStep from './components/UploadStep.jsx'
import ConfigStep from './components/ConfigStep.jsx'
import PaperResult from './components/PaperResult.jsx'
import ConsentNotice from './components/ConsentNotice.jsx'
import { useSessionCleanup } from './hooks/useSessionCleanup.js'
import { startGeneration, generationSucceeded, generationFailed } from './store/generationSlice.js'
import { generatePaper } from './api/client.js'
import styles from './App.module.css'

const STEPS = [
  { key: 'upload', label: 'Source' },
  { key: 'configure', label: 'Configure' },
  { key: 'result', label: 'Paper' },
]

export default function App() {
  const [stepIndex, setStepIndex] = useState(0)
  const dispatch = useDispatch()
  const upload = useSelector((s) => s.upload)
  const config = useSelector((s) => s.config)
  const generation = useSelector((s) => s.generation)

  useSessionCleanup()

  const goNext = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0))

  const handleGenerate = async () => {
    setStepIndex(2)
    dispatch(startGeneration())
    try {
      const result = await generatePaper({
        sessionId: upload.sessionId,
        config,
        regenerateFrom: generation.generationId,
        makeItDifferent: Boolean(generation.generationId),
      })
      dispatch(generationSucceeded(result))
    } catch (err) {
      dispatch(generationFailed(err.message))
    }
  }

  return (
    <div className={styles.app}>
      <BackgroundScene />

      <header className={styles.header}>
        <div className={styles.wordmark}>
          <span className={styles.wordmarkDrop} aria-hidden="true" />
          Exam&#8209;Ready
        </div>
        <StepIndicator steps={STEPS} activeIndex={stepIndex} />
      </header>

      <main className={styles.main}>
        <GlassPanel className={styles.stage}>
          {stepIndex === 0 && <UploadStep onContinue={goNext} />}
          {stepIndex === 1 && <ConfigStep onBack={goBack} onGenerate={handleGenerate} />}
          {stepIndex === 2 && (
            <PaperResult
              status={generation.status}
              error={generation.error}
              paper={generation.paper}
              onBack={goBack}
              onRegenerate={handleGenerate}
            />
          )}
        </GlassPanel>
      </main>

      <ConsentNotice />
    </div>
  )
}
