# Phase 5: Bulk PDF Upload Modal - Research

**Researched:** 2026-03-24
**Domain:** React file upload UI + Firebase Storage + string matching
**Confidence:** HIGH

## Summary

This phase builds a purpose-built bulk PDF upload modal with per-row drop targets, a batch drop zone with filename auto-matching, immediate upload with progress tracking, and auto-retry on failure. The core challenge is composing multiple independent drag-and-drop targets (one per screenplay row plus a global batch zone) using native HTML5 DnD events, since the installed `@dnd-kit` library does not support file drops from the OS file system.

The existing codebase already contains all the upload infrastructure needed: `uploadScreenplayPdf()` in `firebase.ts`, `buildStoragePath()` in `pdfUploadPanel.helpers.ts`, `pdfStatusStore` for status tracking, and `patchAnalysisField()` for Firestore updates. The existing `PdfUploadPanel.tsx` provides a proven reference implementation including a `matchScore()` function for filename-to-title matching. The new modal adapts these patterns into a compact, selection-scoped UI.

Firebase Storage's `uploadBytesResumable` (already available in the installed `firebase@12.9.0`) provides real-time progress tracking via `snapshot.bytesTransferred / snapshot.totalBytes`, pause/resume/cancel controls, and built-in retry with exponential backoff. This replaces the current `uploadBytes` call to enable per-row progress bars. Middle truncation for filenames requires a small JS utility (not CSS-only) since CSS `text-overflow` only supports end truncation.

**Primary recommendation:** Use native HTML5 drag-and-drop events (matching the existing PdfUploadPanel pattern), upgrade from `uploadBytes` to `uploadBytesResumable` for progress tracking, adapt the existing `matchScore()` function for batch auto-matching, and implement a simple JS middle-truncation utility rather than adding a library.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Compact row layout -- title + category tag on left, Browse button on right, ~40px per row
- **D-02:** Entire row is a drag-and-drop target -- dropping a PDF on the row starts upload for that screenplay
- **D-03:** Top-level batch drop zone above the row list -- accepts multiple PDF files, auto-matches by filename similarity to screenplay titles. Unmatched files show an error
- **D-04:** Upload starts immediately on drop/file-select -- no queue step, no "Upload All" button. Per-row progress in real time
- **D-05:** PDF only -- reject non-PDF files with inline error flash ("PDF files only"), then return to empty state
- **D-06:** 50MB file size limit -- reject oversized files before upload starts with inline message ("File too large -- max 50MB")
- **D-07:** Auto-retry once on upload failure. If second attempt fails, show error state with per-row Retry button
- **D-08:** Per-row retry only -- no "Retry All Failed" batch button
- **D-09:** Successful uploads persist on modal close -- closing saves completed uploads. Re-opening modal shows only still-missing PDFs (failed rows reappear as needing upload)
- **D-10:** In-place row updates -- completed rows show green checkmark and "Uploaded" state. Failed rows show red error with Retry button. Summary bar at top updates live
- **D-11:** Done button always available -- user can close at any time, even with failures outstanding
- **D-12:** No toast after closing -- the modal already showed the results, no redundant toast
- **D-13:** Modal shows only missing-PDF screenplays from selection. Already-attached count shown in info note
- **D-14:** Replacement/versioning is out of scope
- **D-15:** Stray drops (outside any dropzone but inside modal) show gentle hint. Multiple files on a single dropzone rejected
- **D-16:** Long filenames use middle truncation

### Claude's Discretion
- Filename similarity matching algorithm for batch drop (Levenshtein, substring, etc.)
- Exact compact row height and spacing
- Browse button vs icon-only for the row upload trigger
- Upload progress indicator per row (spinner, progress bar, shimmer)
- Animation/transition for row state changes (pending -> uploading -> success/error)
- Error message wording for edge cases
- Whether batch drop zone appears as a prominent area or subtle header region

### Deferred Ideas (OUT OF SCOPE)
- PDF replacement/versioning
- FDX / Fountain / TXT file support
- Batch retry ("Retry All Failed")
- Bulk share token management (BULK-E1)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BULK-07 | User can upload PDFs for selected screenplays missing them via a streamlined modal with one dropzone per title | Native HTML5 DnD per-row targets + batch zone; `uploadBytesResumable` for progress; `uploadScreenplayPdf` for actual upload; `buildStoragePath` for path generation |
| BULK-12 | Bulk PDF upload modal shows only screenplays missing PDFs with a note about already-attached count; stays open with success summary until dismissed | Filter selected screenplays by `hasPdf` field; live summary counter in header; Done button always enabled (D-11); no toast on close (D-12) |
</phase_requirements>

## Standard Stack

### Core (already installed -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| firebase | 12.9.0 | `uploadBytesResumable` for progress-tracked uploads | Already installed; provides real-time `bytesTransferred/totalBytes` + built-in retry with exponential backoff |
| react | 19.2.0 | Component framework, native event handlers for DnD | Already installed |
| zustand | 5.0.10 | Ephemeral upload state management (if needed) | Already installed; established pattern for domain stores |
| clsx | 2.1.1 | Conditional class composition for row states | Already installed; used everywhere |
| tailwindcss | 4.1.18 | All styling -- glass modal, row states, progress bar | Already installed; project convention |

### Supporting (already installed -- no new dependencies)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | 5.90.20 | `invalidateQueries` after successful uploads | Post-upload cache invalidation for `SCREENPLAYS_QUERY_KEY` |
| vitest | 4.0.18 | Unit testing modal logic, matching algorithm, validation | Test runner |
| @testing-library/react | 16.3.2 | Component rendering tests | Modal render/interaction tests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native HTML5 DnD | react-dropzone | react-dropzone adds 8KB for a hook wrapper; existing codebase uses native DnD successfully in PdfUploadPanel.tsx; no benefit to switching |
| Native HTML5 DnD | @dnd-kit (installed) | @dnd-kit does NOT support file drops from OS -- only DOM-to-DOM drag (confirmed via GitHub issue #1581); cannot use for file upload |
| Custom matchScore | fuse.js / string-similarity npm | Existing `matchScore()` in pdfUploadPanel.helpers covers exact match + substring + word overlap; sufficient for filename-to-title matching without adding a dependency |
| JS middle truncation utility | react-middle-truncate npm | 3.6KB dependency for a ~10-line utility; CSS `text-overflow` only does end truncation; a simple JS function is more appropriate |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── bulk/
│       ├── BulkPdfUploadModal.tsx        # Main modal component
│       ├── BulkPdfUploadModal.test.tsx    # Unit tests
│       ├── bulkPdfUpload.helpers.ts       # matchScore, validation, middleTruncate
│       ├── bulkPdfUpload.helpers.test.ts  # Pure function tests
│       └── index.ts                       # Updated barrel export
├── components/screenplay/
│   └── BulkActionBar.tsx                  # Wire "Upload PDFs" button
```

### Pattern 1: Modal Shell (matching SetCategoryModal / AddToFavoritesModal)
**What:** Fixed overlay with backdrop blur, glass container, gold border, animate-scale-in
**When to use:** All bulk action modals
**Example:**
```typescript
// Source: src/components/bulk/SetCategoryModal.tsx (existing pattern)
<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
  <div className="fixed inset-0 bg-black-950/80 backdrop-blur-sm" onClick={onClose} />
  <div className="relative w-full max-w-lg glass border border-gold-500/20 rounded-xl overflow-hidden animate-scale-in">
    {/* Header with summary bar */}
    {/* Batch drop zone */}
    {/* Scrollable row list */}
    {/* Footer with Done button */}
  </div>
</div>
```

### Pattern 2: Native HTML5 File Drop Targets (per-row + batch)
**What:** Each row AND the batch zone use `onDrop`, `onDragOver`, `onDragEnter`, `onDragLeave` handlers
**When to use:** Anywhere files are dropped from OS into the browser
**Why not @dnd-kit:** `@dnd-kit` does not support native file drops from the OS (GitHub issue #1581). It only handles DOM-to-DOM dragging.
**Example:**
```typescript
// Source: src/components/settings/PdfUploadPanel.tsx (existing pattern)
const handleRowDrop = (e: React.DragEvent, screenplay: Screenplay) => {
  e.preventDefault();
  e.stopPropagation(); // Prevent batch zone from catching it
  setRowDragActive(null);
  const files = Array.from(e.dataTransfer.files);
  if (files.length > 1) {
    showRowError(screenplay.id, 'One file per title');
    return;
  }
  const file = files[0];
  if (!validateFile(file)) return;
  startUpload(file, screenplay);
};

// CRITICAL: e.stopPropagation() on row drops prevents the batch zone
// from also receiving the event. Batch zone only fires when files land
// outside any specific row.
```

### Pattern 3: Upload with Progress via uploadBytesResumable
**What:** Replace `uploadBytes` with `uploadBytesResumable` for per-row progress tracking
**When to use:** Any upload where the user needs to see progress
**Example:**
```typescript
// Source: Firebase Storage SDK docs (firebase@12.9.0)
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

function startUpload(file: File, screenplay: Screenplay) {
  const path = buildStoragePath(screenplay);
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: 'application/pdf',
    customMetadata: {
      originalFilename: file.name,
      category: screenplay.category || 'OTHER',
      uploadedAt: new Date().toISOString(),
    },
  });

  uploadTask.on('state_changed',
    (snapshot) => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      updateRowState(screenplay.id, { state: 'uploading', progress });
    },
    (error) => {
      // Auto-retry once (D-07)
      if (!hasRetried[screenplay.id]) {
        hasRetried[screenplay.id] = true;
        startUpload(file, screenplay); // Retry
      } else {
        updateRowState(screenplay.id, { state: 'error', error: error.message });
      }
    },
    async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref);
      // Post-upload: mark hasPdf in Firestore + update pdfStatusStore
      await patchAnalysisField(screenplay.sourceFile, 'hasPdf', true);
      pdfStatusStore.getState().setStatus(screenplay.id, 'found');
      queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY });
      updateRowState(screenplay.id, { state: 'done' });
    }
  );
}
```

### Pattern 4: Component-Local State (not Zustand store)
**What:** Upload modal state is ephemeral -- managed via `useState`/`useRef` inside the modal component
**When to use:** Modal is transient; upload state does not need to survive unmount
**Why:** Per CONTEXT.md "Zustand stores per domain -- upload state can be local component state (modal is ephemeral)". Closing the modal discards in-progress state; re-opening filters to remaining missing PDFs.

### Pattern 5: Batch Drop Zone with Filename Auto-Matching
**What:** Top-level drop zone accepts multiple files and matches each to a screenplay title
**When to use:** Power users who name PDFs after their screenplays
**Example:**
```typescript
// Adapt existing matchScore from PdfUploadPanel.tsx
function matchFilesToScreenplays(
  files: File[],
  screenplays: Screenplay[]
): { matched: Array<{ file: File; screenplay: Screenplay }>; unmatched: File[] } {
  const matched: Array<{ file: File; screenplay: Screenplay }> = [];
  const unmatched: File[] = [];
  const claimed = new Set<string>(); // Prevent double-assignment

  for (const file of files) {
    const scored = screenplays
      .filter((s) => !claimed.has(s.id))
      .map((s) => ({ screenplay: s, score: matchScore(file.name, s) }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (best && best.score >= 50) { // Minimum confidence threshold
      matched.push({ file, screenplay: best.screenplay });
      claimed.add(best.screenplay.id);
    } else {
      unmatched.push(file);
    }
  }

  return { matched, unmatched };
}
```

### Anti-Patterns to Avoid
- **Using @dnd-kit for file uploads:** It does not handle native OS file drops. Use HTML5 DnD events directly.
- **Creating a Zustand store for upload state:** The modal is ephemeral. Component-local state is simpler and avoids stale state issues on re-open.
- **Queue-then-upload workflow:** CONTEXT D-04 explicitly requires immediate upload on drop. No staging area, no "Upload All" button.
- **Blocking the Done button during uploads:** CONTEXT D-11 requires the user can close at any time. Completed uploads persist; in-progress uploads are abandoned.
- **Showing a toast on modal close:** CONTEXT D-12 explicitly forbids redundant toasts since the modal already shows results.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Upload progress tracking | Custom XHR/fetch with progress | `uploadBytesResumable` from firebase/storage | Built-in progress events, pause/resume/cancel, exponential backoff retry |
| Firebase Storage paths | Custom path builder | `buildStoragePath()` from `pdfUploadPanel.helpers.ts` | Must match ModalHeader's download path exactly |
| Post-upload Firestore sync | Custom updateDoc calls | `patchAnalysisField()` from `analysisStore.ts` | Handles localStorage + Firestore in one call |
| PDF status tracking | Local status map | `pdfStatusStore.setStatus()` + `setBulkStatuses()` | Shared store drives filter pipeline reactivity |
| Query cache invalidation | Manual React Query updates | `queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY })` | Established pattern; ensures all consumers refresh |
| Filename matching | Levenshtein library or custom algorithm | Adapt existing `matchScore()` from `PdfUploadPanel.tsx` | Already handles exact, substring, and word-overlap matching; proven in production |

**Key insight:** Nearly all upload infrastructure already exists in the codebase. The new modal is primarily a UI wrapper that composes existing utilities with new DnD targets and progress tracking.

## Common Pitfalls

### Pitfall 1: Event Bubbling Between Nested Drop Zones
**What goes wrong:** Dropping a file on a row also triggers the batch drop zone's `onDrop` handler
**Why it happens:** HTML5 DnD events bubble from child to parent. The batch zone wraps all rows.
**How to avoid:** Call `e.stopPropagation()` in every row's `onDrop` handler. The batch zone handler only fires for drops that land outside any row.
**Warning signs:** Single file drop triggers two uploads or both batch and row handlers fire

### Pitfall 2: dragover Default Prevention
**What goes wrong:** Browser opens the PDF file instead of dropping it into the app
**Why it happens:** The default browser behavior for `dragover` is to deny the drop and open the file natively
**How to avoid:** Every drop zone MUST call `e.preventDefault()` in its `onDragOver` handler. This is the single most common mistake in HTML5 DnD.
**Warning signs:** Files open in a new tab instead of being uploaded

### Pitfall 3: Upload Path Mismatch
**What goes wrong:** PDFs upload to a different Storage path than ModalHeader expects when generating download URLs
**Why it happens:** Building the storage path manually instead of using `buildStoragePath()`
**How to avoid:** Always use `buildStoragePath(screenplay)` from `pdfUploadPanel.helpers.ts`. This function MUST match `ModalHeader.tsx`'s path logic exactly.
**Warning signs:** Upload succeeds but "View PDF" button in screenplay modal shows 404

### Pitfall 4: Stale Screenplay Data After Upload
**What goes wrong:** The modal still shows a row as "missing" after successful upload
**Why it happens:** Forgetting to update BOTH `pdfStatusStore` (for immediate UI reactivity) AND Firestore (for persistence), then invalidating the React Query cache
**How to avoid:** Post-upload sequence must be: (1) `patchAnalysisField(sourceFile, 'hasPdf', true)`, (2) `pdfStatusStore.setStatus(id, 'found')`, (3) `queryClient.invalidateQueries()`
**Warning signs:** Upload spinner finishes but row state doesn't update to green checkmark

### Pitfall 5: Multiple Files on a Single Row
**What goes wrong:** User drops 3 files on one row, triggering 3 uploads to the same path
**Why it happens:** `e.dataTransfer.files` can contain multiple files from a single drop
**How to avoid:** Check `files.length > 1` in row drop handler; reject with inline error "One file per title" (D-15)
**Warning signs:** Multiple progress bars or upload races for the same screenplay

### Pitfall 6: File Validation After Re-extension
**What goes wrong:** User renames a .docx to .pdf and uploads it
**Why it happens:** Only checking `file.name.endsWith('.pdf')` validates the extension, not the actual content
**How to avoid:** Two-layer validation: (1) Check `file.type === 'application/pdf'` (MIME type from browser), (2) Check file extension `.pdf`. For this project, MIME + extension is sufficient; magic-byte validation (%PDF header) is overkill for an internal tool.
**Warning signs:** Corrupted PDFs in storage that fail to render

### Pitfall 7: Auto-Retry Creating Infinite Loop
**What goes wrong:** Retry logic calls the upload function recursively without bounds
**Why it happens:** No per-file retry counter; error handler always retries
**How to avoid:** Use a `retried` Set or Map to track which files have already been retried once. D-07 specifies exactly one auto-retry.
**Warning signs:** Firebase usage spikes; browser hangs on failed uploads

## Code Examples

### File Validation Utility
```typescript
// bulkPdfUpload.helpers.ts
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB (D-06)

export type ValidationError = 'not-pdf' | 'too-large' | null;

export function validatePdfFile(file: File): ValidationError {
  // Check MIME type + extension (D-05)
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return 'not-pdf';

  // Check size (D-06)
  if (file.size > MAX_FILE_SIZE) return 'too-large';

  return null;
}

export function validationMessage(error: ValidationError): string {
  switch (error) {
    case 'not-pdf': return 'PDF files only';
    case 'too-large': return 'File too large \u2014 max 50MB';
    default: return '';
  }
}
```

### Middle Truncation Utility
```typescript
// bulkPdfUpload.helpers.ts
/**
 * Truncate a string in the middle, preserving start and end.
 * Example: middleTruncate("El_Godin_de_los_Suenos_V4_FINAL.pdf", 30)
 *       -> "El_Godin_de_los...V4_FINAL.pdf"
 */
export function middleTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const ellipsis = '\u2026'; // Unicode ellipsis character
  const charsToShow = maxLength - 1; // -1 for ellipsis
  const front = Math.ceil(charsToShow * 0.6); // More weight to start
  const back = Math.floor(charsToShow * 0.4); // Preserve end (version + extension)
  return text.slice(0, front) + ellipsis + text.slice(-back);
}
```

### Adapted matchScore for Batch Auto-Matching
```typescript
// bulkPdfUpload.helpers.ts -- adapted from PdfUploadPanel.tsx matchScore
import type { Screenplay } from '@/types';

function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/[_\s-]+/g, ' ')
    .trim();
}

export function matchScore(droppedName: string, screenplay: Screenplay): number {
  const dropped = normalize(droppedName);
  const title = normalize(screenplay.title);
  const source = normalize(screenplay.sourceFile);

  if (dropped === title || dropped === source) return 100;
  if (title.includes(dropped) || dropped.includes(title)) return 80;
  if (source.includes(dropped) || dropped.includes(source)) return 70;

  const droppedWords = new Set(dropped.split(' ').filter(Boolean));
  const titleWords = title.split(' ').filter(Boolean);
  const matched = titleWords.filter((w) => droppedWords.has(w)).length;
  if (matched > 0) return Math.min(60, matched * 25);

  return 0;
}

export const MATCH_THRESHOLD = 50; // Minimum score to auto-assign
```

### Row State Type
```typescript
// bulkPdfUpload.helpers.ts
export type RowUploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number }
  | { status: 'done' }
  | { status: 'error'; message: string; file?: File }; // Keep file ref for retry
```

### Per-Row Drop Zone Pattern
```typescript
// BulkPdfUploadModal.tsx -- per-row drop handler with stopPropagation
function UploadRow({ screenplay, onUpload, rowState, dragActiveId, setDragActiveId }: RowProps) {
  const isDragActive = dragActiveId === screenplay.id;

  return (
    <div
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation(); // CRITICAL: prevent batch zone from firing
        setDragActiveId(null);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 1) { /* reject: "One file per title" */ return; }
        const error = validatePdfFile(files[0]);
        if (error) { /* show validation error */ return; }
        onUpload(files[0], screenplay);
      }}
      onDragOver={(e) => { e.preventDefault(); setDragActiveId(screenplay.id); }}
      onDragEnter={(e) => { e.preventDefault(); setDragActiveId(screenplay.id); }}
      onDragLeave={() => setDragActiveId(null)}
      className={clsx(
        'flex items-center gap-3 px-4 py-2 rounded-lg border transition-all',
        isDragActive && 'border-gold-400 bg-gold-500/10',
        rowState.status === 'done' && 'border-emerald-500/20 bg-emerald-500/5',
        rowState.status === 'error' && 'border-red-500/20 bg-red-500/5',
      )}
    >
      {/* Title + category + progress/status + Browse button */}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `uploadBytes` (no progress) | `uploadBytesResumable` (progress + pause/resume) | Firebase SDK v9+ (2021) | Enables per-row progress bars; both APIs available in firebase@12.9.0 |
| react-dropzone for all file DnD | Native HTML5 DnD events | Always available | Zero-dependency; existing codebase pattern; react-dropzone still popular but unnecessary here |
| CSS `text-overflow: ellipsis` (end only) | JS middle truncation | No CSS middle truncation spec adopted | Must use JS; CSS spec proposal (w3c/csswg-drafts#3937) still open since 2019 |
| Levenshtein distance library | Word-overlap matching (existing matchScore) | Project-specific | Existing matchScore handles screenplay filenames well; Levenshtein adds complexity for marginal gain on short title strings |

**Deprecated/outdated:**
- Firebase Storage v8 API (`firebase.storage().ref()`) -- replaced by modular SDK v9+ imports
- `UploadTask.on()` with 3 separate callbacks is the current pattern; there is no Promise-based alternative for progress tracking

## Open Questions

1. **Whether to extract matchScore to a shared helper vs duplicate it**
   - What we know: `matchScore` exists in `pdfUploadPanel.helpers.ts` but that file is coupled to `PdfUploadPanel`
   - What's unclear: Whether to import from there or duplicate into `bulkPdfUpload.helpers.ts`
   - Recommendation: Duplicate into `bulkPdfUpload.helpers.ts` with identical logic. The function is small (~15 lines) and the two modules have different lifecycles. Avoid coupling bulk modal to settings panel.

2. **Scrollable row list max-height**
   - What we know: Modal needs to handle 50+ rows for large selections
   - What's unclear: Exact max-height before scrolling kicks in
   - Recommendation: Use `max-h-[60vh] overflow-y-auto` on the row list container. Virtual scrolling is NOT needed -- even 100 rows at 40px = 4000px, well within DOM performance bounds.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test:run -- --testPathPattern=bulk` |
| Full suite command | `npm run test:run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BULK-07 | Modal renders with per-row drop zones for missing-PDF screenplays | unit | `npx vitest run src/components/bulk/BulkPdfUploadModal.test.tsx -t "renders"` | Wave 0 |
| BULK-07 | File validation rejects non-PDF and oversized files | unit | `npx vitest run src/components/bulk/bulkPdfUpload.helpers.test.ts -t "validate"` | Wave 0 |
| BULK-07 | Batch drop zone auto-matches files to screenplays by filename similarity | unit | `npx vitest run src/components/bulk/bulkPdfUpload.helpers.test.ts -t "matchScore"` | Wave 0 |
| BULK-07 | Upload starts immediately on drop (no queue) | unit | `npx vitest run src/components/bulk/BulkPdfUploadModal.test.tsx -t "upload"` | Wave 0 |
| BULK-12 | Modal filters to missing-PDF screenplays only | unit | `npx vitest run src/components/bulk/BulkPdfUploadModal.test.tsx -t "missing"` | Wave 0 |
| BULK-12 | Info note shows already-attached count | unit | `npx vitest run src/components/bulk/BulkPdfUploadModal.test.tsx -t "attached"` | Wave 0 |
| BULK-12 | Summary bar updates live as uploads complete | unit | `npx vitest run src/components/bulk/BulkPdfUploadModal.test.tsx -t "summary"` | Wave 0 |
| BULK-12 | Done button always enabled | unit | `npx vitest run src/components/bulk/BulkPdfUploadModal.test.tsx -t "Done"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:run -- --testPathPattern=bulk`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/bulk/BulkPdfUploadModal.test.tsx` -- covers BULK-07, BULK-12
- [ ] `src/components/bulk/bulkPdfUpload.helpers.test.ts` -- covers matchScore, validatePdfFile, middleTruncate
- [ ] No framework install needed -- Vitest + Testing Library already configured

## Sources

### Primary (HIGH confidence)
- `src/components/settings/PdfUploadPanel.tsx` -- Existing upload UI with native HTML5 DnD, matchScore, doUpload pattern
- `src/lib/firebase.ts` -- `uploadScreenplayPdf()` using `uploadBytes`; shows exact metadata pattern
- `src/components/settings/pdfUploadPanel.helpers.ts` -- `buildStoragePath()` canonical path builder
- `src/stores/pdfStatusStore.ts` -- `setStatus`, `setBulkStatuses` for status tracking
- `src/components/bulk/SetCategoryModal.tsx` -- Modal shell pattern (z-50, glass, gold border, animate-scale-in)
- [Firebase Storage upload docs](https://firebase.google.com/docs/storage/web/upload-files) -- `uploadBytesResumable` API with progress tracking
- [Firebase modular SDK reference](https://modularfirebase.web.app/common-use-cases/storage/) -- Code examples for uploadBytesResumable with state_changed observer

### Secondary (MEDIUM confidence)
- [@dnd-kit GitHub issue #1581](https://github.com/clauderic/dnd-kit/issues/1581) -- Confirms @dnd-kit does not support native file drops from OS
- [W3C CSS text-overflow middle cropping](https://www.w3.org/wiki/Text-overflow_middle_cropping) -- Confirms CSS-only middle truncation not yet standardized
- [MDN text-overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-overflow) -- Confirms two-value syntax for start+end but not middle
- [Firebase SDK retry behavior](https://github.com/firebase/firebase-js-sdk/issues/7366) -- uploadBytesResumable has built-in retry with max retry time limit

### Tertiary (LOW confidence)
- None -- all findings verified with primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used in the codebase; no new dependencies
- Architecture: HIGH -- patterns directly adapted from existing PdfUploadPanel.tsx and SetCategoryModal.tsx
- Pitfalls: HIGH -- event bubbling, dragover prevention, and path matching are well-documented HTML5 DnD issues confirmed by existing code patterns
- Filename matching: HIGH -- existing matchScore function is production-proven; adaptation is straightforward
- Middle truncation: HIGH -- JS approach is simple and well-understood; CSS limitation is documented by W3C

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable domain -- no fast-moving dependencies)
