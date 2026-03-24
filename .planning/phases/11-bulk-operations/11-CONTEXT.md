# Phase 11: Bulk Operations - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Three bulk actions using the existing gold-checkbox selection (exportSelectionStore):
- **BULK-01**: Bulk share token generation — generate share URLs for N selected screenplays
- **BULK-02**: Bulk re-analysis — re-run AI analysis for N selected screenplays via Firebase Storage download
- **BULK-03**: CSV export scope confirmation — make the Export modal clearly communicate what's being exported before download

</domain>

<decisions>
## Implementation Decisions

### Bulk Action Trigger Location (BULK-01, BULK-02)
- Both bulk actions live in a single **"Actions" dropdown** in FilterBar, alongside the existing Export button
- Dropdown contains: "Generate Share Links", "Re-analyze Selected"
- "Re-analyze Selected" is **disabled** if no selected screenplay has `hasPdf=true`, with a tooltip explaining why

### Bulk Share Results UI (BULK-01)
- After triggering "Generate Share Links", a **dedicated modal** opens immediately
- Modal shows all selected screenplay titles upfront as rows
- **Progressive fill**: each row shows a spinner until its token resolves, then displays the URL with an individual copy button
- Producer can copy completed rows while others are still generating
- Existing tokens are reused silently — no visual distinction between new vs reused tokens (URL is what matters)
- **Copy All** button at the top produces a plain newline-separated list of URLs (no titles, no markdown)
- Failed rows show in red with a **per-row Retry button** — Retry button remains indefinitely if retries continue to fail
- Token generation is **sequential** (not `Promise.all`) — roadmap constraint, locked

### Bulk Re-analyze Progress (BULK-02)
- A **dedicated modal** opens showing the full queue with per-item status (queued / analyzing / done / failed)
- Progress header: "Re-analyzing N of M..." updates as each completes
- **Ineligible items** (no `hasPdf=true`): auto-skipped silently; modal header notes "X of Y selected are eligible. Processing X..."
- **Cancel button** available during processing — cancels after the current in-flight item finishes (no mid-analysis abort)
- **Modal blocks** until done or cancelled — no background processing, no minimize
- After completion (or cancel): React Query cache is **invalidated in batch** when modal closes, updating version badges in the grid
- Close button becomes available at completion/cancel — also **deselects all checkboxes** (exportSelectionStore.deselectAll)
- **No retry path in modal** — failed items close and requeue (producer selects them again)
- BULK-02 eligible screenplays: `hasPdf=true` only — roadmap constraint, locked
- Re-analysis flow: `getDownloadURL` → `fetch` → `File` → `analyzeScreenplay` — roadmap constraint, locked

### Failure Handling
- **BULK-01 failures**: continue generating remaining tokens; failed rows show in red with per-row Retry button; Retry button remains if retry also fails
- **BULK-02 failures**: retry once automatically (handles transient network errors); if retry also fails, mark row as failed and continue batch; final summary shows "X completed, Y failed [titles]"
- **BULK-02 cancellation**: finishes the currently-running analysis, then stops — "Cancelled — X completed before cancellation"

### CSV Export Scope Confirmation (BULK-03)
- Export modal header updated to show scope in all modes:
  - Selected: **"Exporting X selected screenplays"**
  - Filtered (with active filters): **"Exporting X filtered screenplays"**
  - All (no selection, no filters): **"Exporting all X screenplays"**
- Count applies to **all formats** (CSV and PDF) — not CSV-only
- Count in header is **static** — does not change based on format selector
- **Export button** shows count: "Export 7 Screenplays" (not just "Export")
- This is a **text/UI fix** — FilterBar already passes the correct screenplay array to ExportModal; no data path changes needed
- Default behavior with no selection: exports current filtered grid (unchanged)

### Claude's Discretion
- Actions dropdown component implementation (positioning, animation, trigger button styling)
- Exact modal layout and visual design for share results and re-analyze progress modals (consistent with existing modal patterns)
- Share results modal: whether to show a "Generating..." count indicator in the header while tokens are resolving
- Re-analyze modal: exact per-item status row design (icon, label, timestamp)
- Whether to add `'selected'` as a new mode value to ExportModal's mode prop or derive count from `screenplays.length`

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `exportSelectionStore.ts`: `selectedIds`, `toggle`, `selectAll`, `deselectAll` — the existing gold-checkbox selection mechanism; this is what all bulk actions operate on
- `shareStore.ts`: `tokens` record (keyed by screenplayId), `setToken`, `removeToken` — session cache for share tokens; bulk share should populate this as tokens are generated
- `shareService.ts`: `createShareToken`, `getExistingShareToken` — the per-screenplay functions bulk share will call sequentially
- `ExportModal.tsx`: receives `mode: 'single' | 'multiple' | 'filtered'` + `screenplays: Screenplay[]` — needs text/count updates for BULK-03
- `FilterBar.tsx`: already imports `useExportSelectionStore` and `useExportSelectionCount`; passes `exportSelectedIds` to ExportModal; new Actions dropdown mounts here
- `toastStore.ts`: toast system for error/success feedback

### Established Patterns
- Ephemeral Zustand stores for session-only state (shareStore, syncStatusStore, toastStore — no persist middleware)
- Sequential Firestore operations with `authReady` gate before all writes
- Dedicated modals for multi-step or result-displaying flows (ShareModal, ExportModal precedent)
- React Query cache invalidation via `queryClient.invalidateQueries` for post-write data refresh

### Integration Points
- `FilterBar.tsx` — mount the new Actions dropdown alongside Export button
- `ExportModal.tsx` — update mode label and button text for BULK-03
- New `BulkShareModal.tsx` — share link generation results (progressive fill)
- New `BulkReanalyzeModal.tsx` — re-analysis progress queue
- `src/lib/shareService.ts` — called per-item in BulkShareModal
- `src/lib/analysisService.ts` (or equivalent) — called per-item in BulkReanalyzeModal

</code_context>

<specifics>
## Specific Ideas

- Success criteria from requirements: "Select 5 screenplays → 'Generate Share Links' → 5 URLs in modal, individually copyable + Copy All"
- Success criteria from requirements: "Select 3 legacy screenplays → 'Re-analyze Selected' → 'Re-analyzing 1 of 3...' progress → version badges update"
- Success criteria from requirements: "Export modal states 'Exporting X selected screenplays (CSV)' before download"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-bulk-operations*
*Context gathered: 2026-03-19*
