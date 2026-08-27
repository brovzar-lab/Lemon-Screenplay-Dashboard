/**
 * LLM Proxy Client
 *
 * Sends AI requests to the Firebase Cloud Function proxy instead of
 * calling Anthropic directly. The proxy uses Anthropic's official SDK.
 * Google features use their separate Google function. API keys never touch the browser.
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
  requested_model?: string;
  returned_model?: string;
  response_id?: string;
  stop_reason?: string | null;
  usage?: ProxySuccessBody['usage'];
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
  readonly usage?: CallLLMUsage;
  readonly provenance?: Array<CallLLMProvenance & {
    disposition: 'discarded_unusable';
    usage: CallLLMUsage;
  }>;

  constructor(
    message: string,
    retryable: boolean,
    usage?: CallLLMUsage,
    provenance?: Array<CallLLMProvenance & {
      disposition: 'discarded_unusable';
      usage: CallLLMUsage;
    }>,
  ) {
    super(message);
    this.name = 'ProxyCallError';
    this.retryable = retryable;
    this.usage = usage;
    this.provenance = provenance;
  }
}

function normalizedUsage(usage?: ProxySuccessBody['usage']): CallLLMUsage | undefined {
  if (!usage) return undefined;
  const inputTokens = usage.prompt_tokens ?? usage.input_tokens;
  const outputTokens = usage.completion_tokens ?? usage.output_tokens;
  const actualCostMicrousd = usage.actual_cost_microusd;
  const actualCostUsd = usage.actual_cost_usd;
  if (
    typeof inputTokens !== 'number'
    || !Number.isInteger(inputTokens)
    || inputTokens < 0
    || typeof outputTokens !== 'number'
    || !Number.isInteger(outputTokens)
    || outputTokens < 0
    || typeof actualCostMicrousd !== 'number'
    || !Number.isInteger(actualCostMicrousd)
    || actualCostMicrousd < 0
    || typeof actualCostUsd !== 'number'
    || !Number.isFinite(actualCostUsd)
    || actualCostUsd < 0
    || Math.abs(actualCostUsd - actualCostMicrousd / 1_000_000) > 1e-9
  ) {
    return undefined;
  }
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
    actual_cost_microusd: actualCostMicrousd,
    actual_cost_usd: actualCostUsd,
  };
}

function proxyErrorEvidence(
  body: ProxyErrorBody,
  requestedModel: string,
): Pick<ProxyCallError, 'usage' | 'provenance'> {
  const usage = normalizedUsage(body.usage);
  if (
    !usage
    || !body.response_id
    || !body.returned_model
  ) {
    return { usage };
  }
  return {
    usage,
    provenance: [{
      responseId: body.response_id,
      requestedModel: body.requested_model ?? requestedModel,
      returnedModel: body.returned_model,
      stopReason: body.stop_reason ?? null,
      disposition: 'discarded_unusable',
      usage,
    }],
  };
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
 * Translates our internal request format into the Anthropic request shape
 * accepted by the proxy.
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
    const evidence = proxyErrorEvidence(errorData, options.model);

    // Preserve retryable vs. non-retryable distinction
    if (response.status === 429) {
      throw new ProxyCallError(
        `Rate limited — please wait a moment and retry. (${message})`,
        false,
        evidence.usage,
        evidence.provenance,
      );
    }
    if (response.status === 400) {
      throw new ProxyCallError(message, false, evidence.usage, evidence.provenance);
    }
    throw new ProxyCallError(
      `AI proxy error [${code}]: ${message}`,
      errorData.isRetryable === true,
      evidence.usage,
      evidence.provenance,
    );
  }

  const data = await response.json() as ProxySuccessBody;
  if (!data.response_id || !data.model || data.model !== options.model) {
    const evidence = proxyErrorEvidence({
      requested_model: options.model,
      returned_model: data.model,
      response_id: data.response_id,
      stop_reason: data.stop_reason,
      usage: data.usage,
    }, options.model);
    throw new ProxyCallError(
      'AI proxy returned incomplete or mismatched model provenance.',
      false,
      evidence.usage,
      evidence.provenance,
    );
  }

  const usage = normalizedUsage(data.usage);
  if (!usage) {
    throw new ProxyCallError('AI proxy returned incomplete settled usage.', false);
  }
  return {
    text: data.text ?? '',
    usage,
    provenance: {
      responseId: data.response_id,
      requestedModel: options.model,
      returnedModel: data.model,
      stopReason: data.stop_reason ?? null,
    },
  };
}
