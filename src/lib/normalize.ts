/**
 * Data Normalization
 * Converts raw V3 JSON analysis to normalized Screenplay objects
 */

import type {
  RawScreenplayAnalysis,
  RawTmdbStatus,
  Screenplay,
  Collection,
  RecommendationTier,
  BudgetCategory,
  FilmNowAssessment,
  DimensionScores,
  DimensionJustifications,
  CommercialViability,
  TmdbStatus,
} from '@/types';

import { calculateProducerMetrics } from './calculations';

/**
 * Generate a unique ID from filename
 */
function generateId(filename: string): string {
  // Remove extension and special characters, create URL-safe ID
  return filename
    .replace(/\.pdf$|\.json$/i, '')
    .replace(/_analysis_v3$/i, '')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 100);
}

/**
 * Normalize recommendation string to tier enum
 */
function normalizeRecommendation(recommendation: string): RecommendationTier {
  const lower = recommendation.toLowerCase().replace(/[\s_-]/g, '');

  if (lower.includes('filmnow')) return 'film_now';
  if (lower.includes('recommend')) return 'recommend';
  if (lower.includes('consider')) return 'consider';
  return 'pass';
}

/**
 * Extract budget category from raw budget tier
 * Handles formats like "low ($10-50M)" or just "low"
 */
function extractBudgetCategory(rawCategory: string): BudgetCategory {
  const lower = rawCategory.toLowerCase();

  if (lower.includes('micro')) return 'micro';
  if (lower.includes('low')) return 'low';
  if (lower.includes('medium') || lower.includes('mid')) return 'medium';
  if (lower.includes('high')) return 'high';
  return 'unknown';
}

/**
 * Safely convert a value to a number
 */
function toNumber(value: unknown, defaultValue = 0): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

/**
 * Normalize dimension scores from raw to app format
 */
function normalizeDimensionScores(raw: RawScreenplayAnalysis['analysis']['dimension_scores']): DimensionScores {
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
function extractDimensionJustifications(raw: RawScreenplayAnalysis['analysis']['dimension_scores']): DimensionJustifications {
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
function normalizeCommercialViability(raw: RawScreenplayAnalysis['analysis']['commercial_viability']): CommercialViability {
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
  };
}

/**
 * Normalize film now assessment
 */
function normalizeFilmNowAssessment(raw?: RawScreenplayAnalysis['analysis']['film_now_assessment']): FilmNowAssessment | null {
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
function normalizeTmdbStatus(raw?: RawTmdbStatus): TmdbStatus | null {
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

/**
 * Main normalization function
 * Converts raw JSON to normalized Screenplay object
 */
export function normalizeScreenplay(
  raw: RawScreenplayAnalysis,
  collection: Collection
): Screenplay {
  const analysis = raw.analysis;
  const recommendation = normalizeRecommendation(analysis.assessment.recommendation);
  const isFilmNow = recommendation === 'film_now';
  const budgetCategory = extractBudgetCategory(analysis.budget_tier.category);

  // Build the base screenplay object (without producer metrics and tmdbStatus first)
  const baseScreenplay: Omit<Screenplay, 'producerMetrics' | 'tmdbStatus'> = {
    id: generateId(raw.source_file),
    title: analysis.title,
    author: analysis.author,
    collection,
    sourceFile: raw.source_file,
    analysisModel: raw.analysis_model,
    analysisVersion: raw.analysis_version,
    weightedScore: typeof analysis.dimension_scores.weighted_score === 'string'
      ? parseFloat(analysis.dimension_scores.weighted_score) || 0
      : analysis.dimension_scores.weighted_score || 0,
    cvsTotal: typeof analysis.commercial_viability.cvs_total === 'string'
      ? parseInt(analysis.commercial_viability.cvs_total, 10) || 0
      : analysis.commercial_viability.cvs_total || 0,
    genre: analysis.genre,
    subgenres: analysis.subgenres || [],
    themes: analysis.themes || [],
    logline: analysis.logline,
    tone: analysis.tone,
    recommendation,
    recommendationRationale: analysis.assessment.recommendation_rationale,
    verdictStatement: analysis.verdict_statement,
    isFilmNow,
    filmNowAssessment: normalizeFilmNowAssessment(analysis.film_now_assessment),
    dimensionScores: normalizeDimensionScores(analysis.dimension_scores),
    dimensionJustifications: extractDimensionJustifications(analysis.dimension_scores),
    commercialViability: normalizeCommercialViability(analysis.commercial_viability),
    criticalFailures: analysis.critical_failures || [],
    majorWeaknesses: analysis.major_weaknesses || [],
    strengths: analysis.assessment.strengths || [],
    weaknesses: analysis.assessment.weaknesses || [],
    developmentNotes: analysis.assessment.development_notes || [],
    marketability: analysis.assessment.marketability,
    budgetCategory,
    budgetJustification: analysis.budget_tier.justification,
    characters: {
      protagonist: analysis.characters.protagonist,
      antagonist: analysis.characters.antagonist,
      supporting: analysis.characters.supporting || [],
    },
    structureAnalysis: {
      formatQuality: analysis.structure_analysis.format_quality,
      actBreaks: analysis.structure_analysis.act_breaks,
      pacing: analysis.structure_analysis.pacing,
    },
    comparableFilms: (analysis.comparable_films || []).map((film) => ({
      title: film.title,
      similarity: film.similarity,
      boxOfficeRelevance: film.box_office_relevance,
    })),
    standoutScenes: (analysis.standout_scenes || []).map((scene) => ({
      scene: scene.scene,
      why: scene.why,
    })),
    targetAudience: {
      primaryDemographic: analysis.target_audience.primary_demographic,
      genderSkew: analysis.target_audience.gender_skew,
      interests: analysis.target_audience.interests || [],
    },
    metadata: {
      filename: raw.metadata.filename,
      pageCount: raw.metadata.page_count,
      wordCount: raw.metadata.word_count,
    },
  };

  // Calculate producer metrics using the base screenplay data
  const producerMetrics = calculateProducerMetrics(baseScreenplay as Screenplay);

  // Normalize TMDB status if present
  const tmdbStatus = normalizeTmdbStatus(raw.tmdb_status);

  return {
    ...baseScreenplay,
    producerMetrics,
    tmdbStatus,
  };
}

/**
 * Batch normalize screenplays
 */
export function normalizeScreenplays(
  rawData: RawScreenplayAnalysis[],
  collection: Collection
): Screenplay[] {
  return rawData.map((raw) => normalizeScreenplay(raw, collection));
}
