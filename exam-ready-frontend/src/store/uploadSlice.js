import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  contentSource: 'study_material', // 'study_material' | 'syllabus'
  file: null, // serializable metadata only: { name, size, type } — never the raw File
  syllabusText: '',
  sessionId: null,
  status: 'idle', // idle | uploading | ready | error
  error: null,
}

const uploadSlice = createSlice({
  name: 'upload',
  initialState,
  reducers: {
    setContentSource(state, action) {
      state.contentSource = action.payload
      state.file = null
      state.syllabusText = ''
    },
    uploadStarted(state) {
      state.status = 'uploading'
      state.error = null
    },
    uploadSucceeded(state, action) {
      state.status = 'ready'
      state.sessionId = action.payload.sessionId
      state.file = action.payload.file ?? null
    },
    uploadFailed(state, action) {
      state.status = 'error'
      state.error = action.payload
    },
    setSyllabusText(state, action) {
      state.syllabusText = action.payload
    },
    resetUpload() {
      return initialState
    },
  },
})

export const {
  setContentSource,
  uploadStarted,
  uploadSucceeded,
  uploadFailed,
  setSyllabusText,
  resetUpload,
} = uploadSlice.actions

export default uploadSlice.reducer
