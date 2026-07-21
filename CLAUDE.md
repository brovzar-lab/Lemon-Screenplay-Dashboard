# CLAUDE.md — Lemon Screenplay Dashboard

## Where Were We (WWW)
<!-- Single source of truth for session continuity. OVERWRITE this whole section on "save" / "wrap up" / end of session — it reflects CURRENT state, not a log. On "www" / "where were we", read this back and summarize. -->

**Last session:** 2026-07-21

**Done (landed on `main` @ `a9a9a87` — merged, NOT redeployed yet):**
- **Backend machinery audit (read-only):** independently confirmed all 8 Codex Sol ingestion/analysis findings and added 5 new ones — (A) Re-analyze is broken for every VPS-ingested screenplay: nothing ever uploads PDFs to `screenplays/{category}/…` and `ingest_v9.py` writes a phantom `_storagePath`; (B) `analysisService.ts:178` passes a string cast as a File, so the browser's post-analysis PDF upload silently fails always; (C) `llmProxy` has **no daily budget enforcement** — `functions/src/budgetCounter.ts` is imported by nothing, browser limits are localStorage-only; (D) budget exhaustion puts the daemon in a 10s claim/release churn loop that inflates `attempt_count`, so the next transient error permanently fails jobs; (E) UploadPanel's content-hash dedup queries `uploaded_analyses.content_hash`, a field only ever written to `ingest-queue` job docs — it never matches.
- **Legacy version cleanup (merged: 6 commits `e0a89a9..2b2b250`):** fixed the `HEAVY_FIELDS` bug (quota fallback never stripped `v9_meta`); renamed `normalizeV7.ts`→`normalizeV9.ts` (`isV7RawAnalysis`→`isArchaeologyAnalysis`, `v7PillarScores`→`pillarScores`, etc.); deleted dead `normalizeV5.ts`/`normalizeV6.ts`/`smartNormalize.ts` + 7 orphaned helpers + the v6 branch in `api.ts`; `parsed_v7`→`parsed_v9` cache dir (intentional cold start — old cache had a stale-reuse bug); stale V5/V6/V7 comments fixed. Guards: `src/lib/normalizers/legacyLabels.test.ts` + `npm run lint:legacy`. **582 tests pass (56 files), lint + build clean.**
- **Live Firestore census** (`scripts/census-analysis-versions.mjs`, read-only): prod `uploaded_analyses` = **23 docs total** — 16 `v8_archaeology`, 7 `v9_archaeology`, zero v7/v6/unlabeled. The v8 label MUST stay accepted (guard test enforces); the "500+ screenplays" figure is not in prod Firestore.

**In progress:** Codex "Pipeline Safety" plan — approved, 5 chunks, Codex implements on its own branches, one review per chunk, production deploy needs separate Billy approval:
1. **Stop data damage**: disable the dashboard Hybrid (it saves a Haiku triage stub OVER full coverage — `analysisService.ts:102`/`:281`) and the no-op "Force Re-analyze" (trigger skips same-path re-uploads; old complete job fakes a green checkmark).
2. **Script identity & revisions**: content fingerprint + immutable versions grouped per project; parse cache keyed by fingerprint+parser version; write `content_hash` into analysis docs; fix `ingest_v9.py` legacy `appspot.com` bucket default.
3. **VPS engine = sole authority**: reanalysis through the queue (also fixes finding A); archive PDFs at version locations; calibration profiles into the VPS engine; remove the dead string-cast upload.
4. **Real budget**: server-side daily ceiling in `llmProxy`; count actual calls/tokens/dollars (daemon counts 1 per screenplay but a hybrid run can be ~36 API calls; hybrid cost uses wrong default rate at `daemon.py:733`); `waiting_for_budget` state without `attempt_count` inflation.
5. **Parsing & reliability gate**: Python 3.11 pinned, OCR packages (currently commented out in `execution/requirements.txt:17`), golden tests, full-suite run.

**Next up (priority order):**
1. Codex Chunk 1 → Billy review → merge. Then Chunks 2-5 in order.
2. Deploy after chunks land: hosting + functions + **VPS pull** (Hermes still runs pre-cleanup code; delete stale `/opt/lemon-ingest/.tmp/parsed_v7/` when pulling).
3. UI/UX redesign on `codex/discovery-engine-redesign` (parked, has PRODUCT.md product definition — do NOT merge until machinery is safe). `codex/item-14-design-pass` also parked for reference.
4. Backfill (~1,000 scripts, ~$300) only AFTER Chunks 2+4 (identity + real budget), or costs/duplicates compound.

**Open questions / blockers:**
- main is ahead of the deployed site: cleanup merged but hosting/functions not redeployed this session.
- Key rotation status (Google/TMDB from the 07-08 audit) not re-verified this session — confirm before the next deploy.
- e2e suite not run this session (unit + build + lint only).
- `AGENTS.md` (untracked, Codex's guidance file) still carries the old 07-08 WWW — Codex should refresh it.

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
