# Project Research Summary

**Project:** Lemon Screenplay Dashboard — Dev Exec Insights + Sharing Milestone
**Domain:** Internal production studio screenplay analysis dashboard (single-producer, high-volume pipeline)
**Researched:** 2026-03-13
**Confidence:** HIGH (all research grounded in direct codebase audit + verified package.json)

## Executive Summary

This milestone adds partner sharing, export packages, comparable title enrichment, market timing intelligence, and UX polish to an already-shipped React 19 + Firebase production application at v6.8.21. The existing stack is immovable and well-chosen. The primary work is building on top of it — not replacing or supplementing it with new frameworks. Three new runtime dependencies are all that are needed: `jszip`, `file-saver`, and `@tanstack/react-virtual`. Everything else — Claude, Firestore, Firebase Storage, React Router, Recharts, @react-pdf/renderer, Zustand — is already installed and integrated.

The recommended approach centers on a strict dependency ordering that most teams would get wrong: data sync reliability and Firestore security hardening must ship before any sharing feature. The existing app has open Firestore rules (`allow read: if true`) and a dual-write pattern that silently queues failed Firestore writes. The moment a share link goes to a partner, both issues become production incidents — a partner with one link can query all 500+ screenplays, and a screenplay that failed to sync to Firestore will 404 for the partner even though the producer's dashboard shows it fine. These are prerequisites, not parallel tracks.

The most opinionated research finding concerns market timing and budget feasibility: there is no affordable real-time film market data API. Box Office Mojo, The Numbers, Comscore, and Nielsen are all enterprise-only or ToS-restricted. The correct approach for this budget-conscious internal tool is to use the existing Claude integration to generate AI-powered market context assessments — with explicit data cutoff labeling in the UI. TMDB provides supplementary film metadata (posters, revenue where available, comparable title lookup) at no cost, but its budget/revenue fill rate for indie films is ~60% and the UI must handle zero-values gracefully.

## Key Findings

### Recommended Stack

The existing stack requires only three additions. `jszip@^3.10.1` and `file-saver@^2.0.5` enable browser-native ZIP generation for coverage packages without a server round-trip for the PDF-only path. `@tanstack/react-virtual@^3.13.0` provides virtual scrolling for the screenplay grid — same TanStack family as React Query already installed, zero framework opinions.

For external film data, TMDB API v3 is the correct choice over OMDb (richer data, free tier) proxied through a Firebase Cloud Function to keep the API key server-side. Market timing and budget feasibility analysis should be powered by new Claude lenses (`market_timing`, `budget_feasibility`) using the existing `LENS_PROMPTS` architecture in `promptClient.ts` — no new API integrations required. Firebase Dynamic Links are deprecated as of August 2025; partner sharing uses `crypto.randomUUID()` tokens stored in a Firestore `shared_views` collection with a new `/share/:token` React Router route.

**Core technologies:**
- `jszip@^3.10.1` + `file-saver@^2.0.5`: browser ZIP generation — canonical browser zip pattern, no server required for PDF-only packages
- `@tanstack/react-virtual@^3.13.0`: virtual scrolling — successor to deprecated react-window, same ecosystem as installed TanStack Query
- TMDB API v3 (via Cloud Function proxy): comparable title enrichment — free tier, best coverage for film metadata, keeps API key server-side
- `crypto.randomUUID()` + Firestore `shared_views`: share tokens — browser-native, no new dependency, RFC 4122 compliant
- Claude `market_timing` + `budget_feasibility` lenses: market intelligence — extends existing lens architecture, no new API keys needed

### Expected Features

**Must have (table stakes):**
- Per-screenplay shareable link with token expiry — producer's primary stated goal; current ShareModal shares the full dashboard, not a single script
- Export coverage package (analysis PDF + producer notes) — industry-standard formal deliverable; partners expect PDFs, not dashboard links
- Sync status visibility + retry UI — data loss is currently silent; 500+ screenplays at risk; prerequisite for sharing
- Loading and empty states — grid shows nothing during load; absence makes the tool feel broken

**Should have (differentiators):**
- Comparable titles display in detail modal — data already exists in `comparableFilms[]` array; this is display work only
- DevExec per-screenplay mode — scoped AI context from ScreenplayModal; architecturally straightforward extension of existing `devExecService.ts`
- Market timing indicator per genre — AI-generated Claude assessment with visible data cutoff date
- Budget feasibility indicator — Claude lens extension of existing `production_readiness` lens, grounded by TMDB comp revenue data where available
- Performance optimization (virtual scrolling) — must precede heavy UX polish at 500+ screenplays
- Slate health dashboard (genre/budget matrix) — data already present; Recharts chart addition to `AnalyticsDashboard.tsx`

**Defer (v2+):**
- DevExec comparable title deep-dive — depends on per-screenplay mode shipping first
- TMDB batch enrichment for all screenplays — 500 API calls, rate-limit management, stale data; populate on upload only
- Per-partner access controls / view tracking — server-side analytics, auth tokens; not worth the surface area for internal tool
- Undo/redo stack — requires event sourcing; soft delete is the right safety net instead

**Never build:**
- Multi-user auth, real-time collaboration, pipeline status tracking, email ingestion, mobile app

### Architecture Approach

All new features slot into the existing layered architecture: Firebase/API → lib/ → React Query → hooks/ → Zustand stores → Components. Components never call Firebase directly. The key new surface areas are: a `shareService.ts` in `lib/` handling `shared_views` Firestore CRUD; a `SharedViewPage.tsx` public read-only route (lazy loaded); a `CoveragePackageDocument.tsx` PDF template distinct from the existing pitch deck; a `marketInsightsService.ts` in `services/` proxying Claude prompts; and a `syncStatusStore.ts` in `stores/` tracking pending/failed Firestore write counts. Share token metadata belongs in Firestore only — not localStorage — to avoid pushing the already-near-limit localStorage budget over the edge.

**Major components (new):**
1. `src/lib/shareService.ts` — share token CRUD via Firestore `shared_views` collection
2. `src/pages/SharedViewPage.tsx` — public read-only partner view, lazy loaded via `React.lazy()`
3. `src/components/share/SharedViewLayout.tsx` — stripped-down read-only presentation layer with no dashboard chrome
4. `src/lib/exportPackageService.ts` — coverage package orchestration: analysis PDF + notes + optional screenplay PDF via JSZip
5. `src/components/export/CoveragePackageDocument.tsx` — new @react-pdf/renderer document template with notes section
6. `src/services/marketInsightsService.ts` — Claude prompt for market timing + budget feasibility per screenplay
7. `src/stores/marketInsightsStore.ts` — persisted cache of insights per screenplay ID (evict entries >30 days)
8. `src/stores/syncStatusStore.ts` — pending/failed Firestore write counts, surfaces to `SyncStatusIndicator`
9. `src/components/layout/SyncStatusIndicator.tsx` — header sync dot with retry affordance
10. `src/components/ui/SkeletonCard.tsx`, `SkeletonModal.tsx`, `EmptyState.tsx` — UX polish primitives

### Critical Pitfalls

1. **Sharing dashboard URL instead of a per-screenplay token** — any share implementation that passes `window.location.href` exposes the full dashboard to partners (500+ scripts, Settings UI, API key config, private notes). Architect as `/share/:token` reading from `shared_links` Firestore collection before writing any code. The existing `ShareModal` must be rebuilt, not extended.

2. **Open Firestore rules cross the security threshold when sharing goes external** — current `allow read: if true` means any partner with one share link can `getDocs(collection(db, 'uploaded_analyses'))` from the browser console and download all 500+ screenplays including private feedback. App Check re-enablement and per-path Firestore rules must land before any partner link is generated.

3. **Dual-write lag causes shareable screenplay to 404 for partners** — `analysisStore.ts` writes localStorage first, then Firestore async. A screenplay that silently failed Firestore sync will 404 for partners while appearing fine to the producer (who reads localStorage). Sync status UI must ship before sharing; share token generation must verify Firestore document existence before creating the token.

4. **Client-side PDF merge causes memory explosion on large screenplays** — `@react-pdf/renderer` cannot merge existing PDFs. Bundling a 120-page screenplay PDF (5–15 MB) with the analysis PDF client-side loads 50–100 MB into browser memory; crashes Safari on iOS silently. If bundling the original PDF: use a Cloud Function. If client-side is required: generate the analysis PDF only and link to the Firebase Storage URL for the original.

5. **`isV6RawAnalysis()` false-negative permanently deletes a shared screenplay** — `api.ts` calls destructive `removeAnalysis()` on any document failing the type guard. A V6 edge case or future format produces a document that fails the guard → Firestore delete → partner link 404s. Implement the quarantine pattern (`_unrecognized_analyses` collection) before sharing ships.

## Implications for Roadmap

Based on research, the dependency graph is strict. The pitfalls research establishes that Phase 1 (security + sync) is a hard prerequisite for Phase 2 (sharing). Architecture research confirms Phase 3 (export) can proceed in parallel with Phase 2 once foundation work is done. Market intelligence (Phase 4) is independent of sharing but benefits from per-screenplay DevExec scoping work.

### Phase 1: Foundation — Security, Sync, and UX Scaffolding

**Rationale:** Two of the four critical pitfalls (open Firestore rules, dual-write data loss) must be fixed before any sharing feature ships. UX polish primitives (skeletons, empty states) have no feature dependencies and immediately improve perceived quality. These can be built in parallel within the phase.

**Delivers:**
- App Check re-enabled; Firestore rules tightened for `uploaded_analyses` and `screenplay_feedback`
- `syncStatusStore.ts` + `SyncStatusIndicator` in Header: pending count, failure alert, "Retry Now"
- `useSyncRetry.ts` hook polling the existing `PENDING_QUEUE_KEY` retry queue
- `isV6RawAnalysis()` replaced with quarantine pattern (move to `_unrecognized_analyses`, not delete)
- `SkeletonCard`, `SkeletonModal`, `EmptyState` components in `src/components/ui/`

**Avoids:** Pitfall 2 (open rules), Pitfall 3 (dual-write lag for partners), Pitfall 5 (`isV6RawAnalysis` deletion), Pitfall 11 (localStorage quota from share metadata)

**Research flags:** Standard patterns — no phase research needed.

---

### Phase 2: Partner Sharing

**Rationale:** Depends on Phase 1 completing security hardening and sync reliability. The entire value proposition of this milestone — sharing with partners — is blocked until Firestore rules are tightened and Firestore-first write confirmation is in place.

**Delivers:**
- `shareService.ts` in `lib/`: `createShareToken()`, `resolveShareToken()`, expiry enforcement
- `shared_views/{token}` Firestore collection with `screenplayId`, `expiresAt`, `includePdf`, `includeNotes`, `noteSnapshot`
- `ShareScreenplayButton` in `ScreenplayModal` (or screenplay card)
- `SharedViewPage.tsx` (lazy loaded): public read-only route `/share/:token`
- `SharedViewLayout.tsx`: stripped-down analysis view — no settings, no upload, no DevExec
- Route registration in `App.tsx`; `shareStore.ts` tracking generated tokens per session (Firestore-backed, not localStorage)

**Uses:** `crypto.randomUUID()` (browser API, no install), Firestore (existing SDK), React Router 7 (installed), React.lazy (React 19, installed)

**Avoids:** Pitfall 1 (dashboard URL sharing), Pitfall 4 (dual-write: verify Firestore doc before creating token), Pitfall 11 (no localStorage for share metadata)

**Research flags:** Standard patterns — no phase research needed. Firestore token gating is well-documented for no-auth sharing in Firebase apps.

---

### Phase 3: Export Coverage Package

**Rationale:** Can proceed in parallel with Phase 2 or immediately after. Has no dependency on sharing infrastructure. The architectural decision (client-side PDF-only vs. Cloud Function with PDF merge) must be made upfront; the pitfall here (memory explosion from client-side PDF merge) is the primary risk.

**Delivers:**
- `CoveragePackageDocument.tsx`: new `@react-pdf/renderer` document template (logline, synopsis, scores, producer notes, recommendation)
- `exportPackageService.ts`: orchestrates analysis PDF generation + optional screenplay PDF bundling
- `CoveragePackageModal.tsx`: UI configuration (include notes? include original PDF?)
- Export filename includes Firestore document ID suffix to prevent collision (Pitfall 9)
- Decision gate: if bundling original screenplay PDF, build via Cloud Function; if PDF-only, client-side is safe

**Uses:** `jszip@^3.10.1`, `file-saver@^2.0.5` (new installs), `@react-pdf/renderer` (installed), Firebase Storage `getBlob()` (installed)

**Avoids:** Pitfall 3 (memory explosion: no client-side PDF merge for large screenplays)

**Research flags:** The Cloud Function PDF assembly path needs implementation detail research if the full-bundle option ships. The PDF-only path is standard and needs no research.

---

### Phase 4: Market Intelligence and Comparable Title Enrichment

**Rationale:** Architecturally independent of Phases 2 and 3, but benefits from DevExec per-screenplay scoping (also in this phase). Market timing and budget feasibility are the "dev exec insights" half of the milestone. These are higher-risk features (data quality, AI accuracy, cost control) and belong after the lower-risk foundation and sharing work.

**Delivers:**
- Comparable titles prominently displayed in `ScreenplayModal`: title, similarity, `box_office_relevance` from existing `comparableFilms[]` array (display work only — data already present)
- DevExec per-screenplay mode: scoped `devExecService.ts` variant passing `[singleScreenplay]` + comps as context; UI entry point from `ScreenplayModal`
- `marketInsightsService.ts`: Claude prompt for market timing + budget feasibility per screenplay
- `marketInsightsStore.ts`: persisted cache (evict >30 days); "Generate Market Insights" button (not auto-fetch)
- `useMarketInsights.ts` hook
- `MarketInsightsPanel.tsx` in `ScreenplayModal`: market timing badge, budget feasibility, comparable context
- New `market_timing` and `budget_feasibility` Claude lenses stored in Firestore screenplay document
- TMDB proxy Cloud Function (`tmdbProxy.ts`) for comparable title enrichment (poster, revenue, release year)
- `tmdb_cache` Firestore collection caching TMDB results per film title (24h stale time via React Query)

**Uses:** Existing Anthropic API + Cloud Functions (installed), TMDB API v3 (new API key from user), Recharts 3 (installed for budget range chart), `Intl.NumberFormat` (browser API)

**Avoids:** Pitfall 5 (low-quality comp matching: use V6 analysis fields as primary signal, TMDB as supplement), Pitfall 7 (stale market data: AI assessment with visible data cutoff label), Pitfall 4 Anti-Pattern 3 (auto-fetch cost: gate behind explicit user action)

**Research flags:** TMDB API rate limits and Cloud Function timeout for proxy calls need validation before implementation. Confirm `comparable_films` array population rate across production data before building enrichment UI. Claude market timing accuracy for post-2025 titles will be limited — UI must communicate data cutoff clearly.

---

### Phase 5: Performance at Scale and UX Polish

**Rationale:** Virtual scrolling and UX animation work must happen together, not sequentially — adding per-card animations before virtual scrolling causes the exact performance regression the polish is meant to prevent. This phase is last because it depends on knowing the full component tree that needs polish.

**Delivers:**
- `@tanstack/react-virtual` integrated into `ScreenplayGrid` (only ~20 cards rendered in viewport, not all 500+)
- `useDeferredValue` in filter recalculation path
- CSS `opacity` transitions for skeleton states (no `background-position` shimmer on glassmorphism backgrounds)
- `@media (prefers-reduced-motion)` applied to all new animations
- Slate health dashboard: genre × budget tier matrix chart added to `AnalyticsDashboard.tsx`
- Performance budget enforced: filter interaction ≤ 100ms for 500 screenplays

**Uses:** `@tanstack/react-virtual@^3.13.0` (new install), React 19 `useDeferredValue` (installed), Recharts 3 (installed), Tailwind CSS `transition-*` utilities (installed)

**Avoids:** Pitfall 6 (glassmorphism GPU degradation: test on non-M-series hardware; `prefers-reduced-motion`), Pitfall 8 (500+ card re-render: virtual scrolling prerequisite before polish animations)

**Research flags:** Standard patterns — no phase research needed. Virtual scrolling with TanStack Virtual is well-documented.

---

### Phase Ordering Rationale

- Phase 1 before Phase 2: Firestore security and sync reliability are hard prerequisites for external sharing — this is non-negotiable. A partner share link that exposes all 500 screenplays or 404s due to sync lag is worse than no sharing feature at all.
- Phase 2 and 3 in parallel or sequence: Export and sharing share no code dependencies. Teams can build them in parallel if staffing allows; otherwise sharing first (primary stated goal).
- Phase 4 after sharing: Market insights are high-value but higher-risk (API quality, AI accuracy, cost). De-risking sharing first is the right priority ordering.
- Phase 5 last: Can only meaningfully polish the full component tree, including all new components from Phases 2–4. Virtual scrolling must precede any new per-card animation work regardless.

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (Market Intelligence):** TMDB rate limit validation in 2026; Cloud Function timeout for proxy; `comparable_films` production data fill rate audit; UI design for communicating AI data cutoff clearly
- **Phase 3 (Export — Cloud Function path only):** If full PDF bundle (analysis + original screenplay) is required, the Cloud Function implementation for pdf-lib or puppeteer in Node.js needs scoped research before building

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** App Check re-enablement, Zustand store + Firestore patterns, UI primitives — all well-documented
- **Phase 2 (Sharing):** Firestore token gating with UUID is a well-established no-auth sharing pattern; React Router lazy route is standard
- **Phase 3 (Export — PDF-only path):** @react-pdf/renderer document template, JSZip + file-saver — both thoroughly documented
- **Phase 5 (Performance + Polish):** TanStack Virtual v3 and React 19 useDeferredValue — well-documented, standard patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All version numbers verified from package.json; all recommendations use already-installed packages except 3 new installs; no live web search but ecosystem knowledge is solid |
| Features | HIGH | Grounded in direct codebase audit (ShareModal, ExportModal, notesStore, devExecService, screenplay types); domain knowledge on professional coverage workflow is MEDIUM confidence |
| Architecture | HIGH | Derived from full codebase audit (.planning/codebase/ docs + source files); all component boundaries trace to existing patterns |
| Pitfalls | HIGH | All 4 critical pitfalls grounded in specific source files with line-level evidence (firestore.rules, analysisStore.ts, api.ts, pdfParser.ts, CONCERNS.md) |

**Overall confidence:** HIGH

### Gaps to Address

- **TMDB rate limits in 2026:** Verify current free tier limits at developers.themoviedb.org before building the proxy. Research was done without live web access; the documented 500 req/hour may have changed.
- **`comparable_films` array fill rate in production:** Audit actual Firestore documents before building TMDB enrichment UI. If <70% of screenplays have populated `comparable_films`, the feature needs a fallback state designed upfront.
- **Cloud Function timeout for TMDB proxy:** Verify current Firebase Cloud Functions v2 timeout defaults when making sequential TMDB calls for multi-film enrichment. May need explicit timeout configuration.
- **Export package architecture decision (Cloud Function vs. client-side):** The research recommends Cloud Function for full PDF bundle. This needs a stakeholder decision before Phase 3 planning begins — it significantly affects implementation complexity.
- **App Check config mismatch:** `src/lib/firebase.ts` has App Check commented out after a config mismatch. Understand why it was disabled before Phase 1 planning to ensure re-enablement doesn't reintroduce the same issue.

## Sources

### Primary — Codebase (HIGH confidence)
- `package.json` — all installed versions verified
- `firestore.rules`, `storage.rules` — security rule analysis confirming `allow read: if true`
- `src/lib/analysisStore.ts` — dual-write pattern, `PENDING_QUEUE_KEY`, retry queue
- `src/lib/promptClient.ts` — V6 lens architecture, `comparable_films` in JSON schema, `LENS_PROMPTS` object
- `src/lib/api.ts` — destructive `removeAnalysis()` on failed `isV6RawAnalysis()` confirmed
- `src/lib/firebase.ts` — App Check commented out, Firebase SDK initialization
- `src/components/share/ShareModal.tsx` — confirmed: shares dashboard URL only, no token gating
- `src/components/export/ExportModal.tsx` — confirmed: @react-pdf/renderer Blob pattern
- `src/types/screenplay.ts`, `screenplay-v6.ts` — `comparableFilms[]`, `producerMetrics`, `tmdbStatus` field existence
- `.planning/codebase/CONCERNS.md` — dual-write risks, localStorage quota, large-file memory, `isV6RawAnalysis` deletion
- `.planning/codebase/INTEGRATIONS.md` — API keys in localStorage, Firebase config, Anthropic direct-browser-access
- `.planning/codebase/ARCHITECTURE.md` — data flow, state management patterns, error handling

### Secondary — Ecosystem Knowledge (MEDIUM-HIGH confidence)
- Firebase Dynamic Links deprecation (August 2025 shutdown)
- TMDB API v3 endpoint structure and free tier limits (~500 req/hour)
- JSZip 3.x browser compatibility and API surface
- @tanstack/react-virtual v3 as successor to react-window (same author)
- TMDB indie film revenue data quality limitation (~60% fill rate for budget/revenue)
- Claude training data cutoff implications for market timing accuracy

### Tertiary — Needs Validation (LOW-MEDIUM confidence)
- Exact TMDB rate limits in 2026 — verify at developers.themoviedb.org
- Current Firebase Cloud Functions v2 timeout defaults for sequential external API calls
- `comparable_films` population rate across actual production Firestore data

---
*Research completed: 2026-03-13*
*Ready for roadmap: yes*
