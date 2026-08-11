"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INPUT_TOKEN_OVERHEAD = exports.DEFAULT_DAILY_LLM_BUDGET_USD = exports.MICRO_USD_PER_USD = void 0;
exports.getModelPricing = getModelPricing;
exports.calculateActualCostMicrousd = calculateActualCostMicrousd;
exports.calculateReservationMicrousd = calculateReservationMicrousd;
exports.parseDailyBudgetUsd = parseDailyBudgetUsd;
exports.usdToMicrousd = usdToMicrousd;
exports.microusdToUsd = microusdToUsd;
exports.MICRO_USD_PER_USD = 1_000_000;
exports.DEFAULT_DAILY_LLM_BUDGET_USD = 100;
exports.INPUT_TOKEN_OVERHEAD = 4_096;
// USD per million tokens. Five-minute writes cost 1.25x base input; one-hour
// writes cost 2x. Cache reads cost 0.1x. The detailed usage breakdown lets us
// charge the exact TTL instead of treating every cache creation as five-minute.
const MODEL_PRICING = {
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
function requireNonNegativeInteger(value, field) {
    if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${field} must be a non-negative integer.`);
    }
    return value;
}
function getModelPricing(model) {
    const pricing = MODEL_PRICING[model];
    if (!pricing)
        throw new Error(`No pricing configured for approved model ${model}.`);
    return pricing;
}
function calculateActualCostMicrousd(model, usage) {
    const pricing = getModelPricing(model);
    const input = requireNonNegativeInteger(usage.input_tokens, "input_tokens");
    const output = requireNonNegativeInteger(usage.output_tokens, "output_tokens");
    const cacheWriteTotal = requireNonNegativeInteger(usage.cache_creation_input_tokens, "cache_creation_input_tokens");
    const cacheRead = requireNonNegativeInteger(usage.cache_read_input_tokens, "cache_read_input_tokens");
    const detailedFiveMinuteWrite = requireNonNegativeInteger(usage.cache_creation
        ? usage.cache_creation.ephemeral_5m_input_tokens ?? 0
        : cacheWriteTotal, "cache_creation.ephemeral_5m_input_tokens");
    const detailedOneHourWrite = requireNonNegativeInteger(usage.cache_creation?.ephemeral_1h_input_tokens ?? 0, "cache_creation.ephemeral_1h_input_tokens");
    if (usage.cache_creation
        && detailedFiveMinuteWrite + detailedOneHourWrite !== cacheWriteTotal) {
        throw new Error("Detailed cache creation tokens must equal cache_creation_input_tokens.");
    }
    // A $1/M-token rate is exactly 1 micro-USD per token.
    return Math.ceil(input * pricing.input
        + output * pricing.output
        + detailedFiveMinuteWrite * pricing.cacheWrite5m
        + detailedOneHourWrite * pricing.cacheWrite1h
        + cacheRead * pricing.cacheRead);
}
function calculateReservationMicrousd(model, requestBytes, maxOutputTokens) {
    const pricing = getModelPricing(model);
    const bytes = requireNonNegativeInteger(requestBytes, "requestBytes");
    const output = requireNonNegativeInteger(maxOutputTokens, "maxOutputTokens");
    const inputTokenUpperBound = bytes + exports.INPUT_TOKEN_OVERHEAD;
    // One UTF-8 byte per token is deliberately conservative. Charging the
    // whole possible input at the one-hour cache-write rate also covers the
    // most expensive approved cache miss.
    return Math.ceil(inputTokenUpperBound * Math.max(pricing.input, pricing.cacheWrite1h)
        + output * pricing.output);
}
function parseDailyBudgetUsd(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100_000) {
        throw new Error("DAILY_LLM_BUDGET_USD must be a number between 0 and 100000.");
    }
    return parsed;
}
function usdToMicrousd(usd) {
    if (!Number.isFinite(usd) || usd <= 0) {
        throw new Error("USD budget must be greater than zero.");
    }
    return Math.round(usd * exports.MICRO_USD_PER_USD);
}
function microusdToUsd(microusd) {
    return microusd / exports.MICRO_USD_PER_USD;
}
//# sourceMappingURL=llmCost.js.map