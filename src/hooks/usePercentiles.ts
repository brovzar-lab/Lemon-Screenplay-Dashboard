/**
 * usePercentiles — React hook for screenplay percentile rankings.
 *
 * Computes percentile ranks for all screenplays once, memoized,
 * and returns a Map<id, PercentileRank> for efficient lookups.
 *
 * Usage:
 *   const percentiles = usePercentiles();
 *   const rank = percentiles.get(screenplay.id);
 *   // rank.overall → 92, rank.label → "Top 8%", rank.tier → "elite"
 */

import { useMemo } from 'react';
import { useScreenplays } from './useScreenplays';
import { computeAllPercentiles, type PercentileRank } from '@/lib/percentileRanking';

/**
 * Returns a Map of screenplay ID → PercentileRank.
 * Automatically recomputes when the screenplay list changes.
 */
export function usePercentiles(): Map<string, PercentileRank> {
  const { data: screenplays } = useScreenplays();

  return useMemo(() => {
    if (!screenplays || screenplays.length === 0) return new Map();
    return computeAllPercentiles(screenplays);
  }, [screenplays]);
}

/**
 * Returns the percentile rank for a single screenplay by ID.
 * Convenience wrapper — use `usePercentiles()` for bulk lookups.
 */
export function useScreenplayPercentile(id: string | undefined): PercentileRank | null {
  const percentiles = usePercentiles();
  if (!id) return null;
  return percentiles.get(id) ?? null;
}
