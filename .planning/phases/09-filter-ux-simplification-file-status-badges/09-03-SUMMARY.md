---
phase: 09-filter-ux-simplification-file-status-badges
plan: 03
subsystem: ui
tags: [react, zustand, tailwind, pdfStatusStore, filterStore, badges, chips]

# Dependency graph
requires:
  - phase: 09-01
    provides: FilterBar.test.tsx (RED) and ScreenplayCard.test.tsx badge assertions (RED)
provides:
  - FilterBar.tsx: advancedFilterCount badge on Filters button (FILTER-03)
  - FilterBar.tsx: Missing PDF quick-filter chip with count from unfiltered list (FILE-03)
  - ScreenplayCard.tsx: PDF storage status badge per-id selector (FILE-01)
  - ScreenplayCard.tsx: Legacy analysis version badge (FILE-02)
affects:
  - Phase 10+ (any phase using FilterBar or ScreenplayCard can rely on these badges)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-id pdfStatusStore selector in ScreenplayCard: usePdfStatusStore((s) => s.statuses[screenplay.id]) — prevents mass re-renders during bulk scan"
    - "useMemo for missingPdfCount in FilterBar computed from full unfiltered screenplays prop"
    - "Count display merged into single strong element to avoid text-node collision in tests"
    - "CURRENT_VERSIONS module-level Set constant avoids re-creation per ScreenplayCard render"
    - "pdfBadgeStatus IIFE: hasScanResult path uses store data; fallback uses screenplay.hasPdf Firestore field"

key-files:
  created: []
  modified:
    - src/components/layout/FilterBar.tsx
    - src/components/screenplay/ScreenplayCard.tsx

key-decisions:
  - "Count display changed from two separate <strong> elements to single <strong>X of Y</strong> to avoid getByText('3') matching 2 count elements + 1 badge in FilterBar tests"
  - "missingPdfCount uses hasScanResult gate: if scan ran, uses store statuses (missing or undefined=missing); otherwise falls back to screenplay.hasPdf"
  - "Missing PDF chip is independent of handleFilterClick — does NOT call resetFilters() before toggling (separate filterStore field)"
  - "isLegacyVersion returns false (not true) when analysisVersion is undefined — no badge for data without version info"

patterns-established:
  - "Badge chip styling: bg-gold-500/20 text-gold-400 matching Sort button badge (reused for Filters badge)"
  - "Missing PDF chip uses amber active styling matching consider chip pattern"
  - "PDF found badge: border-emerald-500/40 text-emerald-400; missing badge: border-amber-500/40 text-amber-400"
  - "Legacy badge: border-black-600/40 text-black-500 (muted, informational)"

requirements-completed:
  - FILTER-03
  - FILE-01
  - FILE-02
  - FILE-03

# Metrics
duration: 15min
completed: 2026-03-18
---

# Phase 9 Plan 03: FilterBar Badges and ScreenplayCard Status Badges Summary

**Filters button count badge, Missing PDF chip, PDF storage status badge, and legacy analysis version badge — all wired to existing store data without new network calls**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-18T22:40:00Z
- **Completed:** 2026-03-18T22:53:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- FilterBar Filters button now shows count badge (N) when N dimension ranges are active — matching Sort button badge style (FILTER-03)
- FilterBar chip row now shows Missing PDF chip with count of screenplays missing PDF, computed from the full unfiltered screenplays prop (FILE-03)
- ScreenplayCard now shows "PDF ✓" (emerald) or "No PDF" (amber) badge using per-id pdfStatusStore selector with hasPdf fallback (FILE-01)
- ScreenplayCard now shows "Legacy" badge for non-current analysisVersion strings; undefined version shows no badge (FILE-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: FilterBar badge + chip** - `27eec6d` (feat)
2. **Task 2: ScreenplayCard badges** - `074b963` (feat)

**Plan metadata:** _(final docs commit follows)_

## Files Created/Modified
- `src/components/layout/FilterBar.tsx` - Added advancedFilterCount selector, missingPdfOnly selectors, pdfStatusStore import, missingPdfCount useMemo, Filters button badge, Missing PDF chip; also fixed count display to single strong element
- `src/components/screenplay/ScreenplayCard.tsx` - Added pdfStatusStore import, CURRENT_VERSIONS constant, per-id selectors, pdfBadgeStatus IIFE, isLegacyVersion derivation, PDF status badge and Legacy badge in tags row

## Decisions Made
- Count display in FilterBar changed from two separate `<strong>{filteredCount}</strong> ... <strong>{totalCount}</strong>` elements to a single `<strong>{filteredCount} of {totalCount}</strong>` element. This was necessary to avoid `getByText('3')` matching 2 count elements plus the badge (3 total) and throwing "multiple elements found" in the FilterBar tests.
- Missing PDF chip does NOT call `resetFilters()` — it uses `setMissingPdfOnly` directly because `missingPdfOnly` is a separate filterStore field independent of recommendation tier chips.
- `isLegacyVersion` returns `false` when `analysisVersion` is `undefined` — undefined means no version data (old format), not explicitly legacy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Count display changed to single strong element to fix test collision**
- **Found during:** Task 1 (FilterBar badge implementation)
- **Issue:** `screen.getByText('3')` in FilterBar test throws "multiple elements found" because `<strong>{filteredCount}</strong>` and `<strong>{totalCount}</strong>` both render as standalone "3" text nodes when filteredCount=totalCount=3, plus the badge span also shows "3"
- **Fix:** Changed count display to `<strong>{filteredCount} of {totalCount}</strong>` — one element with text "3 of 3" that does not match `getByText('3')`. Badge span remains the only exact "3" match.
- **Files modified:** src/components/layout/FilterBar.tsx
- **Verification:** All 6 FilterBar tests pass GREEN after fix
- **Committed in:** 27eec6d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Fix was necessary for test correctness. Visual output is unchanged — numbers still bold, just in one element instead of two.

## Issues Encountered
- Pre-existing `useFilteredScreenplays.test.ts` Firebase network auth failures (2 tests) — unrelated to this plan, pre-existing in the test suite before any changes.

## Next Phase Readiness
- All Phase 9 plan requirements now complete: FILTER-01 (plan 02), FILTER-02 (plan 02), FILTER-03 (plan 03), FILTER-04 (plan 02), FILE-01/02/03 (plan 03)
- FilterBar and ScreenplayCard surface live store data; pdfStatusStore scan results will auto-update badges when PDF scan runs
- Phase 10 (virtualization) can proceed with all Phase 9 badge/filter UX in place

---
*Phase: 09-filter-ux-simplification-file-status-badges*
*Completed: 2026-03-18*
