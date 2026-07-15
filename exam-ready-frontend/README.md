# Exam-Ready — Frontend

Vite + React + Redux Toolkit client for the Exam-Ready Question Paper Generator, in the "Water on Glass" theme.

## Setup

```bash
npm install
cp .env.example .env   # fill in VITE_API_BASE_URL and VITE_TURNSTILE_SITE_KEY
npm run dev
```

## Structure

- `src/store/` — Redux Toolkit slices: `config` (question counts, target marks, difficulty, instructions), `upload` (source type, session, file metadata), `generation` (status/result), `rating`.
- `src/api/client.js` — the assumed backend contract (see below). This is the one place request shapes live, so it's the only file you should need to touch if your actual Express routes differ.
- `src/components/` — one component per UI concern. `MarksVessel` and `RippleButton` are the signature pieces carrying the water/glass motif — see "Design notes" below.
- `src/styles/theme.css` — the palette, type scale, and base tokens. `animations.css` holds the shared keyframes and the site-wide `prefers-reduced-motion` fallback. `components.css` holds shared styles for the three components too small to need their own CSS module (`StepIndicator`, `DifficultySelector`, `ConsentNotice`).

## Assumed API contract

This was built ahead of the Express backend, so `src/api/client.js` assumes:

- `POST /api/upload` (multipart: `contentSource`, `file`, `syllabusText`, `turnstileToken`) → `{ sessionId }`
- `POST /api/generations` (JSON: `sessionId`, `targetTotalMarks`, `difficulty`, `customInstructions`, `questionCounts`, `regenerateFrom`, `makeItDifferent`) → the paper object (`generationId`, `totalMarks`, `questionCount`, `difficulty`, `sections: [{ title, questions: [{ id, prompt }] }]`)
- `GET /api/generations/:id/download?format=pdf|docx` → file stream
- `POST /api/generations/:id/ratings` (JSON: `score`, `comment`, `email`) → `{ ok: true }`
- `POST /api/cleanup` — the `sendBeacon` target, JSON body `{ sessionId }`

If your actual routes differ, `client.js` is the only file that needs to change — every component calls through it rather than using `fetch` directly.

## Design notes

- **No file bytes ever touch Redux.** `UploadStep` keeps the real `File` object in local component state; only serializable metadata (`name`, `size`, `type`) goes into the store. This matches the backend's "session-scoped, never permanent" rule for the frontend's own state too.
- **One source of truth for the marks total.** `selectComputedTotal` in `configSlice.js` is used by both `MarksVessel` (the display) and the generate-button gate in `ConfigStep`, so they can never disagree about whether the config is valid.
- **`MarksVessel` is deliberately not a generic progress bar.** The brief's core validation rule — counts × marks must sum to exactly the target — is water finding its level: it fills, has a meniscus, bubbles when you add a question, settles with a ripple on an exact match, and tints warm if you overshoot. It's the same motif as the ripple button, doing double duty as the functional total-marks indicator the spec requires.
- **`RippleButton`'s ripple is click-position-anchored**, not a generic centered pulse — it reads as a drop hitting the exact point of contact, per the brief's "ripple effect on click… like a water drop hitting glass."
- **`useSessionCleanup`** fires the `sendBeacon` cleanup call on tab hide / page hide, matching the backend's inactivity-timeout backstop from the data-retention spec.
- **Every animation respects `prefers-reduced-motion`** — see the global rule at the bottom of `animations.css`, plus the per-component `@media (prefers-reduced-motion: no-preference)` guards that wrap each `animation` declaration.

## Not yet wired up

- Cloudflare Turnstile itself isn't embedded (the client just has a `turnstileToken` field ready to send once you drop the widget into `UploadStep`).
- The `sections`/`questions` shape in `PaperResult` is a guess at Gemini's structured output — adjust once the exact contract (flagged in the original spec as still-undecided) is locked in.
