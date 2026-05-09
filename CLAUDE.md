# CLAUDE.md — Lemon Screenplay Dashboard

## Project
Internal screenplay analysis dashboard for Lemon Studios. Ingests AI-generated screenplay coverage JSONs (V7 format), stores them in Firestore, and provides filtering, scoring, comparison, analytics charts, PDF export, and shareable links. Used to triage 500+ screenplays for producer review and partner sharing.

**Analysis engine**: V7 Archaeology Engine only — 5 parallel readers (Structure, Character, Craft, Concept, Emotion) + synthesis roundtable. V6 has been removed. All LLM calls route server-side through the `llmProxy` Cloud Function; API keys never touch the browser.

## Stack
- React 19 + TypeScript (strict) + Vite 7
- Tailwind CSS 4 (via @tailwindcss/vite plugin)
- Zustand 5 (client state) + TanStack React Query 5 (server state)
- React Router 7 (3 routes), Recharts 3, @react-pdf/renderer, pdfjs-dist, Papaparse, @dnd-kit
- TanStack React Virtual 3 (virtual scrolling)
- Firebase 12 (Firestore + Storage + Auth + Hosting + Cloud Functions)
- Vitest 4 + Testing Library (unit) + Playwright (e2e)
- clsx, date-fns, html2pdf.js

## Routes
```
/                  → App (main dashboard)
/settings          → SettingsPage (lazy)
/share/:token      → SharedViewPage (lazy)
```

## Commands
```bash
npm run dev              # Dev server on port 3000
npm run build            # TypeScript check + Vite build (prebuild clears dist/assets)
npm run test:run         # Vitest single run (uses TMPDIR=.tmp for macOS EPERM fix)
npm run test:e2e         # Playwright e2e (runs preview server on port 4173)
npm run test:e2e:headed  # Playwright e2e with browser visible
npm run lint             # ESLint
npm run format           # Prettier
npm run deploy           # Build + Firebase deploy (hosting only)
npm run preview          # Vite preview server (port 4173)
```

## Environment Variables
```
VITE_FIREBASE_STORAGE_BUCKET  — Firebase Storage bucket name
VITE_ANTHROPIC_API_KEY        — Anthropic API key for screenplay analysis
VITE_GOOGLE_API_KEY           — Google API key for Gemini (posters + DevExec AI chat)
```
Set in `.env` (gitignored). No `.env.example` currently exists.

## Source Map
```
src/
├── App.tsx                     # Main dashboard component
├── main.tsx                    # Entry point — React Router, QueryClient, ErrorBoundary
├── index.css                   # Root stylesheet (Tailwind + theme imports)
├── pages/                      # Route pages: SettingsPage, SharedViewPage
├── components/
│   ├── bulk/                   # BulkReanalyzeModal, BulkShareModal
│   ├── charts/                 # AnalyticsDashboard, ScoreDistribution, GenreChart, BudgetChart, TierBreakdown
│   ├── comparison/             # ComparisonBar, ComparisonModal, ComparisonRadar, ComparisonSideBySide
│   ├── devexec/                # DevExecChat, DevExecToggle (AI chat overlay)
│   ├── export/                 # ExportModal, PdfDocument, CoverageDocument, csvExport
│   │   └── coverage/           # PDF sub-pages: CoverPage, ScoresPage, AnalysisPage, AppendixPage
│   ├── filters/                # FilterPanel, AdvancedSortPanel, CollectionTabs, CategoryFilter, MultiSelect, RangeSlider
│   ├── layout/                 # Header, FilterBar, SyncStatusIndicator
│   ├── screenplay/             # ScreenplayCard, ScreenplayGrid, ScreenplayModal
│   │   └── modal/              # Modal sub-components: ScoresPanel, ContentDetails, NotesSection, etc.
│   ├── settings/               # ApiConfigPanel, AppearanceSettings, PdfUploadPanel, CategoryManagement, etc.
│   │   └── upload/             # Upload sub-components: UploadDropzone, UploadQueue, ModelSelector, etc.
│   ├── share/                  # ShareModal, SharedViewLayout, ExpiredLinkPage
│   └── ui/                     # ScoreBar, ErrorBoundary, ToastContainer, EmptyState, LoadingFallback, etc.
├── contexts/                   # DevExecContext (AI chat state)
├── services/                   # devExecService (Gemini AI integration)
├── stores/                     # 16 Zustand stores (see Stores section)
├── hooks/                      # 11 custom hooks (see Hooks section)
├── lib/                        # Core logic: api, firebase, analysisStore, normalize, calculations, shareService, etc.
├── types/                      # screenplay.ts, filters.ts
├── styles/                     # premium-theme, editorial-punk-theme, glassmorphism, mesh-gradients, animations, typography
├── test/                       # setup.ts (mocks), factories.ts (test data), fix-eperm.cjs (macOS fix)
├── utils/                      # audioUtils
└── assets/                     # Static assets
```

## Key Files Outside src/
```
functions/                      # Firebase Cloud Functions (Node 22)
├── src/llmProxy.ts             # LLM proxy — routes all browser AI calls server-side (API key stays here)
├── src/analyzeScreenplay.ts    # DEPRECATED stub — returns error. V6 removed.
├── src/prompts.ts              # Prompt type stubs only (V6 prompts removed)
├── src/index.ts                # Function exports
e2e/                            # Playwright specs: dashboard, filters, modal, settings
agent/                          # READ-ONLY. Antigravity Kit (Gemini framework). Do not modify.
firestore.rules                 # Security rules (public reads, auth-gated writes)
storage.rules                   # Firebase Storage rules
```

## Stores (16 Zustand stores)
filterStore, sortStore, comparisonStore, favoritesStore, notesStore, uploadStore, themeStore, apiConfigStore, exportSelectionStore, deleteSelectionStore, syncStatusStore, toastStore, shareStore, pdfStatusStore, posterStore + `lib/analysisStore` (not in stores/)

## Hooks (11 custom hooks)
useScreenplays, useFilteredScreenplays, useCategories, useUrlState, useKeyboardShortcuts, useCountUp, useLiveDevExec, usePdfScan, usePosterBackground, useShortcutHint, useSyncRetry

## Data Flow
```
Firestore/localStorage → useScreenplays (React Query, 30min stale)
  → useFilteredScreenplays (reads filterStore + sortStore)
    → Components
```
Data migration: static JSON files → Firestore (handled by `lib/analysisStore.ts`). Post-migration reads from Firestore exclusively.

## Architecture Notes
- **Path aliases**: `@` → `src/`, `@data` → `../.tmp`
- **Lazy loading**: AnalyticsDashboard and ComparisonModal are lazy-loaded (Recharts is heavy). SettingsPage and SharedViewPage are lazy route components.
- **Chunk splitting**: Separate vendor chunks for react, recharts, react-pdf, zustand+react-query, firebase, pdfjs
- **LLM proxy**: All AI calls go through `llmProxy` Cloud Function (`/api/llm` in prod, emulator in dev). `proxyClient.ts` is the browser-side client. API keys never touch the browser.
- **V7 pipeline**: `multiPassAnalysis.ts` → `promptClient.v7.ts` → proxy. Five readers run in parallel via `Promise.allSettled()`, then a synthesis pass.
- **Auth**: Anonymous Firebase auth. Reads are public, writes require auth token.
- **DevExec**: AI chat overlay powered by Google Gemini, wrapped in DevExecContext/Provider

## Conventions
- TypeScript strict — no `any`
- Barrel exports (index.ts) in every feature folder
- PascalCase components, camelCase utilities
- Tests next to source (`filterStore.test.ts` beside `filterStore.ts`)
- Tailwind only — no inline styles or CSS modules
- Zustand = client state, React Query = server state
- Use `@/` path alias for all imports (not relative)
- Data types live in `types/screenplay.ts` only (`screenplay-v6.ts` deleted)

## Before Changes
1. `npm run build` — TypeScript compiles?
2. `npm run test:run` — tests pass?
3. Check relevant Zustand store before adding local state
4. If touching data types, read `types/screenplay.ts` (single source of truth — v6 removed)

## Gotchas
- **macOS EPERM**: Test commands use `TMPDIR=./.tmp` and `fix-eperm.cjs` to work around macOS file permission issues. The Vite build uses `emptyOutDir: false` and a custom plugin to skip `.DS_Store` files.
- **Dev server port**: Always use port 3000 (hardcoded in vite.config.ts). Changing it breaks localStorage data.
- **E2E tests**: Run against `npm run preview` (port 4173), not the dev server.
- **Firebase config**: Hardcoded in `src/lib/firebase.ts` (not env vars). The VITE_ env vars are for API keys and storage bucket only.
- **analysisStore location**: Lives in `lib/`, not `stores/`. Not re-exported from `stores/index.ts`.

## Do Not
- Modify anything in `agent/` directory
- Add inline styles or CSS modules — Tailwind only
- Use `any` type
- Create new stores without barrel exporting from `stores/index.ts`
- Change the dev server port from 3000
- Skip the TypeScript build check before committing

## Deployment
Firebase Hosting via `npm run deploy` (builds then deploys hosting only). Cloud Functions deployed separately via `cd functions && npm run deploy`. Config in `.firebaserc` (project: `lemon-screenplay-dashboard`).
