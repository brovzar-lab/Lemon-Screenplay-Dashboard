/**
 * V5 (Standard) Normalization
 * Converts raw V5 screenplay JSON to normalized Screenplay objects.
 */

import type {
  RawScreenplayAnalysis,
  Screenplay,
  Collection,
} from '@/types';

import { createProducerMetrics } from '../calculations';

import { collectionToCategoryId } from './collectionMap';
import {
  generateId,
  normalizeRecommendation,
  extractBudgetCategory,
  normalizeDimensionScores,
  extractDimensionJustifications,
  normalizeCommercialViability,
  normalizeCriticalFailures,
  validateUSPStrength,
  normalizeFilmNowAssessment,
  normalizeTmdbStatus,
} from './helpers';

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
