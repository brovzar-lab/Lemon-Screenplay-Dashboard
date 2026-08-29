"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRICED_MODELS = exports.INPUT_TOKEN_OVERHEAD = exports.DEFAULT_DAILY_LLM_BUDGET_USD = exports.NANO_USD_PER_MICRO_USD = exports.NANO_USD_PER_USD = exports.MICRO_USD_PER_USD = void 0;
exports.llmPricingSha256 = llmPricingSha256;
exports.getModelPricing = getModelPricing;
exports.calculateActualCostMicrousd = calculateActualCostMicrousd;
exports.calculateEstimatedCostNanousd = calculateEstimatedCostNanousd;
exports.nanousdToUsd = nanousdToUsd;
exports.calculateReservationMicrousd = calculateReservationMicrousd;
exports.calculateHighestAllowedReservationMicrousd = calculateHighestAllowedReservationMicrousd;
exports.parseDailyBudgetUsd = parseDailyBudgetUsd;
exports.usdToMicrousd = usdToMicrousd;
exports.microusdToUsd = microusdToUsd;
const anthropicProxyCore_1 = require("./anthropicProxyCore");
const anthropicPricing_json_1 = __importDefault(require("./anthropicPricing.json"));
exports.MICRO_USD_PER_USD = 1_000_000;
exports.NANO_USD_PER_USD = 1_000_000_000;
exports.NANO_USD_PER_MICRO_USD = 1_000;
exports.DEFAULT_DAILY_LLM_BUDGET_USD = 100;
exports.INPUT_TOKEN_OVERHEAD = 4_096;
// One committed decimal table is consumed by both runtimes. Deriving rates
// with floating-point multiplication produced different Python/JS hashes.
const MODEL_PRICING = anthropicPricing_json_1.default;
exports.PRICED_MODELS = Object.freeze(Object.keys(MODEL_PRICING));
function llmPricingSha256() {
    return (0, anthropicProxyCore_1.sha256CanonicalJson)(MODEL_PRICING);
}
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
    return Math.ceil(calculateEstimatedCostNanousd(model, usage) / exports.NANO_USD_PER_MICRO_USD);
}
function calculateEstimatedCostNanousd(model, usage) {
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
    const rateNanousd = (rate) => {
        const scaled = rate * exports.NANO_USD_PER_MICRO_USD;
        if (!Number.isInteger(scaled)) {
            throw new Error("Pricing must resolve to whole nano-USD per token.");
        }
        return scaled;
    };
    const baseNanousd = (input * rateNanousd(pricing.input)
        + output * rateNanousd(pricing.output)
        + detailedFiveMinuteWrite * rateNanousd(pricing.cacheWrite5m)
        + detailedOneHourWrite * rateNanousd(pricing.cacheWrite1h)
        + cacheRead * rateNanousd(pricing.cacheRead));
    if (usage.inference_geo !== "us")
        return baseNanousd;
    const usNanousd = baseNanousd * 11 / 10;
    if (!Number.isInteger(usNanousd)) {
        throw new Error("US inference pricing must resolve to whole nano-USD.");
    }
    return usNanousd;
}
function nanousdToUsd(nanousd) {
    return nanousd / exports.NANO_USD_PER_USD;
}
function calculateReservationMicrousd(model, requestBytes, maxOutputTokens) {
    const pricing = getModelPricing(model);
    const bytes = requireNonNegativeInteger(requestBytes, "requestBytes");
    const output = requireNonNegativeInteger(maxOutputTokens, "maxOutputTokens");
    const inputTokenUpperBound = bytes + exports.INPUT_TOKEN_OVERHEAD;
    // One UTF-8 byte per token is deliberately conservative. Charging the
    // whole possible input at the one-hour cache-write rate also covers the
    // most expensive approved cache miss.
    return Math.ceil(1.1 * (inputTokenUpperBound * Math.max(pricing.input, pricing.cacheWrite1h)
        + output * pricing.output));
}
function calculateHighestAllowedReservationMicrousd(models, requestBytes, maxOutputTokens) {
    if (models.length === 0)
        throw new Error("At least one allowed model is required.");
    return Math.max(...models.map((model) => calculateReservationMicrousd(model, requestBytes, maxOutputTokens)));
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