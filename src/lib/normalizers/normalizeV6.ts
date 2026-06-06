/**
 * V6 Unified Bridge (lemon-ingest format)
 * Normalizes lemon-ingest V6_unified data to the standard Screenplay type.
 */

import type {
  Screenplay,
  Collection,
  CommercialViability,
} from '@/types';

import { toNumber } from '../utils';
import { createProducerMetrics } from '../calculations';

import { collectionToCategoryId } from './collectionMap';
import {
  generateId,
  normalizeCriticalFailures,
  validateUSPStrength,
} from './helpers';

/**
 * Detect lemon-ingest V6_unified format.
 * These are produced by lemon-ingest.mjs and have a different schema to the Archaeology Engine.
 */
export function isV6UnifiedAnalysis(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return r.analysis_version === 'v6_unified';
}

/** @deprecated V6 analysis removed. Returns false always. */
export function isV6RawAnalysis(_raw: unknown): boolean {
  return false;
}

/** @deprecated V6 analysis removed. Throws if called. */
export function normalizeV6Screenplay(_raw: Record<string, unknown>, _collection: Collection): never {
  throw new Error('V6 analysis has been removed. All screenplays use the Archaeology Engine.');
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
