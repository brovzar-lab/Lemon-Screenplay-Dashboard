/**
 * ComparisonModal Component
 * Modal for comparing 2-3 screenplays side-by-side or with radar chart
 */

import { useComparisonStore } from '@/stores/comparisonStore';
import { useScreenplays } from '@/hooks/useScreenplays';
import { ComparisonSideBySide } from './ComparisonSideBySide';
import { ComparisonRadar } from './ComparisonRadar';
import { clsx } from 'clsx';

export function ComparisonModal() {
  const {
    selectedIds,
    isComparing,
    viewMode,
    setViewMode,
    removeFromComparison,
    clearComparison,
    closeComparison,
  } = useComparisonStore();

  const { data: allScreenplays } = useScreenplays();

  // Get selected screenplays
  const selectedScreenplays = allScreenplays?.filter((sp) => selectedIds.includes(sp.id)) || [];

  if (!isComparing || selectedScreenplays.length < 2) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black-950/90 backdrop-blur-sm"
        onClick={closeComparison}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-7xl mx-4 my-8 glass border border-gold-500/20 rounded-xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-black-700 bg-black-900/95 backdrop-blur-sm">
          <div>
            <h2 className="text-xl font-display text-gold-200">Compare Screenplays</h2>
            <p className="text-sm text-black-400">
              Comparing {selectedScreenplays.length} screenplays
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg bg-black-800 p-1">
              <button
                onClick={() => setViewMode('side-by-side')}
                className={clsx(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                  viewMode === 'side-by-side'
                    ? 'bg-gold-500 text-black-950'
                    : 'text-black-400 hover:text-gold-400'
                )}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Side by Side
                </span>
              </button>
              <button
                onClick={() => setViewMode('radar')}
                className={clsx(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                  viewMode === 'radar'
                    ? 'bg-gold-500 text-black-950'
                    : 'text-black-400 hover:text-gold-400'
                )}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                  Radar Chart
                </span>
              </button>
            </div>

            {/* Clear Button */}
            <button
              onClick={clearComparison}
              className="btn btn-ghost text-sm"
            >
              Clear All
            </button>

            {/* Close Button */}
            <button
              onClick={closeComparison}
              className="p-2 rounded-lg hover:bg-black-700 text-black-400 hover:text-gold-400"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {viewMode === 'side-by-side' ? (
            <ComparisonSideBySide
              screenplays={selectedScreenplays}
              onRemove={removeFromComparison}
            />
          ) : (
            <ComparisonRadar
              screenplays={selectedScreenplays}
              onRemove={removeFromComparison}
            />
          )}
        </div>

        {/* Footer with Export Options */}
        <div className="sticky bottom-0 flex items-center justify-between p-4 border-t border-black-700 bg-black-900/95 backdrop-blur-sm">
          <div className="text-xs text-black-500">
            {selectedScreenplays.length < 3 && (
              <span>You can compare up to 3 screenplays. Add more from the grid.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary text-sm" disabled>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Comparison
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComparisonModal;
