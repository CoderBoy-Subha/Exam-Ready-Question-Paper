import { visitorsRepo } from '../db/repositories.js'

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
