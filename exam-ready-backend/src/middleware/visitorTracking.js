import { visitorsRepo } from '../db/repositories.js'

// Runs globally (see app.js). Silent, automatic, no prompt — matches
// the spec's "log IP address + timestamp + user-agent for every
// visitor automatically". Purely IP-keyed (visitors.ip_address is
// UNIQUE), so this needs no cookie or login to work.
export async function visitorTracking(req, res, next) {
  try {
    const ipAddress = req.ip
    const userAgent = req.get('user-agent') || null
    req.clientIp = ipAddress
    req.visitorId = await visitorsRepo.upsert(ipAddress, userAgent)
    next()
  } catch (err) {
    next(err)
  }
}
