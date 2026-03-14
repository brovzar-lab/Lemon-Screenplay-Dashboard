# Phase 3: Data Safety - Research

**Researched:** 2026-03-13
**Domain:** Firestore soft-delete pattern, data quarantine, recovery UI
**Confidence:** HIGH

## Summary

Phase 3 converts destructive delete operations to soft-delete (adding a `deleted_at` timestamp instead of removing documents) and replaces the destructive handling of unrecognized data formats with a quarantine pattern (moving documents to `_unrecognized_analyses` instead of deleting them). A recovery UI surface is needed for the producer to access soft-deleted screenplays.

The codebase has a clean, well-contained architecture for this change. All delete operations flow through three functions in `src/lib/analysisStore.ts` (`removeAnalysis`, `removeMultipleAnalyses`, `clearAllAnalyses`), and all type-guard failures are handled in two locations in `src/lib/api.ts` (lines 67-72 and 74-79). The dual-write pattern (localStorage + Firestore) means both stores must be kept consistent with the soft-delete/quarantine semantics.

**Primary recommendation:** Implement soft-delete as an `updateDoc` setting `deleted_at` on existing documents (not moving to a separate collection), filter soft-deleted docs at load time, and move type-guard failures to `_unrecognized_analyses` via `setDoc` + `deleteDoc` from the source collection.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- user deferred all implementation choices to Claude.

### Claude's Discretion
- **Recovery access** -- Where the producer finds deleted screenplays (Settings tab, trash icon, separate page), how prominent recovery should be
- **Quarantine visibility** -- Whether quarantined documents are visible to the producer (admin view, banner notification, silent move)
- **Deletion confirmation** -- Whether to add confirmation dialogs or undo toasts, or keep current flow since soft-delete makes it recoverable
- **TTL enforcement** -- How the 30-day window is enforced (client-side filter vs Cloud Function cleanup)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SYNC-03 | Deleted screenplays are soft-deleted with 30-day recovery window | Soft-delete pattern via `deleted_at` field on existing docs; client-side 30-day filter; Recovery UI in Settings Data tab |
| SYNC-04 | Unrecognized data formats are quarantined (archived), not permanently deleted | Quarantine via `_unrecognized_analyses` collection; `setDoc` to quarantine + `deleteDoc` from source; Firestore rules for new collection |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| firebase/firestore | 11.x (already installed) | `updateDoc` for soft-delete, `setDoc`/`deleteDoc` for quarantine | Already in use; `updateDoc` is the idiomatic way to set a field without replacing the doc |
| @tanstack/react-query | 5.x (already installed) | Cache invalidation after restore/delete operations | Existing pattern via `useDeleteScreenplays` mutation |
| zustand | 5.x (already installed) | No new store needed; existing patterns sufficient | Follows project convention |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `updateDoc` (firebase/firestore) | Already available | Set `deleted_at` field without replacing entire document | Soft-delete and restore operations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `deleted_at` field on same doc | Separate `deleted_analyses` collection | Moving docs is more complex (copy + delete = two operations, race conditions); field approach is simpler and preserves doc IDs |
| Client-side 30-day filter | Cloud Function scheduled cleanup | Cloud Function requires Firebase Blaze plan + deployment; client-side filter is zero-cost and sufficient for a single-user tool |

**Installation:**
No new packages needed. `updateDoc` is already available from `firebase/firestore`.

## Architecture Patterns

### Recommended Changes to Existing Structure
```
src/
├── lib/
│   ├── analysisStore.ts          # MODIFY: soft-delete + quarantine functions
│   ├── api.ts                    # MODIFY: filter soft-deleted, quarantine instead of delete
├── hooks/
│   ├── useScreenplays.ts         # MODIFY: add useRestoreScreenplay, useDeletedScreenplays hooks
├── components/
│   └── settings/
│       └── DataManagement.tsx    # MODIFY: add "Recently Deleted" section
├── firestore.rules               # MODIFY: add _unrecognized_analyses rules
```

### Pattern 1: Soft-Delete via `deleted_at` Field
**What:** Instead of `deleteDoc()`, use `updateDoc()` to set `deleted_at: new Date().toISOString()` on the document. Filter these out during load.
**When to use:** All user-initiated delete operations.
**Example:**
```typescript
// In analysisStore.ts
import { updateDoc } from 'firebase/firestore';

export async function softDeleteAnalysis(sourceFile: string): Promise<void> {
    const deletedAt = new Date().toISOString();

    // Step 1: Mark as deleted in localStorage immediately
    const existing = readFromLocal();
    const updated = existing.map((a) =>
        a.source_file === sourceFile
            ? { ...a, _deleted_at: deletedAt }
            : a
    );
    writeToLocal(updated);

    // Step 2: Mark as deleted in Firestore
    await authReady;
    const docId = toDocId(sourceFile);
    try {
        await updateDoc(doc(db, FIRESTORE_COLLECTION, docId), {
            _deleted_at: deletedAt,
        });
    } catch (err) {
        console.warn(`[Lemon] Firestore soft-delete failed for ${docId}:`, err);
    }
}
```

### Pattern 2: Quarantine via Collection Move
**What:** When `isV6RawAnalysis()` fails, copy the document to `_unrecognized_analyses` collection, then delete from source. Preserves the raw data for manual review.
**When to use:** In `loadAllScreenplaysVite()` when the type guard fails.
**Example:**
```typescript
// In api.ts - replace the removeAnalysis calls
async function quarantineAnalysis(raw: Record<string, unknown>, reason: string): Promise<void> {
    const sourceFile = (raw as Record<string, unknown>).source_file as string | undefined;
    if (!sourceFile) return;

    await authReady;
    const docId = toDocId(sourceFile);
    try {
        // Copy to quarantine collection with metadata
        await setDoc(doc(db, '_unrecognized_analyses', docId), {
            ...raw,
            _quarantined_at: new Date().toISOString(),
            _quarantine_reason: reason,
            _original_collection: FIRESTORE_COLLECTION,
        });
        // Remove from source
        await deleteDoc(doc(db, FIRESTORE_COLLECTION, docId));
    } catch (err) {
        console.warn(`[Lemon] Quarantine failed for ${sourceFile}:`, err);
    }
}
```

### Pattern 3: Restore from Soft-Delete
**What:** Remove `_deleted_at` field to restore a screenplay. Use `updateDoc` with `deleteField()`.
**Example:**
```typescript
import { updateDoc, deleteField } from 'firebase/firestore';

export async function restoreAnalysis(sourceFile: string): Promise<void> {
    // Restore in localStorage
    const existing = readFromLocal();
    const updated = existing.map((a) =>
        a.source_file === sourceFile
            ? (() => { const { _deleted_at, ...rest } = a; return rest; })()
            : a
    );
    writeToLocal(updated);

    // Restore in Firestore
    await authReady;
    const docId = toDocId(sourceFile);
    await updateDoc(doc(db, FIRESTORE_COLLECTION, docId), {
        _deleted_at: deleteField(),
    });
}
```

### Pattern 4: Load Deleted Screenplays for Recovery UI
**What:** Provide a separate function that returns only soft-deleted items within the 30-day window.
**Example:**
```typescript
export function getDeletedAnalyses(): Record<string, unknown>[] {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return readFromLocal().filter((a) => {
        const deletedAt = a._deleted_at as string | undefined;
        if (!deletedAt) return false;
        return new Date(deletedAt) > thirtyDaysAgo;
    });
}
```

### Anti-Patterns to Avoid
- **Moving soft-deleted docs to a separate collection:** Adds complexity (two operations per delete), doc IDs may collide, harder to restore. Keep them in-place with a field marker.
- **Permanent deletion in quarantine flow:** The entire point of quarantine is data preservation. Never `deleteDoc` from `_unrecognized_analyses` unless explicitly requested.
- **Filtering soft-deleted in Firestore queries:** This would require composite indexes. Filter client-side since we already load all docs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TTL enforcement (30-day expiry) | Custom Cloud Function | Client-side date filter | Single-user tool; no need for server-side cleanup. Expired items are simply filtered out at load time and eventually ignored. |
| Undo/redo stack | Full undo system | Soft-delete + restore button | Requirements explicitly say "Full undo/redo stack" is out of scope |
| Batch operations UI | Custom multi-select for deleted items | Simple list with individual restore buttons | Recovery is an infrequent operation; keep it simple |

**Key insight:** This is a single-user internal tool. Server-side TTL enforcement, complex batch operations, and elaborate recovery workflows are unnecessary. Client-side filtering and a simple recovery list in Settings are sufficient.

## Common Pitfalls

### Pitfall 1: localStorage and Firestore Inconsistency
**What goes wrong:** Soft-deleted items appear in one store but not the other, causing ghost entries or missing items.
**Why it happens:** The dual-write pattern means both stores must stay in sync. If a soft-delete succeeds in localStorage but fails in Firestore, the item reappears on next background sync (Firestore is authoritative).
**How to avoid:** Always write to localStorage first (optimistic), then Firestore. On background sync, respect `_deleted_at` from Firestore data. When syncing, do NOT strip `_deleted_at` -- it must round-trip through both stores.
**Warning signs:** Items reappearing after deletion, or missing from recovery view.

### Pitfall 2: `backgroundFirestoreSync` Overwrites Soft-Delete State
**What goes wrong:** The existing `backgroundFirestoreSync` strips internal fields (`_savedAt`, `_docId`) when loading from Firestore. If `_deleted_at` is also stripped, soft-delete state is lost on next session.
**Why it happens:** Lines 160-162 of `analysisStore.ts` filter out keys starting with `_`.
**How to avoid:** Update the filter to preserve `_deleted_at` (and `_quarantined_at` if relevant). Change the filter from `k !== '_savedAt' && k !== '_docId'` to explicitly list only the fields to strip, or use a different prefix convention.
**Warning signs:** Deleted items reappearing after page reload.

### Pitfall 3: Quarantine Firestore Rules Missing
**What goes wrong:** Writes to `_unrecognized_analyses` are blocked by the catch-all deny rule in `firestore.rules`.
**Why it happens:** Only `uploaded_analyses`, `screenplay_feedback`, `producer_profiles`, and `shared_views` have explicit allow rules. The catch-all `match /{document=**}` denies everything else.
**How to avoid:** Add a rule for `_unrecognized_analyses` with `allow read, write: if request.auth != null`.
**Warning signs:** Quarantine operations silently failing with permission denied errors.

### Pitfall 4: `clearAllAnalyses` Should Also Soft-Delete, Not Hard-Delete
**What goes wrong:** The "Delete All Screenplays" button in DataManagement bypasses soft-delete.
**Why it happens:** `clearAllAnalyses` uses `deleteDoc` directly. If not updated, it destroys all data permanently, defeating the purpose of soft-delete.
**How to avoid:** Convert `clearAllAnalyses` to batch `updateDoc` with `_deleted_at` field.
**Warning signs:** "Delete All" permanently removes data with no recovery option.

### Pitfall 5: Existing `removeAnalysis` Calls in api.ts Are Quarantine Targets
**What goes wrong:** The two `removeAnalysis` calls in `api.ts` (lines 71 and 78) delete documents that fail the type guard or normalization. These are exactly the documents that should be quarantined instead.
**Why it happens:** The current code treats unrecognized data as garbage to clean up.
**How to avoid:** Replace both `removeAnalysis` calls with the new `quarantineAnalysis` function. Pass appropriate reason strings ("failed isV6RawAnalysis type guard" vs "normalization error").
**Warning signs:** Data being permanently deleted despite quarantine implementation.

## Code Examples

### All Delete Call Sites (Must Be Updated)

**1. `analysisStore.ts:removeAnalysis()` (line 269)**
- Called by: `useDeleteScreenplays` hook, `api.ts` type-guard failures
- Change to: soft-delete (add `_deleted_at` via `updateDoc`)

**2. `analysisStore.ts:removeMultipleAnalyses()` (line 332)**
- Called by: `useDeleteScreenplays` hook (bulk delete)
- Change to: batch soft-delete

**3. `analysisStore.ts:clearAllAnalyses()` (line 289)**
- Called by: `DataManagement.tsx` "Delete All" button
- Change to: batch soft-delete

**4. `api.ts` line 67-72 (type guard failure)**
- Called during: `loadAllScreenplaysVite()` when `isV6RawAnalysis()` returns false
- Change to: quarantine to `_unrecognized_analyses`

**5. `api.ts` line 74-79 (normalization error)**
- Called during: `loadAllScreenplaysVite()` when `normalizeV6Screenplay()` throws
- Change to: quarantine to `_unrecognized_analyses`

### Loading Filter for Soft-Deleted Items
```typescript
// In loadAllScreenplaysVite() or the localStorage read path:
// Filter out soft-deleted items from the main view
const activeItems = localRawList.filter((raw) => !raw._deleted_at);
```

### Firestore Rules for Quarantine Collection
```
// In firestore.rules
match /_unrecognized_analyses/{docId} {
    allow read, write: if request.auth != null;
}
```

## Discretion Recommendations

Based on analysis of the codebase and the single-user nature of this tool:

### Recovery Access: Settings > Data tab
**Recommendation:** Add a "Recently Deleted" section to the existing `DataManagement.tsx` component.
**Rationale:** The Data tab already handles "Delete All Screenplays" and data export. Recovery belongs in the same location. Adding a new top-level tab is excessive for what will be an infrequently-used feature. Show count of recoverable items, expandable list with title + deletion date + restore button.

### Quarantine Visibility: Subtle count in Data tab
**Recommendation:** Show a small info banner in the Data tab if quarantined documents exist (e.g., "3 unrecognized documents quarantined"). Link to expand and view them. No notification outside Settings -- this is a background safety net, not an alert.
**Rationale:** The producer is not a technical user. Quarantine is a safety mechanism, not a workflow feature. It should be discoverable but not noisy.

### Deletion Confirmation: Keep current flow
**Recommendation:** Do not add confirmation dialogs to individual deletes. Soft-delete makes them recoverable, so the friction of a confirmation dialog is unnecessary. The "Delete All" button already has a `DeleteConfirmDialog` -- keep that.
**Rationale:** Soft-delete IS the safety net. Adding confirmation on top of soft-delete is redundant UX friction.

### TTL Enforcement: Client-side filter only
**Recommendation:** Filter out items older than 30 days at load time. Do not create a Cloud Function for cleanup. Stale soft-deleted docs in Firestore are harmless for a single-user tool.
**Rationale:** Zero operational cost. Stale docs consume negligible Firestore storage. If cleanup is ever desired, it can be a manual "Purge expired" button in Settings.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `deleteDoc()` for removals | `updateDoc()` with `_deleted_at` | This phase | All delete operations become recoverable |
| `removeAnalysis()` for type-guard failures | `quarantineAnalysis()` to separate collection | This phase | Unrecognized data preserved for review |
| No recovery UI | "Recently Deleted" section in Settings Data tab | This phase | Producer can restore accidentally deleted items |

## Open Questions

1. **Should `clearAllAnalyses` also soft-delete?**
   - What we know: It's called from "Delete All Screenplays" in Danger Zone. The user expects this to be a serious action.
   - What's unclear: Should "Delete All" be recoverable? A 30-day recovery of 500+ screenplays seems like a storage concern, but for a single-user tool it's negligible.
   - Recommendation: Yes, soft-delete all. The "Reset Everything" button (which calls `localStorage.clear()`) remains as the true nuclear option.

2. **Should quarantined documents be restorable to the main collection?**
   - What we know: SYNC-04 says they should be "accessible to the producer for manual review."
   - What's unclear: Does "accessible" mean viewable-only or also restorable?
   - Recommendation: View-only for now (show raw JSON or key fields). Restoration would require the data to pass the type guard, which it already failed. A "re-import" action could be a future enhancement.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vitest.config.ts) |
| Config file | vitest.config.ts |
| Quick run command | `npm run test:run -- --testPathPattern=analysisStore` |
| Full suite command | `npm run test:run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-03a | `softDeleteAnalysis` sets `_deleted_at` in localStorage and Firestore | unit | `npm run test:run -- src/lib/analysisStore.test.ts` | Exists but needs new tests |
| SYNC-03b | `loadAllAnalyses` / `loadAllScreenplaysVite` filters out soft-deleted items | unit | `npm run test:run -- src/lib/analysisStore.test.ts` | Exists but needs new tests |
| SYNC-03c | `restoreAnalysis` removes `_deleted_at` field | unit | `npm run test:run -- src/lib/analysisStore.test.ts` | Needs new tests |
| SYNC-03d | `getDeletedAnalyses` returns only items within 30-day window | unit | `npm run test:run -- src/lib/analysisStore.test.ts` | Needs new tests |
| SYNC-03e | `backgroundFirestoreSync` preserves `_deleted_at` field | unit | `npm run test:run -- src/lib/analysisStore.test.ts` | Needs new tests |
| SYNC-04a | Type-guard failure triggers quarantine instead of delete | unit | `npm run test:run -- src/lib/api.test.ts` | Needs new file |
| SYNC-04b | Quarantine writes to `_unrecognized_analyses` with metadata | unit | `npm run test:run -- src/lib/analysisStore.test.ts` | Needs new tests |

### Sampling Rate
- **Per task commit:** `npm run test:run -- --testPathPattern="analysisStore|api"`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test cases in `src/lib/analysisStore.test.ts` for soft-delete, restore, getDeleted, and quarantine functions
- [ ] New test file `src/lib/api.test.ts` (or add to existing) for quarantine-on-type-guard-failure behavior
- [ ] Mock for `updateDoc` and `deleteField` in test setup (currently only `setDoc`, `deleteDoc`, `getDocs` are mocked)

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of `src/lib/analysisStore.ts` -- all delete call sites identified
- Direct codebase analysis of `src/lib/api.ts` -- both type-guard failure paths identified
- Direct codebase analysis of `firestore.rules` -- confirmed catch-all deny blocks new collections
- Firebase Firestore SDK -- `updateDoc`, `deleteField` are standard operations for field-level updates

### Secondary (MEDIUM confidence)
- Soft-delete pattern is a well-established database pattern; field-based approach is standard for Firestore
- Client-side TTL filtering is adequate for single-user applications

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all operations use existing Firebase SDK
- Architecture: HIGH -- all call sites identified, clear modification paths, existing test patterns to follow
- Pitfalls: HIGH -- identified from direct code reading (the `_` field stripping in backgroundFirestoreSync is a real trap)

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable domain, no external dependencies)
