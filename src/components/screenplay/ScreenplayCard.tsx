/**
 * ScreenplayCard Component
 * Displays screenplay summary in a card format
 */

import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { RECOMMENDATION_CONFIG } from '@/types';
import { getScoreColorClass, getScoreBarFillClass } from '@/lib/calculations';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import { useComparisonStore, useIsSelectedForComparison, useIsComparisonFull } from '@/stores/comparisonStore';
import { ProductionBadge } from './ProductionBadge';

interface ScreenplayCardProps {
  screenplay: Screenplay;
  onClick?: () => void;
}

/**
 * Score bar component for dimension scores
 */
function ScoreBar({ score, label }: { score: number; label: string }) {
  // Defensive: ensure score is a valid number
  const safeScore = typeof score === 'number' && !isNaN(score) ? score : 0;
  const percentage = (safeScore / 10) * 100;
  const colorClass = getScoreBarFillClass(safeScore);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-black-400">{label}</span>
        <span className={clsx('text-xs font-mono font-bold', getScoreColorClass(safeScore))}>
          {safeScore.toFixed(1)}
        </span>
      </div>
      <div className="score-bar">
        <div
          className={clsx('score-bar-fill', colorClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Recommendation badge
 */
function RecommendationBadge({ tier }: { tier: Screenplay['recommendation'] }) {
  const config = RECOMMENDATION_CONFIG[tier];

  return (
    <span
      className={clsx(
        'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide',
        tier === 'film_now' && 'badge-film-now animate-pulse-glow',
        tier === 'recommend' && 'badge-recommend',
        tier === 'consider' && 'badge-consider',
        tier === 'pass' && 'badge-pass'
      )}
    >
      {config.label}
    </span>
  );
}

/**
 * Producer metrics mini display (dashboard heuristics, not AI-assessed)
 */
function ProducerMetricsMini({ screenplay }: { screenplay: Screenplay }) {
  // Defensive: ensure producerMetrics exists and has valid values
  const metrics = screenplay.producerMetrics || {
    marketPotential: 5,
    roiIndicator: 3,
    festivalAppeal: 5,
  };

  const marketPotential = metrics.marketPotential ?? 5;
  const festivalAppeal = metrics.festivalAppeal ?? 5;
  // Ensure roiIndicator is a valid integer between 1-5 for .repeat()
  const roiIndicator = Math.min(5, Math.max(1, Math.floor(metrics.roiIndicator ?? 3)));

  return (
    <div className="flex gap-4 text-xs">
      <div className="flex items-center gap-1" title="Dashboard estimate — not AI-assessed">
        <span className="text-black-500">Mkt<span className="text-black-600"> est.</span></span>
        <span className={clsx('font-mono font-bold', getScoreColorClass(marketPotential))}>
          {marketPotential}
        </span>
      </div>
      <div className="flex items-center gap-1" title="Dashboard estimate — not AI-assessed">
        <span className="text-black-500">ROI<span className="text-black-600"> est.</span></span>
        <span className="text-gold-400">
          {'★'.repeat(roiIndicator)}
          {'☆'.repeat(5 - roiIndicator)}
        </span>
      </div>
      <div className="flex items-center gap-1" title="Dashboard estimate — not AI-assessed">
        <span className="text-black-500">Fest.<span className="text-black-600"> est.</span></span>
        <span className={clsx('font-mono font-bold', getScoreColorClass(festivalAppeal))}>
          {festivalAppeal}
        </span>
      </div>
    </div>
  );
}

export function ScreenplayCard({ screenplay, onClick }: ScreenplayCardProps) {
  const toggleComparison = useComparisonStore((s) => s.toggleComparison);
  const isSelected = useIsSelectedForComparison(screenplay.id);
  const isFull = useIsComparisonFull();

  const handleCompareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleComparison(screenplay.id);
  };

  return (
    <article
      onClick={onClick}
      className={clsx(
        'card cursor-pointer relative group',
        screenplay.isFilmNow && 'card-film-now'
      )}
    >
      {/* Comparison checkbox */}
      <button
        onClick={handleCompareClick}
        disabled={!isSelected && isFull}
        className={clsx(
          'absolute top-4 right-4 w-6 h-6 rounded-md border-2 flex items-center justify-center',
          'transition-all duration-150',
          isSelected
            ? 'bg-gold-500 border-gold-400 text-black-950'
            : 'border-black-600 text-transparent hover:border-gold-500',
          !isSelected && isFull && 'opacity-50 cursor-not-allowed'
        )}
        aria-label={isSelected ? 'Remove from comparison' : 'Add to comparison'}
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
        <span className="chip" style={{ borderColor: 'var(--color-violet-500)', color: 'var(--color-violet-500)' }}>
          {screenplay.genre}
        </span>
        <span className="chip" style={{ borderColor: 'var(--color-amber-500)', color: 'var(--color-amber-500)' }}>
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
