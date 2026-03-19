# Phase 10: Virtual Scrolling + Performance - Research

**Researched:** 2026-03-19
**Domain:** React virtualization (@tanstack/react-virtual), Zustand selector memoization, ResizeObserver column detection
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Replace `useScrollReveal` with a simple **100ms opacity fade** on card mount — no stagger delay
- `useScrollReveal` hook and all `data-reveal` attributes removed (check for other consumers first)
- Overscan buffer: render **3–4 extra rows** above and below the viewport
- Empty rows outside the overscan buffer: empty space is acceptable — no skeleton cards needed
- **Fixed row height: ~340px** — standard, matches current average card height
- Long loglines already truncated — preserve truncation
- Scroll container height: accurate pre-calculated from total count — scrollbar thumb is correct
- No dynamic measurement, no estimated-then-correct approach
- Arrow keys navigate within currently rendered cards only — no scroll-to-focus for off-screen cards
- Arrow key behavior at edge of visible cards: does nothing
- **Enter key on focused card: preserved** — opens detail modal
- **ARIA roles removed** — `role="list"` and `role="listitem"` can be dropped
- **Tab behavior: unchanged** — Tab cycles through rendered focusable cards normally
- `tabIndex={0}` on card wrappers: preserved

### Claude's Discretion
- Column count detection approach (ResizeObserver + breakpoint math vs CSS grid measurement)
- Exact `estimateSize` value (start from 340px, adjust if measure shows clipping)
- Memoization strategy for `passesFilters` / `sortScreenplays` (useMemo dependency arrays, selector granularity)
- Whether to wrap virtualized rows in `ErrorBoundary` (maintain existing pattern if feasible)
- Overscan count: target 3–4 rows, exact value to Claude

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERF-01 | Screenplay grid renders correctly without noticeable jank with 500–1000+ items; only visible viewport rows are in the DOM at any time | `@tanstack/react-virtual` useVirtualizer with row-of-N-cards approach; confirmed DOM element count target of ~50–80 with overscan 3–4 rows at 4 columns |
| PERF-02 | Filter and sort operations on 1000 screenplays complete within a single animation frame; memoization ensures pipeline does not re-run on unrelated state changes | Fine-grained Zustand selectors replacing whole-store subscription in `useFilteredScreenplays`; split `filters` subscription into individual primitive selectors |
</phase_requirements>

---

## Summary

Phase 10 replaces the `screenplays.map()` loop in `ScreenplayGrid.tsx` with row-based virtualization using `@tanstack/react-virtual` v3 (`useVirtualizer`). The critical architectural choice is **not** using CSS grid layout for the virtualized rows — the virtualizer requires absolute positioning inside a relative container of fixed total height. Column count is derived at runtime via `ResizeObserver` measuring the container's `clientWidth` against the same Tailwind breakpoint thresholds already in use (`sm:640px`, `lg:1024px`, `xl:1280px`, `2xl:1536px`), yielding 1/2/2/3/4 columns. Items are grouped into virtual rows of N cards each, and the virtualizer renders row-shaped divs absolutely positioned using `transform: translateY(rowItem.start)`.

For PERF-02, the core problem is that `useFilteredScreenplays.ts` currently calls `useFilterStore()` with no selector, subscribing to the **entire** filter store object. Any filter field change creates a new object reference and re-runs the entire `useMemo`. The fix is to split the subscription into individual fine-grained selectors for each filter field — Zustand performs equality checks on the returned primitive/array value, so only actual filter changes trigger recomputation. The `pdfStatuses` subscription is already correctly granular.

**Primary recommendation:** Install `@tanstack/react-virtual@^3.13`, implement row-of-N-cards virtualization with ResizeObserver column detection, replace the full-store Zustand subscription with individual field selectors.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-virtual | ^3.13.23 (latest v3) | Row virtualization — only visible rows rendered in DOM | Official TanStack family (already uses @tanstack/react-query); zero-dependency headless API; supports fixed + variable sizes; active maintenance (published 2 days before research date) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ResizeObserver (browser native) | Web API | Detect container width changes for column count re-calculation | Already available in all modern browsers; no polyfill needed |
| useShallow (zustand/shallow) | bundled with zustand 5 | Shallow-equality comparison for selector arrays (e.g., `recommendationTiers`) | Use when selector returns a new array reference but values haven't changed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @tanstack/react-virtual | react-window | react-window has lower maintenance activity; narrower API; no lanes support; less active in 2025 |
| @tanstack/react-virtual | react-virtuoso | react-virtuoso is heavier; more opinionated markup; doesn't fit headless pattern |
| ResizeObserver | window.addEventListener('resize') | window resize fires on any viewport change; ResizeObserver fires only on the actual container element — more precise |
| ResizeObserver | CSS grid column measurement (getComputedStyle) | CSS approach works but requires a DOM read in the render path; ResizeObserver with breakpoint math is pure state, more predictable |

**Installation:**
```bash
npm install @tanstack/react-virtual
```

---

## Architecture Patterns

### Recommended Project Structure

No new directories needed. Changes are within existing files:

```
src/
├── hooks/
│   ├── useFilteredScreenplays.ts   # MODIFY: split Zustand subscription to fine-grained selectors
│   └── useScrollReveal.ts          # DELETE: if no other consumers (check index.ts + grep)
├── components/screenplay/
│   └── ScreenplayGrid.tsx          # REWRITE: replace .map() with useVirtualizer row-of-N approach
│   └── ScreenplayGrid.test.tsx     # UPDATE: fix/remove tests that rely on role="list", role="listitem", aria-label structure
```

### Pattern 1: Row-of-N Virtualization (Fixed Height)

**What:** Group the flat `screenplays[]` array into rows of `columns` items each. Feed the row count to `useVirtualizer`. Render each virtual row as an absolutely positioned div containing `columns` cards in a flex row.

**When to use:** When items have uniform fixed height and the grid uses a fixed column count derived from breakpoints. Simpler than the dual-virtualizer (separate row + column virtualizers) and avoids the lanes API's edge-case behavior on resize.

**The DOM structure:**
```
<div ref={containerRef} style={{ overflow: 'auto', height: '100%' }}>       ← scroll container
  <div style={{ position: 'relative', height: `${virtualizer.getTotalSize()}px` }}>  ← total height sentinel
    {rowVirtualizer.getVirtualItems().map(virtualRow => (
      <div
        key={virtualRow.key}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: `${virtualRow.size}px`,
          transform: `translateY(${virtualRow.start}px)`,
        }}
      >
        {/* render cards for this row */}
        {screenplays.slice(virtualRow.index * columns, (virtualRow.index + 1) * columns).map(...)}
      </div>
    ))}
  </div>
</div>
```

**Key insight:** The outer scroll container must have a defined height (not `auto` or `100%` of a zero-height parent). The parent page layout must grant it a bounded height — either a fixed px value or `height: calc(100vh - Npx)`. Verify the current page layout provides this.

```typescript
// Source: verified via WebSearch + official docs (tanstack.com/virtual/latest)
const rowVirtualizer = useVirtualizer({
  count: Math.ceil(screenplays.length / columns),   // row count
  getScrollElement: () => containerRef.current,
  estimateSize: () => ROW_HEIGHT,                   // 340 + gap
  overscan: 3,                                      // 3–4 rows per decisions
});
```

**ROW_HEIGHT calculation:** The card itself is 340px. The grid uses `gap-4 md:gap-6` (16px/24px). The virtualizer `estimateSize` should include the gap: `340 + 24 = 364px`. Use 364 as the starting value, verify visually.

### Pattern 2: ResizeObserver Column Count Detection

**What:** Observe the scroll container with `ResizeObserver`. When `contentRect.width` crosses a Tailwind breakpoint, update `columns` state. The virtualizer re-renders with the new column count.

**When to use:** Any time responsive grid column count must be known as a JavaScript value (not just CSS).

```typescript
// Source: pattern verified across multiple community sources, matches Tailwind breakpoints in CONTEXT.md
function getColumnCount(width: number): number {
  if (width >= 1536) return 4;  // 2xl:grid-cols-4
  if (width >= 1280) return 3;  // xl:grid-cols-3
  if (width >= 640)  return 2;  // sm:grid-cols-2 (lg and xl both use 2 until xl)
  return 1;                      // grid-cols-1
}

// In component:
const [columns, setColumns] = useState(1);
const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  const ro = new ResizeObserver(([entry]) => {
    setColumns(getColumnCount(entry.contentRect.width));
  });
  ro.observe(el);
  return () => ro.disconnect();
}, []);
```

**NOTE on Tailwind breakpoints in CONTEXT.md:** Current grid class is `grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`. The `lg` breakpoint (1024px) is also 2 columns — same as `sm`. So the breakpoints that matter for column-count transitions are: `<640` = 1 col, `640–1279` = 2 cols, `1280–1535` = 3 cols, `>=1536` = 4 cols. The `lg` breakpoint does not change column count.

### Pattern 3: Fine-Grained Zustand Selectors for Filter Memoization

**What:** Replace `useFilterStore()` (whole-store subscription) with individual field selectors. Each selector returns a primitive or shallow-comparable value, preventing spurious `useMemo` invalidations.

**When to use:** When `useMemo` depends on a Zustand store that has many fields but most re-renders are caused by fields unrelated to the memo's computation.

```typescript
// BEFORE (re-runs memo on ANY filter store change — even unrelated fields):
const filters = useFilterStore();

// AFTER (re-runs memo only when a field that passesFilters actually uses changes):
const searchQuery = useFilterStore(s => s.searchQuery);
const recommendationTiers = useFilterStore(useShallow(s => s.recommendationTiers));
const budgetCategories = useFilterStore(useShallow(s => s.budgetCategories));
const collections = useFilterStore(useShallow(s => s.collections));
const categories = useFilterStore(useShallow(s => s.categories));
const genres = useFilterStore(useShallow(s => s.genres));
const themes = useFilterStore(useShallow(s => s.themes));
const weightedScoreRange = useFilterStore(useShallow(s => s.weightedScoreRange));
// ... (all range filters and boolean flags)
```

**Dependency array:** The `useMemo` dependency array becomes the full list of individual selector values instead of `filters`. This is more verbose but provides surgical precision.

**Alternative — keep the `filters` object, add `useShallow`:**

```typescript
// Acceptable middle ground if the individual-selector approach is too verbose:
import { useShallow } from 'zustand/shallow';
const filters = useFilterStore(useShallow(s => s));
// useShallow does a shallow-object comparison — if none of the top-level keys changed, no re-render
```

Recommendation: Use `useShallow` on the whole store first (less churn). If profiling shows specific non-filter fields still causing re-renders (e.g., if the store grows), split to individual selectors then.

### Anti-Patterns to Avoid

- **Absolute positioning without a bounded parent height:** If the scroll container has no fixed or calc height, the total-height sentinel div expands the page infinitely. The virtualizer never gets meaningful scroll events.
- **Using CSS `display: grid` inside the virtualizer's inner container:** Virtual rows are absolutely positioned; CSS grid on the inner container does nothing for layout. Use the outer container only for breakpoint context.
- **Calling `getTotalSize()` outside render:** Call it during render to set the inner sentinel height. Storing it in a ref causes stale values.
- **Passing `filters` object (not individual fields) to `passesFilters` while using fine-grained selectors:** `passesFilters` already takes the `FilterState` object. Reconstruct it from individual selectors in the hook: `const filterState: FilterState = useMemo(() => ({ searchQuery, recommendationTiers, ... }), [...])` — or pass each selector value individually.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll virtualization | Custom IntersectionObserver-based render-toggling | @tanstack/react-virtual useVirtualizer | DOM count accuracy, overscan management, scroll position tracking, scrollToIndex, resize recalculation — each is non-trivial to get right |
| Total scroll height calculation | Manual `count * rowHeight` arithmetic in render | virtualizer.getTotalSize() | Accounts for overscan, padding, variable sizes in future |
| Item position calculation | `index * rowHeight` | virtualItem.start | Accounts for gaps, padding, dynamic sizes |

**Key insight:** The "simple math" approach (`top = index * height`) breaks as soon as `gap`, `paddingStart`, or variable item sizes are involved. `getTotalSize()` and `virtualItem.start` handle all these cases.

---

## Common Pitfalls

### Pitfall 1: Scroll Container Has No Bounded Height

**What goes wrong:** The grid renders all items outside the viewport immediately because the scroll container grows to fit all content. The virtualizer reports 0 visible rows.

**Why it happens:** `useVirtualizer` requires `getScrollElement()` to return a container with `overflow: auto/scroll` AND a fixed height. If the container height is `auto`, no scroll event is generated.

**How to avoid:** Check the parent layout before implementation. The current `ScreenplayGrid` is likely rendered inside a page with padding/margins. Determine whether the grid container needs `height: calc(100vh - Npx)` or if the parent already provides a bounded scroll area. If the current app uses window scroll (no bounded container), use `useWindowVirtualizer` instead of `useVirtualizer`.

**Warning signs:** All `screenplays.length / columns` rows appear in DOM simultaneously on first render.

### Pitfall 2: Column Count State Stale on Initial Render

**What goes wrong:** `columns` starts as 1 before `ResizeObserver` fires, causing incorrect row grouping on the first render frame.

**Why it happens:** `useState(1)` initializes synchronously; `ResizeObserver` fires asynchronously after the element is measured.

**How to avoid:** Initialize `columns` with a synchronous width check using `containerRef.current?.clientWidth` inside a `useState` initializer or `useLayoutEffect` before the first paint.

```typescript
const [columns, setColumns] = useState(() =>
  typeof window !== 'undefined' ? getColumnCount(window.innerWidth) : 1
);
```

This gives a reasonable starting value (window width approximates container width for full-width grids).

### Pitfall 3: Existing Tests Break on Structural Changes

**What goes wrong:** `ScreenplayGrid.test.tsx` has 4 tests that will fail after virtualization:

1. `'has proper list role and aria-label'` — uses `screen.getByRole('list')`. CONTEXT.md removes `role="list"`.
2. `'renders each card as a listitem'` — uses `screen.getAllByRole('listitem')`. CONTEXT.md removes `role="listitem"`.
3. `'has proper aria-label for each card'` — checks `aria-label` on listitem. Removed per decisions.
4. `'cards are focusable with tabIndex'` — checks `tabindex="0"` on listitem. Wrapper structure changes.

**Why it happens:** Virtualization changes DOM structure from a flat grid to absolutely positioned rows wrapping cards.

**How to avoid:** Plan test updates as part of the implementation wave. Replace role-based queries with `data-testid` or `data-card` attribute queries. The `data-card` attribute is already used by keyboard navigation.

### Pitfall 4: useScrollReveal Has Other Consumers

**What goes wrong:** Deleting `useScrollReveal.ts` causes TypeScript build errors if other components import it.

**Why it happens:** CONTEXT.md says to check before removing.

**How to avoid:** Run `grep -r "useScrollReveal" src/` before deletion. Current knowledge: it is imported in `ScreenplayGrid.tsx` and `index.ts` in hooks. Verify the barrel export does not re-export it to other consumers.

**Known consumers from source read:** Only `ScreenplayGrid.tsx` imports it directly. The hooks `index.ts` may barrel-export it. Remove from both.

### Pitfall 5: Gap Not Included in estimateSize

**What goes wrong:** Cards clip into each other vertically — the bottom of one row overlaps the top of the next.

**Why it happens:** `estimateSize` only accounts for card height (340px) without the `gap-4 md:gap-6` (16px/24px) inter-row gap.

**How to avoid:** Set `estimateSize: () => 340 + 24` (= 364) as a starting value. The gap between the last card of one row and the first of the next must be included. Alternatively, set `gap: 24` in the virtualizer options (v3 supports a `gap` option) and keep `estimateSize: () => 340`.

---

## Code Examples

### Verified Basic useVirtualizer Structure

```typescript
// Source: official TanStack Virtual docs + community verification (tanstack.com/virtual/latest)
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: rowCount,                          // Math.ceil(screenplays.length / columns)
  getScrollElement: () => parentRef.current,
  estimateSize: () => ROW_HEIGHT,           // 340 + gap (364)
  overscan: 3,
});

// DOM structure:
// <div ref={parentRef} style={{ overflow: 'auto', height: '...' }}>
//   <div style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
//     {virtualizer.getVirtualItems().map(row => (
//       <div key={row.key} style={{ position: 'absolute', top: 0, left: 0,
//                                   width: '100%', height: row.size,
//                                   transform: `translateY(${row.start}px)` }}>
//         {/* row.index * columns ... (row.index+1) * columns */}
//       </div>
//     ))}
//   </div>
// </div>
```

### ResizeObserver Column Count

```typescript
// Source: pattern from adamcollier.co.uk + dev.to verified against Tailwind breakpoints in CONTEXT.md
function getColumnCount(width: number): number {
  if (width >= 1536) return 4;  // 2xl
  if (width >= 1280) return 3;  // xl
  if (width >= 640)  return 2;  // sm, md, lg (all 2 cols per CONTEXT.md grid class)
  return 1;
}
```

### Zustand useShallow for Filter Object

```typescript
// Source: official Zustand docs (github.com/pmndrs/zustand/discussions/2867)
import { useShallow } from 'zustand/shallow';

const filters = useFilterStore(useShallow(s => s));
// OR for individual fields returning arrays:
const recommendationTiers = useFilterStore(useShallow(s => s.recommendationTiers));
```

### Card Fade-In Animation (replacing useScrollReveal)

```typescript
// Simple CSS approach — no IntersectionObserver, no hook
// Add to global styles or component:
// .card-enter { opacity: 0; animation: fadeIn 100ms ease-out forwards; }
// @keyframes fadeIn { to { opacity: 1; } }

// In row render:
<div key={screenplay.id} className="card-enter">
  <ScreenplayCard screenplay={screenplay} />
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-window (FixedSizeList) | @tanstack/react-virtual useVirtualizer | 2021-2023 | react-virtual is headless, allows custom markup, supports lanes/grid |
| IntersectionObserver scroll reveal | Simple CSS opacity transition on mount | This phase | Virtualizer recycles DOM nodes — IO-based reveal fires incorrectly on recycled elements |
| window.addEventListener('resize') | ResizeObserver | 2020+ | Element-scoped, no global listener needed |
| Subscribing to whole Zustand store | Fine-grained selectors | Zustand v4+ | Prevents memo invalidation from unrelated state fields |

**Deprecated/outdated:**
- `useScrollReveal` hook: incompatible with virtualized DOM (recycled elements get stale `data-revealed` attributes); replaced with CSS fade
- `data-reveal` / `data-revealed` attributes: remove from wrapper divs
- `role="list"` / `role="listitem"` on grid container: removed per CONTEXT.md accessibility decision
- `transitionDelay` inline styles on card wrappers: removed with stagger pattern

---

## Open Questions

1. **Does the current page layout provide a bounded scroll container?**
   - What we know: `ScreenplayGrid` renders inside a page component. The virtualizer needs a container with finite height and `overflow: auto`.
   - What's unclear: Whether the parent element already constrains height (e.g., `calc(100vh - headerHeight)`), or whether the page currently uses window-scroll.
   - Recommendation: If the page uses window scroll, use `useWindowVirtualizer` instead of `useVirtualizer` (same API, no `getScrollElement` needed; uses `scrollMargin` for offset from top). Check `App.tsx` and the parent page component during implementation Wave 0.

2. **`lanes` option vs row-grouping — which is correct for this use case?**
   - What we know: `lanes` distributes N items across N columns automatically (masonry-style). Row-grouping manually creates rows of N items and renders them in flex rows.
   - What's unclear: Whether `lanes` produces pixel-accurate grid row alignment with fixed heights, or if it allows columns to have unequal heights (masonry behavior).
   - Recommendation: Use **row-grouping** (not `lanes`). Lanes is designed for masonry/waterfall where items in each lane scroll independently. For a uniform grid where all items in a row have the same height, row-grouping + flex row is simpler and produces predictable layout. The `lanes` API assigns `virtualItem.lane` (column index), requiring manual CSS column positioning — more complex than needed.

3. **Can `ErrorBoundary` wrap the entire virtual row rather than each card?**
   - What we know: Current code wraps each `ScreenplayCard` in `ErrorBoundary`. CONTEXT.md says to preserve if feasible.
   - What's unclear: Whether a single `ErrorBoundary` per virtual row (wrapping all N cards in that row) provides acceptable fallback UX.
   - Recommendation: Wrap each virtual row in one `ErrorBoundary`. If one card in a row throws, the whole row falls back to an error div. This is acceptable — the user sees an error message for ~4 items max, not the whole grid. Simpler than N boundaries per row.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + @testing-library/react 16.x |
| Config file | `vitest.config.ts` (in project root) |
| Quick run command | `npm run test:run -- --reporter=verbose src/components/screenplay/ScreenplayGrid.test.tsx` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | Grid with 1000 items renders ≤80 card DOM elements at any time | unit | `npm run test:run -- src/components/screenplay/ScreenplayGrid.test.tsx` | ✅ (needs updates) |
| PERF-01 | Scroll container has `overflow: auto` and bounded height | unit | same | ✅ (needs new test) |
| PERF-01 | Virtualized rows use absolute positioning + translateY | unit | same | ✅ (needs new test) |
| PERF-02 | `useFilteredScreenplays` does not re-run memo on unrelated store change | unit | `npm run test:run -- src/hooks/useFilteredScreenplays.test.ts` | ✅ (needs new test) |
| PERF-02 | Filter toggle with 1000 items completes synchronously | unit (perf assertion) | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:run -- src/components/screenplay/ScreenplayGrid.test.tsx src/hooks/useFilteredScreenplays.test.ts`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/hooks/useFilteredScreenplays.test.ts` — add test: "does not re-run sorted result when unrelated filter store field changes"
- [ ] `src/components/screenplay/ScreenplayGrid.test.tsx` — update 4 existing tests that rely on `role="list"`, `role="listitem"`, and `aria-label` structure (these will break after virtualization and ARIA removal)
- [ ] `src/components/screenplay/ScreenplayGrid.test.tsx` — add test: "renders ≤80 DOM elements with 100 screenplay items" (proxy for PERF-01 in unit test environment)
- [ ] Framework install: `npm install @tanstack/react-virtual` — not yet in `package.json`

---

## Sources

### Primary (HIGH confidence)
- `https://tanstack.com/virtual/latest/docs/api/virtualizer` — virtualizer options, VirtualItem properties, getTotalSize, getVirtualItems
- `https://tanstack.com/virtual/latest/docs/framework/react/react-virtual` — React-specific exports (useVirtualizer, useWindowVirtualizer)
- `https://www.npmjs.com/package/@tanstack/react-virtual` — version 3.13.23 confirmed (latest as of research date)
- `https://github.com/pmndrs/zustand/discussions/2867` — Zustand v5 selector best practices, useShallow usage

### Secondary (MEDIUM confidence)
- `https://dev.to/dango0812/building-a-responsive-virtualized-grid-with-tanstack-virtual-37nn` — breakpoint column count pattern, ResizeObserver + row grouping approach (community, verified against docs)
- `https://adamcollier.co.uk/posts/using-tanstack-virtual-and-window-virtualisation-for-a-grid-of-items` — window virtualizer approach, scrollMargin for page-offset containers (community)
- `https://github.com/TanStack/virtual/discussions/732` — lanes vs row-grouping tradeoffs for uniform grid items (community discussion, TanStack maintainers)

### Tertiary (LOW confidence)
- WebSearch aggregated results for `useVirtualizer lanes masonry` — suggests `lanes` is masonry-oriented; row-grouping confirmed as simpler for uniform grid

---

## Metadata

**Confidence breakdown:**
- Standard stack (@tanstack/react-virtual v3): HIGH — version confirmed via npm, API verified via docs
- Architecture (row-of-N + ResizeObserver): HIGH — multiple consistent community sources, matches documented API
- Zustand memoization fix: HIGH — official Zustand docs + discussion
- Pitfalls: HIGH for DOM structure pitfalls (docs-backed); MEDIUM for test breakage (derived from source read)
- Lanes vs row-grouping decision: MEDIUM — confirmed by discussion but not a single authoritative source

**Research date:** 2026-03-19
**Valid until:** 2026-04-18 (30 days — TanStack Virtual v3 is stable; Zustand v5 is stable)
