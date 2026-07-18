import 'dotenv/config'

function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function optionalInt(name, fallback) {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

function optionalBool(name, fallback) {
  const raw = process.env[name]
  if (raw === undefined) return fallback
  return raw.toLowerCase() === 'true'
}

// Fails fast on boot if something essential is missing, rather than
// limping along and throwing a confusing error on the first request.
export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: optionalInt('PORT', 4000),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  trustProxyHops: optionalInt('TRUST_PROXY_HOPS', 1),

  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),

  geminiApiKey: required('GEMINI_API_KEY'),
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3-flash-preview',

  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY || '',
  turnstileDisabled: optionalBool('TURNSTILE_DISABLED', false),

  sessionTtlMinutes: optionalInt('SESSION_TTL_MINUTES', 45),
  purgeSweepIntervalMinutes: optionalInt('PURGE_SWEEP_INTERVAL_MINUTES', 5),

  rateLimitMaxGenerationsPerHour: optionalInt('RATE_LIMIT_MAX_GENERATIONS_PER_HOUR', 10),
  uploadMaxFileSizeMb: optionalInt('UPLOAD_MAX_FILE_SIZE_MB', 15),
  uploadMaxFiles: optionalInt('UPLOAD_MAX_FILES', 6),
}
