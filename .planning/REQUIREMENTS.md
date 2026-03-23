# Requirements: Lemon Screenplay Dashboard

**Defined:** 2026-03-13 | **Updated:** 2026-03-23 (v7.0 milestone)
**Core Value:** Surface the best screenplays from a large pipeline so the producer doesn't waste time reading bad ones

## v6.8 Requirements (SHIPPED)

### Data Reliability

- [x] **SYNC-01**: User can see how many screenplays are pending Firestore sync
- [x] **SYNC-02**: User can force retry failed Firestore writes with a "Retry Now" button
- [x] **SYNC-03**: Deleted screenplays are soft-deleted with 30-day recovery window
- [x] **SYNC-04**: Unrecognized data formats are quarantined (archived), not permanently deleted

### UX Polish

- [x] **UX-01**: User sees skeleton loading cards while screenplays are loading
- [x] **UX-02**: User sees contextual empty state with filter-reset action when no results match
- [x] **UX-03**: User receives inline error feedback (toast/banner) for failed operations instead of silent console errors
- [x] **UX-04**: All JSON.parse calls are wrapped with error handling and sensible defaults

### Partner Sharing

- [x] **SHARE-01**: User can generate a shareable link for any single screenplay
- [x] **SHARE-02**: Partner can open a share link and see a read-only view with analysis, scores, and producer notes
- [x] **SHARE-03**: Partner can download the screenplay PDF from the shared view
- [x] **SHARE-04**: Shared view is clean and standalone (no dashboard chrome, no settings access)

### Export Package

- [x] **EXPORT-01**: User can download a single-screenplay coverage PDF with logline, synopsis, scores, producer notes, and recommendation

## v7.0 Requirements (ACTIVE)

### PDF Polish

- [ ] **PDF-01**: Coverage PDF cover page has proper visual separation between weighted score number and recommendation verdict badge

### Performance at Scale

- [x] **PERF-01**: Screenplay grid uses virtual scrolling to handle 500-1000+ screenplays without UI lag
- [x] **PERF-02**: Filtering pipeline is memoized so filter/sort changes don't trigger unnecessary re-renders at scale

### Bulk Operations — Selection

- [ ] **BULK-01**: Every screenplay card shows an always-visible checkbox for multi-select (no mode toggle)
- [ ] **BULK-02**: A sticky bottom action bar appears when 1+ cards are selected, showing count ("3 screenplays selected") and a clear button on the left, action buttons on the right
- [ ] **BULK-03**: "Select All (filtered)" selects every screenplay matching current filters; "Deselect All" clears selection

### Bulk Operations — Actions

- [ ] **BULK-04**: User can export selected screenplays as CSV from the bulk action bar
- [ ] **BULK-05**: User can export selected screenplays as PDF reports from the bulk action bar
- [ ] **BULK-06**: User can compare 2-5 selected screenplays (button disabled with tooltip below minimum/above maximum)
- [ ] **BULK-07**: User can upload PDFs for selected screenplays missing them via a streamlined modal with one dropzone per title
- [ ] **BULK-08**: User can add selected screenplays to a collection from the bulk action bar
- [ ] **BULK-09**: User can add selected screenplays to favorites from the bulk action bar

### Bulk Operations — UX

- [ ] **BULK-10**: Unactionable buttons are visible but disabled with explanatory tooltips (never hidden)
- [ ] **BULK-11**: Selected cards show a highlight ring; unselected cards are not dimmed
- [ ] **BULK-12**: Bulk PDF upload modal shows only screenplays missing PDFs with a note about already-attached count; stays open with success summary until dismissed

## Backlog (Future Milestones)

### Market Intelligence

- **INTEL-01**: User can see comparable titles listed in the screenplay detail modal
- **INTEL-02**: User can launch a per-screenplay DevExec AI chat scoped to that specific script and its comps
- **INTEL-03**: Genre trend indicator (trending, saturating, emerging) per screenplay
- **INTEL-04**: Budget feasibility indicator (estimated return likelihood for budget tier x genre)
- **INTEL-05**: Slate health matrix chart (genre x budget tier showing pipeline gaps)
- **INTEL-06**: DevExec comparable title deep-dive (ask AI about specific comp performance)

### Sharing Enhancements

- **SHARE-05**: Share links auto-expire after a configurable TTL
- **SHARE-06**: ZIP bundle download with coverage PDF + original screenplay PDF

### Bulk Operations Enhancements

- **BULK-E1**: Bulk share token management (generate tokens for N screenplays at once)
- **BULK-E2**: Bulk delete with confirmation and soft-delete integration
- **BULK-E3**: Keyboard shortcuts for selection (Shift+click range select, Cmd+A)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user authentication / login system | Internal studio tool, no user accounts needed |
| Script pipeline status tracking | Dashboard's job ends at "share with partners" |
| Real-time collaboration / commenting | Manual sharing is sufficient |
| Mobile app | Web dashboard is the primary interface |
| Email ingestion / auto-import | Manual upload workflow works |
| True box office market data APIs | Expensive, stale quickly, maintenance burden — AI synthesis is the proxy |
| TMDB auto-population for all screenplays | Rate-limiting complexity, title matching ambiguity |
| Per-partner access controls / view tracking | Not worth the security surface area for internal tool |
| Full undo/redo stack | Soft delete covers the critical case |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SYNC-01 | v6.8 Phase 2 | Complete |
| SYNC-02 | v6.8 Phase 2 | Complete |
| SYNC-03 | v6.8 Phase 3 | Complete |
| SYNC-04 | v6.8 Phase 3 | Complete |
| UX-01 | v6.8 Phase 4 | Complete |
| UX-02 | v6.8 Phase 4 | Complete |
| UX-03 | v6.8 Phase 4 | Complete |
| UX-04 | v6.8 Phase 4 | Complete |
| SHARE-01 | v6.8 Phase 5 | Complete |
| SHARE-02 | v6.8 Phase 6 | Complete |
| SHARE-03 | v6.8 Phase 6 | Complete |
| SHARE-04 | v6.8 Phase 6 | Complete |
| EXPORT-01 | v6.8 Phase 7 | Complete |
| PDF-01 | v7.0 Phase 1 | Pending |
| PERF-01 | v7.0 Phase 2 | Complete |
| PERF-02 | v7.0 Phase 2 | Complete |
| BULK-01 | v7.0 Phase 3 | Pending |
| BULK-02 | v7.0 Phase 3 | Pending |
| BULK-03 | v7.0 Phase 3 | Pending |
| BULK-04 | v7.0 Phase 4 | Pending |
| BULK-05 | v7.0 Phase 4 | Pending |
| BULK-06 | v7.0 Phase 4 | Pending |
| BULK-07 | v7.0 Phase 5 | Pending |
| BULK-08 | v7.0 Phase 4 | Pending |
| BULK-09 | v7.0 Phase 4 | Pending |
| BULK-10 | v7.0 Phase 3 | Pending |
| BULK-11 | v7.0 Phase 3 | Pending |
| BULK-12 | v7.0 Phase 5 | Pending |

**Coverage:**
- v6.8 requirements: 13 total — all complete
- v7.0 requirements: 14 total — all pending, all mapped to phases

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-23 — v7.0 milestone requirements added*
