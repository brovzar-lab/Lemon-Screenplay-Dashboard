---
phase: 05-share-token-generation
plan: 01
subsystem: api
tags: [firestore, zustand, crypto, share-tokens, uuid]

requires:
  - phase: 01-firestore-security-hardening
    provides: shared_views collection rules and authReady gate
  - phase: 04-ux-polish-scaffolding
    provides: toast store pattern for ephemeral Zustand stores
provides:
  - shareService.ts with Firestore CRUD for shared_views collection
  - shareStore.ts with ephemeral session cache for active share tokens
  - toDocId exported from analysisStore for reuse
affects: [05-02, 06-partner-shared-view]

tech-stack:
  added: []
  patterns: [authReady-gated service functions, ephemeral Zustand store for session cache]

key-files:
  created: [src/lib/shareService.ts, src/stores/shareStore.ts, src/lib/shareService.test.ts, src/stores/shareStore.test.ts]
  modified: [src/lib/analysisStore.ts]

key-decisions:
  - "revokeShareToken accepts both token and screenplayId params to avoid extra query for cache invalidation"
  - "shareStore is ephemeral (no persist middleware) matching syncStatusStore/toastStore pattern"

patterns-established:
  - "Service-level cache invalidation: shareService calls shareStore.removeToken directly on revoke"

requirements-completed: [SHARE-01]

duration: 2min
completed: 2026-03-14
---

# Phase 5 Plan 1: Share Token Generation Summary

**Firestore CRUD service for shared_views collection with crypto.randomUUID tokens and ephemeral Zustand session cache**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-14T05:58:59Z
- **Completed:** 2026-03-14T06:00:46Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments
- shareService.ts with createShareToken, revokeShareToken, getExistingShareToken, getAllSharedViews, isScreenplaySynced
- shareStore.ts with ephemeral session cache keyed by screenplayId
- Exported toDocId from analysisStore for sync-check reuse
- 13 tests passing across both test files

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests** - `22bc89e` (test)
2. **Task 1 (GREEN): Implementation** - `59314e3` (feat)

## Files Created/Modified
- `src/lib/shareService.ts` - Firestore CRUD for shared_views (create, revoke, lookup, sync-check)
- `src/stores/shareStore.ts` - Ephemeral Zustand store caching active tokens per session
- `src/lib/shareService.test.ts` - 8 unit tests for all service functions
- `src/stores/shareStore.test.ts` - 5 unit tests for store actions
- `src/lib/analysisStore.ts` - Exported toDocId function (was private)

## Decisions Made
- revokeShareToken accepts both token and screenplayId as params so the caller provides both, avoiding an extra Firestore query just to find the screenplayId for cache invalidation
- shareStore follows the ephemeral pattern (no persist middleware) matching syncStatusStore and toastStore

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Service layer ready for Plan 02 (UI integration with share button, popover, and settings page)
- shareService exports all functions needed by the UI layer
- shareStore provides session cache for the share popover component

## Self-Check: PASSED

- FOUND: src/lib/shareService.ts
- FOUND: src/stores/shareStore.ts
- FOUND: src/lib/shareService.test.ts
- FOUND: src/stores/shareStore.test.ts
- FOUND: commit 22bc89e (test RED)
- FOUND: commit 59314e3 (feat GREEN)
- VERIFIED: toDocId exported from analysisStore.ts

---
*Phase: 05-share-token-generation*
*Completed: 2026-03-14*
