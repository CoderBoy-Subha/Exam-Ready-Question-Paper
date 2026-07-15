import { query } from './pool.js'

// ---------------------------------------------------------------------
// visitors — one row per IP, upserted on each request (see
// middleware/visitorTracking.js). Never purged automatically; see
// DESIGN.md from the schema deliverable for the retention flag.
// ---------------------------------------------------------------------
export const visitorsRepo = {
  async upsert(ipAddress, userAgent) {
    const { rows } = await query(
      `INSERT INTO visitors (ip_address, user_agent)
       VALUES ($1, $2)
       ON CONFLICT (ip_address) DO UPDATE
         SET last_seen_at = now(),
             visit_count = visitors.visit_count + 1,
             user_agent = EXCLUDED.user_agent
       RETURNING id`,
      [ipAddress, userAgent || null],
    )
    return rows[0].id
  },
}

// ---------------------------------------------------------------------
// sessions — the lifecycle anchor for one upload. Content itself
// lives in Redis (cache/redisClient.js); this table only tracks
// activity + expiry so the purge job and cleanup endpoint know what
// to clear.
// ---------------------------------------------------------------------
export const sessionsRepo = {
  async create({ visitorId, ttlMinutes }) {
    const { rows } = await query(
      `INSERT INTO sessions (visitor_id, expires_at)
       VALUES ($1, now() + ($2 || ' minutes')::interval)
       RETURNING id, expires_at`,
      [visitorId, ttlMinutes],
    )
    return rows[0]
  },

  /** Returns the session row if it exists, isn't purged, and hasn't expired — else null. */
  async findActive(sessionId) {
    const { rows } = await query(
      `SELECT id, visitor_id, created_at, last_activity_at, expires_at, purged_at
       FROM sessions
       WHERE id = $1 AND purged_at IS NULL AND expires_at > now()`,
      [sessionId],
    )
    return rows[0] || null
  },

  /** Sliding-window renewal: called on every meaningful action (e.g. a new generation). */
  async touch(sessionId, ttlMinutes) {
    const { rows } = await query(
      `UPDATE sessions
       SET last_activity_at = now(), expires_at = now() + ($2 || ' minutes')::interval
       WHERE id = $1 AND purged_at IS NULL
       RETURNING id, expires_at`,
      [sessionId, ttlMinutes],
    )
    return rows[0] || null
  },

  /** Immediate, on-demand purge (cleanup endpoint) — same soft-purge semantics as the sweep job. */
  async markPurgedNow(sessionId) {
    await query(`UPDATE generations SET purged_at = now() WHERE session_id = $1 AND purged_at IS NULL`, [
      sessionId,
    ])
    const { rows } = await query(
      `UPDATE sessions SET purged_at = now() WHERE id = $1 AND purged_at IS NULL RETURNING id`,
      [sessionId],
    )
    return rows[0]?.id || null
  },

  /** Generation ids under a session — needed to know which Redis output keys to clear. */
  async generationIdsForSession(sessionId) {
    const { rows } = await query(`SELECT id FROM generations WHERE session_id = $1`, [sessionId])
    return rows.map((r) => r.id)
  },
}

// ---------------------------------------------------------------------
// generations — metadata only (see schema.sql's header comment: no
// file bytes, extracted text, or generated paper text ever land
// here — that's Redis's job).
// ---------------------------------------------------------------------
export const generationsRepo = {
  async create({
    sessionId,
    visitorId,
    parentGenerationId,
    ipAddress,
    contentSource,
    fileFormat,
    targetTotalMarks,
    difficulty,
    customInstructions,
    turnstileVerified,
    ttlMinutes,
  }) {
    const { rows } = await query(
      `INSERT INTO generations (
         session_id, visitor_id, parent_generation_id, ip_address,
         content_source, file_format, target_total_marks, difficulty,
         custom_instructions, turnstile_verified, expires_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now() + ($11 || ' minutes')::interval)
       RETURNING id`,
      [
        sessionId,
        visitorId,
        parentGenerationId || null,
        ipAddress,
        contentSource,
        fileFormat,
        targetTotalMarks,
        difficulty,
        customInstructions || null,
        turnstileVerified,
        ttlMinutes,
      ],
    )
    return rows[0].id
  },

  async insertSelections(generationId, questionCounts) {
    const entries = Object.entries(questionCounts || {}).filter(([, count]) => count > 0)
    if (entries.length === 0) return
    const values = []
    const params = []
    entries.forEach(([code, count], i) => {
      params.push(generationId, code, count)
      const base = i * 3
      values.push(`($${base + 1}, $${base + 2}, $${base + 3})`)
    })
    await query(
      `INSERT INTO generation_question_selections (generation_id, category_code, question_count)
       VALUES ${values.join(', ')}`,
      params,
    )
  },

  /** Mirrors the DB's validate_generation_marks(uuid) function. */
  async validateMarks(generationId) {
    const { rows } = await query(`SELECT validate_generation_marks($1) AS is_valid`, [generationId])
    return rows[0].is_valid
  },

  /** Rate-limit check — uses idx_generations_ip_created, no join needed. */
  async countRecentByIp(ipAddress, windowHours) {
    const { rows } = await query(
      `SELECT count(*)::int AS count
       FROM generations
       WHERE ip_address = $1 AND created_at > now() - ($2 || ' hours')::interval`,
      [ipAddress, windowHours],
    )
    return rows[0].count
  },

  async markCompleted(generationId, geminiRequestMeta) {
    await query(
      `UPDATE generations
       SET status = 'completed', completed_at = now(), gemini_request_meta = $2
       WHERE id = $1`,
      [generationId, geminiRequestMeta ? JSON.stringify(geminiRequestMeta) : null],
    )
  },

  async markFailed(generationId, errorMessage) {
    await query(`UPDATE generations SET status = 'failed', error_message = $2 WHERE id = $1`, [
      generationId,
      errorMessage,
    ])
  },

  async findById(generationId) {
    const { rows } = await query(
      `SELECT id, session_id, visitor_id, parent_generation_id, ip_address, content_source,
              file_format, target_total_marks, difficulty, custom_instructions, status,
              created_at, completed_at, expires_at, purged_at
       FROM generations WHERE id = $1`,
      [generationId],
    )
    return rows[0] || null
  },
}

// ---------------------------------------------------------------------
// ratings — one per generation; upserted so a re-rate edits in place
// (matches the UNIQUE(generation_id) constraint + trg_ratings_updated_at
// trigger in schema.sql).
// ---------------------------------------------------------------------
export const ratingsRepo = {
  async upsert({ generationId, score, comment, email }) {
    const { rows } = await query(
      `INSERT INTO ratings (generation_id, score, comment, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (generation_id) DO UPDATE
         SET score = EXCLUDED.score, comment = EXCLUDED.comment, email = EXCLUDED.email
       RETURNING id`,
      [generationId, score, comment || null, email || null],
    )
    return rows[0].id
  },
}

// ---------------------------------------------------------------------
// purge — thin wrapper around the DB's own purge_expired_sessions()
// function (defined in schema.sql). See services/purge.service.js for
// how the returned ids get used to clear Redis.
// ---------------------------------------------------------------------
export const purgeRepo = {
  async purgeExpiredSessions() {
    // purge_expired_sessions() RETURNS SETOF UUID (a scalar, not a
    // named TABLE), so Postgres names the output column after the
    // function itself unless aliased explicitly here.
    const { rows } = await query(`SELECT * FROM purge_expired_sessions() AS result(purged_session_id)`)
    return rows.map((r) => r.purged_session_id)
  },
}
