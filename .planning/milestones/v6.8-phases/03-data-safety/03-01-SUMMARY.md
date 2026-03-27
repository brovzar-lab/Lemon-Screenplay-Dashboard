---
phase: 03-data-safety
plan: 01
subsystem: database
tags: [firestore, soft-delete, quarantine, data-safety, localStorage]

# Dependency graph
requires:
  - phase: 01-firestore-security-hardening
    provides: anonymous auth and Firestore security rules
provides:
  - softDeleteAnalysis, softDeleteMultipleAnalyses, softDeleteAllAnalyses functions
  - restoreAnalysis function for recovery UI
  - getDeletedAnalyses function for recovery UI
  - quarantineAnalysis function for type-guard failure handling
  - _unrecognized_analyses Firestore collection with auth rules
affects: [03-data-safety plan 02 recovery UI, any future delete operations]

# Tech tracking
tech-stack:
  added: []
  patterns: [soft-delete with _deleted_at timestamp, quarantine collection pattern]

key-files:
  created: []
  modified:
    - src/lib/analysisStore.ts
    - src/lib/analysisStore.test.ts
    - src/lib/api.ts
    - firestore.rules

key-decisions:
  - "Old removeAnalysis/removeMultipleAnalyses/clearAllAnalyses kept as deprecated aliases to soft-delete versions for backward compatibility"
  - "Quarantine copies full raw document to _unrecognized_analyses with _quarantined_at, _quarantine_reason, _original_collection metadata"
  - "_deleted_at preserved through backgroundFirestoreSync round-trips (not stripped like _savedAt/_docId)"
  - "getDeletedAnalyses uses 30-day sliding window from localStorage (no Firestore query needed)"

patterns-established:
  - "Soft-delete pattern: _deleted_at ISO timestamp field, filtered out in loadAllAnalyses, restorable via deleteField()"
  - "Quarantine pattern: copy to _unrecognized_analyses with metadata, then delete from source collection"

requirements-completed: [SYNC-03, SYNC-04]

# Metrics
duration: 5min
completed: 2026-03-14
---

# Phase 3 Plan 01: Soft-Delete and Quarantine Core Summary

**Soft-delete with _deleted_at timestamps replacing all destructive deletes, plus quarantine-to-_unrecognized_analyses for type-guard failures**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-14T02:27:12Z
- **Completed:** 2026-03-14T02:32:06Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- All three delete functions (removeAnalysis, removeMultipleAnalyses, clearAllAnalyses) now set _deleted_at instead of destroying data
- restoreAnalysis and getDeletedAnalyses exported for Plan 02's recovery UI
- quarantineAnalysis moves type-guard failures to _unrecognized_analyses with full metadata
- backgroundFirestoreSync preserves _deleted_at through round-trips
- loadAllAnalyses filters out soft-deleted items from the main view
- Firestore rules allow authenticated access to _unrecognized_analyses

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for soft-delete/quarantine** - `1067e92` (test)
2. **Task 1 (GREEN): Implement soft-delete, restore, getDeleted, quarantine** - `6c90313` (feat)
3. **Task 2: Replace destructive deletes in api.ts + firestore rules** - `ee05dcf` (feat)

_TDD task had RED and GREEN commits._

## Files Created/Modified
- `src/lib/analysisStore.ts` - Added softDeleteAnalysis, softDeleteMultipleAnalyses, softDeleteAllAnalyses, restoreAnalysis, getDeletedAnalyses, quarantineAnalysis; updated backgroundFirestoreSync and loadAllAnalyses
- `src/lib/analysisStore.test.ts` - Added 8 new tests for soft-delete, restore, getDeleted, quarantine, and sync preservation
- `src/lib/api.ts` - Replaced removeAnalysis imports/calls with quarantineAnalysis
- `firestore.rules` - Added _unrecognized_analyses collection rule

## Decisions Made
- Old removeAnalysis/removeMultipleAnalyses/clearAllAnalyses kept as deprecated `const` aliases pointing to soft-delete versions -- ensures backward compat with useScreenplays hook and DataManagement component without changing their imports
- getDeletedAnalyses reads from localStorage only (synchronous, no Firestore query) since backgroundFirestoreSync already keeps localStorage in sync with Firestore
- Quarantine stores _original_collection metadata alongside _quarantined_at and _quarantine_reason for potential future automated recovery

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ESLint no-unused-vars on destructured _deleted_at**
- **Found during:** Task 2 (lint verification)
- **Issue:** `const { _deleted_at: _, ...rest } = a` triggered @typescript-eslint/no-unused-vars
- **Fix:** Renamed to `_discarded` with eslint-disable comment
- **Files modified:** src/lib/analysisStore.ts
- **Verification:** npm run lint passes
- **Committed in:** ee05dcf (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor lint fix, no scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Soft-delete and quarantine data layer complete, ready for Plan 02's recovery UI
- All exported functions (softDeleteAnalysis, restoreAnalysis, getDeletedAnalyses, quarantineAnalysis) available for UI consumption

---
*Phase: 03-data-safety*
*Completed: 2026-03-14*
