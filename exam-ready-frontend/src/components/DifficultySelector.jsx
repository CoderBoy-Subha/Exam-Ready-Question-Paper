import { useDispatch, useSelector } from 'react-redux'
import { setDifficulty } from '../store/configSlice.js'
import { DIFFICULTIES } from '../utils/questionCategories.js'

export default function DifficultySelector() {
  const dispatch = useDispatch()
  const difficulty = useSelector((s) => s.config.difficulty)

  return (
    <div className="difficultyGroup" role="radiogroup" aria-label="Difficulty">
      {DIFFICULTIES.map((d) => (
        <button
          key={d.value}
          type="button"
          role="radio"
          aria-checked={difficulty === d.value}
          className={`difficultyOption ${difficulty === d.value ? 'difficultyOptionActive' : ''}`}
          onClick={() => dispatch(setDifficulty(d.value))}
        >
          {d.label}
        </button>
      ))}
    </div>
  )
}
