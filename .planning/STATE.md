---
gsd_state_version: 1.0
milestone: v7.0
milestone_name: Pipeline Scale & Bulk Operations
status: Defining requirements
stopped_at: Completed 10-03-PLAN.md (useShallow filter subscription fix)
last_updated: "2026-03-19T09:20:08.961Z"
last_activity: 2026-03-17 — Milestone v7.0 started
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 7
  completed_plans: 7
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-17)

**Core value:** Surface the best screenplays from a large pipeline so the producer doesn't waste time reading bad ones
**Current focus:** v7.0 milestone — Phase 8 complete; next phase TBD per ROADMAP

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-17 — Milestone v7.0 started

Progress: [██████████] 100%

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-phase]: Partner sharing uses crypto.randomUUID() tokens in Firestore shared_views collection — NOT dashboard URL sharing (existing ShareModal is a rebuild, not an extension)
- [Pre-phase]: Export package is analysis PDF only (client-side, @react-pdf/renderer) — original screenplay PDF bundling deferred pending stakeholder decision on Cloud Function path
- [Pre-phase]: Market intelligence uses existing Claude lens architecture for timing/feasibility — no new API integrations; TMDB via Cloud Function proxy for comp enrichment
- [Pre-phase]: Phase 1 (security) is a hard prerequisite before any share link is generated for an external partner
- [Phase 01]: App Check intentionally skipped (prior provider mismatch caused 400 errors); anonymous auth with browserLocalPersistence chosen instead
- [Phase 01]: flushPendingWrites not separately gated by authReady (only called from backgroundFirestoreSync which already gates)
- [Phase 01]: shared_views allows public read (token = capability); storage.rules left unchanged per user decision
- [Phase 01]: Production gate passed — dashboard loads normally under new security model; unauthenticated reads blocked
- [Phase 02]: getPendingWriteCount is synchronous localStorage read (no Firestore dependency)
- [Phase 02]: syncStatusStore is ephemeral (no persist middleware) -- session-only data
- [Phase 02]: useSyncRetry guards concurrent retries via isRetrying check before flush
- [Phase 02]: SyncStatusIndicator returns null when no pending writes (zero visual noise)
- [Phase 03]: Old removeAnalysis/removeMultipleAnalyses/clearAllAnalyses kept as deprecated aliases to soft-delete versions for backward compatibility
- [Phase 03]: Quarantine stores full raw document + _quarantined_at/_quarantine_reason/_original_collection metadata
- [Phase 03]: _deleted_at preserved through backgroundFirestoreSync round-trips (not stripped like _savedAt/_docId)
- [Phase 03]: getDeletedAnalyses reads from localStorage only (synchronous, 30-day sliding window)
- [Phase 03]: Optimistic update on restore removes item from deleted list immediately before server confirms
- [Phase 03]: Delete confirmation text updated to "recoverable within 30 days" reflecting soft-delete
- [Phase 03]: authReady moved inside try-catch so Firestore auth failures never block localStorage operations
- [Phase 04]: Toast store is ephemeral (no persist) matching syncStatusStore pattern
- [Phase 04]: ToastContainer placed outside ErrorBoundary for always-visible feedback
- [Phase 04]: UX-01 (SkeletonCard) and UX-02 (EmptyState) verified as pre-existing in ScreenplayGrid
- [Phase 04]: Toast calls are additive (console.error preserved) for debug logging
- [Phase 04]: Background operations (api.ts, sync, migration) remain console-only — no toast spam
- [Phase 04]: PosterSection skips toast for GOOGLE_API_KEY_MISSING (has dedicated UI)
- [Phase 05]: revokeShareToken accepts both token and screenplayId params to avoid extra query for cache invalidation
- [Phase 05]: shareStore is ephemeral (no persist middleware) matching syncStatusStore/toastStore pattern
- [Phase 05]: ShareButton uses inline absolute-positioned popover (no portal needed)
- [Phase 05]: Auto-revoke on soft-delete is fire-and-forget to never block the delete operation
- [Phase 06]: Analysis data fully embedded in shared_views doc at creation time (snapshot pattern)
- [Phase 06]: resolveShareToken bypasses authReady for public partner access
- [Phase 06]: pdfUrl resolved via getDownloadURL at share creation, stored as null if not found
- [Phase 06]: Notes snapshot includes only content and createdAt (strips id, author, screenplayId, updatedAt)
- [Phase 06]: Share URL uses window.location.origin instead of hardcoded production URL for dev/staging compatibility
- [Phase 06]: Header logo is theme-aware: white on dark, black on light; shared view always uses white version
- [Phase 06]: Shared view components use props-only pattern (no Zustand/React Query) for bundle isolation
- [Phase 07]: Notes section omitted entirely when no notes exist (no empty placeholder) per CONTEXT.md decision
- [Phase 07]: exportCoverage uses .tsx extension for JSX in pdf() call
- [Phase 07]: Score color thresholds 70%/40% for coverage doc (differs from PdfDocument.tsx 80%/60%)
- [Phase 07]: Dimension score bars use max=10 regardless of V5/V6 format
- [Phase 07]: Coverage button placed after ShareButton, before ReanalyzeButton in modal action bar
- [Phase 07]: Coverage button uses loading spinner + 3s error auto-reset with toast feedback
- [Phase 07]: titleText.marginBottom 3→8 and authorText.marginTop 2 added to fix cover page title/author overlap (UAT test 4)
- [v7.0 pre-phase]: BULK-02 re-analyze downloads PDF from Firebase Storage (getDownloadURL → fetch → File object) — only hasPdf=true screenplays are eligible; others excluded from bulk re-analyze selection
- [v7.0 pre-phase]: PERF-01 column-aware virtualization — ScreenplayGrid uses responsive grid-cols-1/2/3/4; Phase 10 research plan must confirm @tanstack/react-virtual vs alternatives and measure column count at runtime
- [v7.0 pre-phase]: FILTER-02 disclosure toggle wraps existing Dimension Scores section; existing badge prop becomes source for FILTER-03 active-filter count
- [Phase 08-pdf-cover-page-polish]: scoreLeft layout uses single centered-group View with marginTop:16 gap constant (__scoreGapStyle) instead of dual-flex siblings that collapse in react-pdf
- [Phase 08-pdf-cover-page-polish]: Test-only exports (__coverageDocStyles, __scoreGapStyle) allow stylesheet regression assertions without DOM traversal (react-pdf stubs strip style props)
- [Phase 09-filter-ux-simplification-file-status-badges]: FilterPanel tests use real Zustand store (useFilterStore.setState); FilterBar uses selector-intercepting mock; ScreenplayCard adds pdfStatusStore selector mock
- [Phase 09-02]: initialSection IIFE in useState derives correct section at mount from active filters; includes 'dimensions' case for dimension-range-enabled auto-expand
- [Phase 09-02]: AdvancedDisclosure nested inside Dimension Scores Section — two-level disclosure (accordion outer + disclosure inner) with independent boolean states
- [Phase 09-02]: Store destructuring block moved above useState calls — required for IIFE initializers to reference destructured store values
- [Phase 09-filter-ux-simplification-file-status-badges]: Count display changed to single strong element to fix test collision when filteredCount=totalCount
- [Phase 09-filter-ux-simplification-file-status-badges]: Missing PDF chip uses setMissingPdfOnly directly (not handleFilterClick) — independent of recommendation tier filter
- [Phase 09-filter-ux-simplification-file-status-badges]: isLegacyVersion returns false when analysisVersion is undefined — no badge for data without version info
- [Phase 10-virtual-scrolling-performance]: Removed role=list/listitem ARIA tests in Wave 0 — data-card attribute is the stable query point for virtual DOM structure
- [Phase 10-virtual-scrolling-performance]: Memoization test uses toBe (Object.is identity) not toStrictEqual — referential stability is what PERF-02 requires
- [Phase 10-virtual-scrolling-performance]: useWindowVirtualizer chosen over useVirtualizer — page uses window scroll (min-h-screen flex, no bounded container)
- [Phase 10-virtual-scrolling-performance]: card-enter uses 100ms ease-out opacity fade replacing useScrollReveal IntersectionObserver — simpler, no stagger in virtual rows
- [Phase 10-virtual-scrolling-performance]: useShallow(s => s) replaces bare useFilterStore() in useFilteredScreenplays and useHasActiveFilters — stable memo reference when no filter field changed
- [Phase 10-virtual-scrolling-performance]: vi.mock must be at module scope for Vitest hoisting — calling inside it() is a no-op for module mocking

### Pending Todos

(none — starting fresh for v7.0)

### Blockers/Concerns

- [Phase 8 note]: App Check still disabled (commented out in src/lib/firebase.ts) — acceptable for internal tool, do not re-enable without understanding prior mismatch
- [Phase 8 resolved]: Coverage PDF cover page score/badge gap defect (PDF-01) — fixed in Phase 08-01, visual sign-off confirmed 2026-03-19

## Session Continuity

Last session: 2026-03-19T09:20:08.953Z
Stopped at: Completed 10-03-PLAN.md (useShallow filter subscription fix)
Resume file: None
