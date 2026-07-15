import { createSlice } from '@reduxjs/toolkit'
import { QUESTION_CATEGORIES } from '../utils/questionCategories.js'

const initialCounts = Object.fromEntries(QUESTION_CATEGORIES.map((c) => [c.code, 0]))

const initialState = {
  questionCounts: initialCounts,
  targetMarks: 100,
  difficulty: 'mixture',
  customInstructions: '',
}

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    setCount(state, action) {
      const { code, count } = action.payload
      state.questionCounts[code] = Math.max(0, count)
    },
    incrementCount(state, action) {
      const code = action.payload
      state.questionCounts[code] = (state.questionCounts[code] ?? 0) + 1
    },
    decrementCount(state, action) {
      const code = action.payload
      state.questionCounts[code] = Math.max(0, (state.questionCounts[code] ?? 0) - 1)
    },
    setTargetMarks(state, action) {
      state.targetMarks = Math.max(0, action.payload)
    },
    setDifficulty(state, action) {
      state.difficulty = action.payload
    },
    setCustomInstructions(state, action) {
      state.customInstructions = action.payload.slice(0, 2000)
    },
    resetConfig() {
      return initialState
    },
  },
})

export const {
  setCount,
  incrementCount,
  decrementCount,
  setTargetMarks,
  setDifficulty,
  setCustomInstructions,
  resetConfig,
} = configSlice.actions

// Single source of truth for "current total marks" — used by both the
// MarksVessel display and the generate-button gate, so they can never
// disagree with each other.
export const selectComputedTotal = (state) =>
  QUESTION_CATEGORIES.reduce(
    (sum, c) => sum + (state.config.questionCounts[c.code] || 0) * c.marks,
    0,
  )

export default configSlice.reducer
