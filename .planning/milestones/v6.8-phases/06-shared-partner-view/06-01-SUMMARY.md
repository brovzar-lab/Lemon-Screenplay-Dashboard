---
phase: 06-shared-partner-view
plan: 01
subsystem: api
tags: [firestore, share-token, snapshot, firebase-storage]

requires:
  - phase: 05-share-token-generation
    provides: shareService with createShareToken, revokeShareToken, ShareButton UI
provides:
  - SharedViewDocument type with embedded analysis snapshot
  - resolveShareToken for public (no-auth) Firestore reads
  - Snapshot-based createShareToken with pdfUrl resolution and notes
  - Lemon Studios logo at /lemon-logo.png
affects: [06-shared-partner-view]

tech-stack:
  added: []
  patterns: [snapshot-at-creation for public access, no-authReady for partner reads]

key-files:
  created: [public/lemon-logo.png]
  modified: [src/lib/shareService.ts, src/lib/shareService.test.ts, src/components/screenplay/modal/ShareButton.tsx]

key-decisions:
  - "Analysis data is fully embedded in shared_views doc at creation time (snapshot pattern)"
  - "resolveShareToken bypasses authReady for public partner access"
  - "pdfUrl resolved via getDownloadURL at share creation, stored as null if PDF not found"
  - "Notes snapshot includes only content and createdAt (strips id, author, screenplayId, updatedAt)"

patterns-established:
  - "Snapshot-at-creation: shared_views docs contain all data partners need, no secondary reads required"
  - "Public Firestore read: resolveShareToken uses getDoc without authReady gate"

requirements-completed: [SHARE-02, SHARE-03]

duration: 3min
completed: 2026-03-14
---

# Phase 06 Plan 01: Share Service Data Layer Summary

**SharedViewDocument with full analysis snapshot, resolveShareToken for public reads, and pdfUrl resolution at share creation time**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-14T07:49:24Z
- **Completed:** 2026-03-14T07:52:31Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended createShareToken to snapshot all analysis fields, posterUrl, pdfUrl, and optional notes into the shared_views Firestore doc
- Added resolveShareToken that reads shared_views without authReady (critical for unauthenticated partner access)
- Updated ShareButton to pass full Screenplay object and notes from notesStore
- Copied Lemon Studios logo to public/ for shared view branding

## Task Commits

Each task was committed atomically:

1. **Task 1: SharedViewDocument type, resolveShareToken, snapshot createShareToken (TDD)**
   - `7fdd0db` (test: failing tests - RED)
   - `bac7306` (feat: implementation - GREEN)
2. **Task 2: Update ShareButton call site and copy logo** - `0b9fbf5` (feat)

## Files Created/Modified
- `src/lib/shareService.ts` - Added SharedViewDocument type, resolveShareToken, extended createShareToken with snapshot logic
- `src/lib/shareService.test.ts` - 14 tests covering snapshot creation, resolveShareToken, pdfUrl resolution, notes inclusion
- `src/components/screenplay/modal/ShareButton.tsx` - Updated to pass Screenplay object + notes to createShareToken
- `public/lemon-logo.png` - Lemon Studios logo for shared view branding

## Decisions Made
- Analysis data fully embedded in shared_views doc at creation time (snapshot pattern avoids partner needing to read uploaded_analyses)
- resolveShareToken bypasses authReady since partners have no auth
- pdfUrl resolved via getDownloadURL at share creation and stored in the doc (null if PDF not found in storage)
- Notes snapshot strips sensitive fields (id, author, screenplayId, updatedAt) keeping only content and createdAt

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SharedViewDocument type and resolveShareToken are ready for Plan 02 (shared view page)
- Logo asset available at /lemon-logo.png for shared view header branding
- All analysis data will be available in the Firestore doc for partner view rendering

---
*Phase: 06-shared-partner-view*
*Completed: 2026-03-14*
