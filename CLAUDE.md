# CLAUDE.md — Lemon Screenplay Dashboard

## Where Were We (WWW)
<!-- Single source of truth for session continuity. OVERWRITE this whole section on "save" / "wrap up" / end of session — it reflects CURRENT state, not a log. On "www" / "where were we", read this back and summarize. -->

**Last session:** 2026-09-02 (Coverage V1.2 Cosquillitas reliability gate)

**Current state:**
- Work is on `claude/lemon-dashboard-v9-review-w3nuz0`. Billy authorized the
  paid Cosquillitas fix/review loop and, once that gate passes, the same
  20-script V1.2 benchmark. No production-data write, deployment, daemon
  activation, or V1.2 promotion has occurred. V9 remains production.
- Billy's approved 20-report audit under
  `benchmark-artifacts/coverage-v1-audit-packages/` is the source of truth.
  V1.2 implements its five P0 safeguards: typed PDF/printed/citation-page/scene
  identities, complete-script existing-evidence checks, one canonical fact
  registry with propagation, a literal ordered climax/ending pass, and
  separate citation text/page/relevance verification.
- The latest no-spend implementation also gives every material count a typed
  source-instance ledger, supports nested/anaphoric counts such as "four judges;
  two are bribed," rejects cross-entity evidence reuse, and preserves collective
  counts through explicit multiplicity. Factual repair is deterministically
  forbidden from changing verdict, confidence, primary genre, lens identities
  or grades, and genre-contract judgment.
- Regression fixtures cover W.I.L.L., El Arbol Negro, Terapia, La Ciguena,
  Sola, Diablo, and every reproduced Cosquillitas failure. Proof is 131 focused
  engine tests plus 8 no-spend canary tests, 562 total Python execution tests,
  1,085 frontend tests across 146 files, and the TypeScript/Vite production
  build. The adversarial reviewer and independent consolidation judge both
  return PASS with no P0/P1 blocker.
- The most recent paid Cosquillitas artifact, from commit `a261220`, remains a
  deliberate `needs_review` result and is not the release candidate. It cost
  $0.787478 across three settled calls. It proved the typed audit shape but
  still missed existing Richie setup, failed to propagate literal climax order,
  falsely certified one citation's relevance, and received a malformed count
  ledger. Those exact defects now have deterministic guards and regressions.
- Cumulative V1.2 charged spend is $4.570866, leaving $15.429134 under the
  temporary $20 operation cap. No V1.2 report is sealed and the other 19 have
  not run. The next gate is a fresh paid Cosquillitas rerun, followed by a new
  full-screenplay judge comparison. Do not open the other 19 until it passes.
- The qualitative contract is unchanged: no screenplay scores, no rankability,
  frontend `scoreSource` remains `coverage_unscored`, irrelevant lenses remain
  `not_applicable`, multi-stage climaxes are preserved, and human taste stays
  separate from factual correction.

**Open risks (carried over, not reverified this session):**
- `VITE_TMDB_API_KEY` may be inlined into local builds. Never run
  `npm run deploy` from a laptop; CI is the clean path.
- Playwright asserts against live production Firestore data.
- Paperclip agent credential remains broadly scoped; Firebase service-account
  rotation and a separate deploy-approver identity are pending.

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
