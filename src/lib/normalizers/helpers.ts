/**
 * Shared normalization helpers
 * Internal utilities used by the V9 normalizer (and backward-compat V6/V7/V8 paths).
 */

import type {
  RawScreenplayAnalysis,
  RawTmdbStatus,
  RecommendationTier,
  BudgetCategory,
  FilmNowAssessment,
  DimensionScores,
  DimensionJustifications,
  CommercialViability,
  TmdbStatus,
  CriticalFailureDetail,
  USPStrength,
} from '@/types';

import { toNumber } from '../utils';

/**
 * Generate a unique ID from filename
 */
export function generateId(filename: string): string {
  // Remove extension and analysis version suffixes, create URL-safe ID
  return String(filename || '')
    .replace(/\.pdf$|\.json$/i, '')
    .replace(/_analysis_v[3456]$/i, '')  // Handle V3, V4, V5, V6 suffixes
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
 * Extract budget category from raw budget tier
 * Handles formats like "low ($10-50M)" or just "low"
 */
export function extractBudgetCategory(rawCategory: string): BudgetCategory {
  const lower = String(rawCategory || '').toLowerCase();

  if (lower.includes('micro')) return 'micro';
  if (lower.includes('low')) return 'low';
  if (lower.includes('medium') || lower.includes('mid')) return 'medium';
  if (lower.includes('high')) return 'high';
  return 'unknown';
}

/**
 * Normalize dimension scores from raw to app format
 */
export function normalizeDimensionScores(raw: RawScreenplayAnalysis['analysis']['dimension_scores']): DimensionScores {
  return {
    concept: toNumber(raw.concept?.score),
    structure: toNumber(raw.structure?.score),
    protagonist: toNumber(raw.protagonist?.score),
    supportingCast: toNumber(raw.supporting_cast?.score),
    dialogue: toNumber(raw.dialogue?.score),
    genreExecution: toNumber(raw.genre_execution?.score),
    originality: toNumber(raw.originality?.score),
    weightedScore: toNumber(raw.weighted_score),
  };
}

/**
 * Extract dimension justifications
 */
export function extractDimensionJustifications(raw: RawScreenplayAnalysis['analysis']['dimension_scores']): DimensionJustifications {
  return {
    concept: raw.concept.justification,
    structure: raw.structure.justification,
    protagonist: raw.protagonist.justification,
    supportingCast: raw.supporting_cast.justification,
    dialogue: raw.dialogue.justification,
    genreExecution: raw.genre_execution.justification,
    originality: raw.originality.justification,
  };
}

/**
 * Normalize commercial viability
 */
export function normalizeCommercialViability(raw: RawScreenplayAnalysis['analysis']['commercial_viability']): CommercialViability {
  // cvs_total can be a string or number in the JSON, ensure it's a number
  const cvsTotal = typeof raw.cvs_total === 'string' ? parseInt(raw.cvs_total, 10) : raw.cvs_total;

  return {
    targetAudience: { score: raw.target_audience.score, note: raw.target_audience.note },
    highConcept: { score: raw.high_concept.score, note: raw.high_concept.note },
    castAttachability: { score: raw.cast_attachability.score, note: raw.cast_attachability.note },
    marketingHook: { score: raw.marketing_hook.score, note: raw.marketing_hook.note },
    budgetReturnRatio: { score: raw.budget_return_ratio.score, note: raw.budget_return_ratio.note },
    comparableSuccess: { score: raw.comparable_success.score, note: raw.comparable_success.note },
    cvsTotal: cvsTotal || 0,
    cvsAssessed: true,
  };
}

/** Normalize severity string to valid type */
export function normalizeSeverity(s: string): 'minor' | 'moderate' | 'major' | 'critical' {
  const lower = s.toLowerCase();
  if (lower.includes('minor')) return 'minor';
  if (lower.includes('moderate')) return 'moderate';
  if (lower.includes('critical')) return 'critical';
  return 'major';
}

/**
 * Normalize critical failures to consistent format
 * Handles both string[] (old format) and CriticalFailureDetail[] (new V6 format)
 */
export function normalizeCriticalFailures(
  raw: string[] | CriticalFailureDetail[] | unknown[] | undefined,
  totalPenalty?: number
): { failures: string[]; details: CriticalFailureDetail[]; totalPenalty: number } {
  if (!raw || raw.length === 0) {
    return { failures: [], details: [], totalPenalty: 0 };
  }

  // Safety: if the first item is an object (any shape), normalize it
  if (typeof raw[0] === 'object' && raw[0] !== null) {
    const details: CriticalFailureDetail[] = (raw as Record<string, unknown>[]).map((d) => ({
      // AI may use "failure" or "description" for the text
      failure: String(d.failure || d.description || d.type || 'Unknown failure'),
      // AI may use "severity" or "type" for the level
      severity: normalizeSeverity(String(d.severity || d.type || 'major')),
      penalty: typeof d.penalty === 'number' ? d.penalty : -0.5,
      // AI may use "evidence" or "pages"
      evidence: String(d.evidence || d.pages || 'See analysis'),
    }));
    const failures = details.map((d) => d.failure);
    const calculatedPenalty = details.reduce((sum, d) => sum + (d.penalty || 0), 0);
    return {
      failures,
      details,
      totalPenalty: Math.max(totalPenalty ?? calculatedPenalty, -3.0),
    };
  }

  // String[] format — ensure each item is actually a string
  const failures = (raw as unknown[]).map((f) =>
    typeof f === 'string' ? f : String(f)
  );
  return {
    failures,
    details: failures.map((f) => ({
      failure: f,
      severity: 'major' as const,
      penalty: -0.8,
      evidence: 'See analysis',
    })),
    totalPenalty: totalPenalty ?? 0,
  };
}

/** Validate a raw USP assessment string against the known enum values */
export function validateUSPStrength(raw?: string): USPStrength | null {
  if (!raw) return null;
  const normalized = raw.trim();
  if (normalized === 'Weak' || normalized === 'Moderate' || normalized === 'Strong') {
    return normalized;
  }
  // Handle case-insensitive input from AI
  const lower = normalized.toLowerCase();
  if (lower === 'weak') return 'Weak';
  if (lower === 'moderate') return 'Moderate';
  if (lower === 'strong') return 'Strong';
  return null;
}

/**
 * Normalize film now assessment
 */
export function normalizeFilmNowAssessment(raw?: RawScreenplayAnalysis['analysis']['film_now_assessment']): FilmNowAssessment | null {
  if (!raw) return null;

  return {
    qualifies: raw.qualifies,
    lightningTest: raw.lightning_test,
    goosebumpsMoments: raw.goosebumps_moments || [],
    careerRiskTest: raw.career_risk_test || '',
    legacyPotential: raw.legacy_potential || '',
    disqualifyingFactors: raw.disqualifying_factors || [],
  };
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
