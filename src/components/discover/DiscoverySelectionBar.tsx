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
        className="dsc-card fixed inset-x-0 bottom-0 z-40 rounded-none bg-[var(--dsc-surface)]"
      >
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <span className="dsc-num text-sm font-semibold">
              {count} screenplay{count === 1 ? '' : 's'} selected
            </span>
            <button
              type="button"
              aria-label="Clear selection"
              onClick={deselectAll}
              className="dsc-btn dsc-btn-ghost !min-h-11 !px-3"
            >
              Clear
            </button>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="dsc-btn dsc-btn-primary shrink-0"
            >
              Bulk share links
            </button>
            <button
              type="button"
              onClick={() => setShowFavoritesModal(true)}
              className="dsc-btn shrink-0"
            >
              Add to favorites
            </button>
            <button
              type="button"
              onClick={() => setShowPitchDeckModal(true)}
              className="dsc-btn col-span-2 shrink-0 sm:col-span-1"
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
