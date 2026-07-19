export function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` })
}

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
