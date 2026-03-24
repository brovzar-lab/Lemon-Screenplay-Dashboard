# Roadmap: Lemon Screenplay Dashboard

## Milestones

- ✅ **v6.8 Dev Exec Insights + Sharing** — Phases 1-7 (shipped 2026-03-17) — [Archive](milestones/v6.8-ROADMAP.md)
- 🔄 **v7.0 Pipeline Scale & Bulk Operations** — Phases 1-5

## Phases

<details>
<summary>✅ v6.8 Dev Exec Insights + Sharing (Phases 1-7) — SHIPPED 2026-03-17</summary>

- [x] Phase 1: Firestore Security Hardening (3/3 plans) — completed 2026-03-14
- [x] Phase 2: Sync Status Visibility (2/2 plans) — completed 2026-03-14
- [x] Phase 3: Data Safety (2/2 plans) — completed 2026-03-14
- [x] Phase 4: UX Polish Scaffolding (2/2 plans) — completed 2026-03-14
- [x] Phase 5: Share Token Generation (2/2 plans) — completed 2026-03-14
- [x] Phase 6: Shared Partner View (2/2 plans) — completed 2026-03-14
- [x] Phase 7: Export Coverage Package (3/3 plans) — completed 2026-03-17

</details>

### v7.0 Pipeline Scale & Bulk Operations

- [x] **Phase 1: PDF Polish** - Fix coverage PDF cover page spacing (score/verdict separation) (completed 2026-03-23)
- [x] **Phase 2: Performance at Scale** - Virtual scrolling + memoized filtering for 500-1000+ screenplays (completed 2026-03-23)
- [x] **Phase 3: Selection Mode Foundation** - Multi-select checkboxes, selection store, bulk action bar (completed 2026-03-23)
- [ ] **Phase 4: Bulk Action Integrations** - Wire up export, compare, collection, favorites from selection store (1/3 plans)
- [ ] **Phase 5: Bulk PDF Upload Modal** - Streamlined upload with per-title dropzones

## Phase Details

### Phase 1: PDF Polish
**Goal:** Fix the known coverage PDF cover page spacing issue — proper visual separation between weighted score and recommendation badge.
**Requirements:** PDF-01
**Depends on:** None

### Phase 2: Performance at Scale
**Goal:** Make the dashboard performant with 500-1000+ screenplays through virtual scrolling and memoized filtering.
**Requirements:** PERF-01, PERF-02
**Depends on:** Phase 1
**Plans:** 2 plans

Plans:
- [x] 02-01-PLAN.md — Card preparation: memo-wrap ScreenplayCard, remove IO, standardize height, fire-once animation, install @tanstack/react-virtual, create useColumnCount hook (completed 2026-03-23)
- [x] 02-02-PLAN.md — Virtual grid: rewrite ScreenplayGrid with row-based virtual scrolling, BackToTopButton, initial load stagger (completed 2026-03-23)

### Phase 3: Selection Mode Foundation
**Goal:** Add multi-select checkboxes to screenplay cards, build the selection Zustand store, render the sticky bottom bulk action bar shell, and wire up Select All/Deselect All.
**Requirements:** BULK-01, BULK-02, BULK-03, BULK-10, BULK-11
**Depends on:** Phase 2
**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md — Selection store (Set-based Zustand) + always-visible checkbox and gold ring on ScreenplayCard (completed 2026-03-23)
- [x] 03-02-PLAN.md — BulkActionBar shell (sticky bottom, six disabled buttons, Select All/Deselect All) + BackToTopButton offset (completed 2026-03-23)

### Phase 4: Bulk Action Integrations
**Goal:** Wire up the five always-available bulk actions — export CSV, export PDF, compare, set category, add to favorites — connecting the selection store to existing modals and stores.
**Requirements:** BULK-04, BULK-05, BULK-06, BULK-08, BULK-09
**Depends on:** Phase 3
**Plans:** 3 plans

Plans:
- [x] 04-01-PLAN.md — Prerequisites (toast success severity, patchAnalysisField, JSZip install) + wire CSV Export and Compare buttons (completed 2026-03-24)
- [ ] 04-02-PLAN.md — SetCategoryModal and AddToFavoritesModal + wire Set Category and Favorites buttons
- [ ] 04-03-PLAN.md — Bulk PDF export utility (JSZip) + wire Export PDF button with inline progress

### Phase 5: Bulk PDF Upload Modal
**Goal:** Build the streamlined bulk PDF upload experience — one dropzone per title, filtered to missing-PDF screenplays only, with success summary.
**Requirements:** BULK-07, BULK-12
**Depends on:** Phase 3
**Plans:** 2 plans

Plans:
- [x] 05-01-PLAN.md — Helper functions (validatePdfFile, matchScore, matchFilesToScreenplays, middleTruncate) with TDD tests (completed 2026-03-24)
- [ ] 05-02-PLAN.md — BulkPdfUploadModal component (per-row dropzones, batch zone, progress, retry) + wire Upload PDFs button in BulkActionBar

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. PDF Polish | v7.0 | 1/1 | Complete | 2026-03-23 |
| 2. Performance at Scale | v7.0 | 2/2 | Complete | 2026-03-23 |
| 3. Selection Mode Foundation | v7.0 | 2/2 | Complete | 2026-03-23 |
| 4. Bulk Action Integrations | v7.0 | 3/3 | Complete | 2026-03-24 |
| 5. Bulk PDF Upload Modal | v7.0 | 1/2 | In Progress | — |

## Requirement Coverage

| Requirement | Phase | Covered |
|-------------|-------|---------|
| PDF-01 | Phase 1 | ✓ |
| PERF-01 | Phase 2 | ✓ |
| PERF-02 | Phase 2 | ✓ |
| BULK-01 | Phase 3 | ✓ |
| BULK-02 | Phase 3 | ✓ |
| BULK-03 | Phase 3 | ✓ |
| BULK-04 | Phase 4 | ✓ |
| BULK-05 | Phase 4 | ✓ |
| BULK-06 | Phase 4 | ✓ |
| BULK-07 | Phase 5 | ✓ |
| BULK-08 | Phase 4 | ✓ |
| BULK-09 | Phase 4 | ✓ |
| BULK-10 | Phase 3 | ✓ |
| BULK-11 | Phase 3 | ✓ |
| BULK-12 | Phase 5 | ✓ |

**14/14 v7.0 requirements covered. 0 gaps.**
