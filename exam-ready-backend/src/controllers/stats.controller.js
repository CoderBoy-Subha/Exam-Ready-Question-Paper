import { getPublicStats } from '../services/stats.service.js'

export async function getStatsHandler(req, res) {
  const stats = await getPublicStats()
  res.json(stats)
}
