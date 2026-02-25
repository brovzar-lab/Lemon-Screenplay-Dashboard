/**
 * Producer Metrics & Score Utilities
 *
 * Market Potential and USP Strength are now AI-analyzed (returned from the
 * V6 prompt). This module provides:
 * - `createProducerMetrics` — builds a ProducerMetrics from AI data or null
 * - Genre canonical map for consistent matching across the app
 * - Score color/class utilities
 */

import type {
  ProducerMetrics,
  USPStrength,
} from '@/types';

// ─── GENRE CANONICAL MAP ────────────────────────────────────────────────────

/**
 * Canonical genre map — normalizes common variants to a canonical key.
 * Handles "Sci-Fi", "Science Fiction", "science-fiction" etc. all resolving
 * to the same canonical entry.
 */
export const GENRE_CANONICAL_MAP: Record<string, string> = {
  'sci-fi': 'sci-fi',
  'science fiction': 'sci-fi',
  'science-fiction': 'sci-fi',
  'scifi': 'sci-fi',
  'biopic': 'biography',
  'biographical': 'biography',
  'biography': 'biography',
  'indie': 'independent',
  'independent': 'independent',
  'arthouse': 'art house',
  'art house': 'art house',
  'art-house': 'art house',
  'film-noir': 'film-noir',
  'film noir': 'film-noir',
  'dark comedy': 'dark comedy',
  'black comedy': 'dark comedy',
};

/**
 * Canonicalize a genre string for matching.
 * Maps common genre variants to a consistent lowercase key.
 */
export function canonicalizeGenre(genre: string): string {
  const lower = String(genre || '').toLowerCase().trim();
  return GENRE_CANONICAL_MAP[lower] ?? lower;
}

// ─── PRODUCER METRICS ───────────────────────────────────────────────────────

/**
 * Build producer metrics from AI-analyzed data.
 * Returns null values for fields that haven't been analyzed yet.
 */
export function createProducerMetrics(
  aiData?: {
    marketPotential?: number | null;
    marketPotentialRationale?: string | null;
    uspStrength?: USPStrength | null;
    uspStrengthRationale?: string | null;
  }
): ProducerMetrics {
  return {
    marketPotential: aiData?.marketPotential ?? null,
    marketPotentialRationale: aiData?.marketPotentialRationale ?? null,
    uspStrength: aiData?.uspStrength ?? null,
    uspStrengthRationale: aiData?.uspStrengthRationale ?? null,
  };
}

// ─── SCORE COLOR UTILITIES ──────────────────────────────────────────────────

/**
 * Get score color class based on value
 */
export function getScoreColorClass(score: number, max: number = 10): string {
  const percentage = score / max;
  if (percentage >= 0.7) return 'score-excellent';
  if (percentage >= 0.5) return 'score-good';
  return 'score-poor';
}

/**
 * Get score bar fill class based on value
 */
export function getScoreBarFillClass(score: number, max: number = 10): string {
  const percentage = score / max;
  if (percentage >= 0.7) return 'score-bar-fill-excellent';
  if (percentage >= 0.5) return 'score-bar-fill-good';
  return 'score-bar-fill-poor';
}
