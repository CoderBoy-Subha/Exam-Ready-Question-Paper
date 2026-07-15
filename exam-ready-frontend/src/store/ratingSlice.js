import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  score: 0,
  comment: '',
  email: '',
  showEmailField: false,
  status: 'idle', // idle | submitting | submitted | error
  error: null,
}

const ratingSlice = createSlice({
  name: 'rating',
  initialState,
  reducers: {
    setScore(state, action) {
      state.score = action.payload
    },
    setComment(state, action) {
      state.comment = action.payload.slice(0, 1000)
    },
    setEmail(state, action) {
      state.email = action.payload
    },
    toggleEmailField(state) {
      state.showEmailField = !state.showEmailField
    },
    submitStarted(state) {
      state.status = 'submitting'
      state.error = null
    },
    submitSucceeded(state) {
      state.status = 'submitted'
    },
    submitFailed(state, action) {
      state.status = 'error'
      state.error = action.payload
    },
    resetRating() {
      return initialState
    },
  },
})

export const {
  setScore,
  setComment,
  setEmail,
  toggleEmailField,
  submitStarted,
  submitSucceeded,
  submitFailed,
  resetRating,
} = ratingSlice.actions

export default ratingSlice.reducer
