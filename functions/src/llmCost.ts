export const MICRO_USD_PER_USD = 1_000_000;
export const DEFAULT_DAILY_LLM_BUDGET_USD = 100;
export const INPUT_TOKEN_OVERHEAD = 4_096;

export interface LlmTokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
}

interface ModelPricing {
  input: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
  output: number;
}

// USD per million tokens. Five-minute writes cost 1.25x base input; one-hour
// writes cost 2x. Cache reads cost 0.1x. The detailed usage breakdown lets us
// charge the exact TTL instead of treating every cache creation as five-minute.
const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-haiku-4-5-20251001": {
    input: 1,
    cacheWrite5m: 1.25,
    cacheWrite1h: 2,
    cacheRead: 0.1,
    output: 5,
  },
  "claude-sonnet-4-6": {
    input: 3,
    cacheWrite5m: 3.75,
    cacheWrite1h: 6,
    cacheRead: 0.3,
    output: 15,
  },
  "claude-opus-4-7": {
    input: 5,
    cacheWrite5m: 6.25,
    cacheWrite1h: 10,
    cacheRead: 0.5,
    output: 25,
  },
  "claude-opus-5": {
    input: 5,
    cacheWrite5m: 6.25,
    cacheWrite1h: 10,
    cacheRead: 0.5,
    output: 25,
  },
  "claude-fable-5": {
    input: 10,
    cacheWrite5m: 12.5,
    cacheWrite1h: 20,
    cacheRead: 1,
    output: 50,
  },
};

function requireNonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer.`);
  }
  return value;
}

export function getModelPricing(model: string): ModelPricing {
  const pricing = MODEL_PRICING[model];
  if (!pricing) throw new Error(`No pricing configured for approved model ${model}.`);
  return pricing;
}

export function calculateActualCostMicrousd(
  model: string,
  usage: LlmTokenUsage,
): number {
  const pricing = getModelPricing(model);
  const input = requireNonNegativeInteger(usage.input_tokens, "input_tokens");
  const output = requireNonNegativeInteger(usage.output_tokens, "output_tokens");
  const cacheWriteTotal = requireNonNegativeInteger(
    usage.cache_creation_input_tokens,
    "cache_creation_input_tokens",
  );
  const cacheRead = requireNonNegativeInteger(
    usage.cache_read_input_tokens,
    "cache_read_input_tokens",
  );

  const detailedFiveMinuteWrite = requireNonNegativeInteger(
    usage.cache_creation
      ? usage.cache_creation.ephemeral_5m_input_tokens ?? 0
      : cacheWriteTotal,
    "cache_creation.ephemeral_5m_input_tokens",
  );
  const detailedOneHourWrite = requireNonNegativeInteger(
    usage.cache_creation?.ephemeral_1h_input_tokens ?? 0,
    "cache_creation.ephemeral_1h_input_tokens",
  );
  if (usage.cache_creation
      && detailedFiveMinuteWrite + detailedOneHourWrite !== cacheWriteTotal) {
    throw new Error("Detailed cache creation tokens must equal cache_creation_input_tokens.");
  }

  // A $1/M-token rate is exactly 1 micro-USD per token.
  return Math.ceil(
    input * pricing.input
      + output * pricing.output
      + detailedFiveMinuteWrite * pricing.cacheWrite5m
      + detailedOneHourWrite * pricing.cacheWrite1h
      + cacheRead * pricing.cacheRead,
  );
}

export function calculateReservationMicrousd(
  model: string,
  requestBytes: number,
  maxOutputTokens: number,
): number {
  const pricing = getModelPricing(model);
  const bytes = requireNonNegativeInteger(requestBytes, "requestBytes");
  const output = requireNonNegativeInteger(maxOutputTokens, "maxOutputTokens");
  const inputTokenUpperBound = bytes + INPUT_TOKEN_OVERHEAD;

  // One UTF-8 byte per token is deliberately conservative. Charging the
  // whole possible input at the one-hour cache-write rate also covers the
  // most expensive approved cache miss.
  return Math.ceil(
    inputTokenUpperBound * Math.max(pricing.input, pricing.cacheWrite1h)
      + output * pricing.output,
  );
}

export function parseDailyBudgetUsd(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100_000) {
    throw new Error("DAILY_LLM_BUDGET_USD must be a number between 0 and 100000.");
  }
  return parsed;
}

export function usdToMicrousd(usd: number): number {
  if (!Number.isFinite(usd) || usd <= 0) {
    throw new Error("USD budget must be greater than zero.");
  }
  return Math.round(usd * MICRO_USD_PER_USD);
}

export function microusdToUsd(microusd: number): number {
  return microusd / MICRO_USD_PER_USD;
}
