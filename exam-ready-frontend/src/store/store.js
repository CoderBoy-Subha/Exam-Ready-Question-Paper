import { configureStore } from '@reduxjs/toolkit'
import configReducer from './configSlice.js'
import uploadReducer from './uploadSlice.js'
import generationReducer from './generationSlice.js'
import ratingReducer from './ratingSlice.js'

export const store = configureStore({
  reducer: {
    config: configReducer,
    upload: uploadReducer,
    generation: generationReducer,
    rating: ratingReducer,
  },
})
