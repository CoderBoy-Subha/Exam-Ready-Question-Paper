import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './SectionPreviewModal.module.css'

function letterFor(index) {
  return String.fromCharCode(97 + index)
}

export default function SectionPreviewModal({ section, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  if (!section) return null

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={section.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <div>
            <h3>{section.title}</h3>
            {section.instructions && <p className={styles.instructions}>{section.instructions}</p>}
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className={styles.modalBody}>
          <ol className={styles.questionList}>
            {section.questions.map((q, idx) => (
              <li key={q.id ?? idx} className={styles.questionItem}>
                <div className={styles.questionHead}>
                  <span className={styles.questionPrompt}>{q.prompt}</span>
                  <span className={styles.questionMarks}>
                    {q.marks} mark{q.marks > 1 ? 's' : ''}
                  </span>
                </div>
                {q.type === 'mcq' && Array.isArray(q.options) && (
                  <ul className={styles.options}>
                    {q.options.map((opt, i) => (
                      <li key={i}>
                        <span className={styles.optionLetter}>{letterFor(i)})</span> {opt}
                      </li>
                    ))}
                  </ul>
                )}
                {q.answer && (
                  <p className={styles.answer}>
                    <span className={styles.answerLabel}>Answer</span>
                    {q.answer}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>,
    document.body,
  )
}
