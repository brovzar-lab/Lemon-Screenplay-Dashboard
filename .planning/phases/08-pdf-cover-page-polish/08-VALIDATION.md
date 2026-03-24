---
phase: 8
slug: pdf-cover-page-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + @testing-library/react |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm run test:run -- --reporter=verbose src/components/export/CoverageDocument.test.tsx` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run -- src/components/export/CoverageDocument.test.tsx`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green + `npm run build` passes
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 0 | PDF-01 | unit (style regression guard) | `npm run test:run -- src/components/export/CoverageDocument.test.tsx` | ❌ W0 gap | ⬜ pending |
| 08-01-02 | 01 | 1 | PDF-01 | unit (render smoke + gap assertion) | `npm run test:run -- src/components/export/CoverageDocument.test.tsx` | ✅ exists | ⬜ pending |
| 08-01-03 | 01 | 1 | PDF-01 | build | `npm run build` | N/A — command | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/export/CoverageDocument.test.tsx` — add `it()` asserting `titleText.marginBottom === 8` (regression guard for v6.8 fix)
- [ ] `src/components/export/CoverageDocument.test.tsx` — add `it()` asserting badge wrapper renders with `marginTop >= 16` after layout fix

*File already exists — no new files or framework installs required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Score number and badge have visible vertical gap on cover page | PDF-01 | @react-pdf/renderer is mocked in jsdom — visual gap cannot be asserted programmatically | Generate a real PDF via the Download Coverage button in the modal, visually confirm score number and badge are clearly separated |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
