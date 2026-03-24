---
phase: 10-virtual-scrolling-performance
plan: "02"
subsystem: screenplay-grid
tags: [virtualization, performance, react-virtual, animation, accessibility]
dependency_graph:
  requires: [10-01]
  provides: [virtualized-screenplay-grid, card-enter-animation]
  affects: [src/components/screenplay/ScreenplayGrid.tsx, src/styles/animations.css]
tech_stack:
  added: ["@tanstack/react-virtual useWindowVirtualizer", "ResizeObserver for column tracking"]
  patterns: ["row-based virtualization", "window scroll virtualizer", "CSS fade-in replacing IntersectionObserver"]
key_files:
  created: []
  modified:
    - src/components/screenplay/ScreenplayGrid.tsx
    - src/styles/animations.css
  deleted:
    - src/hooks/useScrollReveal.ts
decisions:
  - "useWindowVirtualizer (not useVirtualizer) chosen because page uses window scroll (min-h-screen flex, no bounded container)"
  - "scrollMargin set from containerRef.current?.offsetTop to correctly offset row translateY for window-relative positions"
  - "One ErrorBoundary per row (not per card) — acceptable per RESEARCH.md, reduces component tree depth"
  - "columns tracked via ResizeObserver state instead of getComputedStyle().gridTemplateColumns — works with absolute-positioned row layout that has no CSS grid"
  - "card-enter uses 100ms ease-out opacity fade — simpler than old 600ms slide-up-fade, no stagger delay in virtual rows"
  - "role=list, role=listitem, aria-label removed from card wrappers per CONTEXT.md ARIA decision (locked)"
metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_modified: 2
  files_deleted: 1
  completed_date: "2026-03-19"
requirements_fulfilled: [PERF-01]
---

# Phase 10 Plan 02: Virtual Scrolling — ScreenplayGrid Rewrite Summary

**One-liner:** Row-based windowed virtualization via useWindowVirtualizer replaces flat map rendering, capping DOM card count to ~3×columns at any time regardless of screenplay count.

## What Was Built

Replaced the flat `screenplays.map()` loop in `ScreenplayGrid.tsx` with `useWindowVirtualizer` from `@tanstack/react-virtual`. The grid now renders only the visible rows plus 3 overscan rows, keeping DOM node count proportional to viewport size regardless of total screenplay count.

### Key implementation choices

**useWindowVirtualizer** (not `useVirtualizer`): The page uses window scroll (`min-h-screen flex flex-col`), so no bounded scroll container exists. `useWindowVirtualizer` works directly with `window.scrollY` and requires a `scrollMargin` equal to the container's `offsetTop` so that row `translateY` values are computed relative to the container origin.

**ResizeObserver column tracking**: The new row-based layout uses absolute positioning (no CSS grid), so `window.getComputedStyle().gridTemplateColumns` is no longer available. Column count is tracked in state via a `ResizeObserver` on the container div, using the same `getColumnCount(width)` breakpoints as the original Tailwind responsive grid.

**card-enter CSS class**: Replaced `useScrollReveal` IntersectionObserver with a simple `.card-enter { animation: card-fade-in 100ms ease-out both }` CSS class. All cards in a rendered row fade in simultaneously with no stagger delay.

**One ErrorBoundary per row**: Wraps the entire row div rather than each individual card. This reduces component tree depth while still containing any card-level render errors.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add card-enter CSS fade class | 75cfd08 | src/styles/animations.css |
| 2 | Rewrite ScreenplayGrid + delete useScrollReveal | 29ab1f9 | src/components/screenplay/ScreenplayGrid.tsx, src/hooks/useScrollReveal.ts (deleted) |

## Verification Results

```
npm run test:run src/components/screenplay/ScreenplayGrid.test.tsx
  9/9 tests pass — including "renders at most 80 DOM elements with 100 screenplay items" (now GREEN)

npm run build
  Build succeeded (TypeScript strict, no errors)

grep -r "useScrollReveal" src/ --include="*.ts" --include="*.tsx"
  (no results — hook fully removed)

grep -r "data-reveal" src/ --include="*.ts" --include="*.tsx"
  (no results — all data-reveal attributes removed)

grep -n "useWindowVirtualizer" src/components/screenplay/ScreenplayGrid.tsx
  line 9: import { useWindowVirtualizer } from '@tanstack/react-virtual';
  line 172: const rowVirtualizer = useWindowVirtualizer({
```

## Success Criteria Check

- [x] ScreenplayGrid renders only visible rows — DOM count test passes (<=80 with 100 items)
- [x] useScrollReveal.ts deleted; no data-reveal or data-revealed in ScreenplayGrid.tsx
- [x] Cards have .card-enter class — 100ms fade-in animation on mount
- [x] Enter key on focused card calls onCardClick — test passes
- [x] tabIndex={0} preserved on every card wrapper — confirmed in source
- [x] `npm run build` and `npm run test:run` both pass

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files exist:
- src/components/screenplay/ScreenplayGrid.tsx: FOUND
- src/styles/animations.css: FOUND
- src/hooks/useScrollReveal.ts: DELETED (confirmed)

Commits exist:
- 75cfd08: FOUND
- 29ab1f9: FOUND
