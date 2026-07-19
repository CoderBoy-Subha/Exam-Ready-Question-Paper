import cron from 'node-cron'
import { env } from '../config/env.js'
import { runScheduledPurge } from '../services/purge.service.js'

export function startPurgeScheduler() {
  const everyN = Math.max(1, env.purgeSweepIntervalMinutes)
  const cronExpr = `*/${everyN} * * * *`

  const task = cron.schedule(cronExpr, async () => {
    try {
      const purged = await runScheduledPurge()
      if (purged.length) {
        console.log(`[purge] cleared ${purged.length} expired session(s)`)
      }
    } catch (err) {
      console.error('[purge] sweep failed', err)
    }
  })

  console.log(`[purge] scheduled every ${everyN} minute(s)`)
  return task
}
