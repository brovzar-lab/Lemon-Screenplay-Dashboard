---
phase: 02
slug: sync-status-visibility
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via vite.config.ts) |
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
| 02-01-01 | 01 | 1 | SYNC-01 | unit | `npm run test:run -- src/stores/syncStatusStore.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | SYNC-01 | unit | `npm run test:run -- src/components/layout/SyncStatusIndicator.test.tsx` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | SYNC-02 | unit | `npm run test:run -- src/hooks/useSyncRetry.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | SYNC-02 | unit | `npm run test:run -- src/components/layout/SyncStatusIndicator.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/stores/syncStatusStore.test.ts` — store logic for SYNC-01
- [ ] `src/components/layout/SyncStatusIndicator.test.tsx` — rendering and button for SYNC-01/SYNC-02
- [ ] `src/hooks/useSyncRetry.test.ts` — retry logic for SYNC-02

*Existing infrastructure covers test framework — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Indicator matches premium theme | SYNC-01 | Visual styling | Open dashboard, verify amber/gold badge matches header aesthetic |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
