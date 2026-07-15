import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  setScore,
  setComment,
  setEmail,
  toggleEmailField,
  submitStarted,
  submitSucceeded,
  submitFailed,
} from '../store/ratingSlice.js'
import { submitRating } from '../api/client.js'
import styles from './RatingWidget.module.css'

export default function RatingWidget({ generationId }) {
  const dispatch = useDispatch()
  const { score, comment, email, showEmailField, status } = useSelector((s) => s.rating)
  const [hovered, setHovered] = useState(0)

  if (status === 'submitted') {
    return (
      <div className={styles.thanks}>
        <span className={styles.thanksDrop} aria-hidden="true" />
        Thanks — that helps us tune future papers.
      </div>
    )
  }

  const handleSubmit = async () => {
    dispatch(submitStarted())
    try {
      await submitRating(generationId, { score, comment, email: showEmailField ? email : '' })
      dispatch(submitSucceeded())
    } catch (err) {
      dispatch(submitFailed(err.message))
    }
  }

  return (
    <div className={styles.widget}>
      <p className={styles.prompt}>How was this paper?</p>
      <div className={styles.stars} role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={score === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className={styles.star}
            data-filled={(hovered || score) >= n}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => dispatch(setScore(n))}
          >
            &#10022;
          </button>
        ))}
      </div>

      {score > 0 && (
        <div className={styles.details}>
          <textarea
            className={styles.comment}
            placeholder="Anything worth mentioning? (optional)"
            value={comment}
            maxLength={1000}
            rows={2}
            onChange={(e) => dispatch(setComment(e.target.value))}
          />

          {showEmailField ? (
            <input
              type="email"
              className={styles.emailInput}
              placeholder="you@school.edu"
              value={email}
              onChange={(e) => dispatch(setEmail(e.target.value))}
            />
          ) : (
            <button
              type="button"
              className={styles.emailToggle}
              onClick={() => dispatch(toggleEmailField())}
            >
              + Add email so we can follow up
            </button>
          )}

          <button
            type="button"
            className={styles.submit}
            onClick={handleSubmit}
            disabled={status === 'submitting'}
          >
            {status === 'submitting' ? 'Sending…' : 'Send feedback'}
          </button>
        </div>
      )}
    </div>
  )
}
