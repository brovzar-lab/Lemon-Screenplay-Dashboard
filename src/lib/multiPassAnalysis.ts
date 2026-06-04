/**
 * Multi-Pass Analysis Orchestrator (V7)
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
} from './promptClient.v7';
import type { LensName } from './promptClient';
import type { ParsedPDF } from './pdfParser';
import { useToastStore } from '@/stores/toastStore';
import { callLLM } from './proxyClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export type V7AnalysisMode = 'full' | 'triage';

export interface V7AnalysisOptions {
  mode: V7AnalysisMode;
  model?: 'sonnet' | 'opus';
  lenses?: LensName[];
  calibrationPrompt?: string;
}

export interface V7AnalysisProgress {
  stage: 'triage' | 'readers' | 'synthesis' | 'complete' | 'error';
  percent: number;
  message: string;
  /** Which readers have completed (for progress tracking) */
  readersComplete?: ReaderName[];
}

export interface V7ReaderResult {
  reader: ReaderName;
  report: Record<string, unknown>;
  usage: { input_tokens: number; output_tokens: number };
  durationMs: number;
}

export interface V7AnalysisResult {
  /** The synthesized V7 analysis output */
  analysis: Record<string, unknown>;
  /** Individual reader reports for inspection */
  readerResults: V7ReaderResult[];
  /** Total token usage across all calls */
  totalUsage: { input_tokens: number; output_tokens: number };
  /** Total wall-clock duration */
  totalDurationMs: number;
  /** Analysis mode used */
  mode: V7AnalysisMode;
}

export interface V7TriageResult {
  triage_score: number;
  verdict: string;
  genre: string;
  logline: string;
  should_deep_analyze: boolean;
  usage: { input_tokens: number; output_tokens: number };
}

// ─── Model IDs ───────────────────────────────────────────────────────────────

const CLAUDE_MODELS: Record<string, string> = {
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
  opus: 'claude-opus-4-7',
};

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
function computeWeightedScoreFromSynthesis(
  synthesis: Record<string, unknown>,
): number {
  const pillarScores = synthesis.pillar_scores as
    | Record<string, { score?: number; weight?: number }>
    | undefined;
  if (!pillarScores) return 0;

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
    const score = pillarScores[reader]?.score ?? 0;
    total += score * weight;
  }
  return Math.round(total * 100) / 100;
}

// ─── Anthropic API Call (with retry for network errors) ──────────────────────

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  maxTokens: number = 8000,
  retries: number = 3,
): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number } }> {
  const modelId = CLAUDE_MODELS[model] || CLAUDE_MODELS.sonnet;

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
        usage: result.usage ?? { input_tokens: 0, output_tokens: 0 },
      };
    } catch (err: unknown) {
      // Detect server/network errors that are worth retrying
      const isRetryable =
        err instanceof TypeError ||
        (err instanceof Error && (
          err.message.includes('fetch failed') ||
          err.message.includes('ETIMEDOUT') ||
          err.message.includes('ECONNRESET') ||
          err.message.includes('network') ||
          err.message.includes('500') ||
          err.message.includes('502') ||
          err.message.includes('503') ||
          err.message.includes('529')
        ));

      if (isRetryable && attempt < retries) {
        const wait = attempt * 5;
        console.warn(`[V7] Error, retrying in ${wait}s (attempt ${attempt}/${retries})...`);
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
): Promise<V7TriageResult> {
  const prompt = buildTriagePrompt(parsed.text, {
    title: parsed.title,
    pageCount: parsed.pageCount,
    wordCount: parsed.wordCount,
  });

  const { text, usage } = await callClaude(
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
  };
}

// ─── Full Multi-Reader Analysis ──────────────────────────────────────────────

/**
 * Run the full 5-reader + synthesis pipeline.
 *
 * Pass 1–5: Five readers execute in parallel (Promise.allSettled).
 * Pass 6: Synthesis roundtable receives all 5 reports and produces consensus.
 *
 * Total: 6 API calls per script (~$1.00 at Sonnet pricing).
 */
export async function runMultiReaderAnalysis(
  parsed: ParsedPDF,
  options: V7AnalysisOptions,
  onProgress?: (p: V7AnalysisProgress) => void,
  triageImpression?: { triage_score: number; verdict: string; genre: string; logline: string },
): Promise<V7AnalysisResult> {
  const startTime = Date.now();
  const model = options.model ?? 'sonnet';
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

    const { text, usage } = await callClaude(
      rp.systemPrompt,
      rp.userPrompt,
      model,
      8000,
    );

    const report = parseClaudeJSON(text);

    // Compute pillar_score from sub_scores in code — do not trust AI arithmetic.
    // Readers return pillar_score: null; we fill it here with verified arithmetic.
    const computedPillar = computePillarScoreFromReport(report);
    if (computedPillar !== null) {
      report.pillar_score = computedPillar;
    }

    const durationMs = Date.now() - readerStart;

    completedReaders.push(rp.reader);
    const pct = 5 + Math.round((completedReaders.length / 5) * 65);

    onProgress?.({
      stage: 'readers',
      percent: pct,
      message: `${completedReaders.length}/5 readers complete (${rp.reader})`,
      readersComplete: [...completedReaders],
    });

    return {
      reader: rp.reader,
      report,
      usage,
      durationMs,
    } as V7ReaderResult;
  });

  const readerSettled = await Promise.allSettled(readerPromises);

  // Collect results, note failures
  const readerResults: V7ReaderResult[] = [];
  const failedReaders: string[] = [];

  for (const result of readerSettled) {
    if (result.status === 'fulfilled') {
      readerResults.push(result.value);
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failedReaders.push(reason);
      console.error('[V7] Reader failed:', reason);
    }
  }

  if (readerResults.length < 3) {
    // Need at least 3 readers to produce meaningful synthesis
    useToastStore.getState().addToast(
      `Multi-reader analysis failed: only ${readerResults.length}/5 readers completed. ${failedReaders.join('; ')}`,
    );
    throw new Error(`Insufficient reader results: ${readerResults.length}/5 completed`);
  }

  if (failedReaders.length > 0) {
    console.warn(`[V7] ${failedReaders.length} reader(s) failed, proceeding with ${readerResults.length} results`);
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

  const synthesisInput = buildSynthesisPrompt({
    title: parsed.title,
    readerReports,
    lenses,
    calibrationPrompt: options.calibrationPrompt,
    triageImpression,
  });

  const synthesisStart = Date.now();

  const { text: synthesisText, usage: synthesisUsage } = await callClaude(
    synthesisInput.systemPrompt,
    synthesisInput.userPrompt,
    model,
    12000,
  );

  const synthesis = parseClaudeJSON(synthesisText);
  const synthesisDurationMs = Date.now() - synthesisStart;

  // Override AI-computed weighted_score with verified arithmetic from code.
  // This prevents synthesis arithmetic errors from affecting the final verdict.
  const computedWeightedScore = computeWeightedScoreFromSynthesis(synthesis);
  if (computedWeightedScore > 0) {
    (synthesis as Record<string, unknown>).weighted_score = computedWeightedScore;
    // Log if AI and code disagree by more than 0.1
    const aiScore = synthesis.weighted_score as number | undefined;
    if (aiScore !== undefined && Math.abs(aiScore - computedWeightedScore) > 0.1) {
      console.warn(
        `[V7] Synthesis weighted_score mismatch: AI said ${aiScore}, computed ${computedWeightedScore}. Using computed.`
      );
    }
  }

  // Attach full reader reports to synthesis output for transparency
  (synthesis as Record<string, unknown>).reader_reports = readerReports;
  (synthesis as Record<string, unknown>).analysis_version = 'v7_archaeology';
  (synthesis as Record<string, unknown>).analysis_mode = options.mode;

  // ── Compute totals ──

  const totalUsage = {
    input_tokens: readerResults.reduce((sum, r) => sum + r.usage.input_tokens, 0) + synthesisUsage.input_tokens,
    output_tokens: readerResults.reduce((sum, r) => sum + r.usage.output_tokens, 0) + synthesisUsage.output_tokens,
  };

  const totalDurationMs = Date.now() - startTime;

  console.log(
    `[V7] Analysis complete: ${readerResults.length} readers + synthesis in ${(totalDurationMs / 1000).toFixed(1)}s. ` +
    `Tokens: ${totalUsage.input_tokens} in, ${totalUsage.output_tokens} out. ` +
    `Synthesis took ${(synthesisDurationMs / 1000).toFixed(1)}s.`,
  );

  if (failedReaders.length > 0) {
    (synthesis as Record<string, unknown>).failed_readers = failedReaders;
  }

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
  };
}

// ─── Convenience: Full pipeline from ParsedPDF ──────────────────────────────

/**
 * Run V7/V8 analysis with optional triage pre-filter.
 *
 * If mode is 'triage', runs the quick Haiku pass and returns early
 * if the score is below threshold (6.0).
 *
 * If mode is 'full', skips triage and runs all 5 readers + synthesis.
 * If mode is 'hybrid' (or default), runs triage first, then if score >= 6.0,
 * passes the triage result to synthesis as a 6th cold-read data point.
 */
export async function analyzeV7(
  parsed: ParsedPDF,
  options: V7AnalysisOptions,
  onProgress?: (p: V7AnalysisProgress) => void,
): Promise<V7AnalysisResult | V7TriageResult> {
  if (options.mode === 'triage') {
    return runTriage(parsed);
  }

  if (options.mode === 'full') {
    // Skip triage entirely — trust caller's decision to analyze
    return runMultiReaderAnalysis(parsed, options, onProgress);
  }

  // Default / hybrid mode: run triage first, use result to gate and enrich
  onProgress?.({
    stage: 'triage',
    percent: 2,
    message: 'Running triage pre-filter (Haiku)...',
    readersComplete: [],
  });

  const triage = await runTriage(parsed);

  if (!triage.should_deep_analyze) {
    // Below threshold — return triage result only, do not spend Sonnet
    return triage;
  }

  // Pass triage impression to synthesis as a 6th cold-read data point
  const triageImpression = {
    triage_score: triage.triage_score,
    verdict: triage.verdict,
    genre: triage.genre,
    logline: triage.logline,
  };

  return runMultiReaderAnalysis(parsed, options, onProgress, triageImpression);
}
