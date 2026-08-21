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
import modelCatalog from '@/config/anthropic-model-catalog.json';

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
  thinkingBudgetTokens?: number;
}

export interface CallLLMUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  actual_cost_microusd?: number;
  actual_cost_usd?: number;
}

export interface CallLLMProvenance {
  responseId: string;
  requestedModel: string;
  returnedModel: string;
  stopReason: string | null;
}

export interface CallLLMResult {
  text: string;
  usage: CallLLMUsage;
  provenance: CallLLMProvenance;
}

interface ProxyRequestBody {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  thinking?: { type: 'enabled'; budget_tokens: number } | { type: 'adaptive' };
  output_config?: { effort: 'high' };
}

// V9: default temperature for evaluation calls. Matches DEFAULT_TEMPERATURE in
// execution/ingest_v9.py so the browser Re-analyze path produces the same
// scores as the daemon batch path.
const DEFAULT_TEMPERATURE = 0.1;

interface ProxyErrorBody {
  error?: string;
  code?: string;
  isRetryable?: boolean;
}

interface ProxySuccessBody {
  text?: string;
  response_id?: string;
  model?: string;
  stop_reason?: string | null;
  usage?: Partial<CallLLMUsage> & {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

const activeBrowserModels = new Set(
  Object.values(modelCatalog.analysisRoutes).map((route) => route.modelId),
);

export class ProxyCallError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'ProxyCallError';
    this.retryable = retryable;
  }
}

export function buildProxyRequest(options: CallLLMOptions): ProxyRequestBody {
  if (!activeBrowserModels.has(options.model)) {
    throw new ProxyCallError(`${options.model} is not an active browser analysis model.`, false);
  }

  const profile = modelCatalog.modelProfiles[
    options.model as keyof typeof modelCatalog.modelProfiles
  ];
  if (!profile) {
    throw new ProxyCallError(`No request profile exists for ${options.model}.`, false);
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt });
  messages.push({ role: 'user', content: options.prompt });

  const body: ProxyRequestBody = {
    model: options.model,
    messages,
    ...(options.maxTokens !== undefined ? { max_tokens: options.maxTokens } : {}),
  };

  if (profile.thinking === 'adaptive') {
    body.thinking = { type: 'adaptive' };
    if (profile.effort) body.output_config = { effort: 'high' };
  } else if (options.thinkingBudgetTokens !== undefined) {
    body.thinking = { type: 'enabled', budget_tokens: options.thinkingBudgetTokens };
    body.temperature = 1;
  } else if (profile.sampling === 'supported') {
    body.temperature = options.temperature ?? DEFAULT_TEMPERATURE;
  }

  return body;
}

/**
 * Call the LLM proxy. Returns the response text and optional usage data.
 *
 * Translates our internal request format into the OpenAI-compatible
 * format expected by the proxy, which forwards to LiteLLM.
 */
export async function callLLM(options: CallLLMOptions): Promise<CallLLMResult> {
  const body = buildProxyRequest(options);

  // Send to proxy (with the Firebase ID token so the proxy authorizes us)
  let response: Response;
  try {
    response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getProxyAuthHeaders()) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ProxyCallError(
      'Network error connecting to AI proxy. Check your internet connection.'
      , true
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
      throw new ProxyCallError(`Rate limited — please wait a moment and retry. (${message})`, false);
    }
    if (response.status === 400) {
      throw new ProxyCallError(message, false);
    }
    throw new ProxyCallError(
      `AI proxy error [${code}]: ${message}`,
      errorData.isRetryable === true,
    );
  }

  const data = await response.json() as ProxySuccessBody;
  if (!data.response_id || !data.model || data.model !== options.model) {
    throw new ProxyCallError('AI proxy returned incomplete or mismatched model provenance.', false);
  }

  return {
    text: data.text ?? '',
    usage: {
      input_tokens: data.usage?.prompt_tokens ?? data.usage?.input_tokens ?? 0,
      output_tokens: data.usage?.completion_tokens ?? data.usage?.output_tokens ?? 0,
      cache_creation_input_tokens: data.usage?.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: data.usage?.cache_read_input_tokens ?? 0,
      ...(data.usage?.actual_cost_microusd !== undefined
        ? { actual_cost_microusd: data.usage.actual_cost_microusd }
        : {}),
      ...(data.usage?.actual_cost_usd !== undefined
        ? { actual_cost_usd: data.usage.actual_cost_usd }
        : {}),
    },
    provenance: {
      responseId: data.response_id,
      requestedModel: options.model,
      returnedModel: data.model,
      stopReason: data.stop_reason ?? null,
    },
  };
}
