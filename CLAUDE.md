# CLAUDE.md — Lemon Screenplay Dashboard

## Where Were We (WWW)
<!-- Single source of truth for session continuity. OVERWRITE this whole section on "save" / "wrap up" / end of session — it reflects CURRENT state, not a log. On "www" / "where were we", read this back and summarize. -->

**Last session:** 2026-07-22

**Done (Discovery reconnection R0-R6):**
- The approved Compact Shelf design is permanently rescued at `docs/design/compact-shelf-final.html`; the product definition is in `PRODUCT.md`; every deferred decision is recorded in `docs/DISCOVERY-BACKLOG.md`.
- **R0 Foundation:** added the authenticated, side-by-side `/discover` route without changing `/`; connected it to the existing `useScreenplays` + live-sync data spine with no mock production data.
- **R1 Find:** added the featured screenplay, ranked shelf, responsive archive grid, shared search/filter/sort stores, honest counts, loading, and empty states.
- **R2 Real analysis:** cards open a deep detail drawer using the existing score, content, and notes panels; Escape, focus return, and note persistence retain the proven modal behavior.
- **R2.5 App shell:** added the Lemon header, real slate statistics, existing account/theme/sync controls, and deep links at `/discover/:projectId` with browser back/forward support.
- **R3 Sharing:** connected the existing share-link create/reuse/copy/revoke machinery and public `/share/:token` flow; `/` focuses Discovery search.
- **R4 Bulk actions:** connected the existing selection store, bulk share modal, and favorites modal across the featured, shelf, and grid surfaces.
- **R5 PDFs:** connected the existing formal coverage generator and pitch-deck PDF exporter for one script or a multi-script selection. R5 is merged into `main` at `2fd3561` but is not deployed.
- **R6 Finish line (current branch `codex/discovery-reconnect-r6`):** connected the existing shared Lens store/menu so saved views work in both dashboards; added Discovery access to Quick Favorites and named favorite lists; completed the Compact Shelf restyle for the drawer, share/export/bulk surfaces, selection bar, loading/empty states, light/dark themes, and desktop/tablet/phone layouts. No backend, rules, service, or store behavior changed.

**Production state:**
- Hosting currently serves commit `62c47dd` (through R4). Both `/` and `/discover` return HTTP 200; the old dashboard remains the default at `/` and Discovery remains behind team sign-in.
- R5 and R6 have **not** been deployed. The closing deployment must be a separately approved hosting-only deploy after Atlas verification and Billy's final visual pass.

**In progress:**
- R6 is complete on `codex/discovery-reconnect-r6` and awaiting independent Atlas verification, then Billy's final signed-in visual approval.

**Next up:**
1. Atlas code-read + full-suite rerun + signed-in browser verification of `/discover`.
2. Billy final visual pass in both themes and at phone/desktop sizes.
3. After explicit approval, merge R6 into `main` and run the closing hosting-only deploy. Do not deploy functions, rules, or VPS changes.

**Backlog pointer:**
- All postponed or skipped Discovery work is tracked in `docs/DISCOVERY-BACKLOG.md`. Treat that file as the scope source for any post-reconnection phase; do not infer new work from the prototype HTML.

**Open notes:**
- `docs/design/compact-shelf-final.html` remains the approved visual reference; `dist/` prototype HTML is reference-only and must never ship as the app.
- Existing untracked screenshots and `AGENTS.md` were intentionally left untouched throughout R0-R6.

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
| E2E | `npm run test:e2e` | Playwright; runs against `npm run preview` (port 4173), not the dev server |
| E2E (visible) | `npm run test:e2e:headed` | |
| Lint | `npm run lint` | `eslint .` (flat config) |
| Format | `npm run format` | Prettier on `src/**/*.{ts,tsx,css}` |
| Deploy hosting | `npm run deploy` | Build then `firebase deploy --only hosting` |
| Deploy functions | `npm run deploy:functions` | `cd functions && npm run build` then deploys functions (run from repo root) |

## Routes (src/main.tsx)
```
/                → App           (main dashboard)
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
- `src/llmProxy.ts` — exported. Server-side LLM proxy (Anthropic/Google); the API key lives here only. Reached at `/api/llm` in prod (firebase.json rewrite), emulator in dev.
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
- **E2E runs against `preview` (4173)**, not the dev server.
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
