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

#### Phase 1: PDF Polish
**Goal:** Fix the known coverage PDF cover page spacing issue — proper visual separation between weighted score and recommendation badge.
**Requirements:** PDF-01
**Depends on:** None
**Estimated plans:** 1
**Risk:** Low — isolated @react-pdf/renderer style fix

#### Phase 2: Performance at Scale
**Goal:** Make the dashboard performant with 500-1000+ screenplays through virtual scrolling and memoized filtering.
**Requirements:** PERF-01, PERF-02
**Depends on:** Phase 1 (sequential, but no technical dependency)
**Estimated plans:** 2-3
**Risk:** Medium — virtual scrolling library choice affects card rendering; must validate with existing card interactions (modal open, context menu, etc.)

#### Phase 3: Selection Mode Foundation
**Goal:** Add multi-select checkboxes to screenplay cards, build the selection Zustand store, render the sticky bottom bulk action bar shell, and wire up Select All/Deselect All.
**Requirements:** BULK-01, BULK-02, BULK-03, BULK-10, BULK-11
**Depends on:** Phase 2 (virtual scrolling must be in place — checkboxes render inside virtualized cards)
**Estimated plans:** 2-3
**Context:** [03-CONTEXT.md](phases/03-selection-mode-foundation/03-CONTEXT.md) — full decisions on checkbox style, bar placement, selection UX

#### Phase 4: Bulk Action Integrations
**Goal:** Wire up the five always-available bulk actions — export CSV, export PDF, compare, add to collection, add to favorites — connecting the selection store to existing modals and stores.
**Requirements:** BULK-04, BULK-05, BULK-06, BULK-08, BULK-09
**Depends on:** Phase 3 (selection store and action bar must exist)
**Estimated plans:** 2
**Risk:** Low — mostly glue code between selection store and existing features (ExportModal, ComparisonModal, favorites/collections stores)

#### Phase 5: Bulk PDF Upload Modal
**Goal:** Build the streamlined bulk PDF upload experience — one dropzone per title, filtered to missing-PDF screenplays only, with success summary.
**Requirements:** BULK-07, BULK-12
**Depends on:** Phase 3 (selection store must exist)
**Estimated plans:** 2
**Context:** [03-CONTEXT.md](phases/03-selection-mode-foundation/03-CONTEXT.md) — Area 1 decisions on upload UX

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. PDF Polish | v7.0 | 0/1 | Pending | — |
| 2. Performance at Scale | v7.0 | 0/? | Pending | — |
| 3. Selection Mode Foundation | v7.0 | 0/? | Pending | — |
| 4. Bulk Action Integrations | v7.0 | 0/? | Pending | — |
| 5. Bulk PDF Upload Modal | v7.0 | 0/? | Pending | — |

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
