/**
 * Data Normalization
 * Converts raw V3/V4/V5/V6 JSON analysis to normalized Screenplay objects
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

import type {
  V6ScreenplayAnalysis,
  V6CoreQuality,
  V6Lenses,
} from '@/types/screenplay-v6';

import { mapV6VerdictToTier } from '@/types/screenplay-v6';

import { calculateProducerMetrics } from './calculations';

/**
 * Generate a unique ID from filename
 */
function generateId(filename: string): string {
  // Remove extension and analysis version suffixes, create URL-safe ID
  return filename
    .replace(/\.pdf$|\.json$/i, '')
    .replace(/_analysis_v[3456]$/i, '')  // Handle V3, V4, V5, V6 suffixes
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

// ============================================
// V6 NORMALIZATION
// ============================================

/**
 * Extended Screenplay type with V6-specific fields
 */
export interface ScreenplayWithV6 extends Screenplay {
  v6CoreQuality?: V6CoreQuality;
  v6Lenses?: V6Lenses;
  v6LensesEnabled?: string[];
  v6BudgetCeilingUsed?: number | null;
  falsePositiveRisk?: 'low' | 'moderate' | 'high' | 'critical';
  trapsTriggered?: number;
}

/**
 * Check if raw data is V6 format
 */
export function isV6RawAnalysis(raw: unknown): raw is V6ScreenplayAnalysis {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  // Support both v6_core_lenses and v6_unified (the merged version)
  return r.analysis_version === 'v6_core_lenses' || r.analysis_version === 'v6_unified';
}

/**
 * Normalize V6 analysis to extended Screenplay object
 */
export function normalizeV6Screenplay(
  raw: V6ScreenplayAnalysis,
  collection: Collection
): ScreenplayWithV6 {
  const analysis = raw.analysis;
  const coreQuality = analysis.core_quality;

  // Map V6 verdict to standard recommendation tier
  const recommendation = mapV6VerdictToTier(coreQuality.verdict);
  const isFilmNow = recommendation === 'film_now';

  // Extract budget category from budget lens if available
  let budgetCategory: BudgetCategory = 'unknown';
  if (analysis.lenses?.budget_tier?.enabled && analysis.lenses.budget_tier.assessment) {
    budgetCategory = analysis.lenses.budget_tier.assessment.category as BudgetCategory;
  }

  // Map V6 dimension scores to legacy format for compatibility
  const dimensionScores: DimensionScores = {
    concept: coreQuality.conceptual_strength?.premise?.score || 0,
    structure: coreQuality.execution_craft?.structure?.score || 0,
    protagonist: coreQuality.character_system?.protagonist?.score || 0,
    supportingCast: coreQuality.character_system?.supporting_cast?.score || 0,
    dialogue: coreQuality.execution_craft?.dialogue?.score || 0,
    genreExecution: coreQuality.voice_and_tone?.score || 0, // Map voice to genre for compat
    originality: coreQuality.conceptual_strength?.theme?.score || 0, // Map theme to originality
    weightedScore: coreQuality.weighted_score,
  };

  // Map V6 justifications to legacy format
  const dimensionJustifications: DimensionJustifications = {
    concept: coreQuality.conceptual_strength?.premise?.justification || '',
    structure: coreQuality.execution_craft?.structure?.justification || '',
    protagonist: coreQuality.character_system?.protagonist?.justification || '',
    supportingCast: coreQuality.character_system?.supporting_cast?.justification || '',
    dialogue: coreQuality.execution_craft?.dialogue?.justification || '',
    genreExecution: coreQuality.voice_and_tone?.justification || '',
    originality: coreQuality.conceptual_strength?.theme?.justification || '',
  };

  // Build commercial viability from lens if available
  let commercialViability: CommercialViability;
  if (analysis.lenses?.commercial_viability?.enabled && analysis.lenses.commercial_viability.assessment) {
    const cvLens = analysis.lenses.commercial_viability.assessment;
    commercialViability = {
      targetAudience: { score: cvLens.target_audience.score, note: cvLens.target_audience.note },
      highConcept: { score: cvLens.high_concept.score, note: cvLens.high_concept.note },
      castAttachability: { score: cvLens.cast_attachability.score, note: cvLens.cast_attachability.note },
      marketingHook: { score: cvLens.marketing_hook.score, note: cvLens.marketing_hook.note },
      budgetReturnRatio: { score: cvLens.budget_return_ratio.score, note: cvLens.budget_return_ratio.note },
      comparableSuccess: { score: cvLens.comparable_success.score, note: cvLens.comparable_success.note },
      cvsTotal: cvLens.cvs_total,
    };
  } else {
    // Default commercial viability when lens not enabled
    commercialViability = {
      targetAudience: { score: 2, note: 'Not assessed (lens disabled)' },
      highConcept: { score: 2, note: 'Not assessed (lens disabled)' },
      castAttachability: { score: 2, note: 'Not assessed (lens disabled)' },
      marketingHook: { score: 2, note: 'Not assessed (lens disabled)' },
      budgetReturnRatio: { score: 2, note: 'Not assessed (lens disabled)' },
      comparableSuccess: { score: 2, note: 'Not assessed (lens disabled)' },
      cvsTotal: 12, // Neutral default
    };
  }

  // Build the base screenplay object
  const baseScreenplay: Omit<ScreenplayWithV6, 'producerMetrics' | 'tmdbStatus'> = {
    id: generateId(raw.source_file),
    title: analysis.title,
    author: analysis.author,
    collection,
    sourceFile: raw.source_file,
    analysisModel: raw.analysis_model,
    analysisVersion: raw.analysis_version,
    weightedScore: coreQuality.weighted_score,
    cvsTotal: commercialViability.cvsTotal,
    genre: analysis.genre,
    subgenres: analysis.subgenres || [],
    themes: analysis.themes || [],
    logline: analysis.logline,
    tone: analysis.tone,
    recommendation,
    recommendationRationale: coreQuality.verdict_rationale,
    verdictStatement: analysis.executive_summary,
    isFilmNow,
    filmNowAssessment: null, // V6 doesn't have this separate assessment
    dimensionScores,
    dimensionJustifications,
    commercialViability,
    criticalFailures: coreQuality.critical_failures || [],
    majorWeaknesses: coreQuality.major_weaknesses || [],
    strengths: analysis.assessment?.strengths || [],
    weaknesses: analysis.assessment?.weaknesses || [],
    developmentNotes: analysis.assessment?.development_notes || [],
    marketability: 'medium', // V6 doesn't have direct marketability field
    budgetCategory,
    budgetJustification: analysis.lenses?.budget_tier?.assessment?.justification || '',
    characters: {
      protagonist: analysis.characters?.protagonist || '',
      antagonist: analysis.characters?.antagonist || '',
      supporting: analysis.characters?.supporting || [],
    },
    structureAnalysis: {
      formatQuality: analysis.structure_analysis?.format_quality || 'professional',
      actBreaks: analysis.structure_analysis?.act_breaks || '',
      pacing: analysis.structure_analysis?.pacing || '',
    },
    comparableFilms: (analysis.comparable_films || []).map((film) => ({
      title: film.title,
      similarity: film.similarity,
      boxOfficeRelevance: film.quality_comparison === 'better' ? 'success' :
                          film.quality_comparison === 'weaker' ? 'failure' : 'mixed',
    })),
    standoutScenes: (analysis.standout_scenes || []).map((scene) => ({
      scene: scene.scene,
      why: scene.why,
    })),
    targetAudience: {
      primaryDemographic: '', // V6 doesn't have this in same format
      genderSkew: 'neutral',
      interests: [],
    },
    metadata: {
      filename: raw.metadata.filename,
      pageCount: raw.metadata.page_count,
      wordCount: raw.metadata.word_count,
    },
    // V6-specific fields
    v6CoreQuality: coreQuality,
    v6Lenses: analysis.lenses,
    v6LensesEnabled: raw.lenses_enabled || [],
    v6BudgetCeilingUsed: raw.budget_ceiling_used,
    falsePositiveRisk: coreQuality.false_positive_check?.risk_level,
    trapsTriggered: coreQuality.false_positive_check?.traps_triggered_count || 0,
  };

  // Calculate producer metrics using the base screenplay data
  const producerMetrics = calculateProducerMetrics(baseScreenplay as Screenplay);

  return {
    ...baseScreenplay,
    producerMetrics,
    tmdbStatus: null,
  };
}

/**
 * Smart normalize function that detects version and calls appropriate normalizer
 */
export function smartNormalizeScreenplay(
  raw: RawScreenplayAnalysis | V6ScreenplayAnalysis,
  collection: Collection
): Screenplay | ScreenplayWithV6 {
  if (isV6RawAnalysis(raw)) {
    return normalizeV6Screenplay(raw, collection);
  }
  return normalizeScreenplay(raw as RawScreenplayAnalysis, collection);
}
