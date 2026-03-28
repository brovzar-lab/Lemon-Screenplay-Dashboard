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
  ComparableFilm,
  TmdbStatus,
  CriticalFailureDetail,
  USPStrength,
} from '@/types';

import type {
  V6ScreenplayAnalysis,
  V6CoreQuality,
  V6Lenses,
} from '@/types/screenplay-v6';

import { mapV6VerdictToTier } from '@/types/screenplay-v6';

import { createProducerMetrics } from './calculations';
import { toNumber } from './utils';

/**
 * Map a collection name to a Settings category ID.
 * Pre-loaded data uses long collection names ("2006 Black List", "Randoms")
 * but the app uses short category IDs (BLKLST, LEMON, OTHER, etc.)
 * Uploaded screenplays already have a category set during upload.
 */
export function collectionToCategoryId(collection: string, existingCategory?: string): string {
  // If already has a category (e.g. uploaded screenplays), use it
  if (existingCategory) return existingCategory;

  const lower = String(collection || '').toLowerCase();

  if (lower.includes('black list') || lower.includes('blacklist') || lower.includes('blklst')) {
    return 'BLKLST';
  }
  if (lower.includes('lemon')) {
    return 'LEMON';
  }
  if (lower.includes('submission') || lower.includes('submitted')) {
    return 'SUBMISSION';
  }
  if (lower.includes('contest') || lower.includes('competition')) {
    return 'CONTEST';
  }
  // Everything else → OTHER  (Randoms, V6 Analysis, etc.)
  return 'OTHER';
}

/**
 * Generate a unique ID from filename
 */
function generateId(filename: string): string {
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
function normalizeRecommendation(recommendation: string): RecommendationTier {
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
function extractBudgetCategory(rawCategory: string): BudgetCategory {
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
    cvsAssessed: true,
  };
}

/**
 * Normalize critical failures to consistent format
 * Handles both string[] (old format) and CriticalFailureDetail[] (new V6 format)
 */
function normalizeCriticalFailures(
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

/** Normalize severity string to valid type */
function normalizeSeverity(s: string): 'minor' | 'moderate' | 'major' | 'critical' {
  const lower = s.toLowerCase();
  if (lower.includes('minor')) return 'minor';
  if (lower.includes('moderate')) return 'moderate';
  if (lower.includes('critical')) return 'critical';
  return 'major';
}

/** Validate a raw USP assessment string against the known enum values */
function validateUSPStrength(raw?: string): USPStrength | null {
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

  // Normalize critical failures
  const criticalFailureData = normalizeCriticalFailures(
    analysis.critical_failures,
    analysis.critical_failure_total_penalty
  );

  // Build the base screenplay object (without producer metrics and tmdbStatus first)
  const baseScreenplay: Omit<Screenplay, 'producerMetrics' | 'tmdbStatus'> = {
    id: generateId(raw.source_file),
    title: analysis.title,
    author: analysis.author,
    collection,
    category: collectionToCategoryId(collection),
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
    criticalFailures: criticalFailureData.failures,
    criticalFailureDetails: criticalFailureData.details,
    criticalFailureTotalPenalty: criticalFailureData.totalPenalty,
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

  // Producer metrics — extract from AI analysis if present, otherwise null
  const rawPI = (analysis as unknown as Record<string, unknown>).producer_intelligence as
    | { market_potential?: { score?: number; rationale?: string }; usp_strength?: { assessment?: string; rationale?: string } }
    | undefined;
  const producerMetrics = createProducerMetrics(
    rawPI ? {
      marketPotential: typeof rawPI.market_potential?.score === 'number' ? rawPI.market_potential.score : null,
      marketPotentialRationale: rawPI.market_potential?.rationale ?? null,
      uspStrength: validateUSPStrength(rawPI.usp_strength?.assessment) ?? null,
      uspStrengthRationale: rawPI.usp_strength?.rationale ?? null,
    } : undefined
  );

  // Normalize TMDB status if present
  const tmdbStatus = normalizeTmdbStatus(raw.tmdb_status);

  return {
    ...baseScreenplay,
    producerMetrics,
    tmdbStatus,
    hasPdf: (raw as unknown as Record<string, unknown>).hasPdf === true,
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
 * V7 pillar score (from Archaeology Engine)
 */
export interface V7PillarScore {
  name: string;
  score: number;
  weight: number;
}

/**
 * V7 goosebumps moment
 */
export interface V7GoosebumpsMoment {
  page: number;
  description: string;
  why_it_works: string;
}

/**
 * Extended Screenplay type with V6/V7-specific fields
 */
export interface ScreenplayWithV6 extends Screenplay {
  v6CoreQuality?: V6CoreQuality;
  v6Lenses?: V6Lenses;
  v6LensesEnabled?: string[];
  v6BudgetCeilingUsed?: number | null;
  falsePositiveRisk?: 'low' | 'moderate' | 'high' | 'critical';
  trapsTriggered?: number;
  // V7 Archaeology Engine fields
  v7PillarScores?: V7PillarScore[];
  v7GoosebumpsMoments?: V7GoosebumpsMoment[];
  v7ReaderDisagreements?: string[];
  v7StoryVsSituation?: { score: number; verdict: string; gate_applied: boolean };
  v7ExecutiveSummary?: string;
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
      cvsAssessed: true,
    };
  } else {
    // Commercial lens disabled — use zeros, not fake averages
    commercialViability = {
      targetAudience: { score: 0, note: 'Not assessed (commercial lens disabled)' },
      highConcept: { score: 0, note: 'Not assessed (commercial lens disabled)' },
      castAttachability: { score: 0, note: 'Not assessed (commercial lens disabled)' },
      marketingHook: { score: 0, note: 'Not assessed (commercial lens disabled)' },
      budgetReturnRatio: { score: 0, note: 'Not assessed (commercial lens disabled)' },
      comparableSuccess: { score: 0, note: 'Not assessed (commercial lens disabled)' },
      cvsTotal: 0,
      cvsAssessed: false,
    };
  }

  // Normalize critical failures (call once, reuse result)
  const criticalFailureData = normalizeCriticalFailures(
    coreQuality.critical_failures,
    coreQuality.critical_failure_total_penalty
  );

  // Build the base screenplay object
  const baseScreenplay: Omit<ScreenplayWithV6, 'producerMetrics' | 'tmdbStatus'> = {
    id: generateId(raw.source_file),
    title: analysis.title,
    author: analysis.author,
    collection,
    category: collectionToCategoryId(collection),
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
    criticalFailures: criticalFailureData.failures,
    criticalFailureDetails: criticalFailureData.details,
    criticalFailureTotalPenalty: criticalFailureData.totalPenalty,
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

  // Producer metrics — extract from AI analysis if present
  const rawPI = (analysis as unknown as Record<string, unknown>).producer_intelligence as
    | { market_potential?: { score?: number; rationale?: string }; usp_strength?: { assessment?: string; rationale?: string } }
    | undefined;
  const producerMetrics = createProducerMetrics(
    rawPI ? {
      marketPotential: typeof rawPI.market_potential?.score === 'number' ? rawPI.market_potential.score : null,
      marketPotentialRationale: rawPI.market_potential?.rationale ?? null,
      uspStrength: validateUSPStrength(rawPI.usp_strength?.assessment) ?? null,
      uspStrengthRationale: rawPI.usp_strength?.rationale ?? null,
    } : undefined
  );

  return {
    ...baseScreenplay,
    producerMetrics,
    tmdbStatus: null,
    hasPdf: (raw as unknown as Record<string, unknown>).hasPdf === true,
  };
}

// ============================================
// V7 NORMALIZATION
// ============================================

/**
 * Check if raw data is V7 format (Archaeology Engine)
 */
export function isV7RawAnalysis(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return r.analysis_version === 'v7_archaeology' || r.analysis_version === 'v7_triage';
}

/**
 * Normalize V7 Archaeology Engine output to extended Screenplay object.
 * Maps 5 pillars → legacy 7-dimension format for backward compatibility.
 * Preserves V7-specific data (pillar scores, goosebumps, disagreements).
 */
export function normalizeV7Screenplay(
  raw: Record<string, unknown>,
  collection: Collection,
): ScreenplayWithV6 {
  const analysis = raw.analysis as Record<string, unknown> || {};

  // Extract pillar scores
  const pillarScores = analysis.pillar_scores as Record<string, { score: number; weight: number }> | undefined;
  const structureScore = pillarScores?.structure?.score ?? 0;
  const characterScore = pillarScores?.character?.score ?? 0;
  const craftScore = pillarScores?.craft_scene?.score ?? 0;
  const conceptScore = pillarScores?.concept?.score ?? 0;
  const emotionScore = pillarScores?.emotional_resonance?.score ?? 0;
  const weightedScore = typeof analysis.weighted_score === 'number' ? analysis.weighted_score : 0;

  // Map V7 5-pillar → legacy 7-dimension (best-effort mapping)
  const dimensionScores: DimensionScores = {
    concept: conceptScore,
    structure: structureScore,
    protagonist: characterScore,
    supportingCast: characterScore * 0.9, // Approximate from character pillar
    dialogue: craftScore,
    genreExecution: conceptScore,
    originality: emotionScore,
    weightedScore,
  };

  const dimensionJustifications: DimensionJustifications = {
    concept: 'See V7 Concept Reader report',
    structure: 'See V7 Structure Reader report',
    protagonist: 'See V7 Character Reader report',
    supportingCast: 'See V7 Character Reader report',
    dialogue: 'See V7 Craft & Scene Reader report',
    genreExecution: 'See V7 Concept Reader report',
    originality: 'See V7 Emotional Resonance Reader report',
  };

  // Verdict / recommendation
  const verdictStr = String(analysis.verdict || 'PASS');
  const recommendation = normalizeRecommendation(verdictStr);
  const isFilmNow = recommendation === 'film_now';

  // Characters
  const chars = analysis.characters as Record<string, unknown> | undefined;

  // Comparable films
  const comps = analysis.comparable_films as Record<string, { title: string; similarity?: string; structural_match?: string; key_divergence?: string }> | undefined;
  const comparableFilms: ComparableFilm[] = comps
    ? Object.values(comps).map((c) => ({
        title: c.title,
        similarity: c.similarity || c.structural_match || '',
        boxOfficeRelevance: 'mixed' as const,
        ...(c.key_divergence ? { keyDivergence: c.key_divergence } : {}),
      }))
    : [];

  // Goosebumps moments
  const rawGoosebumps = analysis.goosebumps_moments as Array<Record<string, unknown>> | undefined;
  const goosebumpsMoments = (rawGoosebumps || []).map((g) => ({
    page: typeof g.page === 'number' ? g.page : 0,
    description: String(g.description || ''),
    why_it_works: String(g.why_it_works || ''),
    arc_connection: String(g.arc_connection || ''),
    thematic_work: String(g.thematic_work || ''),
  }));

  // Story vs. situation
  const storyVsSituation = analysis.story_vs_situation as { score: number; verdict: string; gate_applied: boolean } | undefined;

  // Lenses (commercial viability from synthesis)
  const lenses = analysis.lenses as Record<string, Record<string, unknown>> | undefined;
  let commercialViability: CommercialViability;
  if (lenses?.commercial_viability) {
    const cv = lenses.commercial_viability as Record<string, { score?: number; note?: string }>;
    commercialViability = {
      targetAudience: { score: cv.target_audience?.score ?? 0, note: cv.target_audience?.note ?? '' },
      highConcept: { score: cv.high_concept?.score ?? 0, note: cv.high_concept?.note ?? '' },
      castAttachability: { score: cv.cast_attachability?.score ?? 0, note: cv.cast_attachability?.note ?? '' },
      marketingHook: { score: cv.marketing_hook?.score ?? 0, note: cv.marketing_hook?.note ?? '' },
      budgetReturnRatio: { score: cv.budget_return_ratio?.score ?? 0, note: cv.budget_return_ratio?.note ?? '' },
      comparableSuccess: { score: cv.comparable_success?.score ?? 0, note: cv.comparable_success?.note ?? '' },
      cvsTotal: Object.values(cv).reduce((sum, v) => sum + (typeof v === 'object' && v && 'score' in v ? (v.score ?? 0) : 0), 0),
      cvsAssessed: true,
    };
  } else {
    commercialViability = {
      targetAudience: { score: 0, note: 'Not assessed' },
      highConcept: { score: 0, note: 'Not assessed' },
      castAttachability: { score: 0, note: 'Not assessed' },
      marketingHook: { score: 0, note: 'Not assessed' },
      budgetReturnRatio: { score: 0, note: 'Not assessed' },
      comparableSuccess: { score: 0, note: 'Not assessed' },
      cvsTotal: 0,
      cvsAssessed: false,
    };
  }

  // V7 pillar array for native display
  const v7PillarArray: V7PillarScore[] = pillarScores
    ? Object.entries(pillarScores).map(([name, ps]) => ({ name, score: ps.score, weight: ps.weight }))
    : [];

  // Red flags
  const redFlags = analysis.red_flags as string[] | undefined;

  // Metadata
  const metadata = raw.metadata as Record<string, unknown> | undefined;
  const sourceFile = String(raw.source_file || analysis.title || `v7_${Date.now()}`);

  return {
    id: generateId(sourceFile),
    title: String(analysis.title || ''),
    author: (() => {
      const raw = String(analysis.author || '');
      // Clean up synthesis fallbacks that aren't real author names
      return /not found|unknown/i.test(raw) ? '' : raw;
    })(),
    collection,
    category: collectionToCategoryId(String(raw.collection || ''), String(raw.collection || '')),
    sourceFile,
    analysisModel: String(raw.analysis_model || 'claude-sonnet'),
    analysisVersion: String(raw.analysis_version || 'v7_archaeology'),
    weightedScore,
    cvsTotal: commercialViability.cvsTotal,
    genre: String(analysis.genre || ''),
    subgenres: (analysis.subgenres as string[]) || [],
    themes: (analysis.themes as string[]) || [],
    logline: String(analysis.logline || ''),
    tone: String(analysis.tone || ''),
    recommendation,
    recommendationRationale: String(analysis.executive_summary || ''),
    verdictStatement: String(analysis.executive_summary || ''),
    isFilmNow,
    filmNowAssessment: isFilmNow ? {
      qualifies: true,
      lightningTest: null,
      goosebumpsMoments: goosebumpsMoments.map((g) => g.description),
      careerRiskTest: '',
      legacyPotential: '',
      disqualifyingFactors: [],
    } : null,
    dimensionScores,
    dimensionJustifications,
    commercialViability,
    criticalFailures: Array.isArray(analysis.critical_failures)
      ? (analysis.critical_failures as Array<{ failure?: string; why_structural?: string } | string>).map(
          (cf) => (typeof cf === 'string' ? cf : String(cf.failure || ''))
        )
      : redFlags || [],
    criticalFailureDetails: Array.isArray(analysis.critical_failures)
      ? (analysis.critical_failures as Array<{ failure?: string; why_structural?: string } | string>).map(
          (cf) => ({
            failure: typeof cf === 'string' ? cf : String(cf.failure || ''),
            severity: 'major' as const,
            penalty: -0.5,
            evidence: typeof cf === 'string' ? 'See V7 reader reports' : String(cf.why_structural || 'See V7 reader reports'),
          })
        )
      : (redFlags || []).map((f) => ({
          failure: f,
          severity: 'major' as const,
          penalty: -0.5,
          evidence: 'See V7 reader reports',
        })),
    criticalFailureTotalPenalty: 0,
    majorWeaknesses: (analysis.weaknesses as string[]) || redFlags || [],
    strengths: (analysis.strengths as string[]) || [],
    weaknesses: (analysis.weaknesses as string[]) || redFlags || [],
    developmentNotes: (analysis.development_notes as string[]) || [],
    marketability: 'medium',
    budgetCategory: 'unknown',
    budgetJustification: '',
    characters: {
      protagonist: String(chars?.protagonist || ''),
      antagonist: String(chars?.antagonist || ''),
      supporting: (chars?.supporting as string[]) || [],
    },
    structureAnalysis: {
      formatQuality: 'professional',
      actBreaks: '',
      pacing: '',
    },
    comparableFilms,
    standoutScenes: goosebumpsMoments.map((g) => ({
      scene: g.description,
      why: g.why_it_works,
      ...(g.arc_connection ? { arcConnection: g.arc_connection } : {}),
      ...(g.thematic_work ? { thematicWork: g.thematic_work } : {}),
    })),
    targetAudience: {
      primaryDemographic: '',
      genderSkew: 'neutral',
      interests: [],
    },
    metadata: {
      filename: String(metadata?.filename || sourceFile),
      pageCount: typeof metadata?.page_count === 'number' ? metadata.page_count : 0,
      wordCount: typeof metadata?.word_count === 'number' ? metadata.word_count : 0,
    },
    producerMetrics: createProducerMetrics(),
    tmdbStatus: null,
    hasPdf: (raw as Record<string, unknown>).hasPdf === true,
    // V7-specific fields
    v7PillarScores: v7PillarArray,
    v7GoosebumpsMoments: goosebumpsMoments,
    v7ReaderDisagreements: (analysis.reader_disagreements as string[]) || [],
    v7StoryVsSituation: storyVsSituation,
    v7ExecutiveSummary: String(analysis.executive_summary || ''),
  };
}

/**
 * Smart normalize function that detects version and calls appropriate normalizer
 */
export function smartNormalizeScreenplay(
  raw: RawScreenplayAnalysis | V6ScreenplayAnalysis,
  collection: Collection
): Screenplay | ScreenplayWithV6 {
  if (isV7RawAnalysis(raw)) {
    return normalizeV7Screenplay(raw as unknown as Record<string, unknown>, collection);
  }
  if (isV6RawAnalysis(raw)) {
    return normalizeV6Screenplay(raw, collection);
  }
  return normalizeScreenplay(raw as RawScreenplayAnalysis, collection);
}
