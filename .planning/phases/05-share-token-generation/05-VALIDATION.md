---
phase: 05
slug: share-token-generation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-14
---

# Phase 05 — Validation Strategy

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
| 05-01-01 | 01 | 1 | SHARE-01 | unit | `npm run test:run -- src/lib/shareService.test.ts` | created by task | ⬜ pending |
| 05-01-02 | 01 | 1 | SHARE-01 | unit | `npm run test:run -- src/stores/shareStore.test.ts` | created by task | ⬜ pending |
| 05-02-01 | 02 | 2 | SHARE-01 | build | `npm run build` | N/A | ⬜ pending |
| 05-02-02 | 02 | 2 | SHARE-01 | build+suite | `npm run build && npm run test:run` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/shareService.test.ts` — created in Plan 01 (TDD: covers createShareToken, revokeShareToken, getExistingShareToken)
- [ ] `src/stores/shareStore.test.ts` — created in Plan 01 (covers setToken, removeToken, getToken)

*Existing infrastructure covers test framework — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Share button renders in modal with gold styling | SHARE-01 | Visual styling | Open screenplay detail modal, verify Share button is prominent and gold |
| Copy to clipboard works | SHARE-01 | Clipboard API requires user gesture | Click Share, click Copy, paste in new tab |
| Popover shows existing link on re-click | SHARE-01 | UI flow | Generate link, close popover, click Share again — same URL should appear |
| Revoke makes partner view show "no longer available" | SHARE-01 | Cross-tab verification | Generate link, open in incognito, revoke, refresh incognito |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
