/**
 * usePercentiles — React hook for screenplay percentile rankings.
 *
 * Computes percentile ranks for all screenplays once, memoized,
 * and returns a Map<id, PercentileRank> for efficient lookups.
 *
 * Usage:
 *   const percentiles = usePercentiles(screenplays);
 *   const rank = percentiles.get(screenplay.id);
 *   // rank.overall → 92, rank.label → "Top 8%", rank.tier → "elite"
 */

import { useMemo } from 'react';
import { useScreenplays } from './useScreenplays';
import { computeAllPercentiles, type PercentileRank } from '@/lib/percentileRanking';
import type { Screenplay } from '@/types';

/**
 * Returns a Map of screenplay ID → PercentileRank.
 * Automatically recomputes when the screenplay list changes.
 */
export function usePercentiles(screenplays: Screenplay[]): Map<string, PercentileRank> {
  return useMemo(() => {
    if (screenplays.length === 0) return new Map();
    return computeAllPercentiles(screenplays);
  }, [screenplays]);
}

/**
 * Returns the percentile rank for a single screenplay by ID.
 * Convenience wrapper — use `usePercentiles(screenplays)` for bulk lookups.
 */
export function useScreenplayPercentile(id: string | undefined): PercentileRank | null {
  const { data: screenplays = [] } = useScreenplays();
  const percentiles = usePercentiles(screenplays);
  if (!id) return null;
  return percentiles.get(id) ?? null;
}
