---
phase: 10-virtual-scrolling-performance
plan: "01"
subsystem: testing
tags: [virtual-scrolling, tdd, scaffolding, performance]
dependency_graph:
  requires: []
  provides:
    - "@tanstack/react-virtual in package.json"
    - "ScreenplayGrid test suite updated for Wave 2 DOM structure"
    - "useFilteredScreenplays memoization regression test (RED)"
  affects:
    - "src/components/screenplay/ScreenplayGrid.tsx (Wave 2 target)"
    - "src/hooks/useFilteredScreenplays.ts (Wave 3 target)"
tech_stack:
  added:
    - "@tanstack/react-virtual@^3.13.23"
  patterns:
    - "TDD RED state scaffolding before production code changes"
    - "data-card attribute query replacing role=listitem for virtualization compat"
    - "renderHook + act for Zustand hook memoization testing"
key_files:
  created: []
  modified:
    - "src/components/screenplay/ScreenplayGrid.test.tsx"
    - "src/hooks/useFilteredScreenplays.test.ts"
    - "package.json"
    - "package-lock.json"
decisions:
  - "Removed role=list and role=listitem ARIA tests — Wave 2 removes these roles; data-card attribute is the stable query point"
  - "Memoization test uses toBe (Object.is identity) not toStrictEqual — referential stability is what PERF-02 requires"
  - "vi.mock scoped inside describe block for useScreenplays mock — avoids contaminating pure-function test suite"
metrics:
  duration: "129s"
  completed: "2026-03-19"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 4
---

# Phase 10 Plan 01: Wave 0 Scaffolding Summary

**One-liner:** TDD RED scaffolding for virtual scrolling — installed @tanstack/react-virtual, updated ScreenplayGrid tests for future DOM structural changes, and added two failing tests that turn GREEN in Plans 02 and 03.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Install @tanstack/react-virtual | db255b5 | package.json, package-lock.json |
| 2 | Update ScreenplayGrid.test.tsx — fix ARIA tests, add DOM count test | a34317a | src/components/screenplay/ScreenplayGrid.test.tsx |
| 3 | Add memoization regression test to useFilteredScreenplays.test.ts | a06d16d | src/hooks/useFilteredScreenplays.test.ts |

## What Was Built

Wave 0 provides the test foundation before any production code changes in Plans 02 and 03.

**Task 1:** Installed `@tanstack/react-virtual@^3.13.23` — the virtual scrolling library that will power PERF-01. No production code references added yet.

**Task 2:** Updated `ScreenplayGrid.test.tsx` with forward-compatible test structure:
- Removed 4 tests using `role="list"` / `role="listitem"` ARIA queries — Wave 2 removes these roles from the DOM
- Updated 3 click/keyboard tests to query via `document.querySelector('[data-card]')` — the `data-card` attribute is preserved through Wave 2's structural changes
- Added RED test: `renders at most 80 DOM elements with 100 screenplay items` — currently renders 100 (no virtualization), will pass at ≤80 after Wave 2

**Task 3:** Added memoization test to `useFilteredScreenplays.test.ts`:
- Added `renderHook`, `act`, `useFilterStore`, and `useFilteredScreenplays` imports
- Added new `describe` block with one RED test: asserts array reference identity after a no-op `useFilterStore.setState({ searchQuery: '' })` call
- Currently fails because `useFilterStore()` whole-store subscription creates a new object on every `setState`, invalidating `useMemo` even when nothing meaningful changed
- Will turn GREEN when Wave 3 applies `useShallow` selector

## Test Results

```
Test Files: 2 failed (2)
Tests:      2 failed | 64 passed (66)
```

The 2 failing tests are intentionally RED:
1. `ScreenplayGrid > renders at most 80 DOM elements with 100 screenplay items` — fails with "expected 100 to be less than or equal to 80"
2. `useFilteredScreenplays memoization > does not re-run sorted result when unrelated filter store field changes` — fails with Object.is equality (reference unstable)

All pre-existing tests pass. `npm run build` passes with no TypeScript errors.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files exist:
- FOUND: src/components/screenplay/ScreenplayGrid.test.tsx
- FOUND: src/hooks/useFilteredScreenplays.test.ts
- FOUND: package.json (contains @tanstack/react-virtual)

Commits exist:
- FOUND: db255b5 (chore: install @tanstack/react-virtual)
- FOUND: a34317a (test: update ScreenplayGrid tests)
- FOUND: a06d16d (test: add memoization regression test)
