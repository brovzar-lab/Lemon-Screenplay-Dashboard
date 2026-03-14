# Phase 7: Export Coverage Package - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Producer can download a formatted single-screenplay coverage PDF from the detail modal. The PDF contains the full analysis, scores, producer notes, poster image, and Lemon Studios branding. Client-side generation via `@react-pdf/renderer` — no server round-trip. Original screenplay PDF bundling is deferred.

</domain>

<decisions>
## Implementation Decisions

### PDF content & layout
- **Full analysis** — logline, synopsis, all dimension scores with score bars, strengths, weaknesses, recommendation, comparable films, characters, and producer notes
- **Poster image** as cover page or hero image at the top
- **Producer notes always included** — no toggle (this is a document the producer generates). Section omitted entirely if no notes exist (no empty placeholder needed).
- **Score bars with numbers** — colored bars showing each dimension score with numeric values (visual + informative)

### Branding & design
- **Branded document** — Lemon Studios logo on cover page, header/footer on each page, page numbers
- **Light/print-friendly color scheme** — white background, dark text, gold accents for branding. Better for printing, saves ink, more traditional coverage document
- **Confidentiality notice** — subtle footer text: "Confidential — For Lemon Studios internal use" on each page
- No AI attribution (consistent with Phase 6 decision)

### Trigger & filename
- **Download button in the screenplay detail modal** — alongside the Share button in the action bar
- **Filename format**: `{Title}-Coverage.pdf` (e.g., `The-Last-Summer-Coverage.pdf`) — title only, no ID suffix

### Claude's Discretion
- PDF page layout details (margins, font sizes, section spacing)
- Score bar rendering in @react-pdf/renderer (SVG rectangles or View-based bars)
- Loading state while PDF generates (spinner on button, or progress indicator)
- Whether to show the existing ExportModal's PDF option or keep them separate

</decisions>

<specifics>
## Specific Ideas

- `@react-pdf/renderer` is already in the project — used for existing PDF export functionality
- The existing `PdfDocument` component in `src/components/export/` is for batch/multi-screenplay export — this is a different single-screenplay coverage document
- Lemon Studios logo at `public/lemon-logo-black.png` (for light background PDF)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@react-pdf/renderer` — already installed and configured
- `src/components/export/PdfDocument.tsx` — existing PDF template (batch export, different format but shows patterns)
- `public/lemon-logo-black.png` — black logo for light PDF background
- `src/types/screenplay.ts` — full Screenplay type with all analysis fields
- `src/lib/calculations.ts` — dimension display helpers, score formatting

### Established Patterns
- PDF generation via `@react-pdf/renderer` with `pdf().toBlob()` + `file-saver` or blob URL download
- Lazy-loaded PDF components for code splitting
- Premium gold accents via CSS variables (translate to @react-pdf/renderer StyleSheet)

### Integration Points
- `src/components/screenplay/modal/ModalHeader.tsx` — Add "Download Coverage" button alongside Share
- New `src/components/export/CoveragePackageDocument.tsx` — @react-pdf/renderer document template
- New `src/lib/exportPackageService.ts` — orchestrate PDF generation and download

</code_context>

<deferred>
## Deferred Ideas

- SHARE-06: ZIP bundle with coverage PDF + original screenplay PDF — v2 requirement
- Batch coverage PDF export (multiple screenplays in one document) — future enhancement

</deferred>

---

*Phase: 07-export-coverage-package*
*Context gathered: 2026-03-14*
