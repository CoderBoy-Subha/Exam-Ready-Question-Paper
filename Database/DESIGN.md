# Database Design — Exam-Ready Question Paper Generator

Schema: `schema.sql` · ERD: `erd.mermaid` · both tested against a real PostgreSQL 16 instance (see "Tested" below).

## Engine choice: PostgreSQL

The spec left this open. Going with Postgres, not MySQL, for four concrete reasons this schema actually uses:

- **`INET`** — a native type for IP addresses (v4 and v6 in one column), with indexable comparison. MySQL has no equivalent; you'd store IPs as `VARCHAR` or pack them into `VARBINARY(16)` by hand.
- **`JSONB`** — for `gemini_request_meta`, with proper indexing support if you later want to query it.
- **Partial indexes** — `WHERE purged_at IS NULL`, used on both `sessions` and `generations`. These keep the sweep-job index tiny (it only ever indexes live rows) instead of growing forever. MySQL doesn't support this.
- **`ENUM` types that are easy to extend** — `ALTER TYPE ... ADD VALUE` is a lightweight metadata change in Postgres. MySQL's column-level enums require a table rewrite to add a value.

No extensions are required — `gen_random_uuid()` has been built into core Postgres since v13, so this runs unmodified on any vanilla managed instance (RDS, Cloud SQL, Supabase, Neon, etc.) without needing extension allowlisting.

If you're locked into MySQL for other reasons: swap `INET` for `VARBINARY(16)` + `INET6_ATON()`/`INET6_NTOA()`, swap `JSONB` for `JSON`, drop the partial indexes (use full indexes + filter in the query instead), and generate UUIDs in the application rather than via `gen_random_uuid()`. Everything else translates directly.

## The one big architectural call: no payload in Postgres

This is the decision that shapes everything else, so it's worth stating plainly: **`generations` never stores the uploaded file, the extracted text, or the generated question/answer content.** Only metadata lives here — config, status, timestamps, counts.

Why this matters: the spec's data-retention section requires that content be "never written to permanent storage" and that it disappear on inactivity timeout or tab close. But Postgres, by design, *is* permanent storage — it has WAL, backups, replicas, point-in-time-recovery. If you `DELETE` a row today, a backup taken yesterday still has it, and WAL archives may retain it for your full retention window. A `DELETE` in Postgres doesn't mean "gone" the way the spec's promise implies.

So the actual content — the uploaded PDF/DOCX/image, the text Gemini extracted, the generated paper — should live in something genuinely ephemeral: **Redis with a TTL**, or local temp-disk cleared by the same sweep job, or object storage with a short lifecycle rule. Redis is the natural fit here specifically because TTL gives you the inactivity-timeout backstop *for free* — no cron needed, the key just evaporates. Recommended key scheme:

```
session:{session_id}:upload        -> raw file bytes (or a path to a temp file)
session:{session_id}:extracted     -> extracted text sent to Gemini
generation:{generation_id}:output  -> generated question/answer JSON
```

Set `EXPIRE` on each key to match `sessions.expires_at` / `generations.expires_at` at write time, and refresh it whenever you touch `last_activity_at`. The `sendBeacon` cleanup endpoint just needs to issue `DEL` on the session's keys — instant, and doesn't need to touch Postgres at all if you don't need the audit trail; call `purge_expired_sessions()`-style bookkeeping only if you want the metadata rows marked too.

Because Postgres never held the payload, "purging" here is genuinely lightweight — see the next section.

## Two purge paths

**Routine (inactivity timeout, or a well-behaved `sendBeacon` exit) — soft.**
This clears the ephemeral store and stamps `purged_at`. It does **not** delete rows in Postgres. That's deliberate: `generations` rows are the thing `ratings` hangs off of, and they're what a rate-limit query counts against. If routine purging deleted them, you'd lose a user's feedback and your abuse-detection history every time a session times out — which is very likely not what you want.

```sql
SELECT * FROM purge_expired_sessions();  -- run every few minutes from a scheduler
-- returns the session ids it just marked purged; for each one,
-- DEL the matching Redis keys / temp files in your application code.
```

**Erasure request ("delete my data") — hard.**
A privacy/legal deletion request is a different operation, and it's the one place an actual `DELETE` makes sense:

```sql
DELETE FROM visitors WHERE id = '...';
-- cascades: visitors -> sessions -> generations -> ratings
--                                              \-> generation_question_selections
```

One statement, and the FK cascade chain (`ON DELETE CASCADE` throughout) takes care of everything downstream, including that visitor's ratings. This is intentional — if someone asks to be forgotten, their rating/comment/email should go too, not just their session data.

## Table notes

- **`visitors`** — one row per IP, upserted (not appended) on each request:
  ```sql
  INSERT INTO visitors (ip_address, user_agent)
  VALUES ($1, $2)
  ON CONFLICT (ip_address) DO UPDATE
    SET last_seen_at = now(), visit_count = visitors.visit_count + 1, user_agent = EXCLUDED.user_agent;
  ```
  This table is *not* on the session-purge cycle — it's traffic metadata, not file content, so keeping it doesn't violate the retention promise. But it has no purge policy of its own either, which is a flag (see below).

- **`question_categories`** — the 11 fixed (type, marks) combinations, as real rows rather than a hardcoded list in application code or a loose JSON blob. This is what makes the marks-cap check a real SQL aggregate instead of something you unpack from JSON by hand:
  ```sql
  SELECT validate_generation_marks('the-generation-uuid');  -- true/false
  ```
  It's advisory on purpose — the function just answers true/false, so the app can choose to reject *or* auto-adjust counts, matching the spec's "reject/adjust on submit" language. A hard DB trigger couldn't offer that choice; it could only reject.

- **`generations`** — one row per Gemini call, including every "Regenerate." Each regenerate creates a *new* row linked via `parent_generation_id`, so a session's regenerate history is a real lineage you can walk, and a rating always points at the specific attempt it's rating (not an ambiguous "the generation" if the user regenerated three times).

  `ip_address` is duplicated here from `visitors.ip_address` on purpose — it lets the rate-limit query run without a join, and it still works if `visitor_id` is ever null (cleared cookies, etc.).

- **`generation_question_selections`** — only rows with `question_count > 0` are stored; an unselected category simply has no row. Composite PK `(generation_id, category_code)` keeps one row per category per generation.

- **`ratings`** — `score` is modeled as `SMALLINT 1–5`. The spec left "thumbs up/down or stars" open; stars is the superset, so if the UI ends up being thumbs, map down→1, up→5 in the application layer rather than adding a second column. `generation_id` is `UNIQUE`, so a second rating attempt should be an `UPDATE`/upsert, not a new row — the trigger on `updated_at` makes that edit visible without a second timestamp column.

## Rate limiting

No separate counters table. `generations` already has what's needed, with a supporting index:

```sql
SELECT count(*) FROM generations
WHERE visitor_id = $1 AND created_at > now() - interval '1 hour';
```

`idx_generations_visitor_created (visitor_id, created_at DESC)` makes this cheap. There's also `idx_generations_ip_created (ip_address, created_at DESC)` for the same query keyed on raw IP, in case `visitor_id` linkage isn't available at the point you need to check. This is fine at moderate traffic; if generation volume gets very high, move the counter into Redis (`INCR` + `EXPIRE`) for lower latency — the Postgres query stays correct either way, just becomes the fallback/audit path instead of the hot path.

## What actually got tested

Loaded `schema.sql` against a real PostgreSQL 16 instance (clean run, zero errors) and then ran a fixture script exercising the non-obvious logic — not just checking that `CREATE TABLE` succeeds:

- `validate_generation_marks()` returns true for a matching config, false for a mismatched one
- The `content_source` / `file_format` cross-check constraint rejects `study_material + text` (only `syllabus` allows `text`)
- The `updated_at` trigger actually advances on edit
- The email-format `CHECK` rejects a malformed address
- The `UNIQUE(generation_id)` on `ratings` rejects a second rating on the same generation
- `purge_expired_sessions()` marks only the genuinely-expired session/generation and leaves a live one untouched
- The rate-limit query correctly windows by time (a deliberately 2-hour-old row falls outside a 1-hour check)
- Deleting a `visitors` row cascades through `sessions`, `generations`, `ratings`, and `generation_question_selections`

## Open flags

Carrying forward the spec's own "still worth deciding" items, plus a few the schema surfaced:

- **`visitors` retention window** — the spec doesn't say how long to keep IP logs, and this table has no purge cycle in the current design. Recommend picking a window (e.g., 90 days) and adding a scheduled `DELETE FROM visitors WHERE last_seen_at < now() - interval '90 days'` — cascades to any lingering sessions/generations for that IP too. Worth pairing with the consent-notice decision already flagged in the spec.
- **Thumbs vs. 5-star** — modeled as `score SMALLINT 1–5`; thumbs UI maps to the endpoints. Revisit if you want thumbs to mean something other than 1/5.
- **Short vs. long answer boundary** — the `display_label` seed data splits "Short Answer" from "Long Answer" at 6/8 marks. Purely cosmetic (a string), not logic — relabel freely, it doesn't affect validation.
- **App-level DB role** — for production, create a least-privilege role (`CONNECT`, `SELECT/INSERT/UPDATE/DELETE` on the tables, `EXECUTE` on the two functions) rather than having the app connect as the schema owner. Not included here since it needs a real password/secrets strategy, but it's a five-line `GRANT` block when you're ready.
- **Migration tooling** — `schema.sql` is the authoritative reference and is safe to run directly against a fresh dev database, but for a real deploy pipeline, run it through whatever migration tool you pair with Express (Knex, Prisma, node-pg-migrate) so changes are versioned.

## Suggested next step

This gives you the data layer. Natural next step is wiring it into the Express side — the upload/normalize endpoint, the Gemini call + structured-output parsing into `generation_question_selections`, and the Redis-backed ephemeral store described above. Happy to build that next whenever you're ready.
