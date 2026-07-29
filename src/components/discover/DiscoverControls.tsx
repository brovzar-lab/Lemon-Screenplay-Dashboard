import { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { MultiSelect } from '@/components/filters/MultiSelect';
import { RangeSlider } from '@/components/filters/RangeSlider';
import { LensMenu } from '@/components/filters/LensMenu';
import { DiscoveryFavoritesMenu } from '@/components/discover/DiscoveryFavoritesMenu';
import { useFilterStore } from '@/stores/filterStore';
import { useSortStore } from '@/stores/sortStore';
import {
  RECOMMENDATION_CONFIG,
  type RecommendationTier,
  type SortDirection,
  type SortField,
  type Screenplay,
} from '@/types';

const VERDICTS: RecommendationTier[] = ['film_now', 'recommend', 'consider', 'pass'];

const VERDICT_STYLES: Record<RecommendationTier, string> = {
  film_now: 'dsc-verdict-chip--film',
  recommend: 'dsc-verdict-chip--recommend',
  consider: 'dsc-verdict-chip--consider',
  pass: 'dsc-verdict-chip--pass',
};

interface DiscoverControlsProps {
  genres: string[];
  themes: string[];
  filteredCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  producedHiddenCount: number;
  onRevealProduced: () => void;
  nonScreenplayHiddenCount: number;
  onRevealNonScreenplays: () => void;
  shortcutsEnabled: boolean;
  screenplays: Screenplay[];
  onOpenScreenplay: (screenplay: Screenplay, trigger: HTMLButtonElement) => void;
}

export function DiscoverControls({
  genres,
  themes,
  filteredCount,
  totalCount,
  hasActiveFilters,
  onClearFilters,
  producedHiddenCount,
  onRevealProduced,
  nonScreenplayHiddenCount,
  onRevealNonScreenplays,
  shortcutsEnabled,
  screenplays,
  onOpenScreenplay,
}: DiscoverControlsProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filters = useFilterStore();
  const sortConfigs = useSortStore((state) => state.sortConfigs);
  const setSortConfigs = useSortStore((state) => state.setSortConfigs);
  const setPrioritizeFilmNow = useSortStore((state) => state.setPrioritizeFilmNow);
  const activeSort = sortConfigs[0]?.field ?? 'weightedScore';

  useEffect(() => {
    if (!shortcutsEnabled) return;

    const handleSlash = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }

      event.preventDefault();
      searchInputRef.current?.focus();
    };

    document.addEventListener('keydown', handleSlash);
    return () => document.removeEventListener('keydown', handleSlash);
  }, [shortcutsEnabled]);

  const handleSort = (field: SortField) => {
    const direction: SortDirection = field === 'title' ? 'asc' : 'desc';
    setSortConfigs([{ field, direction }]);
    setPrioritizeFilmNow(false);
  };

  return (
    <section aria-label="Find screenplays" className="dsc-command dsc-card mb-8">
      <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="discovery-search" className="dsc-label mb-1.5 block">
            Search
          </label>
          <div className="dsc-search">
            <span aria-hidden="true" className="text-lg font-semibold text-[var(--dsc-ink-3)]">
              /
            </span>
            <input
              ref={searchInputRef}
              id="discovery-search"
              type="search"
              aria-label="Discovery search"
              value={filters.searchQuery}
              onChange={(event) => filters.setSearchQuery(event.target.value)}
              placeholder="Title, writer, logline, theme..."
              className="py-2 text-base"
            />
          </div>
        </div>

        <div className="dsc-compact-filter grid gap-3 md:grid-cols-2 xl:w-[22rem]">
          <MultiSelect
            label="Genre"
            options={genres}
            selected={filters.genres}
            onChange={filters.setGenres}
            placeholder="All genres"
          />
          <MultiSelect
            label="Theme"
            options={themes}
            selected={filters.themes}
            onChange={filters.setThemes}
            placeholder="All themes"
          />
        </div>

        <label className="dsc-label flex flex-col items-start gap-1.5 xl:w-44">
          Sort
          <select
            aria-label="Sort results"
            value={activeSort}
            onChange={(event) => handleSort(event.target.value as SortField)}
            className="dsc-select w-full normal-case tracking-normal"
          >
            <option value="weightedScore">Weighted score</option>
            <option value="marketPotential">Market potential</option>
            <option value="cvsTotal">CVS</option>
            <option value="title">Title</option>
          </select>
        </label>

        <div className="flex items-center gap-2">
          <LensMenu presentation="discovery" />
          <DiscoveryFavoritesMenu screenplays={screenplays} onOpen={onOpenScreenplay} />
        </div>
      </div>

      <div className="dsc-command-lower flex flex-col gap-3 px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2" aria-label="Verdict filters">
          {VERDICTS.map((tier) => {
            const active = filters.recommendationTiers.includes(tier);

            return (
              <button
                key={tier}
                type="button"
                aria-pressed={active}
                onClick={() => filters.toggleRecommendationTier(tier)}
                className={clsx('dsc-verdict-chip', VERDICT_STYLES[tier])}
              >
                {RECOMMENDATION_CONFIG[tier].label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--dsc-ink-2)]">
          <span className="font-semibold text-[var(--dsc-ink)]">
            Showing {filteredCount} of {totalCount} screenplays
          </span>
          {producedHiddenCount > 0 && (
            <>
              <span aria-hidden="true" className="text-[var(--dsc-ink-3)]">
                ·
              </span>
              <span>
                {producedHiddenCount} produced {producedHiddenCount === 1 ? 'film' : 'films'} hidden
              </span>
              <button
                type="button"
                onClick={onRevealProduced}
                className="dsc-command-link"
              >
                Show produced films
              </button>
            </>
          )}
          {nonScreenplayHiddenCount > 0 && (
            <>
              <span aria-hidden="true" className="text-[var(--dsc-ink-3)]">
                ·
              </span>
              <span>
                {nonScreenplayHiddenCount}{' '}
                {nonScreenplayHiddenCount === 1 ? 'non-screenplay' : 'non-screenplays'} hidden
              </span>
              <button
                type="button"
                onClick={onRevealNonScreenplays}
                className="dsc-command-link"
              >
                Show non-screenplays
              </button>
            </>
          )}
          {hasActiveFilters && filteredCount > 0 && (
            <button type="button" onClick={onClearFilters} className="dsc-command-link">
              Clear filters
            </button>
          )}
        </div>

        <details className="dsc-score-details">
          <summary className="dsc-btn dsc-btn-ghost !min-h-10 whitespace-nowrap">
            Score ranges
          </summary>
          <div className="dsc-score-popover">
            <RangeSlider
              label="Weighted score"
              min={0}
              max={10}
              value={[filters.weightedScoreRange.min, filters.weightedScoreRange.max]}
              syncValue
              enabled={filters.weightedScoreRange.enabled}
              onEnabledChange={(enabled) => filters.setWeightedScoreRange({ enabled })}
              onChange={([min, max]) => filters.setWeightedScoreRange({ min, max })}
            />
            <RangeSlider
              label="Market potential"
              min={0}
              max={10}
              value={[filters.marketPotentialRange.min, filters.marketPotentialRange.max]}
              syncValue
              enabled={filters.marketPotentialRange.enabled}
              onEnabledChange={(enabled) => filters.setMarketPotentialRange({ enabled })}
              onChange={([min, max]) => filters.setMarketPotentialRange({ min, max })}
            />
            <RangeSlider
              label="CVS"
              min={0}
              max={18}
              step={1}
              value={[filters.cvsRange.min, filters.cvsRange.max]}
              syncValue
              enabled={filters.cvsRange.enabled}
              onEnabledChange={(enabled) => filters.setCvsRange({ enabled })}
              onChange={([min, max]) => filters.setCvsRange({ min, max })}
              formatValue={(value) => value.toFixed(0)}
            />
          </div>
        </details>
      </div>
    </section>
  );
}
