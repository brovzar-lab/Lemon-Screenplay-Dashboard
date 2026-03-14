---
phase: 04
slug: ux-polish-scaffolding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + Testing Library React |
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
| 04-01-01 | 01 | 1 | UX-01 | unit | `npm run test:run -- src/components/screenplay/ScreenplayGrid.test.tsx` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | UX-02 | unit | `npm run test:run -- src/components/screenplay/ScreenplayGrid.test.tsx` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 1 | UX-03 | unit | `npm run test:run -- src/stores/toastStore.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | UX-03 | unit | `npm run test:run -- src/components/ui/ToastContainer.test.tsx` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | UX-04 | unit | `npm run test:run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/toastStore.test.ts` — covers UX-03 (addToast, removeToast, max 3 stacking, auto-dismiss)
- [ ] `src/components/ui/ToastContainer.test.tsx` — covers UX-03 (render, dismiss, accessibility)

*Existing infrastructure covers test framework — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toast styling matches premium theme | UX-03 | Visual styling | Trigger an error, verify glassmorphism toast with colored border |
| Toast position bottom-center | UX-03 | Layout verification | Verify toast appears at bottom-center of viewport |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
