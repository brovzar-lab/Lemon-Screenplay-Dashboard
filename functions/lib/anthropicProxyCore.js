"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyRequestValidationError = void 0;
exports.buildAnthropicRequest = buildAnthropicRequest;
exports.sha256CanonicalJson = sha256CanonicalJson;
exports.parseAnthropicMessage = parseAnthropicMessage;
const node_crypto_1 = require("node:crypto");
const llmProxyPolicy_1 = require("./llmProxyPolicy");
class ProxyRequestValidationError extends Error {
    code;
    constructor(message, code = "INVALID_INPUT") {
        super(message);
        this.code = code;
        this.name = "ProxyRequestValidationError";
    }
}
exports.ProxyRequestValidationError = ProxyRequestValidationError;
const EXTENDED_CACHE_TTL_BETA = "extended-cache-ttl-2025-04-11";
function usesOneHourCache(body) {
    const systemUsesOneHourCache = Array.isArray(body.system)
        && body.system.some((block) => block.cache_control?.ttl === "1h");
    if (systemUsesOneHourCache)
        return true;
    return body.messages.some((message) => (Array.isArray(message.content)
        && message.content.some((block) => ("cache_control" in block && block.cache_control?.ttl === "1h"))));
}
function extractSystem(body) {
    if (body.system !== undefined)
        return body.system;
    const systemMessages = body.messages.filter((message) => message.role === "system");
    if (systemMessages.length === 0)
        return undefined;
    const hasBlocks = systemMessages.some((message) => Array.isArray(message.content)
        && message.content.some((block) => block.type === "text" && block.cache_control !== undefined));
    if (!hasBlocks) {
        return systemMessages
            .map((message) => typeof message.content === "string" ? message.content : "")
            .join("\n");
    }
    const blocks = [];
    for (const message of systemMessages) {
        if (typeof message.content === "string") {
            blocks.push({ type: "text", text: message.content });
            continue;
        }
        for (const block of message.content) {
            if (block.type === "text")
                blocks.push(block);
        }
    }
    return blocks;
}
function userAssistantMessages(body) {
    return body.messages
        .filter((message) => message.role !== "system")
        .map((message) => ({ role: message.role, content: message.content }));
}
function buildAnthropicRequest(value, caller, operationalOutputCap, thinkingTokenCap) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new ProxyRequestValidationError("Request body must be an object.");
    }
    const body = value;
    if (typeof body.model !== "string" || !Array.isArray(body.messages)) {
        throw new ProxyRequestValidationError("Missing required fields: model, messages");
    }
    let modelOutputLimit;
    try {
        modelOutputLimit = (0, llmProxyPolicy_1.approvedMaxOutputTokens)(body.model, operationalOutputCap);
    }
    catch {
        throw new ProxyRequestValidationError("Model is not approved.", "INVALID_MODEL");
    }
    const maxTokens = body.max_tokens ?? 8_096;
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > modelOutputLimit) {
        throw new ProxyRequestValidationError(`max_tokens must be an integer between 1 and ${modelOutputLimit}.`);
    }
    if (body.thinking?.type === "enabled"
        && (!Number.isInteger(body.thinking.budget_tokens)
            || body.thinking.budget_tokens < 1
            || body.thinking.budget_tokens > thinkingTokenCap)) {
        throw new ProxyRequestValidationError(`thinking.budget_tokens must be between 1 and ${thinkingTokenCap}.`);
    }
    let outputConfig;
    try {
        outputConfig = (0, llmProxyPolicy_1.validateModelRequest)(body.model, caller, {
            thinking: body.thinking,
            temperature: body.temperature,
            top_p: body.top_p,
            top_k: body.top_k,
            tool_choice: body.tool_choice,
            output_config: body.output_config,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Invalid model request.";
        throw new ProxyRequestValidationError(message, message === "Model is not approved." ? "INVALID_MODEL" : "INVALID_INPUT");
    }
    let jobId;
    if (caller === "service" && body.job_id !== undefined) {
        if (typeof body.job_id !== "string"
            || body.job_id.length < 1
            || body.job_id.length > 1_500
            || body.job_id.includes("/")) {
            throw new ProxyRequestValidationError("job_id must be a service-only Firestore document ID.");
        }
        jobId = body.job_id;
    }
    const payload = {
        model: body.model,
        max_tokens: maxTokens,
        messages: userAssistantMessages(body),
    };
    const system = extractSystem(body);
    if (system !== undefined)
        payload.system = system;
    if (typeof body.temperature === "number")
        payload.temperature = body.temperature;
    if (typeof body.top_p === "number")
        payload.top_p = body.top_p;
    if (typeof body.top_k === "number")
        payload.top_k = body.top_k;
    if (body.tools?.length)
        payload.tools = body.tools;
    if (body.tool_choice)
        payload.tool_choice = body.tool_choice;
    if (body.thinking)
        payload.thinking = body.thinking;
    if (outputConfig)
        payload.output_config = outputConfig;
    return {
        body,
        payload,
        maxTokens,
        jobId,
        ...(usesOneHourCache(body)
            ? { requestOptions: { headers: { "anthropic-beta": EXTENDED_CACHE_TTL_BETA } } }
            : {}),
    };
}
function canonicalize(value) {
    if (Array.isArray(value))
        return value.map(canonicalize);
    if (!value || typeof value !== "object")
        return value;
    return Object.fromEntries(Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]));
}
function sha256CanonicalJson(value) {
    return (0, node_crypto_1.createHash)("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}
function parseAnthropicMessage(message) {
    if (!message || typeof message !== "object")
        throw new Error("Invalid Anthropic response.");
    const record = message;
    const content = Array.isArray(record.content) ? record.content : [];
    const blocks = content.filter((block) => Boolean(block && typeof block === "object"));
    const usageRecord = record.usage && typeof record.usage === "object"
        ? record.usage
        : {};
    const cacheCreation = usageRecord.cache_creation
        && typeof usageRecord.cache_creation === "object"
        ? usageRecord.cache_creation
        : undefined;
    const optionalNumber = (input) => (typeof input === "number" && Number.isInteger(input) && input >= 0 ? input : 0);
    const requiredNumber = (input, field) => {
        if (typeof input !== "number" || !Number.isInteger(input) || input < 0) {
            throw new Error(`Anthropic response omitted valid ${field} usage.`);
        }
        return input;
    };
    const responseId = typeof record.id === "string" ? record.id : "";
    const model = typeof record.model === "string" ? record.model : "";
    if (!responseId || !model)
        throw new Error("Anthropic response omitted exact provenance.");
    return {
        text: String(blocks.find((block) => block.type === "text")?.text ?? ""),
        toolUses: blocks
            .filter((block) => block.type === "tool_use")
            .map((block) => ({
            id: String(block.id ?? ""),
            name: String(block.name ?? ""),
            input: block.input && typeof block.input === "object" && !Array.isArray(block.input)
                ? block.input
                : {},
        })),
        thinking: blocks
            .filter((block) => block.type === "thinking")
            .map((block) => String(block.thinking ?? ""))
            .join("\n"),
        content,
        responseId,
        model,
        stopReason: typeof record.stop_reason === "string" ? record.stop_reason : null,
        usage: {
            input_tokens: requiredNumber(usageRecord.input_tokens, "input_tokens"),
            output_tokens: requiredNumber(usageRecord.output_tokens, "output_tokens"),
            cache_creation_input_tokens: optionalNumber(usageRecord.cache_creation_input_tokens),
            cache_read_input_tokens: optionalNumber(usageRecord.cache_read_input_tokens),
            ...(cacheCreation ? {
                cache_creation: {
                    ephemeral_5m_input_tokens: optionalNumber(cacheCreation.ephemeral_5m_input_tokens),
                    ephemeral_1h_input_tokens: optionalNumber(cacheCreation.ephemeral_1h_input_tokens),
                },
            } : {}),
        },
    };
}
//# sourceMappingURL=anthropicProxyCore.js.map