---
phase: 02-sync-status-visibility
plan: 02
subsystem: ui
tags: [react, zustand, sync-indicator, retry, header, testing-library]

requires:
  - phase: 02-sync-status-visibility
    provides: syncStatusStore with pendingCount, isRetrying, lastRetryError and startSyncStatusPolling
provides:
  - SyncStatusIndicator component with conditional amber badge in Header
  - useSyncRetry hook wrapping flushPendingWrites with concurrency guard
  - Visual sync status visibility for producers in dashboard header
affects: []

tech-stack:
  added: []
  patterns: [conditional-render indicator pattern, useCallback-memoized retry with concurrency guard]

key-files:
  created:
    - src/components/layout/SyncStatusIndicator.tsx
    - src/components/layout/SyncStatusIndicator.test.tsx
    - src/hooks/useSyncRetry.ts
    - src/hooks/useSyncRetry.test.ts
  modified:
    - src/components/layout/Header.tsx

key-decisions:
  - "useSyncRetry guards against concurrent retries via isRetrying check before flush"
  - "SyncStatusIndicator returns null when no pending writes (zero visual noise during normal operation)"

patterns-established:
  - "Conditional header indicator: render null when inactive, amber pill when active"
  - "Retry hook pattern: useCallback-memoized async with concurrency guard and error capture"

requirements-completed: [SYNC-01, SYNC-02]

duration: 4min
completed: 2026-03-14
---

# Phase 02 Plan 02: Sync Status Indicator Summary

**SyncStatusIndicator component in Header showing pending Firestore write count with useSyncRetry hook for manual retry, hidden when fully synced**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-14T01:27:00Z
- **Completed:** 2026-03-14T01:33:18Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Created useSyncRetry hook with concurrency guard, error capture, and automatic count refresh after flush
- Built SyncStatusIndicator with amber-themed conditional badge showing pending count and Retry Now button
- Wired indicator into Header between StatPills and DevExecToggle
- Full TDD test coverage: hook tests (5) and component tests (8)
- Human-verified visual appearance and functional behavior in running app

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useSyncRetry hook with tests** - `ee5e5d5` (feat)
2. **Task 2: Create SyncStatusIndicator component with tests, wire into Header** - `6934862` (feat)
3. **Task 3: Visual verification of sync status indicator** - human-approved checkpoint (no commit)

_Note: TDD tasks each verified RED (failing) then GREEN (passing) before commit._

## Files Created/Modified
- `src/hooks/useSyncRetry.ts` - Hook wrapping flushPendingWrites with concurrency guard and error state
- `src/hooks/useSyncRetry.test.ts` - 5 unit tests covering retry logic, concurrency guard, error handling
- `src/components/layout/SyncStatusIndicator.tsx` - Conditional amber indicator with pending count and retry button
- `src/components/layout/SyncStatusIndicator.test.tsx` - 8 component tests for all render states
- `src/components/layout/Header.tsx` - Added SyncStatusIndicator mount point

## Decisions Made
- useSyncRetry uses isRetrying guard to prevent concurrent flushPendingWrites calls (Pitfall 2 from RESEARCH.md)
- SyncStatusIndicator returns null when pendingCount=0, isRetrying=false, lastRetryError=null (zero noise)
- Indicator placed after StatPills, before DevExecToggle in Header flex container

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 02 complete -- sync status is fully visible to producers
- Pending write count and manual retry are operational in dashboard header
- Ready for Phase 03

## Self-Check: PASSED

All 6 files verified present. Both task commits (ee5e5d5, 6934862) confirmed in git history.

---
*Phase: 02-sync-status-visibility*
*Completed: 2026-03-14*
