# Discovery Ranked Slate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the oversized Discovery feature with an honest compact Top Result plus Next Three ranking, add a collapsed Slate Insights disclosure, and present every screenplay at a true 8.5 × 11 ratio while preserving the searchable wall and every approved fallback.

**Architecture:** Keep `HybridHeader` and `HybridCommandRail` as the existing search/filter/store boundaries. Add one pure projection function that divides the already-filtered, already-sorted screenplay array into ranked promotion and wall entries without changing the data or sort logic; compose that projection in `ScreenplayDiscoverShell`; and reuse `AnalyticsDashboard` behind an additive, lazy, collapsed disclosure. Styling remains scoped to the screenplay presentation so `/discover?ui=classic`, the drawer preview, and the Screenplay File workspace remain unchanged.

**Tech Stack:** React 19, TypeScript strict, Zustand 5, TanStack React Query 5, React Router 7, Vitest 4, Testing Library, existing Recharts analytics, existing Discovery CSS.

## Global Constraints

- Discovery chrome is permanently midnight navy and cobalt blue. Green remains semantic status color only.
- All screenplay objects use `aspect-ratio: 8.5 / 11`; the blue spine occupies 7–9% of the cover width.
- The page becomes approximately 15–20% denser; the compact ranking region targets 180–220 px tall on desktop.
- Ranking appears only for `weightedScore`, `marketPotential`, and `cvsTotal`; `title` sort shows the full alphabetical wall with no quality-ranking language.
- The promoted top four appear once. The searchable wall continues with the remaining ordered results and paginates in groups of 50.
- Existing `filterStore`, `sortStore`, saved lenses, selection, favorites, sharing, Producer Look, and project navigation remain the sole behavior sources.
- Preserve `/discover?ui=classic`, `/discover?ui=screenplay&preview=drawer`, and the Screenplay File workspace.
- Do not modify scoring, verdicts, calibration, services, stores, `functions/`, `daemon.py`, `execution/`, Firestore rules, Storage rules, or VPS behavior.
- Do not deploy, activate calibration, or make paid model calls.
- Add no dependencies. Keep TypeScript strict, use `@/` imports, and do not introduce `any`.
- Desktop and tablet are the primary visual targets. Phone remains functional but is not the design target.
- Every task must leave the focused tests green and end in a commit.

---

## File Map

**Create**

- `src/components/discover/screenplay/screenplayRanking.ts`: pure ranking projection and copy for eligible sorts.
- `src/components/discover/screenplay/screenplayRanking.test.ts`: projection coverage, including rankability, deduplication, and title-sort behavior.
- `src/components/discover/screenplay/ScreenplayRanking.tsx`: compact Top Result and Next Three presentation.
- `src/components/discover/screenplay/screenplayPresentationTypes.ts`: shared, presentation-only callback and percentile-map types.
- `src/components/discover/screenplay/ScreenplaySlateStats.tsx`: compact total, visible, average, priority-verdict, and Producer Look counts.
- `src/components/discover/screenplay/ScreenplaySlateInsights.tsx`: lazy, isolated analytics disclosure used only by screenplay Discovery.
- `src/components/discover/screenplay/ScreenplaySlateInsights.test.tsx`: collapsed/expanded/error-isolation coverage.

**Modify**

- `src/components/discover/screenplay/ScreenplayDiscoverShell.tsx`: compose ranking, insights, wall continuation, and 50-item pagination.
- `src/components/discover/screenplay/ScreenplayResults.tsx`: remove the oversized feature and make the grid consume preserved ranked entries.
- `src/components/discover/screenplay/BlueSpineScript.tsx`: no behavior change; keep it the only screenplay-object primitive.
- `src/components/discover/screenplay/blue-spine-script.css`: enforce the physical page ratio and 7–9% spine.
- `src/components/discover/screenplay/screenplay-discovery.css`: compact blue ranking, wall density, focus states, responsive behavior, and reduced motion.
- `src/components/charts/AnalyticsDashboard.tsx`: additive optional presentation props, all defaulting to current behavior.
- `src/components/charts/AnalyticsDashboard.test.tsx`: prove old dashboard defaults remain intact and deferred collapsed mode works.
- `src/pages/DiscoverPage.screenplay.test.tsx`: full connected-page ranking, search, sort, wall, and fallback regressions.

---

### Task 1: Define the Honest Ranked-Slate Projection

**Files:**
- Create: `src/components/discover/screenplay/screenplayRanking.ts`
- Create: `src/components/discover/screenplay/screenplayRanking.test.ts`

**Interfaces:**
- Consumes: the ordered `Screenplay[]` returned by `useFilteredScreenplays` and the active `SortField` from `sortStore`.
- Produces: `buildScreenplayRanking(screenplays: Screenplay[], sortField: SortField): ScreenplayRankingLayout`.
- Guarantees: original ordering is preserved, unrankable projects remain browsable, promoted projects do not repeat, and title sort never implies quality rank.

- [ ] **Step 1: Write the failing projection tests**

Create `src/components/discover/screenplay/screenplayRanking.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import type { Screenplay, SortField } from '@/types';
import { buildScreenplayRanking } from './screenplayRanking';

function slate(count = 7): Screenplay[] {
  return Array.from({ length: count }, (_, index) =>
    createTestScreenplay({
      id: `script-${index + 1}`,
      projectId: `project-${index + 1}`,
      title: `Script ${index + 1}`,
      weightedScore: 9 - index * 0.4,
    }),
  );
}

describe('buildScreenplayRanking', () => {
  it.each<[SortField, string]>([
    ['weightedScore', 'Final score · highest first'],
    ['marketPotential', 'Market potential · highest first'],
    ['cvsTotal', 'Commercial viability · highest first'],
  ])('promotes the first four rankable results for %s', (sortField, reason) => {
    const result = buildScreenplayRanking(slate(), sortField);

    expect(result.showRanking).toBe(true);
    expect(result.reason).toBe(reason);
    expect(result.topResult?.screenplay.id).toBe('script-1');
    expect(result.nextThree.map((entry) => entry.screenplay.id)).toEqual([
      'script-2',
      'script-3',
      'script-4',
    ]);
    expect(result.wall.map((entry) => entry.screenplay.id)).toEqual([
      'script-5',
      'script-6',
      'script-7',
    ]);
    expect(result.wall.map((entry) => entry.rank)).toEqual([5, 6, 7]);
  });

  it('hides ranking for title sort and keeps the complete ordered wall', () => {
    const input = slate(3);
    const result = buildScreenplayRanking(input, 'title');

    expect(result).toEqual({
      showRanking: false,
      reason: null,
      topResult: null,
      nextThree: [],
      wall: [
        { screenplay: input[0], rank: 1 },
        { screenplay: input[1], rank: 2 },
        { screenplay: input[2], rank: 3 },
      ],
    });
  });

  it('does not promote an unrankable result but keeps it in the wall', () => {
    const input = slate(6);
    input[1] = {
      ...input[1],
      producerProjection: { rankable: false },
    } as Screenplay;

    const result = buildScreenplayRanking(input, 'weightedScore');

    expect(result.topResult?.screenplay.id).toBe('script-1');
    expect(result.nextThree.map((entry) => entry.screenplay.id)).toEqual([
      'script-3',
      'script-4',
      'script-5',
    ]);
    expect(result.wall.map((entry) => entry.screenplay.id)).toEqual(['script-2', 'script-6']);
    expect(result.wall.map((entry) => entry.rank)).toEqual([2, 6]);
  });

  it('renders fewer than four available results without placeholder entries', () => {
    const result = buildScreenplayRanking(slate(2), 'weightedScore');

    expect(result.topResult?.rank).toBe(1);
    expect(result.nextThree).toHaveLength(1);
    expect(result.nextThree[0].rank).toBe(2);
    expect(result.wall).toEqual([]);
  });

  it('never repeats a promoted screenplay in the wall', () => {
    const result = buildScreenplayRanking(slate(8), 'weightedScore');
    const promotedIds = new Set([
      result.topResult?.screenplay.id,
      ...result.nextThree.map((entry) => entry.screenplay.id),
    ]);

    expect(result.wall.every((entry) => !promotedIds.has(entry.screenplay.id))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run:

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
npx vitest run src/components/discover/screenplay/screenplayRanking.test.ts
```

Expected: FAIL because `./screenplayRanking` does not exist.

- [ ] **Step 3: Implement the pure projection**

Create `src/components/discover/screenplay/screenplayRanking.ts`:

```ts
import type { Screenplay, SortField } from '@/types';

export interface RankedScreenplay {
  screenplay: Screenplay;
  rank: number;
}

export interface ScreenplayRankingLayout {
  showRanking: boolean;
  reason: string | null;
  topResult: RankedScreenplay | null;
  nextThree: RankedScreenplay[];
  wall: RankedScreenplay[];
}

const DECISION_SORT_REASONS: Partial<Record<SortField, string>> = {
  weightedScore: 'Final score · highest first',
  marketPotential: 'Market potential · highest first',
  cvsTotal: 'Commercial viability · highest first',
};

export function buildScreenplayRanking(
  screenplays: Screenplay[],
  sortField: SortField,
): ScreenplayRankingLayout {
  const ordered = screenplays.map((screenplay, index) => ({
    screenplay,
    rank: index + 1,
  }));
  const reason = DECISION_SORT_REASONS[sortField] ?? null;

  if (!reason) {
    return {
      showRanking: false,
      reason: null,
      topResult: null,
      nextThree: [],
      wall: ordered,
    };
  }

  const promoted = ordered
    .filter((entry) => entry.screenplay.producerProjection?.rankable !== false)
    .slice(0, 4);
  const promotedIds = new Set(promoted.map((entry) => entry.screenplay.id));

  return {
    showRanking: promoted.length > 0,
    reason,
    topResult: promoted[0] ?? null,
    nextThree: promoted.slice(1),
    wall: ordered.filter((entry) => !promotedIds.has(entry.screenplay.id)),
  };
}
```

- [ ] **Step 4: Run the focused test and typecheck the new boundary**

Run:

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
npx vitest run src/components/discover/screenplay/screenplayRanking.test.ts
npx tsc -b --pretty false
```

Expected: projection tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit the independently reviewable projection**

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
git add src/components/discover/screenplay/screenplayRanking.ts src/components/discover/screenplay/screenplayRanking.test.ts
git commit -m "ui: define Discovery ranking projection"
```

---

### Task 2: Build Top Result, Next Three, and the Non-Duplicated Wall

**Files:**
- Create: `src/components/discover/screenplay/screenplayPresentationTypes.ts`
- Create: `src/components/discover/screenplay/ScreenplayRanking.tsx`
- Modify: `src/components/discover/screenplay/ScreenplayDiscoverShell.tsx`
- Modify: `src/components/discover/screenplay/ScreenplayResults.tsx`
- Modify: `src/pages/DiscoverPage.screenplay.test.tsx`

**Interfaces:**
- Consumes: `ScreenplayRankingLayout` from Task 1, `PercentileRank`, `ProducerAssessmentHead`, and the existing `onOpenScreenplay` connection.
- Produces: `ScreenplayRanking`, `OpenScreenplay`, `PercentileMap`, and a `ScreenplayGrid` that accepts `entries: RankedScreenplay[]`.
- Navigation remains unchanged: normal screenplay presentation opens `/projects/:projectId?workspace=screenplay`; `preview=drawer` retains the drawer route and focus restoration.

- [ ] **Step 1: Replace the obsolete feature assertions with the approved hierarchy tests**

In `src/pages/DiscoverPage.screenplay.test.tsx`, change the default fixture to six projects:

```ts
hookState.screenplays = [
  screenplay('amber', 'Amber Sky', 6.2),
  screenplay('delta', 'Delta Run', 7.1),
  screenplay('echo', 'Echo Park', 8.8),
  screenplay('foxtrot', 'Foxtrot House', 8.1),
  screenplay('gamma', 'Gamma Road', 7.8),
  screenplay('hotel', 'Hotel Blue', 6.8),
];
useSortStore.getState().setSortConfigs([{ field: 'weightedScore', direction: 'desc' }]);
useSortStore.getState().setPrioritizeFilmNow(false);
```

Replace the old “cinematic feature” test with:

```ts
it('shows an honest top result, next three, and a non-duplicated continuation wall', async () => {
  renderPage();

  const ranking = await screen.findByTestId('screenplay-discovery-ranking');
  expect(within(ranking).getByText('Top result')).toBeInTheDocument();
  expect(within(ranking).getByText(/Final score · highest first/)).toBeInTheDocument();
  expect(within(ranking).getByTestId('screenplay-ranking-top')).toHaveAttribute(
    'data-screenplay-id',
    'echo',
  );
  expect(within(ranking).getAllByTestId('screenplay-ranking-runner')).toHaveLength(3);

  const wallResults = screen.getAllByTestId('screenplay-discovery-result');
  expect(wallResults).toHaveLength(2);
  expect(wallResults.map((result) => result.getAttribute('data-screenplay-id'))).toEqual([
    'hotel',
    'amber',
  ]);
  expect(screen.getByRole('heading', { name: 'Continue through the slate' })).toBeInTheDocument();
  expect(screen.getByText('Showing 6 of 6 screenplays')).toBeInTheDocument();
});
```

Replace the search/sort test with:

```ts
it('recomputes all ranked surfaces and removes quality ranking for title sort', async () => {
  const user = userEvent.setup();
  renderPage();
  const search = await screen.findByRole('searchbox', { name: 'Discovery search' });

  await user.type(search, 'buried lighthouse');
  await waitFor(() =>
    expect(screen.getByTestId('screenplay-ranking-top')).toHaveAttribute(
      'data-screenplay-id',
      'delta',
    ),
  );
  expect(screen.queryAllByTestId('screenplay-ranking-runner')).toHaveLength(0);
  expect(screen.queryAllByTestId('screenplay-discovery-result')).toHaveLength(0);

  await user.clear(search);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Sort results' }), 'title');
  await waitFor(() =>
    expect(screen.queryByTestId('screenplay-discovery-ranking')).not.toBeInTheDocument(),
  );
  expect(screen.getAllByTestId('screenplay-discovery-result')).toHaveLength(6);
  expect(screen.getAllByTestId('screenplay-discovery-result')[0]).toHaveAttribute(
    'data-screenplay-id',
    'amber',
  );
  expect(screen.getByRole('heading', { name: 'The complete slate' })).toBeInTheDocument();
});
```

Add a rankability regression:

```ts
it('keeps an unrankable project in the wall instead of silently hiding it', async () => {
  hookState.screenplays[1] = {
    ...hookState.screenplays[1],
    producerProjection: { rankable: false },
  } as Screenplay;

  renderPage();

  expect(await screen.findByTestId('screenplay-discovery-ranking')).toBeInTheDocument();
  expect(
    screen
      .getAllByTestId('screenplay-discovery-result')
      .map((result) => result.getAttribute('data-screenplay-id')),
  ).toContain('delta');
});
```

Add a connected sort regression so the plan proves the existing sort machinery and all three surfaces stay aligned:

```tsx
it('reorders top result, runners, and wall for Market Potential and CVS', async () => {
  const user = userEvent.setup();
  const alpha = screenplay('alpha', 'Alpha', 9.0);
  const bravo = screenplay('bravo', 'Bravo', 8.0);
  const charlie = screenplay('charlie', 'Charlie', 7.0);
  const delta = screenplay('delta', 'Delta', 6.0);
  const echo = screenplay('echo', 'Echo', 5.0);
  hookState.screenplays = [
    {
      ...alpha,
      producerMetrics: { ...alpha.producerMetrics, marketPotential: 3 },
      commercialViability: { ...alpha.commercialViability, cvsTotal: 18, cvsAssessed: true },
      cvsTotal: 18,
    },
    {
      ...bravo,
      producerMetrics: { ...bravo.producerMetrics, marketPotential: 10 },
      commercialViability: { ...bravo.commercialViability, cvsTotal: 12, cvsAssessed: true },
      cvsTotal: 12,
    },
    {
      ...charlie,
      producerMetrics: { ...charlie.producerMetrics, marketPotential: 8 },
      commercialViability: { ...charlie.commercialViability, cvsTotal: 14, cvsAssessed: true },
      cvsTotal: 14,
    },
    {
      ...delta,
      producerMetrics: { ...delta.producerMetrics, marketPotential: 7 },
      commercialViability: { ...delta.commercialViability, cvsTotal: 16, cvsAssessed: true },
      cvsTotal: 16,
    },
    {
      ...echo,
      producerMetrics: { ...echo.producerMetrics, marketPotential: 6 },
      commercialViability: { ...echo.commercialViability, cvsTotal: 10, cvsAssessed: true },
      cvsTotal: 10,
    },
  ];

  renderPage();
  const sort = await screen.findByRole('combobox', { name: 'Sort results' });
  await user.selectOptions(sort, 'marketPotential');
  await waitFor(() =>
    expect(screen.getByTestId('screenplay-ranking-top')).toHaveAttribute(
      'data-screenplay-id',
      'bravo',
    ),
  );
  expect(screen.getAllByTestId('screenplay-ranking-runner')[0]).toHaveAttribute(
    'data-screenplay-id',
    'charlie',
  );
  expect(screen.getByTestId('screenplay-discovery-result')).toHaveAttribute(
    'data-screenplay-id',
    'alpha',
  );

  await user.selectOptions(sort, 'cvsTotal');
  await waitFor(() =>
    expect(screen.getByTestId('screenplay-ranking-top')).toHaveAttribute(
      'data-screenplay-id',
      'alpha',
    ),
  );
  expect(screen.getAllByTestId('screenplay-ranking-runner')[0]).toHaveAttribute(
    'data-screenplay-id',
    'delta',
  );
  expect(screen.getByTestId('screenplay-discovery-result')).toHaveAttribute(
    'data-screenplay-id',
    'echo',
  );
});
```

Keep the existing connected route, drawer fallback, and display-title cleanup tests unchanged.

- [ ] **Step 2: Run the connected-page test and verify the hierarchy failures**

Run:

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
npx vitest run src/pages/DiscoverPage.screenplay.test.tsx
```

Expected: FAIL because the ranking test IDs and non-duplicated wall do not exist.

- [ ] **Step 3: Add the shared presentation types**

Create `src/components/discover/screenplay/screenplayPresentationTypes.ts`:

```ts
import type { PercentileRank } from '@/lib/percentileRanking';
import type { Screenplay } from '@/types';

export type PercentileMap = ReadonlyMap<string, PercentileRank>;

export interface OpenScreenplay {
  (screenplay: Screenplay, trigger: HTMLButtonElement): void;
}
```

- [ ] **Step 4: Add the compact, honest slate statistics strip**

Create `src/components/discover/screenplay/ScreenplaySlateStats.tsx`:

```tsx
import type { Screenplay } from '@/types';

interface ScreenplaySlateStatsProps {
  screenplays: Screenplay[];
  totalCount: number;
  producerLookCount: number;
  loading?: boolean;
}

export function ScreenplaySlateStats({
  screenplays,
  totalCount,
  producerLookCount,
  loading = false,
}: ScreenplaySlateStatsProps) {
  const average =
    screenplays.length > 0
      ? screenplays.reduce((sum, screenplay) => sum + screenplay.weightedScore, 0) /
        screenplays.length
      : 0;
  const priorityCount = screenplays.filter(
    (screenplay) =>
      screenplay.recommendation === 'film_now' || screenplay.recommendation === 'recommend',
  ).length;

  return (
    <section
      className="screenplay-slate-stats"
      aria-label="Current slate statistics"
      aria-busy={loading}
    >
      {loading ? (
        Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="screenplay-slate-stats__skeleton" aria-hidden="true" />
        ))
      ) : (
        <>
          <span><strong>{totalCount}</strong><small>Total scripts</small></span>
          <span><strong>{screenplays.length}</strong><small>Visible</small></span>
          <span><strong>{average.toFixed(1)}</strong><small>Average score</small></span>
          <span><strong>{priorityCount}</strong><small>Film Now + Recommend</small></span>
          <span><strong>{producerLookCount}</strong><small>Producer Look</small></span>
        </>
      )}
    </section>
  );
}
```

In the connected page test, add this assertion to the first hierarchy test:

```tsx
const stats = screen.getByRole('region', { name: 'Current slate statistics' });
expect(within(stats).getAllByText('6')).toHaveLength(2);
expect(within(stats).getByText('Visible')).toBeInTheDocument();
expect(within(stats).getByText('Average score')).toBeInTheDocument();
expect(within(stats).getByText('Film Now + Recommend')).toBeInTheDocument();
expect(within(stats).getByText('Producer Look')).toBeInTheDocument();
```

Render the stats strip between `HybridHeader` and `HybridCommandRail` in `ScreenplayDiscoverShell.tsx`:

```tsx
<ScreenplaySlateStats
  screenplays={screenplays}
  totalCount={totalCount}
  producerLookCount={producerLookCount ?? 0}
  loading={isLoading}
/>
```

This makes the statistics visible in loading, empty, error, and populated Discovery states without changing the existing state panels.

- [ ] **Step 5: Create the compact ranking component**

Create `src/components/discover/screenplay/ScreenplayRanking.tsx` with these exact public props and semantic test hooks:

```tsx
import { DiscoverySelectionCheckbox } from '@/components/discover/DiscoverySelectionCheckbox';
import { DevelopmentOpportunityBadge } from '@/components/discover/DevelopmentOpportunityBadge';
import { BlueSpineScript } from '@/components/discover/screenplay/BlueSpineScript';
import type {
  OpenScreenplay,
  PercentileMap,
} from '@/components/discover/screenplay/screenplayPresentationTypes';
import type { RankedScreenplay } from '@/components/discover/screenplay/screenplayRanking';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { getScreenplayDisplayTitle, getScreenplayFormatInfo } from '@/lib/screenplayDisplay';
import type { ProducerAssessmentHead, Screenplay, SortField } from '@/types';

function ordinal(value: number): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function rankingMetric(
  screenplay: Screenplay,
  sortField: SortField,
): { label: string; value: string } {
  if (sortField === 'marketPotential') {
    return {
      label: 'Market potential',
      value:
        screenplay.producerMetrics.marketPotential === null
          ? 'Not assessed'
          : screenplay.producerMetrics.marketPotential.toFixed(1),
    };
  }
  if (sortField === 'cvsTotal') {
    return {
      label: 'Commercial viability',
      value: screenplay.commercialViability.cvsAssessed
        ? screenplay.cvsTotal.toFixed(0)
        : 'Not assessed',
    };
  }
  return { label: 'Final score', value: screenplay.weightedScore.toFixed(1) };
}

interface ScreenplayRankingProps {
  topResult: RankedScreenplay;
  nextThree: RankedScreenplay[];
  reason: string;
  filterContext: string;
  sortField: SortField;
  percentiles: PercentileMap;
  producerAssessments: ReadonlyMap<string, ProducerAssessmentHead>;
  producerLookIds?: ReadonlySet<string>;
  onOpen: OpenScreenplay;
}

export function ScreenplayRanking({
  topResult,
  nextThree,
  reason,
  filterContext,
  sortField,
  percentiles,
  producerAssessments,
  producerLookIds,
  onOpen,
}: ScreenplayRankingProps) {
  const screenplay = topResult.screenplay;
  const title = getScreenplayDisplayTitle(screenplay.title);
  const format = getScreenplayFormatInfo(screenplay);
  const percentile = percentiles.get(screenplay.id);
  const projectKey = screenplay.projectId ?? screenplay.id;
  const metric = rankingMetric(screenplay, sortField);

  return (
    <section
      className="screenplay-ranking"
      data-testid="screenplay-discovery-ranking"
      aria-labelledby="screenplay-ranking-title"
    >
      <header className="screenplay-ranking__heading">
        <div>
          <p className="screenplay-ui-eyebrow">Best in the current view</p>
          <h2 id="screenplay-ranking-title">Top result</h2>
        </div>
        <p>{reason} · {filterContext}</p>
      </header>
      <div className="screenplay-ranking__layout">
        <article
          className="screenplay-ranking__top"
          data-testid="screenplay-ranking-top"
          data-screenplay-id={screenplay.id}
        >
          <DiscoverySelectionCheckbox screenplay={screenplay} />
          <button
            type="button"
            className="screenplay-ranking__top-open"
            onClick={(event) => onOpen(screenplay, event.currentTarget)}
            aria-label={`Open ${title.title} screenplay file`}
          >
            <span className="screenplay-ranking__object">
              <BlueSpineScript screenplay={screenplay} featured rank={topResult.rank} />
            </span>
            <span className="screenplay-ranking__brief">
              <span className="screenplay-ranking__title">{title.title}</span>
              {title.qualifier && <span className="screenplay-ranking__qualifier">{title.qualifier}</span>}
              <span className="screenplay-ranking__meta">
                {format.format} · {screenplay.genre} · {screenplay.author || 'Unknown writer'}
              </span>
              <span className="screenplay-ranking__logline">
                {screenplay.logline || 'Logline not yet available.'}
              </span>
              <span className="screenplay-ranking__decision">
                <RecommendationBadge tier={screenplay.recommendation} />
                <DevelopmentOpportunityBadge
                  screenplay={screenplay}
                  assessment={producerAssessments.get(projectKey)}
                  routed={producerLookIds?.has(projectKey)}
                />
                <strong>{metric.value}</strong>
                <small>{metric.label}</small>
                <small>
                  {percentile
                    ? `${ordinal(percentile.overall)} final-score percentile`
                    : 'Position pending'}
                </small>
              </span>
              <span className="screenplay-ranking__action">Open screenplay file →</span>
            </span>
          </button>
        </article>
        {nextThree.length > 0 && (
          <ol className="screenplay-ranking__runners" aria-label="Next three results">
            {nextThree.map((entry) => {
              const runner = entry.screenplay;
              const runnerTitle = getScreenplayDisplayTitle(runner.title);
              const runnerFormat = getScreenplayFormatInfo(runner);
              const runnerPercentile = percentiles.get(runner.id);
              const runnerMetric = rankingMetric(runner, sortField);
              return (
                <li
                  key={runner.id}
                  data-testid="screenplay-ranking-runner"
                  data-screenplay-id={runner.id}
                >
                  <DiscoverySelectionCheckbox screenplay={runner} />
                  <button
                    type="button"
                    onClick={(event) => onOpen(runner, event.currentTarget)}
                    aria-label={`Open ${runnerTitle.title} screenplay file`}
                  >
                    <BlueSpineScript screenplay={runner} rank={entry.rank} />
                    <span>
                      <small>#{entry.rank} · {runnerFormat.format}</small>
                      <strong>{runnerTitle.title}</strong>
                      <em>{runner.author || 'Unknown writer'}</em>
                      <b>{runnerMetric.value}</b>
                      <small>{runnerMetric.label}</small>
                      <small>
                        {runnerPercentile
                          ? `${ordinal(runnerPercentile.overall)} final-score percentile`
                          : 'Position pending'}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Convert the wall to preserved ranked entries**

In `src/components/discover/screenplay/ScreenplayResults.tsx`:

1. Delete `sortLabel` and the entire `ScreenplayFeature` export.
2. Import `RankedScreenplay`, `OpenScreenplay`, and `PercentileMap` from the new modules.
3. Replace the `ScreenplayGrid` signature and map prelude with:

```tsx
export function ScreenplayGrid({
  entries,
  percentiles,
  producerAssessments,
  producerLookIds,
  onOpen,
}: {
  entries: RankedScreenplay[];
  percentiles: PercentileMap;
  producerAssessments?: ReadonlyMap<string, ProducerAssessmentHead>;
  producerLookIds?: ReadonlySet<string>;
  onOpen: OpenScreenplay;
}) {
  return (
    <ul className="screenplay-wall" data-testid="screenplay-discovery-grid">
      {entries.map(({ screenplay, rank }) => {
```

4. Replace `<BlueSpineScript screenplay={screenplay} rank={rankOffset + index + 1} />` with:

```tsx
<BlueSpineScript screenplay={screenplay} rank={rank} />
```

5. Keep the existing card metadata, trust, share, Producer Look, selection, accessible name, and `data-verdict` markup unchanged.

- [ ] **Step 7: Compose ranking and wall pagination in the shell**

In `src/components/discover/screenplay/ScreenplayDiscoverShell.tsx`:

1. Replace the `ScreenplayFeature` import with `ScreenplayRanking` and `buildScreenplayRanking`.
2. Replace the current `signature`, `pageCount`, `visibleScreenplays`, and `featured` calculations with:

```ts
const ranking = useMemo(
  () => buildScreenplayRanking(screenplays, activeSort),
  [activeSort, screenplays],
);
const signature = useMemo(
  () => ranking.wall.map((entry) => entry.screenplay.id).join('|'),
  [ranking.wall],
);
const pageCount = Math.max(1, Math.ceil(ranking.wall.length / PAGE_SIZE));
const safePage =
  archivePosition.signature === signature ? Math.min(archivePosition.page, pageCount) : 1;
const visibleEntries = ranking.wall.slice(
  (safePage - 1) * PAGE_SIZE,
  safePage * PAGE_SIZE,
);
```

3. At the start of the successful-data fragment, render:

```tsx
{ranking.showRanking && ranking.topResult && ranking.reason && (
  <ScreenplayRanking
    topResult={ranking.topResult}
    nextThree={ranking.nextThree}
    reason={ranking.reason}
    filterContext={
      hasActiveFilters
        ? `Current filters · ${filteredCount} of ${totalCount} visible`
        : 'All visible screenplays'
    }
    sortField={activeSort}
    percentiles={percentiles}
    producerAssessments={producerAssessments}
    producerLookIds={producerLookIds}
    onOpen={handleOpen}
  />
)}
```

4. Change the slate heading to:

```tsx
<p className="screenplay-ui-eyebrow">Searchable archive</p>
<h2 id="screenplay-slate-title">
  {ranking.showRanking ? 'Continue through the slate' : 'The complete slate'}
</h2>
```

5. Replace the grid call with:

```tsx
<ScreenplayGrid
  entries={visibleEntries}
  percentiles={percentiles}
  producerAssessments={producerAssessments}
  producerLookIds={producerLookIds}
  onOpen={handleOpen}
/>
```

6. Keep visible/total/hidden inventory disclosure based on the original `filteredCount`, `totalCount`, `producedHiddenCount`, and `nonScreenplayHiddenCount` props. The wall may be empty when all matching results are promoted; that is valid and must not trigger the no-results state.

- [ ] **Step 8: Run ranking, page, route, and legacy dashboard tests**

Run:

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
npx vitest run src/components/discover/screenplay/screenplayRanking.test.ts src/pages/DiscoverPage.screenplay.test.tsx src/pages/DiscoverPage.test.tsx
```

Expected: all focused tests PASS; normal navigation and drawer fallback assertions remain green.

- [ ] **Step 9: Commit the connected hierarchy**

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
git add src/components/discover/screenplay/screenplayPresentationTypes.ts src/components/discover/screenplay/ScreenplaySlateStats.tsx src/components/discover/screenplay/ScreenplayRanking.tsx src/components/discover/screenplay/ScreenplayDiscoverShell.tsx src/components/discover/screenplay/ScreenplayResults.tsx src/pages/DiscoverPage.screenplay.test.tsx
git commit -m "ui: build compact Discovery ranking hierarchy"
```

---

### Task 3: Add Collapsed, Lazy, Failure-Isolated Slate Insights

**Files:**
- Create: `src/components/discover/screenplay/ScreenplaySlateInsights.tsx`
- Create: `src/components/discover/screenplay/ScreenplaySlateInsights.test.tsx`
- Modify: `src/components/charts/AnalyticsDashboard.tsx`
- Modify: `src/components/charts/AnalyticsDashboard.test.tsx`
- Modify: `src/components/discover/screenplay/ScreenplayDiscoverShell.tsx`

**Interfaces:**
- Consumes: the currently filtered `screenplays` plus `allScreenplays` for honest filtered counts.
- Produces: additive `AnalyticsDashboard` props `title`, `initiallyExpanded`, `deferContentUntilExpanded`, and `className`, all with defaults that preserve the old dashboard.
- Failure boundary: an analytics import/render failure shows a contained message and never replaces search, ranking, or wall results.

- [ ] **Step 1: Add failing tests for old defaults and deferred collapsed mode**

In `src/components/charts/AnalyticsDashboard.test.tsx`, import `userEvent` and add:

```ts
import userEvent from '@testing-library/user-event';
```

Add these tests:

```tsx
it('preserves the old expanded default when no presentation props are supplied', () => {
  render(<AnalyticsDashboard screenplays={mockScreenplays} />);

  expect(screen.getByRole('button', { name: /Analytics Dashboard/i })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  expect(screen.getByTestId('score-distribution')).toBeInTheDocument();
});

it('defers chart rendering until a collapsed disclosure is opened', async () => {
  const user = userEvent.setup();
  render(
    <AnalyticsDashboard
      screenplays={mockScreenplays}
      title="Slate Insights"
      initiallyExpanded={false}
      deferContentUntilExpanded
    />,
  );

  const toggle = screen.getByRole('button', { name: /Slate Insights/i });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByTestId('score-distribution')).not.toBeInTheDocument();

  await user.click(toggle);

  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByTestId('score-distribution')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the analytics test and verify the new prop failure**

Run:

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
npx vitest run src/components/charts/AnalyticsDashboard.test.tsx
```

Expected: FAIL because the additive props and `aria-expanded` are absent.

- [ ] **Step 3: Add optional AnalyticsDashboard presentation props with old defaults**

Extend `AnalyticsDashboardProps` in `src/components/charts/AnalyticsDashboard.tsx`:

```ts
interface AnalyticsDashboardProps {
  screenplays: Screenplay[];
  totalScreenplays?: Screenplay[];
  onFilterByScoreRange?: (range: { min: number; max: number }) => void;
  onFilterByTier?: (tier: RecommendationTier) => void;
  onFilterByGenre?: (genre: string) => void;
  onFilterByBudget?: (budget: BudgetCategory) => void;
  title?: string;
  initiallyExpanded?: boolean;
  deferContentUntilExpanded?: boolean;
  className?: string;
}
```

Add defaults in the parameter list:

```ts
title = 'Analytics Dashboard',
initiallyExpanded = true,
deferContentUntilExpanded = false,
className = '',
```

Replace `useState(true)` with:

```ts
const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
```

Change the outer wrapper and button opening tags to:

```tsx
<div className={`mb-6 ${className}`.trim()}>
  <button
    type="button"
    onClick={() => setIsExpanded((expanded) => !expanded)}
    aria-expanded={isExpanded}
    aria-controls="analytics-dashboard-content"
    className="w-full flex items-center justify-between p-4 rounded-lg glass border border-black-700 hover:border-gold-500/50 transition-colors"
  >
```

Replace the hardcoded heading with `{title}`. Give the content wrapper `id="analytics-dashboard-content"`. Wrap the chart grid and `TasteMatch` with:

```tsx
{(!deferContentUntilExpanded || isExpanded) && (
  <>
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {chartCards.map((card, index) => (
        <div
          key={card.title}
          className={isExpanded ? 'card-enter' : ''}
          style={
            isExpanded
              ? { animationDelay: `${index * 100}ms`, animationFillMode: 'both' }
              : undefined
          }
        >
          <div className="glass rounded-lg border border-black-700 p-4 h-full">
            <h2 className="text-sm font-medium text-black-300 mb-3">{card.title}</h2>
            <div className="h-48">{card.content}</div>
            {card.hint && (
              <p className="text-xs text-black-400 mt-2 text-center">{card.hint}</p>
            )}
          </div>
        </div>
      ))}
    </div>
    {isAdmin && <TasteMatch />}
  </>
)}
```

Do not change chart calculations or filter callbacks.

- [ ] **Step 4: Write the failing screenplay-only wrapper tests**

Create `src/components/discover/screenplay/ScreenplaySlateInsights.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import { ScreenplaySlateInsights } from './ScreenplaySlateInsights';

vi.mock('@/components/charts/AnalyticsDashboard', () => ({
  AnalyticsDashboard: ({ initiallyExpanded }: { initiallyExpanded?: boolean }) => (
    <button type="button" aria-expanded={initiallyExpanded}>Slate Insights</button>
  ),
}));

describe('ScreenplaySlateInsights', () => {
  it('loads the screenplay analytics disclosure collapsed', async () => {
    const user = userEvent.setup();
    render(
      <ScreenplaySlateInsights
        screenplays={[createTestScreenplay({ id: 'visible' })]}
        allScreenplays={[createTestScreenplay({ id: 'visible' })]}
      />,
    );

    const disclosure = screen.getByRole('button', { name: /Show Slate Insights/i });
    expect(disclosure).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await user.click(disclosure);
    expect(await screen.findByRole('button', { name: 'Slate Insights' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('contains lazy-load failures without removing sibling results', async () => {
    const Broken = () => {
      throw new Error('analytics unavailable');
    };
    const user = userEvent.setup();

    render(
      <div>
        <button type="button">Screenplay result</button>
        <ScreenplaySlateInsights
          screenplays={[createTestScreenplay({ id: 'visible' })]}
          allScreenplays={[createTestScreenplay({ id: 'visible' })]}
          AnalyticsComponent={Broken}
        />
      </div>,
    );

    await user.click(await screen.findByRole('button', { name: 'Show Slate Insights' }));

    expect(screen.getByText(/Slate Insights are temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Screenplay result' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Implement the lazy, isolated wrapper**

Create `src/components/discover/screenplay/ScreenplaySlateInsights.tsx`:

```tsx
import { lazy, Suspense, useState, type ComponentType } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import type { Screenplay } from '@/types';

interface AnalyticsProps {
  screenplays: Screenplay[];
  totalScreenplays?: Screenplay[];
  title?: string;
  initiallyExpanded?: boolean;
  deferContentUntilExpanded?: boolean;
  className?: string;
}

const LazyAnalyticsDashboard = lazy(async () => {
  const module = await import('@/components/charts/AnalyticsDashboard');
  return { default: module.AnalyticsDashboard };
});

interface ScreenplaySlateInsightsProps {
  screenplays: Screenplay[];
  allScreenplays: Screenplay[];
  AnalyticsComponent?: ComponentType<AnalyticsProps>;
}

export function ScreenplaySlateInsights({
  screenplays,
  allScreenplays,
  AnalyticsComponent = LazyAnalyticsDashboard,
}: ScreenplaySlateInsightsProps) {
  const [requested, setRequested] = useState(false);

  if (!requested) {
    return (
      <section className="screenplay-insights screenplay-insights--collapsed">
        <button type="button" onClick={() => setRequested(true)} aria-expanded="false">
          <span>
            <strong>Slate Insights</strong>
            <small>Score distribution · verdict mix · top genres · budget tiers</small>
          </span>
          <span aria-hidden="true">Show</span>
          <span className="sr-only">Show Slate Insights</span>
        </button>
      </section>
    );
  }

  return (
    <section className="screenplay-insights">
      <ErrorBoundary
        fallback={
          <p role="status" className="screenplay-insights__error">
            Slate Insights are temporarily unavailable. Your screenplay results are unaffected.
          </p>
        }
      >
        <Suspense fallback={<p role="status">Opening Slate Insights…</p>}>
          <AnalyticsComponent
            screenplays={screenplays}
            totalScreenplays={allScreenplays}
            title="Slate Insights"
            initiallyExpanded
            deferContentUntilExpanded
            className="screenplay-insights__dashboard"
          />
        </Suspense>
      </ErrorBoundary>
    </section>
  );
}
```

- [ ] **Step 6: Insert Slate Insights directly below the controls**

In `ScreenplayDiscoverShell.tsx`, import `ScreenplaySlateInsights` and render it as the first child of the successful-data fragment, before `ScreenplayRanking`:

```tsx
<ScreenplaySlateInsights
  screenplays={screenplays}
  allScreenplays={allScreenplays}
/>
```

Do not render it during loading, error, no-data, or no-results states. Its internal state must not read or write filter or sort stores.

- [ ] **Step 7: Run analytics, wrapper, and connected Discovery tests**

Run:

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
npx vitest run src/components/charts/AnalyticsDashboard.test.tsx src/components/discover/screenplay/ScreenplaySlateInsights.test.tsx src/pages/DiscoverPage.screenplay.test.tsx
```

Expected: all focused tests PASS; the old analytics component still starts expanded when used without new props.

- [ ] **Step 8: Commit the disclosure**

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
git add src/components/charts/AnalyticsDashboard.tsx src/components/charts/AnalyticsDashboard.test.tsx src/components/discover/screenplay/ScreenplaySlateInsights.tsx src/components/discover/screenplay/ScreenplaySlateInsights.test.tsx src/components/discover/screenplay/ScreenplayDiscoverShell.tsx
git commit -m "ui: add expandable Discovery slate insights"
```

---

### Task 4: Apply Blue Density, True Page Proportions, and Full Regression Proof

**Files:**
- Modify: `src/components/discover/screenplay/blue-spine-script.css`
- Modify: `src/components/discover/screenplay/screenplay-discovery.css`
- Modify: `src/pages/DiscoverPage.screenplay.test.tsx`
- Verify without modifying: `src/components/discover/hybrid/HybridHeader.tsx`
- Verify without modifying: `src/components/discover/hybrid/HybridCommandRail.tsx`

**Interfaces:**
- Consumes: existing screenplay presentation class names plus the Task 2 ranking markup.
- Produces: one scoped blue visual system at desktop/tablet, visible focus, and physically proportioned screenplay covers.
- Does not affect: classic Discovery selectors, project workspace selectors, shared modal selectors, or store behavior.

- [ ] **Step 1: Add final connected regressions for search and fallbacks**

In `src/pages/DiscoverPage.screenplay.test.tsx`, add:

```tsx
it('keeps search accessible and the classic presentation available', async () => {
  const screenplayView = renderPage('/discover?ui=screenplay');
  expect(await screen.findByRole('searchbox', { name: 'Discovery search' })).toBeInTheDocument();
  screenplayView.unmount();

  renderPage('/discover?ui=classic');
  expect(await screen.findByRole('searchbox', { name: /search/i })).toBeInTheDocument();
  expect(screen.queryByTestId('screenplay-discovery-ranking')).not.toBeInTheDocument();
});
```

Retain the existing connected project route and drawer fallback test. Do not snapshot CSS; the physical ratio and density require browser verification.

- [ ] **Step 2: Narrow the spine without changing the page ratio**

In `blue-spine-script.css`, keep `aspect-ratio: 8.5 / 11` and replace the spine geometry with:

```css
.screenplay-object__spine {
  position: absolute;
  inset: -3px auto -7px -7.5%;
  width: 8%;
  min-width: 14px;
  max-width: 19px;
  border-radius: 7px 0 0 7px;
  background: #183f8d;
  box-shadow:
    inset -4px 0 7px rgb(0 0 0 / 0.2),
    -3px 4px 8px rgb(0 0 0 / 0.24);
}
```

Change brad width/height from `13px` to `11px` and left position from `12px` to `10px`. Keep both fasteners inset at 12% from top/bottom. Do not change title cleanup or title line limits.

- [ ] **Step 3: Force blue chrome only inside screenplay Discovery**

In `screenplay-discovery.css`, replace the current header/rail override with:

```css
.screenplay-discovery .hybrid-header,
.screenplay-discovery .hybrid-command-rail {
  --hybrid-accent: var(--screenplay-cobalt);
  --hybrid-accent-strong: #2145cf;
  --hybrid-accent-soft: #dfe7ff;
  --hybrid-surface: #0c1729;
  --hybrid-surface-raised: #111f35;
  --hybrid-line: #243652;
  --hybrid-ink: #f4f7fc;
  --hybrid-muted: #9eabc0;
  background: var(--hybrid-surface);
  color: var(--hybrid-ink);
}

.screenplay-discovery .hybrid-header {
  isolation: isolate;
  min-height: 56px;
  box-shadow: 0 1px 0 var(--hybrid-line);
  backdrop-filter: none;
}

.screenplay-discovery .hybrid-header__search input,
.screenplay-discovery .hybrid-command-rail input,
.screenplay-discovery .hybrid-command-rail select {
  border-color: #2b4061;
  background: #0a1424;
  color: #f5f7fb;
}

.screenplay-discovery .hybrid-header :focus-visible,
.screenplay-discovery .hybrid-command-rail :focus-visible {
  outline: 3px solid #6e8bff;
  outline-offset: 2px;
}
```

Inspect the real class names in `HybridHeader.tsx` before applying the search-input selector. If the input wrapper differs, target its existing class; do not modify the header component merely to make CSS selection easier.

- [ ] **Step 4: Replace the 500 px feature rules with compact ranking rules**

Delete the `.screenplay-feature*` block. Add these scoped rules:

```css
.screenplay-slate-stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  border-bottom: 1px solid #243652;
  background: #111f35;
  color: #f4f7fc;
}

.screenplay-slate-stats > span {
  display: flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 7px 12px;
  border-left: 1px solid #243652;
}

.screenplay-slate-stats > span:first-child {
  border-left: 0;
}

.screenplay-slate-stats strong {
  font-family: var(--dsc-font-type);
  font-size: 15px;
}

.screenplay-slate-stats small {
  color: #9eabc0;
  font-size: 9px;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.screenplay-slate-stats__skeleton {
  min-height: 44px;
  background: linear-gradient(90deg, #111f35 25%, #1a2b46 50%, #111f35 75%);
  background-size: 200% 100%;
  animation: screenplay-stats-shimmer 1.4s linear infinite;
}

@keyframes screenplay-stats-shimmer {
  to { background-position: -200% 0; }
}

.screenplay-insights {
  margin-bottom: 14px;
}

.screenplay-insights--collapsed > button {
  display: flex;
  width: 100%;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 9px 16px;
  border: 1px solid #243652;
  border-radius: 10px;
  background: #111f35;
  color: #eef3fb;
  text-align: left;
}

.screenplay-insights--collapsed strong,
.screenplay-insights--collapsed small {
  display: block;
}

.screenplay-insights--collapsed small {
  margin-top: 2px;
  color: #9eabc0;
  font-size: 11px;
}

.screenplay-insights__error {
  padding: 12px 16px;
  border: 1px solid #5e3340;
  border-radius: 10px;
  background: #25151d;
  color: #ffd8df;
}

.screenplay-ranking {
  margin-bottom: 20px;
  overflow: hidden;
  border: 1px solid #243652;
  border-radius: 14px;
  background: var(--screenplay-midnight);
  color: #f7f3e9;
}

.screenplay-ranking__heading {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 10px 16px;
  border-bottom: 1px solid #243652;
}

.screenplay-ranking__heading h2 {
  margin-top: 2px;
  font-family: var(--dsc-font-display);
  font-size: clamp(22px, 2vw, 30px);
  font-weight: 600;
}

.screenplay-ranking__heading > p {
  color: #aeb8ca;
  font-size: 11px;
}

.screenplay-ranking__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(420px, 1fr);
  min-height: 198px;
}

.screenplay-ranking__top {
  position: relative;
  min-width: 0;
  border-right: 1px solid #243652;
}

.screenplay-ranking__top > .discovery-selection-checkbox,
.screenplay-ranking__runners .discovery-selection-checkbox {
  position: absolute;
  z-index: 4;
  top: 9px;
  left: 9px;
}

.screenplay-ranking__top-open {
  display: grid;
  width: 100%;
  min-height: 198px;
  grid-template-columns: 142px minmax(0, 1fr);
  gap: 20px;
  align-items: center;
  padding: 14px 22px;
  color: inherit;
  text-align: left;
}

.screenplay-ranking__object {
  display: grid;
  height: 170px;
  place-items: center;
}

.screenplay-ranking__object .screenplay-object {
  width: auto;
  height: 160px;
}

.screenplay-ranking__brief {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.screenplay-ranking__title {
  overflow: hidden;
  color: #fbf8ef;
  font-family: var(--dsc-font-display);
  font-size: clamp(28px, 2.8vw, 42px);
  font-weight: 600;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.screenplay-ranking__qualifier,
.screenplay-ranking__meta {
  margin-top: 6px;
  overflow: hidden;
  color: #9ea9bd;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.screenplay-ranking__logline {
  display: -webkit-box;
  max-width: 760px;
  overflow: hidden;
  margin-top: 10px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: #d3d9e4;
  font-size: 13px;
  line-height: 1.48;
}

.screenplay-ranking__decision {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.screenplay-ranking__decision > strong {
  color: #f8f4e8;
  font-family: var(--dsc-font-type);
  font-size: 20px;
}

.screenplay-ranking__decision > small,
.screenplay-ranking__action {
  color: #9ea9bd;
  font-size: 10px;
}

.screenplay-ranking__action {
  margin-top: 8px;
  color: #8da4ff;
  font-weight: 750;
}

.screenplay-ranking__runners {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.screenplay-ranking__runners li {
  position: relative;
  min-width: 0;
  border-left: 1px solid #243652;
}

.screenplay-ranking__runners li:first-child {
  border-left: 0;
}

.screenplay-ranking__runners button {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 9px;
  color: inherit;
  text-align: center;
}

.screenplay-ranking__runners .screenplay-object {
  width: auto;
  height: 92px;
}

.screenplay-ranking__runners button > span {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.screenplay-ranking__runners strong {
  overflow: hidden;
  font-family: var(--dsc-font-display);
  font-size: 13px;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.screenplay-ranking__runners em,
.screenplay-ranking__runners small {
  overflow: hidden;
  color: #96a2b7;
  font-size: 8px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.screenplay-ranking__runners b {
  color: #f7f3e9;
  font-family: var(--dsc-font-type);
  font-size: 16px;
}

.screenplay-ranking button:focus-visible {
  outline: 3px solid #6e8bff;
  outline-offset: -4px;
}
```

- [ ] **Step 5: Tighten the wall without shrinking screenplay proportions**

Update existing rules in `screenplay-discovery.css` to these values:

```css
.screenplay-discovery__main {
  position: relative;
  z-index: 0;
  max-width: 1680px;
  margin: 0 auto;
  padding: 16px clamp(16px, 2.4vw, 38px) 88px;
}

.screenplay-slate {
  margin-top: 24px;
}

.screenplay-slate__heading {
  margin-bottom: 14px;
}

.screenplay-slate__heading h2 {
  margin-top: 3px;
  font-size: 30px;
}

.screenplay-wall {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
}

.screenplay-wall__object-stage {
  min-height: 270px;
  padding: 18px 22px 22px;
}

.screenplay-wall__item .screenplay-object {
  z-index: 1;
  width: min(61%, 182px);
}
```

Preserve the approved verdict-tinted stage backgrounds and status badges. Do not reduce body copy below 11 px or interactive targets below 40 px.

- [ ] **Step 6: Add tablet and reduced-motion behavior**

Append:

```css
@media (max-width: 1180px) {
  .screenplay-ranking__layout {
    grid-template-columns: 1fr;
  }

  .screenplay-ranking__top {
    border-right: 0;
    border-bottom: 1px solid #243652;
  }

  .screenplay-ranking__runners {
    min-height: 150px;
  }

  .screenplay-wall {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .screenplay-slate-stats {
    grid-template-columns: repeat(5, minmax(110px, 1fr));
    overflow-x: auto;
  }

  .screenplay-ranking__top-open {
    grid-template-columns: 112px minmax(0, 1fr);
  }

  .screenplay-ranking__object {
    height: 146px;
  }

  .screenplay-ranking__object .screenplay-object {
    height: 138px;
  }

  .screenplay-wall {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .screenplay-ranking button,
  .screenplay-wall__open,
  .screenplay-insights button {
    transition: none;
  }

  .screenplay-slate-stats__skeleton {
    animation: none;
  }
}
```

- [ ] **Step 7: Run all automated proof**

Run:

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
npm run lint
npm run test:run
npm run build
```

Expected: lint clean, the complete dashboard test suite green, and production build successful. If the full test runner shows an existing macOS transient worker error, rerun `npm run test:run` once serially before changing code; do not mask a reproducible assertion failure.

- [ ] **Step 8: Perform the signed-in browser QA matrix**

Start the fixed-port app only after checking for a stale process:

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
lsof -nP -iTCP:3000 -sTCP:LISTEN
npm run dev
```

Verify these exact URLs and behaviors:

1. `http://localhost:3000/discover?ui=screenplay`
   - header and controls are blue in light and dark themes;
   - search is visible and `/` focuses it;
   - Slate Insights is a slim collapsed row;
   - Final score shows Top Result plus Next Three;
   - screenplay covers read as full 8.5 × 11 pages with a narrower spine;
   - the start of the wall is visible in the first desktop viewport when the browser height permits.
2. Change sort to Market potential and Commercial viability:
   - ranking reason changes;
   - leader, runners, and wall reorder together;
   - no promoted project repeats in the wall.
3. Change sort to Title:
   - ranking disappears completely;
   - wall begins with the first alphabetical result;
   - no “Top result” copy remains.
4. Search and filter to one, two, and zero results:
   - only available ranking slots render;
   - no empty placeholders appear;
   - no-results clear-filters action recovers.
5. Expand and collapse Slate Insights:
   - filters remain unchanged;
   - charts load only when requested;
   - collapse does not move the page back to the top.
6. `http://localhost:3000/discover?ui=classic`
   - classic Discovery remains unchanged.
7. `http://localhost:3000/discover?ui=screenplay&preview=drawer`
   - card opens drawer fallback;
   - Escape closes it and returns focus.
8. Open a project normally:
   - Screenplay File route and its six tabs remain unchanged.

Capture one desktop and one tablet screenshot for Billy’s local review. Do not deploy.

- [ ] **Step 9: Commit the finished local presentation**

```bash
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
git add src/components/discover/screenplay/blue-spine-script.css src/components/discover/screenplay/screenplay-discovery.css src/pages/DiscoverPage.screenplay.test.tsx
git commit -m "ui: finish ranked Discovery presentation"
```

---

## Final Review Gate

- [ ] Confirm `git diff main...HEAD -- functions daemon.py execution firestore.rules storage.rules src/lib src/stores` contains no behavioral changes from this plan.
- [ ] Confirm `/discover?ui=classic`, drawer preview, and Screenplay File fallbacks are intact.
- [ ] Confirm no Top Result or Next Three screenplay repeats in the wall.
- [ ] Confirm title sort contains no quality-ranking language.
- [ ] Confirm every screenplay object is a full 8.5 × 11 page, not a notebook proportion.
- [ ] Confirm global chrome is blue in both themes and verdict colors remain semantic.
- [ ] Confirm all tests, lint, and build are green before requesting Billy’s local approval.
- [ ] Report in producer language, starting with “What this means for you,” and recommend the exact local review sequence. No deployment request belongs in this bundle.
