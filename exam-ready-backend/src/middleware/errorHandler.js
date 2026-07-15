// Wraps an async route/middleware fn so a rejected promise reaches
// Express's error pipeline instead of becoming an unhandled rejection.
export function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` })
}

// Central error formatter. AppError carries a status + a message
// that's already safe to show the client. Anything else (a bug, a
// driver error) is logged with full detail server-side but collapses
// to a generic 500 in the response — never leak internals.
export function errorHandler(err, req, res, _next) {
  if (err.name === 'AppError') {
    if (err.statusCode >= 500) console.error(err)
    return res
      .status(err.statusCode)
      .json({ message: err.message, ...(err.details ? { details: err.details } : {}) })
  }

  if (err.name === 'ZodError') {
    return res.status(400).json({ message: 'Invalid request', details: err.issues })
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'File is too large.' })
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.message?.includes('Unexpected field')) {
    return res.status(400).json({ message: 'Unexpected upload field.' })
  }

  console.error(err)
  return res.status(500).json({ message: 'Something went wrong on our end.' })
}
