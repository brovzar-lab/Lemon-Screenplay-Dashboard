/**
 * Analysis Service
 *
 * Orchestrates the full screenplay analysis pipeline:
 *   1. Parse PDF → extract text
 *   2. Call LLM via proxy (Firebase Cloud Function → LiteLLM)
 *   3. Return raw analysis JSON (V9 Archaeology Engine)
 *
 * All text AI calls route through the proxy client (proxyClient.ts).
 * API keys never touch the browser.
 */

import { parsePDF, type ParsedPDF } from './pdfParser';
import type { Screenplay } from '@/types';
import {
  runMultiReaderAnalysis,
  runTriage,
  type AnalysisOptions as MultiPassOptions,
  type AnalysisProgress as MultiPassProgress,
} from './multiPassAnalysis';
import { loadCalibrationProfile } from './feedbackStore';
import { buildVerifiedIdentity, computeContentHash } from './analysisIdentity';
import { queueScreenplayReanalysis, waitForQueuedReanalysis } from './reanalysisQueue';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AnalysisLens = 'latam' | 'commercial' | 'production' | 'coproduction';

export interface AnalysisOptions {
  model?: 'sonnet' | 'haiku' | 'opus';
  lenses?: AnalysisLens[];
  /** Firebase Cloud Function URL (for production). If absent, uses proxy client. */
  functionUrl?: string;
  /** Analysis version — always 'v9' (multi-reader archaeology engine) */
  analysisVersion?: 'v9';
  /** V9 mode: 'full' (5 readers + synthesis) or 'triage' (quick Haiku filter) */
  v9Mode?: 'full' | 'triage';
}

export interface AnalysisProgress {
  stage: 'parsing' | 'analyzing' | 'complete' | 'error';
  percent: number;
  message: string;
}

export interface AnalysisResult {
  /** Raw analysis wrapper */
  raw: Record<string, unknown>;
  /** Parsed PDF metadata */
  parsed: ParsedPDF;
  /** Token usage from Anthropic */
  usage?: { input_tokens: number; output_tokens: number };
}

// ─── Core public API ─────────────────────────────────────────────────────────

/**
 * Full analysis pipeline: parse PDF then analyze.
 */
export async function analyzeScreenplay(
  file: File,
  category: string,
  options: AnalysisOptions,
  onProgress?: (p: AnalysisProgress) => void,
): Promise<AnalysisResult> {
  // Stage 1 — Parse PDF
  onProgress?.({ stage: 'parsing', percent: 0, message: 'Parsing PDF...' });

  const queuedAtMs = Date.now();
  const contentHash = await computeContentHash(file);
  const parsed = await parsePDF(file, (pct) => {
    onProgress?.({ stage: 'parsing', percent: pct, message: `Parsing PDF... ${pct}%` });
  });

  onProgress?.({ stage: 'analyzing', percent: 0, message: 'Sending to AI for analysis...' });

  // All analysis goes through V9 Archaeology Engine
  return analyzeV9Path(parsed, category, options, contentHash, queuedAtMs, onProgress);
}

// ─── V9 Multi-Reader Analysis Path ──────────────────────────────────────────

async function analyzeV9Path(
  parsed: ParsedPDF,
  category: string,
  options: AnalysisOptions,
  contentHash: string,
  queuedAtMs: number,
  onProgress?: (p: AnalysisProgress) => void,
): Promise<AnalysisResult> {
  const v9Mode = options.v9Mode ?? 'full';
  const model = options.model === 'haiku' ? 'sonnet' : (options.model ?? 'sonnet') as 'sonnet' | 'opus';

  // Load calibration profile
  let calibrationPrompt: string | undefined;
  try {
    const profile = await loadCalibrationProfile();
    if (profile?.enabled && profile.calibrationPrompt) {
      calibrationPrompt = profile.calibrationPrompt;
    }
  } catch {
    // Calibration is optional
  }

  if (v9Mode === 'triage') {
    // Quick triage — single Haiku pass
    onProgress?.({ stage: 'analyzing', percent: 50, message: 'Running triage scan...' });

    const triageResult = await runTriage(parsed);

    const raw = {
      source_file: parsed.title.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf',
      analysis_model: 'claude-haiku',
      analysis_version: 'v9_triage',
      lenses_enabled: [],
      collection: category,
      metadata: {
        filename: parsed.title + '.pdf',
        page_count: parsed.pageCount,
        word_count: parsed.wordCount,
      },
      triage: triageResult,
      analysis: {
        title: parsed.title,
        triage_score: triageResult.triage_score,
        verdict: triageResult.verdict,
        genre: triageResult.genre,
        logline: triageResult.logline,
        should_deep_analyze: triageResult.should_deep_analyze,
      },
      queued_at_ms: queuedAtMs,
      ...buildVerifiedIdentity(contentHash),
    };

    onProgress?.({ stage: 'complete', percent: 100, message: `Triage complete: ${triageResult.triage_score}/10` });
    return { raw, parsed, usage: triageResult.usage };
  }

  // Full 5-reader + synthesis
  const v9Options: MultiPassOptions = {
    mode: 'full',
    model,
    lenses: options.lenses ?? ['commercial'],
    calibrationPrompt,
  };

  const v9Result = await runMultiReaderAnalysis(parsed, v9Options, (p: MultiPassProgress) => {
    onProgress?.({
      stage: p.stage === 'complete' ? 'complete' : 'analyzing',
      percent: p.percent,
      message: p.message,
    });
  });

  // Wrap in standard structure for compatibility
  const raw = {
    source_file: parsed.title.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf',
    analysis_model: `claude-${model}`,
    analysis_version: 'v9_archaeology',
    lenses_enabled: options.lenses ?? ['commercial'],
    collection: category,
    metadata: {
      filename: parsed.title + '.pdf',
      page_count: parsed.pageCount,
      word_count: parsed.wordCount,
    },
    analysis: v9Result.analysis,
    v9_meta: {
      reader_count: v9Result.readerResults.length,
      total_tokens: v9Result.totalUsage,
      total_duration_ms: v9Result.totalDurationMs,
      reader_durations: Object.fromEntries(
        v9Result.readerResults.map((r) => [r.reader, r.durationMs]),
      ),
    },
    queued_at_ms: queuedAtMs,
    ...buildVerifiedIdentity(contentHash),
  };

  onProgress?.({ stage: 'complete', percent: 100, message: 'V9 analysis complete!' });

  return {
    raw,
    parsed,
    usage: v9Result.totalUsage,
  };
}



// ─── Re-analyze from Firebase Storage ────────────────────────────────────────

/**
 * Re-analyze a screenplay through the authoritative VPS queue.
 *
 * Flow:
 *   1. Ask the authenticated queue function to copy the archived PDF
 *   2. Storage finalize creates a fresh ingest job targeting this project
 *   3. VPS runs the full V9 engine and writes the immutable version
 *   4. Browser observes the queue until the permanent V9 result completes
 */
export function assertPermanentAnalysisVersion(analysisVersion: unknown): void {
  if (analysisVersion !== 'v9_archaeology') {
    throw new Error(
      'Only complete V9 coverage can replace a permanent screenplay analysis.'
    );
  }
}

export async function reanalyzeFromStorage(
  screenplay: Screenplay,
  model: 'sonnet' | 'opus' | 'haiku',
  onProgress?: (p: AnalysisProgress) => void,
  engineOptions?: { v9Mode?: 'full' | 'triage' },
): Promise<void> {
  if (engineOptions?.v9Mode === 'triage') {
    throw new Error(
      'Triage-only results cannot replace full V9 coverage. Run a full re-analysis instead.'
    );
  }

  const projectId = screenplay.projectId;
  if (!projectId) {
    throw new Error(
      `"${screenplay.title}" predates immutable PDF archiving and cannot be re-analyzed safely.`
    );
  }

  onProgress?.({ stage: 'parsing', percent: 5, message: 'Queuing archived PDF on the VPS...' });
  const queued = await queueScreenplayReanalysis(
    projectId,
    model === 'opus' ? 'opus' : 'sonnet',
  );
  onProgress?.({ stage: 'analyzing', percent: 15, message: 'Waiting for the VPS analysis engine...' });
  const completed = await waitForQueuedReanalysis(queued.storagePath, (update) => {
    if (update.status === 'pending') {
      onProgress?.({ stage: 'analyzing', percent: 20, message: 'Re-analysis queued...' });
    } else if (update.status === 'processing') {
      onProgress?.({ stage: 'analyzing', percent: 60, message: 'VPS readers are analyzing...' });
    }
  });

  assertPermanentAnalysisVersion(completed.analysisVersion);
  onProgress?.({ stage: 'complete', percent: 100, message: 'Re-analysis complete!' });
  console.log(`[Lemon] VPS re-analysis completed for "${screenplay.title}" with ${model}`);
}
