# Phase 5: Bulk PDF Upload Modal - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the streamlined bulk PDF upload experience — a modal triggered from the BulkActionBar's "Upload PDFs" button. Shows only selected screenplays missing PDFs, with one upload row per title and a top-level batch drop zone. Upload immediately on drop, with auto-retry and per-row error handling. Stays open with success summary until dismissed.

</domain>

<decisions>
## Implementation Decisions

### Row layout and interaction
- **D-01:** Compact row layout — title + category tag on left, Browse button on right, ~40px per row
- **D-02:** Entire row is a drag-and-drop target — dropping a PDF on the row starts upload for that screenplay
- **D-03:** Top-level batch drop zone above the row list — accepts multiple PDF files, auto-matches by filename similarity to screenplay titles. Unmatched files show an error
- **D-04:** Upload starts immediately on drop/file-select — no queue step, no "Upload All" button. Per-row progress in real time
- **D-05:** PDF only — reject non-PDF files with inline error flash ("PDF files only"), then return to empty state
- **D-06:** 50MB file size limit — reject oversized files before upload starts with inline message ("File too large — max 50MB")

### Error handling and retry
- **D-07:** Auto-retry once on upload failure. If second attempt fails, show error state with per-row Retry button
- **D-08:** Per-row retry only — no "Retry All Failed" batch button
- **D-09:** Successful uploads persist on modal close — closing saves completed uploads. Re-opening modal shows only still-missing PDFs (failed rows reappear as needing upload)

### Success summary
- **D-10:** In-place row updates — completed rows show green checkmark and "Uploaded" state. Failed rows show red error with Retry button. Summary bar at top updates live: "Uploaded 2 of 3 — 1 remaining" → "✓ 3 of 3 PDFs uploaded successfully"
- **D-11:** Done button always available — user can close at any time, even with failures outstanding
- **D-12:** No toast after closing — the modal already showed the results, no redundant toast

### Edge cases
- **D-13:** Modal shows only missing-PDF screenplays from selection (per Phase 3 D-02). Already-attached count shown in info note: "2 of 5 selected screenplays already have PDFs attached"
- **D-14:** Replacement/versioning is out of scope — this modal is for missing PDFs only. Replacing an existing PDF is a different workflow
- **D-15:** Stray drops (outside any dropzone but inside modal) show gentle hint: "Drop on a specific title". Multiple files on a single dropzone rejected: "One file per title"
- **D-16:** Long filenames use middle truncation — e.g., "El_Godin_de_los...V4_FINAL.pdf" — preserves title start and version number at end

### Claude's Discretion
- Filename similarity matching algorithm for batch drop (Levenshtein, substring, etc.)
- Exact compact row height and spacing
- Browse button vs icon-only for the row upload trigger
- Upload progress indicator per row (spinner, progress bar, shimmer)
- Animation/transition for row state changes (pending → uploading → success/error)
- Error message wording for edge cases
- Whether batch drop zone appears as a prominent area or subtle header region

</decisions>

<canonical_refs>
## Canonical References

### Phase 3 decisions (prerequisites)
- `.planning/phases/03-selection-mode-foundation/03-CONTEXT.md` — D-01 through D-04 define the BulkPdfUploadModal concept, missing-PDF filter, success summary, and per-title dropzones

### Phase 4 outputs (integration point)
- `.planning/phases/04-bulk-action-integrations/04-CONTEXT.md` — Upload PDFs button wiring pattern, BulkActionBar integration

### Requirements
- `.planning/REQUIREMENTS.md` — BULK-07 (upload via streamlined modal with one dropzone per title), BULK-12 (missing-PDF filter + success summary)

### Existing upload infrastructure
- `src/lib/firebase.ts` — `uploadScreenplayPdf(file, category, title)` returns download URL
- `src/components/settings/pdfUploadPanel.helpers.ts` — `buildStoragePath(screenplay)` for storage path generation
- `src/stores/pdfStatusStore.ts` — Live PDF status tracking (checking/found/missing)

</canonical_refs>

<specifics>
## Specific Ideas

- The modal follows the same glass/gold styling pattern as SetCategoryModal and AddToFavoritesModal (z-50, backdrop blur, gold border, animate-scale-in)
- Compact rows should feel like a clean file manager — minimal chrome, clear status per row
- The top-level batch drop zone is a convenience shortcut for power users who prepare filenames in advance — it's not the primary workflow. Per-title dropzones are the primary interaction
- Middle truncation for filenames matters because screenplay files often follow the pattern `Title_Rewrite_V4_FINAL_LOCKED.pdf` where the version info at the end is critical

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/firebase.ts` → `uploadScreenplayPdf(file, category, title)` — Core upload function, returns download URL. Sanitizes filenames, sets metadata
- `src/components/settings/pdfUploadPanel.helpers.ts` → `buildStoragePath(screenplay)` — Generates `screenplays/{CATEGORY}/{TITLE}.pdf` storage path
- `src/stores/pdfStatusStore.ts` — `setStatus(id, 'found')` to update after successful upload, `setBulkStatuses()` for batch updates
- `src/stores/selectionStore.ts` — `selectedIds` Set for getting current selection
- `src/hooks/useScreenplays.ts` — `useScreenplays()` to resolve selected IDs to full Screenplay objects with `hasPdf` field
- `src/stores/toastStore.ts` — Available if toast feedback needed elsewhere (not for modal close per D-12)
- `src/components/settings/PdfUploadPanel.tsx` — Reference for upload logic patterns (`doUpload`, `checkStoragePaths`, `matchScore` for filename matching)

### Established Patterns
- Modal structure: fixed z-50 overlay, backdrop blur, glass container, gold border, animate-scale-in (SetCategoryModal, AddToFavoritesModal)
- Zustand stores per domain — upload state can be local component state (modal is ephemeral)
- Firebase Storage paths: `screenplays/{CATEGORY}/{SAFE_TITLE}.pdf` via `buildStoragePath`
- Post-upload: update `hasPdf` field via `patchAnalysisField(id, { hasPdf: true })` + update `pdfStatusStore`

### Integration Points
- `BulkActionBar.tsx` — "Upload PDFs" button (currently disabled with "Coming soon" title). Wire to open BulkPdfUploadModal
- `selectionStore` → `useScreenplays()` data → filter to missing-PDF screenplays for modal content
- `pdfStatusStore` — Check `statuses[id]` for live PDF status. After upload, call `setStatus(id, 'found')`
- `patchAnalysisField` utility — Update Firestore `hasPdf` field after successful upload

</code_context>

<deferred>
## Deferred Ideas

- PDF replacement/versioning — Replace existing PDF from screenplay detail modal, not from bulk upload — separate feature
- FDX / Fountain / TXT file support — Current pipeline is PDF-only; supporting other formats would need storage path and download button changes — backlog
- Batch retry ("Retry All Failed") — Per-row retry is sufficient; batch retry adds UI complexity for marginal benefit — revisit if user feedback demands it
- Bulk share token management (BULK-E1) — Generate share links for N screenplays at once — backlog

</deferred>

---

*Phase: 05-bulk-pdf-upload-modal*
*Context gathered: 2026-03-24*
