import { createApp } from './app.js'
import { env } from './config/env.js'
import { connectRedis } from './cache/redisClient.js'
import { startPurgeScheduler } from './jobs/purgeScheduler.job.js'

async function main() {
  await connectRedis()
  const app = createApp()
  startPurgeScheduler()

  app.listen(env.port, () => {
    console.log(`exam-ready-backend listening on :${env.port} (${env.nodeEnv})`)
  })
}

main().catch((err) => {
  console.error('Failed to start server', err)
  process.exit(1)
})
