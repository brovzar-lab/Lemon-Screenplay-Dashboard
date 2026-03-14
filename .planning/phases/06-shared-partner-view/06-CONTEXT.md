# Phase 6: Shared Partner View - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

A partner who receives a share link sees a clean, standalone read-only analysis view — with no access to the dashboard, settings, or other screenplays. The `/share/:token` route resolves the token from Firestore, displays the analysis, and handles invalid/revoked tokens gracefully.

</domain>

<decisions>
## Implementation Decisions

### View layout & content
- **Standalone page** — purpose-built, not a modal. No dashboard frame, header, or navigation
- **Full analysis** shown: logline, synopsis, all dimension scores, strengths, weaknesses, recommendation, and producer notes (if `includeNotes` is true in the share token)
- **Same premium gold/black theme** as the dashboard — consistent Lemon Studios branding
- **AI-generated poster** shown as visual header if one exists for the screenplay
- **Download Script button** — links directly to Firebase Storage URL (already publicly readable)
- Read-only — no editing, no navigation to other screenplays, no settings access

### Branding & attribution
- **Subtle Lemon Studios branding** — small logo or text in header/footer, professional but not overbearing
- **No AI attribution** — don't mention the analysis is AI-generated; the producer shares it as their coverage
- **No producer name** — no "Shared by [name]"; the partner already knows who sent the link

### Invalid link experience
- **Branded error page** — clean page with Lemon Studios branding: "This link is no longer available"
- Not a raw 404 or generic error — feels professional and intentional

### Claude's Discretion
- Page layout structure (single column vs sidebar, section ordering)
- Score visualization (reuse existing ScoreBar or simplified display)
- Loading state design while fetching from Firestore
- Whether to lazy-load the `/share/:token` route (ROADMAP says yes — lazy-loaded, no dashboard bundle)
- Poster image sizing and placement

</decisions>

<specifics>
## Specific Ideas

- Route: `/share/:token` — lazy-loaded via `React.lazy()` to avoid including dashboard bundle code
- Token resolution: read from `shared_views` Firestore collection (already `allow read: if true`)
- The share doc contains: `screenplayId`, `token`, `includeNotes`, `pdfUrl`, `createdAt`
- Screenplay data is in `uploaded_analyses` collection (requires auth) — the share doc should snapshot key analysis data at creation time OR the shared view needs to read from `uploaded_analyses` (which requires anonymous auth)
- Producer notes are in `screenplay_feedback` collection (already readable by authenticated sessions)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/shareService.ts`: `resolveShareToken()` or similar needed to look up a token (may need to add)
- `src/components/ui/ScoreBar.tsx`: Score display component, reusable in shared view
- `src/components/ui/RecommendationBadge.tsx`: Recommendation tier badge
- `src/lib/normalize.ts`: `normalizeV6Screenplay()` for transforming raw analysis data
- Premium theme CSS: `glassmorphism.css`, `mesh-gradients.css`, gold/black palette
- `src/components/ui/LoadingFallback.tsx`: Branded spinner for Suspense boundary

### Established Patterns
- React Router 7 for routing (`App.tsx` has BrowserRouter)
- `React.lazy()` + Suspense for code-split routes (SettingsPage uses this)
- Firestore reads gated by `authReady`

### Integration Points
- `src/App.tsx` — Add `/share/:token` route with React.lazy
- `src/lib/shareService.ts` — Add `resolveShareToken(token)` function
- New `src/pages/SharedViewPage.tsx` — Main shared view page component
- `firestore.rules` — `shared_views` already allows public read

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-shared-partner-view*
*Context gathered: 2026-03-14*
