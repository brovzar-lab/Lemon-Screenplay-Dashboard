# Lemon Screenplay Dashboard

## What This Is

A screenplay analysis dashboard for Lemon Studios. Screenplays are uploaded, automatically analyzed by AI (Claude), scored across multiple dimensions, and presented in a filterable, sortable dashboard. The tool replaces manual coverage — letting the producer quickly identify which scripts are worth reading from a high-volume pipeline (500+ scripts). When a promising script is found, the producer can read the analysis, download the PDF, add notes, and share it with partners for consideration.

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

### Active

- [ ] Partner sharing — send a script analysis + notes + PDF to partners via shareable link
- [ ] Export package — generate a downloadable coverage package (analysis summary + producer notes + script PDF) for formal sharing
- [ ] UX polish — smooth rough edges across the existing interface (loading states, transitions, empty states, error feedback)
- [ ] Data sync reliability — visible sync status, retry UI for failed Firestore writes, prevent silent data loss
- [ ] Comparable titles — surface similar produced films for a given screenplay (genre, tone, budget bracket)
- [ ] Market timing insights — genre/theme trend indicators (is this type of content saturated or underserved?)
- [ ] Budget feasibility — estimated production cost vs. likely return analysis tied to the analysis data
- [ ] Performance at scale — ensure filtering, sorting, and rendering stay fast at 500-1000+ screenplays

### Out of Scope

- Multi-user authentication / login system — this is an internal studio tool, no user accounts needed now
- Script pipeline/status tracking (consider → read → option → acquire) — producer says the dashboard's job ends at "share with partners"
- Real-time collaboration / commenting between team members — manual sharing is sufficient for now
- Mobile app — web dashboard is the primary interface
- Talent attachability / casting suggestions — not enough data to make this useful yet
- Email ingestion (auto-import scripts from email) — manual upload workflow works for now

## Context

- This is a brownfield project at v6.8.21 with a mature analysis pipeline
- The analysis engine (Claude-powered) is the strongest part — the producer is happy with analysis quality
- Current user is a single producer, but partners need read access to shared scripts
- 500+ screenplays in the pipeline, scaling matters
- The app uses a dual-write pattern (localStorage + Firestore) that can silently lose data on sync failures
- Firebase App Check is currently disabled due to config mismatch — acceptable for internal tool
- The visual design (gold/black premium theme with glassmorphism) is liked and should be preserved
- Existing codebase map available at `.planning/codebase/`

## Constraints

- **Tech stack**: React 19 + TypeScript + Vite + Tailwind CSS 4 + Firebase — no stack changes
- **Visual design**: Keep current premium theme — polish, don't redesign
- **Backend**: Firebase only (Firestore + Storage + Cloud Functions) — no new backend services
- **API costs**: Anthropic API usage should remain budget-conscious with existing cost controls
- **Browser**: Client-side app, no SSR — Firebase Hosting serves static build

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Partner sharing via link + export package | Producer needs both quick sharing (link) and formal sharing (PDF package) for different contexts | — Pending |
| Keep current visual design | Producer explicitly likes the current look, just wants UX polish | — Pending |
| No user auth system | Internal tool, sharing is via links not accounts | — Pending |
| Dashboard scope ends at "share with partners" | Producer doesn't need pipeline tracking in this tool | — Pending |

---
*Last updated: 2026-03-13 after initialization*
