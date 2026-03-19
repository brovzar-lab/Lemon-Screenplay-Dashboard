---
phase: 10
slug: virtual-scrolling-performance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + @testing-library/react 16.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:run -- --reporter=verbose src/components/screenplay/ScreenplayGrid.test.tsx src/hooks/useFilteredScreenplays.test.ts` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run -- src/components/screenplay/ScreenplayGrid.test.tsx src/hooks/useFilteredScreenplays.test.ts`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-W0 | 01 | 0 | PERF-01 | unit | `npm run test:run -- src/components/screenplay/ScreenplayGrid.test.tsx` | ✅ needs updates | ⬜ pending |
| 10-01-W0 | 01 | 0 | PERF-02 | unit | `npm run test:run -- src/hooks/useFilteredScreenplays.test.ts` | ❌ Wave 0 | ⬜ pending |
| 10-01-01 | 01 | 1 | PERF-01 | unit | `npm run test:run -- src/components/screenplay/ScreenplayGrid.test.tsx` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | PERF-01 | unit | `npm run test:run -- src/components/screenplay/ScreenplayGrid.test.tsx` | ✅ | ⬜ pending |
| 10-02-01 | 02 | 2 | PERF-02 | unit | `npm run test:run -- src/hooks/useFilteredScreenplays.test.ts` | ✅ | ⬜ pending |
| 10-02-02 | 02 | 2 | PERF-02 | unit | `npm run test:run -- src/hooks/useFilteredScreenplays.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/screenplay/ScreenplayGrid.test.tsx` — update 4 existing tests that rely on `role="list"`, `role="listitem"`, and `aria-label` structure (will break after virtualization and ARIA removal)
- [ ] `src/components/screenplay/ScreenplayGrid.test.tsx` — add test: "renders ≤80 DOM elements with 100 screenplay items" (PERF-01 proxy)
- [ ] `src/hooks/useFilteredScreenplays.test.ts` — add test: "does not re-run sorted result when unrelated filter store field changes" (PERF-02)
- [ ] `npm install @tanstack/react-virtual` — not yet in package.json

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scroll reveal animation preserved or replaced with equivalent | PERF-01 | Visual/animation behavior, not DOM-assertable | Load 100+ screenplays, scroll through grid, verify cards animate in on first appearance |
| Keyboard navigation (Tab/arrow keys through cards) | PERF-01 | Requires interaction testing beyond unit scope | Tab through first 10 visible cards; confirm focus ring visible and order is correct |
| Long task < 100ms on filter toggle (1000 items) | PERF-02 | DevTools profiler needed for real measurement | Open Chrome Performance tab, toggle a filter with 1000 items loaded, confirm no task > 100ms |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
