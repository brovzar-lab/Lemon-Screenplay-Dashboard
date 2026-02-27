/**
 * ScreenplayGrid Component
 * Displays grid of screenplay cards with loading, empty states, and bulk delete
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { ScreenplayCard } from './ScreenplayCard';
import { ErrorBoundary } from '@/components/ui';
import { DeleteConfirmDialog } from '@/components/ui/DeleteConfirmDialog';
import { useFilterStore } from '@/stores/filterStore';
import { useDeleteSelectionStore } from '@/stores/deleteSelectionStore';
import { useDeleteScreenplays } from '@/hooks/useScreenplays';
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

  // Delete mode state
  const isDeleteMode = useDeleteSelectionStore((s) => s.isDeleteMode);
  const selectedIds = useDeleteSelectionStore((s) => s.selectedIds);
  const setDeleteMode = useDeleteSelectionStore((s) => s.setDeleteMode);
  const selectAll = useDeleteSelectionStore((s) => s.selectAll);
  const deselectAll = useDeleteSelectionStore((s) => s.deselectAll);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const deleteMutation = useDeleteScreenplays();

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

  // Handle bulk delete
  const handleBulkDelete = () => {
    const selectedScreenplays = screenplays.filter((sp) => selectedIds.has(sp.id));
    const sourceFiles = selectedScreenplays.map((sp) => sp.sourceFile || sp.title);
    deleteMutation.mutate(sourceFiles, {
      onSuccess: () => {
        setShowBulkDeleteConfirm(false);
        setDeleteMode(false);
      },
    });
  };

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

  const selectedCount = selectedIds.size;

  return (
    <>
      {/* Delete Mode Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {isDeleteMode && (
            <>
              <button
                onClick={() => selectAll(screenplays.map((sp) => sp.id))}
                className="btn btn-secondary text-xs py-1.5 px-3"
              >
                Select All ({screenplays.length})
              </button>
              <button
                onClick={deselectAll}
                className="btn btn-secondary text-xs py-1.5 px-3"
                disabled={selectedCount === 0}
              >
                Deselect All
              </button>
            </>
          )}
        </div>
        <button
          onClick={() => setDeleteMode(!isDeleteMode)}
          className={
            isDeleteMode
              ? 'text-xs py-1.5 px-3 rounded-lg font-medium transition-colors bg-black-700 text-black-300 hover:bg-black-600'
              : 'text-xs py-1.5 px-3 rounded-lg font-medium transition-colors bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20'
          }
        >
          {isDeleteMode ? 'Cancel' : '🗑 Delete Mode'}
        </button>
      </div>

      {/* Grid */}
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
              onClick={() => !isDeleteMode && onCardClick?.(screenplay)}
              className="focus:outline-none focus:ring-2 focus:ring-gold-400 focus:ring-offset-2 focus:ring-offset-black-900 rounded-xl"
            >
              <ScreenplayCard screenplay={screenplay} />
            </div>
          </ErrorBoundary>
        ))}
      </div>

      {/* Floating Bulk Action Bar */}
      {isDeleteMode && selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3 rounded-2xl border border-red-500/30 bg-black-900/95 backdrop-blur-md shadow-2xl">
          <span className="text-sm text-black-300">
            <span className="font-mono font-bold text-red-400">{selectedCount}</span> selected
          </span>
          <button
            onClick={() => setShowBulkDeleteConfirm(true)}
            className="text-sm px-4 py-2 rounded-lg font-medium transition-colors bg-red-600 hover:bg-red-500 text-white"
          >
            Delete Selected
          </button>
        </div>
      )}

      {/* Bulk Delete Confirmation */}
      <DeleteConfirmDialog
        isOpen={showBulkDeleteConfirm}
        onConfirm={handleBulkDelete}
        onCancel={() => setShowBulkDeleteConfirm(false)}
        title="Delete selected screenplays?"
        message="This will permanently remove all selected screenplays from your database."
        count={selectedCount}
        isPending={deleteMutation.isPending}
      />
    </>
  );
}

export default ScreenplayGrid;

