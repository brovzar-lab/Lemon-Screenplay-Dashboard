/**
 * analyzeScreenplay Cloud Function
 *
 * Accepts screenplay text + metadata, calls Anthropic API with the analysis prompt,
 * and returns the raw analysis JSON. The client normalizes it.
 *
 * Security hardening (v2):
 *   - Input sanitization: title truncated + special chars stripped (M1)
 *   - API key format pre-validation before forwarding (H1 partial)
 *   - Explicit field-count guard to prevent oversized payloads
 *   - Server-side call counter in Firestore — now shared with the ingest pipeline
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import Anthropic from '@anthropic-ai/sdk';
import { initializeApp, getApps } from 'firebase-admin/app';
import { buildAnalysisPrompt, type LensName } from './prompts';
import { checkAndIncrementBudget } from './budgetCounter';
import { createHash } from 'crypto';

const anthropicApiKey = defineString('ANTHROPIC_API_KEY');

// Init Firebase Admin once
if (!getApps().length) initializeApp();

/**
 * Short hash of the current prompt template.
 * Stored with every analysis so results across prompt versions can be compared.
 * Recomputed at cold-start time; stable within a single deployment.
 */
let _promptVersionCache: string | null = null;
function getPromptVersion(prompt: string): string {
  if (!_promptVersionCache) {
    _promptVersionCache = createHash('sha256').update(prompt).digest('hex').slice(0, 8);
  }
  return `v7-${_promptVersionCache}`;
}

const CLAUDE_MODELS: Record<string, string> = {
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
  opus: 'claude-opus-4-7',
};

// ≈37.5K tokens — leaves headroom for template (~10K), lenses, and 16K output budget
const MAX_TEXT_LENGTH = 150_000;

interface AnalyzeRequest {
  text: string;
  metadata: {
    title: string;
    pageCount: number;
    wordCount: number;
  };
  lenses: LensName[];
  model?: string; // 'sonnet' | 'haiku' | 'opus'
}

/**
 * Sanitize title to prevent prompt injection (Fix M1).
 * - Truncates to 200 chars
 * - Strips characters that could break the JSON prompt template
 */
function sanitizeTitle(raw: string): string {
  return raw
    .slice(0, 200)
    .replace(/[<>{}[\]`\\]/g, '')   // strip prompt-injection chars
    .replace(/\s+/g, ' ')
    .trim();
}

// isValidAnthropicKeyFormat removed — API key is now server-side via LiteLLM

export const analyzeScreenplay = onCall(
  {
    timeoutSeconds: 540,   // 9 min — analysis can take 2-5 min
    memory: '512MiB',
    maxInstances: 5,
    cors: true,
    invoker: 'public',     // App Check enforcement can be added here once enabled in Console
  },
  async (request) => {
    const data = request.data as AnalyzeRequest;

    // ── Input validation ──────────────────────────────────────────────────────

    if (!data.text || typeof data.text !== 'string') {
      throw new HttpsError('invalid-argument', 'Missing or invalid screenplay text');
    }
    if (!data.metadata?.title) {
      throw new HttpsError('invalid-argument', 'Missing metadata.title');
    }

    // Fix M1: sanitize title to prevent prompt injection
    const safeTitle = sanitizeTitle(data.metadata.title);

    // Validate metadata types
    const pageCount = Number(data.metadata.pageCount) || 0;
    const wordCount = Number(data.metadata.wordCount) || 0;

    // Validate lenses array
    const lenses: LensName[] = Array.isArray(data.lenses) ? data.lenses.slice(0, 10) : [];

    // Shared budget gate — same Firestore counter used by ingest pipeline & VPS daemon
    await checkAndIncrementBudget(undefined, /* throwAsHttpsError */ true);

    // ── Text truncation ───────────────────────────────────────────────────────

    let text = data.text;
    if (text.length > MAX_TEXT_LENGTH) {
      text = text.slice(0, MAX_TEXT_LENGTH) + '\n\n[... truncated ...]';
      console.log(`[Prompt] "${safeTitle}" — truncated to ${MAX_TEXT_LENGTH} chars`);
    }

    console.log(`[Prompt] "${safeTitle}" — ~${Math.round(text.length / 4).toLocaleString()} screenplay tokens`);

    const modelKey = data.model || 'sonnet';
    const model = CLAUDE_MODELS[modelKey] || CLAUDE_MODELS.sonnet;

    // Build prompt using sanitized title
    const prompt = buildAnalysisPrompt(text, { title: safeTitle, pageCount, wordCount }, lenses);

    // ── Call Anthropic API ───────────────────────────────────────────────────

    const client = new Anthropic({ apiKey: anthropicApiKey.value() });

    try {
      const message = await client.messages.create({
        model,
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

      // Parse JSON from response
      let analysis: Record<string, unknown>;
      try {
        analysis = JSON.parse(responseText);
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new HttpsError('internal', 'Failed to parse analysis JSON from response');
        }
      }

      return {
        source_file: safeTitle.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf',
        analysis_model: `claude-${modelKey}`,
        analysis_version: 'v7',
        prompt_version: getPromptVersion(prompt),
        lenses_enabled: lenses,
        metadata: {
          filename: safeTitle + '.pdf',
          page_count: pageCount,
          word_count: wordCount,
        },
        analysis,
        usage: {
          input_tokens: message.usage.input_tokens,
          output_tokens: message.usage.output_tokens,
          finish_reason: message.stop_reason ?? null,
        },
      };
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;

      const err = error as { message?: string };
      throw new HttpsError('internal', `Analysis failed: ${err.message || 'Unknown error'}`);
    }
  },
);
