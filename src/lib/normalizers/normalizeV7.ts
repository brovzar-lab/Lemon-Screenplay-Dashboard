/**
 * Archaeology Engine Normalization (V9)
 *
 * Normalizes 5-pillar analysis output from the V9 Archaeology Engine
 * (and backward-compatible V7/V8 documents) to the ScreenplayWithV7 type.
 * Type names retain the V7 prefix because they describe the stored Firestore
 * document shape, which hasn't changed across engine versions.
 */

import type {
  Screenplay,
  Collection,
  RawTmdbStatus,
  DimensionScores,
  DimensionJustifications,
  CommercialViability,
  ComparableFilm,
} from '@/types';

import { createProducerMetrics } from '../calculations';

import { collectionToCategoryId } from './collectionMap';
import {
  generateId,
  normalizeRecommendation,
  normalizeTmdbStatus,
} from './helpers';

// ─── Types ──────────────────────────────────────────────────

/** Pillar score (from Archaeology Engine) */
export interface V7PillarScore {
  name: string;
  score: number;
  weight: number;
}

/** Goosebumps moment */
export interface V7GoosebumpsMoment {
  page: number;
  description: string;
  why_it_works: string;
}

/** Extended Screenplay type with Archaeology Engine fields */
export interface ScreenplayWithV7 extends Screenplay {
  v7PillarScores?: V7PillarScore[];
  v7GoosebumpsMoments?: V7GoosebumpsMoment[];
  v7ReaderDisagreements?: string[];
  v7StoryVsSituation?: { score: number; verdict: string; gate_applied: boolean };
  v7ExecutiveSummary?: string;
}

/** @deprecated Use ScreenplayWithV7 */
export type ScreenplayWithV6 = ScreenplayWithV7;

// ─── Type Guard ─────────────────────────────────────────────

/**
 * Check if raw data is Archaeology Engine format (V7/V8/V9 variants)
 */
export function isV7RawAnalysis(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  const v = r.analysis_version;
  // Accept all V7/V8/V9 variants — the 5-pillar shape is the same regardless.
  // 'v7_archaeology' / 'v7_triage' = legacy daemon output (backward compat)
  // 'v8_archaeology' / 'v8_triage' = intermediate test documents (backward compat)
  // 'v9_archaeology' / 'v9_triage' = current engine (source of truth)
  // 'v7' = old browser inline path (backward compat)
  const isRecognizedVersion = (
    v === 'v9_archaeology' ||
    v === 'v9_triage' ||
    v === 'v8_archaeology' ||
    v === 'v8_triage' ||
    v === 'v7_archaeology' ||
    v === 'v7_triage' ||
    v === 'v7'
  );
  if (!isRecognizedVersion || !r.analysis || typeof r.analysis !== 'object') return false;

  const analysis = r.analysis as Record<string, unknown>;
  if (typeof analysis.title !== 'string' || analysis.title.trim().length === 0) return false;
  if (typeof analysis.verdict !== 'string' || analysis.verdict.trim().length === 0) return false;

  const isFiniteScore = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10;

  if (String(v).endsWith('_triage')) {
    return isFiniteScore(analysis.triage_score);
  }

  if (!isFiniteScore(analysis.weighted_score)) return false;
  if (!analysis.pillar_scores || typeof analysis.pillar_scores !== 'object') return false;
  const pillars = analysis.pillar_scores as Record<string, unknown>;
  return ['structure', 'character', 'craft_scene', 'concept', 'emotional_resonance'].every(
    (name) => {
      const pillar = pillars[name];
      return Boolean(
        pillar &&
        typeof pillar === 'object' &&
        isFiniteScore((pillar as Record<string, unknown>).score),
      );
    },
  );
}

// ─── Normalizer ─────────────────────────────────────────────

/**
 * Normalize Archaeology Engine output to extended Screenplay object.
 * Maps 5 pillars → legacy 7-dimension format for backward compatibility.
 * Preserves pillar-specific data (scores, goosebumps, disagreements).
 */
export function normalizeV7Screenplay(
  raw: Record<string, unknown>,
  collection: Collection,
): ScreenplayWithV7 {
  const analysis = raw.analysis as Record<string, unknown> || {};
  const rawQuality = analysis.analysis_quality as Record<string, unknown> | undefined;
  const legacyFailedReaders = Array.isArray(analysis.failed_readers)
    ? analysis.failed_readers.map(String)
    : [];
  const failedReaders = Array.isArray(rawQuality?.failed_readers)
    ? rawQuality.failed_readers.map(String)
    : legacyFailedReaders;
  const expectedReaders = typeof rawQuality?.expected_readers === 'number'
    ? rawQuality.expected_readers
    : 5;
  const completedReaders = typeof rawQuality?.completed_readers === 'number'
    ? rawQuality.completed_readers
    : Math.max(0, expectedReaders - failedReaders.length);

  // Extract pillar scores
  const pillarScores = analysis.pillar_scores as Record<string, { score: number; weight: number }> | undefined;
  const structureScore = pillarScores?.structure?.score ?? 0;
  const characterScore = pillarScores?.character?.score ?? 0;
  const craftScore = pillarScores?.craft_scene?.score ?? 0;
  const conceptScore = pillarScores?.concept?.score ?? 0;
  const emotionScore = pillarScores?.emotional_resonance?.score ?? 0;
  const weightedScore = typeof analysis.weighted_score === 'number'
    ? analysis.weighted_score
    : typeof analysis.triage_score === 'number'
      ? analysis.triage_score
      : 0;

  // Map 5-pillar → legacy 7-dimension (best-effort mapping)
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
    concept: 'See Concept Reader report',
    structure: 'See Structure Reader report',
    protagonist: 'See Character Reader report',
    supportingCast: 'See Character Reader report',
    dialogue: 'See Craft & Scene Reader report',
    genreExecution: 'See Concept Reader report',
    originality: 'See Emotional Resonance Reader report',
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

  // Pillar array for native display
  const v7PillarArray: V7PillarScore[] = pillarScores
    ? Object.entries(pillarScores).map(([name, ps]) => ({ name, score: ps.score, weight: ps.weight }))
    : [];

  // Red flags
  const redFlags = analysis.red_flags as string[] | undefined;

  // Metadata
  const metadata = raw.metadata as Record<string, unknown> | undefined;
  const sourceFile = String(raw.source_file || analysis.title || `v9_${Date.now()}`);

  return {
    id: generateId(sourceFile),
    title: String(analysis.title || ''),
    author: (() => {
      const rawAuthor = String(analysis.author || '');
      // Clean up synthesis fallbacks that aren't real author names
      return /not found|unknown/i.test(rawAuthor) ? '' : rawAuthor;
    })(),
    collection,
    category: collectionToCategoryId(String((raw as Record<string, unknown>).collection_id || raw.collection || ''), String((raw as Record<string, unknown>).collection_id || raw.collection || '')),
    sourceFile,
    analysisModel: String(raw.analysis_model || 'claude-sonnet'),
    analysisVersion: String(raw.analysis_version || 'v9_archaeology'),
    analysisQuality: {
      status: failedReaders.length > 0 || rawQuality?.status === 'partial' ? 'partial' : 'complete',
      completedReaders,
      expectedReaders,
      failedReaders,
    },
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
            evidence: typeof cf === 'string' ? 'See reader reports' : String(cf.why_structural || 'See reader reports'),
          })
        )
      : (redFlags || []).map((f) => ({
          failure: f,
          severity: 'major' as const,
          penalty: -0.5,
          evidence: 'See reader reports',
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
    tmdbStatus: normalizeTmdbStatus((raw as Record<string, unknown>).tmdb_status as RawTmdbStatus | undefined),
    hasPdf: (raw as Record<string, unknown>).hasPdf === true,
    // Archaeology Engine fields
    v7PillarScores: v7PillarArray,
    v7GoosebumpsMoments: goosebumpsMoments,
    v7ReaderDisagreements: (analysis.reader_disagreements as string[]) || [],
    v7StoryVsSituation: storyVsSituation,
    v7ExecutiveSummary: String(analysis.executive_summary || ''),
  };
}
