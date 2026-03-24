# Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 16 of 18 audit findings from the 2026-03-22 full UI/UX audit, organized in 7 phases from critical to strategic. Items #15 (Storybook) and #16 (CI/CD) are deferred as independent future initiatives.

**Architecture:** Phases are ordered by impact — a11y legal risks first, then bugs, mobile UX, semantic HTML, performance, code quality, and testing. Each phase produces a self-contained commit. Phases 1-4 are IMMEDIATELY/LATER tier; Phases 5-7 are LATER/SOMEDAY tier.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS 4, Zustand 5, Vite 7, Vitest, Playwright

**Source audit:** `docs/audits/2026-03-22-audit.md`

---

## Phase 1: Critical Accessibility Fixes

**Audit items:** #1 (contrast), #2 (select-name), heading-order
**Why first:** WCAG A/AA failures = legal risk. 53 elements fail contrast. 1 critical a11y violation.

---

### Task 1.1: Fix badge contrast — `badge-recommend` (white on emerald)

**Files:**
- Modify: `src/index.css:290-293`

Contrast ratio: 2.53:1 (needs 4.5:1). White text on `#10B981` fails badly.

- [ ] **Step 1: Fix badge-recommend in CSS**

In `src/index.css`, change the `.badge-recommend` class:

```css
/* Before */
.badge-recommend {
  background: var(--color-emerald-500);
  color: white;
}

/* After — use dark text on green for 7.5:1 contrast */
.badge-recommend {
  background: var(--color-emerald-500);
  color: var(--color-black-950);
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "fix(a11y): use dark text on recommend badge for WCAG AA contrast"
```

---

### Task 1.2: Fix `text-black-500` contrast on dark backgrounds (~40 elements)

**Files:**
- Modify: All files using `text-black-500` for label/helper text on dark backgrounds

The class `text-black-500` (`#64748B`) on the app's dark background (`~#161f30`) gives 3.46:1 contrast. WCAG AA requires 4.5:1.

**Strategy:** The safest global fix is bumping these to `text-black-400` (`#94A3B8`, ~5.2:1 contrast on the dark bg). Do a targeted find-and-replace in files where `text-black-500` is used for *small/helper text* that axe flagged.

- [ ] **Step 1: Fix chart helper text**

In `src/components/charts/AnalyticsDashboard.tsx:125`, change:
```tsx
// Before
<span className="text-black-500">|</span>
// After
<span className="text-black-400">|</span>
```

- [ ] **Step 2: Fix "Click to filter" hint text in AnalyticsDashboard**

The 4 "Click to filter by..." hints are rendered in `src/components/charts/AnalyticsDashboard.tsx:191` (not in the chart sub-components). Find the line:
```tsx
<p className="text-xs text-black-500 mt-2 text-center">{card.hint}</p>
```
Change `text-black-500` to `text-black-400`.

- [ ] **Step 3: Fix card label text (`Score`, `CVS`, `Mkt`)**

In `src/components/screenplay/ScreenplayCard.tsx`, replace `text-black-500` with `text-black-400` on score label spans (the `text-[10px]` tracking-widest labels).

Also increase `text-[10px]` to `text-[11px]` — 10px is below the 12px minimum.

- [ ] **Step 4: Fix footer contrast**

In `src/App.tsx:138`, change:
```tsx
// Before
<div className="max-w-[1800px] mx-auto px-6 text-center text-sm text-black-500">
// After
<div className="max-w-[1800px] mx-auto px-6 text-center text-sm text-black-400">
```

- [ ] **Step 5: Fix card footer text in modal subcomponents**

In `src/components/screenplay/modal/ModalFooter.tsx`, change `text-black-500` to `text-black-400`.

- [ ] **Step 6: Verify build compiles**

Run: `npm run build`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/components/charts/AnalyticsDashboard.tsx src/components/screenplay/ScreenplayCard.tsx src/App.tsx src/components/screenplay/modal/ModalFooter.tsx
git commit -m "fix(a11y): bump text-black-500 to text-black-400 for WCAG AA contrast"
```

---

### Task 1.3: Fix collection tab count badge contrast

**Files:**
- Modify: `src/components/filters/CollectionTabs.tsx`

The count badges use `text-black-400` on `bg-black-700` = 4.03:1 (needs 4.5:1).

- [ ] **Step 1: Bump badge text to `text-black-300`**

Find the count badge spans (the `bg-black-700 text-black-400` pattern) and change to `text-black-300`.

`text-black-300` = `#CBD5E1` on `bg-black-700` = `#334155` gives ~5.9:1 contrast.

- [ ] **Step 2: Commit**

```bash
git add src/components/filters/CollectionTabs.tsx
git commit -m "fix(a11y): increase collection tab count badge contrast"
```

---

### Task 1.4: Fix `text-gold-500/70` contrast

**Files:**
- Modify: `src/components/charts/AnalyticsDashboard.tsx:123`

Contrast 4.39:1 (needs 4.5:1). The `/70` opacity is the problem.

- [ ] **Step 1: Remove opacity modifier**

```tsx
// Before
{isFiltered && <span className="ml-1 text-gold-500/70">(filtered)</span>}
// After
{isFiltered && <span className="ml-1 text-gold-500">(filtered)</span>}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/charts/AnalyticsDashboard.tsx
git commit -m "fix(a11y): remove gold text opacity for WCAG AA contrast"
```

---

### Task 1.5: Add accessible names to all `<select>` elements

**Files:**
- Modify: `src/components/layout/FilterBar.tsx:252`
- Modify: `src/components/filters/AdvancedSortPanel.tsx:161`
- Modify: `src/components/settings/PdfUploadPanel.tsx:429`

- [ ] **Step 1: Add `aria-label` to FilterBar sort dropdown**

In `src/components/layout/FilterBar.tsx:252`:
```tsx
// Before
<select
  className="input py-2 px-3 w-auto text-sm"
  value={sortConfigs[0]?.field || 'marketPotential'}
// After
<select
  aria-label="Sort screenplays by"
  className="input py-2 px-3 w-auto text-sm"
  value={sortConfigs[0]?.field || 'marketPotential'}
```

- [ ] **Step 2: Add `aria-label` to AdvancedSortPanel select**

In `src/components/filters/AdvancedSortPanel.tsx:161`:
```tsx
// Before
<select
  value={selectedField}
// After
<select
  aria-label="Select sort field"
  value={selectedField}
```

- [ ] **Step 3: Add `aria-label` to PdfUploadPanel select**

In `src/components/settings/PdfUploadPanel.tsx:429`, add `aria-label="Select analysis model"` (or whatever the select is for — read context first).

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/FilterBar.tsx src/components/filters/AdvancedSortPanel.tsx src/components/settings/PdfUploadPanel.tsx
git commit -m "fix(a11y): add aria-labels to all select elements"
```

---

### Task 1.6: Fix heading order (h3 without h2 parent)

**Files:**
- Modify: `src/components/charts/AnalyticsDashboard.tsx` or whichever chart uses `<h3>` for "Score Distribution"

- [ ] **Step 1: Find the heading**

Grep for `<h3` in `src/components/charts/`. The axe report flags `<h3>` being used where no `<h2>` precedes it.

- [ ] **Step 2: Change `<h3>` to `<h2>` for chart section headings, or add a visually-hidden `<h2>` parent**

If the chart cards use `<h3>`, change to `<h2>` with appropriate sizing class (`text-base` or `text-lg` to maintain visual size).

- [ ] **Step 3: Commit**

```bash
git add src/components/charts/
git commit -m "fix(a11y): correct heading hierarchy in analytics charts"
```

---

### Task 1.7: Run a11y verification after all Phase 1 fixes

- [ ] **Step 1: Run axe-core to verify contrast fixes**

Run: `npx @axe-core/cli http://localhost:5173 --tags wcag2a,wcag2aa`
Expected: 0 critical violations, 0 serious violations (the 53 contrast failures + select-name should be resolved).

If violations remain, fix them before proceeding to Phase 2.

---

## Phase 2: Bug Fixes & Stability

**Audit items:** #3 (duplicate keys), #5 (ErrorBoundary coverage)

---

### Task 2.1: Fix React duplicate key warning for `matadero-v4-1`

**Files:**
- Modify: `src/components/screenplay/ScreenplayGrid.tsx:277`

The grid uses `key={screenplay.id}` but data contains duplicate IDs.

- [ ] **Step 1: Use composite key**

In `src/components/screenplay/ScreenplayGrid.tsx:277`:
```tsx
// Before
key={screenplay.id}
// After
key={`${screenplay.id}-${globalIndex}`}
```

This guarantees uniqueness even if the data source has duplicate IDs.

- [ ] **Step 2: Verify no console warnings**

Run: `npm run dev`, open browser console, confirm no duplicate key warnings.

- [ ] **Step 3: Commit**

```bash
git add src/components/screenplay/ScreenplayGrid.tsx
git commit -m "fix: use composite key in ScreenplayGrid to prevent duplicate key warnings"
```

---

### Task 2.2: Verify ErrorBoundary coverage on lazy routes

**Files:**
- Review: `src/main.tsx`

- [ ] **Step 1: Verify coverage**

Read `src/main.tsx`. Currently:
- Top-level `<ErrorBoundary>` wraps all routes (line 27) -- GOOD
- `<Suspense>` wraps all routes (line 30) -- GOOD
- SettingsPage and SharedViewPage are lazy-loaded inside this boundary -- GOOD

Additional boundaries exist in `App.tsx`:
- AnalyticsDashboard wrapped in `<ErrorBoundary>` (line 112) -- GOOD
- ComparisonBar + ComparisonModal wrapped in `<ErrorBoundary>` (line 151) -- GOOD

**Verdict:** Coverage is adequate. No changes needed. Mark this item as resolved in the audit.

- [ ] **Step 2: Update audit report**

Add a note to `docs/audits/2026-03-22-audit.md` item #5: "Verified — all routes and lazy components have ErrorBoundary coverage."

---

## Phase 3: Mobile Responsiveness

**Audit item:** #4

---

### Task 3.1: Make FilterBar responsive on mobile

**Files:**
- Modify: `src/components/layout/FilterBar.tsx`
- Modify: `src/index.css` (if adding utility classes)

- [ ] **Step 1: Read FilterBar.tsx fully**

Read the entire FilterBar component to understand its layout structure.

- [ ] **Step 2: Add horizontal scroll to filter chips on mobile**

The filter chip row (All/Pass/Consider/Recommend/FILM NOW) overflows on 375px. Wrap it in a horizontal scroll container:

```tsx
{/* Filter chips — horizontal scroll on mobile */}
<div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-2 px-2 sm:mx-0 sm:px-0 sm:flex-wrap">
  {FILTER_CHIPS.map(chip => (
    // ... existing chip buttons
  ))}
</div>
```

- [ ] **Step 3: Stack filter bar controls vertically on mobile**

The search input + sort dropdown + action buttons should stack on small screens:
```tsx
<div className="flex flex-col sm:flex-row gap-3 sm:items-center">
  {/* Search input — full width on mobile */}
  {/* Sort dropdown — full width on mobile */}
  {/* Action buttons — row on mobile */}
</div>
```

- [ ] **Step 4: Add `.scrollbar-hide` utility if not already present**

In `src/index.css`, add to the utilities layer if missing:
```css
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 5: Ensure touch targets are 44x44px on mobile**

All buttons/chips should have `min-h-[44px] min-w-[44px]` on mobile:
```tsx
className="... min-h-[44px] sm:min-h-0"
```

- [ ] **Step 6: Test at 375px width**

Run dev server, resize to 375px in dev tools, verify:
- No horizontal overflow
- Filter chips scroll horizontally
- Sort dropdown and search are stacked
- All buttons are tappable

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/FilterBar.tsx src/index.css
git commit -m "fix(responsive): make FilterBar mobile-friendly with scroll chips and stacked controls"
```

---

### Task 3.2: Fix mobile bottom whitespace

**Files:**
- Modify: `src/components/screenplay/ScreenplayGrid.tsx` (likely the virtualizer height)

- [ ] **Step 1: Investigate**

The mobile full-page screenshot shows a large white/light block at the bottom. This is likely the virtualizer's estimated container height being too large, or a missing dark background on a container.

Read `ScreenplayGrid.tsx` — look for the `div` with `style={{ height: ... }}` from the virtualizer. Verify the background color extends.

- [ ] **Step 2: Fix**

If it's a background issue, ensure the virtualizer container has `bg-black-950` or inherits the dark background. If it's an oversized height estimate, the virtualizer should recalculate.

- [ ] **Step 3: Commit**

```bash
git add src/components/screenplay/ScreenplayGrid.tsx
git commit -m "fix(mobile): remove bottom whitespace from virtual scroll container"
```

---

## Phase 4: Semantic HTML & Motion

**Audit items:** #8 (prefers-reduced-motion), #9 (semantic HTML)

---

### Task 4.1: Verify prefers-reduced-motion coverage

**Files:**
- Review: `src/styles/animations.css:298-320`
- Review: `src/hooks/useCountUp.ts`

- [ ] **Step 1: Check existing coverage**

`animations.css` already has a global `prefers-reduced-motion: reduce` rule (line 308-317) that:
- Sets `animation-duration: 0.01ms !important`
- Sets `transition-duration: 0.01ms !important`
- Sets `scroll-behavior: auto !important`

This is a comprehensive global rule — it covers ALL animations via CSS. The `useCountUp` hook also checks the media query in JS.

**Verdict:** Coverage is actually more comprehensive than the audit suggested (the grep only found 3 occurrences, but the global CSS rule at line 308 covers everything). No code changes needed.

- [ ] **Step 2: Update audit**

Mark item #8 as resolved — global CSS rule already handles all animations.

---

### Task 4.2: Add semantic HTML landmarks

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/components/layout/FilterBar.tsx`

- [ ] **Step 1: Verify `<main>` landmark**

`src/App.tsx:89` already uses `<main>`. GOOD.

- [ ] **Step 2: Verify Header already uses `<header>`**

`src/components/layout/Header.tsx:47` already renders a `<header>` element. No change needed.

- [ ] **Step 3: Add `<nav>` to FilterBar**

The filter chip section acts as navigation. Wrap in `<nav aria-label="Filter screenplays">`.

- [ ] **Step 4: Verify ScreenplayCard already uses `<article>`**

`src/components/screenplay/ScreenplayCard.tsx:154` already renders an `<article>` element. No change needed — do NOT add `role="article"` (redundant on `<article>`).

- [ ] **Step 5: Add `<footer>` landmark if not already**

`App.tsx:137` already uses `<footer>`. GOOD.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Header.tsx src/components/layout/FilterBar.tsx src/components/screenplay/ScreenplayCard.tsx
git commit -m "feat(a11y): add semantic HTML landmarks (header, nav, article)"
```

---

## Phase 5: Performance & Bundle Optimization

**Audit items:** #10 (memoization), #13 (bundle size), #18 (fonts)

---

### Task 5.1: Add vendor chunks for firebase and pdfjs-dist

**Files:**
- Modify: `vite.config.ts:53-62`

- [ ] **Step 1: Add manual chunks**

```ts
manualChunks: {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-recharts': ['recharts'],
  'vendor-react-pdf': ['@react-pdf/renderer'],
  'vendor-state': ['zustand', '@tanstack/react-query'],
  // NEW — split heavy deps out of main bundle
  'vendor-firebase': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
  'vendor-pdfjs': ['pdfjs-dist'],
},
```

- [ ] **Step 2: Fix stale build artifacts**

Add a `prebuild` script to `package.json`:
```json
"prebuild": "rm -rf dist/assets",
```

This runs automatically before `npm run build`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Check new chunk sizes: `ls -la dist/assets/*.js | sort -k5 -rn | head -10`

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts package.json
git commit -m "perf: split firebase/pdfjs into vendor chunks + add prebuild cleanup"
```

---

### Task 5.2: Memoize ScreenplayCard for virtual list performance

**Files:**
- Modify: `src/components/screenplay/ScreenplayCard.tsx`

- [ ] **Step 1: Wrap ScreenplayCard in React.memo**

```tsx
import { memo } from 'react';

// ... existing component code ...

function ScreenplayCardInner({ screenplay }: ScreenplayCardProps) {
  // ... existing body
}

export const ScreenplayCard = memo(ScreenplayCardInner);
```

Or simply wrap the export:
```tsx
export const ScreenplayCard = memo(function ScreenplayCard({ screenplay }: ScreenplayCardProps) {
  // existing body
});
```

- [ ] **Step 2: Memoize ScoreBar**

In `src/components/ui/ScoreBar.tsx`, wrap in `React.memo` — it's a pure display component rendered many times per card.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/components/screenplay/ScreenplayCard.tsx src/components/ui/ScoreBar.tsx
git commit -m "perf: memoize ScreenplayCard and ScoreBar for virtual list performance"
```

---

### Task 5.3: Optimize font loading

**Files:**
- Modify: `index.html`

`index.html` already loads fonts with `&display=swap` (lines 10-11) and has `preconnect` hints (lines 8-9). The main optimization is adding `Playfair Display` which is declared in CSS (`--font-display`) but not loaded in HTML.

- [ ] **Step 1: Add Playfair Display font load**

In `index.html`, add after line 10 (the existing Google Fonts link):
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
```

Or add it to the existing Google Fonts URL by appending `&family=Playfair+Display:wght@400;600;700` to the line 10 href.

- [ ] **Step 2: Verify fonts load**

Run dev server, open Network tab, confirm Playfair Display loads without FOUT.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "perf: load Playfair Display font declared in design system"
```

---

## Phase 6: Code Quality

**Audit items:** #7 (oversized components), #11 (hex values), #12 (Prettier)

---

### Task 6.1: Add Prettier

**Files:**
- Create: `.prettierrc`
- Modify: `package.json`

- [ ] **Step 1: Install Prettier**

Run: `npm install -D prettier`

- [ ] **Step 2: Create config**

Create `.prettierrc`:
```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "tabWidth": 2,
  "semi": true,
  "printWidth": 100
}
```

Match the existing code style — check a few files to verify single quotes, semicolons, etc. are already used.

- [ ] **Step 3: Add format script**

In `package.json`:
```json
"format": "prettier --write 'src/**/*.{ts,tsx,css}'"
```

- [ ] **Step 4: Commit**

```bash
git add .prettierrc package.json package-lock.json
git commit -m "chore: add Prettier config matching existing code style"
```

Do NOT run `prettier --write` on the entire codebase in this commit — that's a separate formatting PR to avoid noise.

---

### Task 6.2: Extract chart color constants

**Files:**
- Create: `src/lib/chartColors.ts`
- Modify: Chart components that use hardcoded hex values

- [ ] **Step 1: Create shared chart color config**

```ts
// src/lib/chartColors.ts
export const CHART_COLORS = {
  emerald: '#10B981',
  gold: '#F59E0B',
  red: '#EF4444',
  violet: '#8B5CF6',
  teal: '#14B8A6',
  amber: '#F59E0B',
  rose: '#F43F5E',
  cyan: '#06B6D4',
} as const;

export const SCORE_COLORS = {
  excellent: CHART_COLORS.emerald,
  good: CHART_COLORS.gold,
  poor: CHART_COLORS.red,
} as const;

export const TIER_COLORS = {
  recommend: CHART_COLORS.emerald,
  consider: CHART_COLORS.amber,
  pass: CHART_COLORS.red,
  film_now: '#FFD700',
} as const;
```

- [ ] **Step 2: Update chart components to import from chartColors.ts**

Replace hardcoded hex strings in:
- `src/components/charts/ScoreDistribution.tsx`
- `src/components/charts/TierBreakdown.tsx`
- `src/components/charts/GenreChart.tsx`
- `src/components/charts/BudgetChart.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/lib/chartColors.ts src/components/charts/
git commit -m "refactor: extract chart colors to shared constants"
```

---

### Task 6.3: Break up CoverageDocument.tsx (955 LOC)

**Files:**
- Modify: `src/components/export/CoverageDocument.tsx`
- Create: `src/components/export/coverage/` subdirectory with extracted sections

This is the largest component. Extract logical PDF sections into sub-components.

- [ ] **Step 1: Read the full file and identify section boundaries**

Look for comment blocks or logical groupings (e.g., header section, scores section, details section, charts section).

- [ ] **Step 2: Create sub-components**

Extract 3-5 logical sections into files under `src/components/export/coverage/`:
- `CoverageHeader.tsx` — title, metadata
- `CoverageScores.tsx` — score displays
- `CoverageDetails.tsx` — content details
- `CoverageCharts.tsx` — chart/visualization sections

- [ ] **Step 3: Update CoverageDocument.tsx to compose sub-components**

The parent should import and compose the sections, bringing it under 200 LOC.

- [ ] **Step 4: Run existing tests**

Run: `npm run test:run -- --grep CoverageDocument`
Expected: Existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/export/
git commit -m "refactor: break CoverageDocument into focused sub-components"
```

---

### Task 6.4: Break up UploadPanel.tsx (747 LOC)

**Files:**
- Modify: `src/components/settings/UploadPanel.tsx`
- Create: Sub-components in `src/components/settings/upload/`

- [ ] **Step 1: Read and identify sections**

Likely sections: file selection, validation, progress indicator, results/errors.

- [ ] **Step 2: Extract sub-components**

- `UploadDropzone.tsx` — file selection UI
- `UploadProgress.tsx` — progress bars, status
- `UploadResults.tsx` — success/error display

- [ ] **Step 3: Wire up and verify**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/
git commit -m "refactor: break UploadPanel into focused sub-components"
```

---

## Phase 7: Test Coverage

**Audit items:** #6 (unit tests), #14 (visual regression), #17 (e2e)

---

### Task 7.1: Add `data-testid` attributes to interactive elements

**Files:**
- Modify: Key interactive components

Currently only 2 `data-testid` in the entire app. Add to critical elements.

- [ ] **Step 1: Add to FilterBar**

```tsx
<input data-testid="search-input" ... />
<select data-testid="sort-select" ... />
```

- [ ] **Step 2: Add to ScreenplayCard**

```tsx
<div data-testid={`screenplay-card-${screenplay.id}`} ... />
```

- [ ] **Step 3: Add to ScreenplayGrid**

```tsx
<div data-testid="screenplay-grid" ... />
```

- [ ] **Step 4: Add to modals**

```tsx
<div data-testid="screenplay-modal" ... />
<div data-testid="export-modal" ... />
<div data-testid="share-modal" ... />
```

- [ ] **Step 5: Commit**

```bash
git add src/components/
git commit -m "test: add data-testid attributes to key interactive elements"
```

---

### Task 7.2: Unit tests for critical untested components

**Files:**
- Create: Tests for the highest-risk untested components

Priority order (most user-facing, most complex):
1. `src/components/layout/Header.tsx` — test render, theme toggle
2. `src/components/charts/AnalyticsDashboard.tsx` — test render with mock data
3. `src/components/comparison/ComparisonBar.tsx` — test comparison flow
4. `src/components/share/ShareModal.tsx` — test share URL generation
5. `src/components/settings/AppearanceSettings.tsx` — test theme switching

- [ ] **Step 1: Write Header test**

Create `src/components/layout/Header.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { Header } from './Header';

describe('Header', () => {
  it('renders the dashboard title', () => {
    render(<Header />);
    expect(screen.getByText(/Lemon/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm run test:run -- Header`

- [ ] **Step 3: Write tests for remaining priority components**

Follow the same pattern for each. Test rendering and core behavior, not implementation details.

- [ ] **Step 4: Commit**

```bash
git add src/components/**/*.test.tsx
git commit -m "test: add unit tests for Header, AnalyticsDashboard, ComparisonBar, ShareModal, AppearanceSettings"
```

---

### Task 7.3: Add E2E test flows

**Files:**
- Create: `e2e/filters.spec.ts`
- Create: `e2e/modal.spec.ts`
- Create: `e2e/settings.spec.ts`

- [ ] **Step 1: Write filter/sort e2e test**

```ts
import { test, expect } from '@playwright/test';

test('can filter screenplays by recommendation tier', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Recommend' }).click();
  // Verify only recommend cards are shown
  const cards = page.locator('[data-testid^="screenplay-card-"]');
  await expect(cards.first()).toBeVisible();
});
```

- [ ] **Step 2: Write modal e2e test**

```ts
test('can open and close screenplay modal', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-testid^="screenplay-card-"]').first().click();
  await expect(page.locator('[data-testid="screenplay-modal"]')).toBeVisible();
});
```

- [ ] **Step 3: Write settings page e2e test**

```ts
test('can navigate to settings', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByText(/Settings/i)).toBeVisible();
});
```

- [ ] **Step 4: Run e2e tests**

Run: `npm run test:e2e`

- [ ] **Step 5: Commit**

```bash
git add e2e/
git commit -m "test: add e2e flows for filters, modal, and settings"
```

---

## Summary

| Phase | Tasks | Effort | Audit Items Fixed |
|-------|-------|--------|-------------------|
| 1. Critical A11y | 7 | ~1 hour | #1, #2, heading-order |
| 2. Bug Fixes | 2 | ~20 min | #3, #5 |
| 3. Mobile Responsive | 2 | ~1.5 hours | #4 |
| 4. Semantic HTML & Motion | 2 | ~30 min | #8, #9 |
| 5. Performance & Bundle | 3 | ~1 hour | #10, #13, #18 |
| 6. Code Quality | 4 | ~2-3 hours | #7 (top 2 of 7 oversized), #11, #12 |
| 7. Test Coverage | 3 | ~3-4 hours | #6, #17 |
| **Total** | **23 tasks** | **~10 hours** | **16 of 18 findings** |

**Deferred:** #14 (visual regression testing), #15 (Storybook), #16 (CI/CD) — independent future initiatives.
**Partially addressed:** #7 — only the 2 worst oversized components (955 LOC, 747 LOC) are refactored; 5 others deferred.
