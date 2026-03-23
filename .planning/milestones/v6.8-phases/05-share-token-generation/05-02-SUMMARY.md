---
phase: 05-share-token-generation
plan: 02
subsystem: ui
tags: [react, zustand, clipboard-api, popover, share-tokens, firestore]

requires:
  - phase: 05-share-token-generation
    provides: shareService CRUD and shareStore session cache from Plan 01
  - phase: 04-ux-polish-scaffolding
    provides: toast store for user feedback
provides:
  - ShareButton component with inline popover (copy, revoke, notes toggle)
  - SharedLinksPanel in Settings Data tab for managing active share links
  - Auto-revoke of share tokens on soft-delete
affects: [06-partner-shared-view]

tech-stack:
  added: []
  patterns: [inline popover with click-outside dismiss, fire-and-forget revoke on delete]

key-files:
  created: [src/components/screenplay/modal/ShareButton.tsx, src/components/settings/SharedLinksPanel.tsx]
  modified: [src/components/screenplay/modal/ModalHeader.tsx, src/components/screenplay/modal/index.ts, src/pages/SettingsPage.tsx, src/hooks/useScreenplays.ts]

key-decisions:
  - "ShareButton uses inline absolute-positioned popover (no portal needed)"
  - "Auto-revoke on soft-delete is fire-and-forget to never block the delete operation"

patterns-established:
  - "Inline popover pattern: absolute-positioned div with click-outside listener for transient UI"
  - "Fire-and-forget cleanup: best-effort token revocation wrapped in try/catch, non-blocking"

requirements-completed: [SHARE-01]

duration: 4min
completed: 2026-03-14
---

# Phase 5 Plan 2: Share Token Generation UI Summary

**Gold share button with inline popover for URL copy/revoke/notes-toggle, settings shared links panel, and auto-revoke on soft-delete**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-14T06:29:00Z
- **Completed:** 2026-03-14T06:33:36Z
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 6

## Accomplishments
- ShareButton component with gold styling renders in screenplay modal action bar
- Inline popover shows generated URL with one-click copy, "Copied!" feedback, Include Notes toggle, and Revoke
- SharedLinksPanel in Settings > Data tab lists all active share links with per-link revoke
- Soft-deleting a screenplay auto-revokes its share token (fire-and-forget, never blocks delete)
- Full flow human-verified by user (generation, copy, notes toggle, revoke, auto-revoke)

## Task Commits

Each task was committed atomically:

1. **Task 1: Build ShareButton with popover, wire into ModalHeader and Settings** - `43d0d90` (feat)
2. **Task 2: Wire auto-revoke on soft-delete** - `940cce1` (feat)
3. **Task 3: Verify share token generation flow** - human-approved checkpoint (no commit)

## Files Created/Modified
- `src/components/screenplay/modal/ShareButton.tsx` - Gold share button with inline popover (copy, revoke, notes toggle, sync check)
- `src/components/settings/SharedLinksPanel.tsx` - Settings panel listing active share links with revoke buttons
- `src/components/screenplay/modal/ModalHeader.tsx` - Added ShareButton to action bar
- `src/components/screenplay/modal/index.ts` - Barrel export for ShareButton
- `src/pages/SettingsPage.tsx` - Added SharedLinksPanel to Data tab
- `src/hooks/useScreenplays.ts` - Auto-revoke share tokens on soft-delete

## Decisions Made
- ShareButton uses inline absolute-positioned popover (no portal needed) -- keeps component self-contained
- Auto-revoke on soft-delete is fire-and-forget (try/catch, no await) so token cleanup never blocks or errors the delete operation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Share token generation complete (service + UI + management + cleanup)
- Phase 6 (Partner Shared View) can build the public viewer that consumes these tokens
- All SHARE-01 requirements satisfied

## Self-Check: PASSED

- FOUND: src/components/screenplay/modal/ShareButton.tsx
- FOUND: src/components/settings/SharedLinksPanel.tsx
- FOUND: src/components/screenplay/modal/ModalHeader.tsx
- FOUND: src/components/screenplay/modal/index.ts
- FOUND: src/pages/SettingsPage.tsx
- FOUND: src/hooks/useScreenplays.ts
- FOUND: commit 43d0d90 (Task 1)
- FOUND: commit 940cce1 (Task 2)

---
*Phase: 05-share-token-generation*
*Completed: 2026-03-14*
