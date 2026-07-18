import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  status: 'idle', // idle | pending | loading | completed | failed
  generationId: null,
  paper: null,
  error: null,
}

const generationSlice = createSlice({
  name: 'generation',
  initialState,
  reducers: {
    startGeneration(state) {
      state.status = 'pending' // actively generating via the AI engine
      state.error = null
    },
    startLoadingExisting(state) {
      state.status = 'loading' // fetching an already-generated paper by id
      state.error = null
    },
    generationSucceeded(state, action) {
      state.status = 'completed'
      state.generationId = action.payload.generationId
      state.paper = action.payload
    },
    generationFailed(state, action) {
      state.status = 'failed'
      state.error = action.payload
    },
    resetGeneration() {
      return initialState
    },
  },
})

export const {
  startGeneration,
  startLoadingExisting,
  generationSucceeded,
  generationFailed,
  resetGeneration,
} = generationSlice.actions

export default generationSlice.reducer
