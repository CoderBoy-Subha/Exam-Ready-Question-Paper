# Exam-Ready — Backend

Node.js + Express API for the Exam-Ready Question Paper Generator. Implements the exact contract the frontend already assumes (`src/api/client.js` in the frontend deliverable) against the schema already tested in `schema.sql`.

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, REDIS_URL, GEMINI_API_KEY, TURNSTILE_SECRET_KEY
# load schema.sql (from the DB deliverable) into that DATABASE_URL first
npm run dev
```

Requires Postgres 13+ (schema already built/tested — see `schema.sql`) and Redis reachable at `REDIS_URL`.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/upload` | multipart: `contentSource`, `file`, `syllabusText`, `turnstileToken` → `{ sessionId }` |
| `POST` | `/api/generations` | JSON config → the paper object (create *or* regenerate, via `regenerateFrom`) |
| `GET` | `/api/generations/:id/download?format=pdf\|docx` | streams the file |
| `POST` | `/api/generations/:id/ratings` | upserts — one rating per generation |
| `POST` | `/api/cleanup` | the `sendBeacon` target |

## Architecture notes

**No payload in Postgres, same as the DB design doc promised.** `src/cache/redisClient.js` holds the actual uploaded/extracted content and generated papers, TTL-keyed by session/generation id. Postgres (`src/db/repositories.js`) only ever sees metadata — config, status, timestamps. Purging is a Redis `DEL` + a Postgres `UPDATE ... purged_at`, never a row `DELETE`, so ratings and rate-limit history survive routine session expiry (see `services/purge.service.js`).

**Turnstile gates upload, not every generation.** The spec frames the bot check as protecting Gemini spend, which argues for gating `/generations` directly — but the frontend (built in an earlier pass) already sends `turnstileToken` at upload time, not generate time. Rather than silently drift from a contract already shipped, this verifies once per session at upload, and leans on the per-IP rate limiter (`middleware/rateLimiter.js`, backed by the `generations` table) to cap repeated `/generations` calls — including regenerates — against an already-verified session. If you'd rather move the check to `/generations` directly, `requireTurnstile()` is a drop-in middleware either place.

**Marks-cap validation happens twice.** Once in JS against the request body (`computeTotalMarks`, cheap, fails fast), once via the DB's own `validate_generation_marks()` function as defense in depth. Both must agree before Gemini gets called at all — a mismatched request never reaches the API.

**Gemini responses are reconciled, not trusted blindly.** `services/gemini.service.js` sums the returned questions' marks and counts against what was requested; on a mismatch it retries once with a corrective prompt naming the exact discrepancy, and only fails the generation if that retry also misses. An LLM asked for an exact numeric spec doesn't always hit it on the first try — silently shipping a paper that doesn't match the requested mark scheme would be worse than one extra API call.

## Two research-driven decisions worth flagging

**`@google/genai`, not `@google/generative-ai`.** The package named in most training-era documentation is now deprecated (its repo is literally renamed `deprecated-generative-ai-js`). Current docs point at `@google/genai`, using `ai.models.generateContent({ model, contents, config })` rather than the older `genAI.getGenerativeModel().generateContent()` shape. There's also a newer `interactions.create()` API surface in very recent docs — this deliberately stays on `models.generateContent`, which is still fully current and is the pattern documented for structured JSON output (`responseMimeType` + `responseJsonSchema` + the `Type` enum), which is the one this app actually needs.

**The model name is genuinely volatile right now.** Sources from the same research pass showed `gemini-2.5-flash`, `gemini-3-flash-preview`, and `gemini-3.5-flash` as "current," with the most AI-agent-specific guidance pointing at `gemini-3-flash-preview`. Rather than pick one with false confidence, it's a required, prominently-flagged env var (`GEMINI_MODEL`) with that as the default — verify against [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models) before deploying.

## PDF/Word export: pdfkit + docx, not Puppeteer

The original spec suggested Puppeteer or pdf-lib for PDF. This uses **pdfkit** instead: Puppeteer downloads a full Chromium at install time, which added real friction here — the sandbox's restricted network couldn't reach the Chromium CDN at all, and that's not a sandbox-only problem, it's the same failure mode a minimal container or a locked-down CI runner would hit in production. pdfkit and `docx` are both pure-JS with no binary download step, which is also *why* both export paths could be fully tested (see below) rather than shipped on faith. If richer HTML/CSS-driven layout is wanted later, `services/paperExport.service.js` is the only file that would need to change.

## What was actually tested (41 tests, all passing)

Run with `npm test`.

- **Unit** (`tests/unit/`): marks computation/validation; real `.docx` text extraction via mammoth (built against a real docx generated in-test, not a mock); PDF/image inline-data encoding; Gemini prompt construction, the retry-on-mismatch logic, and error handling — all via an **injected fake client**, so the retry/reconciliation logic is genuinely exercised without a network call; PDF and DOCX export verified by checking real magic bytes (`%PDF-`, and the `PK` zip header for `.docx`) on the actual generated buffers; Turnstile verification logic against an injected `fetch`.
- **Integration** (`tests/integration/`): `supertest` against the real `createApp()` Express instance, hitting a real local Postgres (the same `schema.sql` from the DB deliverable) and real local Redis, with only `generatePaper` mocked. Covers the full upload → generate → download (both formats) → rate → re-rate (upsert, not duplicate) → cleanup path; the marks-mismatch and unknown-session rejections; rate-limiting (429 after the configured cap); and both purge paths — `purgeSessionNow` (the cleanup endpoint's logic) and `runScheduledPurge` (calls the DB's real `purge_expired_sessions()` function) — confirmed against directly-inserted, deliberately-backdated session rows.

**What couldn't be tested here, and why:** the actual Gemini API call (`generativelanguage.googleapis.com` isn't reachable from this sandbox's network allowlist) and the real Cloudflare Turnstile verify endpoint — both are exercised through injected fakes instead, which is why `gemini.service.js` and `verifyTurnstile.js` both take an optional client/fetch parameter rather than reaching for a module-level singleton. Also untested: literally booting `node src/server.js` as a standalone listening process — this sandbox's tool couldn't run a long-lived server process without hanging, independent of the code itself (confirmed via `pgrep` that no process was actually stuck; it was the tool's process handling, not a bug here). Everything `server.js` does (`connectRedis`, `createApp`, `startPurgeScheduler`, `app.listen`) is a thin, well-established one-liner around code that *is* fully tested — `createApp()` itself is exactly what the integration suite exercises via supertest — so the uncovered surface is small and low-risk, but it's honest to name it rather than imply a live boot was verified when it wasn't.

## Operational notes

- `TRUST_PROXY_HOPS` must match your actual reverse-proxy count or `req.ip` (used for both visitor tracking and rate limiting) will be wrong.
- `SESSION_TTL_MINUTES` drives both the Postgres `sessions.expires_at` sliding window and the Redis key TTL — they're set together in every write path so they can't drift apart.
- The purge cron (`src/jobs/purgeScheduler.job.js`) runs every `PURGE_SWEEP_INTERVAL_MINUTES`. It only needs one instance running even behind multiple app servers — consider a leader-election guard (or just running it as a separate worker) before scaling horizontally, or multiple instances will redundantly (harmlessly, but wastefully) race `SELECT ... FOR UPDATE SKIP LOCKED` against each other.
- No file bytes are ever written to disk: multer uses memory storage end to end.
