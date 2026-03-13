# Architecture Patterns

**Domain:** Screenplay analysis dashboard — partner sharing, external data, UX polish additions
**Researched:** 2026-03-13
**Confidence:** HIGH (based on full codebase audit in `.planning/codebase/`)

---

## Existing Architecture (Baseline)

The codebase uses a strict layered pattern. Every new feature must slot into this hierarchy — not bypass it.

```
Firebase/API
    ↓
lib/ (api.ts, analysisStore.ts) — data access + normalization
    ↓
React Query (useScreenplays) — server state cache
    ↓
hooks/ (useFilteredScreenplays, useUrlState) — derived state
    ↓
Zustand stores — persistent client state
    ↓
Components — presentation only
```

**Non-negotiables from codebase conventions:**
- Components do not call Firebase directly — only through lib/ functions
- Client state lives in Zustand stores in `src/stores/`
- Server state lives in React Query; mutations invalidate the query cache
- External API integrations live in `src/services/` as pure functions
- Lazy loading via `React.lazy()` for any heavy new chunk (PDF, charts)

---

## Recommended Architecture for New Features

### Feature 1: Partner Sharing (Shareable Links)

**What exists:** `ShareModal` in `src/components/share/` generates a URL from current filter state and opens `mailto:`. This is a dashboard-level share (all screenplays, filtered view). It does NOT share an individual screenplay.

**What's needed:** A per-screenplay shareable link that a partner can open without access to the full dashboard. The link should render a read-only view of one screenplay's analysis + producer notes + PDF link.

#### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `src/lib/shareService.ts` | Generate share tokens, write/read Firestore `shared_views` collection, build share URLs | Firestore via `firebase.ts` |
| `src/stores/shareStore.ts` | Track pending share generation, active share tokens per screenplay ID | localStorage (Zustand persist) |
| `ShareScreenplayButton` (in `screenplay/` or `ScreenplayModal`) | Trigger share token generation, show copy-link UI | `shareService.ts`, `shareStore` |
| `src/pages/SharedViewPage.tsx` | Read-only public page rendered from token — shows analysis, notes snippet, PDF download | `shareService.ts` (read), React Query |
| `src/components/share/SharedViewLayout.tsx` | Presentation component for read-only screenplay view | `SharedViewPage` |

#### Data Flow — Share Generation

```
User clicks "Share" on ScreenplayModal
    ↓
shareService.createShareToken(screenplayId, options)
    → Write Firestore: shared_views/{token} = { screenplayId, createdAt, expiresAt, includePdf, includeNotes }
    → Return token
    ↓
shareStore.setToken(screenplayId, token)  [Zustand — local tracking]
    ↓
UI builds URL: https://app.example.com/share/{token}
    ↓
User copies link, sends to partner
```

#### Data Flow — Partner View

```
Partner opens /share/{token}
    ↓
SharedViewPage mounts → reads token from URL params
    ↓
shareService.resolveShareToken(token)
    → Read Firestore: shared_views/{token}
    → Read Firestore: uploaded_analyses/{screenplayId}
    → Return { screenplay, shareOptions }
    ↓
React Query caches resolved data (stale: 5min, cache: 30min)
    ↓
SharedViewLayout renders read-only analysis
```

#### Firestore Schema

```
shared_views/{token}
  screenplayId: string
  createdAt: Timestamp
  expiresAt: Timestamp | null   // null = never expires
  includePdf: boolean
  includeNotes: boolean
  noteSnapshot: string | null   // Snapshot of notes at share time (avoids live note exposure)
  viewCount: number             // Increment on each read (optional analytics)
```

**Firestore rules concern:** Current rules allow `if true` reads. The `shared_views` collection can be read-only by anyone who has the token (token is the access control). Writes must be restricted to authenticated contexts or via App Check. This is acceptable for an internal tool at current scale.

#### Route Addition

Add route in `src/App.tsx` (or `main.tsx`): `/share/:token` → `SharedViewPage` (lazy loaded).

```typescript
const SharedViewPage = React.lazy(() => import('./pages/SharedViewPage'))

// In router config:
{ path: '/share/:token', element: <SharedViewPage /> }
```

---

### Feature 2: Export Package (Coverage Package Download)

**What exists:** `ExportModal` generates individual PDF pitch decks via `@react-pdf/renderer` and CSV exports. The PDF is generated client-side per screenplay.

**What's needed:** A "coverage package" that bundles: (1) the analysis PDF, (2) producer notes, (3) optionally the original screenplay PDF. This is a richer artifact than the current pitch deck.

#### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `src/components/export/CoveragePackageModal.tsx` | UI for configuring what to include in the package (notes, PDF, analysis sections) | `exportPackageService.ts`, `notesStore`, `pdfStatusStore` |
| `src/lib/exportPackageService.ts` | Orchestrate package creation: generate analysis PDF, fetch screenplay PDF from Storage, bundle | `@react-pdf/renderer`, Firebase Storage, `notesStore` |
| `src/components/export/CoveragePackageDocument.tsx` | New `@react-pdf/renderer` document with notes section, coverage layout distinct from pitch deck | `exportPackageService.ts` |

#### Data Flow — Package Generation

```
User selects screenplay → "Coverage Package" option in ExportModal or ScreenplayModal
    ↓
CoveragePackageModal opens — user selects: include notes? include original PDF?
    ↓
exportPackageService.generatePackage(screenplay, options)
    → generateAnalysisPdf(screenplay, notes) via @react-pdf/renderer → Blob
    → If includePdf: fetch from Firebase Storage via getBlob(storageRef)
    → Zip both blobs using JSZip (new dependency, small, ~40KB gzip)
    → Return Blob URL → trigger download as {title}_CoveragePackage.zip
    ↓
If includePdf is false: download only the analysis PDF (no zip needed)
```

**JSZip:** Add `jszip` package. It is the standard browser-compatible zip library, no server required. MEDIUM confidence this is the right choice; verified it works in browser-only React apps as of 2025.

**Alternative (no new dependency):** If bundling the original PDF proves too complex (Storage CORS), generate the coverage PDF document only (no zip). The producer emails the original PDF separately. This is simpler and matches current user workflow.

---

### Feature 3: External Film Data (Comparable Titles / Market Intelligence)

**Context:** The codebase already has `RawComparableFilm` in the analysis JSON — comparable titles are AI-generated by Claude during analysis. The `RawTmdbStatus` interface exists and is populated for some screenplays. TMDB is already part of the existing data model.

The new requirement is to surface this data more prominently and enrich it — adding market timing context and budget feasibility framing.

#### What Already Exists

```typescript
// In screenplay.ts — already normalized from Claude analysis:
comparable_films: RawComparableFilm[]  // { title, similarity, box_office_relevance }
tmdb_status?: RawTmdbStatus            // { is_produced, tmdb_id, release_date, confidence }
```

The data already flows through the pipeline. The gap is UI presentation, not data collection.

#### Architecture for Enrichment

**Option A — Claude-powered enrichment (preferred, no new API keys):**

The DevExec AI chat already calls Claude with screenplay data. A new `marketInsightsService.ts` can prompt Claude to:
- Elaborate on why the comparables are relevant
- Assess whether the genre/theme is currently saturated or underserved (based on Claude's training knowledge + any recent context provided)
- Estimate production cost range relative to likely return

This requires no new API integrations and works within the existing `promptClient.ts` pattern.

**Option B — TMDB API direct (requires new API key from user):**

TMDB API v3 (api.themoviedb.org/3) allows searching films by title, genre ID, keywords. The existing `RawComparableFilm.title` values can be used as search terms to retrieve box office data, release dates, and budget estimates where available.

TMDB API is free for non-commercial use, requires a user-supplied API key (same pattern as Anthropic/Google keys). MEDIUM confidence on TMDB data quality for budget/box office — TMDB links to The Numbers for financials but does not always include them.

**Recommendation: Option A first, Option B later.**

Start by surfacing and formatting the AI-generated comparable data that already exists in the analysis JSON. Add a "Market Insights" panel that uses Claude (DevExec pattern) to synthesize market timing context on demand. TMDB API integration is a Phase 2 addition if richer film database data is needed.

#### Component Boundaries — Market Insights

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `src/services/marketInsightsService.ts` | Build Claude prompt from screenplay data, call `promptClient.ts`, parse response | `promptClient.ts`, `apiConfigStore` |
| `src/stores/marketInsightsStore.ts` | Cache insights per screenplay ID (avoid re-fetching on re-open) | localStorage (Zustand persist) |
| `src/components/screenplay/modal/MarketInsightsPanel.tsx` | UI panel in ScreenplayModal: comparable films table, market timing badge, budget feasibility | `marketInsightsStore`, `marketInsightsService` |
| `src/hooks/useMarketInsights.ts` | Coordinate fetch trigger, loading state, cache lookup | `marketInsightsStore`, `marketInsightsService` |

#### Data Flow — Market Insights

```
User opens ScreenplayModal → MarketInsightsPanel renders
    ↓
useMarketInsights(screenplayId) checks marketInsightsStore cache
    → Hit: render cached insights immediately
    → Miss: show "Generate Insights" button (don't auto-fetch, costs API tokens)
    ↓
User clicks "Generate" → marketInsightsService.generateInsights(screenplay)
    → Build prompt: screenplay title, genre, themes, comparable_films, budget_tier
    → Call promptClient.ts (Anthropic) with structured prompt
    → Parse response: { marketTiming: string, budgetFeasibility: string, comparableContext: string[] }
    ↓
marketInsightsStore.setInsights(screenplayId, insights)  [persisted]
    ↓
MarketInsightsPanel re-renders with insights
```

**Cost control:** Gate behind the existing `canMakeRequest()` check in `apiConfigStore`. Each market insights request consumes approximately the same tokens as a simple DevExec query (~1-2K tokens). Show estimated cost before generating.

---

### Feature 4: Data Sync Reliability

**What exists:** The dual-write pattern in `analysisStore.ts` writes to localStorage first (instant), then Firestore async. Failures queue for retry silently (`PENDING_QUEUE_KEY`).

**Architecture for visibility:**

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `src/stores/syncStatusStore.ts` | Track: pendingCount, failedCount, lastSyncAt, isSyncing | localStorage (Zustand persist) |
| `src/components/layout/SyncStatusIndicator.tsx` | Small indicator in Header: "3 pending sync" dot / "Sync failed" warning | `syncStatusStore` |
| `src/hooks/useSyncRetry.ts` | Poll pending queue, trigger retry writes, update `syncStatusStore` | `analysisStore.ts` retry logic |

This is a plumbing change to `analysisStore.ts` — emit sync events that `syncStatusStore` subscribes to — rather than a new data layer.

---

### Feature 5: UX Polish

UX polish is not a new architectural layer. It is modifications within the existing component tree:

- **Loading states:** Add skeleton components to `src/components/ui/` — `SkeletonCard`, `SkeletonModal`. Used by `ScreenplayGrid` and `ScreenplayModal` during React Query `isLoading`.
- **Empty states:** Add `EmptyState` component to `src/components/ui/`. Used by `ScreenplayGrid` when filtered result is empty.
- **Error feedback:** Upgrade `ErrorBoundary` to show actionable recovery options per error type.
- **Transitions:** Add CSS animation classes to `src/styles/animations.css`. Apply via Tailwind `transition-*` utilities in components.

No new stores, services, or routes required for UX polish.

---

## Full Component Boundary Map

```
src/
├── pages/
│   └── SharedViewPage.tsx          [NEW] Public read-only screenplay view for partners
│
├── components/
│   ├── share/
│   │   ├── ShareModal.tsx           [EXISTING] Dashboard-level share (unchanged)
│   │   ├── ShareScreenplayButton.tsx [NEW] Per-screenplay share trigger
│   │   └── SharedViewLayout.tsx     [NEW] Read-only analysis layout
│   │
│   ├── export/
│   │   ├── ExportModal.tsx          [EXISTING] CSV + PDF export (add package option)
│   │   ├── CoveragePackageModal.tsx [NEW] Package configuration UI
│   │   ├── PdfDocument.tsx          [EXISTING] Pitch deck (unchanged)
│   │   └── CoveragePackageDocument.tsx [NEW] Coverage package PDF template
│   │
│   ├── screenplay/modal/
│   │   └── MarketInsightsPanel.tsx  [NEW] Comparables + market timing in ScreenplayModal
│   │
│   ├── layout/
│   │   └── SyncStatusIndicator.tsx  [NEW] Header sync status dot
│   │
│   └── ui/
│       ├── SkeletonCard.tsx         [NEW] Loading skeleton for screenplay cards
│       ├── SkeletonModal.tsx        [NEW] Loading skeleton for modal content
│       └── EmptyState.tsx           [NEW] Zero-results empty state
│
├── services/
│   └── marketInsightsService.ts    [NEW] Claude prompt for market analysis
│
├── lib/
│   ├── shareService.ts             [NEW] Share token CRUD via Firestore
│   └── exportPackageService.ts     [NEW] Coverage package orchestration
│
├── stores/
│   ├── shareStore.ts               [NEW] Active tokens per screenplay
│   ├── marketInsightsStore.ts      [NEW] Cached insights per screenplay (persisted)
│   └── syncStatusStore.ts          [NEW] Pending/failed Firestore write counts
│
└── hooks/
    ├── useMarketInsights.ts         [NEW] Fetch + cache market insights
    └── useSyncRetry.ts              [NEW] Poll and retry failed Firestore writes
```

---

## Data Flow Summary

### Share Flow (new)

```
Producer: ScreenplayModal → ShareScreenplayButton
    → shareService.createShareToken() → Firestore: shared_views/{token}
    → URL: /share/{token} copied to clipboard

Partner: Browser → /share/{token} → SharedViewPage
    → shareService.resolveShareToken() → Firestore reads
    → React Query caches → SharedViewLayout renders read-only view
```

### Coverage Package Flow (new)

```
Producer: ScreenplayModal → "Coverage Package" → CoveragePackageModal
    → exportPackageService.generatePackage()
    → @react-pdf/renderer → analysis PDF blob
    → Firebase Storage getBlob() → screenplay PDF blob (optional)
    → JSZip bundle → download trigger
```

### Market Insights Flow (new)

```
Producer: ScreenplayModal → MarketInsightsPanel
    → useMarketInsights() checks marketInsightsStore
    → Miss: "Generate" button → marketInsightsService.generateInsights()
    → promptClient.ts → Anthropic API → parsed response
    → marketInsightsStore.setInsights() [persisted]
    → Panel renders: comparable context, market timing, budget feasibility
```

### Sync Status Flow (new)

```
analysisStore.ts: Firestore write attempt
    → Success: syncStatusStore.recordSuccess()
    → Failure: syncStatusStore.recordFailure() + queue for retry
    → SyncStatusIndicator in Header reads syncStatusStore
    → useSyncRetry hook polls queue on interval, retries failed writes
```

---

## Suggested Build Order

Dependencies flow top to bottom — build in this order to avoid blocking work.

**Phase 1 — Foundation (no feature dependencies)**
1. UX Polish — `SkeletonCard`, `SkeletonModal`, `EmptyState` in `src/components/ui/`. No dependencies. Immediately improves perceived quality.
2. Sync Status — `syncStatusStore` + `SyncStatusIndicator` + `useSyncRetry`. Standalone plumbing change. Addresses data reliability risk before adding sharing features.

**Phase 2 — Sharing (depends on Firestore schema)**
3. `shareService.ts` — Firestore `shared_views` schema and CRUD
4. `shareStore.ts` + `ShareScreenplayButton` — UI trigger
5. `SharedViewPage.tsx` + `SharedViewLayout.tsx` — partner-facing read-only view
6. Route registration in main router

**Phase 3 — Export Package (depends on existing PdfDocument patterns)**
7. `CoveragePackageDocument.tsx` — new PDF template (modeled on existing `PdfDocument.tsx`)
8. `exportPackageService.ts` — orchestration + optional JSZip bundling
9. `CoveragePackageModal.tsx` — UI configuration

**Phase 4 — Market Intelligence (depends on existing promptClient pattern)**
10. `marketInsightsService.ts` — Claude prompt design (most experimentation required)
11. `marketInsightsStore.ts` — caching layer
12. `useMarketInsights.ts` — hook
13. `MarketInsightsPanel.tsx` — ScreenplayModal integration

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Components Writing Directly to Firestore

**What:** Placing `setDoc()` calls inside React components or event handlers.
**Why bad:** Bypasses the lib/ data access layer. Makes testing impossible, couples UI to Firebase SDK, breaks the data flow contract.
**Instead:** Route all Firestore operations through functions in `src/lib/` (e.g., `shareService.ts`). Components call service functions.

### Anti-Pattern 2: Storing Large Blobs in Zustand

**What:** Caching PDF blobs or base64 images in Zustand localStorage-persisted stores.
**Why bad:** localStorage has a 5-10 MB limit. The codebase is already close to this limit with 500+ screenplay analyses. PDF blobs would exceed it immediately.
**Instead:** Use URL.createObjectURL() for short-lived blob references. Store only metadata (token IDs, timestamps, flags) in Zustand.

### Anti-Pattern 3: Auto-fetching Market Insights on Modal Open

**What:** Triggering a Claude API call every time ScreenplayModal opens.
**Why bad:** Costs real money per view ($0.01-0.05 per request). 500 screenplays × occasional views = unexpected cost accumulation.
**Instead:** Show a "Generate Market Insights" button. Only fetch on explicit user action. Cache the result in `marketInsightsStore` so subsequent opens are free.

### Anti-Pattern 4: New Public Routes Without Access Control

**What:** Adding `/share/:token` routes that expose all screenplay data if the token structure is predictable.
**Why bad:** Tokens must be unguessable (UUIDs). If sequential IDs or short codes are used, any partner could enumerate other shared screenplays.
**Instead:** Use `crypto.randomUUID()` for all share tokens. Firestore rules should allow read of `shared_views/{token}` by anyone (the token IS the access credential), but write only from the producer's session.

### Anti-Pattern 5: Skipping Code Splitting for New Heavy Features

**What:** Importing `SharedViewPage`, `CoveragePackageModal`, and `MarketInsightsPanel` in the main bundle.
**Why bad:** SharedViewPage is only used by partners who never see the dashboard. CoveragePackageModal is used rarely. Adding them to the main bundle bloats load time for all users.
**Instead:** Use `React.lazy()` for `SharedViewPage` and `CoveragePackageModal`. Wrap with `<Suspense>` and `LoadingFallback`. Market insights panel can be eager-loaded since it's inside the already-lazy-loaded ScreenplayModal.

---

## Scalability Considerations

| Concern | At 500 screenplays (current) | At 2000 screenplays | Mitigation |
|---------|------------------------------|--------------------|-----------
| Share token reads | Trivial Firestore reads | Still trivial (one doc per view) | No change needed |
| localStorage quota | Near limit with analyses | Will exceed limit | localStorage cap at 200 recent; rest Firestore-only |
| Market insights cache | ~500 entries × ~2KB = 1 MB | ~2000 entries × ~2KB = 4 MB | Evict entries older than 30 days |
| Coverage package generation | Client-side PDF, ~2-3s per script | Same | No change (per-screenplay operation) |
| Filter performance | 500 items, useMemo covers it | 2000 items may lag | Add virtual scrolling to grid |

---

## Sources

- Codebase audit: `.planning/codebase/ARCHITECTURE.md`, `INTEGRATIONS.md`, `CONCERNS.md`, `STRUCTURE.md`, `STACK.md`
- Source files: `src/lib/analysisStore.ts`, `src/components/share/ShareModal.tsx`, `src/components/export/ExportModal.tsx`, `src/types/screenplay.ts`, `src/types/screenplay-v6.ts`
- Confidence: HIGH for all patterns described above — derived from direct code analysis of the existing codebase, not from training data assumptions

---

*Architecture research: 2026-03-13*
