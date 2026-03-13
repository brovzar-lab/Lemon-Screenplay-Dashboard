# Requirements: Lemon Screenplay Dashboard

**Defined:** 2026-03-13
**Core Value:** Surface the best screenplays from a large pipeline so the producer doesn't waste time reading bad ones

## v1 Requirements

### Data Reliability

- [ ] **SYNC-01**: User can see how many screenplays are pending Firestore sync
- [ ] **SYNC-02**: User can force retry failed Firestore writes with a "Retry Now" button
- [ ] **SYNC-03**: Deleted screenplays are soft-deleted with 30-day recovery window
- [ ] **SYNC-04**: Unrecognized data formats are quarantined (archived), not permanently deleted

### UX Polish

- [ ] **UX-01**: User sees skeleton loading cards while screenplays are loading
- [ ] **UX-02**: User sees contextual empty state with filter-reset action when no results match
- [ ] **UX-03**: User receives inline error feedback (toast/banner) for failed operations instead of silent console errors
- [ ] **UX-04**: All JSON.parse calls are wrapped with error handling and sensible defaults

### Partner Sharing

- [ ] **SHARE-01**: User can generate a shareable link for any single screenplay
- [ ] **SHARE-02**: Partner can open a share link and see a read-only view with analysis, scores, and producer notes
- [ ] **SHARE-03**: Partner can download the screenplay PDF from the shared view
- [ ] **SHARE-04**: Shared view is clean and standalone (no dashboard chrome, no settings access)

### Export Package

- [ ] **EXPORT-01**: User can download a single-screenplay coverage PDF with logline, synopsis, scores, producer notes, and recommendation

### Market Intelligence

- [ ] **INTEL-01**: User can see comparable titles listed in the screenplay detail modal
- [ ] **INTEL-02**: User can launch a per-screenplay DevExec AI chat scoped to that specific script and its comps

## v2 Requirements

### Sharing Enhancements

- **SHARE-05**: Share links auto-expire after a configurable TTL
- **SHARE-06**: ZIP bundle download with coverage PDF + original screenplay PDF

### Market Intelligence Enhancements

- **INTEL-03**: Genre trend indicator (trending, saturating, emerging) per screenplay
- **INTEL-04**: Budget feasibility indicator (estimated return likelihood for budget tier x genre)
- **INTEL-05**: Slate health matrix chart (genre x budget tier showing pipeline gaps)
- **INTEL-06**: DevExec comparable title deep-dive (ask AI about specific comp performance)

### Performance

- **PERF-01**: Virtual scrolling for 500+ screenplay grid
- **PERF-02**: Memoized filtering pipeline for scale optimization

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
| SYNC-01 | — | Pending |
| SYNC-02 | — | Pending |
| SYNC-03 | — | Pending |
| SYNC-04 | — | Pending |
| UX-01 | — | Pending |
| UX-02 | — | Pending |
| UX-03 | — | Pending |
| UX-04 | — | Pending |
| SHARE-01 | — | Pending |
| SHARE-02 | — | Pending |
| SHARE-03 | — | Pending |
| SHARE-04 | — | Pending |
| EXPORT-01 | — | Pending |
| INTEL-01 | — | Pending |
| INTEL-02 | — | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 0
- Unmapped: 15

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 after initial definition*
