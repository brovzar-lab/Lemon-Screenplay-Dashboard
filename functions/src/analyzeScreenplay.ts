/**
 * analyzeScreenplay Cloud Function
 *
 * Accepts screenplay text + metadata, calls Anthropic API with the V6 prompt,
 * and returns the raw analysis JSON. The client normalizes it.
 *
 * Security hardening (v2):
 *   - Input sanitization: title truncated + special chars stripped (M1)
 *   - API key format pre-validation before forwarding (H1 partial)
 *   - Explicit field-count guard to prevent oversized payloads
 *   - Server-side call counter in Firestore (H3 — per-day rate gate)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import Anthropic from '@anthropic-ai/sdk';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { buildV6Prompt, type LensName } from './prompts';

// Init Firebase Admin once
if (!getApps().length) initializeApp();

const CLAUDE_MODELS: Record<string, string> = {
  sonnet: 'claude-sonnet-4-5-20250929',
  haiku: 'claude-haiku-4-5-20251001',
  opus: 'claude-3-opus-20240229',
};

// ≈37.5K tokens — leaves headroom for template (~10K), lenses, and 16K output budget
const MAX_TEXT_LENGTH = 150_000;

// Server-side rate limit: max calls per day across all users
const DAILY_CALL_LIMIT = 200;

interface AnalyzeRequest {
  text: string;
  metadata: {
    title: string;
    pageCount: number;
    wordCount: number;
  };
  lenses: LensName[];
  apiKey: string;
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

/**
 * Validate that an Anthropic API key looks structurally correct (Fix H1 partial).
 * Does NOT call the Anthropic API — just checks the format so clearly wrong keys
 * fail fast without consuming a Cloud Function invocation.
 */
function isValidAnthropicKeyFormat(key: string): boolean {
  return /^sk-ant-[a-zA-Z0-9\-_]{20,}$/.test(key);
}

/**
 * Server-side rate gate (Fix H3 partial).
 * Tracks total calls per UTC day in Firestore.
 * Throws if the daily limit is reached.
 */
async function checkServerRateLimit(): Promise<void> {
  const db = getFirestore();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const ref = db.collection('_rate_limits').doc(`calls_${today}`);

  const snap = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const current = doc.exists ? (doc.data()?.count as number ?? 0) : 0;

    if (current >= DAILY_CALL_LIMIT) {
      throw new HttpsError(
        'resource-exhausted',
        `Daily analysis limit of ${DAILY_CALL_LIMIT} calls reached. Please try again tomorrow.`
      );
    }

    tx.set(ref, { count: FieldValue.increment(1), date: today }, { merge: true });
    return current + 1;
  });

  console.log(`[RateLimit] Daily call count: ${snap}`);
}

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
    if (!data.apiKey || typeof data.apiKey !== 'string') {
      throw new HttpsError('invalid-argument', 'Missing API key');
    }
    // Fix M1: validate key format before forwarding to Anthropic
    if (!isValidAnthropicKeyFormat(data.apiKey)) {
      throw new HttpsError('invalid-argument', 'API key format is invalid');
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

    // Fix H3: server-side rate gate
    await checkServerRateLimit();

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
    const prompt = buildV6Prompt(text, { title: safeTitle, pageCount, wordCount }, lenses);

    // ── Call Anthropic ────────────────────────────────────────────────────────

    const client = new Anthropic({ apiKey: data.apiKey });

    try {
      const message = await client.messages.create({
        model,
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = message.content[0].type === 'text'
        ? message.content[0].text
        : '';

      // Parse JSON from response
      let analysis: Record<string, unknown>;
      try {
        analysis = JSON.parse(responseText);
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          throw new HttpsError('internal', 'Failed to parse analysis JSON from Claude response');
        }
      }

      return {
        source_file: safeTitle.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf',
        analysis_model: `claude-${modelKey}`,
        analysis_version: 'v6_unified',
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
        },
      };
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;

      const err = error as { status?: number; message?: string };
      if (err.status === 401) {
        throw new HttpsError('unauthenticated', 'Invalid Anthropic API key');
      }
      if (err.status === 429) {
        throw new HttpsError('resource-exhausted', 'Anthropic rate limit exceeded. Please wait and try again.');
      }
      throw new HttpsError('internal', `Analysis failed: ${err.message || 'Unknown error'}`);
    }
  },
);
