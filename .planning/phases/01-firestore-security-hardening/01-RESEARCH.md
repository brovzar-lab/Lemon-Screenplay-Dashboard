# Phase 1: Firestore Security Hardening - Research

**Researched:** 2026-03-13
**Domain:** Firebase Anonymous Authentication + Firestore Security Rules
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use Firebase Anonymous Authentication — dashboard silently creates an anonymous session on load
- No login screen, no user accounts — the experience feels identical to today
- Firestore rules switch from `allow read: if true` to `allow read: if request.auth != null` for internal collections
- The `shared_views` collection (created in Phase 5) will be readable by token lookup only
- Skip App Check re-enablement — it was disabled due to a reCAPTCHA provider mismatch causing 400 errors on all Firebase calls
- Anonymous auth provides sufficient protection for an internal tool
- Keep Storage publicly readable (`allow read: if true`) for both PDFs and posters
- Partners download screenplay PDFs directly via Firebase Storage URLs — no token gating
- Write rules (size limits, content type checks) stay as-is
- `screenplay_feedback` collection stays readable — notes are intentionally visible
- Partners seeing producer notes on shared views is a feature, not a security concern

### Claude's Discretion
- How to initialize anonymous auth (App.tsx provider vs firebase.ts init)
- Whether to add auth state persistence (localStorage vs session)
- Exact Firestore rule syntax for the `shared_views` collection (pre-create the rule structure even though Phase 5 creates the collection)
- Rollback strategy if rule changes break existing functionality

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

This phase adds Firebase Anonymous Authentication to the Lemon Dashboard and tightens Firestore security rules so that unauthenticated clients can no longer read any internal collection. The three collections that currently use `allow read: if true` — `uploaded_analyses`, `screenplay_feedback`, and `producer_profiles` — will switch to `allow read: if request.auth != null`. The `screenplay_feedback` collection stays readable (by authenticated requests only) by design: producer notes are intentionally visible to anyone who has a valid session, which will include share-link partners in Phase 5.

The primary complexity is the timing sequencing: the app makes Firestore calls before any auth state exists, so anonymous sign-in must complete before the first `getDocs` or `setDoc` executes. `analysisStore.ts` runs Firestore operations on a 2-second `setTimeout` after localStorage reads, which gives a workable window but is not a guarantee. The recommended approach is to gate the React Query fetch on auth readiness via an `onAuthStateChanged` listener rather than relying on timing.

Firebase Anonymous Authentication is a single function call (`signInAnonymously`) — no UI, no redirect, no user data. The same anonymous `uid` is restored on every page load as long as `browserLocalPersistence` is in effect (the default for web). The returned `User.uid` is stable across refreshes in the same browser.

**Primary recommendation:** Initialize `getAuth(app)` and call `signInAnonymously` in `firebase.ts` alongside `getFirestore`; export a `authReady` promise that resolves to the `User`; make `analysisStore.ts` await that promise before its first Firestore call.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase/auth` | 12.9.0 (installed) | Anonymous auth, `getAuth`, `signInAnonymously`, `onAuthStateChanged`, `browserLocalPersistence` | Ships inside the existing `firebase` package — zero new dependencies |
| `firebase/firestore` | 12.9.0 (installed) | Firestore SDK, security rules evaluated server-side | Already in use throughout `analysisStore.ts` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Firebase CLI | already in project | Deploy updated `firestore.rules` with `firebase deploy --only firestore:rules` | Any time rules change |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `browserLocalPersistence` (default) | `browserSessionPersistence` | Session persistence resets the anonymous session on every tab close; local persistence keeps the same `uid` indefinitely — better for a tool that users leave open for long periods |
| `onAuthStateChanged` gate | `signInAnonymously` with `await` + no listener | Direct await works for initial load but doesn't handle token refresh or concurrent tab scenarios; `onAuthStateChanged` is the pattern Firebase recommends |

**Installation:** No new packages needed. Firebase 12.9.0 already installed.

```bash
# No install required — firebase/auth is already part of firebase@12.9.0
```

---

## Architecture Patterns

### Recommended: auth-ready promise exported from firebase.ts

```typescript
// Source: @firebase/auth/dist/auth-public.d.ts (verified in node_modules)
// firebase.ts

import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, browserLocalPersistence, setPersistence } from 'firebase/auth';

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export const db = getFirestore(app);
export const auth = getAuth(app);

/**
 * Resolves with the anonymous User once sign-in is complete.
 * All Firestore callers should await this before their first request.
 */
export const authReady: Promise<import('firebase/auth').User> = (async () => {
  await setPersistence(auth, browserLocalPersistence);
  const { user } = await signInAnonymously(auth);
  return user;
})();
```

**Why this over a React context/provider approach:** The app has no auth-aware routing, no conditional rendering based on auth state, and no auth UI. `authReady` as a module-level promise is the simplest possible contract: any module that imports from `firebase.ts` can `await authReady` before touching Firestore. No React lifecycle coupling.

**Why `setPersistence(auth, browserLocalPersistence)` explicitly:** `browserLocalPersistence` is the default for web, but calling it explicitly documents the intent and makes future changes auditable. The same anonymous `uid` survives page refreshes and browser restarts until the user clears site data.

### Pattern 1: Gate Firestore calls on authReady in analysisStore.ts

**What:** Import `authReady` and `await` it before the first Firestore SDK call in any function that reads or writes.
**When to use:** Every exported function in `analysisStore.ts` that calls `getDocs`, `setDoc`, or `deleteDoc`.

```typescript
// analysisStore.ts — add at top-of-function level
import { authReady } from './firebase';

export async function saveAnalysis(raw: Record<string, unknown>): Promise<void> {
  // localStorage write is synchronous — no auth needed
  const sourceFile = (raw.source_file as string) || `unknown_${Date.now()}`;
  const existing = readFromLocal();
  // ... write to localStorage ...

  // Gate Firestore on auth
  await authReady;
  const docId = toDocId(sourceFile);
  // ... setDoc ...
}

async function backgroundFirestoreSync(): Promise<void> {
  await authReady;  // wait for anonymous session before getDocs
  // ... rest of sync ...
}
```

The 2-second `setTimeout` in `loadAllAnalyses` already ensures UI renders before Firestore sync. Adding `await authReady` inside `backgroundFirestoreSync` adds negligible latency since sign-in completes in ~100-300ms and the sync already waits 2 seconds.

### Pattern 2: Firestore rules — `request.auth != null` guard

**What:** Replace `allow read: if true` with `allow read: if request.auth != null` on all internal collections.
**When to use:** Every collection that should be protected from unauthenticated access.

```javascript
// firestore.rules

// ── uploaded_analyses ─────────────────────────────────────────────────────
match /uploaded_analyses/{docId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null
               && request.resource.data.keys().hasAny([...]);
}

// ── screenplay_feedback ───────────────────────────────────────────────────
match /screenplay_feedback/{docId} {
  allow read: if request.auth != null;  // readable — notes are intentionally visible
  allow write: if request.auth != null
               && 'screenplayId' in request.resource.data ...;
}

// ── producer_profiles ─────────────────────────────────────────────────────
match /producer_profiles/{docId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null
               && ...;
}

// ── shared_views (Phase 5 creates this collection, pre-stub the rule now) ─
match /shared_views/{tokenId} {
  allow read: if true;  // token = capability; anyone with the token URL may read
  allow write: if request.auth != null;  // only authenticated app sessions create/delete
}
```

**Important:** Pre-stubbing `shared_views` with `allow write: if request.auth != null` now means Phase 5 only needs to add/refine the read rule — no risk of forgetting to add a write guard later.

### Pattern 3: Auth write guard consistency

All three existing collections currently have write rules without an auth check. Since the dashboard is the only writer (no Cloud Functions write to these collections), adding `request.auth != null` to write rules simultaneously tightens both read and write paths without breaking any functionality.

### Anti-Patterns to Avoid

- **Waiting for `onAuthStateChanged` inside a React component before letting the app render:** Creates a blank screen flash. The `authReady` promise + localStorage fast-path means the UI renders from localStorage data immediately while auth completes in the background.
- **Re-initializing `getAuth(app)` multiple times:** `getAuth(app)` is a singleton per Firebase app; calling it multiple times returns the same instance. Initialize once in `firebase.ts` and export `auth`.
- **Putting the `await authReady` in `loadAllAnalyses`'s return path:** `loadAllAnalyses` is intentionally synchronous for the localStorage return. Only the background Firestore sync needs the auth gate; the localStorage path should remain instant.
- **Storing the auth token manually in localStorage:** Firebase handles token refresh automatically. Don't touch `auth.currentUser.getIdToken()` manually — the SDK handles it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Anonymous session persistence | Custom localStorage `uid` storage | `browserLocalPersistence` (default) | Firebase handles token refresh, expiry, and multi-tab sync automatically |
| Race condition between auth and Firestore | `setTimeout` polling for auth state | `await signInAnonymously()` + `authReady` promise | Deterministic resolution; no polling |
| Token refresh | Manual `setInterval` to re-sign-in | `onAuthStateChanged` (automatic) | Firebase SDK refreshes the ID token every hour without any intervention |
| Firestore rules testing | Manually checking if reads succeed | Firebase Emulator Suite (`firebase emulators:start --only firestore`) | Rules can be tested offline against exact rule logic |

**Key insight:** Firebase Anonymous Auth is specifically designed to be zero-friction. The entire implementation is `getAuth(app)` + `signInAnonymously(auth)` — everything else (persistence, refresh, security) is handled by the SDK.

---

## Common Pitfalls

### Pitfall 1: Firestore calls racing anonymous sign-in
**What goes wrong:** Rules are updated to require auth, but Firestore calls fire before `signInAnonymously` resolves — every read returns `PERMISSION_DENIED`, breaking the entire app.
**Why it happens:** Firebase SDK operations are not automatically queued behind auth initialization. If `getDocs` runs before `signInAnonymously` completes, `request.auth` in rules will be `null`.
**How to avoid:** Export `authReady` from `firebase.ts`; all Firestore callers `await authReady` before their first SDK call.
**Warning signs:** `PERMISSION_DENIED` errors in the console on first load, disappearing on hard refresh (because the second load hits the already-resolved auth state).

### Pitfall 2: Rules deployed before auth is wired in the client
**What goes wrong:** Rules are updated and deployed first; any window of time where the client runs without auth causes a complete data outage.
**Why it happens:** Deployment ordering — rules take effect immediately on deploy.
**How to avoid:** Ship client code (auth init + `await authReady` gates) to production first, verify it works with existing open rules, then deploy the tightened rules.
**Warning signs:** Users who loaded the page just before the rule deploy see broken data until they refresh.

### Pitfall 3: `write` rules missing auth check after adding auth to `read`
**What goes wrong:** A malicious client (or misconfigured development tool) can still write arbitrary data to Firestore without a session.
**Why it happens:** Only the `read` rule was updated, not `write`.
**How to avoid:** Update both `allow read` and `allow write` in the same rules change. The existing write validation logic is preserved; just prepend `request.auth != null &&` to each write condition.
**Warning signs:** Firebase console shows writes from unauthenticated clients (empty `uid` in event logs).

### Pitfall 4: `browserLocalPersistence` vs `browserSessionPersistence` confusion
**What goes wrong:** Using session persistence means every new browser tab triggers a fresh `signInAnonymously` call, creating new anonymous UIDs. This is harmless for data access but creates orphaned anonymous user accounts in Firebase Authentication that accumulate over time.
**Why it happens:** Not calling `setPersistence` explicitly or choosing the wrong constant.
**How to avoid:** Use `browserLocalPersistence` (the default). Call `setPersistence` explicitly for clarity.
**Warning signs:** Firebase console Authentication tab shows rapidly growing number of anonymous users.

### Pitfall 5: Anonymous auth not enabled in Firebase Console
**What goes wrong:** `signInAnonymously()` returns an `auth/operation-not-allowed` error, blocking all Firestore reads.
**Why it happens:** Anonymous sign-in is disabled by default in new Firebase projects and must be enabled manually.
**How to avoid:** Before deploying client code, verify in Firebase Console → Authentication → Sign-in method → Anonymous is enabled.
**Warning signs:** `auth/operation-not-allowed` error on first load.

---

## Code Examples

Verified against installed `@firebase/auth` 12.9.0 (`/dist/auth-public.d.ts`):

### Complete firebase.ts update
```typescript
// Source: @firebase/auth/dist/auth-public.d.ts (verified in node_modules)
import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import type { User } from 'firebase/auth';

const firebaseConfig = { /* unchanged */ };

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Resolved once anonymous session is established.
// All Firestore callers should await this before their first request.
export const authReady: Promise<User> = (async () => {
  await setPersistence(auth, browserLocalPersistence);
  const credential = await signInAnonymously(auth);
  return credential.user;
})();
```

### await authReady in analysisStore.ts
```typescript
// In backgroundFirestoreSync (the only place that hits Firestore on read)
import { authReady } from './firebase';

async function backgroundFirestoreSync(): Promise<void> {
  if (_bgSyncDone) return;
  _bgSyncDone = true;

  await authReady; // wait for anonymous session before any Firestore call

  try {
    await flushPendingWrites();
    // ... rest unchanged ...
  }
}

// In saveAnalysis (Firestore write path only — localStorage write stays immediate)
export async function saveAnalysis(raw: Record<string, unknown>): Promise<void> {
  // localStorage: immediate, no auth needed
  // ...

  // Firestore: gate on auth
  await authReady;
  const docId = toDocId(sourceFile);
  // ...
}
```

### Firestore rules — minimal diff
```javascript
// Current:   allow read: if true;
// New:        allow read: if request.auth != null;

// Current:   allow write: if 'screenplayId' in request.resource.data ...
// New:        allow write: if request.auth != null && 'screenplayId' in request.resource.data ...
```

### Verify anonymous auth works (browser console smoke test)
```javascript
// Paste in devtools after deploying client code but before tightening rules
import { getAuth, signInAnonymously } from 'firebase/auth';
const auth = getAuth();
signInAnonymously(auth).then(cred => console.log('uid:', cred.user.uid));
// Expected: uid: some-random-uid-string
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Firebase Auth v8 compat (`firebase.auth().signInAnonymously()`) | Modular v9+ API (`signInAnonymously(auth)`) | Firebase v9 (2021) | Tree-shakeable; already how the rest of this project uses Firebase |
| Firebase v9+ `initializeAuth` with custom persistence | `getAuth(app)` which defaults to `browserLocalPersistence` | Firebase v9 | Simpler for browser apps; `getAuth` is sufficient unless special persistence is needed |

**Deprecated/outdated:**
- Compat namespace `firebase.auth()`: Project already uses modular SDK throughout — do not use compat API.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test:run` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

This phase has no formal requirement IDs (it is an infrastructure prerequisite). The behaviors to validate are:

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| `authReady` promise resolves to a User with a `uid` | unit | `npm run test:run -- src/lib/firebase.test.ts` | ❌ Wave 0 |
| `backgroundFirestoreSync` awaits `authReady` before `getDocs` | unit | `npm run test:run -- src/lib/analysisStore.test.ts` | ❌ Wave 0 |
| `saveAnalysis` Firestore path awaits `authReady` | unit | `npm run test:run -- src/lib/analysisStore.test.ts` | ❌ Wave 0 |
| Firestore rules: unauthenticated read returns PERMISSION_DENIED | manual/emulator | `firebase emulators:start --only firestore` + rules test | N/A — emulator |
| Firestore rules: authenticated read succeeds | manual/emulator | same | N/A — emulator |

### Sampling Rate
- **Per task commit:** `npm run test:run`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/firebase.test.ts` — covers `authReady` promise behavior (mock `signInAnonymously`)
- [ ] `src/lib/analysisStore.test.ts` — covers `authReady` gate in `backgroundFirestoreSync` and `saveAnalysis` (already partially exists; needs auth-gate assertions)

Note: Firestore rules cannot be unit-tested with Vitest — they require the Firebase Local Emulator Suite. Manual emulator verification is the appropriate gate for rule changes.

---

## Open Questions

1. **Anonymous auth already enabled in Firebase Console?**
   - What we know: The Firebase project (`lemon-screenplay-dashboard`) exists and is in use.
   - What's unclear: Whether Anonymous sign-in method is currently enabled in the Console.
   - Recommendation: Wave 0 task should include a verification step — go to Firebase Console → Authentication → Sign-in method → Anonymous and confirm it is enabled before deploying any client code.

2. **`flushPendingWrites` timing with auth gate**
   - What we know: `flushPendingWrites` calls `setDoc` and is called inside `backgroundFirestoreSync`, which will now `await authReady` at the top.
   - What's unclear: Nothing — `flushPendingWrites` is called after `await authReady`, so it inherits the auth gate correctly.
   - Recommendation: No action needed; the gate covers it.

3. **`shared_views` rule pre-stub — exact read rule for Phase 5**
   - What we know: Phase 5 uses `crypto.randomUUID()` tokens stored in Firestore. The sharing model is "token = capability" (anyone with the URL can read).
   - What's unclear: Whether the read rule in Phase 5 will be `allow read: if true` (token URL is the secret) or `allow read: if resource.data.token == request.query.token` (parameterized).
   - Recommendation: Pre-stub as `allow read: if true` with a comment noting Phase 5 will refine it. This is safe because `shared_views` doesn't exist yet and the catch-all deny prevents access until Phase 5 creates documents.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/@firebase/auth/dist/auth-public.d.ts` — `signInAnonymously`, `getAuth`, `setPersistence`, `browserLocalPersistence`, `onAuthStateChanged` signatures verified in installed Firebase 12.9.0
- `node_modules/@firebase/auth/dist/index.d.ts` — browser platform exports verified
- `firestore.rules` (project file) — current rule structure and helper functions confirmed
- `src/lib/firebase.ts` (project file) — existing init pattern, App Check disable comment
- `src/lib/analysisStore.ts` (project file) — all Firestore call sites identified
- `src/main.tsx` + `src/App.tsx` (project files) — no existing auth provider; clean insertion point confirmed

### Secondary (MEDIUM confidence)
- Firebase documentation pattern for anonymous auth + persistence — consistent with installed SDK TypeScript declarations

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against installed node_modules (Firebase 12.9.0)
- Architecture: HIGH — derived from actual codebase analysis (firebase.ts, analysisStore.ts, main.tsx)
- Pitfalls: HIGH — derived from actual code structure (setTimeout timing, missing auth gate on writes)
- Firestore rules syntax: HIGH — current rules file read directly

**Research date:** 2026-03-13
**Valid until:** 2026-09-13 (Firebase modular API is stable; rules syntax changes rarely)
