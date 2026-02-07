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

  const prompt = buildV6PromptClient(parsed.text, {
    title: parsed.title,
    pageCount: parsed.pageCount,
    wordCount: parsed.wordCount,
  }, lenses);

  const modelId = CLAUDE_MODELS[model] || CLAUDE_MODELS.sonnet;

  const response = await fetch('/api/anthropic/v1/messages', {
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

  // Parse JSON from response
  let analysis: Record<string, unknown>;
  try {
    analysis = JSON.parse(responseText);
  } catch {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Failed to parse analysis JSON from Claude response');
    }
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
