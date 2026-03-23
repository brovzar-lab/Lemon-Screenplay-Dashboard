# Phase 3 Context: Selection Mode Foundation — Bulk Operations & Multi-Select

**Created:** 2026-03-23
**Phase goal:** Add multi-select to the screenplay grid and expose bulk actions (export, compare, PDF upload, favorites, collections) from a persistent action bar.

---

## Prior Decisions Applied

- Coverage PDF export exists (Phase 7) — bulk export extends this
- Share tokens exist (Phase 5) — not in bulk scope yet
- PdfUploadPanel exists in Settings — will be reused in scoped mode
- ComparisonModal exists — bulk compare extends selection into it
- Zustand stores per domain (filter, sort, comparison, favorites) — new selection store follows same pattern
- CollectionTabs exist — "Add to Collection" action integrates with existing store

---

## Area 1: PdfUploadPanel Scoped Behavior

**Decision:** Streamlined upload modal, not the full PdfUploadPanel.

| Question | Decision |
|----------|----------|
| Full panel vs streamlined? | **Streamlined** — just titles + dropzones. The selection was already made in the grid; no need to re-search or re-filter inside the modal. |
| Auto-close on completion? | **No** — stay open with success summary ("3/3 uploaded") until user dismisses. Close on click or Escape. |
| Show all selected or only missing-PDF? | **Only missing-PDF** — if 5 selected but only 3 need PDFs, show 3 dropzones. Small note at top: "2 of 5 already have PDFs." |
| Drag-and-drop model? | **One dropzone per screenplay** — individual dropzones mapped to titles. No filename auto-matching (too fragile with files like `final_v3_REAL.pdf`). |

**Implementation note:** This is a new `BulkPdfUploadModal` component, not a mode of the existing PdfUploadPanel. Reuse the upload logic/hooks from the existing panel, but the UI is purpose-built for the scoped context.

---

## Area 2: Selection Mode UX

**Decision:** Always-on checkboxes with sticky bottom action bar.

| Question | Decision |
|----------|----------|
| How to enter selection mode? | **Always-on checkboxes** — every card shows a checkbox in its corner at all times. No mode toggle needed. One click to start selecting. |
| Bulk action bar placement? | **Sticky bottom bar** — slides up when first card is selected. Keeps filter/sort bar visible above. |
| Visual treatment of selected cards? | **Highlight ring on selected cards** — subtle ring/border + count badge. No dimming of unselected cards (would hurt scanning across 500+ cards). |
| Selection limits? | **No global cap** — select freely. Per-action limits enforced at the action button level (e.g., Compare shows "3/5 max"). |

**Implementation note:** New `useSelectionStore` (Zustand) holds `selectedIds: Set<string>`. The `ScreenplayCard` component gets a checkbox overlay. `BulkActionBar` is a new layout-level component that conditionally renders based on selection count > 0.

---

## Area 3: Bulk Action Bar — Actions & Conditions

**Decision:** Six actions with visible-but-disabled pattern.

| Action | Min | Max | Condition |
|--------|-----|-----|-----------|
| Export CSV | 1 | unlimited | always |
| Export PDF | 1 | unlimited | always |
| Compare | 2 | 5 | always |
| Upload PDFs | 1 | unlimited | at least 1 selected has no PDF |
| Add to Collection | 1 | unlimited | always |
| Add to Favorites | 1 | unlimited | always |

| Question | Decision |
|----------|----------|
| Disabled vs hidden buttons? | **Visible but disabled + tooltip** — grayed-out buttons with explanatory tooltip ("Compare — need 2+"). Never hide actions. |
| Select All / Deselect All? | **Yes, both** — "Select All (filtered)" selects everything matching current filters. "Deselect All" clears. Essential for batch export. |
| Bar layout? | **Count + clear on left, actions on right** — "3 screenplays selected x" on the left provides constant feedback and escape hatch. Action buttons on the right. |

**Implementation note:** `BulkActionBar` reads from `useSelectionStore` and `useFilteredScreenplays`. Each action button computes its own enabled/disabled state from the selection set. "Select All" dispatches all currently-filtered screenplay IDs into the store.

---

## Code Context

### Existing assets to reuse
- `src/components/settings/PdfUploadPanel.tsx` — upload logic, file validation, progress tracking (reuse hooks, not the UI)
- `src/components/comparison/ComparisonModal.tsx` — receives screenplay IDs for comparison
- `src/components/export/ExportModal.tsx` — CSV/PDF export accepts screenplay array
- `src/stores/` — pattern: one Zustand store per domain with persist middleware where needed
- `src/hooks/useFilteredScreenplays.ts` — provides the filtered set for "Select All (filtered)"
- `src/components/screenplay/ScreenplayCard.tsx` — gets checkbox overlay
- `src/components/screenplay/ScreenplayGrid.tsx` — layout container, BulkActionBar mounts here or in parent

### New files anticipated
- `src/stores/selectionStore.ts` — `selectedIds`, `toggleSelection`, `selectAll`, `clearSelection`
- `src/components/bulk/BulkActionBar.tsx` — sticky bottom bar with action buttons
- `src/components/bulk/BulkPdfUploadModal.tsx` — streamlined upload modal for selected screenplays
- `src/components/bulk/index.ts` — barrel export

### Integration points
- `ScreenplayCard` — add optional `onSelect` prop + checkbox overlay when selection store is non-empty or always visible
- `ScreenplayGrid` or page-level layout — mount `BulkActionBar` as sibling
- Existing `ExportModal` and `ComparisonModal` — accept pre-selected IDs from selection store
- `useFilteredScreenplays` — provides IDs for "Select All (filtered)"

---

## Deferred Ideas

- Bulk share token management (generate tokens for N screenplays at once) — separate phase
- Bulk delete with confirmation — separate phase, needs careful soft-delete integration
- Keyboard shortcuts for selection (Shift+click range select, Cmd+A) — polish pass after core works

---

## Next Steps

> **Note:** Phase 3 is part of v7.0 milestone.

Once milestone is set up:
1. `/gsd:plan-phase 3` to generate the execution plan
