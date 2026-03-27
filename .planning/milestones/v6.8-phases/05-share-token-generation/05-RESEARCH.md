# Phase 5: Share Token Generation - Research

**Researched:** 2026-03-14
**Domain:** Firestore CRUD + clipboard API + Zustand state management
**Confidence:** HIGH

## Summary

This phase adds the ability for the producer to generate, copy, and revoke per-screenplay share links from the screenplay detail modal. The implementation is straightforward: a new `shareService.ts` wraps Firestore CRUD for a `shared_views` collection (rules already deployed in Phase 1), a `shareStore.ts` Zustand store tracks tokens per session, and a `SharePopover` component renders inline below the Share button inside `ModalHeader`.

The codebase already has all the patterns needed: Firestore doc operations via `firebase/firestore` (see `analysisStore.ts`), ephemeral Zustand stores (see `toastStore.ts`, `syncStatusStore.ts`), toast notifications for errors, and `DeleteConfirmDialog` as a pattern for the revoke confirmation. `crypto.randomUUID()` is available in all modern browsers and the project's TypeScript target.

**Primary recommendation:** Follow the existing dual-pattern (Firestore for persistence, Zustand for session state) and keep the share service as a pure async module like `analysisStore.ts` -- not a hook, not a store method. The store only caches what tokens are active for the current session.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Share button lives **inside the screenplay detail modal** -- not on card hover
- **Primary action** styling (gold/prominent) -- sharing is the key workflow outcome
- When the screenplay isn't synced to Firestore, the button is **disabled with tooltip** ("Sync pending -- wait for Firestore sync before sharing")
- **Block link generation** if screenplay hasn't synced -- show an error toast instead of creating a broken link
- A **checkbox toggle** lets the producer choose whether to include their notes in the shared view for each share link
- The toggle state is stored in the `shared_views` Firestore document so the partner view knows whether to show notes
- After generating a link, an **inline popover** appears below the Share button with the URL + a one-click copy button
- After copying, popover **stays open** with "Copied!" feedback for 2 seconds (producer can copy again if needed)
- If a share link **already exists** for this screenplay, clicking Share shows the existing link (one link per screenplay, reuse the token)
- Producer can **revoke** a share link via a revoke button in the share popover
- Revocation deletes the token from Firestore; partner sees "This link is no longer available"
- A **central list of active share links** is available in **Settings** showing screenplay titles + revoke buttons
- **No expiry** -- links persist until manually revoked (auto-expire TTL is deferred to v2 SHARE-05)
- When a screenplay is **soft-deleted**, its share link is **automatically revoked**
- Share URL format: `https://lemon-screenplay-dashboard.web.app/share/{token}` (Phase 6 builds the route handler)
- Token is `crypto.randomUUID()` stored in `shared_views` Firestore collection (pre-decided)
- `shared_views` Firestore rules already deployed: `allow read: if true; allow write: if request.auth != null` (Phase 1)

### Claude's Discretion
- Share popover component implementation details (positioning, animation)
- How to check Firestore sync status for the pre-share gate (check if doc exists in Firestore, or check pending queue)
- shareStore vs inline state for tracking the popover open/close state
- Settings "Shared Links" section layout and styling

### Deferred Ideas (OUT OF SCOPE)
- SHARE-05: Auto-expire links with configurable TTL -- v2 requirement
- Share analytics (view count, last accessed) -- not in scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SHARE-01 | User can generate a shareable link for any single screenplay | shareService.createShareToken() creates a `shared_views` doc with `crypto.randomUUID()` token, returns the full URL. SharePopover displays URL + copy button. Existing token lookup prevents duplicates. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| firebase/firestore | 11.x (already installed) | CRUD for `shared_views` collection | Project standard -- all Firestore ops use this |
| zustand | 5.x (already installed) | Ephemeral session cache of active share tokens | Project standard -- one store per domain |
| Web Clipboard API | Built-in | `navigator.clipboard.writeText()` for copy-to-clipboard | No library needed -- single method call |
| crypto.randomUUID() | Built-in | Token generation | Pre-decided in CONTEXT.md, available in all target browsers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | 5.x (already installed) | `useMutation` for create/revoke operations | Write operations with loading/error states |
| clsx | Already installed | Conditional class composition | Button/popover styling |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| navigator.clipboard.writeText | Third-party clipboard lib | Unnecessary -- single API call, HTTPS-only (Firebase Hosting is HTTPS) |
| Zustand store for share state | React Query cache only | Store gives cleaner imperative access for auto-revoke on soft-delete |

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── shareService.ts          # Firestore CRUD for shared_views (pure async functions)
├── stores/
│   └── shareStore.ts            # Ephemeral Zustand store caching active tokens per session
├── components/
│   └── screenplay/
│       └── modal/
│           └── ShareButton.tsx   # Share button + inline popover (self-contained)
├── components/
│   └── settings/
│       └── SharedLinksPanel.tsx  # Settings tab listing active share links with revoke
```

### Pattern 1: Share Service (Pure Async Module)
**What:** `shareService.ts` exports pure async functions for Firestore CRUD -- same pattern as `analysisStore.ts`
**When to use:** All `shared_views` collection operations

```typescript
// src/lib/shareService.ts
import { doc, setDoc, deleteDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { authReady, db } from './firebase';

const SHARED_VIEWS_COLLECTION = 'shared_views';
const SHARE_BASE_URL = 'https://lemon-screenplay-dashboard.web.app/share';

export interface SharedView {
  token: string;
  screenplayId: string;       // screenplay.id (the sourceFile-derived key)
  screenplayTitle: string;
  includeNotes: boolean;
  createdAt: string;           // ISO timestamp
}

export async function createShareToken(
  screenplayId: string,
  screenplayTitle: string,
  includeNotes: boolean
): Promise<{ token: string; url: string }> {
  await authReady;
  const token = crypto.randomUUID();
  const sharedView: SharedView = {
    token,
    screenplayId,
    screenplayTitle,
    includeNotes,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, SHARED_VIEWS_COLLECTION, token), sharedView);
  return { token, url: `${SHARE_BASE_URL}/${token}` };
}

export async function revokeShareToken(token: string): Promise<void> {
  await authReady;
  await deleteDoc(doc(db, SHARED_VIEWS_COLLECTION, token));
}

export async function getExistingShareToken(screenplayId: string): Promise<SharedView | null> {
  await authReady;
  const q = query(
    collection(db, SHARED_VIEWS_COLLECTION),
    where('screenplayId', '==', screenplayId)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as SharedView;
}
```

### Pattern 2: Ephemeral Zustand Store (Session Cache)
**What:** `shareStore.ts` caches which tokens are active for this session. No persistence middleware (matches `toastStore.ts`, `syncStatusStore.ts` pattern).
**When to use:** Avoid repeated Firestore queries when re-opening the same modal.

```typescript
// src/stores/shareStore.ts
import { create } from 'zustand';
import type { SharedView } from '@/lib/shareService';

interface ShareStore {
  /** Map of screenplayId -> SharedView for tokens loaded this session */
  tokens: Record<string, SharedView>;
  setToken: (screenplayId: string, view: SharedView) => void;
  removeToken: (screenplayId: string) => void;
  clearAll: () => void;
}

export const useShareStore = create<ShareStore>((set) => ({
  tokens: {},
  setToken: (screenplayId, view) =>
    set((state) => ({ tokens: { ...state.tokens, [screenplayId]: view } })),
  removeToken: (screenplayId) =>
    set((state) => {
      const { [screenplayId]: _, ...rest } = state.tokens;
      return { tokens: rest };
    }),
  clearAll: () => set({ tokens: {} }),
}));
```

### Pattern 3: Share Button with Inline Popover
**What:** Self-contained `ShareButton` component inside `modal/` directory. Handles: check existing token, create new token, copy URL, revoke, notes toggle.
**When to use:** Mounted in `ModalHeader` action bar alongside PDF/Delete buttons.

Key implementation details:
- Popover is a simple `div` positioned with Tailwind (`absolute top-full mt-2`) -- no portal needed since the modal already handles z-indexing
- `useState` for popover open/close state (no store needed -- ephemeral UI state)
- `useMutation` from React Query for create/revoke operations (gives isPending/isError)

### Pattern 4: Firestore Sync Pre-Check
**What:** Before generating a share token, verify the screenplay exists in Firestore (not just localStorage).
**Recommended approach:** Check if the doc exists in the `uploaded_analyses` Firestore collection using `getDoc()`.

```typescript
import { doc, getDoc } from 'firebase/firestore';
import { authReady, db } from './firebase';

export async function isScreenplaySynced(sourceFile: string): Promise<boolean> {
  await authReady;
  const docId = toDocId(sourceFile); // reuse the same sanitizer from analysisStore
  const docRef = doc(db, 'uploaded_analyses', docId);
  const snapshot = await getDoc(docRef);
  return snapshot.exists();
}
```

This is better than checking the pending write queue because:
- The pending queue only tracks *failed* writes, not pending-first-time writes
- A direct Firestore doc check is the ground truth for "will the partner be able to load this?"

### Pattern 5: Auto-Revoke on Soft-Delete
**What:** When a screenplay is soft-deleted, automatically revoke its share token.
**Where:** Hook into the existing `softDeleteAnalysis` flow in `analysisStore.ts` or in the `useDeleteScreenplays` mutation's `onSuccess`.

Recommended: Add to the `useDeleteScreenplays` mutation's `onSuccess` callback (in `useScreenplays.ts`) since:
- It's the single call site for all delete operations
- It already invalidates query caches there
- Avoids modifying the low-level `analysisStore.ts` which is already complex

```typescript
// In useDeleteScreenplays onSuccess:
// 1. Check shareStore for token associated with deleted screenplay(s)
// 2. Call revokeShareToken() for each
// 3. Remove from shareStore
```

### Anti-Patterns to Avoid
- **Don't store tokens in localStorage:** The `shared_views` Firestore collection IS the source of truth. The Zustand store is a session cache only. localStorage would create stale-token bugs.
- **Don't query all shared_views on app load:** Only fetch when the user opens the Settings "Shared Links" tab or opens a specific screenplay modal. Lazy loading.
- **Don't use a Firestore `where` query with `screenplayId` without considering that there's no composite index:** A simple `where('screenplayId', '==', id)` on a small collection is fine without a custom index. Firestore auto-creates single-field indexes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom random string generator | `crypto.randomUUID()` | Cryptographically random, zero dependencies, pre-decided |
| Clipboard copy | Custom clipboard fallback chain | `navigator.clipboard.writeText()` | Site is HTTPS-only (Firebase Hosting), all target browsers support it |
| Confirmation dialog | New revoke confirmation component | Existing `DeleteConfirmDialog` pattern | Same UX pattern, just customize title/message |
| Toast notifications | Custom error display | Existing `useToastStore` | Already integrated project-wide in Phase 4 |

**Key insight:** This phase requires zero new libraries. Every building block exists in the codebase already.

## Common Pitfalls

### Pitfall 1: Race Condition on Double-Click Share
**What goes wrong:** Producer double-clicks Share button, two tokens get created for the same screenplay.
**Why it happens:** `useMutation` doesn't prevent concurrent calls by default.
**How to avoid:** Check `mutation.isPending` to disable the button during creation. Also, always check for an existing token first (both in store cache and Firestore).
**Warning signs:** Multiple `shared_views` docs with the same `screenplayId`.

### Pitfall 2: Clipboard API Requires Secure Context
**What goes wrong:** `navigator.clipboard.writeText()` fails silently or throws.
**Why it happens:** Only works on HTTPS or localhost.
**How to avoid:** Firebase Hosting is always HTTPS. For local dev (`localhost`), it also works. Add a try/catch and toast on failure as a safety net.
**Warning signs:** Copy button does nothing on click.

### Pitfall 3: Stale Token Cache After Revoke From Settings
**What goes wrong:** Producer revokes a link in Settings, then opens the screenplay modal -- it still shows the old link from the Zustand cache.
**Why it happens:** `shareStore` cache isn't invalidated when revoking from a different UI path.
**How to avoid:** `revokeShareToken()` must always call `useShareStore.getState().removeToken(screenplayId)` regardless of where it's called from. Centralize this in the service function.
**Warning signs:** Modal shows "Link exists" after revocation.

### Pitfall 4: toDocId() Function Not Exported
**What goes wrong:** `shareService.ts` needs the same `toDocId()` sanitizer to check if a screenplay exists in Firestore.
**Why it happens:** `toDocId()` is a private function in `analysisStore.ts`.
**How to avoid:** Either export `toDocId()` from `analysisStore.ts`, or duplicate the logic in a shared utility. Exporting is cleaner.
**Warning signs:** Firestore doc ID mismatch between analysis store and share service.

### Pitfall 5: Firestore Write Validation Mismatch
**What goes wrong:** Write to `shared_views` fails silently because the Firestore rules don't validate the document shape (currently just `allow write: if request.auth != null`).
**Why it happens:** Rules are permissive on shape but could be tightened later.
**How to avoid:** Keep the `SharedView` interface consistent. Consider adding shape validation rules to `shared_views` in a follow-up, but not blocking for Phase 5.
**Warning signs:** Malformed documents in `shared_views`.

## Code Examples

### Copy to Clipboard with Feedback
```typescript
async function handleCopy(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    useToastStore.getState().addToast('Failed to copy link to clipboard');
    return false;
  }
}
```

### Share Button Disabled State (Sync Check)
```typescript
// In ShareButton component:
// screenplay.sourceFile is the key for Firestore doc lookup
// Check pending writes via syncStatusStore or direct Firestore query
const pendingCount = useSyncStatusStore((s) => s.pendingCount);
const isSyncing = pendingCount > 0;

// Alternatively, for per-screenplay precision:
// const [isSynced, setIsSynced] = useState<boolean | null>(null);
// useEffect(() => { isScreenplaySynced(screenplay.sourceFile).then(setIsSynced); }, []);
```

### Settings Shared Links Query
```typescript
// Fetch all active share tokens for the Settings panel
export async function getAllSharedViews(): Promise<SharedView[]> {
  await authReady;
  const snapshot = await getDocs(collection(db, SHARED_VIEWS_COLLECTION));
  return snapshot.docs.map((d) => d.data() as SharedView);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `uuid` npm package | `crypto.randomUUID()` | ~2022, baseline in all evergreen browsers | No dependency needed |
| `document.execCommand('copy')` | `navigator.clipboard.writeText()` | ~2020, deprecated execCommand | Cleaner async API, requires HTTPS |
| Firestore v8 (namespaced) | Firestore v9+ (modular/tree-shakeable) | Firebase SDK v9 | Already using modular imports in codebase |

**Deprecated/outdated:**
- `document.execCommand('copy')`: Deprecated, don't use. `navigator.clipboard` is the standard.
- `uuid` npm package: Unnecessary when `crypto.randomUUID()` is available.

## Open Questions

1. **Should `toDocId()` be exported from analysisStore or extracted to a shared utility?**
   - What we know: The function is used in `analysisStore.ts` to derive Firestore doc IDs from `sourceFile`. The share service needs the same logic for the sync pre-check.
   - What's unclear: Whether moving it would break any import cycles.
   - Recommendation: Export it from `analysisStore.ts` -- it's a pure function with no dependencies, safe to export.

2. **Should the "include notes" toggle default to checked or unchecked?**
   - What we know: CONTEXT.md specifies a checkbox toggle but not the default state.
   - What's unclear: Producer's preference.
   - Recommendation: Default to unchecked (safer -- producer actively opts in to sharing notes).

3. **Should the Settings "Shared Links" tab be a new tab or a section within the existing Data tab?**
   - What we know: CONTEXT.md says "central list of active share links available in Settings."
   - What's unclear: Whether it's a new tab in the 6-tab layout or a section within Data.
   - Recommendation: Add as a section within the existing "Data" tab to avoid tab proliferation. The list is simple (title + revoke button) and doesn't need its own tab.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x + happy-dom |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test:run` |
| Full suite command | `npm run test:run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHARE-01a | createShareToken writes to Firestore and returns URL | unit | `npm run test:run -- src/lib/shareService.test.ts` | No - Wave 0 |
| SHARE-01b | revokeShareToken deletes Firestore doc | unit | `npm run test:run -- src/lib/shareService.test.ts` | No - Wave 0 |
| SHARE-01c | getExistingShareToken returns existing token or null | unit | `npm run test:run -- src/lib/shareService.test.ts` | No - Wave 0 |
| SHARE-01d | shareStore tracks tokens per screenplay | unit | `npm run test:run -- src/stores/shareStore.test.ts` | No - Wave 0 |
| SHARE-01e | shareStore removeToken clears entry | unit | `npm run test:run -- src/stores/shareStore.test.ts` | No - Wave 0 |
| SHARE-01f | ShareButton renders in modal, copy works | integration | manual-only (clipboard API + Firebase mock complexity) | N/A |

### Sampling Rate
- **Per task commit:** `npm run test:run`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/shareService.test.ts` -- covers SHARE-01a, SHARE-01b, SHARE-01c (mock Firestore)
- [ ] `src/stores/shareStore.test.ts` -- covers SHARE-01d, SHARE-01e (pure Zustand, no mocks needed)

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/lib/analysisStore.ts` -- Firestore CRUD patterns, `toDocId()`, `authReady` gate
- Project codebase: `src/stores/toastStore.ts`, `syncStatusStore.ts` -- ephemeral Zustand store patterns
- Project codebase: `firestore.rules` -- `shared_views` rules already deployed
- Project codebase: `src/components/screenplay/modal/ModalHeader.tsx` -- action bar layout for Share button placement
- Project codebase: `src/components/ui/DeleteConfirmDialog.tsx` -- confirmation dialog pattern for revoke

### Secondary (MEDIUM confidence)
- Firebase modular SDK docs (v9+) -- `setDoc`, `deleteDoc`, `getDoc`, `getDocs`, `query`, `where` APIs
- MDN Web Docs -- `crypto.randomUUID()`, `navigator.clipboard.writeText()` browser support

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used in codebase
- Architecture: HIGH -- follows established patterns from Phases 1-4
- Pitfalls: HIGH -- based on direct codebase analysis, not generic advice

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable -- no fast-moving dependencies)
