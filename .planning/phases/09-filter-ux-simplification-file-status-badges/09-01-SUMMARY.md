---
phase: 09-filter-ux-simplification-file-status-badges
plan: 01
subsystem: testing
tags: [vitest, testing-library, react, zustand, tdd, wave-0]

# Dependency graph
requires: []
provides:
  - FilterPanel.test.tsx updated: inverted default-section, Advanced disclosure, auto-expand assertions (RED)
  - FilterBar.test.tsx created: Filters badge count and Missing PDF chip assertions (RED)
  - ScreenplayCard.test.tsx updated: PDF status badge and legacy version badge assertions (RED)
affects:
  - 09-02 (FilterPanel implementation — must make FilterPanel tests GREEN)
  - 09-03 (FilterBar + ScreenplayCard implementation — must make FilterBar and ScreenplayCard tests GREEN)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "usePdfStatusStore mocked with per-test state override via let mockPdfState = {...}; usePdfStatusStore intercepts selector"
    - "useFilterStore mocked via let mockFilterState = {...}; (selector) => selector(mockFilterState) for FilterBar tests"
    - "FilterPanel tests use useFilterStore.setState() directly (Zustand real store) for integration-style assertions"

key-files:
  created:
    - src/components/layout/FilterBar.test.tsx
  modified:
    - src/components/filters/FilterPanel.test.tsx
    - src/components/screenplay/ScreenplayCard.test.tsx

key-decisions:
  - "FilterPanel tests use real Zustand store (useFilterStore.setState) — not mocked — matching existing test pattern"
  - "FilterBar tests use selector-intercepting mock pattern: (selector) => selector(mockFilterState) because FilterBar uses useFilterStore((s) => s.field) selectors"
  - "ScreenplayCard tests add pdfStatusStore mock alongside existing comparisonStore mock — per-test override via mockPdfState reassignment in beforeEach"
  - "Advanced disclosure tests open Dimension Scores section first then look for Advanced button — tests expect dimension sliders hidden until Advanced clicked"
  - "Auto-expand tests pre-set store state before render to verify component initializes with correct section open"

patterns-established:
  - "Wave 0 TDD pattern: write all failing tests first across multiple files before any implementation runs"
  - "usePdfStatusStore mock: let mockPdfState with beforeEach reset; selector intercepted via closure"

requirements-completed:
  - FILTER-01
  - FILTER-02
  - FILTER-03
  - FILTER-04
  - FILE-01
  - FILE-02
  - FILE-03

# Metrics
duration: 12min
completed: 2026-03-18
---

# Phase 9 Plan 01: Wave 0 Test Scaffolding Summary

**TDD wave-0 scaffold: 18 new failing assertions across 3 test files covering filter UX simplification and file status badge behaviors**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-18T22:34:00Z
- **Completed:** 2026-03-18T22:37:30Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 updated)

## Accomplishments
- Updated FilterPanel.test.tsx: inverted 3 default-section assertions + added Advanced disclosure describe block + auto-expand describe block (8 tests RED)
- Created FilterBar.test.tsx from scratch: Filters button badge count + Missing PDF chip describe blocks (4 tests RED, 2 correctly pass as negative assertions)
- Updated ScreenplayCard.test.tsx: PDF status badge describe block (5 tests) + Legacy version badge describe block (5 tests) — all 6 new positive assertions RED

## Task Commits

Each task was committed atomically:

1. **Task 1: Update FilterPanel.test.tsx** - `67d656a` (test)
2. **Task 2: Create FilterBar.test.tsx** - `90570cf` (test)
3. **Task 3: Update ScreenplayCard.test.tsx** - `162e504` (test)

**Plan metadata:** _(final docs commit follows)_

## Files Created/Modified
- `src/components/filters/FilterPanel.test.tsx` - Inverted default section (Genre & Theme open, Core Scores closed), Advanced disclosure block, auto-expand block
- `src/components/layout/FilterBar.test.tsx` - New file: Filters badge (FILTER-03) and Missing PDF chip (FILE-03) tests
- `src/components/screenplay/ScreenplayCard.test.tsx` - PDF status badge (FILE-01) and Legacy version badge (FILE-02) tests

## Decisions Made
- FilterPanel tests use real Zustand store (useFilterStore.setState) matching existing test pattern — no need to switch to selector-intercepting mock
- FilterBar tests require selector-intercepting mock because FilterBar calls useFilterStore((s) => s.field) — the store's selector API must be intercepted
- ScreenplayCard tests add usePdfStatusStore mock using the same selector-intercepting pattern as FilterBar
- Advanced disclosure tests assert sliders hidden before Advanced button click — behavior specification for Plan 02's disclosure implementation
- Auto-expand tests use useFilterStore.setState to pre-configure active filters before render — mirrors how FilterPanel will read store on mount

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
- All Wave 0 test scaffolding complete and RED — Plans 02 and 03 can begin implementation
- FilterPanel implementation (Plan 02) must: change default activeSection from 'scores' to 'genre', add Advanced disclosure toggle, add auto-expand logic on mount
- FilterBar + ScreenplayCard implementation (Plan 03) must: add Filters badge counting active dimension ranges, add Missing PDF chip, add PDF status and Legacy version badges to ScreenplayCard
- Build passes (TypeScript unaffected by test-only changes)

---
*Phase: 09-filter-ux-simplification-file-status-badges*
*Completed: 2026-03-18*
