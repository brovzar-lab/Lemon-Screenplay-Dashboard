# Codebase Structure

**Analysis Date:** 2026-03-13

## Directory Layout

```
src/
├── App.tsx                      # Main app component (layout, routing, data flow)
├── main.tsx                     # Entry point (React DOM bootstrap, providers)
├── index.css                    # Tailwind + design system (colors, typography, spacing)
├── pages/
│   └── SettingsPage.tsx         # Upload, API config, favorites, metadata editing
├── components/
│   ├── screenplay/              # Screenplay card, grid, detail modal
│   │   ├── index.ts
│   │   ├── ScreenplayCard.tsx   # Single card (title, scores, tags, actions)
│   │   ├── ScreenplayGrid.tsx   # Grid layout + loading states
│   │   └── modal/
│   │       ├── index.ts
│   │       └── ScreenplayModal.tsx  # Detail view (full analysis, notes, delete)
│   ├── filters/                 # Filter panel, sort, collection tabs
│   │   ├── index.ts
│   │   ├── FilterPanel.tsx      # Range sliders, multi-select checkboxes
│   │   ├── SortPanel.tsx        # Sort order and primary field selection
│   │   └── CollectionTabs.tsx   # Tabs for collection filter
│   ├── charts/                  # Analytics & visualizations (recharts)
│   │   ├── index.ts
│   │   ├── AnalyticsDashboard.tsx   # Main dashboard (score dist, genres, budget, tiers)
│   │   ├── ScoreDistribution.tsx    # Histogram of weighted scores
│   │   ├── GenreChart.tsx           # Bar chart of screenplay count by genre
│   │   └── BudgetChart.tsx          # Pie chart of budget categories
│   ├── comparison/              # Side-by-side screenplay comparison
│   │   ├── index.ts
│   │   ├── ComparisonBar.tsx    # Sticky footer showing selected count
│   │   ├── ComparisonModal.tsx  # Full comparison (Radar, bars, metrics)
│   │   ├── Radar.tsx            # Recharts Radar chart for dimension comparison
│   │   └── ComparisonBar.tsx    # Horizontal bar for metric comparison
│   ├── export/                  # CSV + PDF export
│   │   ├── index.ts
│   │   ├── ExportModal.tsx      # Export format selection and download
│   │   ├── PdfDocument.tsx      # @react-pdf/renderer document template
│   │   └── csvExport.ts         # Papa.parse CSV generation
│   ├── settings/                # Upload, API config, appearance, categories
│   │   ├── index.ts
│   │   ├── UploadForm.tsx       # File upload to Firebase
│   │   ├── ApiConfigForm.tsx    # Google, Anthropic API key forms
│   │   ├── AppearanceSettings.tsx   # Theme selection
│   │   ├── CategoryManager.tsx  # Add/edit screenplay source categories
│   │   └── FavoritesManager.tsx # Manage favorite screenplays
│   ├── layout/                  # Shell layout
│   │   ├── index.ts
│   │   ├── Header.tsx           # Logo, stat pills, theme toggle, settings link
│   │   └── FilterBar.tsx        # Search, sort, export/share/delete buttons
│   ├── ui/                      # Reusable UI primitives
│   │   ├── index.ts
│   │   ├── ErrorBoundary.tsx    # React Error Boundary wrapper
│   │   ├── LoadingFallback.tsx  # Skeleton loader
│   │   ├── ScoreBar.tsx         # Visual score indicator (colored bar)
│   │   ├── RecommendationBadge.tsx # Tier badge (film_now, recommend, etc.)
│   │   └── DeleteConfirmDialog.tsx # Confirmation for screenplay deletion
│   ├── devexec/                 # AI assistant chat feature
│   │   ├── index.ts
│   │   ├── DevExecChat.tsx      # Chat UI (messages, input, API calls)
│   │   └── DevExecToggle.tsx    # Toggle button to open/close chat
│   ├── share/                   # Share screenplay collection
│   │   └── ShareButton.tsx      # Generate shareable link
│   └── notes/                   # Notes display (managed by notesStore)
│       └── NotesPanel.tsx       # Show/edit screenplay notes
├── stores/                      # Zustand state management
│   ├── index.ts                 # Barrel exports
│   ├── filterStore.ts           # Filter state (search, ranges, multi-select)
│   ├── sortStore.ts             # Sort order and primary sort field
│   ├── comparisonStore.ts       # Selected screenplays for comparison
│   ├── favoritesStore.ts        # Favorite screenplay IDs
│   ├── notesStore.ts            # User notes keyed by screenplay ID
│   ├── uploadStore.ts           # Upload progress tracking
│   ├── deleteSelectionStore.ts  # Multi-select delete mode
│   ├── exportSelectionStore.ts  # Selected screenplays for export
│   ├── themeStore.ts            # Dark/light theme preference
│   ├── pdfStatusStore.ts        # PDF availability status per screenplay
│   ├── posterStore.ts           # Background poster URL cache
│   └── apiConfigStore.ts        # Persisted API keys (Google, Anthropic)
├── hooks/                       # Custom React hooks
│   ├── index.ts
│   ├── useScreenplays.ts        # React Query hook to fetch all screenplays
│   ├── useFilteredScreenplays.ts    # Filter, sort, dedupe screenplays
│   ├── useUrlState.ts           # Sync filters to URL params on mount
│   ├── useCategories.ts         # Fetch unique screenplay categories
│   ├── useLiveDevExec.ts        # DevExec AI chat integration
│   ├── usePosterBackground.ts   # Generate random poster URLs on load
│   ├── useKeyboardShortcuts.ts  # Global keyboard shortcuts (ESC, etc.)
│   ├── useScrollReveal.tsx      # Trigger animations on scroll
│   └── index.ts                 # Barrel re-exports
├── lib/                         # Business logic & utilities
│   ├── index.ts
│   ├── api.ts                   # loadAllScreenplaysVite(), getScreenplayStats()
│   ├── analysisStore.ts         # Firestore/localStorage read/write, migration
│   ├── analysisService.ts       # Parse V6 analysis format, extract metadata
│   ├── normalize.ts             # Raw JSON → Screenplay normalization pipeline
│   ├── firebase.ts              # Firestore client initialization
│   ├── calculations.ts          # Dimension scoring, budget mapping, genre canonicalization
│   ├── dimensionDisplay.ts      # Display labels for dimension scores
│   ├── promptClient.ts          # Anthropic API client for analysis generation
│   ├── pdfParser.ts             # Extract text from PDF files
│   ├── feedbackStore.ts         # Store user feedback (not analyzed here)
│   ├── localAnalysisStore.ts    # Local storage wrapper for screenplays
│   ├── utils.ts                 # Generic utilities (toNumber, trim, etc.)
│   └── Prompt Enhancements/     # Prompt templates for AI analysis
│       └── *.txt files
├── types/                       # TypeScript interfaces
│   ├── index.ts                 # Barrel exports
│   ├── screenplay.ts            # Core Screenplay type, all dimension enums, metadata types
│   ├── screenplay-v6.ts         # V6-specific analysis format (coreQuality, lenses)
│   └── filters.ts               # FilterState, RangeFilter, sort config
├── styles/                      # CSS theme files (imported by index.css)
│   ├── editorial-punk-theme.css # Premium editorial design tokens
│   ├── glassmorphism.css        # Glass effect backgrounds
│   ├── mesh-gradients.css       # Gradient mesh backgrounds
│   ├── premium-theme.css        # Color overrides
│   ├── typography.css           # Font families and sizes
│   └── animations.css           # Keyframe animations (fade, scale, etc.)
├── contexts/                    # React Context API
│   └── DevExecContext.tsx       # Provide screenplays and API key to DevExec feature
├── services/                    # External service integrations
│   └── devExecService.ts        # DevExec AI chat implementation
├── assets/                      # Static images, icons, etc.
│   └── (empty or contains logos)
├── test/                        # Test utilities and setup
│   ├── fix-eperm.cjs            # macOS EPERM workaround
│   └── vitest.setup.ts          # Vitest config (happy-dom env)
└── utils/                       # Generic utility functions
    └── (likely empty or minimal)
```

## Directory Purposes

**`src/components/`:**
- Purpose: All React UI components organized by feature domain
- Contains: Presentational components, form components, modals, charts
- Key files: `App.tsx` (main layout), component subfolders with index.ts barrel exports
- Naming: PascalCase files (ScreenplayCard.tsx, FilterPanel.tsx)
- No business logic — uses hooks to fetch/update data

**`src/stores/`:**
- Purpose: Zustand client state management
- Contains: One store per domain (filter, sort, comparison, theme, notes, etc.)
- Each store: Create with `create()`, use `persist` middleware for localStorage
- Pattern: Flat state object + action methods; selectors use `(s) => s.fieldName`
- Usage: `const field = useFilterStore((s) => s.field)` in components/hooks

**`src/hooks/`:**
- Purpose: Custom React hooks for data fetching, business logic, state derivation
- Contains: React Query hooks, filter/sort application, URL state sync
- Exports: Named exports (no defaults); combine multiple stores into derived state
- Pattern: Reusable logic extracted from components, testable in isolation

**`src/lib/`:**
- Purpose: Business logic, data normalization, API integration, calculations
- Contains: No React code; pure functions and utilities
- Key patterns: Normalization (raw JSON → Screenplay), calculations (scoring, budgets)
- Files should be tree-shaken if unused

**`src/types/`:**
- Purpose: TypeScript interface definitions (exported to all layers)
- Contains: Screenplay type (all dimensions, metadata), filter state, enums (tiers, budgets)
- Pattern: No implementation; only interfaces and type aliases
- Naming: screenplay.ts (core), screenplay-v6.ts (V6-specific), filters.ts (filter/sort state)

**`src/styles/`:**
- Purpose: Design system CSS (colors, typography, effects)
- Contains: CSS custom properties, animations, theme overrides
- Usage: Imported by index.css via @import; Tailwind uses these via @theme tokens
- No: CSS modules, scoped styles, or inline styles (Tailwind only)

**`src/pages/`:**
- Purpose: Route-level pages (full-screen views)
- Contains: SettingsPage (only page besides App on / route)
- Pattern: Lazy-loaded via React Router `lazy()`; wrapped in Suspense

**`src/contexts/`:**
- Purpose: React Context API for cross-cutting data (not main app state)
- Contains: DevExecContext (provides screenplays + API key to chat feature)
- Pattern: Minimal use; prefer Zustand for persistent state

**`src/services/`:**
- Purpose: External service integrations (not React components)
- Contains: devExecService.ts (Anthropic API calls)
- Pattern: Pure functions or classes; no React hooks; testable independently

## Key File Locations

**Entry Points:**
- `src/main.tsx` — React-DOM bootstrap, provider setup
- `src/App.tsx` — Main app component, layout orchestration
- `src/pages/SettingsPage.tsx` — Settings route

**Configuration:**
- `vite.config.ts` — Build config, chunk splitting, path aliases, dev server proxy
- `tsconfig.app.json` — TypeScript strict mode settings
- `src/index.css` — Tailwind + design system colors

**Core Logic:**
- `src/lib/api.ts` — Screenplay loading (Firestore + static fallback)
- `src/lib/normalize.ts` — Raw V6 JSON → Screenplay type transformation
- `src/lib/analysisStore.ts` — Firestore/localStorage persistence
- `src/hooks/useFilteredScreenplays.ts` — Filter/sort application logic

**State Management:**
- `src/stores/filterStore.ts` — Filter selections (search, ranges, multi-select)
- `src/stores/sortStore.ts` — Sort order configuration
- `src/stores/comparisonStore.ts` — Screenplay comparison selections
- `src/stores/notesStore.ts` — User notes per screenplay
- `src/stores/themeStore.ts` — Dark/light theme

**Types:**
- `src/types/screenplay.ts` — Screenplay interface (7 dimension scores, metadata)
- `src/types/screenplay-v6.ts` — V6 analysis format (coreQuality, lenses, falsePosCheck)
- `src/types/filters.ts` — FilterState, RangeFilter, sort config

**Testing:**
- `src/hooks/useFilteredScreenplays.test.ts` — Filter/sort logic tests
- `src/lib/normalize.test.ts` — Normalization pipeline tests
- `src/stores/filterStore.test.ts` — Zustand store tests
- `src/hooks/useUrlState.test.ts` — URL state sync tests

## Naming Conventions

**Files:**
- Components: PascalCase (ScreenplayCard.tsx, FilterPanel.tsx)
- Utilities/Hooks/Stores: camelCase (useFilteredScreenplays.ts, filterStore.ts)
- Tests: Suffix .test.ts or .spec.ts (filterStore.test.ts)
- CSS: lowercase with hyphens (glassmorphism.css, mesh-gradients.css)

**Functions & Variables:**
- React components: PascalCase (Header, ScreenplayGrid)
- Hooks: Prefix use (useScreenplays, useFilteredScreenplays)
- Store selectors: Use arrow function syntax `(s) => s.fieldName`
- Constants: UPPER_SNAKE_CASE (SCREENPLAYS_QUERY_KEY, DEFAULT_FILTER_STATE)
- Private helpers: prefix underscore (not exported from module)

**Types & Interfaces:**
- Screenplay types: Screenplay, ScreenplayWithV6
- Raw JSON types: Raw prefix (RawScreenplayAnalysis, RawDimensionScore)
- Union types: lowercase (RecommendationTier = 'film_now' | 'recommend' | ..., BudgetCategory = 'micro' | 'low' | ...)
- Interface names: Suffix with Props (ScreenplayGridProps, FilterBarProps)

**Store Structure:**
- State interface: Same name as export (e.g., create<FilterState>())
- Store hook: useFilterStore, useSortStore (use prefix, lowercase domain)
- Actions: Verb prefix (setSearchQuery, toggleGenre, resetFilters)
- Selectors: Direct property access `(s) => s.property`

## Where to Add New Code

**New Feature (e.g., new filter type, new chart):**
1. Add type to `src/types/screenplay.ts` or `src/types/filters.ts`
2. Add component to `src/components/{feature-domain}/`
3. Add hook to `src/hooks/` if needed (e.g., useFeatureLogic)
4. Import hook in component, import component in App or relevant parent
5. Add Zustand store to `src/stores/` if feature has persistent state
6. Export from barrel file (index.ts) in feature directory
7. Test file co-located: `src/components/{feature-domain}/{Component}.test.tsx`

**New Component/Module:**
- Location: `src/components/{feature-domain}/ComponentName.tsx`
- Barrel export: Add to `src/components/{feature-domain}/index.ts`
- Props interface: Define in component file or separate `types.ts` if large
- No directory needed for single-file components; only subdirectories for feature domains

**Utilities & Helpers:**
- Reusable calculations: `src/lib/calculations.ts`
- String/number formatting: `src/lib/utils.ts`
- Data normalization: `src/lib/normalize.ts`
- API calls: `src/lib/api.ts`
- Export function with clear name: `export function myUtility() { ... }`

**New Store (persistent client state):**
1. Create `src/stores/myStore.ts`
2. Define interface for state (flat structure)
3. Define interface for actions (methods)
4. Create store: `create<State & Actions>()(persist((set) => ({ ... }), { name: 'myStore' }))`
5. Export hook: `export const useMyStore = create<State & Actions>(...)`
6. Add to barrel `src/stores/index.ts`

**New Hook (reusable logic):**
1. Create `src/hooks/useMyHook.ts`
2. Combine Zustand selectors + React Query hooks + React hooks
3. Return object with derived state: `{ data, isLoading, error }`
4. Add to barrel `src/hooks/index.ts`
5. Test file: `src/hooks/useMyHook.test.ts`

## Special Directories

**`src/lib/Prompt Enhancements/`:**
- Purpose: Stores prompt templates for AI analysis generation (Anthropic API)
- Generated: No (manually created)
- Committed: Yes
- Used by: `src/lib/promptClient.ts` when calling Anthropic

**`node_modules/.tmp/`:**
- Purpose: Temporary directory for Vite server (macOS EPERM workaround)
- Generated: Yes (created by npm scripts)
- Committed: No (in .gitignore)

**`public/data/`:**
- Purpose: Pre-loaded static V6 analysis JSON files (fallback if Firestore unavailable)
- Generated: No (manually maintained or built separately)
- Committed: Conditionally (large files may be excluded)
- Pattern: `public/data/analysis_v6/index.json` lists all filenames; individual analyses in same dir

**`src/test/`:**
- Purpose: Vitest configuration and test utilities
- Generated: No (manually maintained)
- Committed: Yes
- Contains: fix-eperm.cjs (macOS workaround), vitest setup

---

*Structure analysis: 2026-03-13*
