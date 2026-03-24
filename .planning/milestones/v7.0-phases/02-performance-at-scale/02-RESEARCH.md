# Phase 2: Performance at Scale - Research

**Researched:** 2026-03-23
**Domain:** React virtual scrolling, memoized filtering, large-list performance
**Confidence:** HIGH

## Summary

Phase 2 transforms the ScreenplayGrid from a naive `.map()` rendering of all cards to a virtualized row-based layout using @tanstack/react-virtual. The current grid renders every card to the DOM, which will not scale to 500-1000+ screenplays. Virtual scrolling renders only the visible rows (plus a configurable overscan buffer), keeping DOM node count constant regardless of dataset size.

The existing filter/sort pipeline in `useFilteredScreenplays` is already memoized with `useMemo` but subscribes to the entire filter store object, causing unnecessary recomputation. The filter and sort functions are pure (exported, tested) and need no structural change -- the optimization is in how store subscriptions are structured and whether `ScreenplayCard` is wrapped in `React.memo()`.

**Primary recommendation:** Use `@tanstack/react-virtual` v3.13.x with a single row virtualizer (not dual row+column virtualizers). Virtualize rows where each row is a flex container holding N cards (N = responsive column count). This is simpler than grid virtualization, matches the existing layout semantics, and trivially supports the fixed-height-per-breakpoint constraint from D-07/D-08.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** ScoreBar count-up animations fire once per card ID -- track "already animated" state so scrolling back to a card shows final values instantly, not re-animating
- **D-02:** Staggered scroll-reveal (fade-in cascade) fires on initial page load only -- first viewport batch animates in, everything after appears instantly
- **D-03:** Per-card IntersectionObserver for reveal animation is stripped entirely -- the virtual list already knows what's visible, observers become redundant overhead
- **D-04:** Hover-peek (top 3 dimensions on 500ms hover) kept as-is -- local to individual card, unaffected by virtualization
- **D-05:** All grid changes (filter, sort, clear) jump to top -- consistent behavior, no scroll position restoration attempts
- **D-06:** Floating "back to top" button appears after scrolling past ~2 screens of cards (~20+ cards) -- subtle pill in bottom-right corner, scrolls to top on click
- **D-07:** Fixed card height -- all cards are the same height within a given viewport. Loglines clamped to 2 lines for all tiers including FILM NOW
- **D-08:** Height varies by responsive breakpoint -- mobile (1-col) cards can be taller, desktop (3-4 col) cards more compact. Virtual list just needs consistent height per row within a viewport
- **D-09:** FILM NOW expanded logline removed -- standardized to match all other cards. FILM NOW already stands out via badge and priority sort position. Expanded logline moves to detail modal
- **D-10:** Grid switches from CSS Grid auto-placement to row-based layout -- virtual list renders row containers, each containing N cards (N = current column count from responsive breakpoint). Inner cards use flexbox for equal spacing

### Claude's Discretion
- Virtual scrolling library choice (@tanstack/virtual vs react-virtuoso vs react-window)
- Exact fixed card height values per breakpoint
- "Already animated" tracking mechanism (Set in store vs data attribute vs ref)
- Back-to-top button animation/transition style
- Whether to add `React.memo()` to ScreenplayCard
- Filter memoization optimization details (PERF-02 -- already partially done)

### Deferred Ideas (OUT OF SCOPE)
- Keyboard shortcuts for grid navigation (Page Up/Down, Home/End) -- polish pass after virtual scrolling works
- Infinite scroll pagination from server (currently all data loads at once) -- not needed while data fits in localStorage
- Search-as-you-type debouncing optimization -- current instant filter is fine at 500 items

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | Screenplay grid uses virtual scrolling to handle 500-1000+ screenplays without UI lag | @tanstack/react-virtual v3.13.x row virtualization with fixed row heights, overscan buffer, and responsive column count |
| PERF-02 | Filtering pipeline is memoized so filter/sort changes don't trigger unnecessary re-renders at scale | React.memo on ScreenplayCard, useCallback extraction for stable references, selective Zustand subscriptions |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-virtual | 3.13.23 | Virtual scrolling (row virtualization) | Most popular React virtualizer (9.4M weekly npm downloads), headless/unstyled, explicit React 19 peer dep support, same TanStack ecosystem as React Query already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React.memo | (built-in React 19) | Prevent card re-renders when props unchanged | Wrap ScreenplayCard -- each card receives a stable `screenplay` object reference from the filtered array |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @tanstack/react-virtual | react-virtuoso v4.18 | More "batteries included" (auto-height, grouping, built-in scroll-to-top), but heavier (47KB vs 10KB), opinionated styling conflicts with Tailwind-only convention, less control over row-based grid layout |
| @tanstack/react-virtual | react-window v2.2 | Mature and stable, but last significant update was 2021, no React 19 in peer deps, FixedSizeGrid forces item-level virtualization rather than row-level, poor TypeScript experience |
| Row-based single virtualizer | Dual row+column virtualizers | Dual virtualizers add complexity with no benefit when column count is small (1-4) and cards are equal width within a row |

**Installation:**
```bash
npm install @tanstack/react-virtual
```

**Version verification:**
- @tanstack/react-virtual: 3.13.23 (published 2026-03-16, 7 days old)
- Peer dependencies: `react: ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0` -- React 19 explicitly supported
- Project React version: ^19.2.0 -- compatible

## Architecture Patterns

### Current Structure (to be modified)
```
src/components/screenplay/
  ScreenplayGrid.tsx        # 253 LOC -- major rewrite (virtualization)
  ScreenplayCard.tsx        # 314 LOC -- moderate changes (remove IO, add memo, standardize height)
src/hooks/
  useScrollReveal.ts        # 82 LOC -- will be DELETED (replaced by virtual list visibility)
  useCountUp.ts             # 51 LOC -- minor change (fire-once gate already has hasAnimated ref)
  useFilteredScreenplays.ts # 352 LOC -- minor optimization (selective store subscriptions)
src/styles/
  animations.css            # [data-reveal] CSS rules -- remove reveal rules, keep other animations
```

### New/Modified Files
```
src/components/screenplay/
  ScreenplayGrid.tsx        # Rewritten: useVirtualizer + row containers
  ScreenplayCard.tsx        # Wrapped in React.memo, IO removed, logline standardized
  VirtualRow.tsx            # NEW: row container (flex, N cards)
  BackToTopButton.tsx       # NEW: floating back-to-top pill
src/hooks/
  useColumnCount.ts         # NEW: responsive breakpoint -> column count
  useScrollReveal.ts        # DELETED
```

### Pattern 1: Row-Based Virtual Grid
**What:** Single `useVirtualizer` virtualizing rows, where each row is a flex container holding N cards.
**When to use:** Grid of uniform-height items with responsive column counts.
**Why not item-level virtualization:** With 1-4 columns, item-level adds complexity (dual virtualizers, absolute positioning per item) for no performance gain. Row-level is simpler and matches how the visual layout already works.

**Example:**
```typescript
// Source: TanStack Virtual docs + community patterns
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualScreenplayGrid({ screenplays }: { screenplays: Screenplay[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount(); // 1 | 2 | 3 | 4 based on viewport

  const rowCount = Math.ceil(screenplays.length / columnCount);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT, // fixed per breakpoint
    overscan: 3,
    gap: 24, // matches gap-6 (1.5rem = 24px)
  });

  return (
    <div ref={parentRef} className="h-[calc(100vh-200px)] overflow-auto">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const rowItems = screenplays.slice(startIndex, startIndex + columnCount);

          return (
            <div
              key={virtualRow.key}
              className="absolute top-0 left-0 w-full flex gap-6"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              {rowItems.map((sp) => (
                <div key={sp.id} className="flex-1 min-w-0">
                  <ScreenplayCard screenplay={sp} />
                </div>
              ))}
              {/* Fill empty slots in last row for even spacing */}
              {Array.from({ length: columnCount - rowItems.length }).map((_, i) => (
                <div key={`empty-${i}`} className="flex-1 min-w-0" />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Pattern 2: Responsive Column Count Hook
**What:** A hook that returns the current column count based on viewport width, mirroring Tailwind breakpoints.
**When to use:** Any time the virtual grid needs to know how many columns to render per row.

**Example:**
```typescript
// Source: Community pattern, adapted for this project's Tailwind breakpoints
function useColumnCount(): number {
  const [columns, setColumns] = useState(() => getColumns());

  useEffect(() => {
    const update = () => setColumns(getColumns());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return columns;
}

function getColumns(): number {
  const w = window.innerWidth;
  if (w >= 1536) return 4; // 2xl
  if (w >= 1280) return 3; // xl
  if (w >= 640) return 2;  // sm, lg (both 2 columns per existing grid)
  return 1;                 // mobile
}
```

**Note:** The existing grid uses `sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`. Both sm (640px) and lg (1024px) are 2 columns, so the hook can collapse them.

### Pattern 3: Jump-to-Top on Filter/Sort Change
**What:** When the filtered screenplay list changes (filter applied, sort changed, filter cleared), instantly scroll to top.
**When to use:** Per D-05, all grid changes jump to top.

**Example:**
```typescript
// Source: TanStack Virtual API docs
const virtualizer = useVirtualizer({ /* ... */ });

// Jump to top whenever the screenplay list changes
useEffect(() => {
  virtualizer.scrollToOffset(0);
}, [screenplays, virtualizer]);
```

### Pattern 4: Fire-Once ScoreBar Animation Tracking
**What:** Track which card IDs have already animated their ScoreBar count-up, so re-virtualization (scrolling back) shows final values instantly.
**When to use:** Per D-01, count-up fires once per card ID across the lifetime of the page.

**Recommendation:** Use a module-level `Set<string>` (not a Zustand store, not a ref). Rationale:
- A Set is the simplest data structure for membership checks
- Module-level means it persists across re-renders without triggering them
- No store overhead, no prop drilling needed
- Cleared on page reload (which is the desired behavior -- "per session")

**Example:**
```typescript
// In ScoreBar.tsx or a shared module
const animatedCardIds = new Set<string>();

export function markAnimated(cardId: string) {
  animatedCardIds.add(cardId);
}

export function hasAnimated(cardId: string): boolean {
  return animatedCardIds.has(cardId);
}
```

The `useCountUp` hook already has a `hasAnimated` ref internally, but that ref is per-component-instance. With virtualization, the component instance is destroyed and recreated as cards scroll in/out. The module-level Set bridges this gap.

### Pattern 5: Initial Load Stagger Animation
**What:** Per D-02, the first batch of cards (first viewport) animates in with a staggered cascade. All subsequent cards appear instantly.
**When to use:** Only on initial page load, not on filter/sort changes.

**Recommendation:** Use a module-level boolean flag `hasCompletedInitialReveal`. On first render, the first N virtual rows get stagger delays (via inline `transitionDelay` like the current implementation). After the initial viewport renders, set the flag to true. All subsequent card renders skip animation entirely.

**Example:**
```typescript
let hasCompletedInitialReveal = false;

function VirtualRow({ virtualRow, isInitialRender, ... }) {
  const shouldAnimate = isInitialRender && !hasCompletedInitialReveal;
  const delay = shouldAnimate ? `${virtualRow.index * 80}ms` : '0ms';

  // After animation completes for the last visible row:
  if (shouldAnimate && virtualRow.index === lastVisibleIndex) {
    setTimeout(() => { hasCompletedInitialReveal = true; }, 500);
  }

  return (
    <div style={{ transitionDelay: delay }} data-reveal data-revealed={shouldAnimate ? undefined : 'true'}>
      {/* cards */}
    </div>
  );
}
```

### Pattern 6: Back-to-Top Button with Virtual Scroll Position
**What:** Per D-06, a floating pill appears after scrolling past ~20 cards (~2 screens).
**When to use:** When virtual scroll offset exceeds a threshold.

**Example:**
```typescript
// Track scroll offset via virtualizer's onChange
const [showBackToTop, setShowBackToTop] = useState(false);

const virtualizer = useVirtualizer({
  // ...
  onChange: (instance) => {
    setShowBackToTop(instance.scrollOffset > ROW_HEIGHT * 5); // ~5 rows = ~20 cards at 4-col
  },
});

const scrollToTop = () => virtualizer.scrollToOffset(0, { behavior: 'smooth' });
```

### Anti-Patterns to Avoid
- **Dual row+column virtualizers for small column counts:** Adds complexity (absolute positioning per item, coordinating two virtualizers) when a single row virtualizer with flex children is simpler and sufficient for 1-4 columns.
- **Dynamic card heights with virtual scrolling:** The current FILM NOW expanded logline creates variable heights. D-07/D-09 explicitly standardize to fixed height. Do NOT try to measure card heights dynamically -- it defeats the performance benefit.
- **Re-creating the scroll container on filter change:** The scroll container (`parentRef`) must persist. Only the data feeding the virtualizer changes. If the container remounts, the virtualizer loses its scroll measurement state.
- **Using Zustand store for animation tracking:** Animation state (which cards have animated) is ephemeral per-session, not user state. A module-level Set is cheaper and doesn't trigger re-renders.
- **Keeping IntersectionObserver alongside virtualization:** Per D-03, the virtual list already knows which items are visible. IO adds overhead and conflicts with the virtualizer's own visibility tracking.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtual scrolling | Custom scroll position tracking + DOM recycling | @tanstack/react-virtual `useVirtualizer` | Scroll measurement, overscan, resize handling, and DOM recycling are subtle and bug-prone |
| Responsive column count | Manual resize listener with debounce | `useColumnCount` hook (simple, project-specific) with `matchMedia` or `window.innerWidth` | Actually fine to hand-roll -- too simple for a library, but must stay in sync with Tailwind breakpoints |
| Scroll position tracking | Manual `onScroll` handler with throttle | `useVirtualizer`'s `onChange` callback provides `scrollOffset` | The virtualizer already tracks this -- no need to add a separate scroll listener |

**Key insight:** Virtual scrolling is the one problem here that truly requires a library. Everything else (column count detection, animation gating, back-to-top button) is simple enough to hand-roll but must integrate cleanly with the virtualizer's API.

## Common Pitfalls

### Pitfall 1: Scroll Container Must Have Fixed Height
**What goes wrong:** Virtual scrolling renders nothing or renders all items if the scroll container has no explicit height constraint.
**Why it happens:** `useVirtualizer` needs `getScrollElement()` to return an element with a bounded height so it can calculate which rows are visible. If the container grows to fit all content, everything is "visible."
**How to avoid:** The scroll container needs an explicit height. Use `h-[calc(100vh-Xpx)]` or a known fixed height. The current layout has `<main>` as the page container -- the virtualizer's scroll element should be a div wrapping just the grid with overflow-auto.
**Warning signs:** All rows render at once, no virtualization happening, console shows all virtual items equal to total rows.

### Pitfall 2: React 19 + flushSync Warning
**What goes wrong:** Console warnings about flushSync when scrolling.
**Why it happens:** TanStack Virtual v3 internally uses `flushSync` by default for synchronous scroll updates. React 19 added stricter warnings about this.
**How to avoid:** Do NOT set `useFlushSync: false` unless you observe actual visual tearing. The warning is cosmetic. If it becomes problematic, the option exists.
**Warning signs:** Console spam during scroll: "flushSync was called from inside a lifecycle method."

### Pitfall 3: Virtualizer Count Must Update When Data Changes
**What goes wrong:** Stale rows render, or blank space appears at the bottom, after filtering reduces the list.
**Why it happens:** If the `count` passed to `useVirtualizer` doesn't update reactively when `screenplays` changes, the virtualizer renders rows that no longer exist.
**How to avoid:** Derive `count` from `Math.ceil(screenplays.length / columnCount)` directly in the render path. Never cache it separately.
**Warning signs:** Blank rows at the bottom after filtering, or "index out of bounds" errors when accessing `screenplays[index]`.

### Pitfall 4: Column Count Change Without Virtualizer Re-measurement
**What goes wrong:** Rows render with wrong number of cards after viewport resize.
**Why it happens:** When `columnCount` changes (e.g., from 3 to 2 on resize), the `count` (row count) changes but the virtualizer may not recalculate item sizes.
**How to avoid:** Call `virtualizer.measure()` when `columnCount` changes. This forces re-measurement of all row sizes.
**Warning signs:** Cards overlap, rows have wrong height, or gaps appear after resizing the browser.

### Pitfall 5: ErrorBoundary Must Wrap Each Card Inside Virtual Rows
**What goes wrong:** One bad card crashes the entire row (and potentially the grid).
**Why it happens:** Without ErrorBoundary per card, a render error in one card bubbles up and unmounts the whole virtual row.
**How to avoid:** Keep the existing `<ErrorBoundary>` wrapping each `<ScreenplayCard>` inside the virtual row loop. The ErrorBoundary stays in the same position -- it just moves from the grid-level map into the row-level map.
**Warning signs:** Entire row or grid disappears when one card has bad data.

### Pitfall 6: Logline Clamp for FILM NOW Cards (D-09)
**What goes wrong:** FILM NOW cards are taller than other cards, breaking fixed row height.
**Why it happens:** Current code has `screenplay.recommendation === 'film_now' || isPeeking ? '' : 'line-clamp-2'` -- FILM NOW cards show full logline, making them variable height.
**How to avoid:** Per D-09, standardize ALL cards to `line-clamp-2`. FILM NOW gets the same logline treatment. Expanded logline moves to the detail modal.
**Warning signs:** FILM NOW cards push their row taller, causing misalignment with virtual positioning.

## Code Examples

### Complete ScreenplayCard Memo Pattern
```typescript
// Source: React docs + project conventions
import { memo } from 'react';

// Memoize to prevent re-render when parent (virtual row) re-renders
// but this card's screenplay prop hasn't changed
export const ScreenplayCard = memo(function ScreenplayCard({
  screenplay,
  onClick,
}: ScreenplayCardProps) {
  // ... existing card implementation
  // REMOVE: IntersectionObserver useEffect (lines 75-91)
  // REMOVE: isRevealed state (line 56)
  // CHANGE: logline always gets line-clamp-2 (remove film_now exception)
  // CHANGE: ScoreBar animate prop uses module-level hasAnimated check
});
```

### Scroll Container Setup
```typescript
// The scroll container must be the virtualizer's scroll element
// Current layout: <main> wraps everything including header, filters, grid
// New: grid gets its own scrollable container

<div
  ref={parentRef}
  className="flex-1 overflow-y-auto"
  role="list"
  aria-label="Screenplay results"
>
  <div
    className="relative w-full"
    style={{ height: `${virtualizer.getTotalSize()}px` }}
  >
    {virtualizer.getVirtualItems().map((virtualRow) => (
      <VirtualRow
        key={virtualRow.key}
        virtualRow={virtualRow}
        screenplays={screenplays}
        columnCount={columnCount}
        onCardClick={onCardClick}
      />
    ))}
  </div>
</div>
```

### Fixed Card Heights Per Breakpoint
```typescript
// These values need to be measured from the actual card height
// with standardized logline (2-line clamp for all cards)
// They are estimates -- measure during implementation and adjust

const ROW_HEIGHTS: Record<number, number> = {
  1: 420,  // mobile: full width, taller card
  2: 380,  // sm/lg: 2-col
  3: 360,  // xl: 3-col, more compact
  4: 340,  // 2xl: 4-col, most compact
};

function getRowHeight(columnCount: number): number {
  return ROW_HEIGHTS[columnCount] ?? 380;
}
```

**Important:** These height values are ESTIMATES. During implementation, render a single card at each breakpoint, measure its actual height with DevTools, and update these values. The virtualizer uses `estimateSize`, so small inaccuracies are tolerated, but closer is better for scroll position accuracy.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-window / react-virtualized | @tanstack/react-virtual v3 | 2023+ | Headless, framework-agnostic core, better TypeScript, React 19 support |
| IntersectionObserver for visibility | Virtualizer's internal visibility tracking | With virtualization | IO is redundant when the virtualizer already knows what's visible |
| Variable card heights | Fixed heights per breakpoint | This phase (D-07/D-08) | Enables simple `estimateSize` without dynamic measurement |
| CSS Grid auto-placement | Row-based flex layout | This phase (D-10) | Matches virtualizer's row-rendering model |

**Deprecated/outdated:**
- `react-virtualized`: Unmaintained since 2021, replaced by react-window and then @tanstack/react-virtual
- `react-window`: Still works but effectively in maintenance mode, no React 19 in peer deps
- Dual virtualizer pattern for grids with few columns: Unnecessary complexity vs. row-based approach

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + Testing Library (React) 16.3.2 |
| Config file | vitest.config.ts |
| Quick run command | `npm run test:run` |
| Full suite command | `npm run test:run && npm run build` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | Virtual grid renders only visible rows, not all cards | unit | `npx vitest run src/components/screenplay/ScreenplayGrid.test.tsx -x` | Exists but needs rewrite for virtual grid |
| PERF-01 | Column count matches Tailwind breakpoints | unit | `npx vitest run src/hooks/useColumnCount.test.ts -x` | New file needed (Wave 0) |
| PERF-01 | Back-to-top button appears after scroll threshold | unit | `npx vitest run src/components/screenplay/BackToTopButton.test.tsx -x` | New file needed (Wave 0) |
| PERF-01 | Jump-to-top on filter/sort change | unit | `npx vitest run src/components/screenplay/ScreenplayGrid.test.tsx -x` | Needs new test case |
| PERF-02 | ScreenplayCard is memoized (React.memo) | unit | `npx vitest run src/components/screenplay/ScreenplayCard.test.tsx -x` | Exists, needs memo verification test |
| PERF-02 | Filter pipeline does not re-render cards with unchanged props | unit | `npx vitest run src/hooks/useFilteredScreenplays.test.ts -x` | Exists, pure functions already tested |

### Sampling Rate
- **Per task commit:** `npm run test:run`
- **Per wave merge:** `npm run test:run && npm run build`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `src/hooks/useColumnCount.test.ts` -- covers PERF-01 responsive column calculation
- [ ] `src/components/screenplay/BackToTopButton.test.tsx` -- covers PERF-01 back-to-top behavior
- [ ] Update `src/components/screenplay/ScreenplayGrid.test.tsx` -- existing tests reference DOM structure that will change (grid -> virtual rows)
- [ ] Framework install: `npm install @tanstack/react-virtual` -- new dependency

## Open Questions

1. **Exact card heights per breakpoint**
   - What we know: Cards will have fixed height per breakpoint after D-07/D-09 standardization
   - What's unclear: Exact pixel values until a card is rendered with `line-clamp-2` logline at each breakpoint
   - Recommendation: Measure during implementation by rendering a card, reading its `offsetHeight`, and hardcoding the values. The virtualizer's `estimateSize` tolerates small inaccuracies.

2. **Scroll container boundary**
   - What we know: The virtualizer needs a scroll container with bounded height. Current page layout has `<main>` as the full-page container.
   - What's unclear: Whether to make the entire page scroll (window virtualization via `useWindowVirtualizer`) or just the grid area (element virtualization via `useVirtualizer`).
   - Recommendation: Use element-level `useVirtualizer` with a scroll container wrapping just the grid. This keeps the header/filters pinned above. Window-level virtualization would require the header/filters to scroll away, which is not the current behavior.

3. **Delete confirmation dialog position with virtual rows**
   - What we know: Each ScreenplayCard currently renders a `<DeleteConfirmDialog>` as a sibling. With virtualization, the dialog might be destroyed when scrolling away.
   - What's unclear: Whether the dialog needs to be portaled to document.body.
   - Recommendation: The dialog should already be portaled (modals typically are). Verify during implementation. If not portaled, move it to a portal or lift state to the grid level.

## Sources

### Primary (HIGH confidence)
- npm registry: @tanstack/react-virtual v3.13.23 -- version, peer deps, publish date verified via `npm view`
- [TanStack Virtual API docs](https://tanstack.com/virtual/latest/docs/api/virtualizer) -- full virtualizer API reference
- React docs: `React.memo` reference -- memoization semantics
- Project source code: Direct inspection of ScreenplayGrid.tsx (253 LOC), ScreenplayCard.tsx (314 LOC), useFilteredScreenplays.ts (352 LOC), useScrollReveal.ts (82 LOC), useCountUp.ts (51 LOC), animations.css

### Secondary (MEDIUM confidence)
- [Adam Collier: TanStack Virtual grid pattern](https://adamcollier.co.uk/posts/using-tanstack-virtual-and-window-virtualisation-for-a-grid-of-items) -- row-based grid implementation with responsive columns
- [DEV Community: Responsive grid with TanStack Virtual](https://dev.to/dango0812/building-a-responsive-virtualized-grid-with-tanstack-virtual-37nn) -- breakpoint-driven column count, dual virtualizer approach
- [Devas.life: Animate TanStack Virtual with Motion](https://www.devas.life/how-to-animate-a-tanstack-virtual-list-with-motion/) -- individual AnimatePresence wrapping pattern
- [npm trends](https://npmtrends.com/@tanstack/virtual-core-vs-react-virtualized-vs-react-virtuoso-vs-react-window) -- download statistics comparison
- [GitHub Issue #743](https://github.com/TanStack/virtual/issues/743) -- React 19 + useFlushSync compatibility note

### Tertiary (LOW confidence)
- Card height estimates (340-420px per breakpoint) -- based on visual inspection of current cards, needs measurement during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- @tanstack/react-virtual is the clear ecosystem leader, React 19 support confirmed via npm peer deps
- Architecture: HIGH -- row-based virtualization is a well-documented pattern with multiple community examples; matches project's existing responsive grid semantics
- Pitfalls: HIGH -- based on direct source code inspection (IO removal, FILM NOW logline, scroll container requirements) and verified TanStack Virtual API behavior
- Animation gating (D-01, D-02): MEDIUM -- module-level Set pattern is sound but the initial-load stagger timing needs implementation tuning
- Card heights: LOW -- pixel values are estimates until measured during implementation

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable -- @tanstack/react-virtual v3 is mature, no breaking changes expected)
