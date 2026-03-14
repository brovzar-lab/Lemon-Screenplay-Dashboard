---
phase: 06
slug: shared-partner-view
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-14
---

# Phase 06 — Validation Strategy

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
| 06-01-01 | 01 | 1 | SHARE-02 | unit | `npm run test:run -- src/lib/shareService.test.ts` | add tests to existing | ⬜ pending |
| 06-02-01 | 02 | 2 | SHARE-02 | build | `npm run build` | N/A | ⬜ pending |
| 06-02-02 | 02 | 2 | SHARE-02,03,04 | build+suite | `npm run build && npm run test:run` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Add `resolveShareToken` tests to existing `src/lib/shareService.test.ts`

*Existing infrastructure covers test framework — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Shared view renders with premium theme | SHARE-02 | Visual styling | Open share link, verify gold/black theme |
| PDF download works | SHARE-03 | Requires live Firebase Storage URL | Click Download Script, verify PDF downloads |
| Invalid token shows branded error | SHARE-02 | Visual verification | Open `/share/invalid-token`, verify branded error page |
| No dashboard chrome visible | SHARE-04 | Visual verification | Open share link, verify no Header/FilterBar/Settings |
| Lazy-load produces separate chunk | SHARE-04 | Build output inspection | Run `npm run build`, check dist/assets for separate SharedViewPage chunk |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
