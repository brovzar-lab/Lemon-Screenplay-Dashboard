/**
 * LLM Proxy Client
 *
 * Sends AI requests to the Firebase Cloud Function proxy instead of
 * calling Anthropic/Gemini APIs directly. The proxy forwards to LiteLLM,
 * which routes to the appropriate LLM provider. API keys never touch the browser.
 *
 * In dev: points to Firebase Emulator (localhost:5001)
 * In prod: uses Firebase Hosting rewrite (/api/llm → llmProxy function)
 */

import { authReady, auth } from './firebase';

// Resolve proxy URL — emulator in dev, hosting rewrite in prod
const PROXY_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:5001/lemon-screenplay-dashboard/us-central1/llmProxy'
  : '/api/llm';

/**
 * Build the Authorization header from the current Firebase session. The proxy
 * requires a valid ID token (or the daemon's service key) — without this every
 * browser call would 401.
 */
export async function getProxyAuthHeaders(): Promise<Record<string, string>> {
  await authReady;
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface CallLLMOptions {
  model: string;
  prompt: string;
  systemPrompt?: string;
  /**
   * Sampling temperature. Defaults to 0.1 (V9 default) — low jitter for
   * evaluation tasks where same-script-same-score is desirable. Pass an
   * explicit value to override (e.g. 0.7 for creative work).
   */
  temperature?: number;
  maxTokens?: number;
}

export interface CallLLMResult {
  text: string;
  usage?: { input_tokens: number; output_tokens: number };
}

interface ProxyRequestBody {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

// V9: default temperature for evaluation calls. Matches DEFAULT_TEMPERATURE in
// execution/ingest_v9.py so the browser Re-analyze path produces the same
// scores as the daemon batch path.
const DEFAULT_TEMPERATURE = 0.1;

interface ProxyErrorBody {
  error?: string;
  code?: string;
}

/**
 * Call the LLM proxy. Returns the response text and optional usage data.
 *
 * Translates our internal request format into the OpenAI-compatible
 * format expected by the proxy, which forwards to LiteLLM.
 */
export async function callLLM(options: CallLLMOptions): Promise<CallLLMResult> {
  // Build OpenAI-compatible messages array
  const messages: Array<{ role: string; content: string }> = [];

  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }

  messages.push({ role: 'user', content: options.prompt });

  // Build the request body. Temperature defaults to DEFAULT_TEMPERATURE (0.1)
  // so evaluation scores are stable across re-runs — pass an explicit value
  // to override.
  const body: ProxyRequestBody = {
    model: options.model,
    messages,
    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
    ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
  };

  // Send to proxy (with the Firebase ID token so the proxy authorizes us)
  let response: Response;
  try {
    response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getProxyAuthHeaders()) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      'Network error connecting to AI proxy. Check your internet connection.'
    );
  }

  if (!response.ok) {
    let errorData: ProxyErrorBody;
    try {
      errorData = await response.json() as ProxyErrorBody;
    } catch {
      errorData = { error: `HTTP ${response.status}` };
    }

    const message = errorData.error || `Proxy error (${response.status})`;
    const code = errorData.code || 'UNKNOWN_ERROR';

    // Preserve retryable vs. non-retryable distinction
    if (response.status === 429) {
      throw new Error(`Rate limited — please wait a moment and retry. (${message})`);
    }
    if (response.status === 400) {
      throw new Error(`${message}`);
    }
    throw new Error(`AI proxy error [${code}]: ${message}`);
  }

  const data = await response.json();

  return {
    text: data.text ?? '',
    usage: data.usage
      ? {
          input_tokens: data.usage.prompt_tokens ?? data.usage.input_tokens ?? 0,
          output_tokens: data.usage.completion_tokens ?? data.usage.output_tokens ?? 0,
        }
      : undefined,
  };
}

/**
 * Health check — validates the proxy is reachable and LiteLLM is responding.
 * Uses a minimal request (1 token) to avoid wasting credits.
 */
export async function testProxyConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    await callLLM({
      model: 'claude-haiku-4-5-20251001',
      prompt: 'Hi',
      maxTokens: 1,
    });
    return { ok: true, message: 'Proxy connection is working' };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
