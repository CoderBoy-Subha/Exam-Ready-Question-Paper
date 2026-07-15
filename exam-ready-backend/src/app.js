import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './config/env.js'
import { visitorTracking } from './middleware/visitorTracking.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { router } from './routes/index.js'

export function createApp() {
  const app = express()

  // Correctly derive req.ip from X-Forwarded-For when sitting behind a
  // reverse proxy — required for both visitor tracking and rate
  // limiting to see the real client IP rather than the proxy's.
  // Adjust TRUST_PROXY_HOPS to match your actual infra.
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
