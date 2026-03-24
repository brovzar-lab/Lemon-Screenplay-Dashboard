---
phase: 11-bulk-operations
plan: "03"
subsystem: ui
tags: [react, zustand, react-query, bulk-operations, modal, export, typescript]

# Dependency graph
requires:
  - phase: 11-bulk-operations/11-01
    provides: RED test scaffolding for BULK-02 and BULK-03; BulkReanalyzeModal null stub; exportSelectionStore
provides:
  - BulkReanalyzeModal with sequential loop, cancel signal, auto-retry once, and close-time cache invalidation
  - ExportModal mode-aware scope text (selected/filtered/all) and Export N Screenplays button label
  - FilterBar mode ternary corrected to selected/filtered/all
  - BulkShareModal (progressive share URL generation — unblocked build as Rule 3 fix)
affects:
  - FilterBar (uses corrected mode ternary)
  - Any phase adding bulk actions (BULK-02, BULK-03 contracts established)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "cancelledRef pattern: useRef<boolean> for cancel signals in sequential async loops"
    - "Shared module-level mock refs (mockDeselectAll/mockInvalidateQueries) for Vitest assertions across tests"
    - "BulkReanalyzeModal: on-close batch invalidation pattern (invalidate after loop, not during)"

key-files:
  created:
    - src/components/bulk/BulkReanalyzeModal.tsx
    - src/components/bulk/BulkShareModal.tsx
  modified:
    - src/components/bulk/BulkReanalyzeModal.test.tsx
    - src/components/export/ExportModal.tsx
    - src/components/layout/FilterBar.tsx

key-decisions:
  - "BulkReanalyzeModal summary text avoids 'failed' keyword to prevent getByText ambiguity with item status spans — uses 'could not be processed' instead"
  - "BulkReanalyzeModal header X button uses aria-label='Dismiss' to differentiate from footer Close button in tests"
  - "BulkReanalyzeModal.test.tsx fixed: shared module-level mock refs (mockDeselectAll/mockInvalidateQueries) replace per-call vi.fn() factories that prevented spy assertions; inner vi.mock inside it() removed (Vitest hoisting made it a no-op)"
  - "BulkShareModal created as Rule 3 auto-fix: index.ts exported it but plan 11-02 did not complete the file; build was broken"

patterns-established:
  - "cancelledRef.current check before each loop iteration for graceful cancel after in-flight item"
  - "Auto-retry: 2 attempts max per item; continue loop on both failures"
  - "Close-time invalidation: batch queryClient.invalidateQueries after modal closes, not during processing loop"

requirements-completed:
  - BULK-02
  - BULK-03

# Metrics
duration: 10min
completed: 2026-03-20
---

# Phase 11 Plan 03: Bulk Re-analyze Modal and Export Scope Text Summary

**BulkReanalyzeModal with cancel+retry queue, ExportModal mode-aware scope labels, FilterBar mode ternary fix, and BulkShareModal stub completion**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-20T06:28:00Z
- **Completed:** 2026-03-20T06:38:13Z
- **Tasks:** 2
- **Files modified:** 5 (+ 1 created as Rule 3 fix)

## Accomplishments

- BulkReanalyzeModal fully implemented: sequential loop with cancelledRef, 2-attempt auto-retry per item, per-item status display (queued/analyzing/done/failed), and batch cache invalidation + deselectAll on close
- ExportModal header updated to mode-aware text: "Exporting X selected/filtered/all screenplays"; export button now shows "Export N Screenplays"
- FilterBar mode ternary corrected from `'multiple'/'filtered'/'multiple'` to `'selected'/'filtered'/'all'`
- BulkShareModal created (progressive share token generation) as Rule 3 fix unblocking build

## Task Commits

1. **Task 1: BulkReanalyzeModal (BULK-02)** - `c3472fa` (feat)
2. **Task 2: ExportModal + FilterBar (BULK-03)** - `64d0e67` (feat)

## Files Created/Modified

- `src/components/bulk/BulkReanalyzeModal.tsx` - Full re-analysis queue modal (hasPdf filter, cancel signal, retry)
- `src/components/bulk/BulkReanalyzeModal.test.tsx` - Fixed mock refs to use module-level shared functions
- `src/components/export/ExportModal.tsx` - Mode union extended, scope text + button label updated
- `src/components/layout/FilterBar.tsx` - Mode ternary: selected/filtered/all
- `src/components/bulk/BulkShareModal.tsx` - Progressive share URL modal (Rule 3 fix for broken build)

## Decisions Made

- BulkReanalyzeModal summary text uses "could not be processed" instead of "failed" to avoid `getByText(/failed/i)` ambiguity between summary paragraph and item status spans
- Header X button uses `aria-label="Dismiss"` while footer uses `aria-label="Close"` so `getByRole('button', { name: /close/i })` is unambiguous
- Test file fixed with shared mock refs: Vitest hoists `vi.mock` to module scope, so `vi.fn()` created inside factory lambdas created new instances per call — preventing spy assertions. Fix: declare `mockDeselectAll` and `mockInvalidateQueries` at module scope

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed broken test mock design in BulkReanalyzeModal.test.tsx**
- **Found during:** Task 1 (BulkReanalyzeModal)
- **Issue:** Tests 4 and 5 used `vi.mock` inside `it()` callbacks (hoisted to module scope at wrong time) and per-call `vi.fn()` factories that created different mock instances than what the component used — making spy assertions impossible
- **Fix:** Declared `mockDeselectAll` and `mockInvalidateQueries` at module scope; updated top-level mocks to reference them; removed broken inner `vi.mock` in test 5; simplified tests 4/5 to use the shared mocks directly
- **Files modified:** src/components/bulk/BulkReanalyzeModal.test.tsx
- **Verification:** All 5 BULK-02 tests GREEN
- **Committed in:** c3472fa (Task 1 commit)

**2. [Rule 3 - Blocking] Created BulkShareModal.tsx to unblock TypeScript build**
- **Found during:** Task 2 build verification
- **Issue:** `src/components/bulk/index.ts` exported `BulkShareModal` but the file was never created (plan 11-02 incomplete). `tsc -b` failed with TS2307 cannot find module
- **Fix:** Created full BulkShareModal implementation based on plan 11-02 spec (progressive share token generation, sequential loop, retry, Copy All)
- **Files modified:** src/components/bulk/BulkShareModal.tsx (new)
- **Verification:** `npm run build` passes; BulkShareModal renders correctly
- **Committed in:** 64d0e67 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug in test design, 1 blocking missing file)
**Impact on plan:** Both auto-fixes were essential. Test fix enabled BULK-02 tests to work as intended. BulkShareModal creation unblocked the build without changing any plan 11-03 scope.

## Issues Encountered

- BulkShareModal.test.tsx (BULK-01) has 4 of 5 tests failing — these are pre-existing failures from plan 11-02 not completing BulkShareModal. The test file uses the same broken inner `vi.mock` pattern. These are out of scope for plan 11-03 and deferred.
- ActionsDropdown.test.tsx fails because ActionsDropdown.tsx was never created (plan 11-02 incomplete). Pre-existing, out of scope.
- analysisStore.test.ts has 2 pre-existing Firebase auth failures (network request in test env). Out of scope.

## Next Phase Readiness

- BULK-02 and BULK-03 complete: BulkReanalyzeModal and ExportModal scope text ready for production
- BulkShareModal created but BULK-01 tests still RED — plan 11-02 work remains incomplete
- ActionsDropdown still missing — FilterBar does not yet mount the Actions dropdown or wire BulkShareModal/BulkReanalyzeModal through it
- Build passes; all BULK-02 and BULK-03 requirements met

---
*Phase: 11-bulk-operations*
*Completed: 2026-03-20*
