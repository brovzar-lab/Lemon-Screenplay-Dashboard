# Phase 9: Filter UX Simplification + File Status Badges — Research

**Researched:** 2026-03-18
**Domain:** React component restructuring, Zustand state, UI badge patterns
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FILTER-01 | FilterPanel opens with Genre & Theme expanded by default (not Core Scores) | `activeSection` initial value changed from `'scores'` to `'genre'`; one-line change in FilterPanel.tsx |
| FILTER-02 | 7 dimension sliders hidden behind "Advanced" disclosure toggle, collapsed by default | Wrap existing Dimension Scores `<Section>` in a new `<AdvancedDisclosure>` block; accordion state drives visibility |
| FILTER-03 | "Filters" button in FilterBar shows count badge of active Advanced-section filters | Derive count from the 7 `*.enabled` flags in filterStore; render badge on the button in FilterBar.tsx |
| FILTER-04 | FilterPanel auto-expands any section with an active filter on open | Compute initial section from filter state at mount; needs a `useMemo` or derived default before first render |
| FILE-01 | Storage-status badge on each ScreenplayCard (found/missing), falls back to hasPdf | Read `pdfStatusStore.statuses[screenplay.id]` + `hasScanResult`; render small inline badge in ScreenplayCard.tsx |
| FILE-02 | Analysis-version badge on each ScreenplayCard, shows legacy vs current | Check `screenplay.analysisVersion` against the known current string (`v6_core_lenses` / `v6_unified`); render badge when legacy |
| FILE-03 | "Missing PDF" chip in FilterBar quick-access row with count badge | Add chip to `FILTER_CHIPS` array or render separately in FilterBar; count driven by `pdfStatusStore` or `hasPdf` fallback over current filtered set |
</phase_requirements>

---

## Summary

Phase 9 is a pure UI/UX refactor with zero new backend work. All data already exists: `pdfStatusStore` holds live scan results (or falls back to `hasPdf`), `filterStore` holds all dimension-slider states, and `screenplay.analysisVersion` carries the version string. The phase ships together because both filter changes and badge work touch `ScreenplayCard.tsx` and share `pdfStatusStore` as a data source.

The FilterPanel changes are low-risk: three modifications to the existing accordion component — change the default open section (FILTER-01), wrap Dimension Scores in a collapsible "Advanced" block (FILTER-02), and derive the initial section from active-filter state at mount (FILTER-04). The only subtlety is that FILTER-04 must not break the existing accordion's single-section open model.

The badge work requires careful placement inside `ScreenplayCard` (a dense card with established layout zones) and a count-derivation function for the FilterBar chip (FILE-03). The "current version" string is `v6_core_lenses` or `v6_unified` per `normalize.ts` line 403 — the badge logic must match both.

**Primary recommendation:** Work in three clean task groups: (1) FilterPanel accordion changes, (2) FilterBar button badge + Missing PDF chip, (3) ScreenplayCard badges. The groups share no runtime coupling, so they can be planned as three separate tasks with minimal merge risk.

---

## Standard Stack

### Core (already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zustand | 5 | Read `pdfStatusStore`, `filterStore` | All state is already Zustand; no prop-drilling needed |
| React 19 | 19 | Component hooks, `useState`, `useMemo` | Existing framework |
| Tailwind CSS 4 | 4 | All styling — chip, badge, disclosure toggle | Project constraint: Tailwind only, no inline styles |
| clsx | (bundled) | Conditional class composition | Already used throughout cards and panels |

### Patterns in Use

| Pattern | Where Used | Phase 9 Relevance |
|---------|-----------|-------------------|
| Accordion single-section | FilterPanel `activeSection` state | FILTER-01, FILTER-02, FILTER-04 |
| `Section` component (local) | FilterPanel.tsx lines 420–459 | Advanced disclosure wraps this |
| Zustand store selectors | FilterBar, FilterPanel | FILTER-03 count derives from store |
| `pdfStatusStore.statuses[id]` | `useFilteredScreenplays.ts` line 181 | Same access pattern for FILE-01 badge |
| `usePdfStatusStore` hook | FilterPanel.tsx line 84 | Same hook used in ScreenplayCard for FILE-01 |

---

## Architecture Patterns

### Recommended File Touch List

```
src/components/filters/FilterPanel.tsx   # FILTER-01, FILTER-02, FILTER-04
src/components/layout/FilterBar.tsx      # FILTER-03, FILE-03
src/components/screenplay/ScreenplayCard.tsx   # FILE-01, FILE-02
src/components/filters/FilterPanel.test.tsx    # test updates for accordion changes
src/components/screenplay/ScreenplayCard.test.tsx  # new badge tests
```

No new files strictly required. Badges are small enough to inline into existing components; no new component files needed unless the planner prefers extraction for testability.

### Pattern 1: Default Open Section (FILTER-01)

**What:** Change `useState<string | null>('scores')` initial value.
**When to use:** Simple one-liner — the accordion already supports any section key.

```typescript
// FilterPanel.tsx line 36 — BEFORE
const [activeSection, setActiveSection] = useState<string | null>('scores');

// AFTER
const [activeSection, setActiveSection] = useState<string | null>('genre');
```

**Test impact:** `FilterPanel.test.tsx` line 78–81 asserts "opens Core Scores section by default" and "Genre & Theme section should be closed initially" — both must be inverted.

### Pattern 2: Advanced Disclosure Toggle (FILTER-02)

**What:** Add a second controlled boolean `isAdvancedOpen` alongside `activeSection`. The Dimension Scores section becomes a child of an "Advanced" disclosure, not a peer section.
**When to use:** The requirement says "hidden behind an 'Advanced' disclosure toggle" — this is a collapsible wrapper around the existing Section, not a new filter section.

```typescript
// FilterPanel.tsx — new state
const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

// In JSX, before the Dimension Scores <Section>:
<AdvancedDisclosure
  isOpen={isAdvancedOpen}
  onToggle={() => setIsAdvancedOpen((prev) => !prev)}
>
  {/* existing Dimension Scores <Section> unchanged */}
</AdvancedDisclosure>
```

The `AdvancedDisclosure` is a small inline component (like `Section`) that renders a header button + collapsible children. It does not participate in the single-section accordion; it is a separate boolean toggle. This preserves the accordion for the 5 visible sections while the Advanced block is independent.

### Pattern 3: Active-Filter Auto-Expand (FILTER-04)

**What:** Derive the initial `activeSection` value from current filter state at mount. The `useMemo` runs once on mount to select which section should be open.
**Key constraint:** The accordion only opens ONE section. Priority order should be: genre/themes first if active, then scores, then display options, then Advanced (which is a separate boolean).

```typescript
// Compute initial section from filter state
const initialSection = useMemo((): string | null => {
  if (genres.length > 0 || themes.length > 0) return 'genre';
  if (categories.length > 0) return 'category';
  if (weightedScoreRange.enabled || cvsRange.enabled) return 'scores';
  if (marketPotentialRange.enabled) return 'producer';
  return 'genre'; // FILTER-01 default
}, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally mount-only

const [activeSection, setActiveSection] = useState<string | null>(initialSection);

// For the Advanced disclosure auto-expand:
const initialAdvanced = useMemo(() =>
  [conceptRange, structureRange, protagonistRange, supportingCastRange,
   dialogueRange, genreExecutionRange, originalityRange].some((r) => r.enabled),
  []); // eslint-disable-line react-hooks/exhaustive-deps
const [isAdvancedOpen, setIsAdvancedOpen] = useState(initialAdvanced);
```

**Warning:** Using `useMemo` with empty deps is a code smell but is the correct pattern here — the initial value should reflect the state at mount time only, not recompute on every render. Alternative: compute in the `useState` initializer directly.

### Pattern 4: FilterBar Advanced-Filter Count Badge (FILTER-03)

**What:** Derive a count of active "Advanced" filters (the 7 dimension sliders) and render it on the "Filters" button in FilterBar.
**Where:** `FilterBar.tsx` — the "Advanced Filters Button" block at line 219–229.

```typescript
// In FilterBar.tsx — derive from filterStore
const advancedFilterCount = useFilterStore((s) =>
  [
    s.conceptRange.enabled,
    s.structureRange.enabled,
    s.protagonistRange.enabled,
    s.supportingCastRange.enabled,
    s.dialogueRange.enabled,
    s.genreExecutionRange.enabled,
    s.originalityRange.enabled,
  ].filter(Boolean).length
);

// On the button:
<button onClick={() => setIsFilterPanelOpen(true)} className="btn btn-secondary text-sm">
  <svg ...Filters icon... />
  Filters
  {advancedFilterCount > 0 && (
    <span className="px-1.5 py-0.5 rounded-full bg-gold-500/20 text-gold-400 text-xs font-bold">
      {advancedFilterCount}
    </span>
  )}
</button>
```

This badge pattern exactly matches the existing Sort button badge at FilterBar.tsx line 212–216 — use the same markup.

### Pattern 5: Missing PDF Chip in FilterBar (FILE-03)

**What:** A chip in the quick-filter row that sets `missingPdfOnly` in filterStore, with a count badge showing how many screenplays are missing their PDF.
**Where:** The `{/* Quick Filter Chips */}` block in FilterBar.tsx (line 268+). Render after the existing recommendation chips.

```typescript
// Need access to: missingPdfOnly setter, pdfStatusStore data, and the
// full screenplays list to compute count.
const missingPdfOnly = useFilterStore((s) => s.missingPdfOnly);
const setMissingPdfOnly = useFilterStore((s) => s.setMissingPdfOnly);
const pdfStatuses = usePdfStatusStore((s) => s.statuses);
const hasScanResult = usePdfStatusStore((s) => s.hasScanResult);

// Compute count from the full (unfiltered) screenplays list
const missingPdfCount = useMemo(() => {
  if (!screenplays) return 0;
  return screenplays.filter((sp) => {
    if (hasScanResult) return pdfStatuses[sp.id] === 'missing' || pdfStatuses[sp.id] === undefined;
    return sp.hasPdf !== true;
  }).length;
}, [screenplays, pdfStatuses, hasScanResult]);

// Chip (render conditionally — only when count > 0 OR filter is active):
{(missingPdfCount > 0 || missingPdfOnly) && (
  <button
    data-active={missingPdfOnly ? 'true' : 'false'}
    onClick={() => setMissingPdfOnly(!missingPdfOnly)}
    className={`chip cursor-pointer transition-all ${missingPdfOnly
      ? 'bg-amber-500 border-amber-500 !text-black-950 font-semibold'
      : 'hover:border-amber-500'
    }`}
  >
    Missing PDF
    {missingPdfCount > 0 && (
      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-black-800 text-amber-300 text-xs font-bold">
        {missingPdfCount}
      </span>
    )}
  </button>
)}
```

`screenplays` is already a prop on `FilterBar` (the full unfiltered list from `useScreenplays`). Use it — do not use the filtered list or the count will shrink when other filters are active.

### Pattern 6: PDF Storage-Status Badge on ScreenplayCard (FILE-01)

**What:** A small badge on the card showing whether the PDF exists in Firebase Storage. Falls back to `hasPdf` field when no scan has run.
**Where:** Inside `ScreenplayCard.tsx`, in the Tags area (line 210–215) alongside the existing chips, or below the footer scores — the tags row is the natural location.

```typescript
// In ScreenplayCard.tsx — add store access at top of component
import { usePdfStatusStore } from '@/stores/pdfStatusStore';

// Inside ScreenplayCard component:
const pdfStatuses = usePdfStatusStore((s) => s.statuses);
const hasScanResult = usePdfStatusStore((s) => s.hasScanResult);

// Derive badge state
const pdfBadgeStatus: 'found' | 'missing' | 'unknown' = (() => {
  if (hasScanResult) {
    const live = pdfStatuses[screenplay.id];
    if (live === 'found') return 'found';
    if (live === 'missing') return 'missing';
    return 'unknown'; // checking or not yet scanned
  }
  // Fallback to Firestore field
  if (screenplay.hasPdf === true) return 'found';
  if (screenplay.hasPdf === false) return 'missing';
  return 'unknown';
})();

// Badge JSX (render only when status is known):
{pdfBadgeStatus !== 'unknown' && (
  <span
    className={clsx(
      'chip text-xs',
      pdfBadgeStatus === 'found'
        ? 'border-emerald-500/40 text-emerald-400'
        : 'border-amber-500/40 text-amber-400'
    )}
    title={pdfBadgeStatus === 'found' ? 'PDF in Storage' : 'PDF missing from Storage'}
  >
    {pdfBadgeStatus === 'found' ? 'PDF ✓' : 'No PDF'}
  </span>
)}
```

Place in the tags `<div>` at line 210 alongside `chip-genre`, `chip-budget`, and collection chip.

### Pattern 7: Analysis-Version Badge on ScreenplayCard (FILE-02)

**What:** A badge indicating legacy vs current engine version. Current = `v6_core_lenses` OR `v6_unified`. Legacy = anything else (e.g. `v5`, `v6.0`).
**When to use:** Only show the badge when the version is legacy. Current-version cards should not display noisy "Current" labels.

```typescript
// In ScreenplayCard.tsx — derive from screenplay.analysisVersion
const CURRENT_VERSIONS = new Set(['v6_core_lenses', 'v6_unified']);
const isLegacyVersion = screenplay.analysisVersion
  ? !CURRENT_VERSIONS.has(screenplay.analysisVersion)
  : false; // no version = treated as legacy-unknown but don't badge

// Badge JSX — place in tags row, only when legacy:
{isLegacyVersion && (
  <span
    className="chip text-xs border-black-600/40 text-black-500"
    title={`Analyzed with ${screenplay.analysisVersion} — re-analyze for current engine`}
  >
    Legacy
  </span>
)}
```

The `factories.ts` test factory uses `analysisVersion: 'v5'` by default — existing tests will see the legacy badge. Add a test case to confirm legacy badge renders and current-version badge does not.

### Anti-Patterns to Avoid

- **Do not subscribe the entire filterStore in ScreenplayCard.** Cards are numerous; subscribing each to the full filterStore causes N re-renders on any filter change. Use `usePdfStatusStore` selector for `statuses[screenplay.id]` and `hasScanResult` only.
- **Do not recompute `isAdvancedOpen` on every render.** Use the `useState` initializer (function form) rather than reacting to store changes — Advanced state is UI state, not filter state.
- **Do not use `useFilteredScreenplays` in FilterBar for the missing PDF count.** That hook returns the filtered list. The count badge should reflect the total number of screenplays with missing PDFs, independent of other active filters.
- **Do not break the `clearStatuses` pdfStatusStore flow.** If a rescan is triggered, `statuses` empties and `hasScanResult` goes false — the fallback logic in badges must handle this gracefully (show 'unknown', not 'missing').
- **Tailwind only.** No inline styles, no CSS modules. All badge styling via `clsx` + Tailwind classes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Active filter count logic | Custom traversal | Direct array of `.enabled` booleans `.filter(Boolean).length` | The pattern already exists in FilterPanel.tsx lines 91–105 |
| PDF status lookup | New Firestore queries | `pdfStatusStore.statuses[id]` | Store already populated by PdfUploadPanel scan; zero new network calls |
| Version detection | String regex | `Set(['v6_core_lenses', 'v6_unified']).has(screenplay.analysisVersion)` | Exact match; `normalize.ts` line 403 confirms both valid current strings |
| Chip active indicator animation | Custom CSS | Existing `data-active` + sliding indicator pattern in FilterBar | The sliding indicator at FilterBar line 271–277 already tracks chips via `data-active` |

---

## Common Pitfalls

### Pitfall 1: FilterPanel Test Suite Breakage

**What goes wrong:** Tests in `FilterPanel.test.tsx` assert the CURRENT behavior — "opens Core Scores by default" (line 77–81), "Genre & Theme closed initially" (line 87–88), "closes Core Scores when another section clicked" (line 97–108). Changing FILTER-01 breaks all three without touching tests.

**Why it happens:** Tests assert on initial rendered state, which directly reflects the `useState` initializer.

**How to avoid:** Update tests SIMULTANEOUSLY with the source change in the same task. The test changes are simple inversions: "Genre & Theme should be open", "Core Scores should be closed initially".

**Warning signs:** If tests pass before the feature is implemented, the test update was wrong.

### Pitfall 2: FILTER-04 and FILTER-01 Conflict

**What goes wrong:** FILTER-04 (auto-expand section with active filter) overrides FILTER-01 (Genre & Theme as default) only when some other section has an active filter. If the implementation computes the initial section incorrectly, the panel might open on "scores" or "display" when genre/theme filters are also active.

**Why it happens:** Priority logic ambiguity. If `weightedScoreRange.enabled && genres.length > 0`, which wins?

**How to avoid:** Establish explicit priority order: (1) any active dimension range → Advanced disclosure auto-opens, (2) active genre/theme → 'genre', (3) active core scores → 'scores', (4) fallback → 'genre'. Document this order in a code comment.

### Pitfall 3: Missing PDF Count Uses Filtered List

**What goes wrong:** If `missingPdfCount` is computed from `filteredScreenplays` (from `useFilteredScreenplays`), the count badge on the chip drops as other filters narrow the grid, misleading the user about how many total screenplays have no PDF.

**Why it happens:** FilterBar already has `screenplays` prop (the unfiltered list) and `filteredCount` — it's easy to accidentally use `filteredCount`.

**How to avoid:** Explicitly use the `screenplays` prop (the full unfiltered list passed to FilterBar) as the basis for the count.

### Pitfall 4: pdfStatusStore Subscription Causing Card Re-renders

**What goes wrong:** If `ScreenplayCard` subscribes to the entire `statuses` object via `usePdfStatusStore((s) => s.statuses)`, every scan update to ANY screenplay triggers a re-render of ALL cards simultaneously — visible jank with 500+ cards.

**Why it happens:** Zustand equality check on the full `statuses` object fails on any key update.

**How to avoid:** Subscribe with a specific selector: `usePdfStatusStore((s) => s.statuses[screenplay.id])`. Zustand performs a shallow equality check on the selected value, so only the card whose screenplay was updated re-renders. Also subscribe `hasScanResult` separately.

```typescript
const myPdfStatus = usePdfStatusStore((s) => s.statuses[screenplay.id]);
const hasScanResult = usePdfStatusStore((s) => s.hasScanResult);
```

### Pitfall 5: Advanced Disclosure Not Counting in FilterPanel Header Count

**What goes wrong:** The "X filters active" counter in the FilterPanel header (line 91–105) already includes the 7 dimension ranges. If Advanced is collapsed and the counter shows "3 filters active" but the user can't see the sliders, they will be confused about what's active.

**Why it happens:** The header counter and FILTER-03 (FilterBar button badge) both count dimension filters but in different scopes.

**How to avoid:** The panel header count should KEEP including dimension filters (it already does). FILTER-03 is specifically the FilterBar button badge — a SEPARATE concern. These two do not conflict; document clearly that both show dimension filter counts but at different levels of UI.

---

## Code Examples

Verified patterns from the existing codebase:

### Zustand Zustand store selector pattern (ScreenplayCard-safe)
```typescript
// Source: src/stores/pdfStatusStore.ts
// Select per-screenplay status to avoid broad re-renders
const myStatus = usePdfStatusStore((s) => s.statuses[screenplay.id]);
const hasScanResult = usePdfStatusStore((s) => s.hasScanResult);
```

### Existing badge on FilterBar Sort button (to match for FILTER-03)
```typescript
// Source: FilterBar.tsx lines 211–216
{sortConfigs.length > 1 && (
  <span className="px-1.5 py-0.5 rounded-full bg-gold-500/20 text-gold-400 text-xs font-bold">
    {sortConfigs.length}
  </span>
)}
```

### Existing chip pattern (to match for FILE-03 Missing PDF chip)
```typescript
// Source: FilterBar.tsx lines 280–292 — recommendation chip
<button
  key={chip.id}
  data-active={chip.id === activeFilter ? 'true' : 'false'}
  onClick={() => handleFilterClick(chip.id)}
  className={`chip cursor-pointer transition-all ${activeFilter === chip.id
    ? chip.activeClass
    : 'hover:border-gold-500'
  }`}
>
  {chip.label}
</button>
```

### Current version check (FILE-02)
```typescript
// Source: src/lib/normalize.ts line 402-403
// Support both v6_core_lenses and v6_unified (the merged version)
return r.analysis_version === 'v6_core_lenses' || r.analysis_version === 'v6_unified';
```

### Section component (to model AdvancedDisclosure on)
```typescript
// Source: FilterPanel.tsx lines 420–459
function Section({ title, isOpen, onToggle, badge, children }: SectionProps) {
  return (
    <div className="border border-black-700 rounded-lg overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-3 ...">
        ...
      </button>
      {isOpen && (
        <div className="p-3 pt-0 border-t border-black-700">{children}</div>
      )}
    </div>
  );
}
```

---

## State of the Art

| Old Behavior | Phase 9 Behavior | Impact |
|--------------|------------------|--------|
| FilterPanel opens on "Core Scores" | Opens on "Genre & Theme" | Reduces first-click friction for genre filtering |
| 7 dimension sliders visible immediately | Hidden behind "Advanced" toggle | Reduces cognitive load from 12 visible controls to 5 |
| No dimension filter count on Filters button | Badge shows N active advanced filters | User knows hidden filters are active even with panel closed |
| No active-filter auto-expand | Panel expands section with active filter | No silent filter hiding; user always sees what is active |
| No PDF status on cards | Amber "No PDF" / Emerald "PDF ✓" chip on card | Immediately scannable; no Settings navigation needed |
| No version badge on cards | "Legacy" chip when analysisVersion not current | Supports BULK-02 (re-analyze) in Phase 11 — user can now identify stale cards |
| No "Missing PDF" chip in FilterBar | Chip with count badge in chip row | One-click filter to show only cards missing their source file |

---

## Open Questions

1. **Missing PDF count: `undefined` status in pdfStatusStore means what?**
   - What we know: `pdfStatusStore.statuses` only has entries for screenplays that PdfUploadPanel has scanned. An `undefined` entry means the screenplay was not included in the scan (or scan hasn't run).
   - What's unclear: Should `undefined` in a post-scan world count as "missing" or "unknown"? Currently `useFilteredScreenplays` only excludes `'found'` — so `undefined` after scan is treated as missing.
   - Recommendation: For the FILE-03 count badge, treat `undefined` post-scan as missing (consistent with existing filter logic). For FILE-01 card badge, show 'unknown' (no badge) for `undefined` post-scan to avoid false "missing" labels.

2. **Should the "Missing PDF" chip participate in the sliding chip indicator?**
   - What we know: The sliding indicator in FilterBar tracks `data-active="true"` on chips and moves to the active chip. The recommendation chips are mutually exclusive. "Missing PDF" is an independent toggle filter.
   - What's unclear: Does `missingPdfOnly` + a recommendation chip create a valid UI state? (Yes — they are independent filters in filterStore.)
   - Recommendation: The chip should use `data-active` like other chips for the indicator to work, but the indicator logic currently reads only the active recommendation chip. The sliding indicator may not cover "Missing PDF" — that's acceptable. Focus the chip on toggle behavior; skip the sliding indicator for it.

3. **FILTER-04 priority when multiple sections have active filters**
   - What we know: The accordion opens exactly one section. If both `genres` and `weightedScoreRange.enabled` are true, only one section can open.
   - Recommendation: Priority order = genre/theme > category > core scores > producer/market > display options. Advanced disclosure (dimension sliders) opens independently regardless. Document this in code.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | `vite.config.ts` (vitest config inline) |
| Quick run command | `npm run test:run -- FilterPanel ScreenplayCard` |
| Full suite command | `npm run test:run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILTER-01 | FilterPanel opens Genre & Theme expanded | unit | `npm run test:run -- FilterPanel` | ✅ (existing tests must be updated) |
| FILTER-02 | Dimension sliders hidden until "Advanced" clicked | unit | `npm run test:run -- FilterPanel` | ✅ (new assertion in existing file) |
| FILTER-03 | Filters button badge shows active dimension count | unit | `npm run test:run -- FilterBar` | ❌ Wave 0 — no FilterBar.test.tsx exists |
| FILTER-04 | Auto-expand section with active filter on open | unit | `npm run test:run -- FilterPanel` | ✅ (new assertion in existing file) |
| FILE-01 | PDF status badge renders on card | unit | `npm run test:run -- ScreenplayCard` | ✅ (new assertion in existing file) |
| FILE-02 | Legacy version badge renders; current does not | unit | `npm run test:run -- ScreenplayCard` | ✅ (new assertion in existing file) |
| FILE-03 | Missing PDF chip + count renders in FilterBar | unit | `npm run test:run -- FilterBar` | ❌ Wave 0 — no FilterBar.test.tsx exists |

### Sampling Rate
- **Per task commit:** `npm run test:run -- FilterPanel ScreenplayCard FilterBar`
- **Per wave merge:** `npm run test:run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/layout/FilterBar.test.tsx` — covers FILTER-03 and FILE-03; needs mock setup for `usePdfStatusStore` and `useFilterStore` with dimension-range enabled states
- [ ] Update `src/components/filters/FilterPanel.test.tsx` — invert default-section assertions (FILTER-01), add Advanced disclosure tests (FILTER-02), add auto-expand tests (FILTER-04)
- [ ] Update `src/components/screenplay/ScreenplayCard.test.tsx` — add PDF badge and legacy version badge assertions (FILE-01, FILE-02); mock `usePdfStatusStore`

---

## Sources

### Primary (HIGH confidence)
- Direct source read: `src/components/filters/FilterPanel.tsx` — accordion structure, Section component, activeSection state, activeFilterCount logic
- Direct source read: `src/components/layout/FilterBar.tsx` — chip structure, sliding indicator, Filters button, props interface
- Direct source read: `src/stores/pdfStatusStore.ts` — full store shape, `statuses`, `hasScanResult`, `hasScanResult` semantics
- Direct source read: `src/stores/filterStore.ts` — all dimension range fields, `missingPdfOnly`, persist partialize list
- Direct source read: `src/components/screenplay/ScreenplayCard.tsx` — card layout zones, existing imports, badge placement options
- Direct source read: `src/hooks/useFilteredScreenplays.ts` — `passesFilters` missing PDF logic (lines 176–188), Zustand subscription pattern
- Direct source read: `src/lib/normalize.ts` line 402-403 — current version strings confirmed as `v6_core_lenses` and `v6_unified`
- Direct source read: `src/types/screenplay.ts` — `analysisVersion: string`, `hasPdf?: boolean` field definitions
- Direct source read: `src/components/filters/FilterPanel.test.tsx` — identifies which tests will break and need updating
- Direct source read: `src/components/screenplay/ScreenplayCard.test.tsx` — confirms mock setup pattern and factory usage
- Direct source read: `src/test/factories.ts` — `analysisVersion: 'v5'` default; factory will produce "legacy" badge without override
- Direct source read: `.planning/REQUIREMENTS.md` — canonical requirement text for FILTER-01–04, FILE-01–03
- Direct source read: `.planning/STATE.md` — `[v7.0 pre-phase]` decision: "FILTER-02 disclosure toggle wraps existing Dimension Scores section; existing badge prop becomes source for FILTER-03 active-filter count"

### Secondary (MEDIUM confidence)
- Zustand selector docs (training knowledge, verified against store usage patterns in codebase): per-key selectors prevent broad re-renders

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns verified in existing source
- Architecture: HIGH — all touch points identified with line numbers from actual source reads
- Pitfalls: HIGH — derived from direct code inspection of existing tests, store subscriptions, and component structure
- Wave 0 gaps: HIGH — `FilterBar.test.tsx` confirmed non-existent via Glob; other test files confirmed present

**Research date:** 2026-03-18
**Valid until:** 2026-05-01 (stable — no external APIs, no library upgrades pending)
