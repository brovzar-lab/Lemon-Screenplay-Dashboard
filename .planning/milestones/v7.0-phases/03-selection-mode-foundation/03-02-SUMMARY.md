---
phase: 03-selection-mode-foundation
plan: 02
subsystem: ui
tags: [react, zustand, bulk-actions, tailwind, clsx, vitest]

# Dependency graph
requires:
  - phase: 03-selection-mode-foundation/01
    provides: selectionStore (useSelectionCount, useHasSelection, useSelectionStore), ScreenplayCard checkbox
provides:
  - BulkActionBar sticky bottom shell with selection count, clear, Select All/Deselect All
  - Six disabled action button placeholders (Export CSV, Export PDF, Compare, Upload PDFs, Collection, Favorites)
  - BackToTopButton offset when BulkActionBar is visible
  - BulkActionBar barrel export from screenplay components
affects: [04-bulk-action-wiring, export, comparison, collections, favorites]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional fixed-bottom positioning using clsx + useHasSelection"
    - "Disabled button shell with title tooltips for future wiring"

key-files:
  created:
    - src/components/screenplay/BulkActionBar.tsx
    - src/components/screenplay/BulkActionBar.test.tsx
  modified:
    - src/components/screenplay/ScreenplayGrid.tsx
    - src/components/screenplay/BackToTopButton.tsx
    - src/components/screenplay/BackToTopButton.test.tsx
    - src/components/screenplay/ScreenplayGrid.test.tsx
    - src/components/screenplay/index.ts

key-decisions:
  - "BulkActionBar uses same glass styling pattern as ComparisonBar for visual consistency"
  - "BackToTopButton shifts from bottom-6 to bottom-20 via clsx (replaces template literal)"
  - "Six action buttons disabled with native title tooltips per D-10 (visible-but-disabled pattern)"

patterns-established:
  - "Fixed bottom bar shell: disabled buttons with tooltips for future wiring"
  - "Conditional bottom offset: useHasSelection drives sibling component positioning"

requirements-completed: [BULK-02, BULK-03, BULK-10]

# Metrics
duration: 3min
completed: 2026-03-23
---

# Phase 3 Plan 2: Bulk Action Bar Shell Summary

**Sticky bottom BulkActionBar with selection count, clear/select actions, and six disabled action button placeholders following ComparisonBar glass pattern**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T23:55:56Z
- **Completed:** 2026-03-23T23:59:32Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- BulkActionBar renders when 1+ screenplays selected with correct singular/plural count
- Six disabled action buttons (Export CSV, Export PDF, Compare, Upload PDFs, Collection, Favorites) with title tooltips
- Clear button, Select All (filtered), Deselect All actions wired to selectionStore
- BackToTopButton shifts upward (bottom-20) when BulkActionBar visible to avoid overlap
- BulkActionBar mounted as Fragment sibling in ScreenplayGrid
- 7 BulkActionBar tests + 2 new BackToTopButton tests + 1 new ScreenplayGrid test all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create BulkActionBar component with tests (TDD)** - `c9fac9d` (feat)
2. **Task 2: Mount BulkActionBar in ScreenplayGrid and shift BackToTopButton** - `6690d9f` (feat)

## Files Created/Modified
- `src/components/screenplay/BulkActionBar.tsx` - Sticky bottom action bar shell with count, clear, Select All, Deselect All, six disabled buttons
- `src/components/screenplay/BulkActionBar.test.tsx` - 7 unit tests for visibility, count, actions, disabled state, tooltips
- `src/components/screenplay/ScreenplayGrid.tsx` - Added BulkActionBar import and JSX sibling render
- `src/components/screenplay/BackToTopButton.tsx` - Added clsx + useHasSelection for conditional bottom offset
- `src/components/screenplay/BackToTopButton.test.tsx` - Added 2 tests for bottom-6 vs bottom-20 positioning
- `src/components/screenplay/ScreenplayGrid.test.tsx` - Added BulkActionBar mock and rendering test
- `src/components/screenplay/index.ts` - Added BulkActionBar barrel export

## Decisions Made
- BulkActionBar uses same glass styling as ComparisonBar (fixed bottom-0 left-0 right-0 z-40, glass border-t, animate-slide-up) for visual consistency
- BackToTopButton refactored from template literal to clsx for cleaner conditional class composition
- Six action buttons are disabled with native HTML title tooltips per D-10 decision (visible-but-disabled, never hidden)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
- `src/components/screenplay/BulkActionBar.tsx` - Six action buttons (Export CSV, Export PDF, Compare, Upload PDFs, Collection, Favorites) are intentionally disabled shells. Phase 4 will wire them to actual functionality. This is by design per the plan's phased approach.

## Next Phase Readiness
- BulkActionBar shell complete and mounted, ready for Phase 4 action wiring
- All six action buttons have stable DOM locations and title tooltips for wiring
- selectionStore integration confirmed working end-to-end (card checkbox -> store -> BulkActionBar)

## Self-Check: PASSED

All 8 files verified present. Both task commits (c9fac9d, 6690d9f) confirmed in git log.

---
*Phase: 03-selection-mode-foundation*
*Completed: 2026-03-23*
