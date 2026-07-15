import { useDispatch, useSelector } from 'react-redux'
import { setTargetMarks, setCustomInstructions, selectComputedTotal } from '../store/configSlice.js'
import QuestionCategoryGrid from './QuestionCategoryGrid.jsx'
import MarksVessel from './MarksVessel.jsx'
import DifficultySelector from './DifficultySelector.jsx'
import RippleButton from './RippleButton.jsx'
import styles from './ConfigStep.module.css'

export default function ConfigStep({ onBack, onGenerate }) {
  const dispatch = useDispatch()
  const targetMarks = useSelector((s) => s.config.targetMarks)
  const customInstructions = useSelector((s) => s.config.customInstructions)
  const currentTotal = useSelector(selectComputedTotal)
  const canGenerate = currentTotal === targetMarks && targetMarks > 0

  return (
    <div className={styles.step}>
      <div className={styles.stepHead}>
        <h2>Configure the paper</h2>
        <p className={styles.stepSub}>
          Set how many questions of each type — the paper fills to your target automatically.
        </p>
      </div>

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
        <RippleButton variant="ghost" onClick={onBack}>
          Back
        </RippleButton>
        <RippleButton variant="primary" onClick={onGenerate} disabled={!canGenerate}>
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
