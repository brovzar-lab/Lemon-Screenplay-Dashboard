---
phase: 03
slug: data-safety
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 03 — Validation Strategy

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
| 03-01-01 | 01 | 1 | SYNC-03 | unit | `npm run test:run -- src/lib/analysisStore.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | SYNC-03 | unit | `npm run test:run -- src/lib/analysisStore.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | SYNC-04 | unit | `npm run test:run -- src/lib/api.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | SYNC-04 | unit | `npm run test:run -- src/lib/analysisStore.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | SYNC-03 | unit | `npm run test:run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New test cases in `src/lib/analysisStore.test.ts` for soft-delete, restore, getDeleted, quarantine
- [ ] New test file `src/lib/api.test.ts` for quarantine-on-type-guard-failure
- [ ] Mock for `updateDoc` and `deleteField` in test setup

*Existing infrastructure covers test framework — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Recently Deleted UI matches premium theme | SYNC-03 | Visual styling | Open Settings, verify recovery section matches gold/black theme |
| Quarantine section accessible in Settings | SYNC-04 | Visual verification | Open Settings, verify quarantined items section exists |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
