"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isApprovedProxyModel = isApprovedProxyModel;
exports.approvedOutputConfig = approvedOutputConfig;
exports.validateModelRequest = validateModelRequest;
exports.approvedMaxOutputTokens = approvedMaxOutputTokens;
const modelRegistry_1 = require("./modelRegistry");
const GENERAL_PROXY_MODELS = new Set([
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-6",
    "claude-opus-4-7",
]);
const BENCHMARK_CANDIDATE_MODELS = new Set([
    "claude-sonnet-5",
    "claude-opus-5",
]);
const MODEL_CAPABILITIES = {
    "claude-haiku-4-5-20251001": {
        thinking: ["enabled"], effort: false, sampling: true, maxOutputTokens: 64_000,
    },
    "claude-sonnet-4-6": {
        thinking: ["enabled"], effort: false, sampling: true, maxOutputTokens: 64_000,
    },
    "claude-opus-4-7": {
        thinking: ["adaptive"], effort: true, sampling: false, maxOutputTokens: 128_000,
    },
    "claude-sonnet-5": {
        thinking: ["adaptive", "disabled"], effort: true, sampling: false, maxOutputTokens: 128_000,
    },
    "claude-opus-5": {
        thinking: ["adaptive", "disabled"], effort: true, sampling: false, maxOutputTokens: 128_000,
    },
    "claude-fable-5": {
        thinking: [], alwaysOnThinking: true, effort: true, sampling: false, maxOutputTokens: 128_000,
    },
};
function isApprovedProxyModel(model, caller) {
    if (typeof model !== "string")
        return false;
    if (GENERAL_PROXY_MODELS.has(model))
        return true;
    return caller === "service"
        && (BENCHMARK_CANDIDATE_MODELS.has(model) || modelRegistry_1.READER_CHAT_MODEL_IDS.has(model));
}
function approvedOutputConfig(value) {
    if (value === undefined)
        return undefined;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("output_config must be an object.");
    }
    const record = value;
    if (Object.keys(record).some((key) => key !== "effort")) {
        throw new Error("output_config contains unsupported fields.");
    }
    const effort = record.effort;
    if (effort !== "low" && effort !== "medium" && effort !== "high"
        && effort !== "xhigh" && effort !== "max") {
        throw new Error("Unsupported effort level.");
    }
    return { effort };
}
function validateModelRequest(model, caller, request, candidateBenchmarkControls = false) {
    if (!isApprovedProxyModel(model, caller))
        throw new Error("Model is not approved.");
    const capabilities = MODEL_CAPABILITIES[model];
    if (!capabilities)
        throw new Error("Model capabilities are not configured.");
    if (request.thinking?.type === "disabled" && !candidateBenchmarkControls) {
        throw new Error("Explicitly disabled thinking is restricted to the candidate benchmark.");
    }
    if (request.thinking && !capabilities.thinking.includes(request.thinking.type)) {
        throw new Error(`${request.thinking.type} thinking is not supported for ${model}.`);
    }
    if (capabilities.alwaysOnThinking && request.thinking) {
        throw new Error(`${model} uses always-on thinking; omit the thinking field.`);
    }
    const sampling = [request.temperature, request.top_p, request.top_k]
        .filter((value) => value !== undefined);
    if (!capabilities.sampling && sampling.length) {
        throw new Error(`Sampling parameters must be omitted for ${model}.`);
    }
    if (sampling.length > 1)
        throw new Error("Send at most one sampling parameter.");
    if (request.temperature !== undefined
        && (!Number.isFinite(request.temperature)
            || request.temperature < 0 || request.temperature > 1)) {
        throw new Error("temperature must be between 0 and 1.");
    }
    if (request.top_p !== undefined
        && (!Number.isFinite(request.top_p) || request.top_p < 0 || request.top_p > 1)) {
        throw new Error("top_p must be between 0 and 1.");
    }
    if (request.top_k !== undefined
        && (!Number.isInteger(request.top_k) || request.top_k < 1)) {
        throw new Error("top_k must be a positive integer.");
    }
    if (request.thinking?.type === "enabled") {
        if (request.temperature !== undefined && request.temperature !== 1) {
            throw new Error("Manual extended thinking requires temperature 1 when temperature is sent.");
        }
        if (request.top_p !== undefined || request.top_k !== undefined) {
            throw new Error("Manual extended thinking cannot use top_p or top_k.");
        }
    }
    const thinkingActive = request.thinking?.type !== "disabled"
        && (Boolean(request.thinking) || capabilities.alwaysOnThinking);
    const adaptiveForcedTool = candidateBenchmarkControls
        && BENCHMARK_CANDIDATE_MODELS.has(model)
        && request.thinking?.type === "adaptive";
    if (thinkingActive && request.tool_choice && request.tool_choice.type !== "auto"
        && !adaptiveForcedTool) {
        throw new Error("Thinking requests cannot force tool choice.");
    }
    const outputConfig = approvedOutputConfig(request.output_config);
    if (outputConfig && !capabilities.effort) {
        throw new Error(`Effort is not supported for ${model}.`);
    }
    return outputConfig;
}
function approvedMaxOutputTokens(model, operationalCap) {
    const capabilities = MODEL_CAPABILITIES[model];
    if (!capabilities)
        throw new Error("Model capabilities are not configured.");
    return Math.min(capabilities.maxOutputTokens, operationalCap);
}
//# sourceMappingURL=llmProxyPolicy.js.map