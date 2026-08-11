import { useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { MultiSelect } from '@/components/filters/MultiSelect';
import { RangeSlider } from '@/components/filters/RangeSlider';
import { passesFilters } from '@/hooks/useFilteredScreenplays';
import { useFilterStore } from '@/stores/filterStore';
import { useLensStore } from '@/stores/lensStore';
import { useSortStore } from '@/stores/sortStore';
import {
  RECOMMENDATION_CONFIG,
  type FilterState,
  type RecommendationTier,
  type Screenplay,
  type SortDirection,
  type SortField,
} from '@/types';

const VERDICTS: RecommendationTier[] = ['film_now', 'recommend', 'consider', 'pass'];

interface HybridCommandRailProps {
  allScreenplays: Screenplay[];
  genres: string[];
  themes: string[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  producerLookCount?: number;
  producerLookActive?: boolean;
  onToggleProducerLook?: () => void;
  selectionMode?: boolean;
  selectionCount?: number;
  onToggleSelectionMode?: () => void;
}

interface ActiveChip {
  id: string;
  label: string;
  remove: () => void;
}

export function HybridCommandRail({
  allScreenplays,
  genres,
  themes,
  hasActiveFilters,
  onClearFilters,
  producerLookCount = 0,
  producerLookActive = false,
  onToggleProducerLook,
  selectionMode = false,
  selectionCount = 0,
  onToggleSelectionMode,
}: HybridCommandRailProps) {
  const [isOpen, setIsOpen] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const filters = useFilterStore();
  const sortConfigs = useSortStore((state) => state.sortConfigs);
  const setSortConfigs = useSortStore((state) => state.setSortConfigs);
  const setPrioritizeFilmNow = useSortStore((state) => state.setPrioritizeFilmNow);
  const lenses = useLensStore((state) => state.lenses);
  const activeLensId = useLensStore((state) => state.activeLensId);
  const activeLens = lenses.find((lens) => lens.id === activeLensId);
  const activeSort = sortConfigs[0]?.field ?? 'weightedScore';

  const verdictCounts = useMemo(() => {
    const withoutVerdict: FilterState = {
      searchQuery: filters.searchQuery,
      recommendationTiers: [],
      budgetCategories: filters.budgetCategories,
      collections: filters.collections,
      categories: filters.categories,
      genres: filters.genres,
      themes: filters.themes,
      weightedScoreRange: filters.weightedScoreRange,
      conceptRange: filters.conceptRange,
      structureRange: filters.structureRange,
      protagonistRange: filters.protagonistRange,
      supportingCastRange: filters.supportingCastRange,
      dialogueRange: filters.dialogueRange,
      genreExecutionRange: filters.genreExecutionRange,
      originalityRange: filters.originalityRange,
      cvsRange: filters.cvsRange,
      marketPotentialRange: filters.marketPotentialRange,
      showFilmNowOnly: false,
      hidePassRated: false,
      hasCriticalFailures: filters.hasCriticalFailures,
      hideNonScreenplays: filters.hideNonScreenplays,
      hideProduced: filters.hideProduced,
      missingPdfOnly: filters.missingPdfOnly,
      hasPdfOnly: filters.hasPdfOnly,
    };
    const base = allScreenplays.filter((screenplay) => passesFilters(screenplay, withoutVerdict));
    return {
      all: base.length,
      film_now: base.filter((screenplay) => screenplay.recommendation === 'film_now').length,
      recommend: base.filter((screenplay) => screenplay.recommendation === 'recommend').length,
      consider: base.filter((screenplay) => screenplay.recommendation === 'consider').length,
      pass: base.filter((screenplay) => screenplay.recommendation === 'pass').length,
    };
  }, [allScreenplays, filters]);

  const selectVerdict = (tier?: RecommendationTier) => {
    filters.setRecommendationTiers(tier ? [tier] : []);
    filters.setShowFilmNowOnly(false);
    filters.setHidePassRated(false);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!filterPanelRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSort = (field: SortField) => {
    const direction: SortDirection = field === 'title' ? 'asc' : 'desc';
    setSortConfigs([{ field, direction }]);
    setPrioritizeFilmNow(false);
  };

  const activeChips = useMemo<ActiveChip[]>(() => {
    const chips: ActiveChip[] = [];

    if (filters.genres.length > 0) {
      chips.push({
        id: 'genres',
        label: filters.genres.length === 1 ? filters.genres[0] : `${filters.genres.length} genres`,
        remove: () => filters.setGenres([]),
      });
    }
    if (filters.themes.length > 0) {
      chips.push({
        id: 'themes',
        label: filters.themes.length === 1 ? filters.themes[0] : `${filters.themes.length} themes`,
        remove: () => filters.setThemes([]),
      });
    }
    if (filters.recommendationTiers.length > 0) {
      chips.push({
        id: 'verdicts',
        label:
          filters.recommendationTiers.length === 1
            ? RECOMMENDATION_CONFIG[filters.recommendationTiers[0]].label
            : `${filters.recommendationTiers.length} verdicts`,
        remove: () => filters.setRecommendationTiers([]),
      });
    }
    if (filters.weightedScoreRange.enabled) {
      chips.push({
        id: 'score',
        label: `Score ${filters.weightedScoreRange.min.toFixed(1)}–${filters.weightedScoreRange.max.toFixed(1)}`,
        remove: () => filters.setWeightedScoreRange({ enabled: false }),
      });
    }
    if (filters.marketPotentialRange.enabled) {
      chips.push({
        id: 'market',
        label: `Market ${filters.marketPotentialRange.min.toFixed(1)}–${filters.marketPotentialRange.max.toFixed(1)}`,
        remove: () => filters.setMarketPotentialRange({ enabled: false }),
      });
    }
    if (filters.cvsRange.enabled) {
      chips.push({
        id: 'cvs',
        label: `CVS ${filters.cvsRange.min.toFixed(0)}–${filters.cvsRange.max.toFixed(0)}`,
        remove: () => filters.setCvsRange({ enabled: false }),
      });
    }
    if (filters.showFilmNowOnly) {
      chips.push({
        id: 'film-now',
        label: 'FILM NOW only',
        remove: () => filters.setShowFilmNowOnly(false),
      });
    }
    if (filters.hidePassRated) {
      chips.push({
        id: 'hide-pass',
        label: 'Pass hidden',
        remove: () => filters.setHidePassRated(false),
      });
    }

    return chips;
  }, [filters]);

  return (
    <section className="hybrid-command-rail" aria-label="Current Discovery view">
      <div className="hybrid-command-rail__inner">
        <button
          type="button"
          className="hybrid-current-view"
          onClick={onToggleProducerLook}
          disabled={!onToggleProducerLook || (producerLookCount === 0 && !producerLookActive)}
          aria-pressed={producerLookActive}
          title="Show the bounded Producer Look queue"
        >
          <span>
            {producerLookActive ? 'Producer Look' : (activeLens?.name ?? 'All screenplays')}
          </span>
          <small>
            {producerLookActive
              ? `${producerLookCount} routed · built-in view`
              : producerLookCount > 0
                ? `${producerLookCount} need your look`
                : activeLens
                  ? 'Saved view'
                  : 'No pending Producer Looks'}
          </small>
        </button>

        <div className="hybrid-active-filters" aria-label="Active filters">
          {activeChips.slice(0, 3).map((chip) => (
            <button key={chip.id} type="button" onClick={chip.remove}>
              <span>{chip.label}</span>
              <span aria-hidden="true">×</span>
              <span className="sr-only">Remove {chip.label} filter</span>
            </button>
          ))}
          {activeChips.length > 3 && <span>+{activeChips.length - 3} more</span>}
        </div>

        <label className="hybrid-sort-control">
          <span>Sort:</span>
          <select
            aria-label="Sort results"
            value={activeSort}
            onChange={(event) => handleSort(event.target.value as SortField)}
          >
            <option value="weightedScore">Weighted score</option>
            <option value="marketPotential">Market potential</option>
            <option value="cvsTotal">CVS</option>
            <option value="title">Title</option>
          </select>
        </label>

        {onToggleSelectionMode && (
          <button
            type="button"
            className={clsx('hybrid-selection-trigger', selectionMode && 'is-active')}
            aria-pressed={selectionMode}
            onClick={onToggleSelectionMode}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M5 5h14v14H5zM8 12l2.5 2.5L16 9" />
            </svg>
            <span>{selectionMode ? 'Done selecting' : 'Select projects'}</span>
            {selectionCount > 0 && <strong>{selectionCount}</strong>}
          </button>
        )}

        <div ref={filterPanelRef} className="hybrid-filter-control">
          <button
            type="button"
            className="hybrid-filter-trigger"
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            aria-controls="hybrid-filter-panel"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            Filters
            {activeChips.length > 0 && <span>{activeChips.length}</span>}
          </button>

          {isOpen && (
            <div
              id="hybrid-filter-panel"
              className="hybrid-filter-popover"
              role="dialog"
              aria-modal="false"
              aria-label="Discovery filters"
            >
              <header>
                <div>
                  <p>Refine the slate</p>
                  <h2>Filters</h2>
                </div>
                <button type="button" onClick={() => setIsOpen(false)} aria-label="Close filters">
                  ×
                </button>
              </header>

              <div className="hybrid-filter-popover__body">
                <div className="hybrid-filter-popover__selects">
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

                <fieldset className="hybrid-verdict-filter">
                  <legend>Verdict</legend>
                  <div>
                    {VERDICTS.map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        aria-pressed={filters.recommendationTiers.includes(tier)}
                        onClick={() => filters.toggleRecommendationTier(tier)}
                      >
                        {RECOMMENDATION_CONFIG[tier].label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="hybrid-range-filters">
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

                <fieldset className="hybrid-toggle-filters">
                  <legend>Inventory</legend>
                  <label>
                    <input
                      type="checkbox"
                      checked={filters.showFilmNowOnly}
                      onChange={(event) => filters.setShowFilmNowOnly(event.target.checked)}
                    />
                    FILM NOW only
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={filters.hidePassRated}
                      onChange={(event) => filters.setHidePassRated(event.target.checked)}
                    />
                    Hide Pass verdicts
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={!filters.hideProduced}
                      onChange={(event) => filters.setHideProduced(!event.target.checked)}
                    />
                    Include produced films
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={!filters.hideNonScreenplays}
                      onChange={(event) => filters.setHideNonScreenplays(!event.target.checked)}
                    />
                    Include non-screenplays
                  </label>
                </fieldset>
              </div>

              <footer>
                <button
                  type="button"
                  onClick={onClearFilters}
                  disabled={!hasActiveFilters}
                  className={clsx(!hasActiveFilters && 'is-disabled')}
                >
                  Clear all
                </button>
                <button type="button" onClick={() => setIsOpen(false)}>
                  View results
                </button>
              </footer>
            </div>
          )}
        </div>
      </div>
      <nav className="hybrid-quick-verdicts" aria-label="Filter by AI verdict">
        <button
          type="button"
          aria-pressed={filters.recommendationTiers.length === 0}
          onClick={() => selectVerdict()}
        >
          <span>All</span><strong>{verdictCounts.all}</strong>
        </button>
        {VERDICTS.map((tier) => (
          <button
            key={tier}
            type="button"
            data-verdict={tier}
            aria-pressed={
              filters.recommendationTiers.length === 1 &&
              filters.recommendationTiers[0] === tier
            }
            onClick={() => selectVerdict(tier)}
          >
            <span>{RECOMMENDATION_CONFIG[tier].label}</span>
            <strong>{verdictCounts[tier]}</strong>
          </button>
        ))}
      </nav>
    </section>
  );
}
