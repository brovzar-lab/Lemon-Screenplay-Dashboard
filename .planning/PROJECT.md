# Lemon Screenplay Dashboard

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

### Active (v7.0 — Pipeline Scale & Bulk Operations)

- [ ] PDF polish — score/verdict spacing on coverage PDF cover page
- [ ] Performance at scale — virtual scrolling and memoized filtering for 500-1000+ screenplays
- [ ] Bulk operations — multi-select grid with always-on checkboxes, sticky bulk action bar, batch export (CSV/PDF), batch compare, bulk PDF upload, batch add-to-collection/favorites

### Backlog

- [ ] Comparable titles — surface similar produced films per screenplay (deferred from v6.8)
- [ ] Market timing insights — genre/theme trend indicators (saturated vs. underserved)
- [ ] Bulk share token management — generate tokens for N screenplays at once
- [ ] Bulk delete with confirmation — soft-delete integration for multi-select
- [ ] Keyboard shortcuts for selection — Shift+click range, Cmd+A

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
- Starting v7.0 on 2026-03-23 — PDF polish, performance at scale, bulk operations
- The analysis engine (Claude-powered) is the strongest part — producer is happy with analysis quality
- 500+ screenplays in the pipeline; performance at scale is the next meaningful constraint
- Dual-write pattern (localStorage + Firestore) is now hardened with sync status visibility and soft-delete recovery
- Firestore is secured with anonymous auth + tight rules — safe to share external links
- Coverage PDF export is live; cover page has a known spacing issue (score/verdict) to fix in v7.0
- Firebase App Check is still disabled — acceptable for internal tool
- The visual design (gold/black premium theme with glassmorphism) is liked and should be preserved
- Bulk operations discussed in detail — always-on checkboxes, sticky bottom action bar, streamlined PDF upload modal (see Phase 12 CONTEXT.md decisions)

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
| Market Intelligence (INTEL-01/02) deferred | Comparable films fill rate uncertain; producer workflow complete without it | — Deferred to backlog |
| v7.0 scope: polish + perf + bulk ops | These 3 are all about making the dashboard work at scale; market intelligence is a different flavor | — v7.0 milestone |
| Always-on checkboxes (not mode toggle) | Producer selects often enough that a mode toggle becomes friction | — v7.0 bulk ops |
| Streamlined upload modal (not full panel) | Selection already done in grid; no need to re-search in the upload modal | — v7.0 bulk ops |
| Sticky bottom action bar | Keeps filters visible while selecting; standard pattern | — v7.0 bulk ops |

---
*Last updated: 2026-03-23 — v7.0 milestone kickoff*
