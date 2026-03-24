# Phase 12: Bulk PDF Upload + Integration Testing - Research

**Researched:** 2026-03-22
**Domain:** React component wiring (existing code integration), Vitest testing, cross-phase integration validation
**Confidence:** HIGH

## Summary

Phase 12 has two distinct goals: (1) wire FILE-04, a new "Upload PDFs" bulk action in the FilterBar ActionsDropdown that opens PdfUploadPanel scoped to selected IDs, and (2) run a full integration pass fixing any existing test failures and verifying all v7.0 phases work together end-to-end.

The FILE-04 feature is a pure wiring task -- all building blocks exist. PdfUploadPanel already has its own search/filter/selection UI and Firebase Storage upload logic. The bulk action flow needs to: select cards in the grid, click "Upload PDFs" in ActionsDropdown, and open PdfUploadPanel pre-filtered to only show those selected screenplays. The key design decision is **where** PdfUploadPanel opens (inline panel vs modal vs navigate to Settings) and **how** scoped IDs are passed (props vs store vs URL params).

The integration testing goal addresses existing test failures (FilterBar.test.tsx needs `useScreenplays`/`usePdfScan` mocks; analysisStore.test.ts has Firebase auth issues in CI) and validates the complete v7.0 feature matrix works together: virtual scrolling + filters + bulk operations + PDF status badges.

**Primary recommendation:** Add "Upload PDFs" as a third action in ActionsDropdown, pass selected missing-PDF IDs to PdfUploadPanel via a new prop (`scopedIds?: string[]`), render PdfUploadPanel in a modal from FilterBar (same pattern as BulkShareModal/BulkReanalyzeModal). Fix FilterBar.test.tsx by adding `useScreenplays` and `usePdfScan` mocks. Do NOT navigate to Settings page -- the modal approach keeps the user in their filter context.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FILE-04 | User can select N cards whose PDF is missing and trigger an "Upload PDFs" bulk action from FilterBar that opens PdfUploadPanel pre-scoped to those selected IDs | ActionsDropdown exists with two actions; PdfUploadPanel has search/filter/upload UI; exportSelectionStore tracks selected IDs; pdfStatusStore identifies missing PDFs. Wire a third dropdown item + modal wrapper + scopedIds prop. |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^19.2.0 | UI framework | Project stack |
| Zustand | ^5.0.10 | Client state (exportSelectionStore, pdfStatusStore, filterStore) | Project stack |
| @tanstack/react-query | ^5.90.20 | Server state (useScreenplays) | Project stack |
| Vitest | ^4.0.18 | Unit testing | Project stack |
| @testing-library/react | ^16.3.2 | Component testing | Project stack |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx | (installed) | Conditional classnames | All component styling |
| Firebase Storage SDK | (installed) | PDF upload/status check | PdfUploadPanel internals |

### No New Dependencies
This phase requires zero new packages. All building blocks exist in the codebase.

## Architecture Patterns

### Recommended Approach: Modal-Based PdfUploadPanel with Scoped IDs

```
FilterBar
  -> ActionsDropdown (add "Upload PDFs" item)
  -> PdfUploadPanel (rendered in modal overlay, receives scopedIds prop)
```

### Pattern 1: Scoped IDs via Props (not store)

**What:** Pass `scopedIds?: string[]` as an optional prop to PdfUploadPanel. When provided, PdfUploadPanel filters its internal list to only show those screenplays and skips its own search/filter UI.

**When to use:** When the panel is opened from a bulk action with pre-determined targets.

**Why not a store:** The scope is transient (lives only while the modal is open) and flows from a single callsite. A store would add global state for something that is strictly parent-to-child data flow.

**Example:**
```typescript
// PdfUploadPanel receives optional scope
interface PdfUploadPanelProps {
  scopedIds?: string[];
}

export function PdfUploadPanel({ scopedIds }: PdfUploadPanelProps) {
  const { data: screenplays, isLoading } = useScreenplays();

  // When scoped, filter to only those IDs
  const baseScreenplays = useMemo(() => {
    if (!screenplays) return [];
    if (scopedIds && scopedIds.length > 0) {
      return screenplays.filter((s) => scopedIds.includes(s.id));
    }
    return screenplays;
  }, [screenplays, scopedIds]);

  // ... rest of component uses baseScreenplays instead of screenplays
}
```

### Pattern 2: Modal Wrapper in FilterBar

**What:** FilterBar already owns BulkShareModal and BulkReanalyzeModal as overlay modals. Add a third `isBulkUploadOpen` state and render PdfUploadPanel inside a modal overlay using the same pattern.

**Example:**
```typescript
// In FilterBar, alongside existing modals:
const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

// Compute missing-PDF selected IDs
const missingPdfSelectedIds = selectedScreenplays
  .filter((sp) => {
    if (hasScanResult) return pdfStatuses[sp.id] !== 'found';
    return sp.hasPdf !== true;
  })
  .map((sp) => sp.id);

// In ActionsDropdown props:
<ActionsDropdown
  onUploadPdfs={() => setIsBulkUploadOpen(true)}
  uploadPdfCount={missingPdfSelectedIds.length}
  // ... existing props
/>

// Modal render:
{isBulkUploadOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="fixed inset-0 bg-black-950/80 backdrop-blur-sm"
         onClick={() => setIsBulkUploadOpen(false)} />
    <div className="relative w-full max-w-4xl max-h-[80vh] overflow-y-auto glass border border-gold-500/20 rounded-xl animate-scale-in p-6">
      <PdfUploadPanel scopedIds={missingPdfSelectedIds} />
    </div>
  </div>
)}
```

### Pattern 3: ActionsDropdown Extension

**What:** Add a third menu item "Upload PDFs" to ActionsDropdown with a count badge showing how many selected screenplays are missing PDFs. Disabled when no missing-PDF screenplays are selected.

**Example:**
```typescript
// New props for ActionsDropdown:
interface ActionsDropdownProps {
  onGenerateShareLinks: () => void;
  onReanalyze: () => void;
  onUploadPdfs: () => void;           // NEW
  reanalyzeEligibleCount: number;
  uploadPdfCount: number;              // NEW
  selectionCount: number;
}

// New menu item (after Re-analyze Selected):
<button
  role="menuitem"
  onClick={handleUploadPdfs}
  disabled={uploadPdfCount === 0}
  aria-disabled={uploadPdfCount === 0}
  className="..."
>
  Upload PDFs ({uploadPdfCount})
</button>
```

### Pattern 4: FilterBar.test.tsx Mock Fix

**What:** FilterBar now imports `useScreenplays` (React Query hook) and `usePdfScan`. The test file must mock both to avoid QueryClient errors.

**Example:**
```typescript
// Add to FilterBar.test.tsx mock block:
vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/usePdfScan', () => ({
  usePdfScan: () => ({ triggerScan: vi.fn(), hasScanResult: false, isScanning: false }),
}));
```

### Anti-Patterns to Avoid

- **Navigating to Settings page:** This loses the user's filter context and is jarring. Use a modal overlay instead.
- **Global store for scoped IDs:** The scope is transient per-modal-open. A Zustand store would be overkill and leave stale state.
- **Modifying PdfUploadPanel's internal selection system:** PdfUploadPanel has its own `selectedIds` state and batch delete. The `scopedIds` prop should ONLY filter which screenplays appear in the list, not interfere with internal selection logic.
- **Running full Storage scan in modal:** When `scopedIds` is provided, only scan those specific IDs, not the entire screenplay list. This avoids unnecessary Firebase API calls.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF existence check | Custom Firebase calls | Existing `checkStoragePaths` in PdfUploadPanel | Already handles batching, rate limiting, and pdfStatusStore updates |
| File upload | Custom upload logic | Existing `doUpload`/`uploadScreenplayPdf` | Already handles Firestore sync, status updates, cache invalidation |
| Modal overlay | Custom portal system | Inline modal div pattern (same as BulkReanalyzeModal) | Project convention; no portal library needed |
| Selected screenplay tracking | New selection store | Existing `exportSelectionStore` | Already used by gold checkboxes on cards |
| PDF status filtering | New filter logic | Existing `pdfStatusStore` + `hasScanResult` conditional | FilterBar already computes `missingPdfSelectedIds`-equivalent logic |

**Key insight:** Every piece of the FILE-04 pipeline already exists as standalone code. The phase is pure integration wiring -- connecting ActionsDropdown to a modal wrapper around PdfUploadPanel with a `scopedIds` filter.

## Common Pitfalls

### Pitfall 1: PdfUploadPanel's Auto-Scan Effect Fires for All Screenplays
**What goes wrong:** PdfUploadPanel has a `useEffect` that auto-scans ALL screenplays when it mounts (`checkStoragePaths(screenplays)`). In modal mode with `scopedIds`, this would scan the entire list instead of just the scoped ones.
**Why it happens:** The effect depends on `screenplays` from `useScreenplays()` which returns everything.
**How to avoid:** When `scopedIds` is provided, the component should use the filtered list for the auto-scan effect, not the full list. Replace the scan target with `baseScreenplays` (the scoped subset).
**Warning signs:** Slow modal open, unnecessary Firebase getMetadata calls.

### Pitfall 2: FilterBar.test.tsx Missing Mocks (EXISTING BUG)
**What goes wrong:** All 6 FilterBar tests fail with "No QueryClient set" error.
**Why it happens:** FilterBar now imports `useScreenplays` (added for PDF scan triggering) and `usePdfScan`, but the test file was not updated to mock these hooks.
**How to avoid:** Add `vi.mock('@/hooks/useScreenplays')` and `vi.mock('@/hooks/usePdfScan')` to FilterBar.test.tsx.
**Warning signs:** `Error: No QueryClient set, use QueryClientProvider to set one` in test output.

### Pitfall 3: analysisStore.test.ts Firebase Auth Failures (EXISTING BUG)
**What goes wrong:** 2 tests fail with `auth/network-request-failed` because they hit real Firebase endpoints.
**Why it happens:** The test file does not fully mock Firebase auth, so `signInAnonymously` attempts a real network call.
**How to avoid:** Mock `@/lib/firebase` at the module level in analysisStore.test.ts to prevent real auth calls.
**Warning signs:** `auth/network-request-failed` in test output, tests pass locally but fail intermittently.

### Pitfall 4: PdfUploadPanel Expects Full Page Width
**What goes wrong:** PdfUploadPanel was designed for the Settings page (full-width panel). In a modal, the grid stats and drag-drop zone may look cramped.
**Why it happens:** No max-width constraints in PdfUploadPanel; it uses `space-y-6` and `grid grid-cols-3`.
**How to avoid:** Use a `max-w-4xl` modal container. The existing layout is flexible enough for ~900px width. If needed, hide the drag-drop zone in scoped mode (users upload per-row instead).
**Warning signs:** Squished stats bar, truncated text in narrow modals.

### Pitfall 5: Stale `hasScanResult` When Opening Modal
**What goes wrong:** If the user has not visited Settings > PDF Files, `pdfStatusStore.hasScanResult` is false, and `pdfStatuses` is empty. The FilterBar uses `sp.hasPdf` fallback. But `hasPdf` in Firestore may be stale or missing.
**Why it happens:** `hasPdf` is only written after explicit "Rescan & Sync" in PdfUploadPanel.
**How to avoid:** When the FilterBar auto-triggers `usePdfScan` on Missing PDF chip click, the scan populates `pdfStatusStore`. Ensure the "Upload PDFs" action is only available after a scan has run (either via the chip or Settings visit). The `missingPdfSelectedIds` computation already handles both paths via the `hasScanResult` conditional.
**Warning signs:** "Upload PDFs" count shows 0 when it should show N.

### Pitfall 6: vi.mock Hoisting and Module-Level State
**What goes wrong:** Tests that mutate mock state between `it()` blocks may share state unexpectedly because `vi.mock` is hoisted to module scope.
**Why it happens:** Vitest hoists all `vi.mock()` calls to the top of the file. The mock factory runs once.
**How to avoid:** Use `let mockState = makeDefault()` pattern with `beforeEach(() => { mockState = makeDefault(); })` as established in FilterBar.test.tsx. Never define mocks inside `it()` blocks.
**Warning signs:** Tests pass individually but fail when run together.

## Code Examples

### Example 1: Adding "Upload PDFs" to ActionsDropdown
```typescript
// ActionsDropdown.tsx — add new menu item
interface ActionsDropdownProps {
  onGenerateShareLinks: () => void;
  onReanalyze: () => void;
  onUploadPdfs: () => void;
  reanalyzeEligibleCount: number;
  uploadPdfCount: number;
  selectionCount: number;
}

// New handler inside component:
function handleUploadPdfs() {
  if (uploadPdfCount === 0) return;
  onUploadPdfs();
  setIsOpen(false);
}

// New menu item JSX (after Re-analyze Selected):
<button
  role="menuitem"
  onClick={handleUploadPdfs}
  disabled={uploadPdfCount === 0}
  aria-disabled={uploadPdfCount === 0}
  title={uploadPdfCount === 0 ? 'No selected screenplays are missing PDFs' : undefined}
  className="w-full text-left px-4 py-2.5 text-sm text-black-200 hover:bg-black-700 hover:text-gold-400 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
>
  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
  Upload PDFs
  {uploadPdfCount > 0 && (
    <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold ml-auto">
      {uploadPdfCount}
    </span>
  )}
</button>
```

### Example 2: PdfUploadPanel scopedIds Prop Integration
```typescript
// PdfUploadPanel.tsx — add scopedIds prop
interface PdfUploadPanelProps {
  scopedIds?: string[];
}

export function PdfUploadPanel({ scopedIds }: PdfUploadPanelProps) {
  const { data: screenplays, isLoading } = useScreenplays();
  const isScoped = scopedIds && scopedIds.length > 0;

  // When scoped, use filtered list as the base for all operations
  const baseScreenplays = useMemo(() => {
    if (!screenplays) return [];
    if (isScoped) {
      const idSet = new Set(scopedIds);
      return screenplays.filter((s) => idSet.has(s.id));
    }
    return screenplays;
  }, [screenplays, scopedIds, isScoped]);

  // Auto-scan effect uses baseScreenplays, not full list
  useEffect(() => {
    if (!baseScreenplays || baseScreenplays.length === 0) return;
    // ... existing scan logic with baseScreenplays
  }, [baseScreenplays, checkStoragePaths, setPdfStoreScanning]);

  // In scoped mode: hide header ("PDF File Management"), hide drag-drop zone,
  // change title to "Upload PDFs for N Selected"
  // ...
}
```

### Example 3: FilterBar Modal Rendering
```typescript
// FilterBar.tsx — add upload modal state and render
const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

// Compute missing-PDF IDs from selection
const missingPdfSelectedIds = useMemo(() =>
  selectedScreenplays
    .filter((sp) => {
      if (hasScanResult) return pdfStatuses[sp.id] !== 'found';
      return sp.hasPdf !== true;
    })
    .map((sp) => sp.id),
  [selectedScreenplays, pdfStatuses, hasScanResult]
);

// Pass to ActionsDropdown:
<ActionsDropdown
  onUploadPdfs={() => setIsBulkUploadOpen(true)}
  uploadPdfCount={missingPdfSelectedIds.length}
  // ... existing props
/>

// Modal render (alongside BulkShareModal, BulkReanalyzeModal):
{isBulkUploadOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div
      className="fixed inset-0 bg-black-950/80 backdrop-blur-sm"
      onClick={() => setIsBulkUploadOpen(false)}
    />
    <div className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto glass border border-gold-500/20 rounded-xl animate-scale-in">
      {/* Close button */}
      <button
        onClick={() => setIsBulkUploadOpen(false)}
        className="absolute top-4 right-4 z-10 p-1 rounded text-black-400 hover:bg-black-700 hover:text-gold-400"
        aria-label="Close"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div className="p-6">
        <PdfUploadPanel scopedIds={missingPdfSelectedIds} />
      </div>
    </div>
  </div>
)}
```

### Example 4: FilterBar.test.tsx Mock Fixes
```typescript
// Add these mocks to FilterBar.test.tsx (at module level, alongside existing mocks):
vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/usePdfScan', () => ({
  usePdfScan: () => ({ triggerScan: vi.fn(), hasScanResult: false, isScanning: false }),
}));
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | vitest.config.ts |
| Quick run command | `npm run test:run -- src/components/filters/ActionsDropdown.test.tsx src/components/layout/FilterBar.test.tsx` |
| Full suite command | `npm run test:run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILE-04-a | ActionsDropdown shows "Upload PDFs" menu item with count | unit | `npm run test:run -- src/components/filters/ActionsDropdown.test.tsx` | Exists (needs new tests) |
| FILE-04-b | "Upload PDFs" disabled when uploadPdfCount === 0 | unit | `npm run test:run -- src/components/filters/ActionsDropdown.test.tsx` | Exists (needs new tests) |
| FILE-04-c | PdfUploadPanel filters list when scopedIds provided | unit | `npm run test:run -- src/components/settings/PdfUploadPanel.test.tsx` | No - Wave 0 |
| INTEG-01 | FilterBar.test.tsx passes (mock fix) | unit | `npm run test:run -- src/components/layout/FilterBar.test.tsx` | Exists (currently failing) |
| INTEG-02 | Full test suite passes | unit | `npm run test:run` | Existing suite |
| INTEG-03 | Build succeeds | build | `npm run build` | N/A |

### Sampling Rate
- **Per task commit:** `npm run test:run -- src/components/filters/ActionsDropdown.test.tsx src/components/layout/FilterBar.test.tsx`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green + `npm run build` before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/layout/FilterBar.test.tsx` -- fix existing mock failures (useScreenplays, usePdfScan)
- [ ] `src/components/filters/ActionsDropdown.test.tsx` -- add "Upload PDFs" menu item tests
- [ ] `src/components/settings/PdfUploadPanel.test.tsx` -- new file: scopedIds filtering behavior (optional -- complex due to Firebase mocking)
- [ ] `src/lib/analysisStore.test.ts` -- fix Firebase auth mock to prevent network calls

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Navigate to Settings for PDF upload | Modal overlay from dashboard | This phase | User stays in filter context |
| PdfUploadPanel always shows all screenplays | `scopedIds` prop filters to selection | This phase | Scoped bulk action UX |
| FilterBar.test.tsx no React Query mocks | Must mock useScreenplays/usePdfScan | Phase 11 (introduced deps) | 6 tests currently failing |

## Open Questions

1. **Should PdfUploadPanel's drag-drop zone be visible in scoped mode?**
   - What we know: In scoped mode, the user wants to upload PDFs for specific selected screenplays. The drag-drop zone with auto-matching may be confusing since only N screenplays are shown.
   - What's unclear: Whether the fuzzy matching is useful when the list is pre-filtered.
   - Recommendation: Show the drag-drop zone but only match against the scoped list. The per-row "Upload" button is the primary interaction pattern in scoped mode.

2. **Should PdfUploadPanel's header/stats bar change in scoped mode?**
   - What we know: The current header says "PDF File Management" with total/found/missing stats for ALL screenplays.
   - Recommendation: Change header to "Upload PDFs for N Selected" and show stats only for the scoped set. This keeps the context clear.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/components/settings/PdfUploadPanel.tsx` (673 lines, complete upload pipeline)
- Codebase analysis: `src/components/layout/FilterBar.tsx` (455 lines, modal rendering patterns)
- Codebase analysis: `src/components/filters/ActionsDropdown.tsx` (119 lines, dropdown menu pattern)
- Codebase analysis: `src/stores/exportSelectionStore.ts` (selection tracking)
- Codebase analysis: `src/stores/pdfStatusStore.ts` (PDF status tracking)
- Codebase analysis: `src/components/bulk/BulkReanalyzeModal.tsx` (modal overlay pattern)
- Codebase analysis: `src/components/layout/FilterBar.test.tsx` (existing test failures diagnosed)
- Test run output: 2 files failing (FilterBar.test.tsx: 6 tests, analysisStore.test.ts: 2 tests)

### Secondary (MEDIUM confidence)
- Project conventions: `.planning/STATE.md` decisions (Phase 11 modal patterns, store patterns)
- Project conventions: `CLAUDE.md` (stack definitions, testing conventions)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing code
- Architecture: HIGH - follows established modal + dropdown patterns from Phase 11
- Pitfalls: HIGH - all pitfalls identified from direct codebase analysis and test runs
- Integration test fixes: HIGH - root causes diagnosed from error output

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable -- internal project, no external API changes)
