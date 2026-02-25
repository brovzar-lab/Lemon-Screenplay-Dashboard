/**
 * ScreenplayCard Component
 * Displays screenplay summary in a card format
 */

// ... imports ...
import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { getScoreColorClass } from '@/lib/calculations';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import { useExportSelectionStore, useIsSelectedForExport } from '@/stores/exportSelectionStore';
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
  const toggleSelection = useExportSelectionStore((s) => s.toggle);
  const isSelected = useIsSelectedForExport(screenplay.id);

  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSelection(screenplay.id);
  };

  return (
    <article
      onClick={onClick}
      className={clsx(
        'card cursor-pointer relative group',
        screenplay.isFilmNow && 'card-film-now'
      )}
    >
      {/* Selection checkbox */}
      <button
        onClick={handleSelectClick}
        className={clsx(
          'absolute top-4 right-4 w-6 h-6 rounded-md border-2 flex items-center justify-center',
          'transition-all duration-150',
          isSelected
            ? 'bg-gold-500 border-gold-400 text-black-950'
            : 'border-black-600 text-transparent hover:border-gold-500',
        )}
        aria-label={isSelected ? 'Deselect for export' : 'Select for export'}
      >
        {isSelected && '✓'}
      </button>

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
  );
}

export default ScreenplayCard;
