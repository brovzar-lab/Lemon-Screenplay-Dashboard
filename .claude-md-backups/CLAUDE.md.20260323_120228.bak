# CLAUDE.md — Lemon Screenplay Dashboard

## Project
Screenplay analysis dashboard for Lemon Studios. Displays, filters, compares, and exports screenplay coverage data with scoring, analytics, and PDF generation.

## Stack
- React 19 + TypeScript (strict) + Vite 7
- Tailwind CSS 4 (via @tailwindcss/vite plugin)
- Zustand 5 (state) + TanStack React Query 5 (server state)
- React Router 7, Recharts 3, @react-pdf/renderer, pdfjs-dist, Papaparse, @dnd-kit
- Firebase (hosting + backend)
- Vitest + Testing Library (unit) + Playwright (e2e)

## Commands
```bash
npm run dev          # Local dev server
npm run build        # TypeScript check + Vite build
npm run test:run     # Vitest single run
npm run test:e2e     # Playwright e2e
npm run lint         # ESLint
npm run deploy       # Build + Firebase deploy
```

## Source Map
```
src/
├── App.tsx / main.tsx           # Entry + routing
├── pages/                       # Route pages (SettingsPage)
├── components/
│   ├── screenplay/              # ScreenplayCard, Grid, Modal
│   ├── filters/                 # FilterPanel, SortPanel, CollectionTabs
│   ├── charts/                  # AnalyticsDashboard, ScoreDistribution, GenreChart, BudgetChart
│   ├── comparison/              # SideBySide, Radar, ComparisonBar/Modal
│   ├── export/                  # CSV + PDF (ExportModal, PdfDocument)
│   ├── settings/                # Upload, API config, appearance, categories, favorites
│   ├── layout/                  # Header, FilterBar
│   ├── ui/                      # ScoreBar, ErrorBoundary, RecommendationBadge
│   ├── share/ notes/ sorting/
├── stores/                      # Zustand (one per domain): filter, sort, comparison, favorites, notes, upload, theme, apiConfig
├── hooks/                       # useScreenplays, useFilteredScreenplays, useCategories, useUrlState
├── lib/                         # api, analysisService, promptClient, calculations, normalize, pdfParser, utils
├── types/                       # screenplay.ts, screenplay-v6.ts, filters.ts
└── styles/                      # premium-theme, glassmorphism, mesh-gradients, animations, typography
```

## Data Flow
```
Firebase/API → useScreenplays (React Query) → useFilteredScreenplays (Zustand) → Components
```

## Conventions
- TypeScript strict — no `any`
- Barrel exports (index.ts) in every feature folder
- PascalCase components, camelCase utilities
- Tests next to source (filterStore.test.ts)
- Tailwind only — no inline styles or CSS modules
- Zustand = client state, React Query = server state
- Check BOTH types/screenplay.ts AND screenplay-v6.ts before touching data

## Before Changes
1. `npm run build` — TypeScript compiles?
2. `npm run test:run` — tests pass?
3. Check relevant Zustand store before adding local state

## Deployment
Firebase Hosting via `npm run deploy`. Config in .firebaserc.

## agent/ Directory
Read-only. Antigravity Kit (Gemini framework). Don't modify from Claude Code.
