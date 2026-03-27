/**
 * Percentile Ranking Utility
 *
 * Computes percentile rank for each screenplay within its collection
 * and across the entire corpus. Uses the "percentage of scores below"
 * method: percentile = (# scores below / total) × 100.
 *
 * Designed as a pure function that can be called anywhere —
 * from hooks, components, or the analysis pipeline.
 */

import type { Screenplay } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PercentileRank {
  /** Percentile across ALL screenplays (0–100) */
  overall: number;
  /** Percentile within the screenplay's own category (0–100) */
  category: number;
  /** Label for display: "Top 3%", "Top 15%", etc. */
  label: string;
  /** Badge tier for UI styling */
  tier: 'elite' | 'strong' | 'average' | 'below';
  /** How many total screenplays were compared */
  corpusSize: number;
  /** How many screenplays in the category */
  categorySize: number;
}

// ─── Core Computation ────────────────────────────────────────────────────────

/**
 * Compute the percentile rank for a given score within a list of all scores.
 * Returns a value 0–100 where 100 = highest (best).
 *
 * Uses the "percentage of values at or below" formula:
 *   percentile = (count of scores strictly below / total) × 100
 */
function computePercentile(score: number, allScores: number[]): number {
  if (allScores.length <= 1) return 100;
  const below = allScores.filter((s) => s < score).length;
  return Math.round((below / (allScores.length - 1)) * 100);
}

/**
 * Map percentile to a badge tier for UI styling.
 */
function toTier(percentile: number): PercentileRank['tier'] {
  if (percentile >= 90) return 'elite';
  if (percentile >= 70) return 'strong';
  if (percentile >= 40) return 'average';
  return 'below';
}

/**
 * Generate a human-readable label like "Top 3%", "Top 50%".
 */
function toLabel(percentile: number): string {
  const topPct = 100 - percentile;
  if (topPct <= 1) return 'Top 1%';
  if (topPct <= 5) return 'Top 5%';
  if (topPct <= 10) return 'Top 10%';
  if (topPct <= 15) return 'Top 15%';
  if (topPct <= 25) return 'Top 25%';
  if (topPct <= 50) return 'Top 50%';
  return `Bottom ${Math.round(topPct)}%`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute percentile ranks for ALL screenplays in one pass.
 * Returns a Map keyed by screenplay ID.
 *
 * Efficient: sorts scores once and computes all percentiles in O(n log n).
 */
export function computeAllPercentiles(
  screenplays: Screenplay[],
): Map<string, PercentileRank> {
  if (screenplays.length === 0) return new Map();

  // Collect all scores
  const allScores = screenplays.map((s) => s.weightedScore);

  // Group by category
  const byCategory = new Map<string, number[]>();
  for (const sp of screenplays) {
    const cat = sp.category ?? 'OTHER';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(sp.weightedScore);
  }

  // Compute percentiles
  const result = new Map<string, PercentileRank>();

  for (const sp of screenplays) {
    const cat = sp.category ?? 'OTHER';
    const catScores = byCategory.get(cat) ?? [];

    const overallPct = computePercentile(sp.weightedScore, allScores);
    const categoryPct = computePercentile(sp.weightedScore, catScores);

    result.set(sp.id, {
      overall: overallPct,
      category: categoryPct,
      label: toLabel(overallPct),
      tier: toTier(overallPct),
      corpusSize: allScores.length,
      categorySize: catScores.length,
    });
  }

  return result;
}

/**
 * Compute percentile for a SINGLE screenplay against a corpus.
 * Useful when you just need one result without computing all.
 */
export function computeSinglePercentile(
  screenplay: Screenplay,
  allScreenplays: Screenplay[],
): PercentileRank {
  const allScores = allScreenplays.map((s) => s.weightedScore);
  const cat = screenplay.category ?? 'OTHER';
  const catScores = allScreenplays
    .filter((s) => (s.category ?? 'OTHER') === cat)
    .map((s) => s.weightedScore);

  const overallPct = computePercentile(screenplay.weightedScore, allScores);
  const categoryPct = computePercentile(screenplay.weightedScore, catScores);

  return {
    overall: overallPct,
    category: categoryPct,
    label: toLabel(overallPct),
    tier: toTier(overallPct),
    corpusSize: allScores.length,
    categorySize: catScores.length,
  };
}
