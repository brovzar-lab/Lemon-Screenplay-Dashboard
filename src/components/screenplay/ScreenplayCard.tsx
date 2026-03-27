/**
 * ScreenplayCard Component
 * Displays screenplay summary in a card format
 */

// ... imports ...
import { useState, useEffect, useRef, memo } from 'react';
import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { getScoreColorClass } from '@/lib/calculations';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import { useExportSelectionStore, useIsSelectedForExport } from '@/stores/exportSelectionStore';
import { useDeleteSelectionStore, useIsSelectedForDelete } from '@/stores/deleteSelectionStore';
import { useDeleteScreenplays } from '@/hooks/useScreenplays';
import { usePdfStatusStore } from '@/stores/pdfStatusStore';
import { DeleteConfirmDialog } from '@/components/ui/DeleteConfirmDialog';
import { ProductionBadge } from './ProductionBadge';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { PercentileBadge } from '@/components/ui/PercentileBadge';
import { ScoreBar } from '@/components/ui/ScoreBar';
import { useScreenplayPercentile } from '@/hooks/usePercentiles';

// FILE-02: current analysis version strings — module-level constant to avoid re-creation per render
const CURRENT_VERSIONS = new Set(['v6_core_lenses', 'v6_unified', 'v7_archaeology', 'v7_triage']);

interface ScreenplayCardProps {
  screenplay: Screenplay;
  onClick?: () => void;
}

/**
 * Producer metrics mini display (AI-analyzed)
 */
function ProducerMetricsMini({ screenplay }: { screenplay: Screenplay }) {
  const mp = screenplay.producerMetrics?.marketPotential;

  return (
    <div className="flex gap-4 text-xs">
      <div className="flex items-center gap-1" title="AI-analyzed market potential">
        <span className="text-black-400">Mkt</span>
        {mp !== null && mp !== undefined ? (
          <span className={clsx('font-mono font-bold', getScoreColorClass(mp))}>
            {mp}
          </span>
        ) : (
          <span className="text-black-600 italic">—</span>
        )}
      </div>
    </div>
  );
}

function ScreenplayCardInner({ screenplay, onClick }: ScreenplayCardProps) {
  const toggleExportSelection = useExportSelectionStore((s) => s.toggle);
  const isExportSelected = useIsSelectedForExport(screenplay.id);
  const isDeleteMode = useDeleteSelectionStore((s) => s.isDeleteMode);
  const toggleDeleteSelection = useDeleteSelectionStore((s) => s.toggle);
  const isDeleteSelected = useIsSelectedForDelete(screenplay.id);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteMutation = useDeleteScreenplays();
  const percentileRank = useScreenplayPercentile(screenplay.id);

  // V7: goosebumps moments
  const goosebumpsCount = (() => {
    const sp = screenplay as unknown as Record<string, unknown>;
    return Array.isArray(sp.v7GoosebumpsMoments) ? sp.v7GoosebumpsMoments.length : 0;
  })();

  // FILE-01: per-id selector prevents mass re-renders during scan updates
  const myPdfStatus = usePdfStatusStore((s) => s.statuses[screenplay.id]);
  const hasScanResult = usePdfStatusStore((s) => s.hasScanResult);

  // FILE-01: derive pdf badge status
  const pdfBadgeStatus: 'found' | 'missing' | 'unknown' = (() => {
    if (hasScanResult) {
      if (myPdfStatus === 'found') return 'found';
      if (myPdfStatus === 'missing') return 'missing';
      return 'unknown'; // not yet scanned in this batch
    }
    // Fallback to Firestore field
    if (screenplay.hasPdf === true) return 'found';
    if (screenplay.hasPdf === false) return 'missing';
    return 'unknown';
  })();

  // FILE-02: show Legacy badge for non-current versions; undefined = no badge
  const isLegacyVersion = screenplay.analysisVersion
    ? !CURRENT_VERSIONS.has(screenplay.analysisVersion)
    : false;

  const [isRevealed, setIsRevealed] = useState(false);
  const cardRef = useRef<HTMLElement>(null);



  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);



  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDeleteMode) {
      toggleDeleteSelection(screenplay.id);
    } else {
      toggleExportSelection(screenplay.id);
    }
  };

  const handleTrashClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    const sourceFile = screenplay.sourceFile || screenplay.title;
    deleteMutation.mutate(sourceFile, {
      onSuccess: () => setShowDeleteConfirm(false),
    });
  };

  // Determine tier class based on recommendation
  const tierClass = (() => {
    const rec = screenplay.recommendation;
    if (rec === 'film_now') return 'card-film-now';
    if (rec === 'recommend') return 'card-recommend';
    if (rec === 'pass') return 'card-pass';
    return '';
  })();

  // De-emphasize scores for PASS cards
  const isPass = screenplay.recommendation === 'pass';
  const scoreNumClass = isPass ? 'font-mono text-base font-bold' : 'font-mono text-xl font-bold';
  const scoreTextClass = isPass ? 'text-xs' : 'text-sm';

  // Determine checkbox visual state
  const isChecked = isDeleteMode ? isDeleteSelected : isExportSelected;
  const checkboxColor = isDeleteMode
    ? isChecked
      ? 'bg-red-500 border-red-400 text-white'
      : 'border-red-400/50 text-transparent hover:border-red-400'
    : isChecked
      ? 'bg-gold-500 border-gold-400 text-black-950'
      : 'border-black-600 text-transparent hover:border-gold-500';

  return (
    <>
      <article
        ref={cardRef}
        data-testid={`screenplay-card-${screenplay.id}`}
        onClick={onClick}
        className={clsx(
          'card cursor-pointer relative group transition-all duration-200 ease-out',
          'h-[420px] flex flex-col overflow-hidden',
          tierClass,
          isDeleteMode && isDeleteSelected && 'ring-2 ring-red-500/50',
        )}
      >
        {/* Selection checkbox (export) — only visible on hover or when selected */}
        <button
          onClick={handleSelectClick}
          title={isExportSelected ? 'Deselect for export' : 'Select for export'}
          className={clsx(
            'absolute top-4 right-4 w-6 h-6 rounded-md border-2 flex items-center justify-center',
            'transition-all duration-150 z-10',
            isChecked
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100',
            checkboxColor,
          )}
          aria-label={
            isDeleteMode
              ? isDeleteSelected ? 'Deselect for deletion' : 'Select for deletion'
              : isExportSelected ? 'Deselect for export' : 'Select for export'
          }
        >
          {isChecked && '✓'}
        </button>

        {/* Trash icon — visible on hover, only when NOT in delete mode */}
        {!isDeleteMode && (
          <button
            onClick={handleTrashClick}
            className={clsx(
              'absolute bottom-4 right-4 w-7 h-7 rounded-md flex items-center justify-center',
              'transition-all duration-150 z-10',
              'opacity-0 group-hover:opacity-100',
              'bg-red-600/10 text-red-400 hover:bg-red-600/20 hover:text-red-300 border border-red-500/20'
            )}
            aria-label="Delete screenplay"
            title="Delete screenplay"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}

        {/* Header: badge → generous gap → full-width title */}
        <div className="mb-5 pr-8">
          <div className="mb-3">
            <RecommendationBadge tier={screenplay.recommendation} />
          </div>
          <h3 className="text-lg font-display text-gold-100 m-0 leading-tight">
            {screenplay.title}
          </h3>
          <p className="text-sm text-black-400 mt-1 mb-0">
            by {screenplay.author}
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="chip chip-genre">{screenplay.genre}</span>
          <span className="chip chip-budget">{screenplay.budgetCategory}</span>
          <span className="chip">{screenplay.collection.replace(' Black List', '')}</span>
          <ProductionBadge tmdbStatus={screenplay.tmdbStatus} compact />

          {/* FILE-01: PDF storage status badge */}
          {pdfBadgeStatus !== 'unknown' && (
            <span
              className={clsx(
                'chip text-xs',
                pdfBadgeStatus === 'found'
                  ? 'border-emerald-500/40 text-emerald-400'
                  : 'border-amber-500/40 text-amber-400'
              )}
              title={pdfBadgeStatus === 'found' ? 'PDF in Storage' : 'PDF missing from Storage'}
            >
              {pdfBadgeStatus === 'found' ? 'PDF ✓' : 'No PDF'}
            </span>
          )}

          {/* FILE-02: Analysis version badge — only shown for legacy */}
          {isLegacyVersion && (
            <span
              className="chip text-xs border-black-600/40 text-black-400"
              title={`Analyzed with ${screenplay.analysisVersion} — re-analyze for current engine`}
            >
              Legacy
            </span>
          )}

          {/* V7: Goosebumps moments indicator */}
          {goosebumpsCount > 0 && (
            <span
              className="chip text-xs border-amber-500/30 text-amber-300"
              title={`${goosebumpsCount} goosebumps moment${goosebumpsCount > 1 ? 's' : ''} identified`}
            >
              ✨ {goosebumpsCount}
            </span>
          )}

          {/* Percentile badge */}
          <PercentileBadge rank={percentileRank} />
        </div>

        {/* Logline */}
        <p className="text-sm text-black-300 leading-relaxed mb-5 line-clamp-2">
          {screenplay.logline}
        </p>

        {/* Scores Grid */}
        {/* Spacer pushes scores to bottom */}
        <div className="flex-1" />

        {(() => {
          const dims = getDimensionDisplay(screenplay);
          const isV7 = dims.length === 5;
          return (
            <div className={isV7 ? 'grid grid-cols-3 gap-x-3 gap-y-2 mb-5' : 'grid grid-cols-2 gap-x-4 gap-y-3 mb-5'}>
              {dims.slice(0, isV7 ? 5 : 4).map((dim) => (
                <ScoreBar
                  key={dim.key}
                  score={dim.score}
                  label={dim.label}
                  compact
                  animate={isRevealed}
                />
              ))}
            </div>
          );
        })()}

        {/* Main Scores */}
        <div className="flex items-center justify-between pt-4 border-t border-black-700">
          <div className="flex items-center gap-5">
            <div>
              <span className="text-[11px] font-semibold tracking-widest uppercase text-black-400 block">Score</span>
              <span className={clsx(
                scoreNumClass,
                getScoreColorClass(Number(screenplay.weightedScore) || 0)
              )}>
                {(Number(screenplay.weightedScore) || 0).toFixed(1)}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-semibold tracking-widest uppercase text-black-400 block">CVS</span>
              {screenplay.commercialViability.cvsAssessed === false ? (
                <span className={`${scoreTextClass} text-black-400 italic`}>N/A</span>
              ) : (
                <span className={clsx(
                  scoreNumClass,
                  getScoreColorClass(Number(screenplay.cvsTotal) || 0, 18)
                )}>
                  {Number(screenplay.cvsTotal) || 0}/18
                </span>
              )}
            </div>
          </div>

          <ProducerMetricsMini screenplay={screenplay} />
        </div>

        {/* Critical Failures Warning */}
        {screenplay.criticalFailures.length > 0 && (
          <div className="mt-3 pt-3 border-t border-red-500/30">
            <span className="text-xs text-red-400 font-medium">
              ⚠ {screenplay.criticalFailures.length} Critical Failure{screenplay.criticalFailures.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </article>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={showDeleteConfirm}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title={`Delete "${screenplay.title}"?`}
        message={`Remove "${screenplay.title}" from the dashboard? You can restore it from Settings > Data.`}
        isPending={deleteMutation.isPending}
      />
    </>
  );
}

export const ScreenplayCard = memo(ScreenplayCardInner);
export default ScreenplayCard;

