# Roadmap: Lemon Screenplay Dashboard

## Milestones

- ✅ **v6.8 Dev Exec Insights + Sharing** — Phases 1-7 (shipped 2026-03-17) — [Archive](milestones/v6.8-ROADMAP.md)

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

- [ ] Phase 8: PDF Cover Page Polish (1 plan) — PDF-01
- [ ] Phase 9: Filter UX + File Status Badges (3 plans) — FILTER-01–04, FILE-01–03
- [ ] Phase 10: Virtual Scrolling + Performance (3 plans) — PERF-01–02
- [ ] Phase 11: Bulk Operations (3 plans) — BULK-01–03
- [ ] Phase 12: Bulk PDF Upload + Integration (2 plans) — FILE-04

---

## Phase Detail

### Phase 8: PDF Cover Page Polish

**Goal:** Fix the single deferred defect from v6.8 — the weighted score number and recommendation badge on the coverage PDF cover page are visually merged. Isolated to `CoverageDocument.tsx` only.

**Requirements:** PDF-01

**Plans:** 1 plan

Plans:
- [ ] 08-01-PLAN.md — Fix scoreLeft dual-flex layout: replace with centered-group View + explicit marginTop gap; add regression guard tests

**Success Criteria:**
1. Generated coverage PDF: score number and recommendation badge have visible vertical gap on cover page
2. No regression to title/author spacing (v6.8 fix at `titleText.marginBottom 8` preserved)
3. `npm run build` and `npm run test:run` pass

---

### Phase 9: Filter UX Simplification + File Status Badges

**Goal:** Reduce FilterPanel cognitive load by hiding 7 dimension sliders behind "Advanced"; add storage-status and analysis-version badges to screenplay cards. Ships together because both touch `ScreenplayCard.tsx` and share `pdfStatusStore`.

**Requirements:** FILTER-01, FILTER-02, FILTER-03, FILTER-04, FILE-01, FILE-02, FILE-03

**Success Criteria:**
1. FilterPanel opens with Genre & Theme expanded; 7 dimension sliders not visible until "Advanced" clicked
2. "Filters" button badge shows correct count of active Advanced-section filters
3. Each ScreenplayCard shows PDF status badge and analysis-version badge when `pdfStatusStore` has scan results
4. FilterPanel auto-expands sections with active filters on open
5. FilterBar has "Missing PDF" chip with count badge

---

### Phase 10: Virtual Scrolling + Performance

**Goal:** Replace simple `.map()` in `ScreenplayGrid.tsx` with windowed virtualization. Memoize filter/sort pipeline.

**Requirements:** PERF-01, PERF-02

**Constraint:** `ScreenplayGrid` uses responsive `grid-cols-1/2/3/4`. Must measure container width → derive column count → virtualize rows of N cards. Research plan must confirm `@tanstack/react-virtual` and column-measurement approach.

**Success Criteria:**
1. 1000 screenplays: DOM has no more than ~50–80 card elements at any time
2. Filter toggle causes no long task >100ms
3. Scroll reveal animation preserved or replaced
4. Keyboard navigation continues to function

---

### Phase 11: Bulk Operations

**Goal:** Bulk share token generation, bulk re-analysis via Firebase Storage download, CSV export scope confirmation.

**Requirements:** BULK-01, BULK-02, BULK-03

**Constraints:**
- Token generation sequential (not `Promise.all`) to avoid Firestore burst
- Reuse `getExistingShareToken` before creating new tokens
- BULK-02: `getDownloadURL` → `fetch` → `File` → `analyzeScreenplay`; only `hasPdf=true` eligible

**Success Criteria:**
1. Select 5 screenplays → "Generate Share Links" → 5 URLs in modal, individually copyable + "Copy All"
2. Select 3 legacy screenplays → "Re-analyze Selected" → "Re-analyzing 1 of 3…" progress → version badges update
3. Export modal states "Exporting X selected screenplays (CSV)" before download
4. Existing share tokens reused (no duplication)

---

### Phase 12: Bulk PDF Upload + Integration Testing

**Goal:** Wire FILE-04 bulk upload action; run complete integration pass across all v7.0 phases.

**Requirements:** FILE-04

**Success Criteria:**
1. Filter to "Missing PDF" → select 3 cards → "Upload PDFs" bulk action → PdfUploadPanel opens scoped to those 3 IDs
2. Full smoke test: 1000 screenplays → filter → enable 2 dimension sliders → verify badge "2" → select 5 cards → bulk share → all 5 links resolve
3. `npm run build` + `npm run test:run` pass; production deploy succeeds

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Firestore Security Hardening | v6.8 | 3/3 | Complete | 2026-03-14 |
| 2. Sync Status Visibility | v6.8 | 2/2 | Complete | 2026-03-14 |
| 3. Data Safety | v6.8 | 2/2 | Complete | 2026-03-14 |
| 4. UX Polish Scaffolding | v6.8 | 2/2 | Complete | 2026-03-14 |
| 5. Share Token Generation | v6.8 | 2/2 | Complete | 2026-03-14 |
| 6. Shared Partner View | v6.8 | 2/2 | Complete | 2026-03-14 |
| 7. Export Coverage Package | v6.8 | 3/3 | Complete | 2026-03-17 |
| 8. PDF Cover Page Polish | v7.0 | 0/1 | Pending | — |
| 9. Filter UX + File Status Badges | v7.0 | 0/3 | Pending | — |
| 10. Virtual Scrolling + Performance | v7.0 | 0/3 | Pending | — |
| 11. Bulk Operations | v7.0 | 0/3 | Pending | — |
| 12. Bulk PDF Upload + Integration | v7.0 | 0/2 | Pending | — |
