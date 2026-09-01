import { useEffect, useMemo, useState } from 'react';
import { AddToFavoritesModal } from '@/components/bulk/AddToFavoritesModal';
import { BulkShareModal } from '@/components/bulk/BulkShareModal';
import { DiscoveryPitchDeckModal } from '@/components/discover/DiscoveryPitchDeckModal';
import { useHasSelection, useSelectionCount, useSelectionStore } from '@/stores/selectionStore';
import type { Screenplay } from '@/types';
import { getScreenplayDisplayTitle } from '@/lib/screenplayDisplay';
import { isCoverageV1Screenplay, isDecisionReady } from '@/lib/producerProjection';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { useTranslation } from 'react-i18next';

interface DiscoverySelectionBarProps {
  screenplays: Screenplay[];
  visibleScreenplays: Screenplay[];
  escapeEnabled: boolean;
  selectionMode?: boolean;
  onExitSelectionMode?: () => void;
}

export function DiscoverySelectionBar({
  screenplays,
  visibleScreenplays,
  escapeEnabled,
  selectionMode = true,
  onExitSelectionMode,
}: DiscoverySelectionBarProps) {
  const { t } = useTranslation();
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
  const visibleSelectedScreenplays = useMemo(
    () => visibleScreenplays.filter((screenplay) => selectedIds.has(screenplay.id)),
    [visibleScreenplays, selectedIds],
  );
  const decisionOutputAllowed =
    selectedScreenplays.length > 0 && selectedScreenplays.every(isDecisionReady);
  const hasCoverageSelection = selectedScreenplays.some(isCoverageV1Screenplay);
  const hasUnverifiedSelection = selectedScreenplays.some(
    (screenplay) => !isDecisionReady(screenplay) && !isCoverageV1Screenplay(screenplay),
  );

  useEffect(() => {
    if (!escapeEnabled || !selectionMode) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      const exitSelection = () => {
        if (onExitSelectionMode) onExitSelectionMode();
        else deselectAll();
      };
      if (showPitchDeckModal) {
        setShowPitchDeckModal(false);
        exitSelection();
        return;
      }
      if (showFavoritesModal) {
        setShowFavoritesModal(false);
        exitSelection();
        return;
      }
      if (showShareModal) {
        setShowShareModal(false);
        exitSelection();
        return;
      }
      exitSelection();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [
    deselectAll,
    escapeEnabled,
    onExitSelectionMode,
    selectionMode,
    showFavoritesModal,
    showPitchDeckModal,
    showShareModal,
  ]);

  if (!selectionMode || !hasSelection) return null;

  return (
    <>
      <section
        aria-label={t('Discovery selection actions')}
        data-presentation="discovery"
        className="dsc-selection-tray fixed inset-x-0 bottom-0 z-40 bg-[var(--dsc-surface)]"
      >
        <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:px-10">
          <div className="flex items-center gap-3">
            <div>
              <span className="dsc-kicker block">{t('Selection')}</span>
              <span className="dsc-num mt-0.5 block text-sm font-semibold">
                {t('{{count}} screenplay selected', { count })}
              </span>
            </div>
            <button
              type="button"
              aria-label={t('Clear selection')}
              onClick={onExitSelectionMode ?? deselectAll}
              className="dsc-btn dsc-btn-ghost !min-h-11 !px-3"
            >
              {t('Clear')}
            </button>
          </div>

          <div className="hidden min-w-0 flex-1 gap-2 xl:flex">
            {visibleSelectedScreenplays.slice(0, 3).map((screenplay) => (
              <div key={screenplay.id} className="dsc-selection-project min-w-0 flex-1">
                <span className="truncate text-sm font-semibold text-[var(--dsc-ink)]">
                  {getScreenplayDisplayTitle(screenplay.title).title}
                </span>
                {isCoverageV1Screenplay(screenplay) ? (
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <RecommendationBadge tier={screenplay.recommendation} size="sm" />
                    <small className="text-[0.6rem] font-semibold text-[var(--dsc-ink-3)]">
                      {t('Coverage · unscored by design')}
                    </small>
                  </span>
                ) : (
                  <span className="dsc-num shrink-0 text-lg font-semibold">
                    {isDecisionReady(screenplay)
                      ? screenplay.weightedScore.toFixed(1)
                      : t('Not verified')}
                  </span>
                )}
              </div>
            ))}
            {count > 3 && (
              <div className="dsc-selection-project flex-none">
                <span className="dsc-num text-sm font-semibold">
                  {t('+{{count}} more', { count: count - 3 })}
                </span>
              </div>
            )}
          </div>

          <div className="grid w-full grid-cols-2 gap-2 lg:ml-auto lg:flex lg:w-auto lg:flex-wrap lg:items-center">
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              disabled={!decisionOutputAllowed}
              className="dsc-btn dsc-btn-primary shrink-0"
            >
              {t('Bulk share links')}
            </button>
            <button
              type="button"
              onClick={() => setShowFavoritesModal(true)}
              className="dsc-btn shrink-0"
            >
              {t('Add to favorites')}
            </button>
            <button
              type="button"
              onClick={() => setShowPitchDeckModal(true)}
              disabled={!decisionOutputAllowed}
              className="dsc-btn col-span-2 shrink-0 sm:col-span-1"
            >
              {t('Pitch-deck PDFs')}
            </button>
            {!decisionOutputAllowed && (
              <span role="status" className="col-span-2 text-xs text-amber-300">
                {hasUnverifiedSelection
                  ? t('Decision data unavailable until verification')
                  : hasCoverageSelection
                    ? t('Coverage · unscored by design')
                    : null}
              </span>
            )}
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
