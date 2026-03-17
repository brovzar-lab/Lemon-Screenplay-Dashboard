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

## Cross-Milestone Trends

| Milestone | Phases | Plans | Days | Notable |
|-----------|--------|-------|------|---------|
| v6.8 Dev Exec Insights + Sharing | 7 | 16 | 4 | First sharing + export milestone; PDF layout debt identified |
