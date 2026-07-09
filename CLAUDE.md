# CLAUDE.md — Lemon Screenplay Dashboard

## Where Were We (WWW)
<!-- Single source of truth for session continuity. OVERWRITE this whole section on "save" / "wrap up" / end of session — it reflects CURRENT state, not a log. On "www" / "where were we", read this back and summarize. -->

**Last session:** 2026-07-08

**Done (landed on `main` @ `a570d61`, deployed to prod):**
- Branch sync + rescue: the Instrument reskin was uncommitted and only on this Mac (same setup that lost the team tool). Committed it, pushed `instrument-reskin`, merged `main` in, merged to `main`, deployed hosting. Deleted merged branches `new-style`, `story-to-screen`, `instrument-reskin` (all folded into `main`); dropped an obsolete stash.
- Fixed light-mode bug: chart text used hardcoded `text-white` (invisible on light surfaces) in 6 spots → `text-black-50` (theme-mapped). Verified in browser, both modes.
- Fixed analytics strip stuck at 0: `useCountUp` had a one-shot `hasAnimated` latch that froze the count-up after the first run — broke under StrictMode double-mount (froze at 0), on filter changes (froze at first value), and for reduced-motion users. Rewrote to animate current→target on every target change. Added deterministic rAF tests (`src/hooks/useCountUp.test.ts`). Build clean, **536 tests pass**.
- Added `.claude/launch.json` (preview server, port 3000).

**Also this session — analysis only, NOTHING changed in code:**
- Full principal-engineer audit. Criticals, all pre-existing: (1) live Gemini + TMDB keys ship in the browser bundle, and a previously-leaked Google key is hardcoded at `apiConfigStore.ts:131` and present in the deployed bundle → needs rotation; (2) `shared_views` is publicly *listable* (`firestore.rules:147`) — anyone can enumerate every share doc + notes with no token — fix: split `allow read` into `allow get` (public) / `allow list` (auth); (3) `uploaded_analyses` `allow delete: if isAuthenticated()` (`firestore.rules:83`) = any anon visitor can hard-delete the whole slate; (4) three uncapped Anthropic-spend paths — `BulkReanalyzeModal` auto-fires on open with no budget gate (`BulkReanalyzeModal.tsx:98`), proxy forwards any model/`max_tokens` (`llmProxy.ts:212`), storage rules let anyone upload to `ingest-queue`; (5) partial reader failures zero-fill pillars → silently deflated scores; `failed_readers` is written (`multiPassAnalysis.ts:570`) but no UI reads it, and the daemon has no min-reader gate.
- Killer-features shortlist (8): **Reading Room** (full-screen `R` triage — build-this-weekend pick), **Taste Match** (AI-vs-Billy verdict scoreboard from dormant `brain_verdicts` — the moat), **Lenses** (named saved views on existing URL-state), **Field Position** (wire up the orphaned percentile system — `percentileRanking.ts`/`usePercentiles.ts`/`PercentileBadge.tsx`, S-effort free win), **Twins** (similar-script/resubmission detection), **Ask the Readers** (Q&A over stored reader reports), **War Room** (DevExec→slate strategist), **The Board** (dnd-kit pipeline stages).

**In progress:** Team tool (Google sign-in + roles) — still not rebuilt. Now the **#1 structural item**: it's the root fix for security items 2/3/4 (anonymous auth means "authenticated" = anyone on the internet). Settled design unchanged: Google sign-in restricted to **@lemonfilms.com**; roles **admin** (upload/delete/manage) + **reader** (read/note/share); `ADMIN_EMAILS = ['billy@lemonfilms.com']`; login gate wraps `/` + `/settings`, `/share/:token` stays public; `firestore.rules` `isLemon()` + `isAdmin()` with self-promotion guard on `users/{uid}`. Files to (re)create: `src/lib/firebase.ts` (anonymous→Google), `src/stores/authStore.ts`, `src/components/auth/{AuthGate,LoginScreen}.tsx`, `firestore.rules`, `src/test/setup.ts` mock. **Commit from the start.**

**Next up (priority order):**
1. Quick-win security + hygiene batch (~75 min, no console needed): split the share-link read rule (`allow get`/`allow list`), lock `uploaded_analyses` delete to `if false` + convert `quarantineAnalysis` to a soft-flag update, purge 3 zero-import dead deps (`html2pdf.js` — it drags the critical jspdf CVE, `date-fns`, `@tanstack/react-virtual`), bump react-router 7.13→≥7.15.1 (3 HIGH advisories), `npm audit fix`.
2. Rotate the bundled Google + TMDB keys (Billy in consoles), delete the hardcoded key literal at `apiConfigStore.ts:131`.
3. Rebuild the team tool (Google auth + roles).
4. Route Gemini (poster gen + DevExec Live) server-side through a `googleProxy` so keys leave the client.
5. Data layer before the backfill: make the live `onSnapshot` the single source of truth (feed React Query via `setQueryData`, kill the double full-collection read in `analysisStore.ts`); re-enable virtualization or the index-doc split.

**Open questions / blockers:**
- Key rotation needs Billy in the Google Cloud / TMDB consoles (Claude can't).
- Enabling Google auth needs the Firebase console toggle (enable Google, disable anonymous, add authorized domain).
- Detector may under-call comedy on dramedies (e.g. The Bucket List → Love/Redemption) — Taste Match would quantify this from real verdict data.
- Backfill (~1,000 scripts, ~$300) unblocked but not run — it amplifies the double-fetch cost and the 500-card DOM, so do Next-up #5 first/with it.

## Project
Internal screenplay-analysis dashboard for Lemon Studios. Ingests AI-generated coverage JSONs (V9 format), stores them in Firestore, and provides filtering, scoring, comparison, analytics charts, PDF export, and shareable links. Used to triage 500+ screenplays for producer review and partner sharing.

**Analysis engine**: V9 Archaeology Engine — 5 parallel readers (Structure, Character, Craft, Concept, Emotion) + a synthesis roundtable. All prior engines (V3–V8) removed. Every LLM call routes server-side through the `llmProxy` Cloud Function; API keys never touch the browser.

## Stack
- React 19 + TypeScript (strict) + Vite 7
- Tailwind CSS 4 (via `@tailwindcss/vite` plugin — no PostCSS config needed)
- Zustand 5 (client state) + TanStack React Query 5 (server state)
- React Router 7 (3 routes), Recharts 3, @react-pdf/renderer, pdfjs-dist, papaparse, @dnd-kit, TanStack React Virtual 3, html2pdf.js, jszip, date-fns
- Firebase 12 (Firestore + Storage + anonymous Auth + Hosting + Cloud Functions, Node 22)
- Vitest 4 + Testing Library (unit) + Playwright (e2e)

## Commands
| Task | Command | Notes |
|------|---------|-------|
| Install | `npm install` | Functions deps auto-install on first `dev:full` |
| Dev (app only) | `npm run dev` | Vite on **port 3000** (fixed in vite.config.ts). Do NOT change — anonymous Firebase login + localStorage are tied to it |
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
- `firebase.ts` — app init, Firestore/Storage/anonymous-Auth handles. **Firebase web config is hardcoded here** (apiKey/projectId literals — public web values), not from env.
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
- **App Check is intentionally off** (a prior provider mismatch caused 400s — see comment in `firebase.ts`). Auth is anonymous: reads public, writes require the auth token (see `firestore.rules`).

## Do Not
- Modify anything in `agent/` (read-only Antigravity/Gemini kit).
- Change the dev port from 3000.
- Use `any`, or add inline styles / CSS modules.
- Skip the TypeScript build check before committing.

## Deployment
Firebase project `lemon-screenplay-dashboard` (`.firebaserc`). Hosting via `npm run deploy` (serves `dist/`). Cloud Functions deploy separately via `npm run deploy:functions`. A VPS daemon (`daemon.py` → `execution/ingest_v9.py`) runs server-side V9 analysis and writes results to Firestore.
