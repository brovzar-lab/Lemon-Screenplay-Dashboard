# Phase 4: Bulk Action Integrations - Research

**Researched:** 2026-03-23
**Domain:** React component wiring, Zustand store integration, PDF generation + zip, CSV export
**Confidence:** HIGH

## Summary

Phase 4 wires up five of six disabled bulk action buttons in the BulkActionBar shell (built in Phase 3). The sixth button, "Upload PDFs," remains disabled until Phase 5. The five actions span three integration patterns: (1) direct function calls for CSV export and Compare, (2) loop-and-aggregate for PDF export with JSZip, and (3) new lightweight modals for Set Category and Add to Favorites.

The existing codebase provides nearly all the building blocks. `exportToCSV()` already accepts an array and produces a single CSV file. `pdf().toBlob()` from `@react-pdf/renderer` generates individual PDF blobs (already used in ExportModal). `comparisonStore.openComparison(ids)` opens comparison with 2-3 IDs. `favoritesStore.addToList()` and `toggleQuickFavorite()` handle favorites. The only new dependency is JSZip (~10KB gzipped) for bundling multiple PDFs into a zip download.

**Primary recommendation:** Implement in order of complexity -- CSV export (pure function call), Compare (store call with count guard), Add to Favorites (modal with list picker or quick-add), Set Category (new modal + analysisStore update function + query invalidation), Export PDF (JSZip integration with progress tracking). The toast store needs a `'success'` severity added as a prerequisite since it currently only supports `'error' | 'warning'`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** "Add to Collection" is renamed to **"Set Category"** -- bulk-assigns the category field on selected screenplays. Collections don't exist as a user concept; categories do.
- **D-02:** Modal shows a **dropdown of existing categories only** -- no inline category creation. Category management stays in Settings.
- **D-03:** Setting category **replaces** existing category on all selected screenplays -- no "only apply to uncategorized" logic. Confirmation via success toast.
- **D-04:** Selection **stays selected** after any bulk action completes -- user can chain multiple actions on the same set without re-selecting. Clear button is always available.
- **D-05:** Every bulk action shows a **success toast** on completion -- e.g., "Exported 10 screenplays as CSV", "Added 5 to Shortlist", "Category set to ACTION for 8 screenplays". Uses existing toast system, auto-dismiss 3s.
- **D-06:** Bulk action bar **stays visible behind modals** -- bar is z-40, modals are z-50. No special show/hide logic.
- **D-07:** Compare copies selected IDs into comparisonStore -- **selection stays untouched**. Closing comparison modal returns to grid with selection intact.
- **D-08:** Compare max stays at **3** (existing comparisonStore limit). Side-by-side layout and radar chart are designed for 2-3 columns. No expansion to 5.
- **D-09:** Compare button **disabled with tooltip "Select 2-3 to compare"** when selection count is <2 or >3. No silent truncation.
- **D-10:** Compare with valid selection (2-3) opens **immediately** -- no confirmation gate.
- **D-11:** Batch PDF export generates **individual PDF files** per screenplay (not one merged document) -- each coverage PDF is a standalone shareable document.
- **D-12:** PDFs are **zipped into a single .zip file** for download -- uses JSZip (~10KB) to bundle all generated PDFs into `screenplays-export-YYYY-MM-DD.zip`. One download instead of N.
- **D-13:** **Inline progress indicator** in the bulk action bar during PDF generation -- Export PDF button transforms into "Exporting PDF 3 of 20..." with progress, reverts to button when done. Prevents double-clicks.
- **D-14:** CSV export remains a **single file** regardless of selection count -- `exportToCSV` already takes an array and produces one CSV. No zip needed.

### Claude's Discretion
- JSZip integration approach (dynamic import vs static)
- SetCategoryModal component structure and styling (follows existing modal patterns)
- AddToFavoritesModal -- whether to show list picker or quick-add to default list
- Progress indicator animation/transition in BulkActionBar
- Toast message wording for each action
- Whether to add new dependency (JSZip) or use existing zip capability
- Order of button enablement (can be done in any order)

### Deferred Ideas (OUT OF SCOPE)
- Bulk share token generation (BULK-E1) -- generate share links for N screenplays at once -- backlog
- Bulk delete with confirmation (BULK-E2) -- soft-delete integration for multi-select -- backlog
- Compare expansion to 5 items -- would need ComparisonModal layout rework -- not planned
- Merged single-PDF export (all screenplays in one document) -- individual + zip is better for sharing
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BULK-04 | User can export selected screenplays as CSV from the bulk action bar | `exportToCSV(screenplays[], filename)` is ready -- just resolve IDs to Screenplay objects and call it. Zero changes to csvExport.ts. |
| BULK-05 | User can export selected screenplays as PDF reports from the bulk action bar | Loop `pdf(<PdfDocument screenplay={sp} />).toBlob()` per screenplay, collect into JSZip, trigger .zip download. Inline progress in button per D-13. |
| BULK-06 | User can compare 2-3 selected screenplays (button disabled with tooltip below minimum/above maximum) | Note: REQUIREMENTS.md says 2-5 but CONTEXT.md D-08/D-09 lock to 2-3 (comparisonStore MAX_COMPARISON_ITEMS=3). Button calls `comparisonStore.openComparison(ids)`. Disable when count < 2 or > 3. |
| BULK-08 | User can add selected screenplays to a collection from the bulk action bar | Renamed to "Set Category" per D-01. New SetCategoryModal with category dropdown. Needs new `patchAnalysisField()` in analysisStore + React Query invalidation. |
| BULK-09 | User can add selected screenplays to favorites from the bulk action bar | New AddToFavoritesModal or quick-add. Loop `favoritesStore.addToList(listId, id)` or `toggleQuickFavorite(id)` for each selected ID. |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-pdf/renderer | 4.3.2 | Generate PDF blobs from React components | Already used in ExportModal and exportCoverage.tsx |
| zustand | 5.x | State management for selection, comparison, favorites, toast | Project standard per CLAUDE.md |
| @tanstack/react-query | 5.x | Server state cache invalidation after category update | Project standard per CLAUDE.md |
| papaparse | (installed) | CSV generation | Already used in csvExport.ts |
| clsx | (installed) | Conditional classnames | Already used throughout |

### New Dependency
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jszip | 3.10.1 | Bundle multiple PDF blobs into a single .zip download | Bulk PDF export (D-12) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSZip | fflate | Smaller but no high-level zip API; JSZip is more ergonomic for file().async() pattern |
| JSZip | Multiple individual downloads | Bad UX -- N browser download prompts. Zip is clearly better. |
| Static import JSZip | Dynamic import() JSZip | Dynamic import keeps main bundle smaller; recommended since bulk PDF is not used on every page load |

**Installation:**
```bash
npm install jszip
```

**Version verification:** JSZip 3.10.1 confirmed current via `npm view jszip version` (2026-03-23). Ships bundled TypeScript types -- no `@types/jszip` needed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── screenplay/
│   │   └── BulkActionBar.tsx           # MODIFY: wire up 5 buttons, add handlers + progress state
│   ├── bulk/                            # NEW: bulk action modals
│   │   ├── SetCategoryModal.tsx         # NEW: category dropdown modal
│   │   ├── AddToFavoritesModal.tsx      # NEW: favorites list picker modal
│   │   └── index.ts                     # NEW: barrel exports
│   └── export/
│       └── bulkPdfExport.ts            # NEW: JSZip-based bulk PDF generation
├── stores/
│   └── toastStore.ts                   # MODIFY: add 'success' severity
├── components/ui/
│   └── ToastContainer.tsx              # MODIFY: add green border for success
└── lib/
    └── analysisStore.ts                # MODIFY: add patchAnalysisField() for category update
```

### Pattern 1: Direct Function Call (CSV Export, Compare)
**What:** Button onClick reads selectionStore, resolves IDs to Screenplay objects, calls existing function.
**When to use:** When the action is a single synchronous/async call with no user input needed.
**Example:**
```typescript
// CSV Export -- direct call, no modal
const handleExportCSV = () => {
  const ids = useSelectionStore.getState().selectedIds;
  const selected = allScreenplays.filter(sp => ids.has(sp.id));
  exportToCSV(selected, 'selected_screenplays');
  addToast(`Exported ${selected.length} screenplays as CSV`, 'success');
};

// Compare -- store call with guard
const handleCompare = () => {
  const ids = Array.from(useSelectionStore.getState().selectedIds);
  useComparisonStore.getState().openComparison(ids);
};
```

### Pattern 2: Loop + Aggregate (Bulk PDF Export)
**What:** Iterate over selections, generate per-item output, aggregate results, trigger single download.
**When to use:** When each item requires async processing (PDF rendering) and results are bundled.
**Example:**
```typescript
// Bulk PDF with JSZip -- dynamic import for code splitting
const handleExportPDF = async () => {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const ids = useSelectionStore.getState().selectedIds;
  const selected = allScreenplays.filter(sp => ids.has(sp.id));

  for (let i = 0; i < selected.length; i++) {
    setProgress({ current: i + 1, total: selected.length });
    const blob = await pdf(<PdfDocument screenplay={selected[i]} />).toBlob();
    const safeName = selected[i].title.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
    zip.file(`${safeName}-PitchDeck.pdf`, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  // trigger download...
  setProgress(null);
  addToast(`Exported ${selected.length} screenplays as PDF`, 'success');
};
```

### Pattern 3: Lightweight Modal (Set Category, Add to Favorites)
**What:** Button opens a small modal, user makes a selection, modal calls store function per item, closes.
**When to use:** When the action requires user input (which category? which list?).
**Example:**
```typescript
// Follows existing modal pattern: portal, backdrop (z-50), content, close on backdrop click
// Same glass styling as ExportModal, ComparisonModal
<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div className="fixed inset-0 bg-black-950/80 backdrop-blur-sm" onClick={onClose} />
  <div className="relative w-full max-w-md glass border border-gold-500/20 rounded-xl overflow-hidden animate-scale-in">
    {/* content */}
  </div>
</div>
```

### Anti-Patterns to Avoid
- **Clearing selection after action:** D-04 explicitly requires selection stays intact. Never call `deselectAll()` after a bulk action.
- **Routing through ExportModal for bulk:** The existing ExportModal is designed for single/filtered export with format picker. Bulk CSV and bulk PDF should be direct actions from the bar -- no modal needed for CSV, no format picker needed for PDF.
- **Modifying csvExport.ts:** It already works perfectly with arrays. Don't touch it.
- **Static import of JSZip:** It's only needed for bulk PDF export. Dynamic `import('jszip')` keeps it out of the main bundle.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZIP file creation | Manual binary zip construction | JSZip 3.10.1 | ZIP format has CRC32, deflation, central directory -- hundreds of edge cases |
| CSV generation | Manual comma-escaping | PapaSerial (already used) | Handles quoting, escaping, Unicode BOM |
| PDF rendering | Canvas-based PDF | @react-pdf/renderer pdf().toBlob() | Already proven in codebase, handles fonts, layout, multi-page |
| File download triggering | window.open() or manual fetch | createElement('a') + click pattern | Standard pattern already in csvExport.ts and exportCoverage.tsx |

**Key insight:** Every "export" primitive already exists in this codebase. The only new capability is JSZip for bundling multiple blobs into one download.

## Common Pitfalls

### Pitfall 1: Toast Store Missing 'success' Severity
**What goes wrong:** D-05 requires success toasts (green) for every bulk action. The current `ToastSeverity` type is `'error' | 'warning'` only. ToastContainer renders amber for warning, red for error -- no green variant exists.
**Why it happens:** Toast system was built for error/warning feedback only (v6.8 scope).
**How to avoid:** Add `'success'` to `ToastSeverity` union type. Add `'border-l-emerald-500'` mapping in ToastContainer. Change auto-dismiss to 3s for success toasts (currently 5s for all). This is a prerequisite for all five actions.
**Warning signs:** If you see toasts rendering with red/amber borders for success messages.

### Pitfall 2: Compare Button Showing Wrong Limit
**What goes wrong:** REQUIREMENTS.md says 2-5 but CONTEXT.md D-08/D-09 locks to 2-3. The existing BulkActionBar shell tooltip says "select 2-5 screenplays". The comparisonStore has MAX_COMPARISON_ITEMS = 3.
**Why it happens:** Requirements were written before the discussion narrowed the range.
**How to avoid:** Use the CONTEXT.md decisions (2-3). Update tooltip to "Select 2-3 to compare". Compare button disabled when `count < 2 || count > 3`.
**Warning signs:** Button tooltip text says "2-5" instead of "2-3".

### Pitfall 3: Category Update Not Persisting to Firestore
**What goes wrong:** Category is set on the raw analysis JSON `collection` field (see `analysisService.ts:103`). If you only update the React Query cache or Zustand state, the change won't survive a page refresh because `loadAllAnalyses()` reads from localStorage/Firestore.
**Why it happens:** No `patchAnalysisField()` function exists in analysisStore.ts. The store has `saveAnalysis()` (full document write) and `updateDoc()` (used for soft-delete fields), but no generic field-patch utility.
**How to avoid:** Create a `patchAnalysisField(sourceFile, field, value)` function in analysisStore.ts that: (1) patches the field in localStorage immediately, (2) patches via `updateDoc()` in Firestore (non-blocking, never throws), and (3) the caller invalidates the React Query `SCREENPLAYS_QUERY_KEY` to refresh the UI.
**Warning signs:** Category appears to change but reverts after page refresh.

### Pitfall 4: PDF Generation Blocking the UI
**What goes wrong:** `pdf(<PdfDocument />).toBlob()` is CPU-intensive. Running 20+ in a tight loop freezes the browser.
**Why it happens:** @react-pdf/renderer runs layout + rendering synchronously on the main thread.
**How to avoid:** The `await` on each `toBlob()` already yields to the event loop between iterations (since it returns a Promise). The inline progress indicator (D-13) gives users feedback. For very large batches (50+), consider adding a small `await new Promise(r => setTimeout(r, 0))` between iterations to ensure UI updates.
**Warning signs:** Progress indicator doesn't update between PDFs; browser shows "page unresponsive" dialog.

### Pitfall 5: BulkActionBar z-index Conflict with Modals
**What goes wrong:** Modals use z-50 (confirmed in ExportModal, ComparisonModal). BulkActionBar uses z-40 (confirmed in BulkActionBar.tsx). If a modal is opened by the bar, the bar should remain visible behind it.
**Why it happens:** D-06 is explicit about this. No special logic needed -- z-index layering handles it automatically.
**How to avoid:** Don't add hide/show logic for the bar when modals open. Just keep existing z-index values.
**Warning signs:** Bar disappears when SetCategoryModal or AddToFavoritesModal opens.

### Pitfall 6: Set<string> to Array Conversion for Store Calls
**What goes wrong:** `selectionStore.selectedIds` is a `Set<string>`. Most consuming functions expect `string[]` or iterate individually. Forgetting to convert causes type errors.
**Why it happens:** Selection store uses Set for O(1) lookups, but other stores/functions use arrays.
**How to avoid:** Always `Array.from(selectedIds)` or spread `[...selectedIds]` before passing to comparison, export, or favorites functions.
**Warning signs:** TypeScript errors about Set not being assignable to string[].

### Pitfall 7: Button Label Changes Affecting Tests
**What goes wrong:** Existing BulkActionBar.test.tsx checks for exact button labels like "Collection" and "Favorites". Renaming "Collection" to "Set Category" per D-01 will break the test.
**Why it happens:** Tests reference exact text content.
**How to avoid:** Update the test expectations when renaming the button. The test at line 104 checks for `'Collection'` -- change to `'Set Category'`.
**Warning signs:** Test suite fails with "Unable to find an element with the text: Collection".

## Code Examples

### Resolving Selected IDs to Screenplay Objects
```typescript
// Pattern used throughout: read selection IDs + filter from allScreenplays
// Source: existing pattern in ComparisonModal.tsx line 26
const { data: allScreenplays } = useScreenplays();
const selectedIds = useSelectionStore((s) => s.selectedIds);

const selectedScreenplays = useMemo(() => {
  if (!allScreenplays) return [];
  return allScreenplays.filter(sp => selectedIds.has(sp.id));
}, [allScreenplays, selectedIds]);
```

### JSZip: Create Zip from Blobs
```typescript
// Source: JSZip official docs (https://stuk.github.io/jszip/)
const JSZip = (await import('jszip')).default;
const zip = new JSZip();

// Add files
zip.file('filename.pdf', blob); // blob is a Blob object

// Generate zip
const zipBlob = await zip.generateAsync({ type: 'blob' });

// Trigger download
const url = URL.createObjectURL(zipBlob);
const link = document.createElement('a');
link.href = url;
link.download = `screenplays-export-${new Date().toISOString().split('T')[0]}.zip`;
document.body.appendChild(link);
link.click();
document.body.removeChild(link);
URL.revokeObjectURL(url);
```

### patchAnalysisField Pattern (New Function for analysisStore.ts)
```typescript
// Follows the dual-write pattern established by softDeleteAnalysis:
// 1. Patch localStorage immediately (instant)
// 2. Patch Firestore (non-blocking, never throws)
export async function patchAnalysisField(
  sourceFile: string,
  field: string,
  value: unknown
): Promise<void> {
  // Step 1: Patch in localStorage
  const existing = readFromLocal();
  const updated = existing.map((a) =>
    a.source_file === sourceFile ? { ...a, [field]: value } : a
  );
  writeToLocal(updated);

  // Step 2: Patch in Firestore (non-blocking)
  const docId = toDocId(sourceFile);
  try {
    await authReady;
    await updateDoc(doc(db, FIRESTORE_COLLECTION, docId), { [field]: value });
  } catch (err) {
    console.warn(`[Lemon] Firestore patch failed for ${docId}.${field}:`, err);
  }
}
```

### Adding 'success' Severity to Toast Store
```typescript
// Current: export type ToastSeverity = 'error' | 'warning';
// Changed: export type ToastSeverity = 'error' | 'warning' | 'success';

// In ToastContainer.tsx, add to border color mapping:
const borderColor =
  toast.severity === 'success'
    ? 'border-l-emerald-500'
    : toast.severity === 'warning'
      ? 'border-l-amber-500'
      : 'border-l-red-500';
```

### Compare Button Conditional Disable
```typescript
// Compare button: enabled only for 2-3 selections
const count = useSelectionCount();
const compareDisabled = count < 2 || count > 3;
const compareTooltip = compareDisabled ? 'Select 2-3 to compare' : 'Compare selected screenplays';

<button
  disabled={compareDisabled}
  title={compareTooltip}
  onClick={handleCompare}
  className="btn btn-ghost text-sm disabled:opacity-40 disabled:cursor-not-allowed"
>
  Compare
</button>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multiple individual PDF downloads | Zip bundle via JSZip | Industry standard | One download instead of N browser prompts |
| @react-pdf/renderer v3 | @react-pdf/renderer 4.3.2 | 2024+ | pdf().toBlob() API stable, same usage |
| JSZip 3.7 | JSZip 3.10.1 | 2023 | Minor fixes, same API surface |

**Deprecated/outdated:**
- None relevant -- all APIs used in this phase are current and stable.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (latest, via vite.config.ts) |
| Config file | vite.config.ts (test section) |
| Quick run command | `npm run test:run` |
| Full suite command | `npm run test:run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BULK-04 | CSV export button calls exportToCSV with selected screenplays | unit | `npx vitest run src/components/screenplay/BulkActionBar.test.tsx -t "Export CSV"` | Needs update (button currently disabled in test) |
| BULK-05 | PDF export generates zip with progress indicator | unit | `npx vitest run src/components/export/bulkPdfExport.test.ts` | Wave 0 |
| BULK-06 | Compare button disabled for <2 or >3, calls openComparison for 2-3 | unit | `npx vitest run src/components/screenplay/BulkActionBar.test.tsx -t "Compare"` | Needs update |
| BULK-08 | Set Category modal applies category to all selected | unit | `npx vitest run src/components/bulk/SetCategoryModal.test.tsx` | Wave 0 |
| BULK-09 | Add to Favorites modal adds selected to chosen list | unit | `npx vitest run src/components/bulk/AddToFavoritesModal.test.tsx` | Wave 0 |
| prereq | Toast store supports 'success' severity | unit | `npx vitest run src/stores/toastStore.test.ts -t "success"` | Needs update |
| prereq | patchAnalysisField updates localStorage and Firestore | unit | `npx vitest run src/lib/analysisStore.test.ts -t "patchAnalysisField"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:run`
- **Per wave merge:** `npm run test:run && npm run build`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/export/bulkPdfExport.test.ts` -- covers BULK-05 (JSZip mock + progress)
- [ ] `src/components/bulk/SetCategoryModal.test.tsx` -- covers BULK-08
- [ ] `src/components/bulk/AddToFavoritesModal.test.tsx` -- covers BULK-09
- [ ] Update `src/components/screenplay/BulkActionBar.test.tsx` -- update for wired buttons (BULK-04, BULK-06)
- [ ] Update `src/stores/toastStore.test.ts` -- add success severity test
- [ ] Add `src/lib/analysisStore.test.ts` case for `patchAnalysisField` -- covers BULK-08 persistence

## Open Questions

1. **AddToFavoritesModal: List picker vs quick-add?**
   - What we know: favoritesStore has both named lists (`addToList(listId, screenplayId)`) and quick favorites (`toggleQuickFavorite(screenplayId)`). The CONTEXT.md says "show existing lists with radio/checkbox selection" in Specific Ideas.
   - What's unclear: If user has no lists, should we show "Quick Favorites" as the only option, or show empty state with "Create list in Settings"?
   - Recommendation: Show Quick Favorites as default option always, plus any user-created lists. If no user lists exist, the modal just has the Quick Favorites toggle. This avoids empty states.

2. **Category field name in raw analysis JSON**
   - What we know: `analysisService.ts:103` sets `raw.collection = category`. The normalize function calls `collectionToCategoryId(collection)` to derive the `category` field on the Screenplay type. So the raw JSON field is `collection`, but the display concept is "category."
   - What's unclear: Should `patchAnalysisField` update the raw `collection` field (which gets mapped to `category` during normalization)?
   - Recommendation: Yes, patch the `collection` field on the raw JSON. When React Query refetches/re-normalizes, the `category` field will be correctly derived. This maintains the existing data flow.

3. **Bulk PDF: Which PDF template?**
   - What we know: Two PDF templates exist -- `PdfDocument.tsx` (pitch deck, 3 pages) and `CoverageDocument.tsx` (coverage report with notes). ExportModal uses PdfDocument.
   - What's unclear: CONTEXT.md says "individual PDF files per screenplay" but doesn't specify which template.
   - Recommendation: Use PdfDocument (pitch deck) to match the existing ExportModal behavior. The CoverageDocument includes producer notes which may be sensitive for bulk sharing.

## Sources

### Primary (HIGH confidence)
- Project source code -- direct reads of selectionStore.ts, BulkActionBar.tsx, csvExport.ts, PdfDocument.tsx, comparisonStore.ts, favoritesStore.ts, toastStore.ts, ToastContainer.tsx, analysisStore.ts, exportCoverage.tsx, ExportModal.tsx, useCategories.ts, useScreenplays.ts, normalize.ts
- npm registry -- `npm view jszip version` confirmed 3.10.1 with bundled TypeScript types
- npm registry -- `npm ls @react-pdf/renderer` confirmed 4.3.2 installed

### Secondary (MEDIUM confidence)
- JSZip API -- `zip.file()`, `zip.generateAsync({ type: 'blob' })` per official docs at stuk.github.io/jszip
- @react-pdf/renderer `pdf().toBlob()` -- confirmed working in ExportModal.tsx and exportCoverage.tsx

### Tertiary (LOW confidence)
- None -- all findings verified against source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed except JSZip (verified on npm registry)
- Architecture: HIGH -- all integration points read from source code, patterns established
- Pitfalls: HIGH -- toast severity gap, category persistence gap, and test breakage all verified by reading actual code
- Validation: HIGH -- existing test structure inspected, gap analysis based on actual test files

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable dependencies, no fast-moving APIs)
