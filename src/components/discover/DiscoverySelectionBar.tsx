import { useEffect, useMemo, useState } from 'react';
import { AddToFavoritesModal } from '@/components/bulk/AddToFavoritesModal';
import { BulkShareModal } from '@/components/bulk/BulkShareModal';
import { DiscoveryPitchDeckModal } from '@/components/discover/DiscoveryPitchDeckModal';
import {
  useHasSelection,
  useSelectionCount,
  useSelectionStore,
} from '@/stores/selectionStore';
import type { Screenplay } from '@/types';

interface DiscoverySelectionBarProps {
  screenplays: Screenplay[];
  escapeEnabled: boolean;
}

export function DiscoverySelectionBar({
  screenplays,
  escapeEnabled,
}: DiscoverySelectionBarProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [showPitchDeckModal, setShowPitchDeckModal] = useState(false);
  const hasSelection = useHasSelection();
  const count = useSelectionCount();
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const deselectAll = useSelectionStore((state) => state.deselectAll);
  const selectedScreenplays = useMemo(
    () => screenplays.filter((screenplay) => selectedIds.has(screenplay.id)),
    [screenplays, selectedIds],
  );

  useEffect(() => {
    if (!escapeEnabled || !hasSelection) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setShowShareModal(false);
      setShowFavoritesModal(false);
      setShowPitchDeckModal(false);
      deselectAll();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [deselectAll, escapeEnabled, hasSelection]);

  if (!hasSelection) return null;

  return (
    <>
      <section
        aria-label="Discovery selection actions"
        data-presentation="discovery"
        className="fixed inset-x-0 bottom-0 z-40 bg-black-900 shadow-[0_-12px_36px_rgba(0,0,0,0.3)] dark:border-t dark:border-black-700"
      >
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tabular-nums text-black-50">
              {count} screenplay{count === 1 ? '' : 's'} selected
            </span>
            <button
              type="button"
              aria-label="Clear selection"
              onClick={deselectAll}
              className="min-h-11 border-l border-black-600 pl-3 text-xs font-semibold uppercase tracking-[0.12em] text-black-400 hover:text-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            >
              Clear
            </button>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="btn btn-primary min-h-11 shrink-0 px-4 text-xs uppercase tracking-[0.12em]"
            >
              Bulk share links
            </button>
            <button
              type="button"
              onClick={() => setShowFavoritesModal(true)}
              className="btn btn-secondary min-h-11 shrink-0 px-4 text-xs uppercase tracking-[0.12em]"
            >
              Add to favorites
            </button>
            <button
              type="button"
              onClick={() => setShowPitchDeckModal(true)}
              className="btn btn-secondary col-span-2 min-h-11 shrink-0 px-4 text-xs uppercase tracking-[0.12em] sm:col-span-1"
            >
              Pitch-deck PDFs
            </button>
          </div>
        </div>
      </section>

      {showShareModal && (
        <BulkShareModal
          isOpen
          onClose={() => setShowShareModal(false)}
          screenplays={selectedScreenplays}
          screenplayIdentity="sourceFile"
          presentation="discovery"
        />
      )}
      <AddToFavoritesModal
        isOpen={showFavoritesModal}
        onClose={() => setShowFavoritesModal(false)}
        presentation="discovery"
      />
      <DiscoveryPitchDeckModal
        isOpen={showPitchDeckModal}
        onClose={() => setShowPitchDeckModal(false)}
        screenplays={selectedScreenplays}
        mode="selected"
      />
    </>
  );
}
