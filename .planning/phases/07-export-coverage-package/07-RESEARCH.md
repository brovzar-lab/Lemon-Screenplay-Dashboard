# Phase 7: Export Coverage Package - Research

**Researched:** 2026-03-14
**Domain:** Client-side PDF generation with @react-pdf/renderer
**Confidence:** HIGH

## Summary

This phase adds a single-screenplay "Download Coverage PDF" button to the detail modal. The project already has `@react-pdf/renderer` v4.3.2 installed and working (see `ExportModal.tsx` + `PdfDocument.tsx`), so the core technology risk is zero. The new document is a different layout (branded coverage report vs. dark-themed pitch deck) but uses identical rendering primitives.

The main work is: (1) a new `CoverageDocument.tsx` component with light/print-friendly styling, logo Image, poster Image, and all analysis sections; (2) an `exportCoverage.ts` service function that generates the blob and triggers download; (3) a "Download Coverage" button in `ModalHeader.tsx`; (4) pulling producer notes from `useNotesStore.getState()` (non-reactive, snapshot at generation time).

**Primary recommendation:** Build a new `CoverageDocument` component (do NOT modify the existing `PdfDocument`) with light theme styling, and a thin `exportCoverage()` function that calls `pdf(<CoverageDocument />).toBlob()` then triggers download via blob URL -- same pattern as `ExportModal.tsx` line 49.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Full analysis** -- logline, synopsis, all dimension scores with score bars, strengths, weaknesses, recommendation, comparable films, characters, and producer notes
- **Poster image** as cover page or hero image at the top
- **Producer notes always included** -- no toggle (this is a document the producer generates)
- **Score bars with numbers** -- colored bars showing each dimension score with numeric values (visual + informative)
- **Branded document** -- Lemon Studios logo on cover page, header/footer on each page, page numbers
- **Light/print-friendly color scheme** -- white background, dark text, gold accents for branding
- **Confidentiality notice** -- subtle footer text: "Confidential -- For Lemon Studios internal use" on each page
- No AI attribution (consistent with Phase 6 decision)
- **Download button in the screenplay detail modal** -- alongside the Share button in the action bar
- **Filename format**: `{Title}-Coverage.pdf` (e.g., `The-Last-Summer-Coverage.pdf`) -- title only, no ID suffix

### Claude's Discretion
- PDF page layout details (margins, font sizes, section spacing)
- Score bar rendering in @react-pdf/renderer (SVG rectangles or View-based bars)
- Loading state while PDF generates (spinner on button, or progress indicator)
- Whether to show the existing ExportModal's PDF option or keep them separate

### Deferred Ideas (OUT OF SCOPE)
- SHARE-06: ZIP bundle with coverage PDF + original screenplay PDF -- v2 requirement
- Batch coverage PDF export (multiple screenplays in one document) -- future enhancement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXPORT-01 | User can download a single-screenplay coverage PDF with logline, synopsis, scores, producer notes, and recommendation | Full coverage: existing @react-pdf/renderer infrastructure, `pdf().toBlob()` download pattern proven in ExportModal, notes from notesStore, all screenplay fields available on Screenplay type |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @react-pdf/renderer | ^4.3.2 | PDF generation (Document, Page, View, Text, Image, StyleSheet) | Already installed and proven in project |
| zustand | 5 | Access notesStore for producer notes at generation time | Already the project's state management |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx | (installed) | Conditional class composition on the Download button | Button states (loading, idle) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| View-based score bars | SVG rectangles via `<Svg>` | View-based bars are simpler, match existing PdfDocument pattern (lines 128-138), and work reliably. Use Views. |
| file-saver | Blob URL + anchor click | file-saver is NOT installed. The existing ExportModal uses blob URL pattern (lines 52-59). Use the same pattern. No new dependency. |

**Installation:**
```bash
# No new dependencies needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── export/
│   │   ├── CoverageDocument.tsx       # NEW: @react-pdf/renderer Document for coverage PDF
│   │   ├── exportCoverage.ts          # NEW: generate blob + trigger download
│   │   ├── index.ts                   # Updated: add new exports
│   │   ├── PdfDocument.tsx            # UNCHANGED: existing pitch deck PDF
│   │   ├── ExportModal.tsx            # UNCHANGED
│   │   └── csvExport.ts              # UNCHANGED
│   ├── screenplay/
│   │   └── modal/
│   │       └── ModalHeader.tsx        # MODIFIED: add "Download Coverage" button
```

### Pattern 1: PDF Generation + Download (Existing Pattern)
**What:** Generate a PDF blob client-side and trigger browser download via temporary anchor element
**When to use:** Every time the user clicks "Download Coverage"
**Example:**
```typescript
// Source: ExportModal.tsx lines 47-59 (verified in codebase)
import { pdf } from '@react-pdf/renderer';

async function downloadCoverage(screenplay: Screenplay, notes: Note[]): Promise<void> {
  const blob = await pdf(<CoverageDocument screenplay={screenplay} notes={notes} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${screenplay.title.replace(/\s+/g, '-')}-Coverage.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

### Pattern 2: Accessing Notes Outside React (Zustand getState)
**What:** Read notes at PDF generation time without hooks
**When to use:** The exportCoverage function runs outside component render
**Example:**
```typescript
// Source: notesStore.ts -- getNotesForScreenplay method
import { useNotesStore } from '@/stores/notesStore';

const notes = useNotesStore.getState().getNotesForScreenplay(screenplay.id);
```

### Pattern 3: Image in @react-pdf/renderer
**What:** Use the `Image` component for logo and poster
**When to use:** Cover page logo and poster hero image
**Example:**
```typescript
// Source: react-pdf.org/components
import { Image } from '@react-pdf/renderer';

// For local asset (logo):
<Image src="/lemon-logo-black.png" style={{ width: 120 }} />

// For remote URL (poster):
{screenplay.posterUrl && (
  <Image src={screenplay.posterUrl} style={{ width: 200, height: 300 }} />
)}
```

### Pattern 4: Light Theme StyleSheet
**What:** White background, dark text, gold accents -- inverted from existing PdfDocument dark theme
**When to use:** The entire CoverageDocument
**Key colors:**
```typescript
// Print-friendly palette (contrast with existing PdfDocument dark theme)
const COLORS = {
  background: '#FFFFFF',
  text: '#1A1A2E',        // Near-black for body text
  textSecondary: '#4A4A5A', // Gray for labels
  gold: '#B8860B',         // Dark gold (prints well)
  goldLight: '#FFF8DC',    // Cornsilk for subtle section backgrounds
  scoreGreen: '#16A34A',   // Green for high scores
  scoreAmber: '#D97706',   // Amber for mid scores
  scoreRed: '#DC2626',     // Red for low scores
  border: '#E5E7EB',       // Light gray borders
  footerText: '#9CA3AF',   // Muted footer
};
```

### Anti-Patterns to Avoid
- **Modifying PdfDocument.tsx:** The existing component is for batch pitch deck export with dark theme. Do NOT modify it -- create a separate CoverageDocument.
- **Using React hooks inside exportCoverage service:** The download function runs imperatively. Use `useNotesStore.getState()` not `useScreenplayNotes()`.
- **Hardcoding poster URLs:** Poster may be undefined/null. Always guard with conditional rendering.
- **Using `window.location.origin` for Image src:** Use absolute paths for local assets (`/lemon-logo-black.png`), which @react-pdf/renderer resolves relative to the document origin.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Canvas/jsPDF manual rendering | `@react-pdf/renderer` `pdf().toBlob()` | Already installed, JSX-based, handles pagination |
| File download | Manual fetch + stream | Blob URL + anchor click pattern | Proven in ExportModal, handles all browsers |
| Score color logic | New color function | Reuse `getScoreColor()` from PdfDocument.tsx (or extract) | Already handles the 3-tier (green/amber/red) logic |
| Dimension display | Manual field mapping | `getDimensionDisplay()` from dimensionDisplay.ts | Handles V5 vs V6 analysis versions automatically |

**Key insight:** The existing codebase already has every utility needed. The only net-new code is the CoverageDocument layout component and the download trigger function.

## Common Pitfalls

### Pitfall 1: CORS on Poster Images
**What goes wrong:** `@react-pdf/renderer` Image component fails silently or throws when loading cross-origin images (Firebase Storage URLs)
**Why it happens:** Firebase Storage download URLs are cross-origin. Browser PDF generation fetches the image.
**How to avoid:** Wrap poster Image in a try-catch-equivalent: use conditional rendering and accept graceful degradation if poster fails to load. The `@react-pdf/renderer` Image component handles CORS internally for most cases with Firebase Storage URLs since they include access tokens, but test with a real screenplay.
**Warning signs:** PDF generation hangs or throws with no visible error.

### Pitfall 2: Title Sanitization for Filename
**What goes wrong:** Filenames with special characters (`/`, `?`, `"`, etc.) break download on some OS
**Why it happens:** Screenplay titles may contain any characters
**How to avoid:** Replace spaces with hyphens, strip non-alphanumeric characters (except hyphens), trim edges. The existing ExportModal uses `replace(/\s+/g, '_')` but CONTEXT.md specifies hyphen format: `The-Last-Summer-Coverage.pdf`.
**Warning signs:** File doesn't download or has mangled name.

### Pitfall 3: Page Overflow with Long Content
**What goes wrong:** Long synopses, many strengths/weaknesses, or many notes push content off the page without proper pagination
**Why it happens:** @react-pdf/renderer requires explicit `wrap` prop or page break management
**How to avoid:** Set `wrap={true}` (default) on View containers. Use `break` prop on sections that should start on a new page. Test with a screenplay that has extensive notes.
**Warning signs:** Content visually cut off at page bottom.

### Pitfall 4: Notes Empty State
**What goes wrong:** Notes section renders empty when producer hasn't written any notes
**Why it happens:** Notes are optional; many screenplays may have zero notes
**How to avoid:** Conditionally render the notes section -- skip it entirely if `notes.length === 0`.
**Warning signs:** Empty "Producer Notes" section header with no content below it.

### Pitfall 5: Existing PdfDocument vs CoverageDocument Confusion
**What goes wrong:** User or developer confuses the two PDF export paths
**Why it happens:** ExportModal already has a "PDF Pitch Deck" option
**How to avoid:** Keep them separate. The "Download Coverage" button in ModalHeader generates the coverage PDF directly (no modal). ExportModal remains for batch operations.
**Warning signs:** Users see two PDF buttons doing similar things without understanding the difference.

## Code Examples

### CoverageDocument Component Structure
```typescript
// New file: src/components/export/CoverageDocument.tsx
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { Screenplay } from '@/types';
import type { Note } from '@/types';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';

interface CoverageDocumentProps {
  screenplay: Screenplay;
  notes: Note[];
}

// Light theme styles
const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
    color: '#1A1A2E',
    fontSize: 10,
  },
  // ... full styles defined during implementation
});

export function CoverageDocument({ screenplay, notes }: CoverageDocumentProps) {
  return (
    <Document>
      {/* Cover Page: Logo, poster, title, recommendation */}
      <Page size="A4" style={styles.page}>
        <Image src="/lemon-logo-black.png" style={{ width: 100 }} />
        {/* ... cover content */}
      </Page>

      {/* Analysis Pages: Scores, strengths/weaknesses, comparable films */}
      <Page size="A4" style={styles.page}>
        {/* dimension scores with score bars */}
        {/* strengths, weaknesses */}
      </Page>

      {/* Details + Notes Page: Characters, comparable films, producer notes */}
      <Page size="A4" style={styles.page}>
        {/* comparable films, characters */}
        {/* producer notes (if any) */}
      </Page>
    </Document>
  );
}
```

### Export Service Function
```typescript
// New file: src/components/export/exportCoverage.ts
import { pdf } from '@react-pdf/renderer';
import { CoverageDocument } from './CoverageDocument';
import { useNotesStore } from '@/stores/notesStore';
import type { Screenplay } from '@/types';

export async function downloadCoveragePdf(screenplay: Screenplay): Promise<void> {
  const notes = useNotesStore.getState().getNotesForScreenplay(screenplay.id);

  const blob = await pdf(
    <CoverageDocument screenplay={screenplay} notes={notes} />
  ).toBlob();

  const safeName = screenplay.title
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeName}-Coverage.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

### ModalHeader Button Addition
```typescript
// In ModalHeader.tsx -- add next to ShareButton
<CoverageDownloadButton screenplay={screenplay} />
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jsPDF manual coordinates | @react-pdf/renderer JSX | Project inception | Declarative layout, no coordinate math |
| Server-side PDF generation | Client-side via pdf().toBlob() | Project inception | Zero server dependency, instant generation |

**Deprecated/outdated:**
- None relevant. @react-pdf/renderer v4 is current and stable.

## Open Questions

1. **Poster Image CORS Reliability**
   - What we know: Firebase Storage URLs include access tokens and generally work cross-origin
   - What's unclear: Whether @react-pdf/renderer v4 Image can reliably fetch Firebase Storage poster URLs in all browsers during client-side PDF generation
   - Recommendation: Implement with conditional rendering (show poster if available, skip gracefully if not). Test with a real screenplay poster URL.

2. **Logo Resolution in PDF**
   - What we know: `public/lemon-logo-black.png` exists
   - What's unclear: Resolution/dimensions of the logo file and how it renders at print quality
   - Recommendation: Use the existing file. @react-pdf/renderer renders at screen resolution; for a coverage PDF that's primarily viewed on-screen, this is sufficient.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + happy-dom |
| Config file | vitest.config.ts |
| Quick run command | `npm run test:run` |
| Full suite command | `npm run test:run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXPORT-01a | downloadCoveragePdf generates blob and triggers download | unit | `npx vitest run src/components/export/exportCoverage.test.ts -x` | No -- Wave 0 |
| EXPORT-01b | CoverageDocument renders without crashing for various screenplay data | unit | `npx vitest run src/components/export/CoverageDocument.test.tsx -x` | No -- Wave 0 |
| EXPORT-01c | Filename sanitization produces safe filenames | unit | `npx vitest run src/components/export/exportCoverage.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:run`
- **Per wave merge:** `npm run test:run && npm run build`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/export/exportCoverage.test.ts` -- covers EXPORT-01a, EXPORT-01c (filename sanitization, blob generation mock)
- [ ] `src/components/export/CoverageDocument.test.tsx` -- covers EXPORT-01b (render without crash, notes conditional rendering)
- [ ] Mock for `@react-pdf/renderer` `pdf()` function in test environment (happy-dom doesn't have full PDF rendering)

## Sources

### Primary (HIGH confidence)
- Codebase: `src/components/export/PdfDocument.tsx` -- existing PDF generation pattern, StyleSheet, score bars
- Codebase: `src/components/export/ExportModal.tsx` -- `pdf().toBlob()` download pattern (lines 47-59)
- Codebase: `src/stores/notesStore.ts` -- `getNotesForScreenplay()` method for non-reactive note access
- Codebase: `src/components/screenplay/modal/ModalHeader.tsx` -- button insertion point (line 136-137 area)
- Codebase: `src/lib/dimensionDisplay.ts` -- `getDimensionDisplay()` for V5/V6 score compatibility
- Codebase: `src/types/screenplay.ts` -- full Screenplay interface with all analysis fields

### Secondary (MEDIUM confidence)
- [react-pdf.org/components](https://react-pdf.org/components) -- Image component API documentation
- [@react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer) -- v4.3.2 package info

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all patterns proven in codebase
- Architecture: HIGH -- direct extension of existing export infrastructure
- Pitfalls: MEDIUM -- CORS on poster images needs runtime validation

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable domain, no version-sensitive concerns)
