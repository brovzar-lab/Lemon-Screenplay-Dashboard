/**
 * Data Normalization
 * Converts raw screenplay JSON analysis to normalized Screenplay objects
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
// V7 TYPES
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
 * Extended Screenplay type with V7-specific fields
 */
export interface ScreenplayWithV7 extends Screenplay {
  // V7 Archaeology Engine fields
  v7PillarScores?: V7PillarScore[];
  v7GoosebumpsMoments?: V7GoosebumpsMoment[];
  v7ReaderDisagreements?: string[];
  v7StoryVsSituation?: { score: number; verdict: string; gate_applied: boolean };
  v7ExecutiveSummary?: string;
}

/** @deprecated Use ScreenplayWithV7 */
export type ScreenplayWithV6 = ScreenplayWithV7;

/** @deprecated V6 analysis removed. Returns false always. */
export function isV6RawAnalysis(_raw: unknown): boolean {
  return false;
}


/** @deprecated V6 analysis removed. Throws if called. */

export function normalizeV6Screenplay(_raw: Record<string, unknown>, _collection: Collection): never {
  throw new Error('V6 analysis has been removed. All screenplays use V7.');
}

// ============================================
// V6_UNIFIED BRIDGE (lemon-ingest format)
// ============================================

/**
 * Detect lemon-ingest V6_unified format.
 * These are produced by lemon-ingest.mjs and have a different schema to V7.
 */
export function isV6UnifiedAnalysis(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return r.analysis_version === 'v6_unified';
}

/**
 * Bridge normalizer for lemon-ingest V6_unified data.
 *
 * V6_unified structure:
 *   raw.analysis.core_quality.{execution_craft, character_system, conceptual_strength, voice_and_tone}
 *   raw.analysis.lenses.commercial_viability.assessment.{target_audience, high_concept, …, cvs_total}
 *
 * Maps to the standard Screenplay type so the dashboard can display these
 * without requiring a $20 re-analysis run.
 */
export function normalizeV6UnifiedScreenplay(
  raw: Record<string, unknown>,
  collection: Collection
): Screenplay {
  const analysis = ((raw.analysis ?? {}) as Record<string, unknown>);
  const cq      = ((analysis.core_quality ?? {}) as Record<string, unknown>);
  const lenses  = ((analysis.lenses ?? {}) as Record<string, unknown>);
  const cvLens  = ((lenses.commercial_viability ?? {}) as Record<string, unknown>);
  const cv      = ((cvLens.assessment ?? {}) as Record<string, unknown>);
  const meta    = ((raw.metadata ?? {}) as Record<string, unknown>);

  // Sub-score blocks
  const execCraft   = ((cq.execution_craft      ?? {}) as Record<string, unknown>);
  const charSystem  = ((cq.character_system      ?? {}) as Record<string, unknown>);
  const conceptStr  = ((cq.conceptual_strength   ?? {}) as Record<string, unknown>);
  const voiceTone   = ((cq.voice_and_tone        ?? {}) as Record<string, unknown>);

  // Core scores
  const execScore    = toNumber(execCraft.score);
  const charScore    = toNumber(charSystem.score);
  const conceptScore = toNumber(conceptStr.score);
  const voiceScore   = toNumber(voiceTone.score);
  const weightedScore = toNumber(cq.weighted_score);

  // Recommendation mapping
  const verdictMap: Record<string, Screenplay['recommendation']> = {
    'FILM NOW':  'film_now',
    'FILM_NOW':  'film_now',
    'RECOMMEND': 'recommend',
    'CONSIDER':  'consider',
    'PASS':      'pass',
  };
  const verdict        = String(cq.verdict ?? 'PASS').toUpperCase().trim();
  const recommendation = verdictMap[verdict] ?? 'pass';
  const isFilmNow      = recommendation === 'film_now';

  // Critical failures
  const criticalFailureData = normalizeCriticalFailures(
    Array.isArray(cq.critical_failures) ? (cq.critical_failures as unknown[]) : undefined,
    typeof cq.critical_failure_total_penalty === 'number'
      ? (cq.critical_failure_total_penalty as number)
      : undefined
  );

  // Commercial viability — cv keys match normalizeCommercialViability expectations exactly
  const cvsTotal = typeof cv.cvs_total === 'number' ? cv.cvs_total : 0;

  function cvField(key: string): { score: number; note: string } {
    const f = ((cv[key] ?? {}) as Record<string, unknown>);
    return { score: toNumber(f.score), note: String(f.note ?? '') };
  }
  const commercialViability: CommercialViability = {
    targetAudience:    cvField('target_audience'),
    highConcept:       cvField('high_concept'),
    castAttachability: cvField('cast_attachability'),
    marketingHook:     cvField('marketing_hook'),
    budgetReturnRatio: cvField('budget_return_ratio'),
    comparableSuccess: cvField('comparable_success'),
    cvsTotal,
    cvsAssessed:       cvsTotal > 0,
  };

  // Characters
  const charRaw      = ((analysis.characters ?? {}) as Record<string, unknown>);
  const structureRaw = ((analysis.structure_analysis ?? {}) as Record<string, unknown>);

  // Comparable films — lemon-ingest wraps them under { films: [...] }
  const compFilmsRaw = (analysis.comparable_films ?? {}) as Record<string, unknown> | unknown[];
  const compArr: Record<string, unknown>[] = Array.isArray(compFilmsRaw)
    ? (compFilmsRaw as Record<string, unknown>[])
    : Array.isArray((compFilmsRaw as Record<string, unknown>).films)
      ? ((compFilmsRaw as Record<string, unknown>).films as Record<string, unknown>[])
      : [];

  // Standout scenes
  const scenesRaw = Array.isArray(analysis.standout_scenes)
    ? (analysis.standout_scenes as Record<string, unknown>[])
    : [];

  // Assessment block
  const assessRaw = ((analysis.assessment ?? {}) as Record<string, unknown>);

  // Producer intelligence
  const piRaw  = ((analysis.producer_intelligence ?? {}) as Record<string, unknown>);
  const mpRaw  = ((piRaw.market_potential  ?? {}) as Record<string, unknown>);
  const uspRaw = ((piRaw.usp_strength      ?? {}) as Record<string, unknown>);
  const producerMetrics = createProducerMetrics({
    marketPotential:         toNumber(mpRaw.score)  || null,
    marketPotentialRationale: String(mpRaw.rationale  ?? '') || null,
    uspStrength:             validateUSPStrength(String(uspRaw.assessment ?? '')) ?? null,
    uspStrengthRationale:    String(uspRaw.rationale  ?? '') || null,
  });

  return {
    id:               generateId(String(raw.source_file ?? '')),
    title:            String(analysis.title ?? ''),
    author:           String(analysis.author ?? ''),
    collection,
    category:         collectionToCategoryId(collection),
    sourceFile:       String(raw.source_file ?? ''),
    analysisModel:    String(raw.analysis_model ?? 'claude-sonnet'),
    analysisVersion:  String(raw.analysis_version ?? 'v6_unified'),
    weightedScore,
    cvsTotal,
    genre:            String(analysis.genre ?? ''),
    subgenres:        Array.isArray(analysis.subgenres) ? (analysis.subgenres as string[]) : [],
    themes:           Array.isArray(analysis.themes) ? (analysis.themes as string[]) : [],
    logline:          String(analysis.logline ?? ''),
    tone:             String(analysis.tone ?? ''),
    recommendation,
    recommendationRationale: String(cq.verdict_rationale ?? ''),
    verdictStatement:        String(cq.verdict_rationale ?? ''),
    isFilmNow,
    filmNowAssessment: null,
    dimensionScores: {
      concept:        conceptScore,
      structure:      execScore,
      protagonist:    charScore,
      supportingCast: charScore,
      dialogue:       voiceScore,
      genreExecution: execScore,
      originality:    conceptScore,
      weightedScore,
    },
    dimensionJustifications: {
      concept:        String(conceptStr.justification ?? ''),
      structure:      String(((execCraft.structure ?? {}) as Record<string, unknown>).justification ?? ''),
      protagonist:    String(((charSystem.protagonist ?? {}) as Record<string, unknown>).justification ?? ''),
      supportingCast: String(((charSystem.supporting_cast ?? {}) as Record<string, unknown>).justification ?? ''),
      dialogue:       String(voiceTone.justification ?? ''),
      genreExecution: String(((execCraft.scene_writing ?? {}) as Record<string, unknown>).justification ?? ''),
      originality:    String(conceptStr.justification ?? ''),
    },
    commercialViability,
    criticalFailures:          criticalFailureData.failures,
    criticalFailureDetails:    criticalFailureData.details,
    criticalFailureTotalPenalty: criticalFailureData.totalPenalty,
    majorWeaknesses: Array.isArray(cq.major_weaknesses) ? (cq.major_weaknesses as string[]) : [],
    strengths:        Array.isArray(assessRaw.strengths)  ? (assessRaw.strengths  as string[]) : [],
    weaknesses:       Array.isArray(assessRaw.weaknesses) ? (assessRaw.weaknesses as string[]) : [],
    developmentNotes: Array.isArray(assessRaw.development_notes) ? (assessRaw.development_notes as string[]) : [],
    marketability: 'low' as const,
    budgetCategory: 'unknown' as const,
    budgetJustification: '',
    characters: {
      protagonist: String(charRaw.protagonist ?? ''),
      antagonist:  String(charRaw.antagonist  ?? ''),
      supporting:  Array.isArray(charRaw.supporting) ? (charRaw.supporting as string[]) : [],
    },
    structureAnalysis: {
      formatQuality: 'professional' as const,
      actBreaks:     String(structureRaw.act_breaks ?? ''),
      pacing:        String(structureRaw.pacing     ?? ''),
    },
    comparableFilms: compArr.map((f) => ({
      title:              String(f.title      ?? ''),
      similarity:         String(f.similarity ?? ''),
      boxOfficeRelevance: 'mixed' as const,
    })),
    standoutScenes: scenesRaw.map((s) => ({
      scene: String(s.scene ?? ''),
      why:   String(s.why   ?? ''),
    })),
    targetAudience: {
      primaryDemographic: '',
      genderSkew:         'neutral' as const,
      interests:          [],
    },
    metadata: {
      filename:  String(meta.filename    ?? ''),
      pageCount: typeof meta.page_count === 'number' ? meta.page_count : 0,
      wordCount: typeof meta.word_count  === 'number' ? meta.word_count  : 0,
    },
    producerMetrics,
    tmdbStatus: null,
    hasPdf: false,
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
): ScreenplayWithV7 {
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
  raw: RawScreenplayAnalysis,
  collection: Collection
): Screenplay {
  if (isV7RawAnalysis(raw)) {
    return normalizeV7Screenplay(raw as unknown as Record<string, unknown>, collection);
  }
  if (isV6UnifiedAnalysis(raw)) {
    return normalizeV6UnifiedScreenplay(raw as unknown as Record<string, unknown>, collection);
  }
  return normalizeScreenplay(raw as RawScreenplayAnalysis, collection);
}
