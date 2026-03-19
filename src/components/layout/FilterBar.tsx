/**
 * FilterBar Component
 * Search, quick filter chips, sort/filter/share/export controls.
 * Owns the overlay modals triggered from its buttons.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { FilterPanel, AdvancedSortPanel } from '@/components/filters';
import { ExportModal } from '@/components/export';
import { ShareModal } from '@/components/share';
import { useFilterStore } from '@/stores/filterStore';
import { useSortStore } from '@/stores/sortStore';
import { useExportSelectionStore, useExportSelectionCount } from '@/stores/exportSelectionStore';
import { usePdfStatusStore } from '@/stores/pdfStatusStore';
import { useHasActiveFilters } from '@/hooks/useFilteredScreenplays';
import { buildShareableUrl } from '@/hooks/useUrlState';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ShortcutHint } from '@/components/ui/ShortcutHint';
import type { Screenplay, SortField } from '@/types';

const SEARCH_INPUT_ID = 'screenplay-search';

// Quick-filter chip configuration
type FilterType = 'all' | 'pass' | 'consider' | 'recommend' | 'film_now';

const FILTER_CHIPS: { id: FilterType; label: string; activeClass: string; inactiveClass?: string }[] = [
  { id: 'all', label: 'All', activeClass: 'bg-gold-500 border-gold-500 !text-black-950 font-semibold' },
  { id: 'pass', label: 'Pass', activeClass: 'bg-red-500 border-red-500 !text-white font-semibold' },
  { id: 'consider', label: 'Consider', activeClass: 'bg-amber-500 border-amber-500 !text-black-950 font-semibold' },
  { id: 'recommend', label: 'Recommend', activeClass: 'bg-emerald-500 border-emerald-500 !text-black-950 font-semibold' },
  { id: 'film_now', label: 'FILM NOW', activeClass: 'bg-gold-500 border-gold-400 !text-black-950 font-semibold animate-pulse-glow' },
];

interface FilterBarProps {
  screenplays: Screenplay[];
  isLoading: boolean;
  filteredCount: number;
  totalCount: number;
}

export function FilterBar({ screenplays, isLoading, filteredCount, totalCount }: FilterBarProps) {
  const hasActiveFilters = useHasActiveFilters();

  // Filter store
  const searchQuery = useFilterStore((s) => s.searchQuery);
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);
  const recommendationTiers = useFilterStore((s) => s.recommendationTiers);
  const setRecommendationTiers = useFilterStore((s) => s.setRecommendationTiers);
  const resetFilters = useFilterStore((s) => s.resetFilters);
  const missingPdfOnly = useFilterStore((s) => s.missingPdfOnly);
  const setMissingPdfOnly = useFilterStore((s) => s.setMissingPdfOnly);

  // FILTER-03: count active dimension range filters
  const advancedFilterCount = useFilterStore((s) =>
    [
      s.conceptRange.enabled,
      s.structureRange.enabled,
      s.protagonistRange.enabled,
      s.supportingCastRange.enabled,
      s.dialogueRange.enabled,
      s.genreExecutionRange.enabled,
      s.originalityRange.enabled,
    ].filter(Boolean).length
  );

  // FILE-03: pdf status store for missing PDF chip count
  const pdfStatuses = usePdfStatusStore((s) => s.statuses);
  const hasScanResult = usePdfStatusStore((s) => s.hasScanResult);

  // FILE-03: count missing PDFs from unfiltered list
  const missingPdfCount = useMemo(() => {
    if (!screenplays) return 0;
    return screenplays.filter((sp) => {
      if (hasScanResult) {
        return pdfStatuses[sp.id] === 'missing' || pdfStatuses[sp.id] === undefined;
      }
      return sp.hasPdf !== true;
    }).length;
  }, [screenplays, pdfStatuses, hasScanResult]);

  // Sort store
  const sortConfigs = useSortStore((s) => s.sortConfigs);
  const addSortColumn = useSortStore((s) => s.addSortColumn);
  const resetSort = useSortStore((s) => s.resetSort);

  // Panel / modal open states
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isSortPanelOpen, setIsSortPanelOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Export selection
  const exportSelectedIds = useExportSelectionStore((s) => s.selectedIds);
  const selectAllForExport = useExportSelectionStore((s) => s.selectAll);
  const deselectAllExport = useExportSelectionStore((s) => s.deselectAll);
  const exportSelectionCount = useExportSelectionCount();
  const hasExportSelection = exportSelectionCount > 0;

  // Determine which screenplays to export
  const screenplaysToExport = hasExportSelection
    ? screenplays.filter((sp) => exportSelectedIds.includes(sp.id))
    : screenplays;
  const isAllSelected = exportSelectionCount === screenplays.length && screenplays.length > 0;

  // Global keyboard shortcuts
  const focusSearch = useCallback(() => {
    const input = document.getElementById(SEARCH_INPUT_ID) as HTMLInputElement | null;
    input?.focus();
    input?.select();
  }, []);

  const toggleFilters = useCallback(() => {
    setIsFilterPanelOpen((prev) => !prev);
  }, []);

  useKeyboardShortcuts({ onFocusSearch: focusSearch, onToggleFilters: toggleFilters });

  // Determine which quick-filter chip is active
  const getActiveFilter = (): FilterType => {
    if (recommendationTiers.length === 1) {
      return recommendationTiers[0] as FilterType;
    }
    return 'all';
  };

  const handleFilterClick = (filterId: FilterType) => {
    resetFilters();
    switch (filterId) {
      case 'all':
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
    }
  };

  const activeFilter = getActiveFilter();

  // Task 10: Sliding indicator for filter chips
  const chipsContainerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const container = chipsContainerRef.current;
    if (!container) return;
    const activeChip = container.querySelector('[data-active="true"]') as HTMLElement | null;
    if (activeChip) {
      setIndicatorStyle({
        left: activeChip.offsetLeft,
        width: activeChip.offsetWidth,
      });
    }
  }, [activeFilter]);

  // Task 11: Search expand on focus
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  return (
    <>
      <div className="mb-8">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          {/* Search Input */}
          <div className="relative">
            <input
              id={SEARCH_INPUT_ID}
              type="text"
              className={`input pl-10 pr-16 transition-all duration-300 ease-out ${isSearchFocused ? 'w-[360px]' : 'w-52'}`}
              placeholder="Search title, author, genre, logline..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              aria-label="Search screenplays"
            />
            {/* Keyboard shortcut hint */}
            {!searchQuery && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black-600 pointer-events-none hidden md:inline-flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 rounded bg-black-700 border border-black-600 font-mono">/</kbd>
              </span>
            )}
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
            <ShortcutHint id="search" label="/ to search" position="bottom" />
          </div>

          {/* Results Count & Actions */}
          <div className="flex items-center gap-3">
            <div className="text-sm text-black-400">
              {isLoading ? (
                <span>Loading...</span>
              ) : (
                <span key={filteredCount} className="animate-fade-in">
                  {'Showing '}
                  <strong className="text-gold-400">{filteredCount} of {totalCount}</strong>
                  {' screenplays'}
                </span>
              )}
            </div>

            {/* Quick Sort Dropdown */}
            <select
              className="input py-2 px-3 w-auto text-sm"
              value={sortConfigs[0]?.field || 'marketPotential'}
              onChange={(e) => {
                resetSort();
                addSortColumn(e.target.value as SortField, 'desc');
              }}
            >
              <option value="marketPotential">Sort: Market Potential</option>
              <option value="weightedScore">Sort: Weighted Score</option>
              <option value="cvsTotal">Sort: CVS Total</option>

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
              {advancedFilterCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-gold-500/20 text-gold-400 text-xs font-bold">
                  {advancedFilterCount}
                </span>
              )}
            </button>

            {/* Share Button */}
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="btn btn-secondary text-sm"
              title="Share dashboard"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>

            {/* Select All / Deselect All */}
            <button
              onClick={() => isAllSelected ? deselectAllExport() : selectAllForExport(screenplays.map((sp) => sp.id))}
              className="btn btn-secondary text-sm"
              title={isAllSelected ? 'Deselect all' : 'Select all for export'}
              disabled={screenplays.length === 0}
            >
              {isAllSelected ? '☐ Deselect' : '☑ Select All'}
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
              Export ({hasExportSelection ? `${exportSelectionCount} selected` : screenplays.length})
            </button>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div ref={chipsContainerRef} className="relative flex flex-wrap gap-2 mt-4 pb-1">
          {/* Sliding active indicator */}
          <div
            className="absolute bottom-0 h-[3px] rounded-full bg-gold-500 transition-all duration-250"
            style={{
              left: indicatorStyle.left,
              width: indicatorStyle.width,
              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />

          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              data-active={chip.id === activeFilter ? 'true' : 'false'}
              onClick={() => handleFilterClick(chip.id)}
              className={`chip cursor-pointer transition-all ${activeFilter === chip.id
                ? chip.activeClass
                : 'hover:border-gold-500'
                }`}
            >
              {chip.label}
            </button>
          ))}

          {/* FILE-03: Missing PDF quick-filter chip */}
          {(missingPdfCount > 0 || missingPdfOnly) && (
            <button
              data-active={missingPdfOnly ? 'true' : 'false'}
              onClick={() => setMissingPdfOnly(!missingPdfOnly)}
              className={clsx(
                'chip cursor-pointer transition-all',
                missingPdfOnly
                  ? 'bg-amber-500 border-amber-500 !text-black-950 font-semibold'
                  : 'hover:border-amber-500'
              )}
            >
              Missing PDF
              {missingPdfCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-black-800 text-amber-300 text-xs font-bold">
                  {missingPdfCount}
                </span>
              )}
            </button>
          )}

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="chip cursor-pointer text-red-400 border-red-400/50 hover:bg-red-400/10"
            >
              Clear All ✕
            </button>
          )}
        </div>
      </div >

      {/* Overlay panels & modals owned by FilterBar */}
      < AdvancedSortPanel
        isOpen={isSortPanelOpen}
        onClose={() => setIsSortPanelOpen(false)
        }
      />
      < FilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
      />
      < ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        screenplays={screenplaysToExport}
        mode={hasExportSelection ? 'multiple' : hasActiveFilters ? 'filtered' : 'multiple'}
      />
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        shareableUrl={buildShareableUrl()}
      />
    </>
  );
}
