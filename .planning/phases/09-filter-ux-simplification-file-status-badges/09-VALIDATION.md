---
phase: 9
slug: filter-ux-simplification-file-status-badges
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react |
| **Config file** | `vite.config.ts` (vitest config inline) |
| **Quick run command** | `npm run test:run -- FilterPanel ScreenplayCard FilterBar` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run -- FilterPanel ScreenplayCard FilterBar`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 0 | FILTER-01, FILTER-02, FILTER-03, FILTER-04 | unit | `npm run test:run -- FilterPanel` | ❌ W0 (update existing) | ⬜ pending |
| 9-01-02 | 01 | 0 | FILTER-03, FILE-03 | unit | `npm run test:run -- FilterBar` | ❌ W0 (create new) | ⬜ pending |
| 9-01-03 | 01 | 0 | FILE-01, FILE-02 | unit | `npm run test:run -- ScreenplayCard` | ❌ W0 (update existing) | ⬜ pending |
| 9-02-01 | 02 | 1 | FILTER-01, FILTER-02, FILTER-04 | unit | `npm run test:run -- FilterPanel` | ✅ | ⬜ pending |
| 9-02-02 | 02 | 1 | FILTER-03 | unit | `npm run test:run -- FilterBar` | ✅ (after W0) | ⬜ pending |
| 9-03-01 | 03 | 2 | FILE-01, FILE-02 | unit | `npm run test:run -- ScreenplayCard` | ✅ | ⬜ pending |
| 9-03-02 | 03 | 2 | FILE-03 | unit | `npm run test:run -- FilterBar` | ✅ (after W0) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/layout/FilterBar.test.tsx` — create new; stubs for FILTER-03 (active dimension count badge) and FILE-03 (Missing PDF chip + count); needs mock setup for `usePdfStatusStore` and `useFilterStore` with dimension-range enabled states
- [ ] `src/components/filters/FilterPanel.test.tsx` — update existing: invert default-section assertions (FILTER-01 → Genre open, Scores closed), add Advanced disclosure tests (FILTER-02), add auto-expand tests (FILTER-04)
- [ ] `src/components/screenplay/ScreenplayCard.test.tsx` — update existing: add PDF badge tests (FILE-01) and legacy version badge tests (FILE-02); mock `usePdfStatusStore`

*All three files must be updated/created before implementation tasks to ensure Nyquist continuity.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sliding chip indicator does NOT move to "Missing PDF" chip | FILE-03 | CSS animation hard to assert in jsdom | Open FilterBar in browser; click "Missing PDF" chip; confirm sliding indicator stays on recommendation chips, not Missing PDF |
| PDF status badge updates live during scan | FILE-01 | Requires real Firebase Storage scan | Trigger scan in Settings > Upload; observe card badges updating in real time |
| Advanced disclosure closes smoothly | FILTER-02 | CSS transition not testable in jsdom | Open FilterPanel; click "Advanced"; observe expansion animation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
