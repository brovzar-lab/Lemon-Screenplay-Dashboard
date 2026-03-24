# Phase 3: Selection Mode Foundation - Context

**Gathered:** 2026-03-23 (pre-milestone discussion)
**Updated:** 2026-03-23 (code context updated post-Phase 2 virtual grid)
**Status:** Ready for planning

<domain>
## Phase Boundary

Add multi-select checkboxes to screenplay cards, build the selection Zustand store, render the sticky bottom bulk action bar shell, and wire up Select All/Deselect All. This phase builds the selection infrastructure — Phase 4 wires the actual bulk actions (export, compare, etc.) and Phase 5 builds the bulk PDF upload modal.

</domain>

<decisions>
## Implementation Decisions

### PdfUploadPanel scoped behavior (Phase 5 prep)
- **D-01:** New `BulkPdfUploadModal` component (not a mode of existing PdfUploadPanel). Reuse upload logic/hooks, purpose-built UI
- **D-02:** Shows only missing-PDF screenplays from selection. Note at top: "2 of 5 already have PDFs" if some have PDFs
- **D-03:** Stays open with success summary ("3/3 uploaded") until user dismisses. No auto-close
- **D-04:** One dropzone per screenplay — individual dropzones mapped to titles, no filename auto-matching

### Selection mode UX
- **D-05:** Always-on checkboxes — every card shows a checkbox in its corner at all times. No mode toggle
- **D-06:** Sticky bottom bar slides up when first card is selected. Keeps filter/sort bar visible above
- **D-07:** Highlight ring on selected cards — subtle ring/border + count badge. No dimming of unselected cards
- **D-08:** No global selection cap — select freely. Per-action limits enforced at the button level

### Bulk action bar
- **D-09:** Six actions: Export CSV, Export PDF, Compare (2-5 max), Upload PDFs (≥1 missing PDF), Add to Collection, Add to Favorites
- **D-10:** Visible-but-disabled buttons with tooltip when conditions not met ("Compare — need 2+"). Never hide actions
- **D-11:** Select All (filtered) + Deselect All buttons. Select All dispatches all currently-filtered screenplay IDs
- **D-12:** Left side: "3 screenplays selected ×" (count + clear). Right side: action buttons

### Claude's Discretion
- Checkbox visual style (checkbox icon, position within card corner)
- BulkActionBar slide-up animation timing
- Tooltip implementation (native title vs custom component)
- Whether selectionStore uses persist middleware (probably not — ephemeral like syncStatusStore)
- How to handle selection state when filter changes remove selected items from view

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

### Phase dependencies
- `.planning/phases/02-performance-at-scale/02-CONTEXT.md` — Virtual grid architecture decisions that constrain how checkbox overlays and action bar integrate
- `.planning/REQUIREMENTS.md` — BULK-01, BULK-02, BULK-03, BULK-10, BULK-11

</canonical_refs>

<specifics>
## Specific Ideas

- The BulkActionBar is purely a shell in this phase — buttons render but don't trigger export/compare/upload modals yet (Phase 4 wires those)
- The premium visual design (gold/black theme with glassmorphism) must be preserved in the action bar styling
- BackToTopButton is already `fixed bottom-6 right-6 z-40` — the BulkActionBar should use a different positioning strategy (sticky bottom full-width) so they don't overlap. BackToTopButton may need a slight upward shift when the bar is visible

</specifics>

<code_context>
## Existing Code Insights (Updated Post-Phase 2)

### Reusable Assets
- `src/stores/exportSelectionStore.ts` + `src/stores/deleteSelectionStore.ts` — Existing selection store patterns in ScreenplayCard. The new `selectionStore` follows the same hook pattern (`useSelectionStore`, `useIsSelected(id)`)
- `src/hooks/useFilteredScreenplays.ts` — Provides the filtered screenplay set for "Select All (filtered)"
- `src/hooks/useColumnCount.ts` — Returns current column count (needed to understand grid layout context)

### Established Patterns
- Zustand stores per domain (filter, sort, comparison, favorites, syncStatus, toast, exportSelection, deleteSelection) — new `selectionStore` follows same pattern, likely ephemeral (no persist middleware)
- `ScreenplayCard` is wrapped in `React.memo` — adding `isSelected` and `onSelect` props means the memo will correctly skip re-renders when only unrelated props change (memo compares all props shallowly)
- Tailwind-only styling — all new components use Tailwind classes
- ErrorBoundary wraps each card inside VirtualRow

### Integration Points (Post-Virtual Grid)
- **VirtualRow** (`src/components/screenplay/VirtualRow.tsx`) — Renders N cards per row. Must pass `onSelect` and `selectedIds` (or `isSelected` per card) through VirtualRow → ScreenplayCard. VirtualRow currently accepts: `virtualRow`, `screenplays`, `columnCount`, `onCardClick`, `staggerDelay`
- **ScreenplayGrid** (`src/components/screenplay/ScreenplayGrid.tsx`) — Virtualized grid container. The `BulkActionBar` should mount as a sibling of the scroll container div (not inside it, or it would scroll away). Grid currently accepts: `screenplays`, `isLoading`, `onCardClick`
- **ScreenplayCard** (`src/components/screenplay/ScreenplayCard.tsx`) — Already has checkbox patterns from exportSelectionStore/deleteSelectionStore. New bulk selection checkbox is always-visible (not conditional on a mode). Card currently accepts: `screenplay`, `onClick`
- **BackToTopButton** (`src/components/screenplay/BackToTopButton.tsx`) — `fixed bottom-6 right-6 z-40`. When BulkActionBar is visible, BackToTopButton needs `bottom` offset increased so it doesn't overlap the bar
- **Page-level layout** — BulkActionBar could mount at the page level (above ScreenplayGrid) or inside ScreenplayGrid as a sibling to the scroll container. Placing it at the Grid level keeps selection concerns colocated

</code_context>

<deferred>
## Deferred Ideas

- Bulk share token management (generate tokens for N screenplays at once) — separate phase
- Bulk delete with confirmation — separate phase, needs careful soft-delete integration
- Keyboard shortcuts for selection (Shift+click range select, Cmd+A) — polish pass after core works
- Drag-to-select (marquee selection) — not needed with always-on checkboxes

</deferred>

---

*Phase: 03-selection-mode-foundation*
*Context gathered: 2026-03-23 (updated post-Phase 2)*
