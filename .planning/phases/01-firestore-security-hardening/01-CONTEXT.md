# Phase 1: Firestore Security Hardening - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Tighten Firestore security rules and add anonymous authentication so the database is protected before any share links go external. Storage (PDFs, posters) stays publicly readable. App Check is NOT re-enabled this phase.

</domain>

<decisions>
## Implementation Decisions

### Access Model
- Use Firebase Anonymous Authentication — dashboard silently creates an anonymous session on load
- No login screen, no user accounts — the experience feels identical to today
- Firestore rules switch from `allow read: if true` to `allow read: if request.auth != null` for internal collections
- The `shared_views` collection (created in Phase 5) will be readable by token lookup only

### App Check
- Skip App Check re-enablement — it was disabled due to a reCAPTCHA provider mismatch causing 400 errors on all Firebase calls
- Anonymous auth provides sufficient protection for an internal tool
- App Check can be revisited later if bot abuse becomes a problem

### Storage Rules
- Keep Storage publicly readable (`allow read: if true`) for both PDFs and posters
- Partners download screenplay PDFs directly via Firebase Storage URLs — no token gating
- Write rules (size limits, content type checks) stay as-is

### Producer Notes Visibility
- `screenplay_feedback` collection stays readable — notes are intentionally visible
- Partners seeing producer notes on shared views is a feature, not a security concern

### Claude's Discretion
- How to initialize anonymous auth (App.tsx provider vs firebase.ts init)
- Whether to add auth state persistence (localStorage vs session)
- Exact Firestore rule syntax for the `shared_views` collection (pre-create the rule structure even though Phase 5 creates the collection)
- Rollback strategy if rule changes break existing functionality

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/firebase.ts`: Firebase app initialization — anonymous auth init goes here
- `firestore.rules`: Current rules with helper functions (`onlyHasKeys`, `validString`) already defined
- `storage.rules`: Current storage rules with size/content-type validation already in place

### Established Patterns
- Firebase SDK already imported and initialized in `firebase.ts`
- All Firestore operations go through `firebase/firestore` SDK (setDoc, getDocs, deleteDoc)
- App uses `getFirestore(app)` — auth state will be available on the same app instance

### Integration Points
- `src/lib/firebase.ts` — Add anonymous auth initialization
- `firestore.rules` — Rewrite read rules from `if true` to `if request.auth != null`
- `src/lib/api.ts` — May need to wait for auth before Firestore reads
- `src/lib/analysisStore.ts` — Firestore writes may need auth state check
- Main `App.tsx` or `main.tsx` — Ensure auth initializes before first Firestore call

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The key constraint is that the dashboard must feel identical to the user after this change (no login screen, no perceptible delay).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-firestore-security-hardening*
*Context gathered: 2026-03-13*
