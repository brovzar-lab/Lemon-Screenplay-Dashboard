# Phase 2: Performance at Scale - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the dashboard performant with 500-1000+ screenplays through virtual scrolling and memoized filtering. The grid currently renders all cards via `.map()` with no virtualization. Filtering is already memoized with `useMemo` but may need optimization review at scale.

</domain>

<decisions>
## Implementation Decisions

### Animation behavior at scale
- **D-01:** ScoreBar count-up animations fire once per card ID — track "already animated" state so scrolling back to a card shows final values instantly, not re-animating
- **D-02:** Staggered scroll-reveal (fade-in cascade) fires on initial page load only — first viewport batch animates in, everything after appears instantly
- **D-03:** Per-card IntersectionObserver for reveal animation is stripped entirely — the virtual list already knows what's visible, observers become redundant overhead
- **D-04:** Hover-peek (top 3 dimensions on 500ms hover) kept as-is — local to individual card, unaffected by virtualization

### Scroll position behavior
- **D-05:** All grid changes (filter, sort, clear) jump to top — consistent behavior, no scroll position restoration attempts
- **D-06:** Floating "back to top" button appears after scrolling past ~2 screens of cards (~20+ cards) — subtle pill in bottom-right corner, scrolls to top on click

### Card height uniformity
- **D-07:** Fixed card height — all cards are the same height within a given viewport. Loglines clamped to 2 lines for all tiers including FILM NOW
- **D-08:** Height varies by responsive breakpoint — mobile (1-col) cards can be taller, desktop (3-4 col) cards more compact. Virtual list just needs consistent height per row within a viewport
- **D-09:** FILM NOW expanded logline removed — standardized to match all other cards. FILM NOW already stands out via badge and priority sort position. Expanded logline moves to detail modal
- **D-10:** Grid switches from CSS Grid auto-placement to row-based layout — virtual list renders row containers, each containing N cards (N = current column count from responsive breakpoint). Inner cards use flexbox for equal spacing

### Claude's Discretion
- Virtual scrolling library choice (@tanstack/virtual vs react-virtuoso vs react-window)
- Exact fixed card height values per breakpoint
- "Already animated" tracking mechanism (Set in store vs data attribute vs ref)
- Back-to-top button animation/transition style
- Whether to add `React.memo()` to ScreenplayCard
- Filter memoization optimization details (PERF-02 — already partially done)

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

### Phase 3 dependency
- `.planning/phases/03-selection-mode-foundation/03-CONTEXT.md` — Phase 3 adds checkboxes to cards and a bulk action bar. Virtual scrolling must support checkbox overlays on virtualized cards. The selection store (Phase 3) will read from the same filtered screenplay list.

</canonical_refs>

<specifics>
## Specific Ideas

- The current premium visual design (gold/black theme with glassmorphism) must be preserved — virtual scrolling should be invisible to the user except that scrolling is now smooth at 500+ cards
- The staggered reveal on first load is part of the "premium feel" the producer likes — keep it for the initial viewport batch
- Row-based virtualization must match the existing responsive column counts: 1 col (mobile), 2 col (sm/lg), 3 col (xl), 4 col (2xl)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/hooks/useFilteredScreenplays.ts` — Already memoized with `useMemo`. Dependency array: `[screenplays, filters, sortConfigs, prioritizeFilmNow, pdfStatuses, hasPdfScanResult]`. May need `useCallback` extraction for the filter/sort functions
- `src/components/screenplay/ScreenplayGrid.tsx` — Current grid container (223 LOC). Keyboard navigation via `data-card` attributes needs rework for virtual rows
- `src/components/screenplay/ScreenplayCard.tsx` — 314 LOC card component. Candidates for `React.memo()` wrapping. Contains IntersectionObserver logic to remove
- `src/components/ui/ScoreBar.tsx` — Uses `useCountUp` hook for animation. Needs "fire once" gate added

### Established Patterns
- Zustand stores per domain (filter, sort, comparison, favorites) — no new store needed for scroll state (local component state)
- Tailwind-only styling — virtual list container and row wrappers use Tailwind classes
- ErrorBoundary wraps each card — must be preserved inside virtual rows

### Integration Points
- `ScreenplayGrid` receives `screenplays` array from `useFilteredScreenplays` — virtual list wraps this same array
- Keyboard navigation (`data-card` attributes, arrow key handlers) — needs rework for virtual DOM
- Scroll reveal hook (`useScrollReveal`) — replaced by virtual list's own visibility tracking
- Phase 3 will add `onSelect` prop and checkbox to `ScreenplayCard` — virtual rows must pass through selection callbacks

</code_context>

<deferred>
## Deferred Ideas

- Keyboard shortcuts for grid navigation (Page Up/Down, Home/End) — polish pass after virtual scrolling works
- Infinite scroll pagination from server (currently all data loads at once) — not needed while data fits in localStorage
- Search-as-you-type debouncing optimization — current instant filter is fine at 500 items

</deferred>

---

*Phase: 02-performance-at-scale*
*Context gathered: 2026-03-23*
