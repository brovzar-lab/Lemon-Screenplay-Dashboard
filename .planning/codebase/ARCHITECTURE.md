# Architecture

**Analysis Date:** 2026-03-13

## Pattern Overview

**Overall:** Layered React frontend with strict data flow separation — React Query for server state, Zustand for client state, type-safe normalization pipeline, and lazy-loaded feature modules.

**Key Characteristics:**
- Server state (screenplays, analytics) managed by React Query with 30-min cache
- Client state (filters, sort, comparison, theme) managed by Zustand with localStorage persistence
- Data flows unidirectionally: Firebase/API → React Query → hooks → Zustand selectors → Components
- Heavy features (charts, PDF export) are lazily-loaded code-split bundles
- Strict TypeScript (no `any`, unused params flagged) with path alias imports
- Presentation strictly separated from business logic via custom hooks

## Layers

**Presentation Layer (Components):**
- Purpose: Render UI, dispatch user actions, display data
- Location: `src/components/`
- Contains: Feature-specific components (screenplay, filters, charts, export, etc), layout shell, UI primitives
- Depends on: Custom hooks (`useFilteredScreenplays`, `useScreenplays`, etc), Zustand stores for UI state
- Used by: Main `App.tsx` and routing layer

**Data Fetching & Caching Layer (React Query):**
- Purpose: Manage server state, invalidation, caching, refetch logic
- Location: `src/hooks/useScreenplays.ts`
- Contains: `useScreenplays()` (fetches all), `useScreenplayStats()`, `useDeleteScreenplays()` mutation
- Depends on: `src/lib/api.ts` (loadAllScreenplaysVite), Firebase/localStorage via `analysisStore`
- Used by: Custom hooks like `useFilteredScreenplays` that build on this foundation

**Client State Layer (Zustand Stores):**
- Purpose: Persist and manage local UI state (filters, sort, comparison, theme, favorites)
- Location: `src/stores/`
- Contains: 14 domain-specific stores (filterStore, sortStore, comparisonStore, themeStore, notesStore, uploadStore, etc)
- Depends on: localStorage middleware for persistence
- Used by: Components and custom hooks for reading/updating filter state, sort preferences, etc

**Business Logic & Filtering Layer (Custom Hooks):**
- Purpose: Apply filters, sort, deduplicate, compute derived state
- Location: `src/hooks/useFilteredScreenplays.ts`, `src/hooks/useUrlState.ts`
- Contains: Filter matching logic, sort application, URL state sync
- Depends on: Zustand stores (filter, sort, comparison), React Query hooks
- Used by: Main App and components needing filtered/sorted screenplay lists

**Data Normalization Layer:**
- Purpose: Transform raw V6 JSON analysis into normalized Screenplay objects
- Location: `src/lib/normalize.ts`
- Contains: `normalizeV6Screenplay()`, budget/tier/genre mapping, deduplication by title
- Depends on: Type definitions (screenplay.ts, screenplay-v6.ts), calculation utilities
- Used by: `loadAllScreenplaysVite()` in api.ts before storing in React Query cache

**Data Access & Migration Layer:**
- Purpose: Load screenplays from multiple sources (static JSON, Firebase, localStorage), handle migration
- Location: `src/lib/api.ts`, `src/lib/analysisStore.ts`
- Contains: `loadAllScreenplaysVite()`, Firestore integration, migration triggers, file cleanup
- Depends on: `src/lib/firebase.ts` (Firestore client), localStorage API
- Used by: React Query queryFn in `useScreenplays()`

**Service & Integration Layer:**
- Purpose: Handle specialized operations (DevExec AI chat, analysis, PDF operations)
- Location: `src/services/devExecService.ts`, `src/lib/promptClient.ts`, `src/lib/analysisService.ts`
- Contains: AI chat integration, PDF parsing, prompt generation
- Depends on: External APIs (Anthropic), Firebase, file I/O utilities
- Used by: DevExecContext and components for specialized features

**Type & Utility Layer:**
- Purpose: Type definitions, calculations, helper functions
- Location: `src/types/` (screenplay.ts, screenplay-v6.ts, filters.ts), `src/lib/calculations.ts`, `src/lib/utils.ts`
- Contains: All TypeScript interfaces, dimension scoring logic, genre canonicalization, number conversions
- Depends on: Nothing (foundational)
- Used by: All layers for type safety and reusable calculations

## Data Flow

**Screenplay Load Flow:**

1. App mounts → `useScreenplays()` hook called → React Query fetches via `loadAllScreenplaysVite()`
2. `loadAllScreenplaysVite()` checks: static JSON index → migrate if needed → load from Firestore/localStorage
3. Raw V6 JSON arrays normalized via `normalizeV6Screenplay()` → typed Screenplay objects
4. Deduplicated by title (later entries win) → stored in React Query cache (30-min stale time)
5. Components read via `useScreenplays()` or `useFilteredScreenplays()` hook

**Filter & Sort Flow:**

1. User interacts with FilterBar/SortPanel → dispatches Zustand store action
2. `useFilterStore.setSearchQuery()` or similar updates client state
3. `useFilteredScreenplays()` hook subscribes to filter + sort stores + React Query screenplays
4. Inside hook: screenplays passed through `passesFilters()` → sorted via `applySorting()` → deduped → returned
5. Components re-render with new filtered/sorted list

**URL State Sync Flow:**

1. On mount, `useUrlState()` reads URL params (filters, sort, page)
2. Applies stored filters to Zustand stores via `applyFilters()`
3. URL changes → `useUrlState()` updates stores
4. Store changes → components update → URL reflects new state (optional via URL params)

**Chart Click → Cross-Filter Flow:**

1. User clicks chart (e.g., score range bar) → `onFilterByScoreRange()` handler fired
2. Handler resets all filters, then calls `setWeightedScoreRange()` to apply single filter
3. Zustand updates → `useFilteredScreenplays()` recomputes → grid refreshes

**Export Flow:**

1. User selects screenplays → stored in `exportSelectionStore`
2. CSV export: format and download via `Papa.parse()` and blob download
3. PDF export: lazy-loaded `PdfDocument` component renders → `@react-pdf/renderer` generates → download

**Comparison Flow:**

1. User clicks compare icon on cards → `useComparisonStore.addScreenplay(id)`
2. Sticky `ComparisonBar` reads store, shows selected count
3. User opens comparison → lazy-loaded `ComparisonModal` fetches selected screenplays from React Query cache
4. Modal renders side-by-side view with overlay charts (Radar, Bar comparisons)

## State Management Pattern

**Server State (React Query):**
```typescript
// All screenplay data — cached 30min, invalidated on delete
const { data: screenplays, isLoading } = useScreenplays()

// Mutations
const { mutate: deleteScreenplays } = useDeleteScreenplays()
  → calls removeAnalysis() → invalidates screenplays query
```

**Client State (Zustand):**
```typescript
// Persisted to localStorage
const query = useFilterStore((s) => s.searchQuery)
const updateQuery = useFilterStore((s) => s.setSearchQuery)

// No persistence (UI-only)
const [selectedScreenplay, setSelectedScreenplay] = useState<Screenplay | null>(null)
const [isModalOpen, setIsModalOpen] = useState(false)
```

**Separation of Concerns:**
- React Query = "what data is loaded?"
- Zustand = "what are user's filter choices?"
- useState = "what UI is open/active right now?"

## Key Abstractions

**Screenplay (Normalized Type):**
- Purpose: Single source of truth for screenplay data
- Files: `src/types/screenplay.ts`, `src/types/screenplay-v6.ts`
- Pattern: Immutable object with all dimensions, scores, metadata pre-computed at normalize time
- Normalized fields include: title, author, genre (+ subgenres), themes, recommendation tier, weighted score, CVS, TMDB status, notes, tags, etc.

**FilterState (Zustand Store):**
- Purpose: Represent user's current filter selections
- Files: `src/stores/filterStore.ts`, `src/types/filters.ts`
- Pattern: Flat state object with setter actions for each filter dimension (toggles and range updates)
- Persisted to localStorage with Zustand middleware

**RangeFilter:**
- Purpose: Represent a slider range with min/max/enabled flag
- Used for: All numeric dimension filters (weighted score, CVS, individual dimension scores, etc.)
- Pattern: Always checked with `filter.enabled === true` before applying to passesFilters()

**ScreenplayWithV6:**
- Purpose: Type alias combining base Screenplay + V6-specific fields (coreQuality, lenses, falsePosCheck)
- Pattern: Used throughout to ensure V6 data is available when needed (e.g., in AI analysis, detailed modal)

**Recommendation Tier (Union Type):**
- Purpose: Enum-like union type for recommendation verdict
- Values: `'film_now' | 'recommend' | 'consider' | 'pass'`
- Normalized from raw analysis via `mapV6VerdictToTier()`

## Entry Points

**Main App (`src/App.tsx`):**
- Location: Main React component
- Triggers: Browser navigation to `/` route
- Responsibilities:
  - Fetch all screenplays via `useScreenplays()`
  - Compute filtered list via `useFilteredScreenplays()`
  - Sync URL state via `useUrlState()`
  - Render layout (Header, FilterBar, AnalyticsDashboard, ScreenplayGrid)
  - Manage modal state (ScreenplayModal, ComparisonModal)
  - Dispatch chart click handlers to update filters

**Entry Point (`src/main.tsx`):**
- Location: React-DOM bootstrap
- Triggers: Page load
- Responsibilities:
  - Create React Query client (30-min stale time, 1-hour cache)
  - Wrap App with providers (ErrorBoundary, QueryClientProvider, BrowserRouter)
  - Mount to DOM

**SettingsPage (`src/pages/SettingsPage.tsx`):**
- Location: Route `/settings`
- Triggers: User clicks settings icon or navigates to `/settings`
- Responsibilities:
  - Upload new screenplays (Firebase storage, normalization)
  - Configure API keys (Google, Anthropic)
  - Manage favorites and notes
  - Edit screenplay metadata (category, tags)

**DevExecContext (`src/contexts/DevExecContext.tsx`):**
- Location: Context provider wrapping App
- Triggers: App mount
- Responsibilities:
  - Provide screenplays list to DevExec AI chat feature
  - Manage chat messages and API key
  - Handle Anthropic API calls for analysis/recommendations

## Error Handling

**Strategy:** Error Boundary wraps critical sections; logs to console; shows user-friendly fallback UI.

**Patterns:**

1. **React Error Boundary (`src/components/ui/ErrorBoundary.tsx`):**
   - Class component catches render errors and component lifecycle errors
   - Shows error message + component stack in debug details
   - Provides "Try Again" button to reset boundary state
   - Wraps: Main App, AnalyticsDashboard, ComparisonBar, ComparisonModal

2. **Async Error Handling (fetch/mutations):**
   - `loadAllScreenplaysVite()` tries multiple sources, logs failures, continues gracefully
   - Failed screenplay normalizations remove corrupted entry and log warning
   - `useDeleteScreenplays()` mutation handles errors via React Query onError
   - Firestore errors logged but don't block UI

3. **Validation Errors:**
   - `isV6RawAnalysis()` type guard filters out non-V6 uploads
   - Dimension scores validated during normalization (invalid → default value)
   - Filter ranges clamped to valid min/max bounds

4. **Missing Data:**
   - Null checks throughout (logline, author, genre may be missing)
   - Filter logic treats empty arrays and missing values identically
   - UI shows "No screenplays" or "Loading..." states instead of crashing

## Cross-Cutting Concerns

**Logging:**
- Console.log with `[Lemon]` prefix for app-level events (startup, migration, load counts)
- Console.warn for recoverable issues (missing files, pre-V6 uploads, migration timeouts)
- Console.error for unexpected failures (fetch errors, normalization crashes)
- ErrorBoundary logs full component stack for debugging

**Validation:**
- TypeScript strict mode catches most issues at compile time
- Type guards (`isV6RawAnalysis`) validate raw JSON before processing
- Range filters checked for `enabled` flag before applying to search
- Genre canonicalization normalizes user input (case-insensitive, whitespace-trimmed)

**Authentication:**
- Firebase App Check (reCAPTCHA v3) validates requests to Firestore
- API keys (Google, Anthropic) stored in `apiConfigStore` (retrieved from Settings)
- Requests to Anthropic include `Authorization: Bearer ${apiKey}` header

**Performance:**
- React Query caching prevents refetches within 30-min window
- Lazy loading splits recharts, PDF renderer into separate chunks
- `useMemo` in `useFilteredScreenplays()` prevents unnecessary filter/sort recalculations
- `useScrollReveal()` triggers animations only on viewport entry
- Manual chunk splitting in Vite: vendor-react, vendor-recharts, vendor-state for long-term caching

**Styling:**
- Tailwind CSS 4 via `@tailwindcss/vite` plugin (no CSS-in-JS or modules)
- Theme colors defined in `src/index.css` with CSS variables (gold/black palette)
- Responsive classes (md:, lg:) for mobile-first design
- Glassmorphism and gradient effects via imported CSS files (`glassmorphism.css`, `mesh-gradients.css`)

---

*Architecture analysis: 2026-03-13*
