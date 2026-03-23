/**
 * BulkActionBar Component
 * Sticky bottom action bar that appears when 1+ screenplays are selected.
 * Shows selection count, clear/Select All/Deselect All, and six disabled action buttons.
 * Action buttons are wired in Phase 4 -- this is the shell with title tooltips (D-09, D-10).
 */

import { useSelectionStore, useSelectionCount, useHasSelection } from '@/stores/selectionStore';
import { useFilteredScreenplays } from '@/hooks/useFilteredScreenplays';

export function BulkActionBar() {
  const count = useSelectionCount();
  const hasSelection = useHasSelection();
  const selectAll = useSelectionStore((s) => s.selectAll);
  const deselectAll = useSelectionStore((s) => s.deselectAll);
  const { screenplays: filtered } = useFilteredScreenplays();

  if (!hasSelection) return null;

  const handleSelectAll = () => {
    selectAll(filtered.map((sp) => sp.id));
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 animate-slide-up">
      <div className="glass border-t border-gold-500/20 shadow-xl">
        <div className="max-w-[1800px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Left side: count + clear + select all/deselect all */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gold-200">
                {count} screenplay{count !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={deselectAll}
                className="text-black-400 hover:text-red-400 transition-colors p-1"
                aria-label="Clear selection"
                title="Clear selection"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="h-4 w-px bg-black-600" />
              <button
                onClick={handleSelectAll}
                className="text-xs text-black-400 hover:text-gold-300 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="text-xs text-black-400 hover:text-gold-300 transition-colors"
              >
                Deselect All
              </button>
            </div>

            {/* Right side: six action buttons, all disabled shell */}
            <div className="flex items-center gap-2">
              <button disabled title="Export CSV -- wired in Phase 4" className="btn btn-ghost text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                Export CSV
              </button>
              <button disabled title="Export PDF -- wired in Phase 4" className="btn btn-ghost text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                Export PDF
              </button>
              <button disabled title="Compare -- select 2-5 screenplays" className="btn btn-ghost text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                Compare
              </button>
              <button disabled title="Upload PDFs -- wired in Phase 4" className="btn btn-ghost text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                Upload PDFs
              </button>
              <button disabled title="Add to Collection -- wired in Phase 4" className="btn btn-ghost text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                Collection
              </button>
              <button disabled title="Add to Favorites -- wired in Phase 4" className="btn btn-ghost text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                Favorites
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
