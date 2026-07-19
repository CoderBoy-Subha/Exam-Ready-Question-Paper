import { purgeSessionNow } from '../services/purge.service.js'

export async function cleanupHandler(req, res) {
  const { sessionId } = req.body
  await purgeSessionNow(sessionId)
  res.status(204).end()
}
