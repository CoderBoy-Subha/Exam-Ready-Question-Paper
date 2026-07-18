# AI Based MCQ Generator — Frontend

Vite + React + Redux Toolkit + React Router client.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Routes

- `/upload` — source selection, multi-file upload (up to 6 files) or pasted syllabus text
- `/configure` — question counts, marks vessel, difficulty, instructions; redirects to `/upload` if there's no active session
- `/paper/:generationId` — the generated paper; fetches fresh via `GET /api/generations/:id` whenever the URL doesn't match what's already in Redux, so refresh/deep-link/back-forward all work correctly

## Theme

Palette, fonts (Instrument Serif + DM Sans), and the glass/nebula recipe were extracted directly from a reference app's source (dark cosmic background, four radial color blooms with a slow hue-shift, three floating blurred orbs, glassmorphic panels). Values live in `src/styles/theme.css`. The signature interactions from the previous theme (ripple-click buttons, the marks-filling vessel) were kept and retinted rather than replaced — the mechanic doesn't depend on the color scheme.

## Multi-file upload

`UploadStep` accepts up to 6 files at once (any mix of PDF/DOCX/image, or pasted syllabus text, or both). Each file is tracked individually in local state with its own remove button; `api/client.js` sends them all under the repeated `files` field, matching the backend's `multer.array('files', ...)`.

## No AI vendor name anywhere in the UI

Loading and error copy is deliberately generic ("Working through your material…", "The AI engine…") — see the backend README for the matching de-branding on the API side.

## Assumed API contract

- `POST /api/upload` (multipart: `contentSource`, `files` [repeated], `syllabusText`, `turnstileToken`) → `{ sessionId, fileCount }`
- `POST /api/generations` → the paper object
- `GET /api/generations/:id` → the same paper object, for refresh/deep-link support
- `GET /api/generations/:id/download?format=pdf|docx` → file stream
- `POST /api/generations/:id/ratings` → `{ ok: true }`
- `POST /api/cleanup` — `sendBeacon` target

## Not yet wired up

Cloudflare Turnstile widget itself (the `turnstileToken` field is ready; no widget renders yet).
