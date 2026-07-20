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
import { canonicalizeGenre } from './calculations';

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
  /** Exact position across the full slate, where 1 is best */
  overallPosition: number;
  /** Exact position among screenplays in the same genre */
  genrePosition: number;
  /** How many screenplays share this genre */
  genreSize: number;
  /** Genre used for the position comparison */
  genre: string;
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
  let low = 0;
  let high = allScores.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (allScores[mid] < score) low = mid + 1;
    else high = mid;
  }
  const below = low;
  return Math.round((below / (allScores.length - 1)) * 100);
}

function normalizeScore(score: number): number {
  return Number.isFinite(score) ? score : 0;
}

function scorePositions(scores: number[]): Map<number, number> {
  const sorted = [...scores].sort((a, b) => b - a);
  const positions = new Map<number, number>();
  sorted.forEach((score, index) => {
    if (!positions.has(score)) positions.set(score, index + 1);
  });
  return positions;
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
  if (percentile >= 99) return 'Top 1%';
  if (percentile >= 95) return 'Top 5%';
  if (percentile >= 90) return 'Top 10%';
  if (percentile >= 85) return 'Top 15%';
  if (percentile >= 75) return 'Top 25%';
  if (percentile >= 50) return 'Top 50%';
  if (percentile >= 25) return 'Bottom 50%';
  if (percentile >= 10) return 'Bottom 25%';
  return 'Bottom 10%';
}

function genreKey(screenplay: Screenplay): string {
  return canonicalizeGenre(screenplay.genre) || 'unknown genre';
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
  const allScores = screenplays.map((s) => normalizeScore(s.weightedScore)).sort((a, b) => a - b);
  const overallPositions = scorePositions(allScores);

  // Group by category
  const byCategory = new Map<string, number[]>();
  const byGenre = new Map<string, number[]>();
  for (const sp of screenplays) {
    const cat = sp.category ?? 'OTHER';
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(normalizeScore(sp.weightedScore));

    const genre = genreKey(sp);
    if (!byGenre.has(genre)) byGenre.set(genre, []);
    byGenre.get(genre)!.push(normalizeScore(sp.weightedScore));
  }
  byCategory.forEach((scores) => scores.sort((a, b) => a - b));
  byGenre.forEach((scores) => scores.sort((a, b) => a - b));
  const genrePositions = new Map(
    Array.from(byGenre, ([genre, scores]) => [genre, scorePositions(scores)]),
  );

  // Compute percentiles
  const result = new Map<string, PercentileRank>();

  for (const sp of screenplays) {
    const cat = sp.category ?? 'OTHER';
    const catScores = byCategory.get(cat) ?? [];
    const genre = genreKey(sp);
    const genreScores = byGenre.get(genre) ?? [];
    const score = normalizeScore(sp.weightedScore);

    const overallPct = computePercentile(score, allScores);
    const categoryPct = computePercentile(score, catScores);

    result.set(sp.id, {
      overall: overallPct,
      category: categoryPct,
      label: toLabel(overallPct),
      tier: toTier(overallPct),
      corpusSize: allScores.length,
      categorySize: catScores.length,
      overallPosition: overallPositions.get(score) ?? allScores.length,
      genrePosition: genrePositions.get(genre)?.get(score) ?? genreScores.length,
      genreSize: genreScores.length,
      genre: sp.genre.trim() || 'Unknown Genre',
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
  const allScores = allScreenplays.map((s) => normalizeScore(s.weightedScore)).sort((a, b) => a - b);
  const cat = screenplay.category ?? 'OTHER';
  const catScores = allScreenplays
    .filter((s) => (s.category ?? 'OTHER') === cat)
    .map((s) => normalizeScore(s.weightedScore))
    .sort((a, b) => a - b);
  const genre = genreKey(screenplay);
  const genreScores = allScreenplays
    .filter((s) => genreKey(s) === genre)
    .map((s) => normalizeScore(s.weightedScore))
    .sort((a, b) => a - b);
  const score = normalizeScore(screenplay.weightedScore);

  const overallPct = computePercentile(score, allScores);
  const categoryPct = computePercentile(score, catScores);

  return {
    overall: overallPct,
    category: categoryPct,
    label: toLabel(overallPct),
    tier: toTier(overallPct),
    corpusSize: allScores.length,
    categorySize: catScores.length,
    overallPosition: scorePositions(allScores).get(score) ?? allScores.length,
    genrePosition: scorePositions(genreScores).get(score) ?? genreScores.length,
    genreSize: genreScores.length,
    genre: screenplay.genre.trim() || 'Unknown Genre',
  };
}
