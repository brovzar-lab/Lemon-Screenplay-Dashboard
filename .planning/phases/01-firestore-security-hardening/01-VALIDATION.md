---
phase: 1
slug: firestore-security-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test:run` |
| **Full suite command** | `npm run test:run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:run`
- **After every plan wave:** Run `npm run test:run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | INFRA | unit | `npm run test:run -- src/lib/firebase.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | INFRA | unit | `npm run test:run -- src/lib/analysisStore.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 2 | INFRA | manual | Firebase emulator rules test | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/firebase.test.ts` — test `authReady` promise resolves to a User with a uid (mock `signInAnonymously`)
- [ ] `src/lib/analysisStore.test.ts` — test `backgroundFirestoreSync` and `saveAnalysis` await `authReady` before Firestore calls

*Firestore rules cannot be unit-tested with Vitest — they require Firebase Local Emulator Suite. Manual emulator verification is the gate for rule changes.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Firestore rules: unauthenticated read returns PERMISSION_DENIED | INFRA | Requires Firebase Emulator Suite or production verification | 1. Open browser console on deployed app 2. Attempt `getDocs(collection(db, 'uploaded_analyses'))` without auth 3. Expect PERMISSION_DENIED |
| Firestore rules: authenticated read succeeds | INFRA | Same — emulator or production | 1. Load dashboard normally 2. Verify screenplays load without errors 3. Check console for no PERMISSION_DENIED |
| Anonymous auth enabled in Firebase Console | INFRA | Console-only setting | 1. Go to Firebase Console → Authentication → Sign-in method 2. Verify Anonymous is enabled |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
