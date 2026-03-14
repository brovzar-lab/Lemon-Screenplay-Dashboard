# Roadmap: Lemon Screenplay Dashboard — Dev Exec Insights + Sharing Milestone

## Overview

This milestone adds partner sharing, export packages, market intelligence enrichment, and UX polish to the existing v6.8.21 production application. The dependency ordering is strict: Firestore security and sync reliability must ship before any external partner receives a link. From that foundation, sharing infrastructure and the export package can be built, followed by market intelligence features that enrich the screenplay detail view. The milestone ends with a complete, reliable workflow: producer uploads and analyzes a script, adds notes, generates a share link or coverage PDF, and optionally reviews market comps — all without data loss or security exposure.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Firestore Security Hardening** - Add anonymous auth and tighten Firestore rules before any external sharing (completed 2026-03-14)
- [x] **Phase 2: Sync Status Visibility** - Producer can see pending sync count and manually retry failed Firestore writes (completed 2026-03-14)
- [x] **Phase 3: Data Safety** - Soft-delete recovery window and quarantine pattern replace destructive data loss (completed 2026-03-14)
- [x] **Phase 4: UX Polish Scaffolding** - Skeleton loaders, empty states, and inline error feedback replace silent failures (completed 2026-03-14)
- [x] **Phase 5: Share Token Generation** - Producer can generate a per-screenplay shareable link with a secure token (completed 2026-03-14)
- [ ] **Phase 6: Shared Partner View** - Partner can open a share link and see a clean read-only analysis view
- [ ] **Phase 7: Export Coverage Package** - Producer can download a formatted coverage PDF for formal sharing
- [ ] **Phase 8: Market Intelligence** - Comparable titles and scoped DevExec AI chat surface inside the screenplay detail modal

## Phase Details

### Phase 1: Firestore Security Hardening
**Goal**: The app's Firestore data is protected from unauthorized cross-collection access before any share link is generated for an external partner
**Depends on**: Nothing (first phase)
**Requirements**: None (infrastructure prerequisite — research confirms open `allow read: if true` rules and disabled App Check become production security incidents the moment external partners receive share links)
**Success Criteria** (what must be TRUE):
  1. A browser console `getDocs(collection(db, 'uploaded_analyses'))` call using a share token returns a permission-denied error, not all 500+ screenplays
  2. Anonymous auth initializes silently on load — no login screen, experience identical to today
  3. Firestore security rules restrict `uploaded_analyses` and `screenplay_feedback` reads to authenticated internal context only; `shared_views` collection is readable by token lookup only
  4. Existing dashboard functionality (load, filter, sort, upload) still works after rule tightening
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Add Firebase anonymous auth to firebase.ts (authReady promise + unit tests)
- [ ] 01-02-PLAN.md — Gate analysisStore.ts Firestore calls on authReady; rewrite and deploy firestore.rules
- [ ] 01-03-PLAN.md — Deploy to production and human-verify dashboard + unauthenticated probe

### Phase 2: Sync Status Visibility
**Goal**: Producer can see at a glance how many screenplays are pending Firestore sync and can manually trigger a retry when writes fail
**Depends on**: Phase 1
**Requirements**: SYNC-01, SYNC-02
**Success Criteria** (what must be TRUE):
  1. The dashboard header shows a live count of screenplays pending Firestore sync (visible without any user action)
  2. When one or more writes have failed, a "Retry Now" button appears in the header sync indicator and triggers a retry of all queued writes
  3. After a successful retry, the pending count decrements and the failure indicator clears
  4. The sync indicator is absent (or shows zero) when all screenplays are synced — it does not create visual noise during normal operation
**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — Create syncStatusStore with polling + export getPendingWriteCount/flushPendingWrites from analysisStore
- [ ] 02-02-PLAN.md — Build SyncStatusIndicator component, useSyncRetry hook, wire into Header

### Phase 3: Data Safety
**Goal**: Deleted screenplays are recoverable for 30 days, and unrecognized data formats are quarantined instead of permanently destroyed
**Depends on**: Phase 1
**Requirements**: SYNC-03, SYNC-04
**Success Criteria** (what must be TRUE):
  1. A screenplay deleted from the dashboard is not immediately removed from Firestore — it can be recovered from a "Recently Deleted" view within 30 days
  2. A Firestore document that fails the `isV6RawAnalysis()` type guard is moved to an `_unrecognized_analyses` collection rather than permanently deleted
  3. The quarantine collection is accessible to the producer for manual review and is not silently discarded
  4. Normal screenplay operations (upload, analyze, delete) still work correctly with the soft-delete and quarantine patterns in place
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md — Implement soft-delete, quarantine, and restore functions in analysisStore.ts; replace api.ts destructive deletes; update firestore.rules
- [ ] 03-02-PLAN.md — Add Recently Deleted recovery UI and quarantine visibility to Settings Data tab

### Phase 4: UX Polish Scaffolding
**Goal**: The dashboard communicates its state (loading, empty, error) clearly at every step — no silent failures, no blank screens
**Depends on**: Phase 1
**Requirements**: UX-01, UX-02, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. While screenplays are loading from Firestore, the grid shows skeleton card placeholders instead of a blank area
  2. When active filters produce zero results, the user sees a contextual empty state message with a "Clear Filters" action — not an empty grid
  3. When a write operation fails (upload, delete, note save), the user sees an inline toast or banner with the error — the failure is never silently swallowed
  4. A malformed localStorage value (corrupt JSON, unexpected schema) does not crash the app — the affected store resets to a safe default and the user can continue working
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md — Verify pre-existing UX-01/UX-02; build toast infrastructure (toastStore + ToastContainer + App.tsx wiring)
- [ ] 04-02-PLAN.md — Wire toast calls into 14 user-facing error sites (UX-03); harden JSON.parse sites with safeJsonParse utility (UX-04)

### Phase 5: Share Token Generation
**Goal**: Producer can generate a secure, per-screenplay shareable link that does not expose the full dashboard or any other screenplay
**Depends on**: Phase 1, Phase 2, Phase 3
**Requirements**: SHARE-01
**Success Criteria** (what must be TRUE):
  1. A "Share" button inside the screenplay detail modal generates a unique share link for that specific screenplay
  2. The generated link uses a `crypto.randomUUID()` token stored in a Firestore `shared_views` collection — not the dashboard URL or any localStorage value
  3. The producer can copy the generated link to clipboard with one click
  4. Before generating the token, the system verifies the screenplay exists in Firestore — if it has not synced, the producer sees a clear error instead of creating a broken link
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — Create shareService.ts (Firestore CRUD for shared_views) + shareStore.ts (session cache) + tests
- [ ] 05-02-PLAN.md — Build ShareButton with popover in ModalHeader, SharedLinksPanel in Settings, auto-revoke on soft-delete

### Phase 6: Shared Partner View
**Goal**: A partner who receives a share link sees a clean, standalone read-only analysis view — with no access to the dashboard, settings, or other screenplays
**Depends on**: Phase 5
**Requirements**: SHARE-02, SHARE-03, SHARE-04
**Success Criteria** (what must be TRUE):
  1. Opening a `/share/:token` URL shows the screenplay's analysis, scores, logline, synopsis, strengths, weaknesses, and producer notes — without any dashboard navigation, header, or settings UI
  2. The partner can download the screenplay PDF from the shared view using the Firebase Storage link embedded at token creation time
  3. An expired or revoked token shows a clear "This link is no longer available" message — not a 404 or blank page
  4. The shared view is read-only: the partner cannot edit notes, change scores, delete the screenplay, or access any other part of the application
  5. The shared view route (`/share/:token`) is lazy-loaded and does not include any dashboard bundle code
**Plans**: 2 plans

Plans:
- [ ] 06-01-PLAN.md — Extend createShareToken with analysis snapshot + add resolveShareToken for public reads + copy logo asset
- [ ] 06-02-PLAN.md — Build SharedViewPage, SharedViewLayout, SharedScoresPanel, SharedContentDetails, ExpiredLinkPage + register lazy route in main.tsx

### Phase 7: Export Coverage Package
**Goal**: Producer can download a formatted single-screenplay coverage PDF containing the analysis summary, scores, producer notes, and recommendation — suitable for formal sharing with partners
**Depends on**: Phase 4
**Requirements**: EXPORT-01
**Success Criteria** (what must be TRUE):
  1. From the screenplay detail modal, the producer can trigger a "Download Coverage PDF" action that generates and downloads a formatted PDF
  2. The coverage PDF contains: logline, synopsis, dimension scores, overall recommendation, and any producer notes written for that screenplay
  3. The PDF is generated client-side using the existing `@react-pdf/renderer` integration — no server round-trip required for the analysis-only document
  4. The downloaded filename includes the screenplay title and a document ID suffix to prevent collisions between similarly-named scripts
**Plans**: 2 plans

Plans:
- [ ] 07-01-PLAN.md — Build CoverageDocument.tsx template + exportCoverage.ts service + unit tests
- [ ] 07-02-PLAN.md — Wire "Coverage" download button into ModalHeader + human-verify PDF output

### Phase 8: Market Intelligence
**Goal**: Producer can see comparable produced films alongside a screenplay's analysis, and can launch an AI chat session scoped to that specific script for deeper market discussion
**Depends on**: Phase 4
**Requirements**: INTEL-01, INTEL-02
**Success Criteria** (what must be TRUE):
  1. The screenplay detail modal displays a "Comparable Titles" section listing films from the existing `comparableFilms[]` array with title, similarity rationale, and box office relevance notes
  2. When comparable titles are not populated for a screenplay (empty array), the section shows a graceful empty state — not a blank panel or JavaScript error
  3. A "Discuss with DevExec" button inside the screenplay detail modal opens an AI chat session pre-scoped to that screenplay's analysis data and comparable titles — not the full pipeline
  4. The per-screenplay DevExec session generates responses that reference the specific script being discussed, not generic pipeline-level recommendations
**Plans**: TBD

Plans:
- [ ] 08-01: Build ComparableTitlesPanel.tsx in ScreenplayModal rendering comparableFilms[] array with title, similarity, and box_office_relevance fields
- [ ] 08-02: Add empty/loading/error states to ComparableTitlesPanel for zero-fill-rate resilience
- [ ] 08-03: Extend devExecService.ts with a per-screenplay mode that scopes context to a single screenplay + its comps
- [ ] 08-04: Add "Discuss with DevExec" entry point in ScreenplayModal wired to the scoped devExec variant

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

Note: Phases 2, 3, and 4 depend only on Phase 1 and can proceed in parallel. Phase 5 depends on Phases 1, 2, and 3 completing. Phases 7 and 8 depend only on Phase 4 and can proceed in parallel with Phase 6.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Firestore Security Hardening | 3/3 | Complete   | 2026-03-14 |
| 2. Sync Status Visibility | 2/2 | Complete   | 2026-03-14 |
| 3. Data Safety | 2/2 | Complete   | 2026-03-14 |
| 4. UX Polish Scaffolding | 2/2 | Complete   | 2026-03-14 |
| 5. Share Token Generation | 2/2 | Complete   | 2026-03-14 |
| 6. Shared Partner View | 1/2 | In Progress|  |
| 7. Export Coverage Package | 0/2 | Not started | - |
| 8. Market Intelligence | 0/4 | Not started | - |
