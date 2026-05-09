# Lemon Screenplay Dashboard

Internal screenplay analysis dashboard for Lemon Studios. Ingests AI-generated screenplay coverage, stores results in Firestore, and provides filtering, scoring, comparison, analytics charts, PDF export, and shareable partner links. Used to triage 500+ screenplays for producer review.

## Stack

- React 19, TypeScript (strict), Vite 7
- Tailwind CSS 4, Zustand 5, TanStack React Query 5, React Router 7
- Firebase 12 — Firestore, Storage, Auth, Hosting
- Cloud Functions — Node 22 (Anthropic-powered analysis endpoint)
- Recharts 3, @react-pdf/renderer
- Vitest 4 (unit), Playwright (e2e)

## Routes

| Path | Description |
|---|---|
| `/` | Main dashboard |
| `/settings` | API config, upload, appearance, categories |
| `/share/:token` | Partner share link (read-only view) |

## Commands

```bash
npm run dev              # Dev server (port 3000)
npm run build            # TypeScript check + Vite build
npm run test:run         # Vitest unit tests
npm run test:e2e         # Playwright e2e (requires preview server on port 4173)
npm run deploy           # Build + Firebase Hosting deploy
npm run deploy:functions # Deploy Cloud Functions separately
```

## Environment Variables

Set in `.env` (gitignored):

```
VITE_FIREBASE_STORAGE_BUCKET   # Firebase Storage bucket name
VITE_ANTHROPIC_API_KEY         # Anthropic API key (dev proxy only)
VITE_GOOGLE_API_KEY            # Google API key for Gemini (posters + DevExec AI chat)
```

Firebase config is hardcoded in `src/lib/firebase.ts`, not derived from env vars.

## Analysis Pipeline

PDFs are uploaded via the dashboard, parsed client-side, then sent to the `analyzeScreenplay` Cloud Function which calls Anthropic Claude. Results are stored in Firestore with a localStorage cache for fast subsequent reads.

Two analysis formats:

- **V6** — Single-pass coverage with scores, genre, budget tier, logline, and element-by-element notes
- **V7 "Screenplay Archaeology Engine"** — Five parallel specialist readers (structure, character, theme, marketability, dialogue) plus a synthesis pass; produces richer coverage with confidence intervals and cross-reader consensus scoring

## Deployment

Firebase project: `lemon-screenplay-dashboard`

```bash
npm run deploy           # Hosting only
npm run deploy:functions # Cloud Functions only (run from /functions)
```
