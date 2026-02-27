/**
 * ScreenplayCard Component
 * Displays screenplay summary in a card format
 */

// ... imports ...
import { useState } from 'react';
import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { getScoreColorClass } from '@/lib/calculations';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import { useExportSelectionStore, useIsSelectedForExport } from '@/stores/exportSelectionStore';
import { useDeleteSelectionStore, useIsSelectedForDelete } from '@/stores/deleteSelectionStore';
import { useDeleteScreenplays } from '@/hooks/useScreenplays';
import { DeleteConfirmDialog } from '@/components/ui/DeleteConfirmDialog';
import { ProductionBadge } from './ProductionBadge';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { ScoreBar } from '@/components/ui/ScoreBar';

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
        <span className="text-black-500">Mkt</span>
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

export function ScreenplayCard({ screenplay, onClick }: ScreenplayCardProps) {
  const toggleExportSelection = useExportSelectionStore((s) => s.toggle);
  const isExportSelected = useIsSelectedForExport(screenplay.id);
  const isDeleteMode = useDeleteSelectionStore((s) => s.isDeleteMode);
  const toggleDeleteSelection = useDeleteSelectionStore((s) => s.toggle);
  const isDeleteSelected = useIsSelectedForDelete(screenplay.id);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteMutation = useDeleteScreenplays();

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
        onClick={onClick}
        className={clsx(
          'card cursor-pointer relative group',
          screenplay.isFilmNow && 'card-film-now',
          isDeleteMode && isDeleteSelected && 'ring-2 ring-red-500/50'
        )}
      >
        {/* Selection checkbox (export or delete mode) */}
        <button
          onClick={handleSelectClick}
          className={clsx(
            'absolute top-4 right-4 w-6 h-6 rounded-md border-2 flex items-center justify-center',
            'transition-all duration-150 z-10',
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

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4 pr-8">
          <div>
            <h3 className="text-lg font-display text-gold-100 m-0 line-clamp-1">
              {screenplay.title}
            </h3>
            <p className="text-sm text-black-400 m-0">
              by {screenplay.author}
            </p>
          </div>
          <RecommendationBadge tier={screenplay.recommendation} />
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="chip chip-genre">
            {screenplay.genre}
          </span>
          <span className="chip chip-budget">
            {screenplay.budgetCategory}
          </span>
          <span className="chip">
            {screenplay.collection.replace(' Black List', '')}
          </span>
          <ProductionBadge tmdbStatus={screenplay.tmdbStatus} compact />
        </div>

        {/* Logline */}
        <p className="text-sm text-black-300 mb-4 line-clamp-2">
          {screenplay.logline}
        </p>

        {/* Scores Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {getDimensionDisplay(screenplay).slice(0, 4).map((dim) => (
            <ScoreBar
              key={dim.key}
              score={dim.score}
              label={dim.label}
              compact
            />
          ))}
        </div>

        {/* Main Scores */}
        <div className="flex items-center justify-between pt-4 border-t border-black-700">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-black-500 block">Score</span>
              <span className={clsx(
                'font-mono text-xl font-bold',
                getScoreColorClass(Number(screenplay.weightedScore) || 0)
              )}>
                {(Number(screenplay.weightedScore) || 0).toFixed(1)}
              </span>
            </div>
            <div>
              <span className="text-xs text-black-500 block">CVS</span>
              {screenplay.commercialViability.cvsAssessed === false ? (
                <span className="text-sm text-black-500 italic">N/A</span>
              ) : (
                <span className={clsx(
                  'font-mono text-xl font-bold',
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
        message={`This will permanently remove the analysis for "${screenplay.title}" from your database.`}
        isPending={deleteMutation.isPending}
      />
    </>
  );
}

export default ScreenplayCard;

