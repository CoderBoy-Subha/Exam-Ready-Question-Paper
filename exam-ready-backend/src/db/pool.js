import pg from 'pg'
import { env } from '../config/env.js'

const { Pool } = pg

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
})

pool.on('error', (err) => {
  // A connection sitting idle in the pool died — this is not a
  // request-time error, so there's no res to reply to. Log loudly;
  // the pool recovers its own connections automatically.
  console.error('Unexpected error on idle Postgres client', err)
})

export async function query(text, params) {
  return pool.query(text, params)
}
