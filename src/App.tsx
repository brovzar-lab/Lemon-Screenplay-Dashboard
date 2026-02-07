/**
 * Lemon Screenplay Dashboard
 * Main Application Component
 */

import { useState } from 'react';
import { Header, FilterBar } from '@/components/layout';
import { ScreenplayGrid, ScreenplayModal } from '@/components/screenplay';
import { CollectionTabs } from '@/components/filters';
import { ComparisonBar, ComparisonModal } from '@/components/comparison';
import { AnalyticsDashboard } from '@/components/charts';
import { useFilteredScreenplays } from '@/hooks/useFilteredScreenplays';
import { useScreenplays } from '@/hooks/useScreenplays';
import { useUrlState } from '@/hooks/useUrlState';
import { useFilterStore } from '@/stores/filterStore';
import type { Screenplay, RecommendationTier, BudgetCategory } from '@/types';

function App() {
  const { screenplays, isLoading, filteredCount, totalCount } = useFilteredScreenplays();
  const { data: allScreenplays = [] } = useScreenplays();

  // URL state sync — loads filters from URL on mount
  useUrlState();

  // Filter store actions for chart click handlers
  const resetFilters = useFilterStore((s) => s.resetFilters);
  const setWeightedScoreRange = useFilterStore((s) => s.setWeightedScoreRange);
  const setRecommendationTiers = useFilterStore((s) => s.setRecommendationTiers);
  const setGenres = useFilterStore((s) => s.setGenres);
  const setBudgetCategories = useFilterStore((s) => s.setBudgetCategories);

  // Screenplay detail modal
  const [selectedScreenplay, setSelectedScreenplay] = useState<Screenplay | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCardClick = (screenplay: Screenplay) => {
    setSelectedScreenplay(screenplay);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedScreenplay(null), 300);
  };

  // Chart click handlers — cross-component filtering
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
      <Header />

      <main className="flex-1 max-w-[1800px] mx-auto w-full px-6 py-8">
        {/* Collection Tabs */}
        {!isLoading && allScreenplays.length > 0 && (
          <div className="mb-6">
            <CollectionTabs screenplays={allScreenplays} />
          </div>
        )}

        {/* Search, Filters, Sort, Export, Share */}
        <FilterBar
          screenplays={screenplays}
          isLoading={isLoading}
          filteredCount={filteredCount}
          totalCount={totalCount}
        />

        {/* Analytics Dashboard — charts reflect current filter state */}
        {!isLoading && allScreenplays.length > 0 && (
          <AnalyticsDashboard
            screenplays={screenplays}
            totalScreenplays={allScreenplays}
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
          <p>Lemon Screenplay Dashboard v6.5 - Powered by V6 Core + Lenses AI Analysis</p>
        </div>
      </footer>

      {/* Detail Modal */}
      <ScreenplayModal
        screenplay={selectedScreenplay}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />

      {/* Comparison Bar (sticky at bottom) */}
      <ComparisonBar />
      <ComparisonModal />
    </div>
  );
}

export default App;
