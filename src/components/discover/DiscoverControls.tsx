import { clsx } from 'clsx';
import { MultiSelect } from '@/components/filters/MultiSelect';
import { RangeSlider } from '@/components/filters/RangeSlider';
import { useFilterStore } from '@/stores/filterStore';
import { useSortStore } from '@/stores/sortStore';
import {
  RECOMMENDATION_CONFIG,
  type RecommendationTier,
  type SortDirection,
  type SortField,
} from '@/types';

const VERDICTS: RecommendationTier[] = ['film_now', 'recommend', 'consider', 'pass'];

const VERDICT_STYLES: Record<RecommendationTier, string> = {
  film_now: 'border-gold-500/70 text-gold-300 aria-pressed:bg-gold-500/20',
  recommend: 'border-emerald-500/60 text-emerald-300 aria-pressed:bg-emerald-500/20',
  consider: 'border-amber-500/60 text-amber-300 aria-pressed:bg-amber-500/20',
  pass: 'border-red-500/60 text-red-300 aria-pressed:bg-red-500/20',
};

interface DiscoverControlsProps {
  genres: string[];
  themes: string[];
  filteredCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function DiscoverControls({
  genres,
  themes,
  filteredCount,
  totalCount,
  hasActiveFilters,
  onClearFilters,
}: DiscoverControlsProps) {
  const filters = useFilterStore();
  const sortConfigs = useSortStore((state) => state.sortConfigs);
  const setSortConfigs = useSortStore((state) => state.setSortConfigs);
  const setPrioritizeFilmNow = useSortStore((state) => state.setPrioritizeFilmNow);
  const activeSort = sortConfigs[0]?.field ?? 'weightedScore';

  const handleSort = (field: SortField) => {
    const direction: SortDirection = field === 'title' ? 'asc' : 'desc';
    setSortConfigs([{ field, direction }]);
    setPrioritizeFilmNow(false);
  };

  return (
    <section
      aria-label="Find screenplays"
      className="mb-8 border-y border-black-700 bg-black-900/70"
    >
      <div className="grid gap-px bg-black-700 lg:grid-cols-[minmax(18rem,1.5fr)_minmax(28rem,2fr)]">
        <div className="bg-black-900 p-5 sm:p-6">
          <label
            htmlFor="discovery-search"
            className="mb-2 block text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-gold-400"
          >
            Search the slate
          </label>
          <div className="flex items-center gap-3 border-b border-black-500 pb-2 focus-within:border-gold-400">
            <span aria-hidden="true" className="font-display text-2xl text-black-500">
              /
            </span>
            <input
              id="discovery-search"
              type="search"
              aria-label="Discovery search"
              value={filters.searchQuery}
              onChange={(event) => filters.setSearchQuery(event.target.value)}
              placeholder="Title, writer, logline, theme..."
              className="min-w-0 flex-1 bg-transparent py-1 text-base text-black-50 outline-none placeholder:text-black-500"
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
                    'border px-3 py-1.5 text-[0.65rem] font-bold tracking-[0.14em] transition-colors hover:bg-black-700',
                    VERDICT_STYLES[tier],
                    active ? 'border-current' : 'opacity-75',
                  )}
                >
                  {RECOMMENDATION_CONFIG[tier].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-black-900 p-5 sm:p-6">
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
                enabled={filters.weightedScoreRange.enabled}
                onEnabledChange={(enabled) => filters.setWeightedScoreRange({ enabled })}
                onChange={([min, max]) => filters.setWeightedScoreRange({ min, max })}
              />
              <RangeSlider
                label="Market potential"
                min={0}
                max={10}
                value={[filters.marketPotentialRange.min, filters.marketPotentialRange.max]}
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
                enabled={filters.cvsRange.enabled}
                onEnabledChange={(enabled) => filters.setCvsRange({ enabled })}
                onChange={([min, max]) => filters.setCvsRange({ min, max })}
                formatValue={(value) => value.toFixed(0)}
              />
            </div>
          </details>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 sm:px-6">
        <p className="font-mono text-xs text-black-300">
          Showing {filteredCount} of {totalCount} screenplays
        </p>
        <div className="flex items-center gap-4">
          {hasActiveFilters && filteredCount > 0 && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-xs font-semibold uppercase tracking-[0.12em] text-black-400 hover:text-gold-300"
            >
              Clear filters
            </button>
          )}
          <label className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-black-400">
            Sort
            <select
              aria-label="Sort results"
              value={activeSort}
              onChange={(event) => handleSort(event.target.value as SortField)}
              className="border border-black-600 bg-black-950 px-3 py-2 text-sm normal-case tracking-normal text-black-100 outline-none focus:border-gold-500"
            >
              <option value="weightedScore">Weighted score</option>
              <option value="marketPotential">Market potential</option>
              <option value="cvsTotal">CVS</option>
              <option value="title">Title</option>
            </select>
          </label>
        </div>
      </div>
    </section>
  );
}
