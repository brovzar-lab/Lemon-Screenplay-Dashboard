/**
 * ScreenplayGrid Component
 * Displays grid of screenplay cards with loading and empty states.
 * Uses @tanstack/react-virtual useWindowVirtualizer for efficient rendering
 * of large screenplay lists. Delete is handled per-card and in the modal header.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { ScreenplayCard } from './ScreenplayCard';
import { ErrorBoundary } from '@/components/ui';
import { EmptyState, SpotlightIcon, DimmedStarIcon, SearchEmptyIcon } from '@/components/ui/EmptyState';
import { useFilterStore } from '@/stores/filterStore';
import { useHasActiveFilters } from '@/hooks/useFilteredScreenplays';
import type { Screenplay } from '@/types';

interface ScreenplayGridProps {
  screenplays: Screenplay[];
  isLoading: boolean;
  onCardClick?: (screenplay: Screenplay) => void;
}

// Card height (340px) + row gap (24px = gap-6)
const ROW_HEIGHT = 364;

function getColumnCount(width: number): number {
  if (width >= 1536) return 4; // 2xl:grid-cols-4
  if (width >= 1280) return 3; // xl:grid-cols-3
  if (width >= 640) return 2;  // sm:grid-cols-2
  return 1;                     // grid-cols-1
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Track column count via ResizeObserver on the container element
  const [columns, setColumns] = useState(() =>
    typeof window !== 'undefined' ? getColumnCount(window.innerWidth) : 1
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setColumns(getColumnCount(entry.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Group flat array into rows of N columns
  const rowCount = Math.ceil(screenplays.length / columns);

  // useWindowVirtualizer uses window scroll — matches the page's min-h-screen flex layout
  const rowVirtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ROW_HEIGHT,
    overscan: 3,
    scrollMargin: containerRef.current?.offsetTop ?? 0,
  });

  // Keyboard navigation — uses `columns` state (not getComputedStyle)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, globalIndex: number) => {
      const grid = containerRef.current;
      if (!grid) return;

      const cards = grid.querySelectorAll<HTMLElement>('[data-card]');
      const currentCard = cards[globalIndex];
      if (!currentCard) return;

      let nextIndex: number | null = null;

      switch (e.key) {
        case 'ArrowRight':
          nextIndex = Math.min(globalIndex + 1, cards.length - 1);
          break;
        case 'ArrowLeft':
          nextIndex = Math.max(globalIndex - 1, 0);
          break;
        case 'ArrowDown':
          nextIndex = Math.min(globalIndex + columns, cards.length - 1);
          break;
        case 'ArrowUp':
          nextIndex = Math.max(globalIndex - columns, 0);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onCardClick?.(screenplays[globalIndex]);
          return;
        default:
          return;
      }

      if (nextIndex !== null && nextIndex !== globalIndex) {
        e.preventDefault();
        cards[nextIndex]?.focus();
      }
    },
    [screenplays, onCardClick, columns]
  );

  // Loading state — unchanged
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // Empty state — unchanged
  if (screenplays.length === 0) {
    return <GridEmptyState />;
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Sentinel div establishes the total scroll height for the virtualizer */}
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const startIdx = virtualRow.index * columns;
          const rowScreenplays = screenplays.slice(startIdx, startIdx + columns);

          return (
            <ErrorBoundary
              key={virtualRow.key}
              fallback={
                <div
                  style={{ height: ROW_HEIGHT }}
                  className="flex items-center justify-center text-red-400 text-sm"
                >
                  Error rendering row
                </div>
              }
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                }}
                className="flex gap-4 md:gap-6"
              >
                {rowScreenplays.map((screenplay, colIdx) => {
                  const globalIndex = startIdx + colIdx;
                  return (
                    <div
                      key={screenplay.id}
                      data-card
                      tabIndex={0}
                      className="card-enter flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:ring-offset-2 focus:ring-offset-black-900 rounded-xl"
                      onKeyDown={(e) => handleKeyDown(e, globalIndex)}
                      onClick={() => onCardClick?.(screenplay)}
                    >
                      <ScreenplayCard screenplay={screenplay} />
                    </div>
                  );
                })}
                {/* Fill empty slots in the last row so flex layout stays consistent */}
                {rowScreenplays.length < columns &&
                  Array.from({ length: columns - rowScreenplays.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="flex-1 min-w-0" aria-hidden="true" />
                  ))}
              </div>
            </ErrorBoundary>
          );
        })}
      </div>
    </div>
  );
}

export default ScreenplayGrid;
