# Phase 4: Bulk Action Integrations - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire up the five always-available bulk actions — export CSV, export PDF, compare, set category, add to favorites — connecting the selection store to existing modals and stores. The BulkActionBar shell with six disabled buttons already exists from Phase 3. This phase enables them.

Note: "Upload PDFs" button remains disabled in this phase — it's wired in Phase 5.

</domain>

<decisions>
## Implementation Decisions

### "Set Category" action (formerly "Add to Collection")
- **D-01:** "Add to Collection" is renamed to **"Set Category"** — bulk-assigns the category field on selected screenplays. Collections don't exist as a user concept; categories do.
- **D-02:** Modal shows a **dropdown of existing categories only** — no inline category creation. Category management stays in Settings.
- **D-03:** Setting category **replaces** existing category on all selected screenplays — no "only apply to uncategorized" logic. Confirmation via success toast.

### Post-action behavior
- **D-04:** Selection **stays selected** after any bulk action completes — user can chain multiple actions on the same set without re-selecting. Clear button is always available.
- **D-05:** Every bulk action shows a **success toast** on completion — e.g., "Exported 10 screenplays as CSV", "Added 5 to Shortlist", "Category set to ACTION for 8 screenplays". Uses existing toast system, auto-dismiss 3s.
- **D-06:** Bulk action bar **stays visible behind modals** — bar is z-40, modals are z-50. No special show/hide logic.
- **D-07:** Compare copies selected IDs into comparisonStore — **selection stays untouched**. Closing comparison modal returns to grid with selection intact.

### Compare limits
- **D-08:** Compare max stays at **3** (existing comparisonStore limit). Side-by-side layout and radar chart are designed for 2-3 columns. No expansion to 5.
- **D-09:** Compare button **disabled with tooltip "Select 2-3 to compare"** when selection count is <2 or >3. No silent truncation.
- **D-10:** Compare with valid selection (2-3) opens **immediately** — no confirmation gate.

### Batch PDF export
- **D-11:** Batch PDF export generates **individual PDF files** per screenplay (not one merged document) — each coverage PDF is a standalone shareable document.
- **D-12:** PDFs are **zipped into a single .zip file** for download — uses JSZip (~10KB) to bundle all generated PDFs into `screenplays-export-YYYY-MM-DD.zip`. One download instead of N.
- **D-13:** **Inline progress indicator** in the bulk action bar during PDF generation — Export PDF button transforms into "Exporting PDF 3 of 20..." with progress, reverts to button when done. Prevents double-clicks.

### CSV export
- **D-14:** CSV export remains a **single file** regardless of selection count — `exportToCSV` already takes an array and produces one CSV. No zip needed.

### Claude's Discretion
- JSZip integration approach (dynamic import vs static)
- SetCategoryModal component structure and styling (follows existing modal patterns)
- AddToFavoritesModal — whether to show list picker or quick-add to default list
- Progress indicator animation/transition in BulkActionBar
- Toast message wording for each action
- Whether to add new dependency (JSZip) or use existing zip capability
- Order of button enablement (can be done in any order)

</decisions>

<canonical_refs>
## Canonical References

### Phase 3 outputs (prerequisites)
- `src/stores/selectionStore.ts` — Set-based selection store with `selectedIds`, `toggle`, `selectAll`, `deselectAll`, derived hooks
- `src/components/screenplay/BulkActionBar.tsx` — Shell with six disabled buttons, count + clear on left, actions on right

### Existing systems to wire into
- `src/components/export/csvExport.ts` — `exportToCSV(screenplays[], filename)` — ready for bulk, no changes needed
- `src/components/export/PdfDocument.tsx` — Single-screenplay PDF component for `@react-pdf/renderer`
- `src/components/export/ExportModal.tsx` — Existing export modal (may be bypassed for bulk; bulk actions can call functions directly)
- `src/stores/comparisonStore.ts` — `openComparison(ids[])` opens ComparisonModal with 2-3 IDs
- `src/stores/favoritesStore.ts` — `addToList(listId, screenplayId)` — persisted, supports named lists
- `src/hooks/useCategories.ts` — Category list from settings for the dropdown

</canonical_refs>

<specifics>
## Specific Ideas

- The "Upload PDFs" button stays disabled in this phase with tooltip "Wired in next update" — Phase 5 handles it
- JSZip is a new dependency (~10KB gzipped) — acceptable for the zip-and-download pattern
- SetCategoryModal should be minimal: title, dropdown, apply button — no multi-step flow
- AddToFavoritesModal should show existing lists with radio/checkbox selection — reuse patterns from FavoritesPanel in Settings
- For Compare, the bulk action bar just calls `comparisonStore.openComparison()` — no new modal needed

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/export/csvExport.ts` — Fully functional, takes array, produces single CSV. Zero changes for bulk.
- `src/components/export/PdfDocument.tsx` — Single-screenplay PDF. Loop + zip for bulk.
- `src/stores/comparisonStore.ts` — `openComparison(ids)` with max 3 enforcement. Direct call from button.
- `src/stores/favoritesStore.ts` — `addToList(listId, id)` per screenplay. Loop through selected IDs.
- `src/hooks/useCategories.ts` — Returns category list for dropdown population.
- `src/stores/toastStore.ts` — `addToast({ type, message })` for success/error feedback.

### Established Patterns
- Zustand stores per domain — new `setCategoryModal` state can live in a small ephemeral store or local component state
- Modal pattern — ComparisonModal, ExportModal, ShareModal all follow same structure (portal, backdrop, content)
- Toast feedback — all v6.8 operations use `addToast` for user feedback

### Integration Points
- BulkActionBar buttons → onClick handlers that read `selectionStore.getState().selectedIds`
- Selected IDs → `useScreenplays()` data to resolve full screenplay objects for export/category operations
- Category assignment → update screenplay objects in localStorage + sync to Firestore
- Favorites → `favoritesStore.addToList()` per ID in selection set

</code_context>

<deferred>
## Deferred Ideas

- Bulk share token generation (BULK-E1) — generate share links for N screenplays at once — backlog
- Bulk delete with confirmation (BULK-E2) — soft-delete integration for multi-select — backlog
- Compare expansion to 5 items — would need ComparisonModal layout rework — not planned
- Merged single-PDF export (all screenplays in one document) — individual + zip is better for sharing

</deferred>

---

*Phase: 04-bulk-action-integrations*
*Context gathered: 2026-03-23*
