import { purgeSessionNow } from '../services/purge.service.js'

// The sendBeacon target: best-effort immediate cleanup on tab close /
// navigation, per the spec's data-retention rules. sendBeacon doesn't
// wait for or read the response, but we still return something
// sensible for direct testing / non-beacon callers.
export async function cleanupHandler(req, res) {
  const { sessionId } = req.body
  await purgeSessionNow(sessionId)
  res.status(204).end()
}
