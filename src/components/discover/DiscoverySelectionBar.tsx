import { useEffect, useMemo, useState } from 'react';
import { AddToFavoritesModal } from '@/components/bulk/AddToFavoritesModal';
import { BulkShareModal } from '@/components/bulk/BulkShareModal';
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
  const hasSelection = useHasSelection();
  const count = useSelectionCount();
  const selectedIds = useSelectionStore((state) => state.selectedIds);
  const deselectAll = useSelectionStore((state) => state.deselectAll);
  const selectedScreenplays = useMemo(
    () => screenplays.filter((screenplay) => selectedIds.has(screenplay.id)),
    [screenplays, selectedIds],
  );

  useEffect(() => {
    if (!escapeEnabled || !hasSelection || showShareModal || showFavoritesModal) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      deselectAll();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [deselectAll, escapeEnabled, hasSelection, showFavoritesModal, showShareModal]);

  if (!hasSelection) return null;

  return (
    <>
      <section
        aria-label="Discovery selection actions"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gold-500/35 bg-black-950/95 shadow-[0_-18px_45px_rgba(0,0,0,0.45)] backdrop-blur"
      >
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-semibold text-gold-200">
              {count} screenplay{count === 1 ? '' : 's'} selected
            </span>
            <button
              type="button"
              aria-label="Clear selection"
              onClick={deselectAll}
              className="border-l border-black-600 pl-3 text-xs font-semibold uppercase tracking-[0.12em] text-black-400 hover:text-gold-300"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="border border-gold-500/60 bg-gold-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-gold-200 hover:bg-gold-500/20"
            >
              Bulk share links
            </button>
            <button
              type="button"
              onClick={() => setShowFavoritesModal(true)}
              className="border border-black-500 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-black-100 hover:border-gold-500/60 hover:text-gold-200"
            >
              Add to favorites
            </button>
          </div>
        </div>
      </section>

      <BulkShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        screenplays={selectedScreenplays}
      />
      <AddToFavoritesModal
        isOpen={showFavoritesModal}
        onClose={() => setShowFavoritesModal(false)}
      />
    </>
  );
}
