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
import { uploadScreenplayPdf } from './firebase';
import { saveAnalysis } from './analysisStore';
import type { Screenplay } from '@/types';
import {
  runMultiReaderAnalysis,
  runTriage,
  type V7AnalysisOptions,
  type V7AnalysisProgress,
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
  const v9Options: V7AnalysisOptions = {
    mode: 'full',
    model,
    lenses: options.lenses ?? ['commercial'],
    calibrationPrompt,
  };

  const v9Result = await runMultiReaderAnalysis(parsed, v9Options, (p: V7AnalysisProgress) => {
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

  onProgress?.({ stage: 'complete', percent: 100, message: 'V7 analysis complete!' });

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



// ─── Poster Generation (Gemini 2.5 Flash Image) ─────────────────────────────

import { storage, authReady } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, getBlob } from 'firebase/storage';
import { useApiConfigStore } from '@/stores/apiConfigStore';

// Poster prompt engine — genre-aware visual DNA + composition archetypes
import { buildSimplePosterPrompt as buildPosterPrompt } from './Prompt Enhancements/posterPrompt';

/**
 * Check if a poster already exists in Firebase Storage.
 * Returns the download URL if found, null otherwise.
 */
async function getExistingPoster(screenplayId: string): Promise<string | null> {
  try {
    await authReady; // ensure anonymous session before Storage read
    const posterRef = ref(storage, `Posters/${screenplayId}.png`);
    const url = await getDownloadURL(posterRef);
    return url;
  } catch {
    // File doesn't exist — that's expected
    return null;
  }
}

/**
 * Upload a generated poster to Firebase Storage.
 * Path: Posters/{screenplayId}.png
 */
async function uploadPosterToStorage(
  screenplayId: string,
  base64Data: string,
  mimeType: string,
): Promise<string> {
  await authReady; // ensure anonymous session before Storage write

  // Convert base64 to Uint8Array for upload
  const byteCharacters = atob(base64Data);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }

  const posterRef = ref(storage, `Posters/${screenplayId}.png`);
  await uploadBytes(posterRef, byteArray, {
    contentType: mimeType,
    customMetadata: {
      generatedAt: new Date().toISOString(),
      screenplayId,
    },
  });

  return getDownloadURL(posterRef);
}

/**
 * Generates a cinematic movie poster using Gemini 2.0 Flash Image Generation.
 *
 * Model: gemini-2.0-flash-exp-image-generation
 * - Native image generation via generateContent (responseModalities: IMAGE)
 * - 2:3 aspect ratio for theatrical one-sheet format
 *
 * Flow:
 * 1. Check Firebase Storage for existing poster → return if found
 * 2. Generate via Gemini API
 * 3. Upload to Firebase Storage (Posters/{id}.png)
 * 4. Return permanent download URL
 */
export async function generatePoster(
  title: string,
  logline: string,
  genre: string,
  screenplayId?: string,
): Promise<string> {
  // ── Step 1: Check Firebase Storage for cached poster ──
  if (screenplayId) {
    const existingUrl = await getExistingPoster(screenplayId);
    if (existingUrl) {
      console.log('[Poster] Found cached poster in Storage for', title);
      return existingUrl;
    }
  }

  // Read Google API key from store (user must configure via Settings → API Configuration)
  const googleApiKey = useApiConfigStore.getState().googleApiKey;

  // ── No API key → throw so the UI shows a configure prompt ──
  if (!googleApiKey) {
    throw new Error('GOOGLE_API_KEY_MISSING');
  }

  // ── Step 2: Generate via Gemini ──
  const prompt = buildPosterPrompt(title, logline, genre);

  // Models to try in order (primary → fallback)
  const POSTER_MODELS = [
    'gemini-2.5-flash-image',
    'gemini-3.1-flash-image',
    'gemini-3-pro-image',
  ];

  let lastError: Error | null = null;

  for (const model of POSTER_MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${googleApiKey}`;

    try {
      console.log(`[Poster] Trying model: ${model}`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.warn(`[Poster] ${model} returned ${response.status}:`, errorBody.slice(0, 300));
        // If 404 (model not found), try next model
        if (response.status === 404) continue;
        // If 400/403, parse for a useful message
        try {
          const errJson = JSON.parse(errorBody);
          const msg = errJson?.error?.message || errorBody.slice(0, 200);
          lastError = new Error(`${model}: ${msg}`);
        } catch {
          lastError = new Error(`${model}: HTTP ${response.status}`);
        }
        continue;
      }

      const data = await response.json();

      // Extract base64 image from response
      const parts = data.candidates?.[0]?.content?.parts || [];
      let base64Data: string | null = null;
      let mimeType = 'image/png';

      for (const part of parts) {
        if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
          base64Data = part.inlineData.data;
          mimeType = part.inlineData.mimeType;
          break;
        }
      }

      if (!base64Data) {
        console.warn(`[Poster] ${model} returned no image data, trying next...`);
        lastError = new Error(`${model}: No image in response`);
        continue;
      }

      console.log(`[Poster] ✓ Generated with ${model} for "${title}"`);

      // ── Step 3: Upload to Firebase Storage ──
      if (screenplayId) {
        try {
          const storageUrl = await uploadPosterToStorage(screenplayId, base64Data, mimeType);
          console.log('[Poster] Uploaded to Storage →', storageUrl);
          return storageUrl;
        } catch (uploadError) {
          console.warn('[Poster] Storage upload failed, using data URL:', uploadError);
        }
      }

      return `data:${mimeType};base64,${base64Data}`;
    } catch (fetchError) {
      console.warn(`[Poster] ${model} fetch failed:`, fetchError);
      lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
      continue;
    }
  }

  // All models failed
  throw lastError || new Error('All poster generation models failed');
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
