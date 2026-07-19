import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './config/env.js'
import { visitorTracking } from './middleware/visitorTracking.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { router } from './routes/index.js'

export function createApp() {
  const app = express()

  app.set('trust proxy', env.trustProxyHops)

  app.use(helmet())
  app.use(cors({ origin: env.corsOrigin }))
  app.use(express.json({ limit: '200kb' }))
  app.use(visitorTracking)

  app.use('/api', router)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
