---
phase: 4
slug: bulk-action-integrations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x + Testing Library |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | BULK-04 | unit | `npx vitest run src/components/screenplay/BulkActionBar.test.tsx` | ✅ exists | ⬜ pending |
| 04-01-02 | 01 | 1 | BULK-05 | unit | `npx vitest run src/components/export/bulkPdfExport.test.ts` | ✅ plan 03 creates | ⬜ pending |
| 04-01-03 | 01 | 1 | BULK-06 | unit | `npx vitest run src/components/screenplay/BulkActionBar.test.tsx` | ✅ exists | ⬜ pending |
| 04-02-01 | 02 | 2 | BULK-08 | unit | `npx vitest run src/components/bulk/SetCategoryModal.test.tsx` | ✅ plan 02 creates | ⬜ pending |
| 04-02-02 | 02 | 2 | BULK-09 | unit | `npx vitest run src/components/bulk/AddToFavoritesModal.test.tsx` | ✅ plan 02 creates | ⬜ pending |
| 04-03-01 | 01 | 1 | D-05 | unit | `npx vitest run src/stores/toastStore.test.ts` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No separate Wave 0 test scaffolding needed. All test files are either:
- Already existing from Phase 3 (`BulkActionBar.test.tsx`, `toastStore.test.ts`)
- Created by the plan that implements the feature (`SetCategoryModal.test.tsx`, `AddToFavoritesModal.test.tsx`, `bulkPdfExport.test.ts`)

*Existing test infrastructure (Vitest + Testing Library) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF zip download triggers browser save dialog | BULK-05 | Browser download API can't be fully tested in jsdom | 1. Select 3+ screenplays 2. Click Export PDF 3. Verify .zip file downloads with individual PDFs |
| Progress indicator shows "Exporting PDF 3 of 20..." | D-13 | Visual transition timing requires browser rendering | 1. Select 5+ screenplays 2. Click Export PDF 3. Observe button transforms to progress text 4. Verify reverts after completion |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
