---
phase: 11-bulk-operations
plan: "01"
subsystem: bulk
tags: [tdd, test-scaffolding, wave-0, red-tests, barrel-export]
dependency_graph:
  requires: []
  provides:
    - src/components/bulk/index.ts
    - src/components/bulk/BulkShareModal.test.tsx
    - src/components/bulk/BulkReanalyzeModal.test.tsx
    - src/components/bulk/BulkReanalyzeModal.tsx
    - src/components/export/ExportModal.test.tsx
    - src/components/filters/ActionsDropdown.test.tsx
  affects:
    - src/components/bulk (future BulkShareModal.tsx, full BulkReanalyzeModal.tsx)
    - src/components/export/ExportModal.tsx (mode prop expansion)
    - src/components/filters/ActionsDropdown.tsx (new component)
tech_stack:
  added: []
  patterns:
    - Vitest hoisting — vi.mock at module scope, not inside it()
    - RED test scaffolding before implementation (Nyquist compliance)
    - Null stub export pattern for parallel wave execution
key_files:
  created:
    - src/components/bulk/index.ts
    - src/components/bulk/BulkShareModal.test.tsx
    - src/components/bulk/BulkReanalyzeModal.test.tsx
    - src/components/bulk/BulkReanalyzeModal.tsx
    - src/components/export/ExportModal.test.tsx
    - src/components/filters/ActionsDropdown.test.tsx
  modified: []
decisions:
  - "BulkReanalyzeModal.tsx is a null stub returning null — plan 11-03 provides the real implementation"
  - "ExportModal BULK-03 tests use 'selected'/'all' modes that don't exist yet in ExportModal.tsx — tests are correctly RED"
  - "analysisStore.test.ts has 2 pre-existing failures (pre-date this plan) — out of scope, deferred"
metrics:
  duration_seconds: 275
  completed_date: "2026-03-20"
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 0
---

# Phase 11 Plan 01: Wave 0 Test Scaffolding + BulkReanalyzeModal Stub Summary

Wave 0 Nyquist scaffolding: 20 RED test cases across 4 test files covering all BULK-01/02/03 and ActionsDropdown behaviors, plus a typed null stub for BulkReanalyzeModal enabling parallel Wave 1 execution without TypeScript errors.

## What Was Built

Six files created:

1. **`src/components/bulk/index.ts`** — Barrel export with forward references to BulkShareModal and BulkReanalyzeModal (modules don't exist yet at Wave 0).

2. **`src/components/bulk/BulkShareModal.test.tsx`** — 5 RED tests for BULK-01: row status rendering, shareStore cache reuse (no duplicate createShareToken), getExistingShareToken + createShareToken call chain, Copy All newline-separated URL format, failed row Retry button.

3. **`src/components/bulk/BulkReanalyzeModal.test.tsx`** — 5 RED tests for BULK-02: hasPdf eligibility filtering with header count, cancel signal stops loop, auto-retry (2 attempts) on failure, React Query invalidation on close, deselectAll on close.

4. **`src/components/bulk/BulkReanalyzeModal.tsx`** — Null stub that exports the named function, accepts the typed props interface (isOpen, onClose, screenplays: Screenplay[]), and returns null. Passes TypeScript strict-mode. Plan 11-03 will replace this.

5. **`src/components/export/ExportModal.test.tsx`** — 4 RED BULK-03 tests: 'selected' mode header text, 'all' mode header text, 'filtered' mode header text, Export button label showing count.

6. **`src/components/filters/ActionsDropdown.test.tsx`** — 6 RED tests: Actions button renders, dropdown opens with both items, outside-click closes, disabled state when reanalyzeEligibleCount=0, share links callback + close, reanalyze callback + close.

## Test State

- **5 test files RED** (4 new + BulkShareModal cannot-find-module): expected
- **21 test files GREEN**: no regressions introduced
- **Pre-existing failures**: 2 tests in `src/lib/analysisStore.test.ts` failed before this plan and remain unchanged (out of scope)

## Deviations from Plan

None — plan executed exactly as written.

## Deferred Issues

**`src/lib/analysisStore.test.ts`** — 2 pre-existing failures (backgroundFirestoreSync tests). Confirmed pre-date this plan via `git stash` verification. Not introduced by this plan. Plan 11-01 scope is test scaffolding only.

## Self-Check

- [x] src/components/bulk/index.ts exists
- [x] src/components/bulk/BulkShareModal.test.tsx exists (5 tests, RED)
- [x] src/components/bulk/BulkReanalyzeModal.test.tsx exists (5 tests, RED)
- [x] src/components/bulk/BulkReanalyzeModal.tsx exists (null stub)
- [x] src/components/export/ExportModal.test.tsx exists (4 BULK-03 tests, RED)
- [x] src/components/filters/ActionsDropdown.test.tsx exists (6 tests, RED)
- [x] Commits: 9f33607, fddcff0, 99c0b2a
- [x] 343 passing tests unchanged

## Self-Check: PASSED
