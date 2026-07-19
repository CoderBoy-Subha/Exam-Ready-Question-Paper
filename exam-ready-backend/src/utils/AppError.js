export class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.details = details
  }

  static badRequest(message, details) {
    return new AppError(400, message, details)
  }

  static notFound(message = 'Not found') {
    return new AppError(404, message)
  }

  static gone(message = 'This session has expired.') {
    return new AppError(410, message)
  }

  static tooManyRequests(message = 'Rate limit exceeded, try again later.') {
    return new AppError(429, message)
  }

  static badGateway(message = 'Upstream service failed.') {
    return new AppError(502, message)
  }
}
