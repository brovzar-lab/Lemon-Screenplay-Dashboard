# Requirements: Lemon Screenplay Dashboard — v7.0

**Defined:** 2026-03-17
**Milestone:** v7.0 Pipeline Scale & Bulk Operations
**Core Value:** Surface the best screenplays from a large pipeline so the producer doesn't waste time reading bad ones — at 500–1000+ screenplays without performance degradation, with actionable bulk tools for file and analysis management.

---

## v1 Requirements

### PDF Polish

- [x] **PDF-01**: User can download a coverage PDF whose cover page shows the score number and recommendation badge with visible vertical separation so the two elements do not appear merged (deferred spacing fix from v6.8)

### File Management

- [ ] **FILE-01**: User can see a storage-status badge on each screenplay card indicating whether the source PDF exists in Firebase Storage (found / missing) — uses live `pdfStatusStore` scan data when available, falls back to `hasPdf` Firestore field otherwise

- [ ] **FILE-02**: User can see an analysis-version badge on each screenplay card indicating whether the screenplay was analyzed with the current engine version (`v6_core_lenses`) or a legacy version, so stale analyses are immediately visible

- [ ] **FILE-03**: User can filter the grid to show only screenplays with a missing PDF via a "Missing PDF" chip in the FilterBar quick-access row (alongside recommendation chips), with a count badge showing how many are missing

- [ ] **FILE-04**: User can select N cards whose PDF is missing and trigger an "Upload PDFs" bulk action from FilterBar that opens PdfUploadPanel pre-scoped to those selected IDs

### Filter Simplification

- [ ] **FILTER-01**: FilterPanel opens with the Genre & Theme section expanded by default — not Core Scores

- [ ] **FILTER-02**: The 7 dimension score sliders (Concept, Structure, Protagonist, Supporting Cast, Dialogue, Genre Execution, Originality) are hidden behind an "Advanced" disclosure toggle inside FilterPanel and collapsed by default — not visible when the panel first opens

- [ ] **FILTER-03**: The "Filters" button in FilterBar shows a count badge of currently active filters that are hidden inside the "Advanced" collapsed section, so the user knows when hidden filters are affecting the grid even with the panel closed

- [ ] **FILTER-04**: FilterPanel auto-expands any section that contains an active filter when the panel opens — no silent active-filter hiding

### Performance

- [ ] **PERF-01**: The screenplay grid renders correctly and without noticeable jank with 500–1000+ items using a virtualized list (only visible viewport rows are in the DOM at any time)

- [ ] **PERF-02**: Filter and sort operations on 1000 screenplays complete within a single animation frame (no visible UI freeze) — achieved via memoization of the `passesFilters` / `sortScreenplays` pipeline so it does not re-run on unrelated state changes

### Bulk Operations

- [ ] **BULK-01**: User can select N screenplays (using the existing gold export checkboxes) and generate share tokens for all selected screenplays in a single action — the result is a list of share URLs the user can copy individually or copy all at once

- [ ] **BULK-02**: User can select N screenplays with legacy analysis versions and queue them for re-analysis — the dashboard downloads their PDFs from Firebase Storage (only `hasPdf=true` screenplays are eligible; others are excluded from selection) and pipes each through `analyzeScreenplay`, showing "Re-analyzing N of M" progress

- [ ] **BULK-03**: User can export a CSV of the selected screenplays with the scope clearly confirmed before download — the Export modal states "Exporting X selected screenplays (CSV)" and the count is accurate before the download button is clicked

---

## v2 Requirements (deferred — not in v7.0)

### Sharing Enhancements

- **SHARE-05**: Share links auto-expire after a configurable TTL
- **SHARE-06**: ZIP bundle download with coverage PDF + original screenplay PDF

### Market Intelligence

- **INTEL-01**: User can see comparable titles listed in the screenplay detail modal (deferred from v6.8)
- **INTEL-02**: Genre trend indicator (trending, saturating, emerging)
- **INTEL-03**: Slate health matrix chart (genre × budget tier)

### File Management Enhancements

- **FILE-05**: "Rescan Storage" button available in FilterBar (not only in Settings → PDF Files) so the missing-PDF filter can be refreshed without navigating away

### Performance Enhancements

- **PERF-03**: Debounced search input so the filter pipeline does not run on every keystroke (important above 2000 items)

### Bulk Operations Enhancements

- **BULK-04**: Batch coverage PDF generation — select N screenplays and download all their coverage PDFs as a zip

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Batch coverage PDF generation | User explicitly deferred to v2 in v7.0 scoping |
| Multi-user auth / login system | Internal tool, no user accounts needed |
| Script pipeline / status tracking | Dashboard ends at "share with partners" |
| Real-time collaboration | Manual sharing is sufficient |
| Mobile app | Web dashboard is primary interface |
| Email ingestion | Manual upload workflow works |
| True box office API data | Expensive, stale quickly — AI synthesis is proxy |
| Per-partner access controls | Not worth security surface for internal tool |

---

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PDF-01 | Phase 8 | Complete |
| FILE-01 | Phase 9 | Pending |
| FILE-02 | Phase 9 | Pending |
| FILE-03 | Phase 9 | Pending |
| FILE-04 | Phase 12 | Pending |
| FILTER-01 | Phase 9 | Pending |
| FILTER-02 | Phase 9 | Pending |
| FILTER-03 | Phase 9 | Pending |
| FILTER-04 | Phase 9 | Pending |
| PERF-01 | Phase 10 | Pending |
| PERF-02 | Phase 10 | Pending |
| BULK-01 | Phase 11 | Pending |
| BULK-02 | Phase 11 | Pending |
| BULK-03 | Phase 11 | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after initial definition*
