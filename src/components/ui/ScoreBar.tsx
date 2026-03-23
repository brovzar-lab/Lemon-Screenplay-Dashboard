import { clsx } from 'clsx';
import { getScoreColorClass, getScoreBarFillClass } from '@/lib/calculations';
import { toNumber } from '@/lib/utils';
import { useCountUp, hasCardAnimated, markCardAnimated } from '../../hooks/useCountUp';

interface ScoreBarProps {
  label: string;
  score: number;
  max?: number;
  /** Compact mode for cards (smaller height, no justification support) */
  compact?: boolean;
  showJustification?: boolean;
  justification?: string;
  /** Animate bar width from 0 to final value on mount/trigger */
  animate?: boolean;
  /** Card ID for fire-once animation tracking (skip re-animation on re-mount) */
  cardId?: string;
}

export function ScoreBar({
  label,
  score,
  max = 10,
  compact = false,
  showJustification,
  justification,
  animate,
  cardId,
}: ScoreBarProps) {
  const safeScore = toNumber(score);

  // Fire-once gating: if this card already animated, skip animation entirely
  const alreadyAnimated = cardId ? hasCardAnimated(cardId) : false;
  const shouldAnimate = (animate ?? false) && !alreadyAnimated;

  const animatedScore = useCountUp(safeScore, 600, shouldAnimate);
  const displayScore = shouldAnimate ? animatedScore : safeScore;

  // Mark card as animated once count-up completes
  if (cardId && shouldAnimate && animatedScore >= safeScore && safeScore > 0) {
    markCardAnimated(cardId);
  }
  const displayWidth = `${(displayScore / max) * 100}%`;
  const colorClass = getScoreBarFillClass(safeScore, max);

  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <span className="text-xs text-black-400">{label}</span>
          <span className={clsx('text-xs font-mono font-bold', getScoreColorClass(safeScore, max))}>
            {safeScore.toFixed(1)}
          </span>
        </div>
        <div className="score-bar">
          <div
            className={clsx('score-bar-fill', colorClass)}
            style={{ width: displayWidth }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm text-black-300">{label}</span>
        <span className={clsx('text-sm font-mono font-bold', getScoreColorClass(safeScore, max))}>
          {safeScore.toFixed(1)}/{max}
        </span>
      </div>
      <div className="score-bar h-2">
        <div
          className={clsx('score-bar-fill', colorClass)}
          style={{ width: displayWidth }}
        />
      </div>
      {showJustification && justification && (
        <p className="text-xs text-black-500 mt-1 italic">{justification}</p>
      )}
    </div>
  );
}
