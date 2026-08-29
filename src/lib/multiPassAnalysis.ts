/**
 * Multi-Pass Analysis Orchestrator (V9)
 *
 * Runs the Screenplay Archaeology Engine pipeline:
 *   Pass 0: Extraction (metadata — handled by pdfParser already)
 *   Pass 1–5: Five readers in parallel (Sonnet)
 *   Pass 6: Synthesis roundtable (Sonnet)
 *
 * Also supports Triage mode for bulk ingestion (single Haiku pass).
 */

import {
  buildAllReaderPrompts,
  buildSynthesisPrompt,
  buildTriagePrompt,
  READER_METRICS,
  READER_WEIGHTS,
  UNTRUSTED_SCREENPLAY_INSTRUCTION,
  type ReaderName,
  type ScriptMetadata,
} from './promptClient.v9';
import type { LensName } from './promptClient';
import type { ParsedPDF } from './pdfParser';
import { useToastStore } from '@/stores/toastStore';
import i18n from '@/i18n';
import {
  callLLM,
  type CallLLMProvenance,
  type CallLLMUsage,
} from './proxyClient';
import {
  attachVerifiedBrowserCitationQuality,
  buildBrowserContextPolicy,
  extractTitlePageAuthor,
  SourceContextError,
} from '@/lib/sourceEvidence';
import {
  buildFalsePositiveTrapEvidence,
  evaluateFalsePositiveTrapTriggers,
  V9_TRAP_CONTRACT,
} from './v9TrapContract';
import {
  buildBrowserGenreCard,
  canonicalGenreOutput,
  validateBrowserGenreDetection,
  type BrowserGenreDetection,
} from './v9GenreContract';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AnalysisMode = 'full' | 'triage' | 'hybrid';

export interface AnalysisOptions {
  mode: AnalysisMode;
  model?: 'sonnet' | 'opus';
  lenses?: LensName[];
  calibrationPrompt?: string;
}

export interface AnalysisProgress {
  stage: 'triage' | 'readers' | 'synthesis' | 'complete' | 'error';
  percent: number;
  message: string;
  /** Which readers have completed (for progress tracking) */
  readersComplete?: ReaderName[];
}

export interface ReaderResult {
  reader: ReaderName;
  report: Record<string, unknown>;
  usage: TrackedUsage;
  durationMs: number;
  provenance: CallLLMProvenance;
  attemptProvenance: QualityCallProvenance[];
}

export function notifyIncompleteReaderPanel(
  completedReaders: number,
  failedReaders: readonly ReaderName[],
): void {
  useToastStore.getState().addToast(i18n.t('toast.analysis_partial_readers', {
    completed: completedReaders,
    expected: 5,
    missing: failedReaders.join(', '),
  }));
}

export interface AnalysisResult {
  /** The synthesized V9 analysis output */
  analysis: Record<string, unknown>;
  /** Individual reader reports for inspection */
  readerResults: ReaderResult[];
  /** Total token usage across all calls */
  totalUsage: TrackedUsage;
  /** Total wall-clock duration */
  totalDurationMs: number;
  /** Analysis mode used */
  mode: AnalysisMode;
  modelId: string;
  provenance: QualityCallProvenance[];
}

export interface TriageResult {
  triage_score: number;
  verdict: string;
  genre: string;
  genre_detection: BrowserGenreDetection;
  logline: string;
  should_deep_analyze: boolean;
  usage: CallLLMUsage;
  provenance: CallLLMProvenance;
}

// ─── Model IDs ───────────────────────────────────────────────────────────────

const CLAUDE_MODELS = {
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
  opus: 'claude-opus-4-7',
};

function modelIdForRoute(model: string): string {
  const modelId = CLAUDE_MODELS[model as keyof typeof CLAUDE_MODELS];
  if (!modelId) throw new Error(`Unknown analysis route: ${model}`);
  return modelId;
}

const CANONICAL_READERS: readonly ReaderName[] = [
  'structure',
  'character',
  'craft_scene',
  'concept',
  'emotional_resonance',
];
const FALSE_POSITIVE_TRAPS = new Map(
  V9_TRAP_CONTRACT.traps.map((trap) => [trap.name, {
    tier: trap.tier,
    weight: trap.weight,
  }]),
);
const FALSE_POSITIVE_TRAP_DEFINITIONS = new Map(
  V9_TRAP_CONTRACT.traps.map((trap) => [trap.name, trap]),
);
const STORY_VS_SITUATION_FIELDS = [
  'human_condition',
  'tests_character',
  'twists_reveal_character',
  'emotional_shift',
  'moral_component_driven',
] as const;
const CHARACTER_NOT_IDENTIFIED = 'Not identified';
const MAX_QUALITY_STAGE_ATTEMPTS = 3;
export type TrackedUsage = Pick<CallLLMUsage, 'input_tokens' | 'output_tokens'>
  & Partial<Omit<CallLLMUsage, 'input_tokens' | 'output_tokens'>>;
type QualityStage = 'triage' | 'reader' | 'synthesis';
type QualityCallContext = {
  stage: QualityStage;
  reader_name: ReaderName | null;
  attempt: number;
};
export type QualityCallProvenance = CallLLMProvenance & {
  stage: QualityStage;
  reader_name: ReaderName | null;
  attempt: number;
  disposition: 'used' | 'discarded_unusable';
  usage: TrackedUsage;
};

function qualityCallProvenance(
  provenance: CallLLMProvenance,
  usage: TrackedUsage,
  context: QualityCallContext,
  disposition: QualityCallProvenance['disposition'],
): QualityCallProvenance {
  return { ...provenance, ...context, disposition, usage };
}

function mergeTokenUsage(left: TrackedUsage, right: TrackedUsage): TrackedUsage {
  const optionalTotal = (field: keyof Omit<CallLLMUsage, 'input_tokens' | 'output_tokens'>) => {
    const leftValue = left[field];
    const rightValue = right[field];
    return typeof leftValue === 'number' || typeof rightValue === 'number'
      ? (leftValue ?? 0) + (rightValue ?? 0)
      : undefined;
  };
  const cacheCreation = optionalTotal('cache_creation_input_tokens');
  const cacheRead = optionalTotal('cache_read_input_tokens');
  const costMicrousd = optionalTotal('actual_cost_microusd');
  const costUsd = optionalTotal('actual_cost_usd');
  return {
    input_tokens: left.input_tokens + right.input_tokens,
    output_tokens: left.output_tokens + right.output_tokens,
    ...(cacheCreation !== undefined ? { cache_creation_input_tokens: cacheCreation } : {}),
    ...(cacheRead !== undefined ? { cache_read_input_tokens: cacheRead } : {}),
    ...(costMicrousd !== undefined ? { actual_cost_microusd: costMicrousd } : {}),
    ...(costUsd !== undefined ? { actual_cost_usd: costUsd } : {}),
  };
}

export function attachPriorQualityEvidence(
  error: unknown,
  usage: TrackedUsage,
  provenance: QualityCallProvenance[],
): void {
  if (!(error instanceof Error)) return;
  const evidenceError = error as Error & {
    usage?: TrackedUsage;
    provenance?: QualityCallProvenance[];
  };
  evidenceError.usage = mergeTokenUsage(
    usage,
    evidenceError.usage ?? { input_tokens: 0, output_tokens: 0 },
  );
  evidenceError.provenance = [
    ...provenance,
    ...(evidenceError.provenance ?? []),
  ];
}

export class UnusableQualityOutputError extends Error {
  readonly usage: TrackedUsage;
  readonly provenance?: QualityCallProvenance;

  constructor(
    message: string,
    usage: TrackedUsage,
    provenance?: QualityCallProvenance,
  ) {
    super(message);
    this.name = 'UnusableQualityOutputError';
    this.usage = usage;
    this.provenance = provenance;
  }
}

export class QualityStageExhaustedError extends Error {
  readonly stage: string;
  readonly attempts: number;
  readonly failures: string[];
  readonly usage: TrackedUsage;
  readonly provenance: QualityCallProvenance[];

  constructor(
    stage: string,
    attempts: number,
    failures: string[],
    usage: TrackedUsage,
    provenance: QualityCallProvenance[],
  ) {
    super(`${stage} failed after ${attempts} attempts: ${failures.at(-1) ?? 'unknown failure'}`);
    this.name = 'QualityStageExhaustedError';
    this.stage = stage;
    this.attempts = attempts;
    this.failures = failures;
    this.usage = usage;
    this.provenance = provenance;
  }
}

interface ReaderFailureEvidence {
  attempts: number;
  failures: string[];
}

export class ReaderPanelIncompleteError extends Error {
  readonly completedReaders: ReaderName[];
  readonly failedReaders: ReaderName[];
  readonly failureEvidence: Partial<Record<ReaderName, ReaderFailureEvidence>>;
  readonly usage: TrackedUsage;
  readonly provenance: QualityCallProvenance[];

  constructor(
    completedReaders: ReaderName[],
    failedReaders: ReaderName[],
    failureEvidence: Partial<Record<ReaderName, ReaderFailureEvidence>>,
    usage: TrackedUsage,
    provenance: QualityCallProvenance[] = [],
  ) {
    super(
      `Q3 requires 5/5 readers before synthesis. Missing: ${
        failedReaders.join(', ') || 'none'
      }.`,
    );
    this.name = 'ReaderPanelIncompleteError';
    this.completedReaders = completedReaders;
    this.failedReaders = failedReaders;
    this.failureEvidence = failureEvidence;
    this.usage = usage;
    this.provenance = provenance;
  }
}

interface QualityRecoveryOptions {
  maxAttempts?: number;
  delay?: (milliseconds: number) => Promise<void>;
}

export async function runQualityStageWithRecovery<T>(
  stage: string,
  run: (attempt: number) => Promise<{ value: T; usage: TrackedUsage }>,
  options: QualityRecoveryOptions = {},
): Promise<{
  value: T;
  usage: TrackedUsage;
  attempts: number;
  failures: string[];
  discardedProvenance: QualityCallProvenance[];
  successfulUsage: TrackedUsage;
}> {
  const maxAttempts = options.maxAttempts ?? MAX_QUALITY_STAGE_ATTEMPTS;
  const delay = options.delay ?? (
    (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))
  );
  const failures: string[] = [];
  let usage: TrackedUsage = { input_tokens: 0, output_tokens: 0 };
  const discardedProvenance: QualityCallProvenance[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await run(attempt);
      usage = mergeTokenUsage(usage, result.usage);
      return {
        value: result.value,
        usage,
        attempts: attempt,
        failures,
        discardedProvenance,
        successfulUsage: result.usage,
      };
    } catch (error) {
      if (!(error instanceof UnusableQualityOutputError)) {
        if (error && typeof error === 'object') {
          (error as { qualityAttempts?: number }).qualityAttempts = attempt;
        }
        attachPriorQualityEvidence(error, usage, discardedProvenance);
        throw error;
      }
      usage = mergeTokenUsage(usage, error.usage);
      if (error.provenance) {
        discardedProvenance.push(error.provenance);
      }
      const message = error instanceof Error ? error.message : String(error);
      failures.push(message);
      if (attempt < maxAttempts) {
        await delay(attempt * 5_000);
      }
    }
  }

  throw new QualityStageExhaustedError(
    stage,
    maxAttempts,
    failures,
    usage,
    discardedProvenance,
  );
}

export function requireCompleteReaderPanel(
  readers: ReaderName[],
  failureEvidence: Partial<Record<ReaderName, ReaderFailureEvidence>> = {},
  usage: TrackedUsage = { input_tokens: 0, output_tokens: 0 },
  provenance: QualityCallProvenance[] = [],
): void {
  const completed = new Set(readers);
  const missing = CANONICAL_READERS.filter((reader) => !completed.has(reader));
  const hasDuplicates = completed.size !== readers.length;
  if (
    readers.length !== CANONICAL_READERS.length
    || hasDuplicates
    || missing.length > 0
  ) {
    throw new ReaderPanelIncompleteError(
      readers,
      missing,
      failureEvidence,
      usage,
      provenance,
    );
  }
}

function canonicalStoryVsSituation(
  characterReport: Record<string, unknown>,
): Record<string, unknown> {
  const raw = characterReport.story_vs_situation;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Character reader returned no story-vs-situation evidence.');
  }
  const evidence = raw as Record<string, unknown>;
  for (const field of STORY_VS_SITUATION_FIELDS) {
    if (typeof evidence[field] !== 'boolean') {
      throw new Error(`Character reader returned invalid story-vs-situation ${field}.`);
    }
  }
  const storyEvidence = evidence.evidence;
  if (!storyEvidence || typeof storyEvidence !== 'object' || Array.isArray(storyEvidence)) {
    throw new Error('Character reader returned no story-vs-situation citation evidence.');
  }
  for (const field of STORY_VS_SITUATION_FIELDS) {
    validateCitationBlock(
      `Character reader story-vs-situation ${field}`,
      (storyEvidence as Record<string, unknown>)[field],
    );
  }
  const total = STORY_VS_SITUATION_FIELDS.reduce(
    (score, field) => score + (evidence[field] ? 1 : 0),
    0,
  );
  return {
    ...Object.fromEntries(STORY_VS_SITUATION_FIELDS.map((field) => [field, evidence[field]])),
    evidence: storyEvidence,
    total,
    verdict: total <= 2 ? 'situation' : total === 3 ? 'borderline' : 'story',
  };
}

function validateCitationBlock(label: string, value: unknown): void {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
  const citations = record?.page_citations;
  const evidence = record?.citation_evidence;
  if (!Array.isArray(citations) || citations.length === 0 || !Array.isArray(evidence) || evidence.length === 0) {
    throw new Error(`${label} returned incomplete citation evidence.`);
  }
  const evidencePages = evidence.map((item) => (
    item && typeof item === 'object' && !Array.isArray(item)
      ? (item as Record<string, unknown>).page
      : undefined
  ));
  if (
    citations.some((page) => !Number.isInteger(page))
    || evidencePages.some((page) => !Number.isInteger(page))
    || [...citations].sort().join(',') !== [...evidencePages].sort().join(',')
    || evidence.some((item) => {
      const excerpt = item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>).excerpt
        : undefined;
      return typeof excerpt !== 'string' || excerpt.trim().split(/\s+/).length < 4;
    })
  ) {
    throw new Error(`${label} returned invalid citation evidence.`);
  }
}

function validateCharacterEvidence(
  label: string,
  name: unknown,
  value: unknown,
): void {
  const evidence = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
  if (typeof name !== 'string' || name.trim().length === 0 || !evidence) {
    throw new Error(`${label} character evidence is incomplete.`);
  }
  if (evidence.kind === 'not_identified') {
    if (
      name !== CHARACTER_NOT_IDENTIFIED
      || !Array.isArray(evidence.page_citations)
      || evidence.page_citations.length !== 0
      || !Array.isArray(evidence.citation_evidence)
      || evidence.citation_evidence.length !== 0
    ) {
      throw new Error(`${label} not-identified evidence is invalid.`);
    }
    return;
  }
  if (evidence.kind !== 'person' && evidence.kind !== 'non_person_force') {
    throw new Error(`${label} character evidence has an invalid kind.`);
  }
  validateCitationBlock(`${label} character`, evidence);
  if (evidence.kind === 'person') {
    const normalize = (text: string) => text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
    const excerpts = (evidence.citation_evidence as Array<Record<string, unknown>>)
      .map((item) => String(item.excerpt ?? ''))
      .join(' ');
    const normalizedName = normalize(name);
    if (!normalizedName || !normalize(excerpts).includes(normalizedName)) {
      throw new Error(`${label} character name is absent from its evidence.`);
    }
  }
}

export function validateBrowserReaderReport(
  reader: ReaderName,
  report: Record<string, unknown>,
): void {
  if (report.reader !== reader) {
    throw new Error(`Reader identity mismatch for ${reader}.`);
  }
  const subScores = report.sub_scores;
  if (!subScores || typeof subScores !== 'object' || Array.isArray(subScores)) {
    throw new Error(`${reader} reader returned no sub-score evidence.`);
  }
  const subScoreRecord = subScores as Record<string, unknown>;
  const metricNames = Object.keys(subScoreRecord).sort();
  const expectedMetricNames = [...READER_METRICS[reader]].sort();
  if (
    metricNames.length !== expectedMetricNames.length
    || metricNames.some((name, index) => name !== expectedMetricNames[index])
  ) {
    throw new Error(`${reader} reader returned an incomplete metric set.`);
  }
  for (const metric of Object.values(subScoreRecord)) {
    const record = metric && typeof metric === 'object' && !Array.isArray(metric)
      ? metric as Record<string, unknown>
      : undefined;
    const score = record
      ? record.score
      : undefined;
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 10) {
      throw new Error(`${reader} reader returned an invalid sub-score.`);
    }
    validateCitationBlock(`${reader} reader`, record);
  }
  if (reader === 'character') {
    report.story_vs_situation = canonicalStoryVsSituation(report);
  }
}

export function validateBrowserSynthesis(
  report: Record<string, unknown>,
  readerReports: Record<ReaderName, Record<string, unknown>>,
  sourceTitle: string,
  sourceAuthor: string,
  genreDetection: BrowserGenreDetection,
): void {
  if (sourceTitle.trim().length === 0 || sourceAuthor.trim().length === 0) {
    throw new Error('Source-backed screenplay identity is missing.');
  }
  report.title = sourceTitle;
  report.author = sourceAuthor;
  const canonicalGenre = canonicalGenreOutput(
    validateBrowserGenreDetection(genreDetection),
  );
  report.genre = canonicalGenre.genre;
  report.subgenres = canonicalGenre.subgenres;
  report.genre_detection = genreDetection;
  if (report.analysis_version !== 'v9_archaeology') {
    throw new Error('Synthesis returned an invalid analysis version.');
  }
  const requiredStrings = [
    'title',
    'author',
    'genre',
    'tone',
    'logline',
    'executive_summary',
  ];
  for (const field of requiredStrings) {
    if (typeof report[field] !== 'string' || (report[field] as string).trim().length === 0) {
      throw new Error(`Synthesis returned an empty ${field}.`);
    }
  }
  for (const field of ['subgenres', 'themes', 'strengths', 'weaknesses']) {
    if (!Array.isArray(report[field])) {
      throw new Error(`Synthesis returned invalid ${field}.`);
    }
  }
  for (const [field, minimum] of [
    ['themes', 2],
    ['strengths', 4],
    ['weaknesses', 1],
  ] as const) {
    const values = report[field] as unknown[];
    if (
      values.length < minimum
      || values.some((value) => typeof value !== 'string' || value.trim().length === 0)
    ) {
      throw new Error(`Synthesis returned incomplete ${field}.`);
    }
  }
  for (const field of ['comparable_films', 'characters']) {
    if (!report[field] || typeof report[field] !== 'object' || Array.isArray(report[field])) {
      throw new Error(`Synthesis returned invalid ${field}.`);
    }
  }
  const comparables = report.comparable_films as Record<string, unknown>;
  for (const kind of ['tone', 'structure', 'market']) {
    const comparable = comparables[kind];
    if (!comparable || typeof comparable !== 'object' || Array.isArray(comparable)) {
      throw new Error(`Synthesis returned an invalid ${kind} comparable film.`);
    }
    const record = comparable as Record<string, unknown>;
    if (
      typeof record.title !== 'string'
      || record.title.trim().length === 0
      || typeof record.structural_match !== 'string'
      || record.structural_match.trim().length === 0
      || typeof record.key_divergence !== 'string'
      || record.key_divergence.trim().length === 0
    ) {
      throw new Error(`Synthesis returned an incomplete ${kind} comparable film.`);
    }
  }
  const characters = report.characters as Record<string, unknown>;
  validateCharacterEvidence(
    'Protagonist',
    characters.protagonist,
    characters.protagonist_evidence,
  );
  validateCharacterEvidence(
    'Antagonist',
    characters.antagonist,
    characters.antagonist_evidence,
  );
  const supporting = characters.supporting;
  const supportingEvidence = characters.supporting_evidence;
  if (
    !Array.isArray(supporting)
    || !Array.isArray(supportingEvidence)
    || supporting.length !== supportingEvidence.length
    || supporting.some((name) => typeof name !== 'string' || name.trim().length === 0)
  ) {
    throw new Error('Synthesis returned incomplete character evidence.');
  }
  supporting.forEach((name, index) => {
    const evidence = supportingEvidence[index];
    if (
      !evidence
      || typeof evidence !== 'object'
      || Array.isArray(evidence)
      || (evidence as Record<string, unknown>).name !== name
    ) {
      throw new Error('Synthesis returned mismatched supporting character evidence.');
    }
    validateCharacterEvidence(`Supporting character ${index}`, name, evidence);
  });
  if (
    typeof report.critical_failure_total_penalty !== 'number'
    || !Number.isFinite(report.critical_failure_total_penalty)
    || report.critical_failure_total_penalty < 0
  ) {
    throw new Error('Synthesis returned an invalid critical failure total penalty.');
  }
  const pillarScores = report.pillar_scores;
  if (!pillarScores || typeof pillarScores !== 'object' || Array.isArray(pillarScores)) {
    throw new Error('Synthesis returned no pillar scores.');
  }
  const missing = CANONICAL_READERS.filter(
    (reader) => !(reader in (pillarScores as Record<string, unknown>)),
  );
  if (missing.length > 0) {
    throw new Error(`Synthesis omitted reader pillars: ${missing.join(', ')}.`);
  }
  for (const reader of CANONICAL_READERS) {
    const pillar = (pillarScores as Record<string, unknown>)[reader];
    const score = pillar && typeof pillar === 'object' && !Array.isArray(pillar)
      ? (pillar as Record<string, unknown>).score
      : undefined;
    if (
      typeof score !== 'number'
      || !Number.isFinite(score)
      || score < 0
      || score > 10
    ) {
      throw new Error(`Synthesis returned an invalid ${reader} pillar score.`);
    }
  }
  if (
    typeof report.weighted_score !== 'number'
    || !Number.isFinite(report.weighted_score)
    || report.weighted_score < 0
    || report.weighted_score > 10
  ) {
    throw new Error('Synthesis returned an invalid weighted score.');
  }
  if (
    typeof report.verdict !== 'string'
    || report.verdict.trim().length === 0
  ) {
    throw new Error('Synthesis returned an invalid verdict.');
  }
  if (
    !report.story_vs_situation
    || typeof report.story_vs_situation !== 'object'
    || Array.isArray(report.story_vs_situation)
  ) {
    throw new Error('Synthesis returned invalid story-vs-situation evidence.');
  }
  const storyVerdict = (
    report.story_vs_situation as Record<string, unknown>
  ).verdict;
  const storyScore = (
    report.story_vs_situation as Record<string, unknown>
  ).score;
  const storyGate = (
    report.story_vs_situation as Record<string, unknown>
  ).gate_applied;
  if (
    storyVerdict !== 'story'
    && storyVerdict !== 'borderline'
    && storyVerdict !== 'situation'
  ) {
    throw new Error('Synthesis returned an invalid story-vs-situation verdict.');
  }
  if (
    typeof storyScore !== 'number'
    || !Number.isInteger(storyScore)
    || storyScore < 0
    || storyScore > 5
    || typeof storyGate !== 'boolean'
  ) {
    throw new Error('Synthesis returned incomplete story-vs-situation evidence.');
  }
  if (
    !report.false_positive_check
    || typeof report.false_positive_check !== 'object'
    || Array.isArray(report.false_positive_check)
  ) {
    throw new Error('Synthesis returned invalid false-positive evidence.');
  }
  const weightedTrapScore = (
    report.false_positive_check as Record<string, unknown>
  ).weighted_trap_score;
  if (typeof weightedTrapScore !== 'number' || !Number.isFinite(weightedTrapScore)) {
    throw new Error('Synthesis returned an invalid weighted trap score.');
  }
  const falsePositive = report.false_positive_check as Record<string, unknown>;
  const traps = falsePositive.traps_evaluated;
  if (!Array.isArray(traps) || traps.length !== FALSE_POSITIVE_TRAPS.size) {
    throw new Error('Synthesis returned incomplete false-positive traps.');
  }
  const computedTrapTriggers = evaluateFalsePositiveTrapTriggers(readerReports);
  const seenTraps = new Set<string>();
  let computedTrapScore = 0;
  for (const trap of traps) {
    if (!trap || typeof trap !== 'object' || Array.isArray(trap)) {
      throw new Error('Synthesis returned invalid false-positive traps.');
    }
    const record = trap as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name : '';
    const expected = FALSE_POSITIVE_TRAPS.get(name);
    if (
      !expected
      || seenTraps.has(name)
      || record.tier !== expected.tier
      || record.weight !== expected.weight
      || typeof record.triggered !== 'boolean'
      || typeof record.evidence !== 'string'
      || record.evidence.trim().length === 0
    ) {
      throw new Error(`Synthesis returned invalid false-positive trap ${name || 'entry'}.`);
    }
    seenTraps.add(name);
    const triggered = computedTrapTriggers.get(name) ?? false;
    record.triggered = triggered;
    record.evidence = buildFalsePositiveTrapEvidence(
      FALSE_POSITIVE_TRAP_DEFINITIONS.get(name)!,
      readerReports,
      triggered,
    );
    if (record.triggered) computedTrapScore += expected.weight;
  }
  falsePositive.weighted_trap_score = computedTrapScore;
  falsePositive.trap_contract_version = V9_TRAP_CONTRACT.version;
  falsePositive.verdict_adjustment = computedTrapScore >= 3
    ? 'cap_consider'
    : computedTrapScore >= 2
      ? 'downgrade_one'
      : 'none';
  const characterStory = canonicalStoryVsSituation(readerReports.character);
  report.story_vs_situation = {
    score: characterStory.total,
    verdict: characterStory.verdict,
    gate_applied: characterStory.verdict === 'situation',
    evidence: characterStory.evidence,
  };
  if (!Array.isArray(report.critical_failures)) {
    throw new Error('Synthesis critical failures must be a list.');
  }
  const linkedWeaknesses = new Set<number>();
  const weaknesses = report.weaknesses as string[];
  if (report.critical_failures.length >= weaknesses.length) {
    throw new Error('Synthesis critical failures must be a strict subset of weaknesses.');
  }
  for (const [index, failure] of report.critical_failures.entries()) {
    if (!failure || typeof failure !== 'object' || Array.isArray(failure)) {
      throw new Error(`Synthesis critical failure ${index} is invalid.`);
    }
    const record = failure as Record<string, unknown>;
    if (typeof record.description !== 'string' || record.description.trim().length === 0) {
      throw new Error(`Synthesis critical failure ${index} has no description.`);
    }
    const weaknessIndex = record.weakness_index;
    if (
      typeof weaknessIndex !== 'number'
      || !Number.isInteger(weaknessIndex)
      || weaknessIndex < 0
      || weaknessIndex >= weaknesses.length
      || linkedWeaknesses.has(weaknessIndex)
      || record.description.trim() !== weaknesses[weaknessIndex].trim()
    ) {
      throw new Error(`Synthesis critical failure ${index} is not linked to a unique weakness.`);
    }
    linkedWeaknesses.add(weaknessIndex);
    const failureReader = record.reader;
    const failureMetric = record.metric;
    if (
      typeof failureReader !== 'string'
      || !CANONICAL_READERS.includes(failureReader as ReaderName)
      || typeof failureMetric !== 'string'
    ) {
      throw new Error(`Synthesis critical failure ${index} has no canonical reader metric.`);
    }
    const failureSubScores = readerReports[failureReader as ReaderName].sub_scores;
    const failureEvidence = failureSubScores && typeof failureSubScores === 'object' && !Array.isArray(failureSubScores)
      ? (failureSubScores as Record<string, unknown>)[failureMetric]
      : undefined;
    if (!failureEvidence) {
      throw new Error(`Synthesis critical failure ${index} has no canonical reader metric.`);
    }
    validateCitationBlock(`Synthesis critical failure ${index}`, failureEvidence);
    const evidenceRecord = failureEvidence as Record<string, unknown>;
    const severity = deriveFailureSeverity(evidenceRecord.score);
    if (!severity) {
      throw new Error(`Synthesis critical failure ${index} metric score is above 4.`);
    }
    record.severity = severity;
    record.penalty = FAILURE_PENALTIES[severity];
  }
  report.critical_failure_total_penalty = computeFailurePenalty(report.critical_failures);
  applyCanonicalReaderPillars(report, readerReports);
  report.weighted_score = computeWeightedScoreFromSynthesis(report);
  report.verdict_before_adjustments = deriveVerdict({
    weightedScore: report.weighted_score as number,
  }).verdict;
}

// ─── Score Arithmetic (computed in code, not by the AI) ──────────────────────

/**
 * Compute pillar_score from sub_scores returned by a reader.
 * The AI is instructed to return pillar_score: null; we compute it here
 * to prevent arithmetic errors from propagating into the synthesis.
 */
function computePillarScoreFromReport(report: Record<string, unknown>): number | null {
  const subScores = report.sub_scores;
  if (!subScores || typeof subScores !== 'object') return null;
  const values = Object.values(subScores as Record<string, unknown>)
    .map((v) => {
      if (v && typeof v === 'object' && typeof (v as Record<string, unknown>).score === 'number') {
        return (v as Record<string, unknown>).score as number;
      }
      return null;
    })
    .filter((n): n is number => n !== null && !isNaN(n));
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

export function applyCanonicalReaderPillars(
  synthesis: Record<string, unknown>,
  readerReports: Record<ReaderName, Record<string, unknown>>,
): void {
  synthesis.pillar_scores = Object.fromEntries(CANONICAL_READERS.map((reader) => {
    const score = readerReports[reader]?.pillar_score;
    if (
      typeof score !== 'number'
      || !Number.isFinite(score)
      || score < 0
      || score > 10
    ) {
      throw new Error(`Cannot canonicalize an invalid ${reader} reader pillar.`);
    }
    return [reader, { score, weight: READER_WEIGHTS[reader] }];
  }));
}

/**
 * Compute the final weighted score from synthesis pillar scores.
 * Overrides the AI-computed weighted_score with verified arithmetic.
 */
export function computeWeightedScoreFromSynthesis(
  synthesis: Record<string, unknown>,
): number {
  const pillarScores = synthesis.pillar_scores as
    | Record<string, { score?: number; weight?: number }>
    | undefined;
  if (!pillarScores) {
    throw new Error('Cannot compute a score without all five synthesis pillars.');
  }

  let total = 0;
  for (const [reader, weight] of Object.entries(READER_WEIGHTS)) {
    const score = pillarScores[reader]?.score;
    if (
      typeof score !== 'number'
      || !Number.isFinite(score)
      || score < 0
      || score > 10
    ) {
      throw new Error(`Cannot compute a score without a valid ${reader} pillar.`);
    }
    total += score * weight;
  }
  return Math.round(total * 100) / 100;
}

// ─── Code-Side Verdict Derivation ────────────────────────────────────────────
// Mirrors derive_verdict() in execution/ingest_v9.py. The synthesis prompt
// instructs the model to apply the critical-failure penalty and the
// situation/trap gates, but nothing enforced them — and the weighted-score
// override above silently discarded the penalty. The model proposes; this
// code disposes.

const VERDICT_TIERS = ['PASS', 'CONSIDER', 'RECOMMEND', 'FILM_NOW'] as const;
export type VerdictTier = (typeof VERDICT_TIERS)[number];

// Must match the synthesis prompt: MINOR -0.3, MODERATE -0.5, MAJOR -0.8,
// CRITICAL -1.2, total capped at -3.0.
const FAILURE_PENALTIES: Record<string, number> = {
  minor: 0.3,
  moderate: 0.5,
  major: 0.8,
  critical: 1.2,
};
const MAX_FAILURE_PENALTY = 3.0;

function deriveFailureSeverity(metricScore: unknown): string | null {
  if (
    typeof metricScore !== 'number'
    || !Number.isFinite(metricScore)
    || metricScore < 0
    || metricScore > 10
  ) {
    throw new Error('Critical-failure metric score is invalid.');
  }
  if (metricScore > 4) return null;
  if (metricScore > 3) return 'minor';
  if (metricScore > 2) return 'moderate';
  if (metricScore > 1) return 'major';
  return 'critical';
}

export function computeFailurePenalty(criticalFailures: unknown): number {
  if (!Array.isArray(criticalFailures)) return 0;
  let total = 0;
  for (const item of criticalFailures) {
    if (!item || typeof item !== 'object') continue;
    const severity = String((item as Record<string, unknown>).severity ?? '').toLowerCase();
    total += FAILURE_PENALTIES[severity] ?? 0;
  }
  return Math.round(Math.min(total, MAX_FAILURE_PENALTY) * 100) / 100;
}

function scoreToTier(score: number): VerdictTier {
  if (score >= 8.5) return 'FILM_NOW';
  if (score >= 7.5) return 'RECOMMEND';
  if (score >= 5.5) return 'CONSIDER';
  return 'PASS';
}

function capTier(tier: VerdictTier, cap: VerdictTier): VerdictTier {
  return VERDICT_TIERS.indexOf(tier) > VERDICT_TIERS.indexOf(cap) ? cap : tier;
}

export interface DerivedVerdict {
  verdict: VerdictTier;
  verdictBeforeGates: VerdictTier;
  adjustedScore: number;
  penalty: number;
  adjustments: string[];
}

export function deriveVerdict(params: {
  weightedScore: number;
  criticalFailures?: unknown;
  situationVerdict?: string;
  weightedTrapScore?: number;
  truncated?: boolean;
}): DerivedVerdict {
  const { weightedScore, criticalFailures, situationVerdict = '', weightedTrapScore = 0, truncated = false } = params;
  const adjustments: string[] = [];

  const penalty = computeFailurePenalty(criticalFailures);
  const adjusted = Math.round(Math.max(0, weightedScore - penalty) * 100) / 100;
  if (penalty > 0) {
    adjustments.push(`critical_failure_penalty: -${penalty} (${weightedScore} → ${adjusted})`);
  }

  let verdict = scoreToTier(adjusted);
  const verdictBeforeGates = verdict;

  if (situationVerdict.toLowerCase() === 'situation') {
    const capped = capTier(verdict, 'CONSIDER');
    if (capped !== verdict) adjustments.push(`story_vs_situation gate: ${verdict} → ${capped}`);
    verdict = capped;
  }

  if (weightedTrapScore >= 3.0) {
    const capped = capTier(verdict, 'CONSIDER');
    if (capped !== verdict) adjustments.push(`trap score ${weightedTrapScore} >= 3.0: ${verdict} → ${capped}`);
    verdict = capped;
  } else if (weightedTrapScore >= 2.0) {
    const idx = VERDICT_TIERS.indexOf(verdict);
    if (idx > 0) {
      const downgraded = VERDICT_TIERS[idx - 1];
      adjustments.push(`trap score ${weightedTrapScore} >= 2.0: ${verdict} → ${downgraded}`);
      verdict = downgraded;
    }
  }

  if (truncated) {
    const capped = capTier(verdict, 'CONSIDER');
    if (capped !== verdict) adjustments.push(`truncated script (Act 3 unread): ${verdict} → ${capped}`);
    verdict = capped;
  }

  return { verdict, verdictBeforeGates, adjustedScore: adjusted, penalty, adjustments };
}

// ─── Anthropic API Call ───────────────────────────────────────────────────────

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  maxTokens: number = 8000,
  retries: number = 3,
  context?: QualityCallContext,
): Promise<{
  text: string;
  usage: CallLLMUsage;
  provenance: CallLLMProvenance;
}> {
  const modelId = modelIdForRoute(model);
  void retries;
  let result;
  try {
    result = await callLLM({
      model: modelId,
      prompt: userPrompt,
      systemPrompt,
      maxTokens,
    });
  } catch (error) {
    if (context && error && typeof error === 'object') {
      const attached = error as { provenance?: Array<Record<string, unknown>> };
      attached.provenance?.forEach((call) => Object.assign(call, context));
    }
    throw error;
  }
  return {
    text: result.text,
    usage: result.usage,
    provenance: result.provenance,
  };
}

// ─── JSON Sanitization + Parsing ─────────────────────────────────────────────

/**
 * Strip illegal control characters (U+0000..U+001F) from a string,
 * preserving only whitespace chars (\t \n \r) that are legal in JSON strings.
 *
 * LLMs occasionally emit unescaped control chars (e.g. form-feeds, vertical tabs)
 * inside quoted JSON values, which causes `JSON.parse` to throw
 * "Bad control character in string literal".
 */
function sanitizeForJSON(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function parseClaudeJSON(text: string): Record<string, unknown> {
  const sanitized = sanitizeForJSON(text);

  // Try direct parse first
  try {
    return JSON.parse(sanitized);
  } catch {
    // Extract first complete JSON object using brace counting
    const startIdx = sanitized.indexOf('{');
    if (startIdx === -1) throw new Error('No JSON found in response');

    let depth = 0;
    let endIdx = -1;
    let inString = false;
    let escape = false;

    for (let i = startIdx; i < sanitized.length; i++) {
      const ch = sanitized[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }

    if (endIdx === -1) throw new Error('Incomplete JSON in response');
    return JSON.parse(sanitized.slice(startIdx, endIdx + 1));
  }
}

// ─── Triage Mode ─────────────────────────────────────────────────────────────

export function validateBrowserTriage(result: Record<string, unknown>): void {
  if (
    typeof result.triage_score !== 'number'
    || !Number.isFinite(result.triage_score)
    || result.triage_score < 0
    || result.triage_score > 10
  ) {
    throw new Error('Triage returned an invalid score.');
  }
  for (const field of ['verdict', 'logline']) {
    if (typeof result[field] !== 'string' || result[field].trim().length === 0) {
      throw new Error(`Triage returned an empty ${field}.`);
    }
  }
  const genreDetection = validateBrowserGenreDetection(result.genre_detection);
  result.genre_detection = genreDetection;
  result.genre = canonicalGenreOutput(genreDetection).genre;
  const verdict = (result.verdict as string)
    .trim()
    .toUpperCase()
    .replace(/[ -]+/g, '_');
  if (!['PASS', 'CONSIDER', 'RECOMMEND', 'FILM_NOW'].includes(verdict)) {
    throw new Error('Triage returned an invalid verdict.');
  }
  if (typeof result.should_deep_analyze !== 'boolean') {
    throw new Error('Triage returned an invalid deep-analysis flag.');
  }
  result.verdict = verdict;
  result.should_deep_analyze = result.triage_score >= 6;
}

/**
 * Quick-read triage using Haiku — scores 1-10 and decides
 * whether the script deserves full 5-reader analysis.
 * ~$0.05/script, <15 seconds.
 *
 * Threshold: score >= 6.0 (median produced film) to qualify for deep analysis.
 * Score of 5 = below average — not worth full Sonnet spend.
 */
export async function runTriage(
  parsed: ParsedPDF,
  model: 'haiku' | 'sonnet' = 'haiku',
): Promise<TriageResult> {
  buildBrowserContextPolicy(parsed.text, model);
  const prompt = buildTriagePrompt(parsed.text, {
    title: parsed.title,
    pageCount: parsed.pageCount,
    wordCount: parsed.wordCount,
  });

  const { text, usage, provenance } = await callClaude(
    `${UNTRUSTED_SCREENPLAY_INSTRUCTION}\n\nYou are a fast script reader doing a quick assessment.`,
    prompt,
    model,
    2000,
    3,
    { stage: 'triage', reader_name: null, attempt: 1 },
  );

  let result: Record<string, unknown>;
  try {
    result = parseClaudeJSON(text);
    validateBrowserTriage(result);
  } catch (error) {
    throw new UnusableQualityOutputError(
      error instanceof Error ? error.message : String(error),
      usage,
      qualityCallProvenance(
        provenance,
        usage,
        { stage: 'triage', reader_name: null, attempt: 1 },
        'discarded_unusable',
      ),
    );
  }
  const triageScore = result.triage_score as number;

  return {
    triage_score: triageScore,
    verdict: result.verdict as string,
    genre: result.genre as string,
    genre_detection: result.genre_detection as BrowserGenreDetection,
    logline: result.logline as string,
    // Raised from 5 to 6: a 5 is "below average" — spend Sonnet on median or above
    should_deep_analyze: triageScore >= 6.0,
    usage,
    provenance,
  };
}

// ─── Full Multi-Reader Analysis ──────────────────────────────────────────────

/**
 * Run the full 5-reader + synthesis pipeline.
 *
 * Pass 1–5: Five readers execute in parallel (Promise.allSettled).
 * Pass 6: Synthesis roundtable receives all 5 reports and produces consensus.
 *
 * Total: 6 API calls per script. The server ledger supplies exact cost.
 */
export async function runMultiReaderAnalysis(
  parsed: ParsedPDF,
  options: AnalysisOptions,
  onProgress?: (p: AnalysisProgress) => void,
  triageImpression?: {
    triage_score: number;
    verdict: string;
    genre: string;
    logline: string;
    genreDetection: BrowserGenreDetection;
  },
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const model = options.model ?? 'sonnet';
  const contextPolicy = buildBrowserContextPolicy(parsed.text, model);
  const authorEvidence = extractTitlePageAuthor(parsed.text);
  const lenses = options.lenses ?? ['commercial'];
  const metadata: ScriptMetadata = {
    title: parsed.title,
    pageCount: parsed.pageCount,
    wordCount: parsed.wordCount,
  };

  // ── Pass 1–5: Run all 5 readers in parallel ──

  onProgress?.({
    stage: 'readers',
    percent: 5,
    message: 'Launching 5 readers in parallel...',
    readersComplete: [],
  });

  if (!triageImpression) {
    throw new Error('Full V9 analysis requires a validated genre cold read.');
  }
  const readerPrompts = buildAllReaderPrompts(
    parsed.text,
    metadata,
    buildBrowserGenreCard(triageImpression.genreDetection),
  );
  const completedReaders: ReaderName[] = [];

  // Calibration is intentionally NOT injected into readers — readers use pure methodology.
  // Producer calibration is applied only at the synthesis stage so it affects verdict,
  // not the underlying pillar scoring.

  const readerPromises = readerPrompts.map(async (rp) => {
    const readerStart = Date.now();
    const recovered = await runQualityStageWithRecovery(
      `${rp.reader} reader`,
      async (qualityAttempt) => {
        const { text, usage, provenance } = await callClaude(
          rp.systemPrompt,
          rp.userPrompt,
          model,
          8000,
          3,
          { stage: 'reader', reader_name: rp.reader, attempt: qualityAttempt },
        );
        try {
          const report = parseClaudeJSON(text);
          validateBrowserReaderReport(rp.reader, report);

          // Compute pillar_score from sub_scores in code. A report without
          // usable arithmetic is retried and never reaches synthesis.
          const computedPillar = computePillarScoreFromReport(report);
          if (computedPillar === null) {
            throw new Error(`${rp.reader} reader returned no usable score evidence.`);
          }
          report.pillar_score = computedPillar;
          return { value: { report, provenance }, usage };
        } catch (error) {
          throw new UnusableQualityOutputError(
            error instanceof Error ? error.message : String(error),
            usage,
            qualityCallProvenance(
              provenance,
              usage,
              { stage: 'reader', reader_name: rp.reader, attempt: qualityAttempt },
              'discarded_unusable',
            ),
          );
        }
      },
    );

    const durationMs = Date.now() - readerStart;

    completedReaders.push(rp.reader);
    const pct = 5 + Math.round((completedReaders.length / 5) * 65);

    onProgress?.({
      stage: 'readers',
      percent: pct,
      message: `${completedReaders.length}/5 readers complete (${rp.reader}${
        recovered.attempts > 1 ? `, recovered on attempt ${recovered.attempts}` : ''
      })`,
      readersComplete: [...completedReaders],
    });

    return {
      reader: rp.reader,
      report: recovered.value.report,
      usage: recovered.usage,
      durationMs,
      provenance: recovered.value.provenance,
      attemptProvenance: [
        ...recovered.discardedProvenance,
        qualityCallProvenance(
          recovered.value.provenance,
          recovered.successfulUsage,
          { stage: 'reader', reader_name: rp.reader, attempt: recovered.attempts },
          'used',
        ),
      ],
    } as ReaderResult;
  });

  const readerSettled = await Promise.allSettled(readerPromises);

  // Collect results, note failures
  const readerResults: ReaderResult[] = [];
  const failedReaders: ReaderName[] = [];
  const readerFailureEvidence: Partial<
    Record<ReaderName, ReaderFailureEvidence>
  > = {};
  let failedReaderUsage: TrackedUsage = { input_tokens: 0, output_tokens: 0 };
  const failedReaderProvenance: QualityCallProvenance[] = [];

  for (const [index, result] of readerSettled.entries()) {
    if (result.status === 'fulfilled') {
      readerResults.push(result.value);
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      const reader = readerPrompts[index].reader;
      const attached = result.reason && typeof result.reason === 'object'
        ? result.reason as {
          usage?: TrackedUsage;
          provenance?: QualityCallProvenance[];
          qualityAttempts?: number;
        }
        : {};
      failedReaders.push(reader);
      if (result.reason instanceof QualityStageExhaustedError) {
        readerFailureEvidence[reader] = {
          attempts: result.reason.attempts,
          failures: result.reason.failures,
        };
      } else {
        readerFailureEvidence[reader] = {
          attempts: attached.qualityAttempts ?? 1,
          failures: [reason],
        };
      }
      if (
        attached.usage
        && typeof attached.usage.input_tokens === 'number'
        && typeof attached.usage.output_tokens === 'number'
      ) {
        failedReaderUsage = mergeTokenUsage(failedReaderUsage, attached.usage);
      }
      if (Array.isArray(attached.provenance)) {
        failedReaderProvenance.push(...attached.provenance);
      }
      console.error(`[V9] ${reader} reader failed:`, reason);
    }
  }

  const readerPanelUsage = readerResults.reduce(
    (usage, result) => mergeTokenUsage(usage, result.usage),
    failedReaderUsage,
  );
  try {
    requireCompleteReaderPanel(
      readerResults.map((result) => result.reader),
      readerFailureEvidence,
      readerPanelUsage,
      [
        ...readerResults.flatMap((result) => result.attemptProvenance),
        ...failedReaderProvenance,
      ],
    );
  } catch (error) {
    notifyIncompleteReaderPanel(readerResults.length, failedReaders);
    throw error;
  }

  // ── Pass 6: Synthesis roundtable ──

  onProgress?.({
    stage: 'synthesis',
    percent: 75,
    message: 'Running synthesis roundtable...',
    readersComplete: completedReaders,
  });

  const readerReports = Object.fromEntries(
    readerResults.map((r) => [r.reader, r.report]),
  ) as Record<ReaderName, Record<string, unknown>>;
  const citationEnvelope: Record<string, unknown> = {
    reader_reports: readerReports,
  };
  try {
    attachVerifiedBrowserCitationQuality(
      citationEnvelope,
      parsed.sourceEvidence,
    );
  } catch (error) {
    attachPriorQualityEvidence(
      error,
      readerPanelUsage,
      readerResults.flatMap((result) => result.attemptProvenance),
    );
    throw error;
  }

  const synthesisInput = buildSynthesisPrompt({
    title: parsed.title,
    sourceAuthor: authorEvidence.author,
    readerReports,
    lenses,
    calibrationPrompt: options.calibrationPrompt,
    triageImpression,
  });

  const synthesisStart = Date.now();
  const synthesisRecovery = await runQualityStageWithRecovery(
    'synthesis roundtable',
    async (qualityAttempt) => {
      const { text, usage, provenance } = await callClaude(
        synthesisInput.systemPrompt,
        synthesisInput.userPrompt,
        model,
        12000,
        3,
        { stage: 'synthesis', reader_name: null, attempt: qualityAttempt },
      );
      try {
        const report = parseClaudeJSON(text);
        validateBrowserSynthesis(
          report,
          readerReports,
          parsed.title,
          authorEvidence.author,
          triageImpression.genreDetection,
        );
        return { value: { report, provenance }, usage };
      } catch (error) {
        throw new UnusableQualityOutputError(
          error instanceof Error ? error.message : String(error),
          usage,
          qualityCallProvenance(
            provenance,
            usage,
            { stage: 'synthesis', reader_name: null, attempt: qualityAttempt },
            'discarded_unusable',
          ),
        );
      }
    },
  ).catch((error) => {
    attachPriorQualityEvidence(
      error,
      readerPanelUsage,
      readerResults.flatMap((result) => result.attemptProvenance),
    );
    throw error;
  });
  const synthesis = synthesisRecovery.value.report;
  synthesis._author_evidence = authorEvidence;
  synthesis._title_evidence = { source: 'input_filename', title: parsed.title };
  const synthesisProvenance = synthesisRecovery.value.provenance;
  const synthesisUsage = synthesisRecovery.usage;
  const synthesisDurationMs = Date.now() - synthesisStart;

  // Override AI-computed weighted_score with verified arithmetic from code.
  // This prevents synthesis arithmetic errors from affecting the final verdict.
  const computedWeightedScore = computeWeightedScoreFromSynthesis(synthesis);
  // Log if AI and code disagree by more than 0.1
  const aiScore = synthesis.weighted_score as number;
  if (Math.abs(aiScore - computedWeightedScore) > 0.1) {
    console.warn(
      `[V9] Synthesis weighted_score mismatch: AI said ${aiScore}, computed ${computedWeightedScore}. Using computed.`
    );
  }
  (synthesis as Record<string, unknown>).weighted_score = computedWeightedScore;

  // Derive the verdict in code from the structured synthesis outputs —
  // restores the critical-failure penalty and enforces the situation/trap/
  // truncation gates that were previously prompt-only.
  const fpCheck = (synthesis.false_positive_check ?? {}) as Record<string, unknown>;
  const svs = (synthesis.story_vs_situation ?? {}) as Record<string, unknown>;
  const derived = deriveVerdict({
    weightedScore: (synthesis.weighted_score as number) ?? 0,
    criticalFailures: synthesis.critical_failures,
    situationVerdict: String(svs.verdict ?? ''),
    weightedTrapScore: Number(fpCheck.weighted_trap_score ?? 0),
    truncated: false,
  });
  const modelVerdict = String(synthesis.verdict ?? '');
  if (modelVerdict && modelVerdict !== derived.verdict) {
    console.warn(
      `[V9] Verdict mismatch: AI said ${modelVerdict}, code derived ${derived.verdict} ` +
      `(adjusted ${derived.adjustedScore}; ${derived.adjustments.join('; ') || 'no gates'}). Using code value.`
    );
  }
  (synthesis as Record<string, unknown>).verdict_model = modelVerdict;
  (synthesis as Record<string, unknown>).verdict_before_adjustments = deriveVerdict({
    weightedScore: synthesis.weighted_score as number,
  }).verdict;
  (synthesis as Record<string, unknown>).verdict = derived.verdict;
  (synthesis as Record<string, unknown>).weighted_score_adjusted = derived.adjustedScore;
  (synthesis as Record<string, unknown>).critical_failure_penalty_applied = derived.penalty;
  (synthesis as Record<string, unknown>).critical_failure_total_penalty = derived.penalty;
  (synthesis as Record<string, unknown>).verdict_adjustments = derived.adjustments;
  (synthesis as Record<string, unknown>)._truncation = {
    truncated: false,
    chars_lost: 0,
    approx_pages_lost: 0,
  };
  (synthesis as Record<string, unknown>)._context_policy = {
    context_policy_version: contextPolicy.contextPolicyVersion,
    source_truncated: contextPolicy.sourceTruncated,
    input_characters: contextPolicy.inputCharacters,
    estimated_input_tokens: contextPolicy.estimatedInputTokens,
    primary_model: contextPolicy.primaryModel,
    primary_model_safe_input_tokens: contextPolicy.safeInputTokens,
    model_context_tokens: {
      [contextPolicy.primaryModel]: contextPolicy.modelContextTokens,
    },
  };
  (synthesis as Record<string, unknown>).analysis_quality = {
    status: 'complete',
    completed_readers: readerResults.length,
    expected_readers: readerPrompts.length,
    failed_readers: [],
  };
  (synthesis as Record<string, unknown>).failed_reader_errors = {};

  // Attach full reader reports to synthesis output for transparency
  (synthesis as Record<string, unknown>).reader_reports = readerReports;
  try {
    attachVerifiedBrowserCitationQuality(synthesis, parsed.sourceEvidence);
  } catch (error) {
    attachPriorQualityEvidence(
      error,
      mergeTokenUsage(readerPanelUsage, synthesisUsage),
      [
        ...readerResults.flatMap((result) => result.attemptProvenance),
        ...synthesisRecovery.discardedProvenance,
        qualityCallProvenance(
          synthesisProvenance,
          synthesisRecovery.successfulUsage,
          { stage: 'synthesis', reader_name: null, attempt: synthesisRecovery.attempts },
          'used',
        ),
      ],
    );
    throw error;
  }
  (synthesis as Record<string, unknown>).analysis_version = 'v9_archaeology';
  (synthesis as Record<string, unknown>).analysis_mode = options.mode;

  // ── Compute totals ──

  const totalUsage = mergeTokenUsage(readerPanelUsage, synthesisUsage);

  const totalDurationMs = Date.now() - startTime;

  console.log(
    `[V9] Analysis complete: ${readerResults.length} readers + synthesis in ${(totalDurationMs / 1000).toFixed(1)}s. ` +
    `Tokens: ${totalUsage.input_tokens} in, ${totalUsage.output_tokens} out. ` +
    `Synthesis took ${(synthesisDurationMs / 1000).toFixed(1)}s.`,
  );

  onProgress?.({
    stage: 'complete',
    percent: 100,
    message: `Analysis complete! Verdict: ${(synthesis as Record<string, string>).verdict ?? 'unknown'}`,
    readersComplete: completedReaders,
  });

  return {
    analysis: synthesis,
    readerResults,
    totalUsage,
    totalDurationMs,
    mode: options.mode,
    modelId: modelIdForRoute(model),
    provenance: [
      ...readerResults.flatMap((result) => result.attemptProvenance),
      ...synthesisRecovery.discardedProvenance,
      qualityCallProvenance(
        synthesisProvenance,
        synthesisRecovery.successfulUsage,
        { stage: 'synthesis', reader_name: null, attempt: synthesisRecovery.attempts },
        'used',
      ),
    ],
  };
}

// ─── Convenience: Full pipeline from ParsedPDF ──────────────────────────────

/**
 * Run V9 analysis with optional triage pre-filter.
 *
 * If mode is 'triage', runs only the quick Haiku pass.
 *
 * Complete modes run a validated non-binding cold read before all 5 readers +
 * synthesis. Its free-form genre impression can inform, but is not a canonical
 * genre classification and never gates Sonnet scoring.
 */
export async function analyzeV9(
  parsed: ParsedPDF,
  options: AnalysisOptions,
  onProgress?: (p: AnalysisProgress) => void,
): Promise<AnalysisResult | TriageResult> {
  if (options.mode === 'triage') {
    return runTriage(parsed);
  }

  // Complete modes run triage first, then always enrich the full panel.
  onProgress?.({
    stage: 'triage',
    percent: 2,
    message: 'Running validated genre cold read...',
    readersComplete: [],
  });

  let genreModel: 'haiku' | 'sonnet' = 'haiku';
  try {
    buildBrowserContextPolicy(parsed.text, genreModel);
  } catch (error) {
    if (!(error instanceof SourceContextError)) throw error;
    genreModel = 'sonnet';
    buildBrowserContextPolicy(parsed.text, genreModel);
  }
  const triage = await runTriage(parsed, genreModel);

  // Pass triage impression to synthesis as a 6th cold-read data point
  const triageImpression = {
    triage_score: triage.triage_score,
    verdict: triage.verdict,
    genre: triage.genre,
    logline: triage.logline,
    genreDetection: triage.genre_detection,
  };

  const triageProvenance = qualityCallProvenance(
    triage.provenance,
    triage.usage,
    { stage: 'triage', reader_name: null, attempt: 1 },
    'used',
  );
  const panel = await runMultiReaderAnalysis(
    parsed,
    options,
    onProgress,
    triageImpression,
  ).catch((error) => {
    attachPriorQualityEvidence(error, triage.usage, [triageProvenance]);
    throw error;
  });
  panel.analysis.genre_detection = triage.genre_detection;
  panel.analysis._cold_read = {
    used_in_synthesis: true,
    evidence: {
      triage_score: triage.triage_score,
      verdict: triage.verdict.toLowerCase(),
      genre: triage.genre,
      logline: triage.logline,
      model_route: genreModel,
    },
    response_ids: [triage.provenance.responseId],
  };
  return {
    ...panel,
    totalUsage: mergeTokenUsage(triage.usage, panel.totalUsage),
    provenance: [
      triageProvenance,
      ...panel.provenance,
    ],
  };
}
