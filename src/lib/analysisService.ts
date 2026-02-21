/**
 * Analysis Service
 *
 * Orchestrates the full screenplay analysis pipeline:
 *   1. Parse PDF → extract text
 *   2. Call Anthropic API (via Cloud Function or Vite dev proxy)
 *   3. Return raw V6 analysis JSON
 *
 * Environment detection:
 *   - Development: uses Vite proxy at /api/anthropic to bypass CORS
 *   - Production: calls Firebase Cloud Function
 */

import { parsePDF, type ParsedPDF } from './pdfParser';
import { uploadScreenplayPdf } from './firebase';
import { saveAnalysis } from './analysisStore';
import type { Screenplay } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AnalysisLens = 'latam' | 'commercial' | 'production' | 'coproduction';

export interface AnalysisOptions {
  apiKey: string;
  model?: 'sonnet' | 'haiku' | 'opus';
  lenses?: AnalysisLens[];
  /** Firebase Cloud Function URL (for production). If absent, uses Vite proxy. */
  functionUrl?: string;
}

export interface AnalysisProgress {
  stage: 'parsing' | 'analyzing' | 'complete' | 'error';
  percent: number;
  message: string;
}

export interface AnalysisResult {
  /** Raw V6 analysis wrapper — can be fed to normalizeV6Screenplay() */
  raw: Record<string, unknown>;
  /** Parsed PDF metadata */
  parsed: ParsedPDF;
  /** Token usage from Anthropic */
  usage?: { input_tokens: number; output_tokens: number };
}

// ─── Prompt builder (client-side mirror for dev proxy path) ─────────────────

// We import the build function dynamically only in the Cloud Function.
// For the dev proxy path we need a local copy. To avoid duplicating the huge
// prompt string, we build a minimal request and let the server-side handle the
// prompt. In dev mode we call the Anthropic /v1/messages endpoint directly.

const CLAUDE_MODELS: Record<string, string> = {
  sonnet: 'claude-sonnet-4-5-20250929',
  haiku: 'claude-haiku-4-5-20251001',
  opus: 'claude-opus-4-6',
};

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

  // Stage 2 — Call API
  const lenses = options.lenses ?? ['commercial'];
  const model = options.model ?? 'sonnet';

  let raw: Record<string, unknown>;
  let usage: { input_tokens: number; output_tokens: number } | undefined;

  if (options.functionUrl) {
    // Production path: call Firebase Cloud Function
    const result = await callCloudFunction(parsed, lenses, options);
    raw = result.raw;
    usage = result.usage;
  } else {
    // Dev path: call Anthropic API directly via Vite proxy
    const result = await callAnthropicDirect(parsed, lenses, model, options.apiKey);
    raw = result.raw;
    usage = result.usage;
  }

  // Inject collection info for normalization
  (raw as Record<string, unknown>).collection = category;

  onProgress?.({ stage: 'complete', percent: 100, message: 'Analysis complete!' });

  // Stage 3 — Upload PDF to Firebase Storage (non-blocking)
  try {
    const title = (raw as Record<string, Record<string, unknown>>).analysis?.title as string | undefined;
    await uploadScreenplayPdf(file, category, title);
  } catch (err) {
    // Don't fail the analysis if upload fails
    console.warn('[Firebase Storage] PDF upload failed:', err);
  }

  return { raw, parsed, usage };
}

// ─── Cloud Function path (production) ────────────────────────────────────────

async function callCloudFunction(
  parsed: ParsedPDF,
  lenses: AnalysisLens[],
  options: AnalysisOptions,
): Promise<{ raw: Record<string, unknown>; usage?: { input_tokens: number; output_tokens: number } }> {
  const response = await fetch(options.functionUrl!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        text: parsed.text,
        metadata: {
          title: parsed.title,
          pageCount: parsed.pageCount,
          wordCount: parsed.wordCount,
        },
        lenses,
        apiKey: options.apiKey,
        model: options.model ?? 'sonnet',
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Cloud Function error (${response.status}): ${body}`);
  }

  const json = await response.json();
  // Firebase callable wraps the result in { result: ... }
  const result = json.result ?? json;
  return {
    raw: result,
    usage: result.usage,
  };
}

// ─── Direct Anthropic API path (development via Vite proxy) ──────────────────

async function callAnthropicDirect(
  parsed: ParsedPDF,
  lenses: AnalysisLens[],
  model: string,
  apiKey: string,
): Promise<{ raw: Record<string, unknown>; usage?: { input_tokens: number; output_tokens: number } }> {
  // Dynamically import the prompt builder to avoid bundling the huge prompt
  // string in the main chunk. We inline a lightweight version of
  // buildV6Prompt here instead.
  const { buildV6PromptClient } = await import('./promptClient');

  // Load calibration profile if enabled (admin feedback loop)
  let calibrationPrompt: string | undefined;
  try {
    const { loadCalibrationProfile } = await import('./feedbackStore');
    const profile = await loadCalibrationProfile();
    if (profile?.enabled && profile.calibrationPrompt) {
      calibrationPrompt = profile.calibrationPrompt;
    }
  } catch {
    // Calibration is optional — don't fail analysis if profile load fails
  }

  const prompt = buildV6PromptClient(parsed.text, {
    title: parsed.title,
    pageCount: parsed.pageCount,
    wordCount: parsed.wordCount,
  }, lenses, calibrationPrompt);

  const modelId = CLAUDE_MODELS[model] || CLAUDE_MODELS.sonnet;

  // In dev, use Vite proxy to avoid CORS. In production, call Anthropic directly
  // (the `anthropic-dangerous-direct-browser-access` header enables browser CORS).
  const apiBase = import.meta.env.DEV ? '/api/anthropic' : 'https://api.anthropic.com';

  const response = await fetch(`${apiBase}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${body}`);
  }

  const message = await response.json();
  const responseText = message.content?.[0]?.text ?? '';

  // Parse JSON from response — Claude sometimes adds commentary after the JSON
  let analysis: Record<string, unknown>;
  try {
    analysis = JSON.parse(responseText);
  } catch {
    // Extract the first complete JSON object using brace counting
    const startIdx = responseText.indexOf('{');
    if (startIdx === -1) {
      throw new Error('Failed to parse analysis JSON from Claude response');
    }
    let depth = 0;
    let endIdx = -1;
    let inString = false;
    let escape = false;
    for (let i = startIdx; i < responseText.length; i++) {
      const ch = responseText[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    if (endIdx === -1) {
      throw new Error('Failed to parse analysis JSON from Claude response');
    }
    analysis = JSON.parse(responseText.slice(startIdx, endIdx + 1));
  }

  // Wrap in standard V6 structure
  const raw = {
    source_file: parsed.title.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf',
    analysis_model: `claude-${model}`,
    analysis_version: 'v6_unified',
    lenses_enabled: lenses,
    metadata: {
      filename: parsed.title + '.pdf',
      page_count: parsed.pageCount,
      word_count: parsed.wordCount,
    },
    analysis,
  };

  return {
    raw,
    usage: message.usage ? {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    } : undefined,
  };
}

// ─── Poster Generation (Gemini 2.5 Flash Image) ─────────────────────────────

import { storage } from '@/lib/firebase';
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
 * Generates a cinematic movie poster using Gemini 2.5 Flash Image.
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
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${googleApiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[Poster] Gemini API error:', response.status, errorBody);
    throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
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
    console.error('[Poster] No image data in Gemini response:', JSON.stringify(data).slice(0, 500));
    throw new Error('No image generated — Gemini returned no inlineData');
  }

  // ── Step 3: Upload to Firebase Storage ──
  if (screenplayId) {
    try {
      const storageUrl = await uploadPosterToStorage(screenplayId, base64Data, mimeType);
      console.log('[Poster] Uploaded poster to Storage for', title, '→', storageUrl);
      return storageUrl;
    } catch (uploadError) {
      console.warn('[Poster] Storage upload failed, falling back to data URL:', uploadError);
      // Fall through to data URL if upload fails
    }
  }

  // Fallback: return as data URL if no screenplayId or upload failed
  const dataUrl = `data:${mimeType};base64,${base64Data}`;
  console.log('[Poster] Generated poster for', title, '— size:', base64Data.length, 'chars');
  return dataUrl;
}

// ─── Re-analyze from Firebase Storage ────────────────────────────────────────

/**
 * Re-analyze a screenplay by fetching its PDF from Firebase Storage.
 *
 * Flow:
 *   1. Reconstruct Storage path from screenplay metadata
 *   2. Fetch PDF → convert to File object
 *   3. Run full V6 analysis with chosen model
 *   4. Save to Firestore + localStorage (replaces old analysis)
 *   5. Return new analysis result
 */
export async function reanalyzeFromStorage(
  screenplay: Screenplay,
  model: 'sonnet' | 'opus',
  apiKey: string,
  onProgress?: (p: AnalysisProgress) => void,
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
      { apiKey, model, lenses: ['commercial'] },
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
