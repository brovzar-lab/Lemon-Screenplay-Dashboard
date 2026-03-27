---
phase: 2
slug: performance-at-scale
created: 2026-03-23
---

# Phase 2: Performance at Scale — Validation Strategy

## Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + Testing Library (React) |
| Config file | vitest.config.ts |
| Quick run command | `npm run test:run` |
| Full suite command | `npm run test:run && npm run build` |

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Status |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | Virtual grid renders only visible rows, not all cards | unit | `npx vitest run src/components/screenplay/ScreenplayGrid.test.tsx -x` | Exists — needs rewrite for virtual grid |
| PERF-01 | Column count matches Tailwind breakpoints | unit | `npx vitest run src/hooks/useColumnCount.test.ts -x` | New (Wave 0) |
| PERF-01 | Back-to-top button appears after scroll threshold | unit | `npx vitest run src/components/screenplay/BackToTopButton.test.tsx -x` | New (Wave 0) |
| PERF-01 | Jump-to-top on filter/sort change | unit | `npx vitest run src/components/screenplay/ScreenplayGrid.test.tsx -x` | Needs new test case |
| PERF-02 | ScreenplayCard is memoized (React.memo) | unit | `npx vitest run src/components/screenplay/ScreenplayCard.test.tsx -x` | Exists — needs memo verification |
| PERF-02 | Filter pipeline stable references | unit | `npx vitest run src/hooks/useFilteredScreenplays.test.ts -x` | Exists — pure functions tested |

## Sampling Rate

- **Per task commit:** `npm run test:run`
- **Per wave merge:** `npm run test:run && npm run build`
- **Phase gate:** Full suite green before verification

## Wave 0 Gaps

- [ ] `src/hooks/useColumnCount.test.ts` — covers PERF-01 responsive column calculation
- [ ] `src/components/screenplay/BackToTopButton.test.tsx` — covers PERF-01 back-to-top behavior
- [ ] Update `src/components/screenplay/ScreenplayGrid.test.tsx` — existing tests reference DOM structure that will change
- [ ] Framework install: `npm install @tanstack/react-virtual` — new dependency
