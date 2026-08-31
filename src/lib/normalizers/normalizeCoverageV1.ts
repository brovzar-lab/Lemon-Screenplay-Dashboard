/**
 * coverage_v1 Normalization
 *
 * Normalizes lean coverage reports from the server-side coverage_v1 engine
 * (execution/coverage_v1.py) into the existing Screenplay shape.
 *
 * coverage_v1 reports carry a professional verdict (PASS/CONSIDER/RECOMMEND),
 * cited evidence, and development priorities — but NO numeric score. This
 * normalizer deliberately does not fabricate one: the document is projected
 * as score-less (`rankable: false`, `scoreSource: 'coverage_unscored'`,
 * weightedScore 0), which the UI already renders as "Not rankable" without
 * ever presenting a number. Everything noteworthy (needs_review status, low
 * confidence, FILM NOW nomination, citation/fact-audit results, verdict
 * adjustments, uncertainties) is surfaced through the existing
 * ProducerProjection warnings mechanism.
 *
 * Accepts both a bare report document and a Firestore staging doc that wraps
 * the report as `{ report_json: string, ... }` (parsed defensively).
 */

import type {
  Collection,
  CommercialViability,
  DimensionJustifications,
  DimensionScores,
  LensGrade,
  ProducerProjection,
  ProducerProjectionWarning,
  RawTmdbStatus,
  RecommendationTier,
  Screenplay,
} from '@/types';

import { canonicalizeGenre, createProducerMetrics } from '../calculations';
import { collectionToCategoryId } from './collectionMap';
import { generateId, normalizeRecommendation, normalizeTmdbStatus } from './helpers';

type UnknownRecord = Record<string, unknown>;

// ─── Defensive readers ──────────────────────────────────────

function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Read the `point` field from cited-point entries (strengths/concerns). */
function citedPoints(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = asRecord(item);
    const point = asString(record?.point).trim();
    return point ? [point] : [];
  });
}

function trimSynopsis(synopsis: string, maxLength = 360): string {
  const clean = synopsis.trim().replace(/\s+/g, ' ');
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}

// ─── Report resolution (bare report or staging wrapper) ─────

/**
 * Resolve the coverage_v1 report object from a raw Firestore document.
 * Handles both a bare report and a staging doc wrapping it as
 * `{ report_json: string, ... }`. Returns undefined when the document is
 * not a structurally valid coverage_v1 report.
 */
export function resolveCoverageV1Report(raw: unknown): UnknownRecord | undefined {
  const record = asRecord(raw);
  if (!record) return undefined;

  let report: UnknownRecord | undefined;
  if (record.analysis_version === 'coverage_v1') {
    report = record;
  } else if (typeof record.report_json === 'string') {
    try {
      const parsed: unknown = JSON.parse(record.report_json);
      const parsedRecord = asRecord(parsed);
      if (parsedRecord?.analysis_version === 'coverage_v1') report = parsedRecord;
    } catch {
      return undefined;
    }
  }
  if (!report) return undefined;

  if (asString(report.title).trim().length === 0) return undefined;
  if (asString(report.verdict).trim().length === 0) return undefined;
  if (!asRecord(report.coverage)) return undefined;
  return report;
}

/** Type guard used by the normalization dispatch in api.ts. */
export function isCoverageV1Analysis(raw: unknown): boolean {
  return resolveCoverageV1Report(raw) !== undefined;
}

// ─── Warning assembly ───────────────────────────────────────

function buildCoverageWarnings(input: {
  status: string;
  reviewReasons: string[];
  humanReviewRecommended: boolean;
  confidence: string;
  filmNowNominated: boolean;
  uncertainties: string[];
  citationTotal: number;
  citationVerified: number;
  factClaims: number;
  factSupportRate: number | undefined;
  centralFailures: string[];
}): ProducerProjectionWarning[] {
  const warnings: ProducerProjectionWarning[] = [];

  warnings.push({
    code: 'coverage_unscored',
    severity: 'information',
    title: 'Lean coverage report (no numeric score)',
    detail:
      'This coverage_v1 analysis records a professional verdict with cited evidence but no numeric score, so it is excluded from score rankings and comparisons.',
    params: {},
  });

  const reasons = input.reviewReasons.join('; ');
  if (input.status === 'needs_review') {
    warnings.push({
      code: 'coverage_needs_review',
      severity: 'blocking',
      title: 'Engine flagged this coverage for human review',
      detail: reasons
        ? `The engine could not seal this report. Reasons: ${reasons}.`
        : 'The engine could not seal this report and marked it needs_review.',
      params: { reasons },
    });
  } else if (input.humanReviewRecommended || input.confidence === 'low') {
    warnings.push({
      code: 'human_review_recommended',
      severity: 'warning',
      title: 'Human review recommended',
      detail: reasons
        ? `The engine recommends a human read before acting on this verdict. Reasons: ${reasons}.`
        : 'The engine recommends a human read before acting on this verdict (reader confidence is low).',
      params: { reasons },
    });
  }

  if (input.filmNowNominated) {
    warnings.push({
      code: 'film_now_nominated',
      severity: 'information',
      title: 'FILM NOW nomination recorded',
      detail:
        'The reader nominated this screenplay for FILM NOW. That label requires human confirmation, so the stored verdict stays RECOMMEND.',
      params: {},
    });
  }

  if (input.citationTotal > 0 || input.factClaims > 0) {
    const unverified = Math.max(0, input.citationTotal - input.citationVerified);
    const supportPercent =
      input.factSupportRate !== undefined ? Math.round(input.factSupportRate * 100) : undefined;
    const problem =
      unverified > 0 ||
      (supportPercent !== undefined && supportPercent < 100) ||
      input.centralFailures.length > 0;
    const parts: string[] = [];
    if (input.citationTotal > 0) {
      parts.push(
        `${input.citationVerified} of ${input.citationTotal} quoted citations verified against the screenplay text`,
      );
    }
    if (supportPercent !== undefined && input.factClaims > 0) {
      parts.push(`fact audit supported ${supportPercent}% of ${input.factClaims} factual claims`);
    }
    if (input.centralFailures.length > 0) {
      parts.push(`central facts not supported: ${input.centralFailures.join(', ')}`);
    }
    warnings.push({
      code: 'coverage_evidence_audit',
      severity: problem ? 'warning' : 'information',
      title: 'Citation and fact-audit results',
      detail: `${parts.join('. ')}.`,
      params: {
        citations: `${input.citationVerified}/${input.citationTotal}`,
        supportRate: supportPercent ?? 'n/a',
      },
    });
  }

  if (input.uncertainties.length > 0) {
    warnings.push({
      code: 'coverage_uncertainties',
      severity: 'information',
      title: 'Reader-stated uncertainties',
      detail: input.uncertainties.join('; '),
      params: { count: input.uncertainties.length },
    });
  }

  return warnings;
}

// ─── Normalizer ─────────────────────────────────────────────

/**
 * Normalize a coverage_v1 report (bare or `report_json`-wrapped) into the
 * existing Screenplay shape. Throws when the document is not a valid
 * coverage_v1 report — callers quarantine on throw, same as V9.
 */
export function normalizeCoverageV1Screenplay(
  raw: UnknownRecord,
  collection: Collection,
): Screenplay {
  const report = resolveCoverageV1Report(raw);
  if (!report) {
    throw new Error('Document is not a valid coverage_v1 report');
  }
  const wrapper = report === raw ? undefined : raw;
  const coverage = asRecord(report.coverage) ?? {};

  // ── Identity ────────────────────────────────────────────
  const title = asString(wrapper?.title).trim() || asString(report.title).trim();
  const sourceFile =
    asString(wrapper?.source_file).trim() ||
    asString(report.source_file).trim() ||
    asString(report.title).trim();
  const projectId = asString(wrapper?.project_id ?? report.project_id).trim() || undefined;

  // ── Verdict / tier ──────────────────────────────────────
  // The engine code-caps FILM_NOW to RECOMMEND + film_now_nominated before
  // writing the report; re-cap here defensively so a coverage_v1 doc can
  // never claim the protected human-confirmed 'film_now' tier.
  const rawVerdict = asString(report.verdict);
  let recommendation: RecommendationTier = normalizeRecommendation(rawVerdict);
  const filmNowNominated = report.film_now_nominated === true || recommendation === 'film_now';
  if (recommendation === 'film_now') recommendation = 'recommend';

  // ── Narrative fields ────────────────────────────────────
  const genre = asRecord(coverage.genre) ?? {};
  const spine = asRecord(coverage.story_spine) ?? {};
  const logline = asString(coverage.logline).trim();
  const synopsis = asString(coverage.synopsis);
  const executiveSummary = [logline, trimSynopsis(synopsis)].filter(Boolean).join(' ');
  const championReason = asString(coverage.champion_reason).trim();
  const passReason = asString(coverage.pass_reason).trim();
  const verdictStatement =
    (recommendation === 'pass' ? passReason : championReason) || executiveSummary;

  // ── Development notes (the whole point of this engine) ──
  const priorities = Array.isArray(coverage.development_priorities)
    ? coverage.development_priorities
    : [];
  const developmentNotes = priorities.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const note = [asString(record.priority), asString(record.why), asString(record.how)]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(' — ');
    return note ? [note] : [];
  });

  // ── Strengths / concerns / genre contract ───────────────
  const strengths = citedPoints(coverage.strengths);
  const weaknesses = citedPoints(coverage.concerns);
  const genreContract = asRecord(coverage.genre_contract) ?? {};
  const contractFailures = asStringArray(genreContract.failures);
  const majorWeaknesses = [...weaknesses, ...contractFailures];

  // ── Lens grades (kept verbatim, never converted to scores) ──
  const lensGrades: LensGrade[] = Array.isArray(coverage.lens_notes)
    ? coverage.lens_notes.flatMap((item) => {
        const record = asRecord(item);
        const lens = asString(record?.lens).trim();
        const grade = asString(record?.grade);
        if (!lens || (grade !== 'strong' && grade !== 'solid' && grade !== 'weak')) return [];
        return [{ lens, grade, note: asString(record?.analysis) }];
      })
    : [];

  // ── Trust / review surfacing ────────────────────────────
  const status = asString(report.status);
  const confidence = asString(report.confidence ?? coverage.confidence);
  const humanReviewRecommended = report.human_review_recommended === true;
  const reviewReasons = asStringArray(report.review_reasons);
  const uncertainties = asStringArray(coverage.uncertainties);
  const verdictAdjustments = asStringArray(report.verdict_adjustments);
  const citationVerification = asRecord(report.citation_verification) ?? {};
  const factAudit = asRecord(report.fact_audit) ?? {};

  const warnings = buildCoverageWarnings({
    status,
    reviewReasons,
    humanReviewRecommended,
    confidence,
    filmNowNominated,
    uncertainties,
    citationTotal: asFiniteNumber(citationVerification.total) ?? 0,
    citationVerified: asFiniteNumber(citationVerification.verified) ?? 0,
    factClaims: asFiniteNumber(factAudit.claims) ?? 0,
    factSupportRate: asFiniteNumber(factAudit.support_rate),
    centralFailures: asStringArray(factAudit.central_failures),
  });

  // ── Score-less producer projection ──────────────────────
  // No numeric score exists and none is fabricated. rankable stays false so
  // this document never drives rankings, exports, or comparisons; the UI
  // already renders that state ("Not rankable") without showing a number.
  const producerProjection: ProducerProjection = {
    rawScore: 0,
    finalScore: 0,
    scoreSource: 'coverage_unscored',
    penaltyApplied: 0,
    reportedPenalty: 0,
    finalVerdict: recommendation,
    verdictAdjustments,
    gates: [],
    warnings,
    rankable: false,
    trustStatus: 'incomplete',
    boundary: {
      checked: false,
      runCount: 0,
      failedRunCount: 0,
      scoreSpread: 0,
      verdicts: [],
      stable: true,
    },
    readerDisagreementCount: 0,
  };

  // ── Placeholder score containers (all zeros, never ranked) ──
  const dimensionScores: DimensionScores = {
    concept: 0,
    structure: 0,
    protagonist: 0,
    supportingCast: 0,
    dialogue: 0,
    genreExecution: 0,
    originality: 0,
    weightedScore: 0,
  };
  const dimensionJustifications: DimensionJustifications = {
    concept: 'Not scored — see coverage lens notes',
    structure: 'Not scored — see coverage lens notes',
    protagonist: 'Not scored — see coverage lens notes',
    supportingCast: 'Not scored — see coverage lens notes',
    dialogue: 'Not scored — see coverage lens notes',
    genreExecution: 'Not scored — see coverage lens notes',
    originality: 'Not scored — see coverage lens notes',
  };
  const commercialViability: CommercialViability = {
    targetAudience: { score: 0, note: 'Not assessed' },
    highConcept: { score: 0, note: 'Not assessed' },
    castAttachability: { score: 0, note: 'Not assessed' },
    marketingHook: { score: 0, note: 'Not assessed' },
    budgetReturnRatio: { score: 0, note: 'Not assessed' },
    comparableSuccess: { score: 0, note: 'Not assessed' },
    cvsTotal: 0,
    cvsAssessed: false,
  };

  // ── Structure summary from the story spine ──────────────
  const majorTurns = Array.isArray(spine.major_turns) ? spine.major_turns : [];
  const actBreaks = majorTurns
    .flatMap((item) => {
      const record = asRecord(item);
      const turn = asString(record?.turn).trim();
      const page = asFiniteNumber(record?.page);
      if (!turn) return [];
      return [page !== undefined ? `p.${page}: ${turn}` : turn];
    })
    .join(' · ');

  const models = asRecord(report.models) ?? {};

  return {
    id: generateId(sourceFile || title),
    projectId,
    title,
    author: '',
    collection,
    category: collectionToCategoryId(
      asString(wrapper?.collection ?? wrapper?.collection_id ?? ''),
      asString(wrapper?.category ?? ''),
    ),
    sourceFile: sourceFile || title,
    analysisModel: asString(models.coverage) || 'coverage_v1',
    analysisVersion: 'coverage_v1',
    producerProjection,
    weightedScore: 0,
    cvsTotal: 0,
    genre: canonicalizeGenre(asString(genre.primary)),
    subgenres: asString(genre.secondary).trim() ? [asString(genre.secondary).trim()] : [],
    themes: [],
    logline,
    tone: asString(genre.tone),
    recommendation,
    recommendationRationale: executiveSummary,
    verdictStatement,
    isFilmNow: false,
    filmNowAssessment: null,
    filmNowNominated,
    humanReviewRecommended,
    reviewReasons,
    uncertainties,
    lensGrades,
    language: asString(coverage.language) || undefined,
    dimensionScores,
    dimensionJustifications,
    commercialViability,
    criticalFailures: [],
    criticalFailureDetails: [],
    criticalFailureTotalPenalty: 0,
    majorWeaknesses,
    strengths,
    weaknesses,
    developmentNotes,
    marketability: 'medium',
    budgetCategory: 'unknown',
    budgetJustification: '',
    characters: {
      protagonist: asString(spine.protagonist),
      antagonist: asString(spine.opposition),
      supporting: [],
    },
    structureAnalysis: {
      formatQuality: 'professional',
      actBreaks,
      pacing: '',
    },
    comparableFilms: [],
    standoutScenes: [],
    targetAudience: {
      primaryDemographic: '',
      genderSkew: 'neutral',
      interests: [],
    },
    metadata: {
      filename: sourceFile || title,
      pageCount: asFiniteNumber(report.page_count) ?? 0,
      wordCount: asFiniteNumber(report.word_count) ?? 0,
    },
    producerMetrics: createProducerMetrics(),
    tmdbStatus: normalizeTmdbStatus(
      (wrapper?.tmdb_status ?? report.tmdb_status) as RawTmdbStatus | undefined,
    ),
    hasPdf:
      wrapper?.hasPdf === true ||
      typeof wrapper?.storage_path === 'string' ||
      typeof wrapper?._storagePath === 'string',
    storagePath: (() => {
      const value = wrapper?.storage_path ?? wrapper?._storagePath;
      return typeof value === 'string' && value.startsWith('gs://') ? value : undefined;
    })(),
  };
}
