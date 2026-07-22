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
// USD per million tokens. Cache writes use Anthropic's five-minute rate.
const MODEL_PRICING = {
    "claude-haiku-4-5-20251001": {
        input: 1,
        cacheWrite: 1.25,
        cacheRead: 0.1,
        output: 5,
    },
    "claude-sonnet-4-6": {
        input: 3,
        cacheWrite: 3.75,
        cacheRead: 0.3,
        output: 15,
    },
    "claude-opus-4-7": {
        input: 5,
        cacheWrite: 6.25,
        cacheRead: 0.5,
        output: 25,
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
    const cacheWrite = requireNonNegativeInteger(usage.cache_creation_input_tokens, "cache_creation_input_tokens");
    const cacheRead = requireNonNegativeInteger(usage.cache_read_input_tokens, "cache_read_input_tokens");
    // A $1/M-token rate is exactly 1 micro-USD per token.
    return Math.ceil(input * pricing.input
        + output * pricing.output
        + cacheWrite * pricing.cacheWrite
        + cacheRead * pricing.cacheRead);
}
function calculateReservationMicrousd(model, requestBytes, maxOutputTokens) {
    const pricing = getModelPricing(model);
    const bytes = requireNonNegativeInteger(requestBytes, "requestBytes");
    const output = requireNonNegativeInteger(maxOutputTokens, "maxOutputTokens");
    const inputTokenUpperBound = bytes + exports.INPUT_TOKEN_OVERHEAD;
    // One UTF-8 byte per token is deliberately conservative. Charging the
    // whole possible input at the cache-write rate also covers a cache miss.
    return Math.ceil(inputTokenUpperBound * Math.max(pricing.input, pricing.cacheWrite)
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