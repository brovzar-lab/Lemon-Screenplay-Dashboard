import { clsx } from 'clsx';
import { getScoreColorClass, getScoreBarFillClass } from '@/lib/calculations';
import { toNumber } from '@/lib/utils';

interface ScoreBarProps {
  label: string;
  score: number;
  max?: number;
  /** Compact mode for cards (smaller height, no justification support) */
  compact?: boolean;
  showJustification?: boolean;
  justification?: string;
}

export function ScoreBar({
  label,
  score,
  max = 10,
  compact = false,
  showJustification,
  justification,
}: ScoreBarProps) {
  const safeScore = toNumber(score);
  const percentage = (safeScore / max) * 100;
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
            style={{ width: `${percentage}%` }}
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
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showJustification && justification && (
        <p className="text-xs text-black-500 mt-1 italic">{justification}</p>
      )}
    </div>
  );
}
