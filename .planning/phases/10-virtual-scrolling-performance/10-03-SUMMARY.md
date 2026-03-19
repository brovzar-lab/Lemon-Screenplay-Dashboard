---
phase: 10-virtual-scrolling-performance
plan: "03"
subsystem: ui
tags: [zustand, react, usememo, performance, shallow-comparison]

requires:
  - phase: 10-01
    provides: failing memoization test establishing PERF-02 requirement
provides:
  - Fine-grained Zustand filter subscriptions using useShallow in useFilteredScreenplays
  - Stable filteredScreenplays reference when no filter field actually changed
affects:
  - Any phase modifying useFilteredScreenplays or filterStore

tech-stack:
  added: []
  patterns:
    - "useShallow(s => s) pattern for whole-store Zustand subscriptions — stable reference via shallow comparison"

key-files:
  created: []
  modified:
    - src/hooks/useFilteredScreenplays.ts
    - src/hooks/useFilteredScreenplays.test.ts

key-decisions:
  - "useShallow(s => s) replaces bare useFilterStore() at both call sites — memo result reference is stable when no top-level filter field value changed"
  - "vi.mock must be at module scope for Vitest hoisting; vi.mocked + mockReturnValue in beforeEach for dynamic control"

patterns-established:
  - "Whole-store Zustand subscriptions: always use useShallow(s => s) to prevent spurious re-renders when unrelated fields change"

requirements-completed:
  - PERF-02

duration: 15min
completed: 2026-03-19
---

# Phase 10 Plan 03: useShallow filter subscription fix Summary

**Replaced bare useFilterStore() with useShallow(s => s) at both call sites in useFilteredScreenplays.ts — filteredScreenplays useMemo result reference is now stable when no filter field actually changed**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-19T03:15:00Z
- **Completed:** 2026-03-19T03:17:35Z
- **Tasks:** 1 of 1
- **Files modified:** 2

## Accomplishments
- Applied `useShallow` from `zustand/shallow` to both `useFilterStore()` call sites — `useFilteredScreenplays` and `useHasActiveFilters`
- Eliminated spurious `filteredScreenplays` useMemo re-runs caused by whole-store Zustand subscription creating new object references on every setState
- Fixed broken `vi.mock` placement in memoization test (was inside `it()` body, not hoisted) — moved to module scope with `vi.mocked` + `mockReturnValue` in `beforeEach`
- All 57 tests pass; memoization test turned GREEN; full build passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply useShallow to filter store subscriptions** - `e7e9332` (feat)

**Plan metadata:** (docs commit — see final commit below)

## Files Created/Modified
- `src/hooks/useFilteredScreenplays.ts` - Added `useShallow` import; replaced `useFilterStore()` with `useFilterStore(useShallow(s => s))` in both hooks
- `src/hooks/useFilteredScreenplays.test.ts` - Moved `vi.mock` to module scope; updated memoization test to use `vi.mocked` in `beforeEach`

## Decisions Made
- `useShallow(s => s)` is the correct Zustand 5 pattern for subscribing to the full store with shallow comparison — it returns a stable reference when no top-level field value changed (by reference for objects, by value for primitives)
- `vi.mock` must be at module scope so Vitest can hoist it before imports execute — calling it inside `it()` is a no-op for module-level mocking

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed broken vi.mock placement in memoization test**
- **Found during:** Task 1 (applying useShallow, then running tests)
- **Issue:** The plan's memoization test called `vi.mock('@/hooks/useScreenplays', ...)` inside the `it()` body. Vitest hoists `vi.mock` calls to run before imports, but only when at module scope — calling inside a test function is a no-op, so `useScreenplays` was never mocked, returning `undefined` data, causing a new `[]` reference every render and a false `toBe` failure
- **Fix:** Moved `vi.mock` to module scope with a `vi.fn()` factory; replaced inline mock factory with `vi.mocked(useScreenplays).mockReturnValue(...)` in the `beforeEach` block
- **Files modified:** src/hooks/useFilteredScreenplays.test.ts
- **Verification:** Memoization test turned GREEN; all 57 tests pass
- **Committed in:** e7e9332 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in test infrastructure)
**Impact on plan:** Required fix — without correct mock hoisting the memoization test cannot verify the useShallow behavior. No scope creep.

## Issues Encountered
- The `vi.mock` hoisting issue was the only problem. Once the mock was at module scope, `useShallow` made the memoization test pass immediately on first try.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PERF-02 complete — filter subscription memoization is now correct
- useFilteredScreenplays is ready for Phase 10-04 (virtual grid integration) or further performance work
- Pre-existing failures in `src/lib/analysisStore.test.ts` (2 tests) are unrelated to this change and were present before this plan

## Self-Check: PASSED
- src/hooks/useFilteredScreenplays.ts: FOUND
- src/hooks/useFilteredScreenplays.test.ts: FOUND
- .planning/phases/10-virtual-scrolling-performance/10-03-SUMMARY.md: FOUND
- Commit e7e9332: FOUND

---
*Phase: 10-virtual-scrolling-performance*
*Completed: 2026-03-19*
