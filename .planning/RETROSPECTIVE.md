# Retrospective: Lemon Screenplay Dashboard

---

## Milestone: v6.8 — Dev Exec Insights + Sharing

**Shipped:** 2026-03-17
**Phases:** 7 | **Plans:** 16 | **Commits:** ~136

### What Was Built

- Firestore secured with anonymous auth + tight rules — external share links now safe
- Sync status indicator in header with live pending count and manual retry
- Soft-delete with 30-day recovery window + quarantine for unrecognized data formats
- Skeleton loaders, contextual empty states, inline toast notifications throughout
- Per-screenplay share token generation — secure links via Firestore `shared_views`
- Standalone `/share/:token` partner view — read-only, no dashboard access, lazy-loaded
- Coverage PDF export — branded 4-page document with scores, analysis, notes, recommendation

### What Worked

- **Security-first ordering** — doing Firestore hardening in Phase 1 before any sharing work meant every subsequent phase could safely assume secure data access
- **Snapshot pattern for shared views** — embedding analysis at token creation rather than live reads simplified the partner view enormously and removed auth complexity
- **Client-side PDF generation** — @react-pdf/renderer required no server work and kept the deployment simple
- **UAT + gap closure loop** — catching the cover page title/author overlap in UAT and diagnosing + fixing it in the same session was smooth
- **Phase removal** — deciding mid-milestone to drop Phase 8 (Market Intelligence) was clean; the milestone still shipped a coherent, complete feature set

### What Was Inefficient

- **Phase 6 ROADMAP completion marker** — the disk state (summaries) showed Phase 6 complete but the ROADMAP checkbox was never marked; caused a false "in progress" state in progress reporting
- **PDF layout issues discovered at UAT** — the title/author overlap and score/verdict spacing issues were caught late (UAT and user testing) rather than during plan review; PDF layout needs earlier visual review
- **Cover page score/verdict spacing deferred** — discovered during live testing but not caught by automated tests; PDF visual QA is a gap

### Patterns Established

- Anonymous auth + Firestore rules as the security baseline for internal tools with external link sharing
- Snapshot pattern: embed full data at creation time for read-only shared views
- UAT gap closure cycle: test → diagnose → plan → execute → re-verify within same session
- Phase removal as a clean tool when scope changes mid-milestone — no "cancelled" markers

### Key Lessons

- Audit PDF layout pages visually before plan is marked complete — automated tests can't catch descender overlap
- Score/verdict visual separation should be a test criterion in the coverage PDF plan, not discovered post-launch
- When skipping a phase, remove it cleanly and immediately rather than leaving it as "deferred" in the roadmap

### Cost Observations

- Sessions: ~5 focused sessions across 7 phases over 4 days (2026-03-13 to 2026-03-17)
- All phases executed quickly (2-10 min per plan) — well-scoped plans kept execution lean
- Notable: Phase 1 security work was the most careful (production deployment + human verification); everything else was faster

---

## Milestone: v7.0 — Pipeline Scale & Bulk Operations

**Shipped:** 2026-03-24
**Phases:** 5 | **Plans:** 10

### What Was Built

- Fixed coverage PDF cover page score/verdict visual separation
- Row-based virtual scrolling grid with @tanstack/react-virtual for 500-1000+ screenplays
- Set-based Zustand selection store with always-on checkboxes and gold highlight ring
- Sticky bottom bulk action bar with 6 wired actions and Select All/Deselect All
- Bulk CSV export and bulk PDF zip export (JSZip) with inline progress
- SetCategoryModal and AddToFavoritesModal for batch operations from action bar
- Bulk PDF upload modal with per-row dropzones, batch zone, Firebase progress tracking and retry

### What Worked

- **Thorough pre-milestone discussion** — all gray areas (checkbox behavior, action bar placement, upload modal design, disabled button UX) were decided before coding started, eliminating mid-phase pivots
- **Dependency-ordered phases** — PDF fix → virtual scrolling → selection → actions → upload built cleanly on each other with no circular dependencies
- **TDD for utility modules** — Plan 05-01 (bulk upload helpers) used red-green TDD which caught edge cases in filename matching and validation early
- **Reusing existing patterns** — toast store, modal patterns, Zustand store patterns were well-established from v6.8; new stores and modals followed the same structure
- **Small, focused plans** — 10 plans across 5 phases, each taking 3-13 minutes, kept execution crisp

### What Was Inefficient

- **REQUIREMENTS.md traceability not updated** — 7 items still marked "Pending" at milestone close despite code being done; bookkeeping fell behind
- **Phase 1 was a single-task plan** — the PDF spacing fix could have been part of Phase 2 prep rather than its own phase, saving overhead
- **Virtual scrolling keyboard navigation deferred** — removing CSS Grid broke column-aware arrow key navigation; not planned for and had to be deferred

### Patterns Established

- Set-based Zustand store for O(1) multi-select operations at scale
- Always-visible checkbox pattern (not mode toggle) for frequent-selection UIs
- Visible-but-disabled button pattern with native title tooltips
- Module-level Set for fire-once animation gating (persists across re-mounts, clears on reload)
- Row-based virtual scrolling with responsive column count (useColumnCount + @tanstack/react-virtual)
- TDD red-green for pure utility modules before component integration

### Key Lessons

- Pre-milestone discussion is high-ROI: every gray area resolved before coding saves 5-10x the time in mid-phase pivots
- Keep REQUIREMENTS.md traceability updated as plans complete, not at milestone close
- When removing a browser API (IntersectionObserver) from a component, audit all dependent features (keyboard nav) first

### Cost Observations

- Execution: 2 days (2026-03-23 → 2026-03-24)
- Plans: 3-13 min each, average ~5 min
- Notable: Phase 2 (virtual scrolling) was the most complex; Phases 4-5 executed fastest due to established patterns

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Days | Notable |
|-----------|--------|-------|------|---------|
| v6.8 Dev Exec Insights + Sharing | 7 | 16 | 4 | First sharing + export milestone; PDF layout debt identified |
| v7.0 Pipeline Scale & Bulk Operations | 5 | 10 | 2 | Scale + bulk ops; pre-milestone discussion eliminated mid-phase pivots |
