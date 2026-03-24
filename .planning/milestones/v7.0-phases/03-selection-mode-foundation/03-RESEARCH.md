# Phase 3: Selection Mode Foundation - Research

**Researched:** 2026-03-23
**Domain:** React multi-select UI with Zustand state, virtual scrolling integration, and sticky action bar
**Confidence:** HIGH

## Summary

Phase 3 adds always-visible checkboxes to every screenplay card, builds a new `selectionStore` (Zustand), renders a sticky bottom bulk action bar shell with six disabled action buttons, and wires Select All / Deselect All. The primary technical challenges are: (1) threading selection props through the virtualized row architecture without breaking React.memo optimization, (2) coordinating z-index and positioning between the new BulkActionBar, the existing ComparisonBar, and the BackToTopButton, and (3) designing the selection store for O(1) lookups with Set<string> while keeping Zustand selectors efficient.

The codebase already has two selection store patterns (`exportSelectionStore` using `string[]` and `deleteSelectionStore` using `Set<string>`). The new `selectionStore` should follow the `deleteSelectionStore` pattern (Set-based) since it provides O(1) `.has()` lookups critical for the `useIsSelected(id)` derived hook that every rendered card calls. The BulkActionBar should be a sibling of the scroll container inside ScreenplayGrid (not at the App level) to keep selection concerns colocated, and use `fixed bottom-0` positioning matching the ComparisonBar pattern.

**Primary recommendation:** Build `selectionStore` with `Set<string>`, thread `isSelected`/`onToggleSelect` props through VirtualRow to ScreenplayCard, mount BulkActionBar as a fixed-position sibling within ScreenplayGrid's Fragment, and shift BackToTopButton upward when the bar is visible.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-05:** Always-on checkboxes -- every card shows a checkbox in its corner at all times. No mode toggle
- **D-06:** Sticky bottom bar slides up when first card is selected. Keeps filter/sort bar visible above
- **D-07:** Highlight ring on selected cards -- subtle ring/border + count badge. No dimming of unselected cards
- **D-08:** No global selection cap -- select freely. Per-action limits enforced at the button level
- **D-09:** Six actions: Export CSV, Export PDF, Compare (2-5 max), Upload PDFs (>=1 missing PDF), Add to Collection, Add to Favorites
- **D-10:** Visible-but-disabled buttons with tooltip when conditions not met ("Compare -- need 2+"). Never hide actions
- **D-11:** Select All (filtered) + Deselect All buttons. Select All dispatches all currently-filtered screenplay IDs
- **D-12:** Left side: "3 screenplays selected x" (count + clear). Right side: action buttons

### Claude's Discretion
- Checkbox visual style (checkbox icon, position within card corner)
- BulkActionBar slide-up animation timing
- Tooltip implementation (native title vs custom component)
- Whether selectionStore uses persist middleware (probably not -- ephemeral like syncStatusStore)
- How to handle selection state when filter changes remove selected items from view

### Deferred Ideas (OUT OF SCOPE)
- Bulk share token management (generate tokens for N screenplays at once) -- separate phase
- Bulk delete with confirmation -- separate phase, needs careful soft-delete integration
- Keyboard shortcuts for selection (Shift+click range select, Cmd+A) -- polish pass after core works
- Drag-to-select (marquee selection) -- not needed with always-on checkboxes
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BULK-01 | Every screenplay card shows an always-visible checkbox for multi-select (no mode toggle) | Selection store architecture + ScreenplayCard prop threading pattern documented below |
| BULK-02 | A sticky bottom action bar appears when 1+ cards are selected, showing count and clear on left, action buttons on right | BulkActionBar positioning strategy, ComparisonBar pattern analysis, z-index coordination |
| BULK-03 | "Select All (filtered)" selects every screenplay matching current filters; "Deselect All" clears selection | useFilteredScreenplays hook provides filtered IDs; store selectAll/deselectAll actions |
| BULK-10 | Unactionable buttons are visible but disabled with explanatory tooltips (never hidden) | Tooltip pattern recommendation + disabled state logic per action |
| BULK-11 | Selected cards show a highlight ring; unselected cards are not dimmed | Card ring-2 pattern already used for delete selection; new gold ring for bulk selection |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5.0.10 (npm latest: 5.0.12) | Selection state store | Project standard; 19 existing stores follow this pattern |
| react | ^19.2.0 | Component rendering | Project framework |
| clsx | ^2.1.1 | Conditional class composition | Used in every component for class logic |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-virtual | (installed Phase 2) | Virtual scrolling grid | VirtualRow renders cards; selection props pass through it |

### No New Dependencies

This phase requires zero new npm packages. All functionality is built with Zustand (stores), React (components), Tailwind (styling), and clsx (class logic) -- all already in the project.

## Architecture Patterns

### Recommended File Structure
```
src/
├── stores/
│   └── selectionStore.ts           # NEW: bulk selection Zustand store
├── components/
│   └── screenplay/
│       ├── ScreenplayCard.tsx       # MODIFY: add always-visible checkbox + selection ring
│       ├── ScreenplayGrid.tsx       # MODIFY: thread selection props, mount BulkActionBar
│       ├── VirtualRow.tsx           # MODIFY: pass selection props through to cards
│       ├── BulkActionBar.tsx        # NEW: sticky bottom action bar shell
│       └── BackToTopButton.tsx      # MODIFY: shift up when BulkActionBar visible
```

### Pattern 1: Set-Based Selection Store

**What:** Zustand store using `Set<string>` for O(1) membership checks, matching `deleteSelectionStore` pattern.

**When to use:** Always for the new bulk selection store. The `exportSelectionStore` uses `string[]` with `.includes()` (O(n)) which is acceptable for small sets but poor for 500+ potential selections.

**Why Set<string> over string[]:**
- `Set.has()` is O(1) vs `Array.includes()` is O(n)
- Every visible card calls `useIsSelected(id)` on every render -- with 500+ screenplays and 12-20 visible cards, this adds up
- `Set.size` for count is O(1)
- Zustand detects state changes via `Object.is` -- a new Set must be created on mutation (same as current `deleteSelectionStore` pattern)

**Example:**
```typescript
// src/stores/selectionStore.ts
import { create } from 'zustand';

interface SelectionState {
  selectedIds: Set<string>;

  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selectedIds: new Set<string>(),

  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    }),

  selectAll: (ids) =>
    set(() => ({ selectedIds: new Set(ids) })),

  deselectAll: () =>
    set(() => ({ selectedIds: new Set<string>() })),
}));

/** Derived hook: is a specific screenplay selected? */
export function useIsSelected(id: string): boolean {
  return useSelectionStore((s) => s.selectedIds.has(id));
}

/** Derived hook: count of selected items */
export function useSelectionCount(): number {
  return useSelectionStore((s) => s.selectedIds.size);
}

/** Derived hook: are any items selected? (controls BulkActionBar visibility) */
export function useHasSelection(): boolean {
  return useSelectionStore((s) => s.selectedIds.size > 0);
}
```

### Pattern 2: Prop Threading Through Virtual Rows

**What:** Selection callbacks and state flow through ScreenplayGrid -> VirtualRow -> ScreenplayCard.

**When to use:** This is how the virtual grid architecture works. VirtualRow is the intermediary between the grid's virtualizer and individual cards.

**Critical insight:** ScreenplayCard is wrapped in `React.memo`. Adding `isSelected: boolean` and `onToggleSelect: (id: string) => void` as props means the memo comparison works correctly out of the box -- `isSelected` is a primitive boolean (reference-stable for same value), and `onToggleSelect` must be a stable function reference (useCallback or store action direct reference).

**Current VirtualRow prop flow:**
```
ScreenplayGrid passes: virtualRow, screenplays, columnCount, onCardClick, staggerDelay
VirtualRow passes to ScreenplayCard: screenplay, onClick
```

**New prop flow:**
```
ScreenplayGrid passes: + selectedIds (Set), onToggleSelect (stable ref)
VirtualRow passes to ScreenplayCard: + isSelected (boolean), onToggleSelect
```

**Important:** Do NOT pass the entire `selectedIds` Set to ScreenplayCard. Compute `isSelected` boolean per card inside VirtualRow (or use the `useIsSelected(id)` hook directly in ScreenplayCard). Passing the Set would cause all cards to re-render on any selection change.

**Recommended approach -- hook-based (simpler, no prop threading needed):**
```typescript
// Inside ScreenplayCard (already has this pattern for export/delete selection)
const isSelected = useIsSelected(screenplay.id);
const toggle = useSelectionStore((s) => s.toggle);
```
This avoids modifying VirtualRow entirely. ScreenplayCard already uses this pattern for `useIsSelectedForExport` and `useIsSelectedForDelete`. The Zustand selector `(s) => s.selectedIds.has(id)` only triggers re-render when the specific card's selection state changes.

### Pattern 3: Fixed Bottom Bar with Slide-Up Animation

**What:** BulkActionBar uses `fixed bottom-0 left-0 right-0` positioning (matching ComparisonBar), with a slide-up entrance animation.

**When to use:** When 1+ cards are selected (controlled by `useHasSelection()` hook).

**Existing ComparisonBar pattern (line 28):**
```tsx
<div className="fixed bottom-0 left-0 right-0 z-40 animate-slide-up">
  <div className="glass border-t border-gold-500/20 shadow-xl">
    <div className="max-w-[1800px] mx-auto px-6 py-4">
```

**BulkActionBar follows the same pattern** but with a critical addition: it must coordinate with ComparisonBar. Both use `fixed bottom-0 z-40`. The simplest approach is conditional rendering -- when BulkActionBar is visible, ComparisonBar does not show (the existing comparison flow uses the comparison modal, not the bar, for actual comparisons). However, the two could theoretically be visible simultaneously. For this phase (shell only), conditionally showing only BulkActionBar when it has selections is sufficient. Phase 4 wiring will handle the Compare button opening ComparisonModal directly.

### Pattern 4: BackToTopButton Offset

**What:** When BulkActionBar is visible, BackToTopButton shifts upward to avoid overlap.

**Current:** `fixed bottom-6 right-6 z-40`
**When BulkActionBar visible:** `fixed bottom-20 right-6 z-40` (approximately, depends on bar height ~60px + gap)

**Implementation:** Pass `hasSelection` boolean to BackToTopButton (or have it read from the store directly). Use `clsx` to toggle `bottom-6` vs `bottom-20`.

### Anti-Patterns to Avoid

- **DO NOT pass entire selectedIds Set as prop to ScreenplayCard:** This defeats React.memo -- every card re-renders when any selection changes. Use the `useIsSelected(id)` hook pattern instead.
- **DO NOT use Array for selection store:** With potential 500+ selections, Array.includes() is O(n) per card per render. Use Set.
- **DO NOT use persist middleware:** Selection is ephemeral. Refreshing the page should clear selections (matches syncStatusStore/exportSelectionStore pattern).
- **DO NOT nest BulkActionBar inside the scroll container:** It would scroll away with content. Must be a sibling at the Fragment level or use fixed positioning.
- **DO NOT hide the existing exportSelection/deleteSelection checkbox:** The new always-visible checkbox replaces the conditional hover-only checkbox. The existing `handleSelectClick` logic in ScreenplayCard that switches between export/delete selection must be replaced with the new bulk selection toggle.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Selection state management | Custom context + useReducer | Zustand store (Set<string>) | Project standard; 19 stores exist; built-in selector optimization |
| Tooltip on disabled buttons | Custom tooltip component | Native `title` attribute | Sufficient for v1; no new dependency; D-10 just needs explanatory text |
| Slide-up animation | Custom JS animation | CSS `animate-slide-up` class | Already exists in index.css; used by ComparisonBar |
| Conditional class composition | String template concatenation | `clsx` library | Already imported in every component |

**Key insight:** The project already has every primitive needed -- CSS animation classes, Zustand store patterns, selection hook patterns, and glass styling. No new abstractions are required.

## Common Pitfalls

### Pitfall 1: React.memo Invalidation from Unstable References
**What goes wrong:** Passing `toggle` function as `() => store.toggle(id)` creates a new function each render, breaking React.memo.
**Why it happens:** Arrow functions in JSX props create new references on every render.
**How to avoid:** Use the store action directly: `const toggle = useSelectionStore((s) => s.toggle)`. Zustand store actions are stable references -- they never change. Then in the JSX: `onClick={() => toggle(screenplay.id)}`. The wrapper arrow is fine because React.memo compares the `toggle` reference (stable) not the wrapping arrow.
**Better yet:** Use the `useIsSelected(id)` hook inside ScreenplayCard to avoid passing selection props entirely. This is the existing pattern (`useIsSelectedForExport`, `useIsSelectedForDelete`).
**Warning signs:** All cards flashing on any selection change in React DevTools profiler.

### Pitfall 2: Set Reference Equality in Zustand
**What goes wrong:** Mutating the existing Set in-place (`state.selectedIds.add(id)`) doesn't trigger re-renders because Zustand uses `Object.is` comparison.
**Why it happens:** Same Set reference = no state change detected.
**How to avoid:** Always create a new Set: `const next = new Set(state.selectedIds); next.add(id); return { selectedIds: next };`
**Warning signs:** Clicking checkbox doesn't visually update the card.

### Pitfall 3: Select All Filtered vs Select All Visible
**What goes wrong:** Selecting only currently-rendered virtual rows (visible items) instead of all filtered items.
**Why it happens:** Virtual scrolling only renders ~20 cards at a time. `selectAll` must receive the full filtered array, not just visible items.
**How to avoid:** "Select All" reads from `useFilteredScreenplays()` which returns ALL filtered screenplays (not just rendered ones). The `selectAll` action receives `filteredScreenplays.map(sp => sp.id)`.
**Warning signs:** Scrolling after Select All reveals unchecked cards.

### Pitfall 4: Selection State Stale After Filter Change
**What goes wrong:** User selects 10 items, changes filter (hides 5 of them), count shows 10 but only 5 are visible. Confusing UX.
**Why it happens:** Selection store holds all selected IDs regardless of filter state.
**How to avoid:** Two options (Claude's Discretion area):
1. **Preserve selections across filters (recommended):** Keep all selections. Count badge shows total selected (including hidden). "3 selected (2 visible)" or just "3 selected". This is standard behavior in file managers (Finder, etc.).
2. **Prune on filter change:** Clear selections on filter change. Simpler but destroys user's work.
**Recommendation:** Option 1 -- preserve selections. The count in BulkActionBar shows total regardless. When user clicks an action, it operates on all selected IDs (even if some aren't currently visible). This matches the D-11 requirement: "Select All dispatches all currently-filtered screenplay IDs."

### Pitfall 5: Z-Index Stack Conflicts
**What goes wrong:** BulkActionBar overlaps with ComparisonBar, BackToTopButton, ToastContainer, or modals.
**Why it happens:** Multiple fixed-position elements competing for bottom-of-screen real estate.
**Current z-index map:**
| Element | z-index | Position |
|---------|---------|----------|
| Header | z-50 | sticky top-0 |
| Modals (all) | z-50 | fixed inset-0 |
| ToastContainer | z-50 | fixed bottom-4 center |
| ComparisonBar | z-40 | fixed bottom-0 |
| BackToTopButton | z-40 | fixed bottom-6 right-6 |
| BulkActionBar (NEW) | z-40 | fixed bottom-0 |
**How to avoid:** BulkActionBar at z-40 (same as ComparisonBar). They are mutually exclusive in practice -- ComparisonBar shows when comparison mode is active, BulkActionBar shows when selection count > 0. If both could theoretically show, BulkActionBar takes priority (comparison is initiated from within it in Phase 4). BackToTopButton shifts up when either bar is visible.

### Pitfall 6: Checkbox Click Propagating to Card Click
**What goes wrong:** Clicking the checkbox opens the screenplay detail modal AND toggles selection.
**Why it happens:** Click event bubbles from checkbox button to card article's onClick handler.
**How to avoid:** `e.stopPropagation()` on the checkbox click handler. This pattern is already used in the existing `handleSelectClick` function in ScreenplayCard (line 77).
**Warning signs:** Modal opens when checking a box.

## Code Examples

### New selectionStore.ts
```typescript
// src/stores/selectionStore.ts
// Pattern: deleteSelectionStore (Set-based, ephemeral)
import { create } from 'zustand';

interface SelectionState {
  selectedIds: Set<string>;

  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selectedIds: new Set<string>(),

  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),

  selectAll: (ids) =>
    set(() => ({ selectedIds: new Set(ids) })),

  deselectAll: () =>
    set(() => ({ selectedIds: new Set<string>() })),
}));

export function useIsSelected(id: string): boolean {
  return useSelectionStore((s) => s.selectedIds.has(id));
}

export function useSelectionCount(): number {
  return useSelectionStore((s) => s.selectedIds.size);
}

export function useHasSelection(): boolean {
  return useSelectionStore((s) => s.selectedIds.size > 0);
}
```

### ScreenplayCard Checkbox Integration (Always-Visible)
```typescript
// Inside ScreenplayCard, replacing the existing conditional checkbox:
// Old: opacity-0 group-hover:opacity-100 (only on hover)
// New: always opacity-100

const isBulkSelected = useIsSelected(screenplay.id);
const toggleBulkSelection = useSelectionStore((s) => s.toggle);

const handleBulkSelectClick = (e: React.MouseEvent) => {
  e.stopPropagation();
  toggleBulkSelection(screenplay.id);
};

// In JSX -- always-visible checkbox (top-left corner recommended to avoid trash icon conflict at bottom-right):
<button
  onClick={handleBulkSelectClick}
  className={clsx(
    'absolute top-3 left-3 w-6 h-6 rounded border-2 flex items-center justify-center',
    'transition-all duration-150 z-10',
    isBulkSelected
      ? 'bg-gold-500 border-gold-400 text-black-950'
      : 'border-black-500 bg-black-800/50 hover:border-gold-500/50'
  )}
  aria-label={isBulkSelected ? 'Deselect screenplay' : 'Select screenplay'}
>
  {isBulkSelected && (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )}
</button>

// Selection ring on the article:
<article className={clsx(
  'card cursor-pointer relative group transition-all duration-200 ease-out',
  tierClass,
  isBulkSelected && 'ring-2 ring-gold-500/50',
  // ... existing classes
)}>
```

### BulkActionBar Shell
```typescript
// src/components/screenplay/BulkActionBar.tsx
// Follows ComparisonBar pattern: fixed bottom-0, glass styling, animate-slide-up
import { useSelectionStore, useSelectionCount, useHasSelection } from '@/stores/selectionStore';

export function BulkActionBar() {
  const count = useSelectionCount();
  const hasSelection = useHasSelection();
  const deselectAll = useSelectionStore((s) => s.deselectAll);

  if (!hasSelection) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 animate-slide-up">
      <div className="glass border-t border-gold-500/20 shadow-xl">
        <div className="max-w-[1800px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Left: count + clear (D-12) */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gold-200">
                {count} screenplay{count !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={deselectAll}
                className="text-black-400 hover:text-red-400 transition-colors"
                aria-label="Clear selection"
                title="Clear selection"
              >
                {/* X icon */}
              </button>
            </div>

            {/* Right: action buttons -- shell only, disabled (D-09, D-10) */}
            <div className="flex items-center gap-2">
              {/* Six buttons, all disabled with title tooltips */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Select All / Deselect All Wiring
```typescript
// Inside BulkActionBar or a dedicated component
import { useFilteredScreenplays } from '@/hooks/useFilteredScreenplays';

const { screenplays: filtered } = useFilteredScreenplays();
const selectAll = useSelectionStore((s) => s.selectAll);
const deselectAll = useSelectionStore((s) => s.deselectAll);

const handleSelectAll = () => {
  selectAll(filtered.map((sp) => sp.id));
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Export checkbox (hover-only, top-right) | Always-visible bulk selection checkbox (top-left) | Phase 3 | Existing export/delete checkboxes in ScreenplayCard will be replaced/unified with the new bulk selection |
| No bulk action bar | Sticky BulkActionBar (fixed bottom) | Phase 3 | New component; ComparisonBar pattern adapted |
| Array-based selection (exportSelectionStore) | Set-based selection (selectionStore) | Phase 3 | O(1) lookups for 500+ potential selections |

**Relationship to existing selection stores:**
- `exportSelectionStore` and `deleteSelectionStore` currently power the card checkboxes. The new `selectionStore` replaces their role for the always-visible checkbox. In Phase 4, the bulk Export CSV/PDF actions will read from `selectionStore` (not `exportSelectionStore`). The old stores may become vestigial but should not be removed in Phase 3 to avoid breaking other flows (ExportModal reads from `exportSelectionStore`).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x + @testing-library/react |
| Config file | vitest.config.ts |
| Quick run command | `npm run test:run -- --reporter=verbose` |
| Full suite command | `npm run test:run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BULK-01 | Always-visible checkbox on card, toggles selection | unit | `npx vitest run src/stores/selectionStore.test.ts -x` | No -- Wave 0 |
| BULK-02 | BulkActionBar renders when count > 0, shows count + clear | unit | `npx vitest run src/components/screenplay/BulkActionBar.test.tsx -x` | No -- Wave 0 |
| BULK-03 | Select All dispatches all filtered IDs; Deselect All clears | unit | `npx vitest run src/stores/selectionStore.test.ts -x` | No -- Wave 0 |
| BULK-10 | Disabled buttons render with title tooltips | unit | `npx vitest run src/components/screenplay/BulkActionBar.test.tsx -x` | No -- Wave 0 |
| BULK-11 | Selected cards get ring-2 class; unselected cards unchanged | unit | `npx vitest run src/components/screenplay/ScreenplayGrid.test.tsx -x` | Exists (needs update) |

### Sampling Rate
- **Per task commit:** `npm run test:run -- --reporter=verbose`
- **Per wave merge:** `npm run test:run && npm run build`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/stores/selectionStore.test.ts` -- covers BULK-01, BULK-03 (store logic: toggle, selectAll, deselectAll, derived hooks)
- [ ] `src/components/screenplay/BulkActionBar.test.tsx` -- covers BULK-02, BULK-10 (renders when selection > 0, disabled buttons with tooltips)
- [ ] Update `src/components/screenplay/ScreenplayGrid.test.tsx` -- covers BULK-11 (mock selectionStore, verify ring class on selected cards)
- [ ] Mock pattern: `vi.mock('@/stores/selectionStore')` needed in ScreenplayGrid and ScreenplayCard tests

## Open Questions

1. **ComparisonBar and BulkActionBar coexistence**
   - What we know: Both use `fixed bottom-0 z-40`. ComparisonBar renders when `selectedIds.length > 0` in comparisonStore. BulkActionBar renders when `selectedIds.size > 0` in selectionStore.
   - What's unclear: Can both be active simultaneously? If user has bulk selections AND comparison selections, which bar shows?
   - Recommendation: In Phase 3 (shell only), they are independent. The ComparisonBar won't interfere because comparison mode is a separate flow. In Phase 4, the Compare button in BulkActionBar will open ComparisonModal directly, potentially deprecating ComparisonBar. For now, both can coexist -- BulkActionBar at z-40, ComparisonBar at z-40 -- the last rendered in DOM wins visually if both show. To be safe, BulkActionBar renders after ComparisonBar in App.tsx ordering.

2. **Existing export/delete checkbox replacement**
   - What we know: ScreenplayCard has a single checkbox that switches between export and delete mode based on `isDeleteMode`.
   - What's unclear: Should the new always-visible bulk selection checkbox completely replace the existing one, or coexist?
   - Recommendation: Replace. The new bulk selection checkbox serves the same purpose (selecting cards for actions) but is always visible. The old `exportSelectionStore` toggling behavior inside ScreenplayCard should be replaced by `selectionStore`. Phase 4 wires the "Export CSV"/"Export PDF" buttons in BulkActionBar to read from `selectionStore`, making `exportSelectionStore` redundant for card-level selection. However, keep `exportSelectionStore` alive (unused in cards) for backward compatibility with ExportModal until Phase 4 fully migrates it.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/stores/deleteSelectionStore.ts` -- Set-based Zustand store pattern
- Codebase analysis: `src/stores/exportSelectionStore.ts` -- Array-based Zustand store pattern (anti-pattern for scale)
- Codebase analysis: `src/components/comparison/ComparisonBar.tsx` -- Fixed bottom bar pattern with glass styling
- Codebase analysis: `src/components/screenplay/ScreenplayCard.tsx` -- React.memo wrapper, existing checkbox/selection patterns
- Codebase analysis: `src/components/screenplay/VirtualRow.tsx` -- Prop threading from grid to cards
- Codebase analysis: `src/components/screenplay/ScreenplayGrid.tsx` -- Virtual grid container, BackToTopButton mounting
- Codebase analysis: `src/hooks/useFilteredScreenplays.ts` -- Provides full filtered set for Select All

### Secondary (MEDIUM confidence)
- Zustand 5 documentation: Set-based stores require new Set on mutation for reference change detection
- npm registry: zustand@5.0.12 (latest stable, project uses ^5.0.10)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all patterns exist in codebase
- Architecture: HIGH -- directly extends existing patterns (deleteSelectionStore, ComparisonBar)
- Pitfalls: HIGH -- all identified from codebase analysis and React/Zustand fundamentals
- Validation: HIGH -- vitest + testing-library already configured, mock patterns established

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable -- no external dependencies or rapidly changing APIs)
