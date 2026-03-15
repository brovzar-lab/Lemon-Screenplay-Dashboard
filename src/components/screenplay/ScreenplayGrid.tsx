/**
 * ScreenplayGrid Component
 * Displays grid of screenplay cards with loading and empty states.
 * Delete is handled per-card (trash icon on hover) and in the modal header.
 */

import { useRef, useCallback, useEffect } from 'react';
import { ScreenplayCard } from './ScreenplayCard';
import { ErrorBoundary } from '@/components/ui';
import { EmptyState, SpotlightIcon, DimmedStarIcon, SearchEmptyIcon } from '@/components/ui/EmptyState';
import { useFilterStore } from '@/stores/filterStore';
import { useHasActiveFilters } from '@/hooks/useFilteredScreenplays';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import type { Screenplay } from '@/types';

interface ScreenplayGridProps {
  screenplays: Screenplay[];
  isLoading: boolean;
  onCardClick?: (screenplay: Screenplay) => void;
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
  const gridRef = useRef<HTMLDivElement>(null);
  const { containerRef: revealRef, refresh: refreshReveals } = useScrollReveal<HTMLDivElement>();

  // Sync gridRef for keyboard navigation
  useEffect(() => {
    if (revealRef.current) {
      (gridRef as React.MutableRefObject<HTMLDivElement | null>).current = revealRef.current;
    }
  });

  // Re-observe when screenplays change (e.g., after filtering)
  useEffect(() => {
    refreshReveals();
  }, [screenplays, refreshReveals]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const grid = gridRef.current;
      if (!grid) return;

      const cards = grid.querySelectorAll<HTMLElement>('[data-card]');
      const currentCard = cards[index];
      if (!currentCard) return;

      const gridStyles = window.getComputedStyle(grid);
      const columns = gridStyles.gridTemplateColumns.split(' ').length;

      let nextIndex: number | null = null;

      switch (e.key) {
        case 'ArrowRight':
          nextIndex = Math.min(index + 1, cards.length - 1);
          break;
        case 'ArrowLeft':
          nextIndex = Math.max(index - 1, 0);
          break;
        case 'ArrowDown':
          nextIndex = Math.min(index + columns, cards.length - 1);
          break;
        case 'ArrowUp':
          nextIndex = Math.max(index - columns, 0);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onCardClick?.(screenplays[index]);
          return;
        default:
          return;
      }

      if (nextIndex !== null && nextIndex !== index) {
        e.preventDefault();
        cards[nextIndex]?.focus();
      }
    },
    [screenplays, onCardClick]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (screenplays.length === 0) {
    return <GridEmptyState />;
  }

  return (
    <div
      ref={revealRef}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6"
      role="list"
      aria-label="Screenplay results"
    >
      {screenplays.map((screenplay, index) => (
        <ErrorBoundary
          key={screenplay.id}
          fallback={
            <div className="card bg-red-500/10 border-red-500/30" role="listitem">
              <p className="text-red-400 text-sm">
                Error rendering: {screenplay.title || 'Unknown'}
              </p>
            </div>
          }
        >
          <div
            data-card
            data-reveal
            style={{ transitionDelay: `${Math.min(index, 12) * 50}ms` }}
            tabIndex={0}
            role="listitem"
            aria-label={`${screenplay.title} by ${screenplay.author}, ${screenplay.recommendation} recommendation`}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onClick={() => onCardClick?.(screenplay)}
            className="focus:outline-none focus:ring-2 focus:ring-gold-400 focus:ring-offset-2 focus:ring-offset-black-900 rounded-xl"
          >
            <ScreenplayCard screenplay={screenplay} />
          </div>
        </ErrorBoundary>
      ))}
    </div>
  );
}

export default ScreenplayGrid;
