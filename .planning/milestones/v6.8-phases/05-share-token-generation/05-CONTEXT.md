# Phase 5: Share Token Generation - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Producer can generate a secure, per-screenplay shareable link from the detail modal. One link per screenplay (reuse existing token). Links are revocable. This phase generates the token and presents the link — the partner-facing shared view is Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Share button location
- Share button lives **inside the screenplay detail modal** — not on card hover
- **Primary action** styling (gold/prominent) — sharing is the key workflow outcome
- When the screenplay isn't synced to Firestore, the button is **disabled with tooltip** ("Sync pending — wait for Firestore sync before sharing")
- **Block link generation** if screenplay hasn't synced — show an error toast instead of creating a broken link

### Notes toggle
- A **checkbox toggle** lets the producer choose whether to include their notes in the shared view for each share link
- The toggle state is stored in the `shared_views` Firestore document so the partner view knows whether to show notes

### Link presentation
- After generating a link, an **inline popover** appears below the Share button with the URL + a one-click copy button
- After copying, popover **stays open** with "Copied!" feedback for 2 seconds (producer can copy again if needed)
- If a share link **already exists** for this screenplay, clicking Share shows the existing link (one link per screenplay, reuse the token)

### Token lifecycle
- Producer can **revoke** a share link via a revoke button in the share popover
- Revocation deletes the token from Firestore; partner sees "This link is no longer available"
- A **central list of active share links** is available in **Settings** showing screenplay titles + revoke buttons
- **No expiry** — links persist until manually revoked (auto-expire TTL is deferred to v2 SHARE-05)
- When a screenplay is **soft-deleted**, its share link is **automatically revoked**

### Claude's Discretion
- Share popover component implementation details (positioning, animation)
- How to check Firestore sync status for the pre-share gate (check if doc exists in Firestore, or check pending queue)
- shareStore vs inline state for tracking the popover open/close state
- Settings "Shared Links" section layout and styling

</decisions>

<specifics>
## Specific Ideas

- Share URL format: `https://lemon-screenplay-dashboard.web.app/share/{token}` (Phase 6 builds the route handler)
- Token is `crypto.randomUUID()` stored in `shared_views` Firestore collection (pre-decided)
- `shared_views` Firestore rules already deployed: `allow read: if true; allow write: if request.auth != null` (Phase 1)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `firestore.rules`: `shared_views` collection rules already deployed (Phase 1)
- `src/lib/firebase.ts`: `authReady`, `db` exports for Firestore operations
- `src/stores/toastStore.ts`: Toast system for error feedback (Phase 4)
- `src/components/ui/DeleteConfirmDialog.tsx`: Confirmation dialog pattern for revoke action
- `src/hooks/useScreenplays.ts`: Query patterns with React Query for data fetching

### Established Patterns
- Zustand stores for client state (one per domain)
- React Query for server state with `useMutation` for write operations
- `authReady` gate before all Firestore calls
- Toast notifications for user-facing errors

### Integration Points
- `src/components/screenplay/ScreenplayModal.tsx` — Mount Share button + popover
- `src/pages/SettingsPage.tsx` — Add "Shared Links" section
- `src/lib/analysisStore.ts` — Hook into soft-delete to auto-revoke share tokens
- New `src/lib/shareService.ts` — CRUD operations for `shared_views` collection

</code_context>

<deferred>
## Deferred Ideas

- SHARE-05: Auto-expire links with configurable TTL — v2 requirement
- Share analytics (view count, last accessed) — not in scope

</deferred>

---

*Phase: 05-share-token-generation*
*Context gathered: 2026-03-14*
