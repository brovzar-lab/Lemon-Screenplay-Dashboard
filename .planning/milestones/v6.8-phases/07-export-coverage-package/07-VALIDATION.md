---
phase: 07
slug: export-coverage-package
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-14
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + happy-dom |
| **Config file** | vite.config.ts (test section) |
| **Quick run command** | `npm run test:run` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run`
- **After every plan wave:** Run `npm run test:run && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-T1 | 01 | 1 | EXPORT-01 | vitest | `npx vitest run src/components/export/exportCoverage.test.ts src/components/export/CoverageDocument.test.tsx -x` | N/A | pending |
| 07-02-T1 | 02 | 2 | EXPORT-01 | build | `npm run build` | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

*No new test files needed ahead of task execution — test files are created inline within 07-01-T1 (TDD task).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF renders with correct sections | EXPORT-01 | PDF visual output | Click Download Coverage, open PDF, verify all sections present |
| Score bars render correctly | EXPORT-01 | PDF visual rendering | Verify colored bars with numbers in PDF |
| Poster image renders on cover | EXPORT-01 | Image CORS + rendering | Verify poster appears at top of PDF |
| Branding and confidentiality footer | EXPORT-01 | Visual/print verification | Verify Lemon Studios logo and footer on each page |
| Filename format correct | EXPORT-01 | Browser download behavior | Verify file saves as {Title}-Coverage.pdf |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
