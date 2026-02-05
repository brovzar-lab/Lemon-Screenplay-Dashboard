/**
 * Lemon Screenplay Dashboard
 * Main Application Component
 */

import { useState } from 'react';
import { Header } from '@/components/layout';
import { ScreenplayGrid, ScreenplayModal } from '@/components/screenplay';
import { FilterPanel, AdvancedSortPanel, CollectionTabs } from '@/components/filters';
import { ComparisonBar, ComparisonModal } from '@/components/comparison';
import { ExportModal } from '@/components/export';
import { AnalyticsDashboard } from '@/components/charts';
import { useFilteredScreenplays, useHasActiveFilters } from '@/hooks/useFilteredScreenplays';
import { useScreenplays } from '@/hooks/useScreenplays';
import { useUrlState, copyShareableUrl } from '@/hooks/useUrlState';
import { useFilterStore } from '@/stores/filterStore';
import { useSortStore } from '@/stores/sortStore';
import type { Screenplay, RecommendationTier, BudgetCategory } from '@/types';

// Filter chip configuration
type FilterType = 'all' | 'film_now' | 'recommend' | 'consider' | 'pass' | 'high_budget' | 'low_budget';

const FILTER_CHIPS: { id: FilterType; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'film_now', label: 'FILM NOW' },
  { id: 'recommend', label: 'Recommend' },
  { id: 'consider', label: 'Consider' },
  { id: 'pass', label: 'Pass' },
  { id: 'high_budget', label: 'High Budget' },
  { id: 'low_budget', label: 'Low Budget' },
];

function App() {
  const { screenplays, isLoading, filteredCount, totalCount } = useFilteredScreenplays();
  const { data: allScreenplays = [] } = useScreenplays(); // For analytics (unfiltered)
  const hasActiveFilters = useHasActiveFilters();

  // URL state sync - loads filters from URL on mount
  useUrlState();

  // Copy link feedback
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'copied' | 'error'>('idle');

  // Filter store
  const searchQuery = useFilterStore((s) => s.searchQuery);
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);
  const recommendationTiers = useFilterStore((s) => s.recommendationTiers);
  const setRecommendationTiers = useFilterStore((s) => s.setRecommendationTiers);
  const budgetCategories = useFilterStore((s) => s.budgetCategories);
  const setBudgetCategories = useFilterStore((s) => s.setBudgetCategories);
  const setGenres = useFilterStore((s) => s.setGenres);
  const setWeightedScoreRange = useFilterStore((s) => s.setWeightedScoreRange);
  const resetFilters = useFilterStore((s) => s.resetFilters);

  // Sort store
  const sortConfigs = useSortStore((s) => s.sortConfigs);
  const addSortColumn = useSortStore((s) => s.addSortColumn);
  const resetSort = useSortStore((s) => s.resetSort);

  // Modal state
  const [selectedScreenplay, setSelectedScreenplay] = useState<Screenplay | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Panel states
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isSortPanelOpen, setIsSortPanelOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const handleCardClick = (screenplay: Screenplay) => {
    setSelectedScreenplay(screenplay);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Keep selectedScreenplay for a moment for exit animation
    setTimeout(() => setSelectedScreenplay(null), 300);
  };

  // Determine active filter chip
  const getActiveFilter = (): FilterType => {
    if (recommendationTiers.length === 0 && budgetCategories.length === 0) {
      return 'all';
    }
    if (recommendationTiers.length === 1 && budgetCategories.length === 0) {
      return recommendationTiers[0] as FilterType;
    }
    if (budgetCategories.length > 0 && recommendationTiers.length === 0) {
      const hasHigh = budgetCategories.includes('high') || budgetCategories.includes('medium');
      const hasLow = budgetCategories.includes('low') || budgetCategories.includes('micro');
      if (hasHigh && !hasLow) return 'high_budget';
      if (hasLow && !hasHigh) return 'low_budget';
    }
    return 'all'; // Mixed filters
  };

  const handleFilterClick = (filterId: FilterType) => {
    // Reset all filters first
    resetFilters();

    switch (filterId) {
      case 'all':
        // Already reset
        break;
      case 'film_now':
        setRecommendationTiers(['film_now']);
        break;
      case 'recommend':
        setRecommendationTiers(['recommend']);
        break;
      case 'consider':
        setRecommendationTiers(['consider']);
        break;
      case 'pass':
        setRecommendationTiers(['pass']);
        break;
      case 'high_budget':
        setBudgetCategories(['high', 'medium']);
        break;
      case 'low_budget':
        setBudgetCategories(['low', 'micro']);
        break;
    }
  };

  const activeFilter = getActiveFilter();

  // Chart click handlers for interactive filtering
  const handleFilterByScoreRange = (range: { min: number; max: number }) => {
    resetFilters();
    setWeightedScoreRange({ min: range.min, max: range.max, enabled: true });
  };

  const handleFilterByTier = (tier: RecommendationTier) => {
    resetFilters();
    setRecommendationTiers([tier]);
  };

  const handleFilterByGenre = (genre: string) => {
    resetFilters();
    setGenres([genre]);
  };

  const handleFilterByBudget = (budget: BudgetCategory) => {
    resetFilters();
    setBudgetCategories([budget]);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="flex-1 max-w-[1800px] mx-auto w-full px-6 py-8">
        {/* Collection Tabs */}
        {!isLoading && allScreenplays.length > 0 && (
          <div className="mb-6">
            <CollectionTabs screenplays={allScreenplays} />
          </div>
        )}

        {/* Search & Filters Bar */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Search Input */}
            <div className="w-full md:w-96 relative">
              <input
                type="text"
                className="input pl-10"
                placeholder="Search title, author, genre, logline..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search screenplays"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black-500">
                🔍
              </span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black-500 hover:text-gold-400"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Results Count & Sort */}
            <div className="flex items-center gap-3">
              <div className="text-sm text-black-400">
                {isLoading ? (
                  <span>Loading...</span>
                ) : (
                  <span>
                    Showing <strong className="text-gold-400">{filteredCount}</strong> of{' '}
                    <strong>{totalCount}</strong> screenplays
                  </span>
                )}
              </div>

              {/* Quick Sort Dropdown */}
              <select
                className="input py-2 px-3 w-auto text-sm"
                value={sortConfigs[0]?.field || 'marketPotential'}
                onChange={(e) => {
                  resetSort();
                  addSortColumn(e.target.value as any, 'desc');
                }}
              >
                <option value="marketPotential">Sort: Market Potential</option>
                <option value="weightedScore">Sort: Weighted Score</option>
                <option value="cvsTotal">Sort: CVS Total</option>
                <option value="roiIndicator">Sort: ROI</option>
                <option value="festivalAppeal">Sort: Festival Appeal</option>
                <option value="title">Sort: Title A-Z</option>
              </select>

              {/* Advanced Sort Button */}
              <button
                onClick={() => setIsSortPanelOpen(true)}
                className="btn btn-secondary text-sm"
                title="Advanced Sorting"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                {sortConfigs.length > 1 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-gold-500/20 text-gold-400 text-xs font-bold">
                    {sortConfigs.length}
                  </span>
                )}
              </button>

              {/* Advanced Filters Button */}
              <button
                onClick={() => setIsFilterPanelOpen(true)}
                className="btn btn-secondary text-sm"
                title="Advanced Filters"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
              </button>

              {/* Share Link Button */}
              <button
                onClick={async () => {
                  const success = await copyShareableUrl();
                  setCopyFeedback(success ? 'copied' : 'error');
                  setTimeout(() => setCopyFeedback('idle'), 2000);
                }}
                className={`btn text-sm ${
                  copyFeedback === 'copied'
                    ? 'btn-primary bg-emerald-500 border-emerald-500'
                    : 'btn-secondary'
                }`}
                title="Copy shareable link"
                disabled={!hasActiveFilters}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {copyFeedback === 'copied' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  )}
                </svg>
                {copyFeedback === 'copied' ? 'Copied!' : 'Share'}
              </button>

              {/* Export Button */}
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="btn btn-primary text-sm"
                title="Export screenplays"
                disabled={screenplays.length === 0}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            </div>
          </div>

          {/* Quick Filter Chips */}
          <div className="flex flex-wrap gap-2 mt-4">
            {FILTER_CHIPS.map((chip) => (
              <button
                key={chip.id}
                onClick={() => handleFilterClick(chip.id)}
                className={`chip cursor-pointer transition-all ${
                  activeFilter === chip.id ? 'chip-active' : 'hover:border-gold-500'
                } ${chip.id === 'film_now' && activeFilter === chip.id ? 'animate-pulse-glow' : ''}`}
              >
                {chip.label}
              </button>
            ))}

            {/* Clear filters button */}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="chip cursor-pointer text-red-400 border-red-400/50 hover:bg-red-400/10"
              >
                Clear All ✕
              </button>
            )}
          </div>
        </div>

        {/* Analytics Dashboard */}
        {!isLoading && allScreenplays.length > 0 && (
          <AnalyticsDashboard
            screenplays={allScreenplays}
            onFilterByScoreRange={handleFilterByScoreRange}
            onFilterByTier={handleFilterByTier}
            onFilterByGenre={handleFilterByGenre}
            onFilterByBudget={handleFilterByBudget}
          />
        )}

        {/* Screenplay Grid */}
        <ScreenplayGrid
          screenplays={screenplays}
          isLoading={isLoading}
          onCardClick={handleCardClick}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-gold-500/10 py-6">
        <div className="max-w-[1800px] mx-auto px-6 text-center text-sm text-black-500">
          <p>Lemon Screenplay Dashboard v6.0 - Powered by V6 Core + Lenses AI Analysis</p>
        </div>
      </footer>

      {/* Detail Modal */}
      <ScreenplayModal
        screenplay={selectedScreenplay}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />

      {/* Advanced Sort Panel */}
      <AdvancedSortPanel
        isOpen={isSortPanelOpen}
        onClose={() => setIsSortPanelOpen(false)}
      />

      {/* Advanced Filter Panel */}
      <FilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
      />

      {/* Comparison Bar (sticky at bottom) */}
      <ComparisonBar />

      {/* Comparison Modal */}
      <ComparisonModal />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        screenplays={screenplays}
        mode={hasActiveFilters ? 'filtered' : 'multiple'}
      />
    </div>
  );
}

export default App;
