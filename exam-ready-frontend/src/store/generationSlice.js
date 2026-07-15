import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  status: 'idle', // idle | pending | completed | failed
  generationId: null,
  paper: null,
  error: null,
}

const generationSlice = createSlice({
  name: 'generation',
  initialState,
  reducers: {
    startGeneration(state) {
      state.status = 'pending'
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

export const { startGeneration, generationSucceeded, generationFailed, resetGeneration } =
  generationSlice.actions

export default generationSlice.reducer
