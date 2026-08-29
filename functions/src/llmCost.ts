import { sha256CanonicalJson } from "./anthropicProxyCore";
import pricingTable from "./anthropicPricing.json";

export const MICRO_USD_PER_USD = 1_000_000;
export const NANO_USD_PER_USD = 1_000_000_000;
export const NANO_USD_PER_MICRO_USD = 1_000;
export const DEFAULT_DAILY_LLM_BUDGET_USD = 100;
export const INPUT_TOKEN_OVERHEAD = 4_096;

export interface LlmTokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  inference_geo?: string | null;
  service_tier?: "standard" | "priority" | "batch" | null;
  normalizations?: string[];
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

// One committed decimal table is consumed by both runtimes. Deriving rates
// with floating-point multiplication produced different Python/JS hashes.
const MODEL_PRICING: Record<string, ModelPricing> = pricingTable;
export const PRICED_MODELS = Object.freeze(Object.keys(MODEL_PRICING));

export function llmPricingSha256(): string {
  return sha256CanonicalJson(MODEL_PRICING);
}

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
  return Math.ceil(
    calculateEstimatedCostNanousd(model, usage) / NANO_USD_PER_MICRO_USD,
  );
}

export function calculateEstimatedCostNanousd(
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

  const rateNanousd = (rate: number) => {
    const scaled = rate * NANO_USD_PER_MICRO_USD;
    if (!Number.isInteger(scaled)) {
      throw new Error("Pricing must resolve to whole nano-USD per token.");
    }
    return scaled;
  };
  const baseNanousd = (
    input * rateNanousd(pricing.input)
      + output * rateNanousd(pricing.output)
      + detailedFiveMinuteWrite * rateNanousd(pricing.cacheWrite5m)
      + detailedOneHourWrite * rateNanousd(pricing.cacheWrite1h)
      + cacheRead * rateNanousd(pricing.cacheRead)
  );
  if (usage.inference_geo !== "us") return baseNanousd;
  const usNanousd = baseNanousd * 11 / 10;
  if (!Number.isInteger(usNanousd)) {
    throw new Error("US inference pricing must resolve to whole nano-USD.");
  }
  return usNanousd;
}

export function nanousdToUsd(nanousd: number): number {
  return nanousd / NANO_USD_PER_USD;
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
  return Math.ceil(1.1 * (
    inputTokenUpperBound * Math.max(pricing.input, pricing.cacheWrite1h)
      + output * pricing.output
  ));
}

export function calculateHighestAllowedReservationMicrousd(
  models: readonly string[],
  requestBytes: number,
  maxOutputTokens: number,
): number {
  if (models.length === 0) throw new Error("At least one allowed model is required.");
  return Math.max(
    ...models.map((model) =>
      calculateReservationMicrousd(model, requestBytes, maxOutputTokens)),
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
