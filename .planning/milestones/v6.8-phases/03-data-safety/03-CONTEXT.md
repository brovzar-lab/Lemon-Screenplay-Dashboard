# Phase 3: Data Safety - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deleted screenplays are recoverable for 30 days via soft-delete. Unrecognized data formats are quarantined instead of permanently destroyed. No changes to the upload or analysis pipeline — only the delete and data validation paths.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
User deferred all implementation choices to Claude. The following areas are all open for Claude to decide based on what's most efficient:

- **Recovery access** — Where the producer finds deleted screenplays (Settings tab, trash icon, separate page), how prominent recovery should be
- **Quarantine visibility** — Whether quarantined documents are visible to the producer (admin view, banner notification, silent move)
- **Deletion confirmation** — Whether to add confirmation dialogs or undo toasts, or keep current flow since soft-delete makes it recoverable
- **TTL enforcement** — How the 30-day window is enforced (client-side filter vs Cloud Function cleanup)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — user wants the most efficient implementation approach.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `analysisStore.ts`: `removeAnalysis()`, `clearAllAnalyses()`, `removeMultipleAnalyses()` — all current delete call sites that need soft-delete conversion
- `analysisStore.ts`: `isV6RawAnalysis()` type guard — used during data loading, failures here should trigger quarantine
- `src/types/screenplay-v6.ts`: V6 type definitions for the type guard
- `firestore.rules`: Already has auth guards on `uploaded_analyses` collection

### Established Patterns
- Firestore document operations via `setDoc`, `getDocs`, `deleteDoc` from firebase/firestore
- `authReady` gate on all Firestore calls (Phase 1)
- Zustand stores for client state, React Query for server state
- Settings page (`src/pages/SettingsPage.tsx`) has existing sections for data management

### Integration Points
- `src/lib/analysisStore.ts` — Convert delete functions to soft-delete (add `deleted_at` field instead of `deleteDoc`)
- `src/lib/api.ts` — Filter out soft-deleted docs during load
- `src/pages/SettingsPage.tsx` — Likely home for "Recently Deleted" recovery UI
- `firestore.rules` — May need rule updates if `_unrecognized_analyses` collection is created

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-data-safety*
*Context gathered: 2026-03-14*
