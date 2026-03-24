---
phase: 03-selection-mode-foundation
plan: 01
subsystem: ui
tags: [zustand, selection, checkbox, bulk-operations, set-based-store]

# Dependency graph
requires:
  - phase: 02-performance-at-scale
    provides: Virtual scrolling grid with memoized ScreenplayCard
provides:
  - Set-based selectionStore with toggle, selectAll, deselectAll and derived hooks
  - Always-visible bulk selection checkbox in ScreenplayCard top-left corner
  - Gold selection ring on selected cards (ring-2 ring-gold-500/50)
affects: [03-selection-mode-foundation plan 02, bulk-action-bar, batch-export, batch-compare]

# Tech tracking
tech-stack:
  added: []
  patterns: [Set-based Zustand store for O(1) selection lookups, always-visible checkbox pattern]

key-files:
  created:
    - src/stores/selectionStore.ts
    - src/stores/selectionStore.test.ts
  modified:
    - src/components/screenplay/ScreenplayCard.tsx
    - src/components/screenplay/ScreenplayCard.test.tsx

key-decisions:
  - "Set-based selectionStore (not array) for O(1) has/toggle operations"
  - "No persist middleware -- selection is ephemeral, clears on page refresh"
  - "Bulk checkbox always visible (not hover-gated) per D-05 decision"
  - "Gold ring only shows when NOT in delete mode to avoid double rings"

patterns-established:
  - "Set-based selection store: new Set on every mutation for Zustand reference detection"
  - "Always-visible checkbox: top-3 left-3, no opacity gating, SVG checkmark"
  - "Dual checkbox pattern: bulk (gold, always visible) vs delete (red, mode-gated)"

requirements-completed: [BULK-01, BULK-11]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 03 Plan 01: Selection Store & Card Checkbox Summary

**Set-based Zustand selection store with O(1) lookups and always-visible gold checkbox in ScreenplayCard top-left corner**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T23:48:41Z
- **Completed:** 2026-03-23T23:52:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created selectionStore.ts with Set-based state, toggle/selectAll/deselectAll actions, and 4 derived hooks (useIsSelected, useSelectionCount, useHasSelection, useSelectionStore)
- Replaced hover-gated export checkbox with always-visible bulk selection checkbox in top-left corner of ScreenplayCard
- Gold selection ring (ring-2 ring-gold-500/50) on selected cards, coexisting with existing delete mode red ring
- 12 store unit tests and 19 card component tests all passing; build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Create selectionStore with tests** - `0a4b7a7` (feat) - TDD: RED then GREEN
2. **Task 2: Add always-visible checkbox and selection ring to ScreenplayCard** - `041000c` (feat)

## Files Created/Modified
- `src/stores/selectionStore.ts` - Set-based Zustand store with toggle, selectAll, deselectAll, useIsSelected, useSelectionCount, useHasSelection
- `src/stores/selectionStore.test.ts` - 12 unit tests covering all store behaviors including Set reference identity
- `src/components/screenplay/ScreenplayCard.tsx` - Always-visible gold checkbox (top-3 left-3), gold selection ring, removed exportSelectionStore dependency
- `src/components/screenplay/ScreenplayCard.test.tsx` - Added selectionStore mock, 2 new tests (always-visible checkbox, gold ring), updated from 17 to 19 tests

## Decisions Made
- Set-based selectionStore (not array) for O(1) has/toggle operations -- matches deleteSelectionStore pattern
- No persist middleware -- selection is ephemeral, clears on page refresh (intentional UX)
- Bulk checkbox always visible (not hover-gated) per D-05 decision from Phase 3 CONTEXT
- Gold ring only shows when NOT in delete mode to avoid double rings with red delete ring
- exportSelectionStore import removed from ScreenplayCard -- bulk selection replaces per-card export selection

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data sources are wired (selectionStore drives checkbox state and ring visibility).

## Next Phase Readiness
- selectionStore is the foundation for all bulk operations -- Plan 02 (BulkActionBar) can read useHasSelection and useSelectionCount to control bar visibility and display count
- ScreenplayCard checkbox is wired to selectionStore.toggle -- clicking cards will populate the selection set for batch export, compare, collect, and favorite operations

---
*Phase: 03-selection-mode-foundation*
*Completed: 2026-03-23*
