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
| 04-01-01 | 01 | 1 | BULK-04 | unit | `npx vitest run src/components/export/csvExport.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | BULK-05 | unit | `npx vitest run src/components/export/batchPdfExport.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | BULK-06 | unit | `npx vitest run src/stores/comparisonStore.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | BULK-08 | unit | `npx vitest run src/components/screenplay/SetCategoryModal.test.tsx` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | BULK-09 | unit | `npx vitest run src/stores/favoritesStore.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-01 | 01 | 1 | D-05 | unit | `npx vitest run src/stores/toastStore.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Toast store 'success' severity — add to existing toastStore types
- [ ] `src/components/export/batchPdfExport.test.ts` — stubs for BULK-05 batch PDF + zip
- [ ] `src/components/screenplay/SetCategoryModal.test.tsx` — stubs for BULK-08 category modal
- [ ] `src/stores/toastStore.test.ts` — stubs for success toast verification

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
