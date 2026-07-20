/**
 * PercentileBadge — Displays a screenplay's percentile ranking as a compact badge.
 *
 * Tiers:
 *   elite  (≥90th) → gold badge with glow
 *   strong (70-89th) → emerald badge
 *   average/below    → no badge (returns null)
 */

import { clsx } from 'clsx';
import type { PercentileRank } from '@/lib/percentileRanking';

interface PercentileBadgeProps {
  rank: PercentileRank | null | undefined;
  /** Show label like "Top 5%" */
  showLabel?: boolean;
  showAll?: boolean;
  className?: string;
}

export function PercentileBadge({ rank, showLabel = true, showAll = false, className }: PercentileBadgeProps) {
  if (!rank) return null;

  // Only show badge for elite and strong tiers
  if (!showAll && rank.tier !== 'elite' && rank.tier !== 'strong') return null;

  const isElite = rank.tier === 'elite';

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold',
        isElite
          ? 'bg-gold-500/20 text-gold-300 border border-gold-500/40 shadow-[0_0_6px_rgba(234,179,8,0.2)]'
          : rank.tier === 'strong'
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : 'bg-black-700/50 text-black-300 border border-black-600/50',
        className,
      )}
      title={`#${rank.overallPosition} of ${rank.corpusSize} overall`}
    >
      {showLabel && <span>{rank.label}</span>}
    </span>
  );
}
