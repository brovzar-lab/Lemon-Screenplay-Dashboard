# Lemon Screenplay Dashboard

## Current Milestone: v7.0 Pipeline Scale & Bulk Operations

**Goal:** Make the dashboard fast and functional at 500–1000+ screenplays, simplify filtering, surface file health per card, and enable bulk operations.

**Target features:**
- PDF cover page spacing fix (deferred from v6.8)
- Storage status + analysis version badges on screenplay cards
- FilterPanel smart defaults (dimension sliders hidden; Genre/Budget prominent)
- Virtual scrolling for 500–1000+ screenplays without jank
- Bulk share link generation + bulk re-analyze from Firebase Storage
- CSV export scope confirmation clarity

---

## What This Is

A screenplay analysis dashboard for Lemon Studios. Screenplays are uploaded, automatically analyzed by AI (Claude), scored across multiple dimensions, and presented in a filterable, sortable dashboard. The tool replaces manual coverage — letting the producer quickly identify which scripts are worth reading from a high-volume pipeline (500+ scripts). When a promising script is found, the producer can read the analysis, download the PDF, add notes, generate a share link for partners, and download a branded coverage PDF for formal distribution.

## Core Value

Surface the best screenplays from a large pipeline so the producer doesn't waste time reading bad ones. The dashboard must make it effortless to go from "500 unread scripts" to "here are the 5 worth my time."

## Requirements

### Validated

- ✓ Upload screenplays (PDF) and get AI-powered analysis with multi-dimension scoring — existing
- ✓ Filter and sort screenplays by score, genre, recommendation, budget tier, and other dimensions — existing
- ✓ View detailed analysis with logline, synopsis, strengths, weaknesses, and dimension breakdowns — existing
- ✓ Compare screenplays side-by-side with radar charts and bar comparisons — existing
- ✓ Export screenplay data to CSV and PDF reports — existing
- ✓ Store and retrieve screenplay PDFs from Firebase Storage — existing
- ✓ AI-generated movie posters via Google Gemini — existing
- ✓ Analytics dashboard with score distribution, genre breakdown, and budget charts — existing
- ✓ Batch upload with model selection and cost estimation — existing
- ✓ Notes and feedback on individual screenplays — existing
- ✓ Favorites and collections for organizing screenplays — existing
- ✓ Category management and tagging — existing
- ✓ Dark/light theme with premium visual design — existing
- ✓ URL state sync for shareable filtered views — existing
- ✓ DevExec AI chat for screenplay discussion and recommendations — existing
- ✓ Data sync reliability — visible sync status, retry UI for failed Firestore writes — v6.8
- ✓ Soft-delete with 30-day recovery + quarantine for unrecognized data formats — v6.8
- ✓ UX polish — skeleton loaders, contextual empty states, inline error toasts — v6.8
- ✓ Partner sharing via secure token link — producer generates per-screenplay share links — v6.8
- ✓ Shared partner view — read-only standalone analysis page, no dashboard access — v6.8
- ✓ Coverage PDF export — branded multi-page PDF with scores, analysis, notes, recommendation — v6.8
- ✓ PDF polish deferred — cover page score/verdict spacing fix carried to v7.0

### Active

- [ ] PDF-01: Coverage PDF cover page — score number and verdict badge have visible vertical separation
- [ ] FILE-01: Storage-status badge on each card (Firebase ✓ / Missing ✗)
- [ ] FILE-02: Analysis-version badge on each card (current v6_core_lenses / legacy)
- [ ] FILE-03: "Missing PDF" filter promoted to FilterBar quick-access row with count badge
- [ ] FILE-04: Bulk PDF upload action for selected missing-PDF screenplays
- [ ] FILTER-01: FilterPanel default section changed to Genre & Theme (not Core Scores)
- [ ] FILTER-02: Dimension score sliders hidden behind "Advanced" disclosure toggle
- [ ] FILTER-03: "Filters" button shows active-hidden-filter count badge
- [ ] FILTER-04: FilterPanel auto-expands sections with active filters on open
- [ ] PERF-01: Virtualized screenplay grid for 500–1000+ items
- [ ] PERF-02: Memoized filter/sort pipeline — no freeze on 1000 screenplays
- [ ] BULK-01: Bulk share token generation with copy-all links
- [ ] BULK-02: Bulk re-analyze via Firebase Storage download (hasPdf=true only)
- [ ] BULK-03: CSV export modal scope confirmation clarity

### Out of Scope

- Multi-user authentication / login system — internal studio tool, no user accounts needed
- Script pipeline/status tracking (consider → read → option → acquire) — dashboard's job ends at "share with partners"
- Real-time collaboration / commenting between team members — manual sharing is sufficient
- Mobile app — web dashboard is the primary interface
- Talent attachability / casting suggestions — not enough data to make this useful yet
- Email ingestion (auto-import scripts from email) — manual upload workflow works
- True box office market data APIs — expensive, stale quickly; AI synthesis is the proxy
- TMDB auto-population for all screenplays — rate-limiting and title matching complexity
- Per-partner access controls / view tracking — not worth the security surface for an internal tool

## Context

- Shipped v6.8 on 2026-03-17 — security hardening, sync visibility, data safety, partner sharing, coverage PDF export
- The analysis engine (Claude-powered) is the strongest part — producer is happy with analysis quality
- 500+ screenplays in the pipeline; performance at scale is the next meaningful constraint
- Dual-write pattern (localStorage + Firestore) is now hardened with sync status visibility and soft-delete recovery
- Firestore is secured with anonymous auth + tight rules — safe to share external links
- Coverage PDF export is live; cover page has a known spacing issue (score/verdict) deferred to next milestone
- Firebase App Check is still disabled — acceptable for internal tool
- The visual design (gold/black premium theme with glassmorphism) is liked and should be preserved

## Constraints

- **Tech stack**: React 19 + TypeScript + Vite + Tailwind CSS 4 + Firebase — no stack changes
- **Visual design**: Keep current premium theme — polish, don't redesign
- **Backend**: Firebase only (Firestore + Storage + Cloud Functions) — no new backend services
- **API costs**: Anthropic API usage should remain budget-conscious with existing cost controls
- **Browser**: Client-side app, no SSR — Firebase Hosting serves static build

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Partner sharing via link + export package | Producer needs both quick sharing (link) and formal sharing (PDF package) for different contexts | ✓ Shipped v6.8 |
| Keep current visual design | Producer explicitly likes the current look, just wants UX polish | ✓ Preserved |
| No user auth system | Internal tool, sharing is via links not accounts | ✓ Confirmed |
| Dashboard scope ends at "share with partners" | Producer doesn't need pipeline tracking in this tool | ✓ Confirmed |
| Anonymous auth + Firestore rules (no App Check) | Prior App Check config mismatch caused 400 errors; anonymous auth with browserLocalPersistence chosen | ✓ Production stable |
| Snapshot pattern for shared_views | Analysis data embedded at token creation — no live sync needed for partner view | ✓ Clean isolation |
| Coverage PDF client-side (@react-pdf/renderer) | No server round-trip needed; existing dependency | ✓ Works well |
| Market Intelligence (INTEL-01/02) deferred | Comparable films fill rate uncertain; producer workflow complete without it | — Deferred to future milestone |

---
*Last updated: 2026-03-17 after v7.0 milestone start*
