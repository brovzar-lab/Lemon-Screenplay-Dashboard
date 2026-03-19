# Phase 10: Virtual Scrolling + Performance - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the `screenplays.map()` loop in `ScreenplayGrid.tsx` with `@tanstack/react-virtual` windowed virtualization. Memoize the `passesFilters` / `sortScreenplays` pipeline in `useFilteredScreenplays.ts` so filter/sort operations don't re-run on unrelated state changes. No new UI features, no new data sources — pure performance.

</domain>

<decisions>
## Implementation Decisions

### Scroll reveal animation
- Replace `useScrollReveal` with a simple **100ms opacity fade** on card mount
- **No stagger delay** — all cards in a row fade in together as a unit
- `useScrollReveal` hook and all `data-reveal` attributes should be removed
- Overscan buffer: render **3–4 extra rows** above and below the viewport to reduce blank-row flash during fast scrolling
- Empty rows outside the overscan buffer: **empty space is fine** — no skeleton cards needed for unrendered rows
- Existing `SkeletonCard` component (used during initial data load) is unchanged

### Card height strategy
- **Fixed row height: ~340px** (standard — matches current average card height)
- Long loglines: already truncated in existing card design — acceptable to preserve truncation
- Scroll container height: **accurate pre-calculated** — scrollbar thumb position correctly reflects total screenplay count
- No dynamic measurement, no estimated-then-correct approach

### Keyboard navigation
- **Arrow keys navigate within currently rendered cards only** — no scroll-to-focus for off-screen cards
- Arrow key behavior at the edge of visible cards: does nothing (user scrolls manually to reveal more)
- **Enter key on focused card: preserved** — opens the detail modal as before
- **ARIA roles removed** — `role="list"` and `role="listitem"` can be dropped (internal tool, no a11y requirement)
- **Tab behavior: unchanged** — Tab cycles through rendered focusable cards normally
- `tabIndex={0}` on card wrappers: preserved (Tab still moves through rendered cards)

### Claude's Discretion
- Column count detection approach (ResizeObserver + breakpoint math vs CSS grid measurement)
- Exact `estimateSize` value for `@tanstack/react-virtual` (start from 340px, adjust if measure shows clipping)
- Memoization strategy for `passesFilters` / `sortScreenplays` (useMemo dependency arrays, selector granularity)
- Whether to wrap virtualized rows in `ErrorBoundary` (maintain existing pattern if feasible)
- Overscan count: target 3–4 rows, exact value to Claude

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SkeletonCard` (in `ScreenplayGrid.tsx`): unchanged — still used during initial data load state
- `useFilteredScreenplays.ts` (351 lines): the filter/sort pipeline to memoize; `passesFilters` and `sortScreenplays` functions already extracted and exported
- `ScreenplayCard.tsx`: unchanged — virtualizer renders it the same way, just inside a row wrapper
- `ErrorBoundary`: currently wraps each card in `ScreenplayGrid.tsx`; preserve pattern if row-level wrapping is feasible

### Established Patterns
- Tailwind responsive breakpoints in use: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4` — column count must be derived from these same breakpoints
- `gap-4 md:gap-6` between cards — virtualizer row height must account for vertical gap
- `transitionDelay` is currently applied via inline style on `data-reveal` wrappers — this entire pattern is being replaced with a simple CSS fade class

### Integration Points
- `ScreenplayGrid.tsx` receives `screenplays: Screenplay[]` prop from parent — no prop signature change needed
- `useFilteredScreenplays.ts` is consumed by the parent of `ScreenplayGrid` — memoization is internal to the hook
- `useScrollReveal` hook in `src/hooks/useScrollReveal.ts` — can be deleted if no other consumers (check before removing)

</code_context>

<specifics>
## Specific Ideas

- The roadmap constraint explicitly calls out `@tanstack/react-virtual` as the library — research must confirm this (column-row virtualization approach)
- "Measure container width → derive column count → virtualize rows of N cards" — this is the required architecture per ROADMAP.md
- PERF-01 target: no more than ~50–80 card DOM elements at any time with 1000 screenplays loaded
- PERF-02 target: filter toggle causes no long task >100ms

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-virtual-scrolling-performance*
*Context gathered: 2026-03-19*
