import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { setTargetMarks, setCustomInstructions, selectComputedTotal } from '../store/configSlice.js'
import { startGeneration, generationSucceeded, generationFailed } from '../store/generationSlice.js'
import { generatePaper } from '../api/client.js'
import QuestionCategoryGrid from './QuestionCategoryGrid.jsx'
import MarksVessel from './MarksVessel.jsx'
import DifficultySelector from './DifficultySelector.jsx'
import RippleButton from './RippleButton.jsx'
import GeneratingStatus from './GeneratingStatus.jsx'
import styles from './ConfigStep.module.css'

export default function ConfigStep() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const sessionId = useSelector((s) => s.upload.sessionId)
  const targetMarks = useSelector((s) => s.config.targetMarks)
  const customInstructions = useSelector((s) => s.config.customInstructions)
  const currentTotal = useSelector(selectComputedTotal)
  const config = useSelector((s) => s.config)
  const generationStatus = useSelector((s) => s.generation.status)
  const generationError = useSelector((s) => s.generation.error)
  const canGenerate = currentTotal === targetMarks && targetMarks > 0

  // No active session (fresh visit, refresh, or expired) -> back to upload.
  useEffect(() => {
    if (!sessionId) navigate('/upload', { replace: true })
  }, [sessionId, navigate])

  const handleGenerate = async () => {
    dispatch(startGeneration())
    try {
      const result = await generatePaper({ sessionId, config })
      dispatch(generationSucceeded(result))
      navigate(`/paper/${result.generationId}`)
    } catch (err) {
      dispatch(generationFailed(err.message))
    }
  }

  if (generationStatus === 'pending') {
    return <GeneratingStatus title="Working through your material…" />
  }

  if (!sessionId) return null

  return (
    <div className={styles.step}>
      <div className={styles.stepHead}>
        <h2>Configure the paper</h2>
        <p className={styles.stepSub}>
          Set how many questions of each type — the paper fills to your target automatically.
        </p>
      </div>

      {generationError && <p className={styles.gateHint}>{generationError}</p>}

      <div className={styles.targetRow}>
        <label className={styles.targetLabel} htmlFor="targetMarks">
          Target total
        </label>
        <div className={styles.targetInputWrap}>
          <input
            id="targetMarks"
            type="number"
            min={1}
            value={targetMarks}
            onChange={(e) => dispatch(setTargetMarks(Number(e.target.value) || 0))}
            className={styles.targetInput}
          />
          <span className={styles.targetUnit}>marks</span>
        </div>
      </div>

      <MarksVessel />

      <QuestionCategoryGrid />

      <div className={styles.row}>
        <span className={styles.fieldLabel}>Difficulty</span>
        <DifficultySelector />
      </div>

      <div className={styles.row}>
        <label className={styles.fieldLabel} htmlFor="customInstructions">
          Custom instructions <span className={styles.optional}>optional</span>
        </label>
        <textarea
          id="customInstructions"
          className={styles.textarea}
          placeholder="e.g. focus on chapter 4, avoid numerical problems"
          value={customInstructions}
          maxLength={2000}
          rows={3}
          onChange={(e) => dispatch(setCustomInstructions(e.target.value))}
        />
      </div>

      <div className={styles.actions}>
        <RippleButton variant="ghost" onClick={() => navigate('/upload')}>
          Back
        </RippleButton>
        <RippleButton variant="primary" onClick={handleGenerate} disabled={!canGenerate}>
          Generate paper
        </RippleButton>
      </div>
      {!canGenerate && (
        <p className={styles.gateHint}>
          Adjust question counts until the total matches your target to continue.
        </p>
      )}
    </div>
  )
}
