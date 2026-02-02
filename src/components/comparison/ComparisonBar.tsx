/**
 * ComparisonBar Component
 * Sticky bar at bottom showing selected screenplays for comparison
 */

import { useComparisonStore, useIsComparisonFull } from '@/stores/comparisonStore';
import { useScreenplays } from '@/hooks/useScreenplays';
import { clsx } from 'clsx';

export function ComparisonBar() {
  const {
    selectedIds,
    removeFromComparison,
    clearComparison,
    setIsComparing,
  } = useComparisonStore();

  const isComparisonFull = useIsComparisonFull();
  const { data: allScreenplays } = useScreenplays();

  // Get selected screenplays
  const selectedScreenplays = allScreenplays?.filter((sp) => selectedIds.includes(sp.id)) || [];

  // Don't show if nothing selected
  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 animate-slide-up">
      <div className="glass border-t border-gold-500/20 shadow-xl">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left - Selected Items */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-black-400">
                Compare ({selectedIds.length}/3):
              </span>

              <div className="flex items-center gap-2">
                {selectedScreenplays.map((sp) => (
                  <div
                    key={sp.id}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg border',
                      sp.isFilmNow
                        ? 'border-gold-500 bg-gold-500/10'
                        : 'border-black-600 bg-black-800'
                    )}
                  >
                    <span className="text-sm text-black-200 max-w-[150px] truncate">
                      {sp.title}
                    </span>
                    <span className="text-xs font-mono text-gold-400">
                      {sp.weightedScore.toFixed(1)}
                    </span>
                    <button
                      onClick={() => removeFromComparison(sp.id)}
                      className="p-0.5 rounded hover:bg-black-700 text-black-500 hover:text-red-400"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                {/* Add more placeholder */}
                {!isComparisonFull && (
                  <div className="px-3 py-1.5 rounded-lg border border-dashed border-black-600 text-black-500 text-sm">
                    + Click cards to add
                  </div>
                )}
              </div>
            </div>

            {/* Right - Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={clearComparison}
                className="btn btn-ghost text-sm"
              >
                Clear
              </button>
              <button
                onClick={() => setIsComparing(true)}
                disabled={selectedIds.length < 2}
                className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Compare
                {selectedIds.length >= 2 && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComparisonBar;
