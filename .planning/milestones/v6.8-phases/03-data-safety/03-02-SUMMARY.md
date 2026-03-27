---
phase: 03-data-safety
plan: 02
subsystem: ui
tags: [react, zustand, react-query, soft-delete, restore, data-recovery, settings]

# Dependency graph
requires:
  - phase: 03-data-safety plan 01
    provides: softDeleteAnalysis, restoreAnalysis, getDeletedAnalyses, softDeleteAllAnalyses functions
provides:
  - useDeletedScreenplays hook for fetching soft-deleted items
  - useRestoreScreenplay mutation hook with optimistic updates
  - Recently Deleted recovery section in Settings > Data tab
  - Quarantine info banner in Settings > Data tab
  - Delete All Screenplays converted to soft-delete
affects: [any future data management UI, settings page extensions]

# Tech tracking
tech-stack:
  added: []
  patterns: [optimistic mutation updates with React Query, success banner with auto-dismiss]

key-files:
  created: []
  modified:
    - src/hooks/useScreenplays.ts
    - src/components/settings/DataManagement.tsx
    - src/components/ui/DeleteConfirmDialog.tsx
    - src/components/screenplay/ScreenplayCard.tsx
    - src/lib/analysisStore.ts

key-decisions:
  - "Optimistic update on restore removes item from deleted list immediately before server confirms"
  - "Green success banner auto-dismisses after 3 seconds showing restored screenplay name"
  - "Delete confirmation dialog updated to say 'recoverable within 30 days' reflecting soft-delete behavior"
  - "authReady moved inside try-catch blocks so Firestore auth failures never block localStorage operations"

patterns-established:
  - "Optimistic mutation pattern: setQueryData to remove item, onSettled invalidates for server truth"
  - "Success feedback pattern: temporary green banner with auto-dismiss via setTimeout"

requirements-completed: [SYNC-03, SYNC-04]

# Metrics
duration: 8min
completed: 2026-03-14
---

# Phase 3 Plan 02: Recovery UI and Quarantine Visibility Summary

**Recently Deleted recovery section in Settings with one-click restore, optimistic UI updates, and quarantine info banner**

## Performance

- **Duration:** 8 min (across two sessions with human checkpoint)
- **Started:** 2026-03-14T02:35:00Z
- **Completed:** 2026-03-14T04:25:12Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Producer can see recently deleted screenplays in Settings > Data tab with count badge and collapsible list
- One-click restore with optimistic update (item disappears instantly, success banner confirms)
- Delete All Screenplays now uses soft-delete (recoverable within 30 days)
- Quarantine info banner shows when unrecognized documents have been quarantined
- Delete confirmation dialogs updated to reflect recoverability

## Task Commits

Each task was committed atomically:

1. **Task 1: Add useDeletedScreenplays and useRestoreScreenplay hooks** - `d730018` (feat)
2. **Task 2: Add Recently Deleted section and quarantine banner** - `f30ccc0` (feat)
3. **Task 3: Visual verification (human checkpoint)** - `451daf4` (fix - post-verification improvements)

## Files Created/Modified
- `src/hooks/useScreenplays.ts` - Added useDeletedScreenplays query hook, useRestoreScreenplay mutation with optimistic updates, DELETED_SCREENPLAYS_QUERY_KEY invalidation on bulk delete
- `src/components/settings/DataManagement.tsx` - Added Recently Deleted section with restore buttons, quarantine info banner, green success banner on restore
- `src/components/ui/DeleteConfirmDialog.tsx` - Updated confirmation text from "cannot be undone" to "recoverable within 30 days"
- `src/components/screenplay/ScreenplayCard.tsx` - Updated delete message to mention Settings > Data recovery
- `src/lib/analysisStore.ts` - Moved authReady inside try-catch to prevent Firestore errors from blocking localStorage success path

## Decisions Made
- Optimistic update pattern chosen for restore to give instant feedback without waiting for Firestore round-trip
- Success banner auto-dismisses after 3 seconds to avoid visual clutter
- Delete confirmation dialog text updated to accurately reflect soft-delete behavior (was saying "cannot be undone" which was now false)
- authReady calls moved inside try-catch blocks so Firestore connectivity issues never prevent localStorage operations from succeeding

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Delete confirmation dialog showed incorrect "cannot be undone" text**
- **Found during:** Task 3 (human verification)
- **Issue:** DeleteConfirmDialog and ScreenplayCard still said deletion "cannot be undone" even though soft-delete makes it recoverable
- **Fix:** Updated text to "recoverable within 30 days" and mention Settings > Data recovery
- **Files modified:** src/components/ui/DeleteConfirmDialog.tsx, src/components/screenplay/ScreenplayCard.tsx
- **Verification:** Human verified corrected text in running app
- **Committed in:** 451daf4

**2. [Rule 1 - Bug] Restore had no optimistic update, causing delayed UI feedback**
- **Found during:** Task 3 (human verification)
- **Issue:** After clicking restore, the deleted item stayed in the list until React Query refetched
- **Fix:** Added optimistic update via setQueryData to remove item immediately, onSettled invalidates for server truth
- **Files modified:** src/hooks/useScreenplays.ts
- **Verification:** Human verified instant removal from deleted list
- **Committed in:** 451daf4

**3. [Rule 1 - Bug] No success indicator after restore**
- **Found during:** Task 3 (human verification)
- **Issue:** User had no confirmation that restore succeeded
- **Fix:** Added green success banner showing "[title] restored to dashboard" for 3 seconds
- **Files modified:** src/components/settings/DataManagement.tsx
- **Verification:** Human verified banner appears and auto-dismisses
- **Committed in:** 451daf4

**4. [Rule 1 - Bug] authReady could throw and block localStorage operations**
- **Found during:** Task 3 (human verification)
- **Issue:** await authReady outside try-catch meant Firestore auth failures would prevent the localStorage write from being the success path
- **Fix:** Moved authReady inside try-catch blocks in saveAnalysis, softDeleteAnalysis, softDeleteAllAnalyses, softDeleteMultipleAnalyses
- **Files modified:** src/lib/analysisStore.ts
- **Verification:** Build passes, localStorage operations succeed regardless of Firestore state
- **Committed in:** 451daf4

---

**Total deviations:** 4 auto-fixed (4 bugs found during human verification)
**Impact on plan:** All fixes improve correctness and UX. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data safety feature complete: soft-delete core (Plan 01) + recovery UI (Plan 02)
- Phase 03 fully complete, ready for Phase 04
- All delete operations are now recoverable within 30 days
- Quarantine system operational for unrecognized data formats

---
*Phase: 03-data-safety*
*Completed: 2026-03-14*
