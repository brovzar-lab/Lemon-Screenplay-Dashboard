# Technology Stack — Milestone: Dev Exec Insights + Sharing

**Project:** Lemon Screenplay Dashboard
**Milestone:** Partner sharing, comparable title lookups, market trend analysis, budget feasibility
**Researched:** 2026-03-13
**Overall confidence:** MEDIUM-HIGH (based on verified package.json versions + deep codebase read; no live web search available)

---

## Context: What Already Exists

The existing stack (React 19.2 + TypeScript 5.9 + Vite 7.2 + Tailwind CSS 4.1 + Zustand 5 + TanStack Query 5 + Firebase 12.9 + @react-pdf/renderer 4.3) is the immovable foundation. Every recommendation below must integrate cleanly with it — no new frameworks, no new backends, no new hosting.

The AI analysis pipeline already emits `comparable_films[]` in raw V6 JSON (visible in `promptClient.ts` line 181). That field is the entry point for comparable title enrichment — it is already populated, just not surfaced in the UI or enriched with market data.

The existing `ShareModal.tsx` currently shares the full dashboard URL (filtered view) via clipboard and mailto. It does NOT implement per-screenplay access control or token-gated views. That gap is the core of the sharing work.

---

## Recommended Stack

### 1. Partner Sharing — Token-Gated Access (No Auth System)

**Approach: Firestore share-token documents + React Router public route**

The app has no auth system and the constraint says "no user accounts needed." The correct pattern for this context is:

1. Producer generates a UUID token, stored as a Firestore document in a `shared_views` collection with the screenplay data snapshot and an expiry timestamp.
2. Link is `https://app.firebaseapp.com/share/{token}`.
3. A new React Router 7 route (`/share/:token`) fetches the document — no auth required since the token IS the access credential.
4. Firestore security rules allow `read` on `shared_views` collection if the document's `active` field is `true` (rule does not need auth; the token path is the secret).

| Component | Technology | Version | Why |
|-----------|------------|---------|-----|
| Token generation | `crypto.randomUUID()` | Web API (no install) | Browser-native, no dependency, RFC 4122 compliant |
| Token storage | Firestore `shared_views` collection | firebase ^12.9.0 (installed) | Already present SDK, no new backend service |
| Link routing | React Router 7 `createBrowserRouter` | react-router-dom ^7.13.0 (installed) | Installed, existing routing infrastructure |
| Expiry enforcement | Firestore server timestamp + client check | firebase ^12.9.0 (installed) | No Cloud Function needed for simple expiry |
| Copy-to-clipboard | `navigator.clipboard.writeText()` | Web API (no install) | Already used in ShareModal |

**What NOT to use:**
- Firebase Dynamic Links — deprecated as of August 2025, Firebase announced shutdown
- Firebase Anonymous Auth — adds complexity with no benefit for a token-URL pattern
- Short URL services (Bitly, etc.) — external dependency, unnecessary for internal tool

**Confidence:** HIGH — this pattern is well-established for no-auth sharing in Firebase apps, all pieces are already installed.

---

### 2. Export Package — Zipped Coverage Bundle

**Approach: JSZip (browser-side) + existing @react-pdf/renderer**

The existing `ExportModal.tsx` already generates PDF blobs using `@react-pdf/renderer`. The new "export package" feature should zip:
- The AI analysis summary PDF (from existing PdfDocument component)
- The original screenplay PDF (fetched from Firebase Storage via `getBlob()` — already done in the codebase)
- Producer notes as a plain-text or PDF file
- A JSON metadata file for programmatic use

| Component | Technology | Version | Why |
|-----------|------------|---------|-----|
| Zip generation | `jszip` | ^3.10.1 | Industry standard, browser-native (no Node.js required), well-maintained, works with Blob/ArrayBuffer — compatible with Firebase Storage `getBlob()` output |
| ZIP download trigger | `file-saver` | ^2.0.5 | Clean cross-browser download of Blob, handles Safari quirks that raw `<a href>` misses |
| Analysis PDF | `@react-pdf/renderer` | ^4.3.2 (installed) | Already used, already generates Blob |
| Screenplay PDF | Firebase Storage `getBlob()` | firebase ^12.9.0 (installed) | Already in codebase, fetches raw PDF bytes |
| Notes attachment | Plain text string → Blob | Web API (no install) | Producer notes from `notesStore.ts` as `.txt` file in zip |

**Installation:**
```bash
npm install jszip@^3.10.1 file-saver@^2.0.5
npm install -D @types/file-saver@^2.0.7
```

**What NOT to use:**
- `fflate` — faster but less ergonomic API, no benefit for single-download use case
- Server-side zip via Cloud Function — adds latency and billing, unnecessary when all assets are client-accessible
- `StreamSaver.js` — addresses streaming for very large zips, overkill here (packages are <50 MB)

**Confidence:** HIGH — JSZip + file-saver is the canonical browser zip pattern; both libraries are stable and dependency-light.

---

### 3. Comparable Title Enrichment — TMDB API

**Approach: TMDB API via proxied Cloud Function (protect API key server-side)**

The V6 analysis prompt already produces `comparable_films: []` — a list of film title strings Claude identifies as comparable. The missing piece is enriching those titles with poster images, box office data, release year, genre tags, and streaming availability.

TMDB (The Movie Database) is the correct choice:
- Free tier covers all use cases here (500 requests/hour rate limit, ample for <500 screenplays)
- Returns: poster images, genres, release date, runtime, vote average, revenue/budget (where available)
- The `/search/movie` endpoint matches title strings to TMDB entries; `/movie/{id}` returns full detail including revenue
- No CORS issues when called from a Cloud Function proxy

| Component | Technology | Version | Why |
|-----------|------------|---------|-----|
| Film data API | TMDB API v3 | REST (no SDK needed) | Free, comprehensive, covers box office + poster + streaming; standard in film industry tools |
| API proxy | Firebase Cloud Function (existing `functions/src/`) | firebase-functions (installed) | API key stays server-side; existing Cloud Function infrastructure already deployed |
| Client caching | TanStack React Query `useQuery` | ^5.90.20 (installed) | Installed, already used for server state; staleTime of 24h appropriate (film data doesn't change) |
| Result caching in Firestore | `tmdb_cache` Firestore collection | firebase ^12.9.0 (installed) | Cache TMDB results per film title to avoid redundant API calls across sessions and screenplays |
| TypeScript types | Hand-written or `@types/tmdb-js` | — | TMDB has no official TS SDK; write minimal interfaces for the 3-4 endpoints used |

**TMDB endpoints needed:**
- `GET /search/movie?query={title}&year={year}` — find TMDB ID from comparable_films string
- `GET /movie/{id}?append_to_response=release_dates` — budget, revenue, genres, runtime
- `GET /movie/{id}/similar` — optional: find additional comparable titles beyond what Claude returned

**Cloud Function addition:**
```typescript
// New export in functions/src/index.ts
export { getTmdbData } from './tmdbProxy';
```

**What NOT to use:**
- OMDb API — lighter but no streaming data, worse poster quality, smaller dataset
- JustWatch API — private/unofficial, no public API contract
- Letterboxd API — no public API
- The Numbers / Box Office Mojo — no public API, scraping violates ToS
- TMDB JavaScript SDK (`tmdb-ts`) — unnecessary wrapper for 3 endpoints; adds bundle weight with no benefit

**Confidence:** MEDIUM — TMDB API is well-documented and stable (HIGH confidence on that). The proxy-via-Cloud-Function pattern is the correct security approach (HIGH). Specific TMDB response shapes for revenue/budget have ~60% fill rate (many films have $0 in TMDB for these fields) — flag this as a data quality constraint to surface in the UI (e.g., "Box office data unavailable" when field is 0).

---

### 4. Market Trend Analysis — Claude-Powered (No External API)

**Approach: Leverage existing Claude integration, not a new data API**

This is the most important architectural decision in this milestone. There is no affordable, reliable, real-time market trend API for the indie film / screenplay domain. Options examined:

| Option | Problem |
|--------|---------|
| Nielsen/Comscore streaming data | Enterprise contract only, $10K+/month |
| Box Office Mojo / The Numbers | No API, scraping violates ToS |
| Gracenote/Rovi | Enterprise licensing |
| TMDB trending endpoints | Popularity score only, not genre saturation signal |

**The correct approach for this budget-conscious internal tool:** ask Claude.

The existing Claude analysis already produces `lenses.commercial_viability.box_office_ceiling` and CVS scores. A new "market context" prompt can ask Claude to assess whether the screenplay's genre/theme combination is currently saturated or underserved — grounding the answer in its training data (films through early 2025) with honest uncertainty flagging.

| Component | Technology | Version | Why |
|-----------|------------|---------|-----|
| Market analysis | Anthropic API (existing prompt system) | SDK in functions (installed) | Already proxied through Cloud Function; marginal cost per analysis is low (Haiku is ~$0.001 per call) |
| Prompt structure | New `market_timing` lens in `LENS_PROMPTS` | — | Follows existing lens architecture (see `promptClient.ts` `LENS_PROMPTS` object) |
| Result storage | Firestore in existing screenplay document | firebase ^12.9.0 (installed) | Add `lenses.market_timing` field alongside existing lens fields |
| Display | New section in screenplay modal | — | Existing modal pattern, no new libraries |

**Market timing lens prompt output structure:**
```json
{
  "market_timing": {
    "enabled": true,
    "genre_saturation": "underserved | competitive | saturated",
    "saturation_rationale": "...",
    "comparable_recent_releases": ["Title (Year)", "..."],
    "timing_recommendation": "...",
    "confidence": "low | medium | high",
    "data_cutoff_note": "Analysis based on Claude training data through early 2025"
  }
}
```

**What NOT to use:**
- Real-time streaming trend APIs — no affordable option exists for this domain
- Google Trends API — tracks search interest, not film market saturation; misleading signal
- Building a web scraper — violates ToS, fragile, maintenance burden

**Confidence:** HIGH for the approach (use Claude). MEDIUM for accuracy of market timing signal (Claude's training data is stale by 12+ months by the time this ships — must be surfaced clearly in the UI with the data cutoff note).

---

### 5. Budget Feasibility Analysis — Claude-Powered with TMDB Data Grounding

**Approach: Extend existing `production_readiness` lens + TMDB comparable revenue data**

The existing `production_readiness` lens already produces `production_feasibility.score` (0-100) and `readiness_verdict`. Budget feasibility is a natural extension: given the script's genre/scope/locations, estimate production cost range and likely return, grounded by actual comparable film revenue from TMDB.

| Component | Technology | Version | Why |
|-----------|------------|---------|-----|
| Budget estimation | Claude `budget_feasibility` lens (new) | Anthropic API (installed) | Extends existing lens architecture; uses screenplay text + metadata as input |
| Revenue grounding | TMDB comparable film revenue (from #3 above) | TMDB API via Cloud Function | Actual comparable film budgets/revenues ground Claude's estimates in real data |
| Display | New `BudgetFeasibilityPanel` component | — | Recharts 3 bar chart showing budget range vs. comparable revenue range (Recharts installed) |
| Currency formatting | `Intl.NumberFormat` | Web API (no install) | Browser-native, no library needed |

**Budget feasibility output:**
```json
{
  "budget_feasibility": {
    "enabled": true,
    "estimated_budget_range": { "low": 500000, "high": 2000000, "currency": "USD" },
    "budget_tier": "micro | low | mid | studio",
    "comparable_budget_data": [{ "title": "...", "budget": 0, "revenue": 0 }],
    "roi_assessment": "...",
    "financing_notes": "...",
    "confidence": "low | medium | high"
  }
}
```

**Important caveat:** TMDB budget/revenue fields are frequently missing (reported as 0) for independent films under $10M — exactly the range most relevant here. The UI must handle the missing-data case gracefully. Claude's estimate should be the primary signal; TMDB data supplements it when available.

**What NOT to use:**
- Building a proprietary budget database — out of scope, maintenance burden
- Nash Entertainment / GREENLIGHT budget tools — enterprise, no API
- Spreadsheet import for budget comps — too manual, defeats the purpose

**Confidence:** MEDIUM — the approach is sound. The data quality caveat on TMDB indie film financials is a known limitation; the UI must be designed to communicate this clearly.

---

### 6. Performance at Scale — No New Libraries

**Approach: Use existing React 19 concurrent features + virtual scrolling**

At 500-1000 screenplays, the main bottleneck is the screenplay card grid. The fix is virtual scrolling — rendering only visible cards.

| Component | Technology | Version | Why |
|-----------|------------|---------|-----|
| Virtual scrolling | `@tanstack/react-virtual` | ^3.13.0 | TanStack family already installed (React Query 5), same maintainer, minimal API surface, zero framework opinions, works with any layout |
| Filter memoization | `useMemo` (React, installed) | React 19.2 (installed) | `useFilteredScreenplays.ts` already uses `useMemo`; the fix is input stability, not a new library |
| Deferred updates | `useDeferredValue` (React 19) | React 19.2 (installed) | Defer filter recalculation while user is typing — no new library needed |

**Installation:**
```bash
npm install @tanstack/react-virtual@^3.13.0
```

**What NOT to use:**
- `react-window` — deprecated in favor of react-virtual from same author
- `react-virtuoso` — feature-rich but heavier; unnecessary complexity for a grid
- `react-virtual` v2 — outdated; v3 is current

**Confidence:** HIGH — @tanstack/react-virtual v3 is the current recommended solution, same ecosystem as TanStack Query already installed.

---

### 7. Data Sync Reliability — No New Libraries

**Approach: UI layer over existing dual-write pattern**

The CONCERNS.md documents that Firestore write failures are silent. The fix is visibility, not architecture change. No new libraries are needed — this is a UI + store pattern update.

| Component | Technology | Version | Why |
|-----------|------------|---------|-----|
| Sync state tracking | New `syncStatusStore.ts` (Zustand) | zustand ^5.0.10 (installed) | Follows existing store pattern; tracks pending count, last sync time, error list |
| Sync status indicator | New `SyncStatusBadge` component | — | Tailwind-styled inline indicator; no new component library |
| Retry trigger | Existing `flushPendingWrites()` | — | Already implemented in `analysisStore.ts`; expose as callable action |
| Online detection | `navigator.onLine` + `window addEventListener('online')` | Web API (no install) | Browser-native, trigger sync when connection restored |

---

## Complete Installation Summary

```bash
# New runtime dependencies
npm install jszip@^3.10.1 file-saver@^2.0.5 @tanstack/react-virtual@^3.13.0

# New dev dependencies
npm install -D @types/file-saver@^2.0.7
```

Everything else is already installed or is implemented via existing APIs (Anthropic, Firestore, Cloud Functions, React Router, Recharts, Zustand).

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Sharing | Firestore token docs + UUID | Firebase Dynamic Links | Deprecated Aug 2025 |
| Sharing | Firestore token docs + UUID | Firebase Anonymous Auth | Unnecessary complexity for token-URL pattern |
| Zip generation | jszip | fflate | More ergonomic API for this use case; fflate advantage (speed) not relevant for single-user download |
| Zip download | file-saver | raw `<a>` download | file-saver handles Safari Blob URL quirks correctly |
| Film data | TMDB API | OMDb | TMDB has richer data (revenue, posters, streaming) and free tier |
| Market trends | Claude lens | Google Trends / Nielsen | No affordable domain-specific API exists; Claude is already integrated |
| Budget feasibility | Claude lens + TMDB data | Greenlight / Nash | Enterprise-only, no API |
| Virtual scrolling | @tanstack/react-virtual | react-window | react-window deprecated; react-virtual is the successor |

---

## Sources

**Verified from codebase (HIGH confidence):**
- `package.json` — all version numbers confirmed
- `src/lib/firebase.ts` — Firebase SDK initialized, Firestore + Storage available
- `src/lib/analysisStore.ts` — dual-write pattern, pending queue mechanism
- `src/lib/promptClient.ts` — V6 lens architecture, `comparable_films` field in JSON schema
- `src/components/share/ShareModal.tsx` — current sharing (URL copy/email only, no token gating)
- `src/components/export/ExportModal.tsx` — existing PDF/CSV export, `@react-pdf/renderer` Blob pattern
- `.planning/codebase/INTEGRATIONS.md` — existing integrations confirmed
- `.planning/codebase/CONCERNS.md` — known issues: silent Firestore failures, localStorage quota

**Known from documentation and ecosystem knowledge (MEDIUM-HIGH confidence):**
- Firebase Dynamic Links deprecation (announced August 2025 shutdown)
- TMDB API v3 endpoint structure and free tier limits
- JSZip 3.x browser compatibility and API
- @tanstack/react-virtual v3 as successor to react-window
- TMDB indie film revenue data quality limitation (~60% fill rate for budget/revenue fields)
- Claude training data cutoff implications for market timing accuracy

**Flagged as LOW confidence (needs validation before implementation):**
- Exact TMDB rate limits for the free tier in 2026 (verify at developers.themoviedb.org)
- Current Firebase Cloud Functions v2 timeout limits for TMDB proxy calls
- Whether `comparable_films` array from Claude is populated reliably across V6 analyses (audit production data before building enrichment UI)
