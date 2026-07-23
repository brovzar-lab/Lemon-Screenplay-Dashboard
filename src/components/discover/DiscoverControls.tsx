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
  film_now: 'text-gold-400 aria-pressed:bg-gold-500/15',
  recommend: 'text-emerald-400 aria-pressed:bg-emerald-500/15',
  consider: 'text-amber-400 aria-pressed:bg-amber-500/15',
  pass: 'text-red-400 aria-pressed:bg-red-500/15',
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
    <section
      aria-label="Find screenplays"
      className="mb-10 overflow-hidden rounded-2xl bg-black-900 shadow-[var(--shadow-card)] dark:border dark:border-black-700"
    >
      <div className="grid lg:grid-cols-[minmax(18rem,1.5fr)_minmax(28rem,2fr)]">
        <div className="bg-black-900 p-5 sm:p-6 lg:border-r lg:border-black-700">
          <label
            htmlFor="discovery-search"
            className="mb-2 block text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-gold-400"
          >
            Search the slate
          </label>
          <div className="flex min-h-12 items-center gap-3 rounded-xl border border-black-700 bg-black-950 px-3 shadow-[var(--inset-input)] focus-within:border-gold-400 focus-within:ring-2 focus-within:ring-gold-500/20">
            <span aria-hidden="true" className="text-lg font-semibold text-black-500">
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
              className="min-w-0 flex-1 bg-transparent py-2 text-base text-black-50 outline-none placeholder:text-black-500"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2" aria-label="Verdict filters">
            {VERDICTS.map((tier) => {
              const active = filters.recommendationTiers.includes(tier);

              return (
                <button
                  key={tier}
                  type="button"
                  aria-pressed={active}
                  onClick={() => filters.toggleRecommendationTier(tier)}
                  className={clsx(
                    'min-h-11 rounded-full px-4 py-2 text-[0.65rem] font-bold tracking-[0.14em] transition-colors hover:bg-black-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400',
                    VERDICT_STYLES[tier],
                    active ? 'ring-1 ring-current' : 'bg-black-950 opacity-80',
                  )}
                >
                  {RECOMMENDATION_CONFIG[tier].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-black-700 bg-black-900 p-5 sm:p-6 lg:border-t-0">
          <div className="grid gap-4 sm:grid-cols-2">
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

          <details className="mt-4 border-t border-black-700 pt-4">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-black-300 hover:text-black-50">
              Score ranges
            </summary>
            <div className="mt-3 grid gap-2 xl:grid-cols-3">
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
      </div>

      <div className="flex flex-col gap-4 border-t border-black-700 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-black-300">
          <span>
            Showing {filteredCount} of {totalCount} screenplays
          </span>
          {producedHiddenCount > 0 && (
            <>
              <span aria-hidden="true" className="text-black-600">
                ·
              </span>
              <span>
                {producedHiddenCount} produced {producedHiddenCount === 1 ? 'film' : 'films'} hidden
              </span>
              <button
                type="button"
                onClick={onRevealProduced}
                className="min-h-11 rounded-lg px-2 font-sans font-semibold uppercase tracking-[0.1em] text-gold-400 hover:bg-gold-500/10"
              >
                Show produced films
              </button>
            </>
          )}
          {nonScreenplayHiddenCount > 0 && (
            <>
              <span aria-hidden="true" className="text-black-600">
                ·
              </span>
              <span>
                {nonScreenplayHiddenCount}{' '}
                {nonScreenplayHiddenCount === 1 ? 'non-screenplay' : 'non-screenplays'} hidden
              </span>
              <button
                type="button"
                onClick={onRevealNonScreenplays}
                className="min-h-11 rounded-lg px-2 font-sans font-semibold uppercase tracking-[0.1em] text-gold-400 hover:bg-gold-500/10"
              >
                Show non-screenplays
              </button>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {hasActiveFilters && filteredCount > 0 && (
            <button
              type="button"
              onClick={onClearFilters}
              className="min-h-11 rounded-lg px-2 text-xs font-semibold uppercase tracking-[0.12em] text-black-400 hover:bg-black-800 hover:text-gold-300"
            >
              Clear filters
            </button>
          )}
          <label className="flex min-h-11 items-center gap-2 text-xs uppercase tracking-[0.12em] text-black-400">
            Sort
            <select
              aria-label="Sort results"
              value={activeSort}
              onChange={(event) => handleSort(event.target.value as SortField)}
              className="min-h-11 rounded-lg border border-black-700 bg-black-950 px-3 py-2 text-sm normal-case tracking-normal text-black-100 shadow-[var(--inset-input)] outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
            >
              <option value="weightedScore">Weighted score</option>
              <option value="marketPotential">Market potential</option>
              <option value="cvsTotal">CVS</option>
              <option value="title">Title</option>
            </select>
          </label>
          <LensMenu presentation="discovery" />
          <DiscoveryFavoritesMenu screenplays={screenplays} onOpen={onOpenScreenplay} />
        </div>
      </div>
    </section>
  );
}
