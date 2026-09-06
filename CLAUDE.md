# CLAUDE.md — Lemon Screenplay Dashboard

## Where Were We (WWW)
<!-- Current continuity, not a log. Verify live deployment state separately. -->

**Last session:** 2026-09-06, no-spend real-transport receipt repair.

- Receipt-format repair is implemented locally in `coverage_reader.py` using
  existing adapter accounting helpers. Full transport results/failure evidence
  are checkpointed before validation. Seven new tests exercise the real adapter
  with only HTTP simulated; no new inference or production changes were made.
- The old paid draft is recovered privately as `recovered-review-draft.json`
  under `benchmark-artifacts/cosquillitas-bounded-a7bd7cd/`, explicitly Needs
  Review and not replay-eligible. Its original content and paid checkpoint are
  unchanged. Missing receipt linkage prevents safe automatic settlement/replay.
- Final repair proof: 847 Python execution tests (23 bounded-reader), 21 desktop
  ingest tests, 1,112 frontend tests, TypeScript/Vite build; independent Standards
  and Specification reviews PASS. This is local no-spend proof, not a live run.

- Current pilot outcome: BLOCK. Exact candidate `a7bd7cd` made one successful
  provider request, then the new reader rejected the real transport's nested
  accounting format. Server charge $0.356658 settled; local $1.094012
  reservation remains untouched. No second call or production change occurred.
- The complete raw draft is saved privately. Independent comparison found
  repeated existing-evidence and climax-order errors. No paid review ran and
  nothing was published Ready. See `docs/COSQUILLITAS-BOUNDED-PILOT.md` for
  exact evidence, the no-network reproduction and the next no-spend repair.
- Do not rerun the pilot, clear its reservation, or treat the prior $5 envelope
  as permission for another attempt. A future separately authorized review-only
  evaluation can use the saved draft; it must not pretend to resume the old
  locked checkpoint or repurchase the existing reading.

- Work remains on `claude/lemon-dashboard-v9-review-w3nuz0`, based on `d3ef81d`.
  See `docs/COVERAGE-BOUNDED-IMPLEMENTATION.md` for the complete implementation,
  verification results, deliberate limits and proposed next pilot.
- The new `execution/coverage_reader.py` identifies itself as
  `coverage-v1.2-bounded-1`: one reading, one independent review, at most one
  structural correction, three calls maximum. The daemon's local Coverage route
  uses it. Old V9 and the former V1.2 proof-loop code/checkpoints remain intact.
- Useful Needs Review reports are preserved and displayed. They cannot drive
  favorites or decision PDFs. Coverage remains unscored and unrankable.
  Intake/replacement receipt recovery follows authoritative queue identities.
- Local proof: 1,112 frontend tests, 840 engine tests, 21 desktop-ingest tests,
  145 Functions tests, 26 emulator-rule tests, 60 browser tests, builds and lint.
  Independent engine/intake review passed the local candidate.
- All 20 private PDFs parsed and replayed saved coverage offline with zero real
  calls/cost. This is NOT a fresh benchmark or accuracy proof. The unchanged
  $1 default rejects 15/20 before dispatch because of conservative reservations.
  Hypothetical $5 simulation permits all 20 to preserve and replay review drafts.
- No inference, deployment, worker activation, requeue or production-data write
  occurred during this implementation. Prior paid authorizations are not active.
  Do not unlock the 20-script paid benchmark or use the old canary to qualify
  the new reader. The separately approved $5/three-call pilot subsequently ran
  and stopped as described above. Its paid qualification did not pass.
- Do not claim current Hosting/Functions/VPS version alignment from these local
  tests. Reverify live revisions before any future activation or release.

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
