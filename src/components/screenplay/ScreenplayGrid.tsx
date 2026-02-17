/**
 * ScreenplayGrid Component
 * Displays grid of screenplay cards with loading and empty states
 */

import { useRef, useCallback, useEffect } from 'react';
import { ScreenplayCard } from './ScreenplayCard';
import { ErrorBoundary } from '@/components/ui';
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
 * Empty state component with actionable suggestions
 */
function EmptyState() {
  const searchQuery = useFilterStore((s) => s.searchQuery);
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);
  const resetFilters = useFilterStore((s) => s.resetFilters);
  const hasFilters = useHasActiveFilters();

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-24 h-24 rounded-full bg-black-800/80 flex items-center justify-center mb-6 border border-black-700">
        <span className="text-5xl">🎬</span>
      </div>
      <h3 className="text-2xl font-display text-gold-100 mb-3">
        {hasFilters || searchQuery ? 'No Screenplays Match' : 'No Screenplays Found'}
      </h3>
      <p className="text-black-400 max-w-md mb-6">
        {searchQuery
          ? `No results for "${searchQuery}". Try a different search term.`
          : hasFilters
            ? 'Try adjusting your filters to find more screenplays.'
            : 'There are no screenplays loaded. Make sure the analysis data is available.'}
      </p>

      {/* Action buttons */}
      {(hasFilters || searchQuery) && (
        <div className="flex gap-3">
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="btn btn-secondary text-sm"
            >
              Clear Search
            </button>
          )}
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="btn btn-primary text-sm"
            >
              Reset All Filters
            </button>
          )}
        </div>
      )}

      {/* Keyboard shortcut hints */}
      <div className="mt-8 flex gap-6 text-xs text-black-600">
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-black-700 border border-black-600 font-mono">/</kbd> Search
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-black-700 border border-black-600 font-mono">⌘F</kbd> Filters
        </span>
      </div>
    </div>
  );
}

export function ScreenplayGrid({ screenplays, isLoading, onCardClick }: ScreenplayGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const { containerRef: revealRef, refresh: refreshReveals } = useScrollReveal<HTMLDivElement>();

  // Share both refs via a callback ref
  const setGridRef = useCallback((el: HTMLDivElement | null) => {
    (gridRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    (revealRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  }, [revealRef]);

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

      // Calculate columns based on grid layout
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
    return <EmptyState />;
  }

  return (
    <div
      ref={setGridRef}
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
