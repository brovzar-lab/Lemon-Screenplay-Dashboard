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
import { storage, uploadScreenplayPdf } from './firebase';
import { ref, getBlob } from 'firebase/storage';
import { saveAnalysis } from './analysisStore';
import type { Screenplay } from '@/types';
import {
  runMultiReaderAnalysis,
  runTriage,
  type AnalysisOptions as MultiPassOptions,
  type AnalysisProgress as MultiPassProgress,
} from './multiPassAnalysis';
import { loadCalibrationProfile } from './feedbackStore';

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

  const parsed = await parsePDF(file, (pct) => {
    onProgress?.({ stage: 'parsing', percent: pct, message: `Parsing PDF... ${pct}%` });
  });

  onProgress?.({ stage: 'analyzing', percent: 0, message: 'Sending to AI for analysis...' });

  // All analysis goes through V9 Archaeology Engine
  return analyzeV9Path(parsed, category, options, onProgress);
}

// ─── V9 Multi-Reader Analysis Path ──────────────────────────────────────────

async function analyzeV9Path(
  parsed: ParsedPDF,
  category: string,
  options: AnalysisOptions,
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
  };

  onProgress?.({ stage: 'complete', percent: 100, message: 'V9 analysis complete!' });

  // Upload PDF to Firebase Storage (non-blocking)
  try {
    const title = (v9Result.analysis as Record<string, unknown>).title as string | undefined;
    await uploadScreenplayPdf(parsed.title + '.pdf' as unknown as File, category, title);
  } catch (err) {
    console.warn('[Firebase Storage] PDF upload failed:', err);
  }

  return {
    raw,
    parsed,
    usage: v9Result.totalUsage,
  };
}



// ─── Re-analyze from Firebase Storage ────────────────────────────────────────

/**
 * Re-analyze a screenplay by fetching its PDF from Firebase Storage.
 *
 * Flow:
 *   1. Reconstruct Storage path from screenplay metadata
 *   2. Fetch PDF → convert to File object
 *   3. Run full V9 Archaeology Engine analysis with chosen model
 *   4. Save to Firestore + localStorage (replaces old analysis)
 *   5. Return new analysis result
 */
export async function reanalyzeFromStorage(
  screenplay: Screenplay,
  model: 'sonnet' | 'opus' | 'haiku',
  onProgress?: (p: AnalysisProgress) => void,
  engineOptions?: { v9Mode?: 'full' | 'triage' },
): Promise<AnalysisResult> {
  onProgress?.({ stage: 'parsing', percent: 0, message: 'Fetching PDF from storage...' });

  // Reconstruct the Storage path (matches uploadScreenplayPdf in firebase.ts)
  const category = screenplay.category || 'OTHER';
  const safeName = (screenplay.title || screenplay.sourceFile || 'untitled')
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_');

  // Try primary path, then fallback without category
  // Use getBlob() instead of getDownloadURL+fetch to bypass CORS
  let blob: Blob;
  try {
    const primaryPath = `screenplays/${category}/${safeName}.pdf`;
    const fileRef = ref(storage, primaryPath);
    blob = await getBlob(fileRef);
  } catch {
    try {
      const fallbackRef = ref(storage, `screenplays/${safeName}.pdf`);
      blob = await getBlob(fallbackRef);
    } catch {
      throw new Error(
        `PDF not found in Firebase Storage for "${screenplay.title}". ` +
        `Upload the PDF first via the Upload panel.`
      );
    }
  }

  onProgress?.({ stage: 'parsing', percent: 30, message: 'PDF downloaded, parsing...' });

  const file = new File([blob], `${safeName}.pdf`, { type: 'application/pdf' });

  onProgress?.({ stage: 'parsing', percent: 40, message: 'Re-parsing PDF...' });

  // Run the full analysis pipeline
  let result: AnalysisResult;
  try {
    result = await analyzeScreenplay(
      file,
      category,
      {
        model: model === 'haiku' ? 'haiku' : model,
        lenses: ['commercial'],
        v9Mode: engineOptions?.v9Mode,
      },
      (p) => {
        // Map progress: parsing 40-50%, analyzing 50-95%
        if (p.stage === 'parsing') {
          onProgress?.({ ...p, percent: 40 + (p.percent * 0.1) });
        } else if (p.stage === 'analyzing') {
          onProgress?.({ ...p, percent: 50 + (p.percent * 0.45) });
        } else {
          onProgress?.(p);
        }
      },
    );
  } catch (analysisErr) {
    const msg = analysisErr instanceof Error ? analysisErr.message : 'Unknown error';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      throw new Error(
        `Network error during analysis. If using the API directly, ` +
        `ensure your Anthropic API key is valid and CORS is configured.`
      );
    }
    throw new Error(`Analysis failed: ${msg}`);
  }

  onProgress?.({ stage: 'analyzing', percent: 96, message: 'Saving new analysis...' });

  // Save results (replaces old entry by source_file key)
  await saveAnalysis(result.raw);

  onProgress?.({ stage: 'complete', percent: 100, message: 'Re-analysis complete!' });
  console.log(`[Lemon] Re-analyzed "${screenplay.title}" with ${model}`);

  return result;
}
