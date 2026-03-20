---
phase: 11
slug: bulk-operations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (globals: true, happy-dom) |
| **Config file** | `vitest.config.ts` at project root |
| **Quick run command** | `npm run test:run -- --reporter=verbose src/components/bulk/ src/components/export/ExportModal.test.tsx` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run -- src/components/bulk/ src/components/export/ExportModal.test.tsx`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 0 | BULK-01, BULK-02, BULK-03 | unit stubs | `npm run test:run -- src/components/bulk/ src/components/export/ExportModal.test.tsx` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | BULK-01 | unit | `npm run test:run -- src/components/bulk/BulkShareModal.test.tsx` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 1 | BULK-01 | unit | `npm run test:run -- src/lib/shareService.test.ts src/stores/shareStore.test.ts` | ✅ extend | ⬜ pending |
| 11-03-01 | 03 | 1 | BULK-02 | unit | `npm run test:run -- src/components/bulk/BulkReanalyzeModal.test.tsx` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 1 | BULK-02 | unit | `npm run test:run -- src/components/bulk/BulkReanalyzeModal.test.tsx` | ❌ W0 | ⬜ pending |
| 11-03-03 | 03 | 1 | BULK-03 | unit | `npm run test:run -- src/components/export/ExportModal.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/bulk/BulkShareModal.test.tsx` — stubs for BULK-01 (row status, Copy All format, per-row retry)
- [ ] `src/components/bulk/BulkReanalyzeModal.test.tsx` — stubs for BULK-02 (eligibility filter, cancel signal, retry-once, RQ invalidation, deselectAll)
- [ ] `src/components/export/ExportModal.test.tsx` — stubs for BULK-03 (mode-based header text, button label)
- [ ] `src/components/bulk/index.ts` — barrel export for BulkShareModal and BulkReanalyzeModal

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Progressive fill UX (rows appear as tokens resolve) | BULK-01 | Async timing in test environment; UI state transitions hard to verify without real Firestore | Select 5 screenplays → Actions → Generate Share Links → confirm rows fill progressively |
| Re-analyze progress modal UX | BULK-02 | Requires real Firebase Storage download + API call | Select 3 legacy screenplays → Actions → Re-analyze Selected → confirm "Re-analyzing 1 of 3" updates |
| Version badges update on modal close | BULK-02 | React Query cache invalidation visible in grid | After re-analyze modal closes → confirm version badges on cards update without page refresh |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
