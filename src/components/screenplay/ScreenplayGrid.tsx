/**
 * ScreenplayGrid Component
 * Virtualized grid of screenplay cards using @tanstack/react-virtual.
 * Only visible rows (plus overscan buffer) are rendered to the DOM,
 * keeping node count constant regardless of dataset size (PERF-01).
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { VirtualRow } from './VirtualRow';
import { BackToTopButton } from './BackToTopButton';
import { BulkActionBar } from './BulkActionBar';
import { useColumnCount } from '@/hooks/useColumnCount';
import { EmptyState, SpotlightIcon, DimmedStarIcon, SearchEmptyIcon } from '@/components/ui/EmptyState';
import { useFilterStore } from '@/stores/filterStore';
import { useHasActiveFilters } from '@/hooks/useFilteredScreenplays';
import type { Screenplay } from '@/types';

interface ScreenplayGridProps {
  screenplays: Screenplay[];
  isLoading: boolean;
  onCardClick?: (screenplay: Screenplay) => void;
}

/**
 * Row height constants per column count.
 * Taller rows for fewer columns (more content visible per card).
 */
const ROW_HEIGHTS: Record<number, number> = {
  1: 420,  // mobile: 1-col, taller cards
  2: 380,  // sm/lg: 2-col
  3: 360,  // xl: 3-col
  4: 340,  // 2xl: 4-col, most compact
};

function getRowHeight(columnCount: number): number {
  return ROW_HEIGHTS[columnCount] ?? 380;
}

/** Module-level flag: stagger animation fires once per page load (D-02) */
let hasCompletedInitialReveal = false;

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

  const isFilmNowOnly =
    recommendationTiers.length === 1 && recommendationTiers[0] === 'film_now';

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

export function ScreenplayGrid({ screenplays, isLoading, onCardClick }: ScreenplayGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount();
  const rowCount = Math.ceil(screenplays.length / columnCount);
  const rowHeight = getRowHeight(columnCount);

  // Per D-06: show back-to-top after scrolling past ~5 rows (~20 cards at 4-col)
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Track initial render for stagger animation (D-02)
  const [isInitialRender, setIsInitialRender] = useState(true);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
    gap: 24, // matches gap-6 (1.5rem = 24px at default)
    onChange: (instance) => {
      // Per D-06: threshold = 5 rows worth of scroll
      setShowBackToTop((instance.scrollOffset ?? 0) > rowHeight * 5);
    },
  });

  // Per D-05: jump to top when screenplays list changes (filter/sort)
  useEffect(() => {
    if (parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
  }, [screenplays]);

  // Per D-08/Pitfall 4: re-measure when column count changes
  useEffect(() => {
    virtualizer.measure();
  }, [columnCount, virtualizer]);

  // Mark initial reveal complete after first render with data
  useEffect(() => {
    if (screenplays.length > 0 && isInitialRender) {
      const timer = setTimeout(() => {
        hasCompletedInitialReveal = true;
        setIsInitialRender(false);
      }, 800); // allow stagger animations to complete
      return () => clearTimeout(timer);
    }
  }, [screenplays.length, isInitialRender]);

  const scrollToTop = useCallback(() => {
    if (parentRef.current) {
      parentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  // Loading state — keep existing skeleton grid
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // Empty state — keep existing context-aware empty state
  if (screenplays.length === 0) {
    return <GridEmptyState />;
  }

  // Calculate stagger delay per D-02:
  // Only on initial page load. First visible rows get stagger delays.
  // After initial reveal completes, no animation.
  const shouldStagger = isInitialRender && !hasCompletedInitialReveal;

  return (
    <>
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto"
        style={{ height: 'calc(100vh - 200px)' }}
        role="list"
        aria-label="Screenplay results"
      >
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => (
            <VirtualRow
              key={virtualRow.key}
              virtualRow={virtualRow}
              screenplays={screenplays}
              columnCount={columnCount}
              onCardClick={onCardClick}
              staggerDelay={shouldStagger ? virtualRow.index * 80 : 0}
            />
          ))}
        </div>
      </div>
      <BackToTopButton visible={showBackToTop} onClick={scrollToTop} />
      <BulkActionBar />
    </>
  );
}

export default ScreenplayGrid;
