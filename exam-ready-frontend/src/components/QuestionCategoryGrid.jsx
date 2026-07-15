import { useDispatch, useSelector } from 'react-redux'
import { QUESTION_CATEGORIES } from '../utils/questionCategories.js'
import { incrementCount, decrementCount, setCount } from '../store/configSlice.js'
import styles from './QuestionCategoryGrid.module.css'

export default function QuestionCategoryGrid() {
  const dispatch = useDispatch()
  const counts = useSelector((s) => s.config.questionCounts)

  const groups = [
    { title: 'Multiple Choice', items: QUESTION_CATEGORIES.filter((c) => c.kind === 'mcq') },
    {
      title: 'Short Answer',
      items: QUESTION_CATEGORIES.filter((c) => c.kind === 'subjective' && c.marks <= 6),
    },
    {
      title: 'Long Answer',
      items: QUESTION_CATEGORIES.filter((c) => c.kind === 'subjective' && c.marks > 6),
    },
  ]

  return (
    <div className={styles.grid}>
      {groups.map((group) => (
        <div key={group.title} className={styles.group}>
          <h3 className={styles.groupTitle}>{group.title}</h3>
          <div className={styles.rows}>
            {group.items.map((cat) => {
              const count = counts[cat.code] || 0
              return (
                <div key={cat.code} className={styles.row}>
                  <span className={styles.marksTag}>{cat.marks} mk</span>
                  <div className={styles.stepper}>
                    <button
                      type="button"
                      className={styles.stepperBtn}
                      onClick={() => dispatch(decrementCount(cat.code))}
                      disabled={count === 0}
                      aria-label={`Fewer ${cat.marks}-mark ${group.title.toLowerCase()}`}
                    >
                      &minus;
                    </button>
                    <input
                      className={styles.stepperInput}
                      type="number"
                      min={0}
                      value={count}
                      onChange={(e) =>
                        dispatch(setCount({ code: cat.code, count: Number(e.target.value) || 0 }))
                      }
                      aria-label={`Number of ${cat.marks}-mark ${group.title.toLowerCase()}`}
                    />
                    <button
                      type="button"
                      className={styles.stepperBtn}
                      onClick={() => dispatch(incrementCount(cat.code))}
                      aria-label={`More ${cat.marks}-mark ${group.title.toLowerCase()}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
