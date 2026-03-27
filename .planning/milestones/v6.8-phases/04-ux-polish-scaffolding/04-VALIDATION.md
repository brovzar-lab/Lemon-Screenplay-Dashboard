---
phase: 04
slug: ux-polish-scaffolding
status: draft
nyquist_compliant: true
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
| 04-01-01 | 01 | 1 | UX-03 | unit | `npx vitest run src/stores/toastStore.test.ts` | created by task | ⬜ pending |
| 04-01-02 | 01 | 1 | UX-03 | unit+build | `npx vitest run src/components/ui/ToastContainer.test.tsx && npm run build` | created by task | ⬜ pending |
| 04-02-01 | 02 | 2 | UX-04 | unit+build | `npx vitest run src/lib/utils.test.ts && npm run build` | created by task | ⬜ pending |
| 04-02-02 | 02 | 2 | UX-03 | build+suite | `npm run build && npm run test:run` | N/A (wiring) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/toastStore.test.ts` — created in Plan 01 Task 1 (TDD: tests written before implementation)
- [ ] `src/components/ui/ToastContainer.test.tsx` — created in Plan 01 Task 2 (covers render, overflow, accessibility, dismiss)
- [ ] `src/lib/utils.test.ts` — created in Plan 02 Task 1 (covers safeJsonParse: valid JSON, corrupt JSON, null, undefined, empty string)

*Existing infrastructure covers test framework — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Toast styling matches premium theme | UX-03 | Visual styling | Trigger an error, verify glassmorphism toast with colored border |
| Toast position bottom-center | UX-03 | Layout verification | Verify toast appears at bottom-center of viewport |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
