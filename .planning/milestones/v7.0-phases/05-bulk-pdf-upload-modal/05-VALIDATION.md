---
phase: 05
slug: bulk-pdf-upload-modal
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:run -- --testPathPattern=bulk` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run -- --testPathPattern=bulk`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | BULK-07 | unit | `npx vitest run src/components/bulk/BulkPdfUploadModal.test.tsx -t "renders"` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | BULK-07 | unit | `npx vitest run src/components/bulk/bulkPdfUpload.helpers.test.ts -t "validate"` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | BULK-07 | unit | `npx vitest run src/components/bulk/bulkPdfUpload.helpers.test.ts -t "matchScore"` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | BULK-07 | unit | `npx vitest run src/components/bulk/BulkPdfUploadModal.test.tsx -t "upload"` | ❌ W0 | ⬜ pending |
| 05-01-05 | 01 | 1 | BULK-12 | unit | `npx vitest run src/components/bulk/BulkPdfUploadModal.test.tsx -t "missing"` | ❌ W0 | ⬜ pending |
| 05-01-06 | 01 | 1 | BULK-12 | unit | `npx vitest run src/components/bulk/BulkPdfUploadModal.test.tsx -t "attached"` | ❌ W0 | ⬜ pending |
| 05-01-07 | 01 | 1 | BULK-12 | unit | `npx vitest run src/components/bulk/BulkPdfUploadModal.test.tsx -t "summary"` | ❌ W0 | ⬜ pending |
| 05-01-08 | 01 | 1 | BULK-12 | unit | `npx vitest run src/components/bulk/BulkPdfUploadModal.test.tsx -t "Done"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/bulk/BulkPdfUploadModal.test.tsx` — covers BULK-07, BULK-12 (modal rendering, upload, missing filter, summary)
- [ ] `src/components/bulk/bulkPdfUpload.helpers.test.ts` — covers matchScore, validatePdfFile, middleTruncate

*No framework install needed — Vitest + Testing Library already configured*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native file drag-and-drop interaction | BULK-07 | DnD events can't be fully simulated in JSDOM | Drop PDF file on row → upload starts; drop non-PDF → error flash |
| Batch drop zone multi-file handling | BULK-07 | Multi-file DnD events require real browser | Drop 3 PDFs on batch zone → auto-match to titles |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
