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
  type ReaderName,
  type ScriptMetadata,
} from './promptClient.v9';
import type { LensName } from './promptClient';
import type { ParsedPDF } from './pdfParser';
import { useToastStore } from '@/stores/toastStore';
import i18n from '@/i18n';
import {
  callLLM,
  ProxyCallError,
  type CallLLMProvenance,
} from './proxyClient';
import {
  attachVerifiedBrowserCitationQuality,
  buildBrowserContextPolicy,
  SourceContextError,
} from '@/lib/sourceEvidence';

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
  usage: { input_tokens: number; output_tokens: number };
  durationMs: number;
  provenance: CallLLMProvenance;
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
  totalUsage: { input_tokens: number; output_tokens: number };
  /** Total wall-clock duration */
  totalDurationMs: number;
  /** Analysis mode used */
  mode: AnalysisMode;
  modelId: string;
  provenance: CallLLMProvenance[];
}

export interface TriageResult {
  triage_score: number;
  verdict: string;
  genre: string;
  logline: string;
  should_deep_analyze: boolean;
  usage: { input_tokens: number; output_tokens: number };
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
const MAX_QUALITY_STAGE_ATTEMPTS = 3;
type TokenUsage = { input_tokens: number; output_tokens: number };

function mergeTokenUsage(left: TokenUsage, right: TokenUsage): TokenUsage {
  return {
    input_tokens: left.input_tokens + right.input_tokens,
    output_tokens: left.output_tokens + right.output_tokens,
  };
}

export class UnusableQualityOutputError extends Error {
  readonly usage: TokenUsage;

  constructor(message: string, usage: TokenUsage) {
    super(message);
    this.name = 'UnusableQualityOutputError';
    this.usage = usage;
  }
}

export class QualityStageExhaustedError extends Error {
  readonly stage: string;
  readonly attempts: number;
  readonly failures: string[];
  readonly usage: TokenUsage;

  constructor(
    stage: string,
    attempts: number,
    failures: string[],
    usage: TokenUsage,
  ) {
    super(`${stage} failed after ${attempts} attempts: ${failures.at(-1) ?? 'unknown failure'}`);
    this.name = 'QualityStageExhaustedError';
    this.stage = stage;
    this.attempts = attempts;
    this.failures = failures;
    this.usage = usage;
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
  readonly usage: TokenUsage;

  constructor(
    completedReaders: ReaderName[],
    failedReaders: ReaderName[],
    failureEvidence: Partial<Record<ReaderName, ReaderFailureEvidence>>,
    usage: TokenUsage,
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
  }
}

interface QualityRecoveryOptions {
  maxAttempts?: number;
  delay?: (milliseconds: number) => Promise<void>;
}

export async function runQualityStageWithRecovery<T>(
  stage: string,
  run: () => Promise<{ value: T; usage: TokenUsage }>,
  options: QualityRecoveryOptions = {},
): Promise<{
  value: T;
  usage: TokenUsage;
  attempts: number;
  failures: string[];
}> {
  const maxAttempts = options.maxAttempts ?? MAX_QUALITY_STAGE_ATTEMPTS;
  const delay = options.delay ?? (
    (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))
  );
  const failures: string[] = [];
  let usage: TokenUsage = { input_tokens: 0, output_tokens: 0 };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await run();
      usage = mergeTokenUsage(usage, result.usage);
      return {
        value: result.value,
        usage,
        attempts: attempt,
        failures,
      };
    } catch (error) {
      if (!(error instanceof UnusableQualityOutputError)) {
        throw error;
      }
      usage = mergeTokenUsage(usage, error.usage);
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
  );
}

export function requireCompleteReaderPanel(
  readers: ReaderName[],
  failureEvidence: Partial<Record<ReaderName, ReaderFailureEvidence>> = {},
  usage: TokenUsage = { input_tokens: 0, output_tokens: 0 },
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
    );
  }
}

function validateBrowserReaderReport(
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
  const metrics = Object.values(subScores as Record<string, unknown>);
  if (metrics.length === 0) {
    throw new Error(`${reader} reader returned no sub-score evidence.`);
  }
  for (const metric of metrics) {
    const score = metric && typeof metric === 'object'
      ? (metric as Record<string, unknown>).score
      : undefined;
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 10) {
      throw new Error(`${reader} reader returned an invalid sub-score.`);
    }
  }
}

export function validateBrowserSynthesis(report: Record<string, unknown>): void {
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
    || typeof report.verdict_before_adjustments !== 'string'
    || report.verdict_before_adjustments.trim().length === 0
  ) {
    throw new Error('Synthesis returned an incomplete verdict.');
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
  if (
    storyVerdict !== 'story'
    && storyVerdict !== 'borderline'
    && storyVerdict !== 'situation'
  ) {
    throw new Error('Synthesis returned an invalid story-vs-situation verdict.');
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
  if (!Array.isArray(report.critical_failures)) {
    throw new Error('Synthesis critical failures must be a list.');
  }
  const validFailureSeverities = new Set([
    'minor',
    'moderate',
    'major',
    'critical',
  ]);
  for (const [index, failure] of report.critical_failures.entries()) {
    if (!failure || typeof failure !== 'object' || Array.isArray(failure)) {
      throw new Error(`Synthesis critical failure ${index} is invalid.`);
    }
    const record = failure as Record<string, unknown>;
    if (typeof record.description !== 'string' || record.description.trim().length === 0) {
      throw new Error(`Synthesis critical failure ${index} has no description.`);
    }
    if (typeof record.severity !== 'string' || !validFailureSeverities.has(record.severity)) {
      throw new Error(`Synthesis critical failure ${index} has invalid severity.`);
    }
    if (
      typeof record.penalty !== 'number'
      || !Number.isFinite(record.penalty)
      || record.penalty < 0
    ) {
      throw new Error(`Synthesis critical failure ${index} has invalid penalty.`);
    }
  }
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

  // Use weights from READER_WEIGHTS as the authoritative source
  const WEIGHTS: Record<string, number> = {
    structure: 0.30,
    character: 0.30,
    craft_scene: 0.15,
    concept: 0.15,
    emotional_resonance: 0.10,
  };

  let total = 0;
  for (const [reader, weight] of Object.entries(WEIGHTS)) {
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

// ─── Anthropic API Call (with retry for network errors) ──────────────────────

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  maxTokens: number = 8000,
  retries: number = 3,
): Promise<{
  text: string;
  usage: { input_tokens: number; output_tokens: number };
  provenance: CallLLMProvenance;
}> {
  const modelId = modelIdForRoute(model);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await callLLM({
        model: modelId,
        prompt: userPrompt,
        systemPrompt,
        maxTokens,
      });

      return {
        text: result.text,
        usage: result.usage,
        provenance: result.provenance,
      };
    } catch (err: unknown) {
      // Detect server/network errors that are worth retrying
      const isRetryable =
        (err instanceof ProxyCallError && err.retryable) ||
        err instanceof TypeError ||
        (err instanceof Error && (
          err.message.includes('fetch failed') ||
          err.message.includes('ETIMEDOUT') ||
          err.message.includes('ECONNRESET') ||
          err.message.includes('network') ||
          err.message.includes('500') ||
          err.message.includes('503') ||
          err.message.includes('529')
        ));

      if (isRetryable && attempt < retries) {
        const wait = attempt * 5;
        console.warn(`[V9] Error, retrying in ${wait}s (attempt ${attempt}/${retries})...`);
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      throw err;
    }
  }
  // Should never reach here, but TypeScript needs a return
  throw new Error('callClaude: exhausted retries');
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
): Promise<TriageResult> {
  buildBrowserContextPolicy(parsed.text, 'haiku');
  const prompt = buildTriagePrompt(parsed.text, {
    title: parsed.title,
    pageCount: parsed.pageCount,
    wordCount: parsed.wordCount,
  });

  const { text, usage, provenance } = await callClaude(
    'You are a fast script reader doing a quick assessment.',
    prompt,
    'haiku',
    2000,
  );

  const result = parseClaudeJSON(text);
  const triageScore = (result.triage_score as number) ?? 0;

  return {
    triage_score: triageScore,
    verdict: (result.verdict as string) ?? '',
    genre: (result.genre as string) ?? '',
    logline: (result.logline as string) ?? '',
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
  triageImpression?: { triage_score: number; verdict: string; genre: string; logline: string },
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const model = options.model ?? 'sonnet';
  const contextPolicy = buildBrowserContextPolicy(parsed.text, model);
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

  const readerPrompts = buildAllReaderPrompts(parsed.text, metadata);
  const completedReaders: ReaderName[] = [];

  // Calibration is intentionally NOT injected into readers — readers use pure methodology.
  // Producer calibration is applied only at the synthesis stage so it affects verdict,
  // not the underlying pillar scoring.

  const readerPromises = readerPrompts.map(async (rp) => {
    const readerStart = Date.now();
    const recovered = await runQualityStageWithRecovery(
      `${rp.reader} reader`,
      async () => {
        const { text, usage, provenance } = await callClaude(
          rp.systemPrompt,
          rp.userPrompt,
          model,
          8000,
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
    } as ReaderResult;
  });

  const readerSettled = await Promise.allSettled(readerPromises);

  // Collect results, note failures
  const readerResults: ReaderResult[] = [];
  const failedReaders: ReaderName[] = [];
  const readerFailureEvidence: Partial<
    Record<ReaderName, ReaderFailureEvidence>
  > = {};
  let failedReaderUsage: TokenUsage = { input_tokens: 0, output_tokens: 0 };

  for (const [index, result] of readerSettled.entries()) {
    if (result.status === 'fulfilled') {
      readerResults.push(result.value);
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      const reader = readerPrompts[index].reader;
      failedReaders.push(reader);
      if (result.reason instanceof QualityStageExhaustedError) {
        readerFailureEvidence[reader] = {
          attempts: result.reason.attempts,
          failures: result.reason.failures,
        };
        failedReaderUsage = mergeTokenUsage(
          failedReaderUsage,
          result.reason.usage,
        );
      } else {
        readerFailureEvidence[reader] = {
          attempts: 1,
          failures: [reason],
        };
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
  const citationQuality = attachVerifiedBrowserCitationQuality(
    citationEnvelope,
    parsed.sourceEvidence,
  );

  const synthesisInput = buildSynthesisPrompt({
    title: parsed.title,
    readerReports,
    lenses,
    calibrationPrompt: options.calibrationPrompt,
    triageImpression,
  });

  const synthesisStart = Date.now();
  const synthesisRecovery = await runQualityStageWithRecovery(
    'synthesis roundtable',
    async () => {
      const { text, usage, provenance } = await callClaude(
        synthesisInput.systemPrompt,
        synthesisInput.userPrompt,
        model,
        12000,
      );
      try {
        const report = parseClaudeJSON(text);
        validateBrowserSynthesis(report);
        return { value: { report, provenance }, usage };
      } catch (error) {
        throw new UnusableQualityOutputError(
          error instanceof Error ? error.message : String(error),
          usage,
        );
      }
    },
  );
  const synthesis = synthesisRecovery.value.report;
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
  (synthesis as Record<string, unknown>).verdict = derived.verdict;
  (synthesis as Record<string, unknown>).weighted_score_adjusted = derived.adjustedScore;
  (synthesis as Record<string, unknown>).critical_failure_penalty_applied = derived.penalty;
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
  (synthesis as Record<string, unknown>)._citation_quality = citationQuality;
  (synthesis as Record<string, unknown>).analysis_version = 'v9_archaeology';
  (synthesis as Record<string, unknown>).analysis_mode = options.mode;

  // ── Compute totals ──

  const totalUsage = {
    input_tokens: readerResults.reduce((sum, r) => sum + r.usage.input_tokens, 0) + synthesisUsage.input_tokens,
    output_tokens: readerResults.reduce((sum, r) => sum + r.usage.output_tokens, 0) + synthesisUsage.output_tokens,
  };

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
      ...readerResults.map((result) => result.provenance),
      synthesisProvenance,
    ],
  };
}

// ─── Convenience: Full pipeline from ParsedPDF ──────────────────────────────

/**
 * Run V9 analysis with optional triage pre-filter.
 *
 * If mode is 'triage', runs only the quick Haiku pass.
 *
 * If mode is 'full', skips triage and runs all 5 readers + synthesis.
 * The hybrid compatibility path always runs the complete panel. Haiku is a
 * non-binding cold read and can never gate Sonnet scoring.
 */
export async function analyzeV9(
  parsed: ParsedPDF,
  options: AnalysisOptions,
  onProgress?: (p: AnalysisProgress) => void,
): Promise<AnalysisResult | TriageResult> {
  if (options.mode === 'triage') {
    return runTriage(parsed);
  }

  if (options.mode === 'full') {
    // Skip triage entirely — trust caller's decision to analyze
    return runMultiReaderAnalysis(parsed, options, onProgress);
  }

  // Hybrid compatibility mode: run triage first, then always enrich the panel.
  onProgress?.({
    stage: 'triage',
    percent: 2,
    message: 'Running triage pre-filter (Haiku)...',
    readersComplete: [],
  });

  let triage: TriageResult;
  try {
    triage = await runTriage(parsed);
  } catch (error) {
    if (error instanceof SourceContextError) {
      return runMultiReaderAnalysis(parsed, options, onProgress);
    }
    throw error;
  }

  // Pass triage impression to synthesis as a 6th cold-read data point
  const triageImpression = {
    triage_score: triage.triage_score,
    verdict: triage.verdict,
    genre: triage.genre,
    logline: triage.logline,
  };

  const panel = await runMultiReaderAnalysis(parsed, options, onProgress, triageImpression);
  return {
    ...panel,
    totalUsage: mergeTokenUsage(triage.usage, panel.totalUsage),
    provenance: [triage.provenance, ...panel.provenance],
  };
}
