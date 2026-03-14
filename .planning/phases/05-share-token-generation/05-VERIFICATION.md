---
phase: 05-share-token-generation
verified: 2026-03-14T01:00:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
human_verification:
  - test: "Gold Share button visible in screenplay modal action bar"
    expected: "A gold-styled Share button appears before Reanalyze/PDF/Delete buttons in the modal header action bar"
    why_human: "Visual styling (gold bg-gold-500/90 class) and button position cannot be confirmed without rendering"
  - test: "Clicking Share generates a token and shows popover"
    expected: "Popover appears with a generated URL in the format https://lemon-screenplay-dashboard.web.app/share/{uuid}"
    why_human: "Requires live Firestore write and DOM render; cannot simulate crypto.randomUUID + Firestore in static analysis"
  - test: "Copy-to-clipboard shows Copied! feedback for 2 seconds, popover stays open"
    expected: "Copy button changes to Copied! text (green) then resets; popover remains visible"
    why_human: "Clipboard API and timed state reset require browser execution"
  - test: "Include Notes checkbox updates Firestore doc on toggle"
    expected: "Toggling the checkbox fires setDoc with merge:true to update the includeNotes field"
    why_human: "Firestore side-effect requires live environment to confirm"
  - test: "Share button is disabled with tooltip when screenplay is not synced"
    expected: "Button has cursor-not-allowed styling and title='Sync pending -- wait for Firestore sync before sharing'"
    why_human: "Requires live isScreenplaySynced call returning false to observe disabled state"
  - test: "Soft-delete auto-revokes associated share token"
    expected: "After deleting a screenplay, its share link no longer appears in Settings > Data tab"
    why_human: "Requires live Firestore interaction across delete and revoke mutations"
---

# Phase 5: Share Token Generation — Verification Report

**Phase Goal:** Producer can generate a secure, per-screenplay shareable link that does not expose the full dashboard or any other screenplay
**Verified:** 2026-03-14
**Status:** human_needed (all automated checks passed; 6 items require human testing)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Plan 01)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | createShareToken writes a shared_views doc to Firestore and returns a URL with the token | VERIFIED | `shareService.ts` line 47-70: awaits authReady, calls `setDoc` with full SharedView shape, returns `{ token, url }` with `SHARE_BASE_URL/${token}` |
| 2 | getExistingShareToken finds an existing token for a screenplay or returns null | VERIFIED | `shareService.ts` line 93-107: queries `shared_views` with `where('screenplayId', '==', ...)`, returns `snapshot.docs[0].data()` or `null` |
| 3 | revokeShareToken deletes the shared_views doc from Firestore | VERIFIED | `shareService.ts` line 76-87: awaits authReady, calls `deleteDoc`, then calls `useShareStore.getState().removeToken(screenplayId)` |
| 4 | isScreenplaySynced checks Firestore for the screenplay doc before sharing | VERIFIED | `shareService.ts` line 125-132: queries `uploaded_analyses/{toDocId(sourceFile)}`, returns `snapshot.exists()` |
| 5 | shareStore caches active tokens keyed by screenplayId for the session | VERIFIED | `shareStore.ts` line 23-38: Zustand store with `tokens: Record<string, SharedView>`, `setToken`, `removeToken`, `clearAll`, no persist middleware |

### Observable Truths (Plan 02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | Producer sees a gold Share button in the screenplay detail modal action bar | VERIFIED (human needed for visual) | `ShareButton.tsx` line 191-195: `bg-gold-500/90 hover:bg-gold-400 text-black-900` classes applied; `ModalHeader.tsx` line 137: `<ShareButton screenplay={screenplay} />` first in action div |
| 7 | Clicking Share checks for an existing token first, creates one only if none exists | VERIFIED | `ShareButton.tsx` line 125-141: `handleClick` branches on `cachedToken` — shows popover if cached, calls `createMutation.mutate()` only if not cached |
| 8 | An inline popover shows the share URL with a one-click copy button | VERIFIED | `ShareButton.tsx` line 243-337: `{showPopover && cachedToken}` renders absolute-positioned popover with URL display, Copy button, and clipboard write |
| 9 | Producer can toggle whether notes are included via a checkbox before generating | VERIFIED | `ShareButton.tsx` line 294-302: checkbox bound to `includeNotes` state; line 159-180: `handleNotesToggle` calls `setDoc` merge on existing token |
| 10 | Producer can revoke a share link from the popover | VERIFIED | `ShareButton.tsx` line 111-122: revokeMutation calls `revokeShareToken(cachedToken.token, screenplayId)`; two-step confirm UI at line 306-335 |
| 11 | Share button is disabled with tooltip when screenplay is not synced to Firestore | VERIFIED (human needed) | `ShareButton.tsx` line 182-183: `isDisabled = synced === false \|\| isPending \|\| synced === null`; line 196-201: title attribute set to sync-pending message |
| 12 | Settings Data tab shows a list of all active share links with revoke buttons | VERIFIED | `SettingsPage.tsx` line 105: `<SharedLinksPanel />`; `SharedLinksPanel.tsx` line 15-27: useQuery on `['shared-views']` via `getAllSharedViews`, revoke per-row |
| 13 | Soft-deleting a screenplay auto-revokes its share token | VERIFIED (human needed) | `useScreenplays.ts` line 67-87: `onSuccess` iterates deleted sourceFiles, checks cache then Firestore, calls `revokeShareToken` fire-and-forget in try/catch |

**Score:** 13/13 truths verified (6 require human confirmation of runtime behavior)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/shareService.ts` | Firestore CRUD for shared_views | VERIFIED | 132 lines; exports `createShareToken`, `revokeShareToken`, `getExistingShareToken`, `getAllSharedViews`, `isScreenplaySynced`, `SharedView` |
| `src/lib/shareService.test.ts` | Unit tests, min 40 lines | VERIFIED | 160 lines; 8 tests covering all 5 service functions |
| `src/stores/shareStore.ts` | Ephemeral Zustand session cache | VERIFIED | 38 lines; exports `useShareStore` with `setToken`, `removeToken`, `clearAll`; no persist middleware |
| `src/stores/shareStore.test.ts` | Unit tests, min 20 lines | VERIFIED | 69 lines; 5 tests for all 3 store actions |
| `src/components/screenplay/modal/ShareButton.tsx` | Share button + inline popover, min 80 lines | VERIFIED | 340 lines; full implementation with copy, revoke, notes toggle, sync check |
| `src/components/settings/SharedLinksPanel.tsx` | Settings shared links list, min 40 lines | VERIFIED | 78 lines; useQuery + revoke mutation + loading/empty states |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/shareService.ts` | `src/lib/firebase.ts` | `await authReady` + `db` import | WIRED | Line 21: `import { authReady, db } from './firebase'`; all 5 functions `await authReady` before Firestore ops |
| `src/lib/shareService.ts` | `src/lib/analysisStore.ts` | `toDocId` import for sync check | WIRED | Line 22: `import { toDocId } from './analysisStore'`; `analysisStore.ts` line 35: `export function toDocId` |
| `src/components/screenplay/modal/ShareButton.tsx` | `src/lib/shareService.ts` | createShareToken, revokeShareToken, getExistingShareToken, isScreenplaySynced | WIRED | Lines 13-17: imports all four functions; all called in component body |
| `src/components/screenplay/modal/ShareButton.tsx` | `src/stores/shareStore.ts` | `useShareStore` for session cache | WIRED | Line 18: `import { useShareStore }`; used at line 39 (hook) and lines 62, 96, 168 (getState) |
| `src/components/screenplay/modal/ModalHeader.tsx` | `src/components/screenplay/modal/ShareButton.tsx` | mounted in action bar | WIRED | Line 13: `import { ShareButton }`; line 137: `<ShareButton screenplay={screenplay} />` |
| `src/hooks/useScreenplays.ts` | `src/lib/shareService.ts` | auto-revoke on soft-delete | WIRED | Line 8: `import { getExistingShareToken, revokeShareToken }`; lines 72, 79: both called in `onSuccess` |
| `src/components/settings/SharedLinksPanel.tsx` | `src/lib/shareService.ts` | getAllSharedViews + revokeShareToken | WIRED | Line 7: `import { getAllSharedViews, revokeShareToken }`; lines 17, 23: both called |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SHARE-01 | 05-01, 05-02 | User can generate a shareable link for any single screenplay | SATISFIED | Full service layer (createShareToken, revokeShareToken, getExistingShareToken) + UI layer (ShareButton in modal, SharedLinksPanel in settings) implemented and wired |

**Note:** SHARE-02, SHARE-03, SHARE-04 are assigned to Phase 6. No orphaned requirements for Phase 5.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/shareService.ts` | 103 | `return null` | Info | Intentional — correct return type for `getExistingShareToken: Promise<SharedView \| null>` when no doc found |

No blocker or warning anti-patterns found. No TODO/FIXME/placeholder comments, no empty implementations, no stub handlers.

---

## Human Verification Required

The following items passed all static/automated checks but require browser execution against a live Firestore instance to fully confirm:

### 1. Gold Share Button Visual Appearance

**Test:** Run `npm run dev`, open any screenplay modal.
**Expected:** A gold-styled "Share" button appears as the first button in the action bar (before Reanalyze, PDF, Delete).
**Why human:** CSS class rendering (`bg-gold-500/90`) and visual position in the flex layout require a browser.

### 2. Token Generation and Popover

**Test:** Click the Share button on a synced screenplay.
**Expected:** Popover opens with a URL in the format `https://lemon-screenplay-dashboard.web.app/share/{uuid}`.
**Why human:** Requires a live Firestore write (`setDoc` on `shared_views`) and DOM popover render.

### 3. Copy-to-Clipboard with Feedback

**Test:** In the popover, click Copy.
**Expected:** Button text changes to "Copied!" for 2 seconds, then resets to "Copy". Popover stays open. Clipboard contains the share URL.
**Why human:** Clipboard API and timed state reset require browser execution.

### 4. Notes Toggle Updates Firestore

**Test:** In the popover, toggle the "Include notes" checkbox.
**Expected:** The checkbox state changes and a `setDoc` merge call updates `includeNotes` in the Firestore doc.
**Why human:** Firestore side-effect requires a live environment; no UI confirmation is shown beyond the checkbox state.

### 5. Disabled State When Not Synced

**Test:** Trigger the share button on a screenplay whose `sourceFile` does not exist in `uploaded_analyses`.
**Expected:** Button shows disabled styling (dark, cursor-not-allowed) and tooltip reads "Sync pending -- wait for Firestore sync before sharing".
**Why human:** Requires `isScreenplaySynced` to return `false` for a specific screenplay, which depends on live Firestore state.

### 6. Auto-Revoke on Soft-Delete

**Test:** Generate a share link for a screenplay, then delete that screenplay from the dashboard. Open Settings > Data tab.
**Expected:** The share link no longer appears in the Shared Links list.
**Why human:** Requires the fire-and-forget revoke path to complete successfully against live Firestore; involves two mutations (`deleteAnalysis` + `revokeShareToken`).

---

## Build and Test Status

- **Build:** Passed (`npm run build` succeeds with no TypeScript errors)
- **Tests:** 13/13 passing (`shareService.test.ts`: 8 tests, `shareStore.test.ts`: 5 tests)

---

## Summary

Phase 5 goal is structurally achieved. The complete share token generation system is in place:

- **Service layer** (`shareService.ts`): Full Firestore CRUD for the `shared_views` collection, gated on `authReady`, using `crypto.randomUUID()` for tokens. All five functions implemented and tested.
- **Session cache** (`shareStore.ts`): Ephemeral Zustand store with no persistence, matching project patterns.
- **UI layer** (`ShareButton.tsx`): Gold-styled button with inline popover (copy, notes toggle, two-step revoke confirm), sync pre-check, and duplicate-creation guard.
- **Settings panel** (`SharedLinksPanel.tsx`): Lists active share links with per-link revoke, backed by React Query with cache invalidation.
- **Auto-revoke** (`useScreenplays.ts`): Fire-and-forget revoke in `onSuccess` of delete mutation, with cache-first lookup and Firestore fallback.
- **`toDocId` export** (`analysisStore.ts`): Function made public for reuse by `isScreenplaySynced`.

All 13 observable truths are verified by static analysis. 6 truths additionally require human testing to confirm runtime behavior against live Firestore.

---

_Verified: 2026-03-14_
_Verifier: Claude (gsd-verifier)_
