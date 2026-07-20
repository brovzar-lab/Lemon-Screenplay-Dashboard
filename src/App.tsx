/**
 * Lemon Screenplay Dashboard
 * Main Application Component
 */

import { useState, lazy, Suspense } from 'react';
import { Header, FilterBar } from '@/components/layout';
import { ReadingRoom, ScreenplayGrid, ScreenplayModal } from '@/components/screenplay';
import { CollectionTabs } from '@/components/filters';
import { ComparisonBar } from '@/components/comparison';
import { ErrorBoundary, LoadingFallback, ScrollProgress } from '@/components/ui';
import { DevExecChat } from '@/components/devexec';
import { DevExecProvider } from '@/contexts/DevExecContext';
import { useFilteredScreenplays } from '@/hooks/useFilteredScreenplays';
import { useScreenplays, useLiveScreenplaySync } from '@/hooks/useScreenplays';
import { useUrlState } from '@/hooks/useUrlState';
import { usePosterBackground } from '@/hooks/usePosterBackground';
import { useFilterStore } from '@/stores/filterStore';
import type { Screenplay, RecommendationTier, BudgetCategory } from '@/types';
import { useIsAdmin } from '@/stores/authStore';
import { usePercentiles } from '@/hooks/usePercentiles';

// Lazy-loaded heavy features (recharts-dependent)
const AnalyticsDashboard = lazy(() => import('@/components/charts/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
const ComparisonModal = lazy(() => import('@/components/comparison/ComparisonModal').then(m => ({ default: m.ComparisonModal })));

function App() {
  const isAdmin = useIsAdmin();
  const { screenplays, isLoading, filteredCount, totalCount } = useFilteredScreenplays();
  const { data: allScreenplays = [] } = useScreenplays();
  const percentileRanks = usePercentiles(allScreenplays);

  // Live Firestore sync — new daemon-written analyses appear automatically,
  // no page refresh needed.
  useLiveScreenplaySync();

  // URL state sync — loads filters from URL on mount
  useUrlState();

  // Background poster generation — start generating when screenplays load
  usePosterBackground(isAdmin ? screenplays : []);

  // Filter store actions for chart click handlers
  const resetFilters = useFilterStore((s) => s.resetFilters);
  const setWeightedScoreRange = useFilterStore((s) => s.setWeightedScoreRange);
  const setRecommendationTiers = useFilterStore((s) => s.setRecommendationTiers);
  const setGenres = useFilterStore((s) => s.setGenres);
  const setBudgetCategories = useFilterStore((s) => s.setBudgetCategories);

  // Screenplay detail modal
  const [selectedScreenplay, setSelectedScreenplay] = useState<Screenplay | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReadingRoomOpen, setIsReadingRoomOpen] = useState(false);

  const handleCardClick = (screenplay: Screenplay) => {
    setSelectedScreenplay(screenplay);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedScreenplay(null), 300);
  };

  const handleOpenReadingRoom = () => {
    setIsModalOpen(false);
    setSelectedScreenplay(null);
    setIsReadingRoomOpen(true);
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
    <DevExecProvider screenplays={allScreenplays}>
      <ScrollProgress />
      <div className="min-h-screen flex flex-col">
        <div className="bokeh-atmosphere" aria-hidden="true" />
        <div className="page-enter-header">
          <ErrorBoundary areaName="Header">
            <Header />
          </ErrorBoundary>
        </div>

        <main className="flex-1 max-w-[1800px] mx-auto w-full px-6 py-8">
          {/* Collection Tabs + Filter Bar — animate as one unit */}
          <ErrorBoundary areaName="Filters">
            <div className="page-enter-filters">
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
                onOpenReadingRoom={handleOpenReadingRoom}
              />
            </div>
          </ErrorBoundary>

          {/* Analytics Dashboard + Screenplay Grid — animate as one unit */}
          <div className="page-enter-content">
            {/* Analytics Dashboard — lazy-loaded (contains recharts) */}
            {!isLoading && allScreenplays.length > 0 && (
              <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  <AnalyticsDashboard
                    key={`analytics-${screenplays.length}-${screenplays.map(s => s.id).join(',').slice(0, 100)}`}
                    screenplays={screenplays}
                    totalScreenplays={allScreenplays}
                    onFilterByScoreRange={handleFilterByScoreRange}
                    onFilterByTier={handleFilterByTier}
                    onFilterByGenre={handleFilterByGenre}
                    onFilterByBudget={handleFilterByBudget}
                  />
                </Suspense>
              </ErrorBoundary>
            )}

            {/* Screenplay Grid */}
            <ErrorBoundary areaName="Screenplay library">
              <ScreenplayGrid
                screenplays={screenplays}
                isLoading={isLoading}
                onCardClick={handleCardClick}
                percentileRanks={percentileRanks}
              />
            </ErrorBoundary>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gold-500/10 py-6">
          <div className="max-w-[1800px] mx-auto px-6 text-center text-sm text-black-400">
            <p>Lemon Screenplay Dashboard - Powered by V9 Archaeology Engine</p>
          </div>
        </footer>

        {/* Detail Modal */}
        <ErrorBoundary areaName="Screenplay details">
          <ScreenplayModal
            screenplay={selectedScreenplay}
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            percentileRank={selectedScreenplay ? percentileRanks.get(selectedScreenplay.id) : undefined}
            allScreenplays={allScreenplays}
            onSelectScreenplay={handleCardClick}
          />
        </ErrorBoundary>

        {/* Comparison Bar (sticky at bottom) */}
        <ErrorBoundary>
          <ComparisonBar />
          <Suspense fallback={null}>
            <ComparisonModal />
          </Suspense>
        </ErrorBoundary>

        {/* Dev Exec AI Chat */}
        <ErrorBoundary areaName="AI assistant">
          <DevExecChat />
        </ErrorBoundary>

        {isReadingRoomOpen && (
          <ErrorBoundary areaName="Reading Room">
            <ReadingRoom
              screenplays={screenplays}
              percentileRanks={percentileRanks}
              onClose={() => setIsReadingRoomOpen(false)}
            />
          </ErrorBoundary>
        )}
      </div>
    </DevExecProvider>
  );
}

export default App;
