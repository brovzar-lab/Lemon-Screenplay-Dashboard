# Phase 11: Bulk Operations - Research

**Researched:** 2026-03-19
**Domain:** React bulk action UI patterns, sequential async orchestration, Firestore token reuse, re-analysis pipeline integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Bulk Action Trigger Location**
- Both bulk actions (BULK-01, BULK-02) live in a single "Actions" dropdown in FilterBar, alongside the existing Export button
- Dropdown contains: "Generate Share Links", "Re-analyze Selected"
- "Re-analyze Selected" is disabled if no selected screenplay has `hasPdf=true`, with a tooltip explaining why

**Bulk Share Results UI (BULK-01)**
- A dedicated modal opens immediately after triggering "Generate Share Links"
- Modal shows all selected screenplay titles upfront as rows
- Progressive fill: each row shows a spinner until its token resolves, then displays URL + individual copy button
- Producer can copy completed rows while others are still generating
- Existing tokens reused silently — no visual distinction between new vs reused tokens
- Copy All button at the top produces a plain newline-separated list of URLs (no titles, no markdown)
- Failed rows shown in red with a per-row Retry button — Retry remains indefinitely if retries fail
- Token generation is sequential (not `Promise.all`) — LOCKED constraint

**Bulk Re-analyze Progress (BULK-02)**
- A dedicated modal opens showing full queue with per-item status (queued / analyzing / done / failed)
- Progress header: "Re-analyzing N of M..." updates as each completes
- Ineligible items (`hasPdf=false`): auto-skipped silently; modal header notes "X of Y selected are eligible. Processing X..."
- Cancel button available during processing — cancels after the current in-flight item finishes (no mid-analysis abort)
- Modal blocks until done or cancelled — no background processing, no minimize
- After completion or cancel: React Query cache invalidated in batch when modal closes
- Close button also deselects all checkboxes (`exportSelectionStore.deselectAll`)
- No retry path in modal — failed items close and requeue (producer selects again)
- BULK-02 eligible: `hasPdf=true` only — LOCKED
- Re-analysis flow: `getDownloadURL` → `fetch` → `File` → `analyzeScreenplay` — LOCKED (note: codebase already uses `getBlob` as a better CORS-safe alternative inside `reanalyzeFromStorage`; the flow is implemented, BULK-02 calls `reanalyzeFromStorage`)

**Failure Handling**
- BULK-01: continue generating remaining tokens; failed rows show red with per-row Retry; Retry remains if retry fails
- BULK-02: auto-retry once; if retry fails, mark row failed, continue batch; final summary shows "X completed, Y failed [titles]"
- BULK-02 cancellation: finishes current analysis then stops — "Cancelled — X completed before cancellation"

**CSV Export Scope Confirmation (BULK-03)**
- Export modal header updated in all modes:
  - Selected: "Exporting X selected screenplays"
  - Filtered: "Exporting X filtered screenplays"
  - All: "Exporting all X screenplays"
- Count applies to ALL formats (CSV and PDF) — not CSV-only
- Count is static (does not change based on format selector)
- Export button shows count: "Export 7 Screenplays"
- This is a text/UI fix — no data path changes

### Claude's Discretion
- Actions dropdown component implementation (positioning, animation, trigger button styling)
- Exact modal layout and visual design for share results and re-analyze progress modals (consistent with existing modal patterns)
- Share results modal: whether to show a "Generating..." count indicator in the header while tokens are resolving
- Re-analyze modal: exact per-item status row design (icon, label, timestamp)
- Whether to add `'selected'` as a new mode value to ExportModal's mode prop or derive count from `screenplays.length`

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BULK-01 | User can select N screenplays and generate share tokens for all in a single action — result is list of share URLs copyable individually or all at once | `getExistingShareToken` + `createShareToken` in `shareService.ts` exist; `shareStore.setToken` for cache; sequential loop pattern documented below |
| BULK-02 | User can select N screenplays with legacy analysis and queue for re-analysis — downloads PDFs from Firebase Storage (`hasPdf=true` only), pipes through `analyzeScreenplay`, shows "Re-analyzing N of M" progress | `reanalyzeFromStorage` in `analysisService.ts` is the complete implementation; needs wrapping loop with cancel signal + React Query invalidation |
| BULK-03 | User can export CSV with scope clearly confirmed before download — Export modal states "Exporting X selected screenplays (CSV)" with accurate count | ExportModal already receives correct `screenplays` array and `mode` prop; only text and button label need updating |
</phase_requirements>

---

## Summary

Phase 11 is almost entirely integration and UI work rather than new infrastructure. All three requirements consume existing, tested code. `shareService.ts` has `getExistingShareToken` and `createShareToken`. `analysisService.ts` has `reanalyzeFromStorage` which already implements the locked BULK-02 flow (`getBlob` → `File` → `analyzeScreenplay` → `saveAnalysis`). `ExportModal.tsx` already receives the right data — BULK-03 is purely a text fix.

The primary new work is two dedicated modals (`BulkShareModal`, `BulkReanalyzeModal`), an Actions dropdown in `FilterBar`, and a cancel-signal pattern for the re-analyze loop. The progressive-fill pattern for BULK-01 requires local React state per row (status: `pending | generating | done | failed`, plus a `url` field). The BULK-02 modal needs a cancellation ref to stop the loop between items.

**Primary recommendation:** Use a `useRef<boolean>` cancel flag (not a signal/AbortController) for BULK-02 cancellation — the current in-flight `reanalyzeFromStorage` call cannot be aborted mid-stream, so checking the ref before each iteration is sufficient and simple.

---

## Standard Stack

### Core (already in project — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zustand 5 | 5.x | Local UI state in modals (row statuses, progress) | Project standard; ephemeral pattern matches toastStore/syncStatusStore |
| React Query 5 | 5.x | Cache invalidation after BULK-02 completes | `queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY })` — established pattern |
| firebase/storage (getBlob) | existing | Download PDF from Storage in BULK-02 | Already used in `reanalyzeFromStorage`; CORS-safe without signed URL workaround |
| firebase/firestore | existing | `getExistingShareToken`, `createShareToken` | Already used in `shareService.ts` |
| navigator.clipboard | browser API | Copy URL / Copy All in BulkShareModal | Already used in ShareModal |

### No New Dependencies

All Phase 11 work uses what is already installed. The Actions dropdown can be implemented with a `useState` boolean + absolute-positioned `div` (matching the existing ShareButton popover pattern noted in STATE.md Phase 05).

**Installation:**
```bash
# No new packages needed
```

---

## Architecture Patterns

### Recommended Project Structure

New files to create:
```
src/components/
└── filters/
    └── ActionsDropdown.tsx       # "Actions" dropdown button + menu (mounts in FilterBar)
src/components/bulk/
    ├── BulkShareModal.tsx        # BULK-01: progressive share URL generation
    ├── BulkReanalyzeModal.tsx    # BULK-02: re-analysis progress queue
    └── index.ts                  # barrel export
```

Existing files to modify:
```
src/components/layout/FilterBar.tsx     # mount ActionsDropdown + two new modal states
src/components/export/ExportModal.tsx   # BULK-03: update header text + export button label
```

### Pattern 1: Modal Shell (established in project)

All modals share this shell — `BulkShareModal` and `BulkReanalyzeModal` must match it exactly:

```tsx
// Source: ExportModal.tsx / ShareModal.tsx — established project pattern
<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
  {/* Backdrop */}
  <div className="fixed inset-0 bg-black-950/80 backdrop-blur-sm" onClick={onClose} />
  {/* Modal panel */}
  <div className="relative w-full max-w-md glass border border-gold-500/20 rounded-xl overflow-hidden animate-scale-in">
    {/* Header: flex items-center justify-between p-4 border-b border-black-700 */}
    {/* Content: p-4 space-y-4 */}
    {/* Footer: flex items-center justify-end gap-3 p-4 border-t border-black-700 bg-black-900/30 */}
  </div>
</div>
```

The backdrop `onClick={onClose}` should be **disabled** for BulkReanalyzeModal while processing is in flight (modal blocks).

### Pattern 2: Sequential Async Loop with Cancel Signal (BULK-01 and BULK-02)

```tsx
// BULK-01: sequential token generation
const cancelledRef = useRef(false);

async function runBulkShare(screenplays: Screenplay[]) {
  cancelledRef.current = false;
  for (const sp of screenplays) {
    if (cancelledRef.current) break;
    setRowStatus(sp.id, 'generating');
    try {
      // Check cache first
      const cached = useShareStore.getState().tokens[sp.id];
      if (cached) {
        const url = `${window.location.origin}/share/${cached.token}`;
        setRowUrl(sp.id, url);
        setRowStatus(sp.id, 'done');
        continue;
      }
      // Check Firestore for existing token
      const existing = await getExistingShareToken(sp.id);
      if (existing) {
        const url = `${window.location.origin}/share/${existing.token}`;
        useShareStore.getState().setToken(sp.id, existing);
        setRowUrl(sp.id, url);
        setRowStatus(sp.id, 'done');
        continue;
      }
      // Create new token
      const result = await createShareToken(sp.id, sp, false);
      useShareStore.getState().setToken(sp.id, { token: result.token, screenplayId: sp.id, screenplayTitle: sp.title, includeNotes: false, createdAt: new Date().toISOString() });
      setRowUrl(sp.id, result.url);
      setRowStatus(sp.id, 'done');
    } catch {
      setRowStatus(sp.id, 'failed');
      // Continue to next — don't break on failure
    }
  }
}
```

```tsx
// BULK-02: sequential re-analysis with cancel
const cancelledRef = useRef(false);

async function runBulkReanalyze(eligible: Screenplay[], apiKey: string) {
  cancelledRef.current = false;
  let completed = 0;
  for (const sp of eligible) {
    if (cancelledRef.current) {
      setSummary(`Cancelled — ${completed} completed before cancellation`);
      break;
    }
    setItemStatus(sp.id, 'analyzing');
    let success = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await reanalyzeFromStorage(sp, 'sonnet', apiKey);
        success = true;
        break;
      } catch {
        if (attempt === 1) break; // second failure — give up
      }
    }
    if (success) {
      setItemStatus(sp.id, 'done');
      completed++;
    } else {
      setItemStatus(sp.id, 'failed');
    }
    setProgress(completed);
  }
  // Batch invalidate React Query cache WHEN MODAL CLOSES (not here)
}

// On modal close / done:
function handleClose() {
  queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY });
  useExportSelectionStore.getState().deselectAll();
  onClose();
}
```

### Pattern 3: Row Status State (BULK-01 modal)

Use `useState<Map<string, RowState>>` — keyed by screenplay ID for O(1) updates without re-rendering the entire list:

```tsx
type ShareRowStatus = 'pending' | 'generating' | 'done' | 'failed';
interface ShareRow { status: ShareRowStatus; url?: string; }

const [rows, setRows] = useState<Record<string, ShareRow>>(() =>
  Object.fromEntries(screenplays.map((sp) => [sp.id, { status: 'pending' }]))
);

function setRowStatus(id: string, status: ShareRowStatus, url?: string) {
  setRows((prev) => ({ ...prev, [id]: { status, url } }));
}
```

### Pattern 4: Actions Dropdown in FilterBar

Follow the existing `ShareButton` inline popover pattern (STATE.md Phase 05 decision: "uses inline absolute-positioned popover, no portal needed"):

```tsx
const [isActionsOpen, setIsActionsOpen] = useState(false);
const actionsRef = useRef<HTMLDivElement>(null);

// Close on outside click — useEffect with document listener
// Identical to pattern used in FilterPanel/SortPanel toggle
```

Disable "Re-analyze Selected" when `eligible.length === 0` (no selected screenplay has `hasPdf=true`). Show tooltip via `title` attribute.

### Pattern 5: BULK-03 ExportModal Text Fix

The `mode` prop currently maps as follows:
```tsx
// FilterBar.tsx line 378 — existing:
mode={hasExportSelection ? 'multiple' : hasActiveFilters ? 'filtered' : 'multiple'}
// Bug: 'multiple' used for both selected and unselected-with-no-filters
// Fix: change last 'multiple' → 'all' and add 'all' case to ExportModal
```

In ExportModal, update the summary text and button:
```tsx
// Current: "Exporting N screenplays (selected)"
// New behavior based on mode:
const scopeLabel =
  mode === 'selected'  ? `Exporting ${screenplays.length} selected screenplays` :
  mode === 'filtered'  ? `Exporting ${screenplays.length} filtered screenplays` :
  /* 'all' */            `Exporting all ${screenplays.length} screenplays`;

// Button:
`Export ${screenplays.length} Screenplay${screenplays.length !== 1 ? 's' : ''}`
```

Note: Claude's Discretion allows adding `'selected'` as a new mode value OR deriving from `screenplays.length`. The cleanest approach is adding `'selected'` to the union type and updating the `FilterBar.tsx` ternary.

### Anti-Patterns to Avoid

- **Using `Promise.all` for token generation:** Causes Firestore burst writes — locked as sequential. Do not use.
- **Aborting `reanalyzeFromStorage` mid-call:** The function calls the Anthropic API which cannot be cancelled. Cancellation only takes effect between items.
- **Invalidating React Query cache inside the loop:** Causes N cache-busting refetches. Invalidate once when modal closes.
- **Backdrop click to close BULK-02 while processing:** Modal must block. Disable backdrop `onClick` while `isProcessing === true`.
- **Using `queryClient.resetQueries` for post-reanalyze:** Use `invalidateQueries` (background refetch), not `resetQueries` (removes cache entirely, shows loading state). The screenplay grid should stay populated.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF download from Firebase Storage | Custom fetch with signed URLs | `getBlob(ref)` from `firebase/storage` | Already in `reanalyzeFromStorage` — CORS-safe, no signed URL gymnastics |
| Full re-analysis pipeline | Custom fetch → parse → AI call loop | `reanalyzeFromStorage(screenplay, model, apiKey)` | Already implements getBlob → File → analyzeScreenplay → saveAnalysis with progress callbacks |
| Token reuse check | Custom Firestore query | `getExistingShareToken(screenplayId)` | Already queries `shared_views` collection by `screenplayId` |
| Clipboard copy | execCommand or custom | `navigator.clipboard.writeText(url)` | Already used in ShareModal with `copied/error` feedback pattern |
| Share URL construction | Custom path builder | `${window.location.origin}/share/${token}` | Established in `shareService.ts` `getShareBaseUrl()` |
| React Query cache bust | Manual state update | `queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY })` | Pattern from `useDeleteScreenplays` |

**Key insight:** `reanalyzeFromStorage` in `analysisService.ts` is a complete, tested pipeline. BULK-02's entire backend is one function call per screenplay — the bulk modal only adds the loop, cancel signal, and progress UI around it.

---

## Common Pitfalls

### Pitfall 1: shareStore cache miss for token reuse
**What goes wrong:** BULK-01 checks `shareStore.tokens[sp.id]` for a cached token, but the cache is session-only and may be empty on first load. Falls through to Firestore every time — correct behavior, but means each item incurs a `getExistingShareToken` query even if they were just generated.
**Why it happens:** `shareStore` is ephemeral (no persist middleware — project pattern).
**How to avoid:** The BULK-01 loop correctly falls through: cache → `getExistingShareToken` → `createShareToken`. Populate `shareStore` with the result of `getExistingShareToken` so subsequent per-card ShareButton uses are fast.
**Warning signs:** Multiple Firestore reads for the same screenplay in the same session.

### Pitfall 2: `hasPdf` field vs pdfStatusStore scan data
**What goes wrong:** BULK-02 eligibility check uses `screenplay.hasPdf` but `pdfStatusStore` may have a more current scan result showing `missing`. If you use `pdfStatusStore` for eligibility, you get more accurate results but add a dependency.
**Why it happens:** `hasPdf` is a Firestore field set at upload time; `pdfStatusStore` is a live scan.
**How to avoid:** For BULK-02 eligibility, use `sp.hasPdf === true` (matches the locked constraint). The pdfStatusStore is optimistic-scan data — don't add the dependency; the Firestore field is the authoritative source for `reanalyzeFromStorage`'s fallback logic.
**Warning signs:** Screenplays showing as eligible that then fail with "PDF not found in Firebase Storage."

### Pitfall 3: Re-analyze saves to the wrong screenplay record
**What goes wrong:** `reanalyzeFromStorage` calls `saveAnalysis(result.raw)` which keys by `source_file`. If the reconstructed storage path uses a different sanitized name than the original, the new analysis lands as a new record rather than overwriting.
**Why it happens:** `buildPdfStoragePath` in `shareService.ts` and the path reconstruction in `reanalyzeFromStorage` use the same sanitization logic — they should match. But if `screenplay.title` differs from `screenplay.sourceFile`, the path may mismatch.
**How to avoid:** `reanalyzeFromStorage` already tries a fallback path (`screenplays/${safeName}.pdf`) — trust it. No special handling needed.
**Warning signs:** Duplicate screenplay entries appearing after re-analysis.

### Pitfall 4: BULK-03 mode prop collision — 'multiple' used for two cases
**What goes wrong:** Current `FilterBar.tsx` line 378 passes `mode='multiple'` for both "has selection" and "no selection, no filters" cases. ExportModal cannot distinguish "exporting all" from "exporting selected" with the same mode value.
**Why it happens:** BULK-03 was not a requirement when ExportModal was built.
**How to avoid:** Add `'all'` as a new valid mode value (or `'selected'`). Update the union type in `ExportModalProps` and the ternary in `FilterBar.tsx`. This is a two-line type fix + one-line render fix.
**Warning signs:** Export button says "Exporting N selected screenplays" when nothing is selected.

### Pitfall 5: Cancel race condition in BULK-02
**What goes wrong:** User clicks Cancel, then clicks Close before the current in-flight `reanalyzeFromStorage` finishes. If `handleClose` calls `queryClient.invalidateQueries` immediately, the in-progress analysis result may not yet be saved.
**Why it happens:** `reanalyzeFromStorage` calls `saveAnalysis` at the end — if the modal is closed before that resolves, the save still completes (it's a detached promise) but the cache invalidation fires before the save lands.
**How to avoid:** Keep the Cancel / Close button disabled until the in-flight item finishes (the CONTEXT.md decision: "cancels after the current in-flight item finishes"). Only enable Close when `isProcessing === false`. Invalidate cache on Close, not on Cancel click.
**Warning signs:** Version badge doesn't update for the last in-flight screenplay after cancellation.

### Pitfall 6: Copy All button produces wrong format
**What goes wrong:** "Copy All" joins with `\n`, but some clipboard consumers strip newlines or treat them as spaces.
**Why it happens:** Plain-text clipboard writes use `\n` for line breaks.
**How to avoid:** Use `urls.join('\n')` — this is the locked specification. Do not add markdown, titles, or HTML.

---

## Code Examples

Verified patterns from existing codebase:

### React Query cache invalidation after write
```typescript
// Source: src/hooks/useScreenplays.ts — useDeleteScreenplays pattern
queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY });
```

### Deselect all checkboxes
```typescript
// Source: src/stores/exportSelectionStore.ts
useExportSelectionStore.getState().deselectAll();
```

### Populate shareStore cache
```typescript
// Source: src/stores/shareStore.ts
useShareStore.getState().setToken(screenplayId, sharedView);
```

### reanalyzeFromStorage call signature
```typescript
// Source: src/lib/analysisService.ts
await reanalyzeFromStorage(
  screenplay,           // Screenplay object
  'sonnet',            // model: 'sonnet' | 'opus'
  apiKey,              // from useApiConfigStore.getState().apiKey
  (p) => { ... }      // optional progress callback: AnalysisProgress
);
```

### getExistingShareToken call
```typescript
// Source: src/lib/shareService.ts
const existing = await getExistingShareToken(screenplayId);
// Returns SharedView | null — gates authReady internally
```

### createShareToken call (no notes for bulk)
```typescript
// Source: src/lib/shareService.ts
const { token, url } = await createShareToken(
  screenplayId,
  screenplay,
  false,    // includeNotes = false for bulk
  undefined // no notes
);
```

### Ephemeral Zustand store (no persist)
```typescript
// Source: toastStore.ts / syncStatusStore.ts pattern
export const useBulkOperationStore = create<BulkState>((set) => ({
  // state...
}));
// No persist() wrapper — matches project convention for operation-scoped stores
```

### BULK-03: FilterBar mode fix
```tsx
// Source: src/components/layout/FilterBar.tsx line 374-379
// Current:
mode={hasExportSelection ? 'multiple' : hasActiveFilters ? 'filtered' : 'multiple'}
// Fixed:
mode={hasExportSelection ? 'selected' : hasActiveFilters ? 'filtered' : 'all'}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getDownloadURL` + `fetch` (CORS issues) | `getBlob(ref)` | Phase 06 / analysisService.ts | `getBlob` is CORS-safe for authenticated Firebase Storage reads — use it, not `getDownloadURL` + `fetch` |
| Global share token cache miss on load | `getExistingShareToken` fallback | Phase 05 | Always check Firestore if not in cache |
| `queryClient.resetQueries` after writes | `queryClient.invalidateQueries` | Project pattern | `invalidateQueries` refetches in background; `resetQueries` removes cached data entirely and shows loading |

---

## Open Questions

1. **API key availability in BulkReanalyzeModal**
   - What we know: `useApiConfigStore.getState().apiKey` provides the Anthropic API key; `canMakeRequest()` checks budget limits
   - What's unclear: Should BULK-02 check `canMakeRequest()` before each item, or just before starting the batch? If daily request limit is 100 and N=50, it may exceed the budget mid-batch.
   - Recommendation: Check `apiKey.length > 0` before starting; do not check `canMakeRequest()` per-item (budget tracking is approximate anyway and would complicate the loop). Add a pre-flight guard that shows an error if no API key is configured.

2. **Re-analyze model selection**
   - What we know: `reanalyzeFromStorage` accepts `'sonnet' | 'opus'`; CONTEXT.md doesn't specify which model to use for bulk
   - What's unclear: Should the modal let the producer choose, or always use Sonnet?
   - Recommendation: Default to `'sonnet'` (faster, cheaper for bulk). This is Claude's Discretion territory.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (globals: true, happy-dom) |
| Config file | `vitest.config.ts` at project root |
| Quick run command | `npm run test:run -- --reporter=verbose src/` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BULK-01 | Sequential token generation: reuses existing token, creates new when none | unit | `npm run test:run -- src/lib/shareService.test.ts` | ✅ (extend existing) |
| BULK-01 | shareStore populated after bulk generation | unit | `npm run test:run -- src/stores/shareStore.test.ts` | ✅ (extend existing) |
| BULK-01 | Copy All produces newline-separated URLs (no titles) | unit | `npm run test:run -- src/components/bulk/BulkShareModal.test.tsx` | ❌ Wave 0 |
| BULK-02 | Ineligible items skipped (hasPdf=false excluded) | unit | `npm run test:run -- src/components/bulk/BulkReanalyzeModal.test.tsx` | ❌ Wave 0 |
| BULK-02 | Cancel flag stops loop after current in-flight item | unit | `npm run test:run -- src/components/bulk/BulkReanalyzeModal.test.tsx` | ❌ Wave 0 |
| BULK-02 | Auto-retry once on failure; marks failed after second attempt | unit | `npm run test:run -- src/components/bulk/BulkReanalyzeModal.test.tsx` | ❌ Wave 0 |
| BULK-02 | React Query invalidated when modal closes | unit | `npm run test:run -- src/components/bulk/BulkReanalyzeModal.test.tsx` | ❌ Wave 0 |
| BULK-02 | deselectAll called when modal closes | unit | `npm run test:run -- src/components/bulk/BulkReanalyzeModal.test.tsx` | ❌ Wave 0 |
| BULK-03 | Export modal shows "Exporting X selected screenplays" for selected mode | unit | `npm run test:run -- src/components/export/ExportModal.test.tsx` | ❌ Wave 0 |
| BULK-03 | Export modal shows "Exporting all X screenplays" for all mode | unit | `npm run test:run -- src/components/export/ExportModal.test.tsx` | ❌ Wave 0 |
| BULK-03 | Export button label shows "Export N Screenplays" | unit | `npm run test:run -- src/components/export/ExportModal.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:run -- src/components/bulk/ src/components/export/ExportModal.test.tsx`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/bulk/BulkShareModal.test.tsx` — covers BULK-01 row status, Copy All format, retry behavior
- [ ] `src/components/bulk/BulkReanalyzeModal.test.tsx` — covers BULK-02 eligibility filter, cancel signal, retry-once, React Query invalidation, deselectAll
- [ ] `src/components/export/ExportModal.test.tsx` — covers BULK-03 mode-based header text and button label
- [ ] `src/components/bulk/index.ts` — barrel export

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read — `src/lib/shareService.ts` — `getExistingShareToken`, `createShareToken`, `authReady` gating, URL construction pattern
- Direct codebase read — `src/lib/analysisService.ts` — `reanalyzeFromStorage` full implementation including `getBlob` path, `saveAnalysis` call, progress callback shape
- Direct codebase read — `src/stores/exportSelectionStore.ts` — `selectedIds`, `deselectAll`, `useExportSelectionCount`
- Direct codebase read — `src/stores/shareStore.ts` — `setToken`, `removeToken`, ephemeral pattern
- Direct codebase read — `src/stores/apiConfigStore.ts` — `apiKey`, `canMakeRequest` availability
- Direct codebase read — `src/hooks/useScreenplays.ts` — `SCREENPLAYS_QUERY_KEY`, `invalidateQueries` pattern
- Direct codebase read — `src/components/layout/FilterBar.tsx` — current modal mounting pattern, export mode ternary
- Direct codebase read — `src/components/export/ExportModal.tsx` — current mode prop, text rendering
- Direct codebase read — `src/components/share/ShareModal.tsx` — modal shell pattern, clipboard copy with feedback

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — ephemeral store pattern, shareStore phase decisions, sequential Firestore constraint rationale
- `.planning/phases/11-bulk-operations/11-CONTEXT.md` — all locked decisions verified against codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in package.json via CLAUDE.md; all APIs confirmed in source files
- Architecture: HIGH — all integration points read directly from source; no guesswork
- Pitfalls: HIGH — pitfalls derived from reading actual codebase logic (mode prop collision verified in FilterBar.tsx line 378)

**Research date:** 2026-03-19
**Valid until:** Stable — this is internal codebase knowledge, not external library docs. Valid until source files change.
