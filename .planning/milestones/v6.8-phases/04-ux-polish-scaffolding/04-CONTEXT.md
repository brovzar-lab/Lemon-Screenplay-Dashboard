# Phase 4: UX Polish Scaffolding - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

The dashboard communicates its state (loading, empty, error) clearly at every step — no silent failures, no blank screens. Covers skeleton loaders, empty states, inline error feedback, and localStorage corruption resilience.

</domain>

<decisions>
## Implementation Decisions

### Skeleton & empty state coverage
- UX-01 and UX-02 are **already implemented** — `SkeletonCard` (9 cards during load) and `EmptyState` (with "Clear Search" and "Reset All Filters" actions) exist in `ScreenplayGrid.tsx`
- No modal skeleton needed — modal data is already available from the card click (client-side, no separate fetch)
- Grid skeleton and empty state are good as-is, no tweaks needed
- Whether to add skeletons to analytics dashboard or other views is at Claude's discretion

### Error notification system
- **Style**: Toast notifications positioned at **bottom-center** of the screen
- **Auto-dismiss**: Toasts auto-dismiss after ~5 seconds; user can dismiss early with X button
- **Stacking**: Max 3 toasts visible at once; additional errors collapse into "+N more errors" on the last toast
- **Severity**: Errors and warnings only — no success confirmations. Success is the expected default; less noise
- **Scope**: Replace all silent `console.error` calls in user-facing operations (upload, delete, note save, sync failures) with user-visible toast feedback. 47 `console.error/warn` calls across 18 files to audit

### Corrupt store recovery (JSON.parse hardening)
- **Preferences (Zustand stores)**: Silent reset to defaults — no notification when filters, theme, sort preferences, or API config resets
- **Data (Firestore responses, API responses)**: Show a toast when parse fails so the user knows something's off
- **Pending write queue**: Discard and reset corrupt queue — next full Firestore sync will reconcile
- **Scope**: 16 files use `JSON.parse` — all need audit and try/catch wrapping with appropriate fallback

### Claude's Discretion
- Toast component implementation details (animation, visual styling matching gold/black theme)
- Whether analytics dashboard gets skeleton/empty states (check if there's a noticeable loading gap)
- Which of the 47 console.error calls should become user-visible toasts vs remain as debug logs (not all errors are user-actionable)
- Toast notification store implementation (Zustand or lightweight custom)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ScreenplayGrid.tsx`: Already has `SkeletonCard` and `EmptyState` components (lines 24-129) — UX-01 and UX-02 are done
- `ErrorBoundary.tsx`: React error boundary with try-again button — catches render errors, not async operation failures
- `LoadingFallback.tsx`: Branded spinner for React.lazy() Suspense boundaries
- Premium theme CSS: Gold/black with glassmorphism — toasts should match this visual language

### Established Patterns
- Zustand stores with `persist` middleware for client state — stores already handle localStorage serialization
- Console logging uses `[Prefix]` pattern: `[Lemon]`, `[Poster]`, `[ErrorBoundary]` — toast messages should follow similar categorization
- One store per domain — toast/notification state would be its own store in `src/stores/`
- Error handling uses `instanceof Error ? err.message : 'Unknown error'` pattern

### Integration Points
- `src/lib/analysisStore.ts` — 8 console.error calls (Firestore sync, pending writes, data loading)
- `src/lib/api.ts` — 8 console.error calls (screenplay loading, stats)
- `src/lib/feedbackStore.ts` — 5 console.error calls (note save/load)
- `src/components/settings/UploadPanel.tsx` — 1 console.error (upload failures)
- `src/hooks/useLiveDevExec.ts` — 3 console.error (AI chat failures)
- All Zustand stores with `persist` middleware — need JSON.parse safety audit

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraint: toasts must feel native to the existing premium gold/black glassmorphism theme.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-ux-polish-scaffolding*
*Context gathered: 2026-03-13*
