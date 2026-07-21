/**
 * Shared normalization helpers
 * Internal utilities used by the V9 normalizer (normalizeV9.ts).
 */

import type {
  RawTmdbStatus,
  RecommendationTier,
  TmdbStatus,
} from '@/types';

/**
 * Generate a unique ID from filename
 */
export function generateId(filename: string): string {
  // Remove extension and analysis version suffixes, create URL-safe ID
  return String(filename || '')
    .replace(/\.pdf$|\.json$/i, '')
    .replace(/_analysis_v[3456]$/i, '')  // Old export filenames carried V3-V6 suffixes
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 100) || `id_${Date.now()}`;
}

/**
 * Normalize recommendation string to tier enum
 */
export function normalizeRecommendation(recommendation: string): RecommendationTier {
  const lower = String(recommendation || '').toLowerCase().replace(/[\s_-]/g, '');

  if (lower.includes('filmnow')) return 'film_now';
  if (lower.includes('recommend')) return 'recommend';
  if (lower.includes('consider')) return 'consider';
  return 'pass';
}

/**
 * Normalize TMDB production status
 */
export function normalizeTmdbStatus(raw?: RawTmdbStatus): TmdbStatus | null {
  if (!raw) return null;

  return {
    isProduced: raw.is_produced,
    tmdbId: raw.tmdb_id,
    tmdbTitle: raw.tmdb_title,
    releaseDate: raw.release_date,
    status: raw.status,
    checkedAt: raw.checked_at,
    confidence: raw.confidence,
  };
}
