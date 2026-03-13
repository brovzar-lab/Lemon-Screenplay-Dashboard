# Feature Landscape

**Domain:** Internal production studio screenplay analysis dashboard (single-producer, high-volume pipeline)
**Researched:** 2026-03-13
**Milestone context:** Subsequent milestone — sharing, dev exec insights, and UX polish on top of v6.8.21 baseline

---

## Context: What Already Exists

The following are shipped and working. They are NOT requirements for this milestone — included here to prevent re-invention:

- AI-powered screenplay analysis with multi-dimension scoring (Claude models)
- Filterable/sortable grid with 500+ screenplay support
- Side-by-side comparison with radar charts
- CSV and PDF export
- DevExec AI chat (Gemini Flash) with slate awareness
- Notes and feedback on individual screenplays
- Favorites and collections
- AI-generated movie posters
- URL state sync for shareable filtered views
- ShareModal skeleton (copy link + mailto email — implemented UI only, not deep linking)
- Analytics dashboard (score distribution, genre, budget charts)
- `comparableFilms` array already stored per screenplay (title, similarity, box_office_relevance)
- `producerMetrics` struct on Screenplay type (marketPotential, uspStrength — nullable, not yet populated)
- `tmdbStatus` on Screenplay type (is_produced, release_date — field exists, population unclear)

---

## Table Stakes

Features the user would notice missing immediately. Absence makes the tool feel broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-screenplay shareable link | Producer explicitly listed partner sharing as primary goal. Current ShareModal only shares dashboard URL with filters — not a specific script's analysis. | Medium | Requires Firestore public read path or token-based link. Firebase rules currently `allow read: if true` so a `/share/{id}` route reading from Firestore is achievable without auth changes. |
| Export coverage package (PDF) | Partners expect a formal document, not a dashboard link. Industry standard is a one-pager: logline, synopsis, scores, producer notes, recommendation. | Medium | `PdfDocument.tsx` (494 lines) already generates a report. Needs a "coverage package" variant with producer notes included and a clean single-script layout. |
| Sync status visibility | App silently loses data on Firestore write failure. With 500+ screenplays, producer cannot trust the tool if data loss is invisible. Showing "3 pending syncs" is non-negotiable for trust. | Low | Zustand retry queue (`PENDING_QUEUE_KEY`) already exists. Need UI to surface it. |
| Loading and empty states | Grid shows nothing while screenplays load, and nothing useful when filters return zero results. Standard UX expectation at any dashboard maturity level. | Low | Should show skeleton cards during load, and a contextual "no results" state with reset-filter action. |
| Error feedback on failed operations | Upload failures, analysis errors, and Firestore write failures currently surface only to the console. Users need inline feedback. | Low | Already partially handled in some paths. Needs audit and consistent toast/inline pattern. |
| Retry UI for failed Firestore writes | Companion to sync status. If data isn't synced, the user must be able to force a retry without refreshing. | Low | `PENDING_QUEUE_KEY` retry queue already implemented. Need "Retry Now" affordance in UI. |

---

## Differentiators

Features that distinguish this tool from a generic script tracker. These are the capabilities that make a producer prefer this over spreadsheets or a PDF folder.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-screenplay partner share link with token expiry | A dashboard link requires the partner to have the full app context. A direct deep link to one script's analysis page — with the original PDF accessible — is the professional sharing primitive. Producers at major studios (CAA, WME, production companies) forward coverage as links or PDFs, never dashboard invites. | High | Requires: (1) a `/view/{id}` or `/share/{token}` route, (2) read-only view of analysis without the full dashboard chrome, (3) optional token expiry via Firestore TTL. Firebase rules are currently open so access control is the engineering challenge. |
| Export package: analysis + producer notes + PDF in one download | Partners receiving material need everything in one place. The current export generates a multi-screenplay CSV or a generic PDF. A single-screenplay "coverage package" that merges AI analysis, producer handwritten notes, and optionally the script PDF (or a link to it) is the professional deliverable. | Medium | `@react-pdf/renderer` is already in the stack. Notes are stored in Zustand. The gap is combining them into a producer-branded one-pager layout. |
| Comparable titles surfaced with production context | The `comparableFilms` array already exists per screenplay (populated by Claude at analysis time). It has title, similarity, and box_office_relevance. The missing piece is displaying this data prominently in the detail modal and making it actionable — e.g., linking to TMDB, showing budget tier of the comp. Producers use comps to justify greenlight decisions to financiers. | Low-Medium | Data is present. This is primarily a display/UX feature. TMDB integration is already partially on the type (`tmdbStatus`). No new API needed for basic comp display. |
| Market timing indicator per genre | Is a given genre trending, saturating, or emerging? This is the "is this the right time?" question every producer asks. The DevExec AI already performs slate-level strategic analysis. A per-screenplay indicator showing whether the genre is currently in demand (based on a static signal or DevExec query) adds acquisition confidence. | High | True market data requires an external source (Box Office Mojo, The Numbers, Comscore). A static curated signal updated periodically is achievable. AI-generated genre timing via DevExec prompt is the low-cost first version. Flag as needing deeper feasibility research. |
| Budget feasibility indicator | The analysis already classifies scripts by budget tier (micro/low/medium/high) with justification. Budget feasibility adds the other half: estimated return likelihood for that budget tier given genre and comp performance. Producers use this to decide if the risk/reward ratio justifies development investment. | High | True ROI modeling requires market data not currently in the system. A static lookup table (budget tier × genre → typical return range) populated from industry knowledge is achievable as v1. Flag as needing phase-specific research. |
| DevExec: per-screenplay context (not just slate-wide) | The DevExec chat currently has slate-wide context. Asking "What should I do with THIS script?" requires manually naming the title. A per-screenplay DevExec mode — launched from the script detail modal — scopes the AI context to that one screenplay plus the relevant comps. This is a direct productivity multiplier for the producer's core workflow. | Medium | `devExecService.ts` builds its context from the full `screenplays` array. A scoped variant that passes `[singleScreenplay]` plus the comp set is architecturally straightforward. Requires a UI entry point from `ScreenplayModal`. |
| DevExec: comparable title deep-dive | Ask the AI "How did [comp title] perform and why does that matter for this script?" The existing system has comp titles but no market intelligence about them. A DevExec prompt mode that uses the comp data as context to generate a positioning narrative would give the producer a ready-made "why now, why this" pitch framing. | Medium | Depends on DevExec per-screenplay scoping (above). The AI can reason about comps from its training data. For recent titles (post-training cutoff), accuracy drops — this is a confidence caveat to document. |
| Slate health dashboard: genre/budget balance gaps | DevExec's "Portfolio Gaps" quick action already identifies this conversationally. A visual representation — a matrix showing which genre × budget tier cells are filled vs. empty — would make the slate balance visible at a glance without requiring an AI query. | Medium | This is a chart added to `AnalyticsDashboard.tsx`. Data is already available (genre + budgetCategory per screenplay). Recharts already in stack. |
| Performance at 500-1000+ screenplays | Not a visible feature, but users will leave if the grid lags. At 500+ scripts, filter operations and chart aggregations must stay responsive. Virtual scrolling for the grid, memoized filtering, and incremental chart data would keep the tool usable as the pipeline grows. | Medium | CONCERNS.md already documents the specific bottlenecks (useMemo on full dataset, Recharts re-render on every change). This is optimization work, not new features. |

---

## Anti-Features

Features to deliberately NOT build in this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multi-user auth / login system | Out of scope per PROJECT.md. Adding auth would require Firestore rule rewrites, user management, and session handling. The tool is internal and single-producer. | Partners access via share links. No accounts needed. |
| Real-time collaboration (comments, reactions on shared views) | Partners need read-only access, not editing rights. Collaborative annotation creates conflict resolution complexity that far outweighs the value. | Producer adds notes before sharing. Notes are the collaboration mechanism. |
| Script pipeline status tracking (option → acquire → develop) | PROJECT.md explicitly calls this out of scope: "the dashboard's job ends at 'share with partners'." Building pipeline tracking creates scope creep and duplicates what a proper production management tool (Airtable, Movie Magic, Filemaker) already does. | If needed later, integrate with existing pipeline tool via CSV export. |
| Email ingestion / auto-import from email | Manual upload workflow is working. Email parsing is fragile, security-sensitive (MIME handling, attachment extraction), and requires backend infrastructure not present. | Upload panel with batch PDF support is sufficient. |
| Mobile app | Web dashboard is the established interface. Mobile would require responsive overhaul of complex data-dense layouts (radar charts, comparison grids). | Polish mobile-responsive breakpoints as part of UX polish, but don't build a native app. |
| True box office market data integration | APIs like Box Office Mojo, Comscore, or The Numbers are expensive, inconsistently structured, and require maintenance. Accuracy of market timing claims backed by real-time data creates risk if data is stale. | Use AI-generated market reasoning (DevExec) and static curated genre trend signals instead. |
| TMDB auto-population for all screenplays | `tmdbStatus` exists on the type. Batch-populating TMDB for 500 screenplays would require 500 API calls on every refresh, rate-limit management, and handling ambiguous title matches. The data would be stale within weeks. | Populate TMDB status on upload only, not retroactively. Show TMDB link where already populated. |
| Per-partner access controls / view tracking | Knowing "who viewed the link and when" sounds useful but requires server-side analytics, auth tokens, and Firestore write-on-view. The security surface area is not worth it for an internal tool. | Share via email with a note. The partner relationship is human, not software-tracked. |
| Undo/redo stack for all operations | CONCERNS.md flags this. While valuable, implementing a full undo/redo system for Firestore-backed operations requires event sourcing or command pattern, which is a significant architectural addition. | Implement soft delete (mark as deleted, restore within 30 days) as the safety net instead. |

---

## Feature Dependencies

```
Per-screenplay share link
  → requires: /view/{id} route (React Router)
  → requires: read-only screenplay view component (new component, not ScreenplayModal)
  → optional: token expiry (Firestore TTL field)

Export coverage package
  → requires: producer notes fetched at export time (notesStore already has this)
  → requires: per-screenplay PDF layout variant in PdfDocument.tsx
  → enhances: per-screenplay share link (can include download link in shared view)

DevExec per-screenplay mode
  → requires: ScreenplayModal entry point (UI change)
  → requires: devExecService scoped context variant (logic change)
  → enables: comparable title deep-dive (depends on scoped mode)

Comparable titles display
  → data already present: comparableFilms[] on Screenplay type
  → enhances: DevExec per-screenplay mode (comps can be passed as context)
  → weak dependency on: TMDB status (adds production context to comps, not required)

Market timing indicator (genre)
  → requires: static signal map (genre → trend status) OR DevExec query
  → if DevExec: depends on DevExec per-screenplay mode

Budget feasibility indicator
  → requires: static lookup (budget tier × genre → return range) OR DevExec query
  → if DevExec: depends on DevExec per-screenplay mode

Sync status visibility
  → requires: expose PENDING_QUEUE_KEY count from analysisStore
  → enables: retry UI (depends on knowing there's something to retry)

Retry UI
  → depends on: sync status visibility
  → requires: "force retry" action in analysisStore

Performance at scale
  → independent of features above
  → should be addressed before or in parallel with sharing (share links expose the app to new users at scale)
```

---

## MVP Recommendation

For this milestone, prioritize in this order:

**Must ship (high trust / high value):**
1. Sync status visibility + retry UI — eliminates silent data loss risk before any sharing feature goes live
2. Loading and empty states — table stakes UX that makes the tool feel complete
3. Per-screenplay share link (read-only `/view/{id}` route) — primary producer goal
4. Export coverage package (single-screenplay PDF with notes) — formal sharing complement to the link

**Ship if possible (high value, lower risk):**
5. Comparable titles display in detail modal — data is already there, display work only
6. DevExec per-screenplay mode — high productivity value, architecturally straightforward

**Defer to next milestone:**
7. Market timing indicator — requires either external data strategy decision or AI accuracy caveats
8. Budget feasibility indicator — same data strategy uncertainty
9. Performance optimization — important but not yet blocking at current scale; revisit when pipeline exceeds 750 screenplays
10. DevExec comparable deep-dive — depends on #6, lower urgency

**Never build (this tool):**
- Multi-user auth, collaboration, pipeline tracking, email ingestion, mobile app

---

## Sources

- PROJECT.md — Validated requirements and out-of-scope decisions (HIGH confidence)
- src/types/screenplay.ts — Existing data model including comparableFilms, producerMetrics, tmdbStatus (HIGH confidence — source code)
- src/services/devExecService.ts — DevExec architecture and quick actions (HIGH confidence — source code)
- src/components/share/ShareModal.tsx — Current share implementation (copy link + mailto only) (HIGH confidence — source code)
- .planning/codebase/CONCERNS.md — Known tech debt and performance bottlenecks (HIGH confidence — audit document)
- .planning/codebase/INTEGRATIONS.md — Firebase rules state, API integrations (HIGH confidence — audit document)
- Domain knowledge: professional screenplay coverage workflow (MEDIUM confidence — training data, no external verification available)
  - Coverage reports in professional context: logline + synopsis + scores + strengths/weaknesses + recommendation + producer notes
  - Partner sharing conventions: PDF document or read-only link, not dashboard access
  - Comparable titles role: financier justification, not just script context
  - Market timing: qualitative producer judgment, not algorithmic — AI synthesis is appropriate proxy
