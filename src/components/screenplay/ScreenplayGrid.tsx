/**
 * ScreenplayGrid Component
 * Incrementally rendered CSS Grid of screenplay cards.
 *
 * Cards have variable heights, so fixed-row virtualization can overlap content.
 * Rendering in batches keeps the initial DOM bounded while preserving the
 * browser's native grid layout and appending more before the user reaches the
 * bottom.
 *
 * Responsive columns: 1 → 2 → 3 → 4 via Tailwind grid classes.
 * Back-to-top and stagger animation are preserved.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { ScreenplayCard } from './ScreenplayCard';
import { BackToTopButton } from './BackToTopButton';
import { BulkActionBar } from './BulkActionBar';
import { ErrorBoundary } from '@/components/ui';
import {
  EmptyState,
  SpotlightIcon,
  DimmedStarIcon,
  SearchEmptyIcon,
} from '@/components/ui/EmptyState';
import { useFilterStore } from '@/stores/filterStore';
import { useHasActiveFilters } from '@/hooks/useFilteredScreenplays';
import type { Screenplay } from '@/types';
import type { PercentileRank } from '@/lib/percentileRanking';

interface ScreenplayGridProps {
  screenplays: Screenplay[];
  isLoading: boolean;
  onCardClick?: (screenplay: Screenplay) => void;
  percentileRanks?: ReadonlyMap<string, PercentileRank>;
}

/** Module-level flag: stagger animation fires once per page load (D-02) */
let hasCompletedInitialReveal = false;
const CARD_BATCH_SIZE = 48;

interface VisibleWindow {
  source: Screenplay[];
  count: number;
}

/**
 * Loading skeleton card
 */
function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="h-6 bg-black-700 rounded w-3/4 mb-2" />
          <div className="h-4 bg-black-800 rounded w-1/2" />
        </div>
        <div className="h-6 w-24 bg-black-700 rounded-full" />
      </div>

      {/* Tags skeleton */}
      <div className="flex gap-2 mb-4">
        <div className="h-6 w-20 bg-black-800 rounded" />
        <div className="h-6 w-16 bg-black-800 rounded" />
        <div className="h-6 w-14 bg-black-800 rounded" />
      </div>

      {/* Logline skeleton */}
      <div className="space-y-2 mb-4">
        <div className="h-4 bg-black-800 rounded w-full" />
        <div className="h-4 bg-black-800 rounded w-5/6" />
      </div>

      {/* Scores skeleton */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1">
            <div className="h-3 bg-black-800 rounded w-1/2" />
            <div className="h-2 bg-black-800 rounded w-full" />
          </div>
        ))}
      </div>

      {/* Footer skeleton */}
      <div className="flex items-center justify-between pt-4 border-t border-black-700">
        <div className="flex gap-4">
          <div className="h-8 w-12 bg-black-800 rounded" />
          <div className="h-8 w-16 bg-black-800 rounded" />
        </div>
        <div className="h-4 w-32 bg-black-800 rounded" />
      </div>
    </div>
  );
}

/**
 * Context-aware empty state — resolves from Zustand store
 */
function GridEmptyState() {
  const searchQuery = useFilterStore((s) => s.searchQuery);
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);
  const resetFilters = useFilterStore((s) => s.resetFilters);
  const recommendationTiers = useFilterStore((s) => s.recommendationTiers);
  const hasFilters = useHasActiveFilters();

  const isFilmNowOnly = recommendationTiers.length === 1 && recommendationTiers[0] === 'film_now';

  if (searchQuery) {
    return (
      <EmptyState
        icon={<SearchEmptyIcon />}
        title="No scripts match that search"
        description={`No results for "${searchQuery}". Try a different search term.`}
        action={
          <button onClick={() => setSearchQuery('')} className="btn btn-secondary text-sm">
            Clear Search
          </button>
        }
      />
    );
  }

  if (isFilmNowOnly) {
    return (
      <EmptyState
        icon={<DimmedStarIcon />}
        title="No FILM NOW contenders yet"
        description="None of the current screenplays have earned top-tier status"
        action={
          <button onClick={resetFilters} className="btn btn-secondary text-sm">
            Reset Filters
          </button>
        }
      />
    );
  }

  if (hasFilters) {
    return (
      <EmptyState
        icon={<SpotlightIcon />}
        title="Nothing made the cut"
        description="Try adjusting your filters to see more screenplays"
        action={
          <button onClick={resetFilters} className="btn btn-primary text-sm">
            Reset All Filters
          </button>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={<SpotlightIcon />}
      title="No screenplays found"
      description="Make sure the analysis data is available and has been uploaded"
    />
  );
}

export function ScreenplayGrid({ screenplays, isLoading, onCardClick, percentileRanks }: ScreenplayGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isInitialRender, setIsInitialRender] = useState(true);
  const [visibleWindow, setVisibleWindow] = useState<VisibleWindow>({
    source: screenplays,
    count: CARD_BATCH_SIZE,
  });
  if (visibleWindow.source !== screenplays) {
    setVisibleWindow({ source: screenplays, count: CARD_BATCH_SIZE });
  }
  const visibleCount = visibleWindow.source === screenplays ? visibleWindow.count : CARD_BATCH_SIZE;
  const hasMore = visibleCount < screenplays.length;

  // Scroll detection for back-to-top and incremental card rendering.
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      setShowBackToTop(container.scrollTop > 800);

      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      if (hasMore && distanceFromBottom < 1_000) {
        setVisibleWindow((current) => ({
          source: screenplays,
          count: Math.min(
            (current.source === screenplays ? current.count : CARD_BATCH_SIZE) + CARD_BATCH_SIZE,
            screenplays.length,
          ),
        }));
      }
    },
    [hasMore, screenplays],
  );

  // Jump to top when the screenplays list changes (filter/sort) — D-05
  useEffect(() => {
    if (parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
  }, [screenplays]);

  // Mark initial reveal complete after first render with data (D-02)
  useEffect(() => {
    if (screenplays.length > 0 && isInitialRender) {
      const timer = setTimeout(() => {
        hasCompletedInitialReveal = true;
        setIsInitialRender(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [screenplays.length, isInitialRender]);

  const scrollToTop = useCallback(() => {
    parentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Only animate on the very first load; skip on filter changes
  const shouldStagger = isInitialRender && !hasCompletedInitialReveal;
  const visibleScreenplays = screenplays.slice(0, visibleCount);

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (screenplays.length === 0) {
    return <GridEmptyState />;
  }

  // ── Grid ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto"
        style={{ height: 'calc(100vh - 200px)' }}
        onScroll={handleScroll}
        role="list"
        aria-label="Screenplay results"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6 pb-8">
          {visibleScreenplays.map((sp, index) => (
            <div
              key={sp.id}
              role="listitem"
              style={
                shouldStagger
                  ? {
                      opacity: 0,
                      animation: `slide-up-fade 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 35}ms forwards`,
                    }
                  : undefined
              }
            >
              <ErrorBoundary
                fallback={
                  <div className="card bg-red-500/10 border-red-500/30">
                    <p className="text-red-400 text-sm">Error rendering: {sp.title || 'Unknown'}</p>
                  </div>
                }
              >
                <ScreenplayCard
                  screenplay={sp}
                  percentileRank={percentileRanks?.get(sp.id)}
                  onClick={() => onCardClick?.(sp)}
                />
              </ErrorBoundary>
            </div>
          ))}
        </div>
        <span className="sr-only" aria-live="polite">
          Showing {visibleScreenplays.length} of {screenplays.length} screenplays
        </span>
      </div>

      <BackToTopButton visible={showBackToTop} onClick={scrollToTop} />
      <BulkActionBar />
    </>
  );
}

export default ScreenplayGrid;
