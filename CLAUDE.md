# CLAUDE.md — Lemon Screenplay Dashboard

## Where Were We (WWW)
<!-- Single source of truth for session continuity. OVERWRITE this whole section on "save" / "wrap up" / end of session — it reflects CURRENT state, not a log. On "www" / "where were we", read this back and summarize. -->

**Last session:** 2026-08-11

**Production and delivery state:**
- [PR #6](https://github.com/brovzar-lab/Lemon-Screenplay-Dashboard/pull/6) is
  **merged**. The One Lemon release shipped: `main` reached `a79343a` and Firebase
  Hosting deployed it at 2026-08-11 14:00:56 UTC. Production serves that build
  (verified by comparing the deployed `DiscoverPage` chunk against a local build).
- Cloud Functions and the VPS daemon were **not** redeployed in that release.
- [PR #7](https://github.com/brovzar-lab/Lemon-Screenplay-Dashboard/pull/7) is
  merged; `main` is now `92a2e51`. Production deploys are gated (see below).

**Production deploys now require explicit approval:**
- `.github/workflows/deploy.yml` was split into a `verify` job (lint, build, 889
  unit tests, Playwright — automatic on every push to `main`) and a `deploy` job
  bound to the protected `production` GitHub Environment.
- Merging to `main` no longer releases. The deploy job waits for a human to
  approve it under Actions → the waiting run → Review deployments.
- The tested `dist/` is passed to the deploy job as an artifact, so Firebase
  receives exactly the build that passed verification.
- A `Protect main` ruleset is active: PR required, status checks required, force
  pushes and deletions blocked. Direct pushes to `main` are refused.
- Known ceiling: the environment's approver is `brovzar-lab`, the same identity
  the agents authenticate as. The gate stops accidental deploys, not a determined
  agent holding that token. A separate agent identity is the real fix.

**Paperclip branch contamination (resolved):**
- Two unrelated branches, `master` and `lemon-virtual-studios`, had been pushed
  into this repo by a Paperclip agent (35 commits, no common ancestor with `main`).
  They never merged, never ran Actions, and never reached production.
- Both were archived to a verified, restore-tested git bundle at
  `~/CODE/_paperclip-branch-archive/paperclip-strays-2026-08-11.bundle`, then
  deleted from GitHub. `brovzar-lab/paperclip` was never modified.
- Root cause is unfixed and is not a code issue: `brovzar-lab` is a personal
  account owning 72 repos, and the agent credentials can write to all of them.
  Scoping that token is the outstanding remediation.

**V9 reanalysis (3 screenplays, production data):**
- Matadero, Oro de Acapulco, and Hermanos Márquez Castillo were re-run through
  the current V9 engine. No verdict changed; all three held CONSIDER.
- Raw weighted scores moved +0.06 / +0.07 / 0.00. Adjusted scores moved
  +0.36 / +0.57 / 0.00 because two stale critical-failure penalties cleared.
- Hermanos cost nothing: its content hash matched an existing immutable version,
  so the engine reused it and repeated no paid work. Total new spend $6.92.
- All three now carry five sealed, publication-ready reader reports, which is
  what unlocks Private Reader Chat. Sealed reports live in the `versions`
  subcollection, not on the top-level `analysis` object.
- Regression found and corrected: the engine derived Matadero's title from its
  filename (`Matadero (5ta Version 24052026)`). The display title was restored to
  `Matadero` on the top-level doc; the sealed version keeps the engine's raw value.

**Open risks:**
- `VITE_TMDB_API_KEY` in `.env` is inlined into the client bundle at build time.
  Production is clean because CI has no such variable, but a local `npm run deploy`
  would publish that key. Route TMDB server-side like the other providers.
- The Playwright suite asserts against live production Firestore data, so editing
  one screenplay's title broke CI. Fixture-backed data would remove that coupling.
- 24 repeated chart-resize console warnings on Discovery. No visible failure.

**Next up:**
1. Scope the Paperclip agent credential to `brovzar-lab/paperclip` only.
2. Rotate the Firebase service-account key afterwards, as a precaution.
3. Decide on a separate agent identity so deploy approval is not self-approvable.

## Project
Internal screenplay-analysis dashboard for Lemon Studios. Ingests AI-generated coverage JSONs (V9 format), stores them in Firestore, and provides filtering, scoring, comparison, analytics charts, PDF export, and shareable links. Used to triage 500+ screenplays for producer review and partner sharing.

**Analysis engine**: V9 Archaeology Engine — 5 parallel readers (Structure, Character, Craft, Concept, Emotion) + a synthesis roundtable. All prior engines (V3–V8) removed. Every LLM call routes server-side through the `llmProxy` Cloud Function; API keys never touch the browser.

## Stack
- React 19 + TypeScript (strict) + Vite 7
- Tailwind CSS 4 (via `@tailwindcss/vite` plugin — no PostCSS config needed)
- Zustand 5 (client state) + TanStack React Query 5 (server state)
- React Router 7 (3 routes), Recharts 3, @react-pdf/renderer, pdfjs-dist, papaparse, @dnd-kit, TanStack React Virtual 3, html2pdf.js, jszip, date-fns
- Firebase 12 (Firestore + Storage + Google Workspace Auth restricted to @lemonfilms.com with admin/reader roles + Hosting + Cloud Functions, Node 22)
- Vitest 4 + Testing Library (unit) + Playwright (e2e)

## Commands
| Task | Command | Notes |
|------|---------|-------|
| Install | `npm install` | Functions deps auto-install on first `dev:full` |
| Dev (app only) | `npm run dev` | Vite on **port 3000** (fixed in vite.config.ts). Do NOT change — Firebase auth (authorized domain) + localStorage are tied to it |
| Dev (app + AI) | `npm run dev:full` | Runs Vite **and** the Firebase Functions emulator so `llmProxy` AI features work locally (`bash dev-full.sh`) |
| Build | `npm run build` | `tsc -b` typecheck + Vite build. `prebuild` clears `dist/assets` |
| Unit tests | `npm run test:run` | Vitest single run. Uses `TMPDIR=./.tmp` + `src/test/fix-eperm.cjs` (macOS EPERM workaround) |
| Test + coverage | `npm run test:coverage` | |
| E2E | `npm run test:e2e` | Playwright starts the dev server on the fixed port 3000 |
| E2E (visible) | `npm run test:e2e:headed` | |
| Lint | `npm run lint` | `eslint .` (flat config) |
| Format | `npm run format` | Prettier on `src/**/*.{ts,tsx,css}` |
| Check model catalog | `npm run models:check` | Compares approved Anthropic routes with the live Models API; requires `ANTHROPIC_API_KEY` |
| Validate model catalog offline | `npm run models:check:offline` | Verifies the committed catalog and route consistency without network access |
| Deploy hosting | `npm run deploy` | Build then `firebase deploy --only hosting` |
| Deploy functions | `npm run deploy:functions` | `cd functions && npm run build` then deploys functions (run from repo root) |

## Routes (src/main.tsx)
```
/                → DiscoverPage  (lazy, approved signed-in home)
/dashboard-classic → App         (preserved legacy fallback)
/discover        → DiscoverPage  (lazy, explicit presentation links supported)
/discover/:id    → DiscoverPage  (preserved drawer fallback)
/projects/:id    → ProjectWorkspacePage (lazy, full dossier)
/intake          → IntakePage    (lazy, admin-only)
/settings        → SettingsPage  (lazy)
/share/:token    → SharedViewPage (lazy)
*                → redirect to /
```

## Architecture (src/)
```
App.tsx           # Main dashboard — grid, filters, modal, analytics, DevExec chat
main.tsx          # Entry — BrowserRouter, QueryClient (30min staleTime), ErrorBoundary
index.css         # Tailwind + theme imports
pages/            # Route pages: SettingsPage, SharedViewPage
components/
  bulk/           # BulkReanalyzeModal, BulkShareModal
  charts/         # AnalyticsDashboard (+ Score/Genre/Budget/Tier charts) — lazy, Recharts-heavy
  comparison/     # ComparisonBar/Modal/Radar/SideBySide — modal lazy-loaded
  devexec/        # DevExecChat / DevExecToggle (Gemini AI chat overlay)
  export/         # ExportModal, PdfDocument, CoverageDocument, csvExport, bulkPdfExport (+ coverage/ PDF sub-pages)
  filters/        # FilterPanel, AdvancedSortPanel, CollectionTabs, MultiSelect, RangeSlider
  layout/         # Header, FilterBar, SyncStatusIndicator
  screenplay/     # ScreenplayCard/Grid/Modal (+ modal/ sub-panels)
  settings/       # ApiConfigPanel, PdfUploadPanel, CategoryManagement (+ upload/ sub-components)
  share/          # ShareModal, SharedViewLayout, ExpiredLinkPage
  badFormat/      # BadFormatModal (flags malformed coverage JSON)
  ui/             # ScoreBar, ErrorBoundary, ToastContainer, EmptyState, LoadingFallback
contexts/         # DevExecContext (AI chat state provider)
services/         # devExecService (Gemini integration)
stores/           # Zustand stores — client state (see below)
hooks/            # Custom hooks — useScreenplays, useFilteredScreenplays, useUrlState, etc.
lib/              # Core logic (see below)
types/            # screenplay.ts (single source of truth), filters.ts
styles/           # premium-theme, editorial-punk, glassmorphism, mesh-gradients, animations, typography
utils/            # audioUtils
test/             # setup.ts (mocks), factories.ts, fix-eperm.cjs
```

### lib/ (core, non-UI)
- `firebase.ts` — app init, Firestore/Storage/Google-Auth handles (sign-in restricted to verified @lemonfilms.com). **Firebase web config is hardcoded here** (apiKey/projectId literals — public web values), not from env.
- `api.ts`, `normalize.ts` (+ `normalizers/`), `calculations.ts` — data fetch, V9-JSON normalization, score math
- `analysisStore.ts` — data migration (static JSON → Firestore); reads Firestore post-migration. Lives in `lib/`, NOT `stores/`
- `multiPassAnalysis.ts` → `promptClient.v9.ts` → `proxyClient.ts` — client side of the V9 pipeline; 5 readers run via `Promise.allSettled()` then synthesis, all through the proxy
- `shareService.ts`, `pdfParser.ts`, `tmdbService.ts`, `percentileRanking.ts`, `badFormatStore.ts`, `feedbackStore.ts`

## Data Flow
```
Firestore → useScreenplays (React Query, 30min stale) + useLiveScreenplaySync (live Firestore listener)
  → useFilteredScreenplays (reads filterStore + sortStore)
    → Components
```
`useLiveScreenplaySync` (in `hooks/useScreenplays.ts`) makes daemon-written analyses appear live, no refresh.

## Cloud Functions (functions/ — separate npm package, Node 22)
- `src/llmProxy.ts` — exported. Server-side Anthropic proxy using Anthropic's official SDK; the API key lives here only. Reached at `/api/llm` in prod (firebase.json rewrite), emulator in dev. Google has a separate `googleProxy`.
- `src/onScreenplayUploaded.ts` — exported. Storage trigger; kicks the VPS daemon on new PDF upload.
- `src/budgetCounter.ts`, `src/ingestQueue.ts` — supporting logic, NOT exported from `index.ts`.
- Build: `cd functions && npm run build`. Deploy: `npm run deploy:functions` from repo root.

## Environment (.env, gitignored — see .env.example)
```
VITE_FIREBASE_STORAGE_BUCKET   # Storage bucket name
VITE_ANTHROPIC_API_KEY         # dev-only; prod uses the llmProxy Cloud Function
VITE_GOOGLE_API_KEY            # Gemini — poster generation + DevExec chat (optional, degrades gracefully)
```
VPS daemon vars (set in the systemd unit, NOT this file): `ANTHROPIC_API_KEY`, `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`, `TMDB_API_KEY`.

## Model governance

- `src/config/anthropic-model-catalog.json` is the single display catalog for approved screenplay-analysis routes and Reader Chat routes.
- The scheduled `.github/workflows/anthropic-model-catalog.yml` check compares that catalog with Anthropic's Models API monthly and on demand.
- A newly released model never changes production scoring automatically. It must first pass Lemon's sealed screenplay benchmark and receive explicit approval. This keeps model updates visible without silently changing verdict behavior.

## Conventions
- TypeScript strict — no `any`. Data types live in `types/screenplay.ts` only (`screenplay-v6.ts` deleted).
- Import via `@/` alias, not relative paths. Aliases: `@` → `src/`, `@data` → `../.tmp`.
- Zustand = client state, React Query = server state. Check the relevant store before adding local state.
- Tailwind only — no inline styles or CSS modules.
- Tests sit next to source (`filterStore.test.ts` beside `filterStore.ts`).
- PascalCase components, camelCase utilities.

## Before Changes
1. `npm run build` — does TypeScript compile?
2. `npm run test:run` — do tests pass?
3. Touching data shapes? Read `types/screenplay.ts` (single source of truth).

## Gotchas
- **Dev port is 3000, load-bearing.** Hardcoded in `vite.config.ts`. Anonymous Firebase login and localStorage data are tied to `localhost:3000` — changing the port silently loses that state. Kill a stale server before assuming a fix didn't work.
- **AI features need the emulator locally.** Plain `npm run dev` has no `llmProxy`; use `npm run dev:full` to run Vite + Functions emulator together.
- **Firebase web config is hardcoded** in `src/lib/firebase.ts` (apiKey/projectId literals — public web-app values). The `VITE_` env vars only cover the storage bucket and AI keys.
- **macOS EPERM workaround.** Test scripts set `TMPDIR=./.tmp` and preload `src/test/fix-eperm.cjs`. The Vite build uses `emptyOutDir: false` + `copyPublicDir: false` and a `skip-ds-store` plugin to avoid EPERM on `.DS_Store`.
- **E2E runs against the dev server on port 3000.** Playwright owns server startup
  on that same fixed port.
- **`analysisStore` is in `lib/`, not `stores/`**, and is not re-exported from `stores/index.ts`.
- **Store/hook barrels are partial.** `stores/index.ts` and `hooks/index.ts` only re-export a subset; many stores/hooks are imported by direct path. Add a new store's export to `stores/index.ts` if you want it in the barrel, but don't assume everything is there.
- **App Check is intentionally off** (a prior provider mismatch caused 400s — see comment in `firebase.ts`). Auth is Google Workspace: dashboard reads need a team sign-in, writes need the admin role, `/share/:token` stays public (see `firestore.rules`).

## Do Not
- Modify anything in `agent/` (read-only Antigravity/Gemini kit).
- Change the dev port from 3000.
- Use `any`, or add inline styles / CSS modules.
- Skip the TypeScript build check before committing.

## Deployment
Firebase project `lemon-screenplay-dashboard` (`.firebaserc`). Hosting via `npm run deploy` (serves `dist/`). Cloud Functions deploy separately via `npm run deploy:functions`. A VPS daemon (`daemon.py` → `execution/ingest_v9.py`) runs server-side V9 analysis and writes results to Firestore.
