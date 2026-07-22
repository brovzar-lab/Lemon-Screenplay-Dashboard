"use strict";
/**
 * LLM Proxy Cloud Function — V9
 *
 * Pass-through to Anthropic with full feature surface:
 *   • Structured content blocks (caching, citations, images, PDFs)
 *   • Prompt caching via cache_control on any text/document block
 *   • tool_use forced output (schema-guaranteed JSON)
 *   • Extended thinking (Sonnet 4.6 / Opus 4.7)
 *   • Temperature override
 *
 * Backward-compatible: the old shape (messages with string content) still
 * works. The new shape (messages with content-block arrays) is preferred for
 * any path that wants caching or tool_use.
 *
 * API keys live in functions/.env. Never exposed to the browser.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmProxy = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const cors_1 = __importDefault(require("cors"));
const proxyAuth_1 = require("./proxyAuth");
const anthropicClient_1 = require("./anthropicClient");
const budgetCounter_1 = require("./budgetCounter");
const llmCost_1 = require("./llmCost");
const anthropicApiKey = (0, params_1.defineString)("ANTHROPIC_API_KEY");
const dailyLlmBudgetUsd = (0, params_1.defineString)("DAILY_LLM_BUDGET_USD", {
    default: String(llmCost_1.DEFAULT_DAILY_LLM_BUDGET_USD),
});
// Shared secret for the VPS daemon (server-side, no user session). Empty in
// local dev disables service-key auth; browser ID-token auth still applies.
const proxyServiceKey = (0, params_1.defineString)("PROXY_SERVICE_KEY");
const ALLOWED_MODELS = new Set([
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-6",
    "claude-opus-4-7",
]);
const MAX_OUTPUT_TOKENS = 24_000;
const MAX_THINKING_TOKENS = 16_000;
const corsMiddleware = (0, cors_1.default)({
    origin: [
        "https://lemon-screenplay-dashboard.web.app",
        "https://lemon-screenplay-dashboard.firebaseapp.com",
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
    ],
});
// ─── Helpers ─────────────────────────────────────────────────────────────────
/**
 * Extract a single concatenated system prompt from the request.
 * Accepts:
 *   - body.system as string
 *   - body.system as array of text blocks (preserves cache_control)
 *   - legacy: system-role entries inside body.messages (string content only)
 *
 * Returns the value to pass as Anthropic's `system` field, or undefined.
 */
function extractSystem(body) {
    // Preferred: explicit top-level system field
    if (body.system !== undefined)
        return body.system;
    // Legacy: system-role messages embedded in messages[]
    const systemMessages = body.messages.filter((m) => m.role === "system");
    if (systemMessages.length === 0)
        return undefined;
    // If any system message has block content with cache_control, build a block array.
    const hasBlocks = systemMessages.some((m) => Array.isArray(m.content) &&
        m.content.some((b) => b.type === "text" && b.cache_control));
    if (hasBlocks) {
        const blocks = [];
        for (const m of systemMessages) {
            if (Array.isArray(m.content)) {
                for (const b of m.content) {
                    if (b.type === "text") {
                        blocks.push({
                            type: "text",
                            text: b.text,
                            ...(b.cache_control ? { cache_control: b.cache_control } : {}),
                        });
                    }
                }
            }
            else {
                blocks.push({ type: "text", text: m.content });
            }
        }
        return blocks;
    }
    // Plain string concat
    return systemMessages
        .map((m) => (typeof m.content === "string" ? m.content : ""))
        .join("\n");
}
/**
 * Strip system messages out, returning the user/assistant messages to send
 * to Anthropic. Content is passed through unchanged — strings stay strings,
 * block arrays stay block arrays.
 */
function userAssistantMessages(body) {
    return body.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));
}
// ─── Handler ─────────────────────────────────────────────────────────────────
exports.llmProxy = (0, https_1.onRequest)({
    region: "us-central1",
    // Up to 60 min — Opus synthesis with 16K thinking + 6K output can take
    // several minutes; streaming + a generous ceiling prevents the SDK's
    // "operations may take longer than 10 minutes" refusal.
    timeoutSeconds: 3600,
    memory: "512MiB",
    maxInstances: 50,
    // One long-running request per instance keeps the active reservation map
    // bounded while still allowing up to 50 parallel model calls.
    concurrency: 1,
}, (req, res) => {
    corsMiddleware(req, res, async () => {
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        // ── Authenticate the caller before spending the Anthropic key ──
        const authResult = await (0, proxyAuth_1.authenticateProxyRequest)(req, proxyServiceKey.value());
        if (!authResult.ok) {
            res.status(authResult.status).json({
                error: authResult.message,
                code: "UNAUTHORIZED",
                isRetryable: false,
            });
            return;
        }
        if (authResult.kind === "user"
            && (!authResult.emailVerified || !authResult.email.endsWith("@lemonfilms.com"))) {
            res.status(403).json({
                error: "A verified Lemon Studios account is required.",
                code: "FORBIDDEN",
                isRetryable: false,
            });
            return;
        }
        const body = req.body;
        if (!body.model || !body.messages || !Array.isArray(body.messages)) {
            res.status(400).json({
                error: "Missing required fields: model, messages",
                code: "INVALID_INPUT",
            });
            return;
        }
        if (!ALLOWED_MODELS.has(body.model)) {
            res.status(400).json({ error: "Model is not approved.", code: "INVALID_MODEL" });
            return;
        }
        const maxTokens = body.max_tokens ?? 8_096;
        if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > MAX_OUTPUT_TOKENS) {
            res.status(400).json({
                error: `max_tokens must be an integer between 1 and ${MAX_OUTPUT_TOKENS}.`,
                code: "INVALID_INPUT",
            });
            return;
        }
        if (body.thinking) {
            if (body.thinking.type !== "enabled" && body.thinking.type !== "adaptive") {
                res.status(400).json({
                    error: "Unsupported thinking mode.",
                    code: "INVALID_INPUT",
                });
                return;
            }
            if (body.thinking.type === "enabled"
                && (!Number.isInteger(body.thinking.budget_tokens)
                    || body.thinking.budget_tokens < 1
                    || body.thinking.budget_tokens > MAX_THINKING_TOKENS)) {
                res.status(400).json({
                    error: `thinking.budget_tokens must be between 1 and ${MAX_THINKING_TOKENS}.`,
                    code: "INVALID_INPUT",
                });
                return;
            }
            if (body.thinking.type === "adaptive" && !body.model.includes("opus")) {
                res.status(400).json({
                    error: "Adaptive thinking is approved only for Opus models.",
                    code: "INVALID_INPUT",
                });
                return;
            }
        }
        if (body.temperature !== undefined
            && (!Number.isFinite(body.temperature)
                || body.temperature < 0
                || body.temperature > 1)) {
            res.status(400).json({
                error: "temperature must be between 0 and 1.",
                code: "INVALID_INPUT",
            });
            return;
        }
        let jobId;
        if (authResult.kind === "service" && body.job_id !== undefined) {
            if (typeof body.job_id !== "string"
                || body.job_id.length < 1
                || body.job_id.length > 1_500
                || body.job_id.includes("/")) {
                res.status(400).json({
                    error: "job_id must be a Firestore document ID.",
                    code: "INVALID_INPUT",
                    isRetryable: false,
                });
                return;
            }
            jobId = body.job_id;
        }
        const system = extractSystem(body);
        const messages = userAssistantMessages(body);
        // Build the request payload with all optional fields forwarded.
        const payload = {
            model: body.model,
            max_tokens: maxTokens,
            messages,
        };
        if (system !== undefined)
            payload.system = system;
        if (typeof body.temperature === "number")
            payload.temperature = body.temperature;
        if (body.tools && body.tools.length > 0)
            payload.tools = body.tools;
        if (body.tool_choice)
            payload.tool_choice = body.tool_choice;
        if (body.thinking)
            payload.thinking = body.thinking;
        const client = (0, anthropicClient_1.createAnthropicClient)(anthropicApiKey.value());
        let reservation;
        try {
            const limitUsd = (0, llmCost_1.parseDailyBudgetUsd)(dailyLlmBudgetUsd.value());
            reservation = await (0, budgetCounter_1.reserveLlmBudget)({
                model: body.model,
                requestBytes: Buffer.byteLength(JSON.stringify(payload), "utf8"),
                maxOutputTokens: maxTokens,
                limitMicrousd: (0, llmCost_1.usdToMicrousd)(limitUsd),
                jobId,
            });
        }
        catch (error) {
            if (error instanceof budgetCounter_1.DailyBudgetExceededError) {
                res.status(429).json({
                    error: error.message,
                    code: error.code,
                    isRetryable: false,
                    resetAt: error.resetAt.toISOString(),
                    limitUsd: error.limitMicrousd / 1_000_000,
                });
                return;
            }
            console.error("[llmProxy] Budget reservation failed:", error);
            res.status(503).json({
                error: "AI budget accounting is unavailable. No model call was made.",
                code: "BUDGET_ACCOUNTING_ERROR",
                isRetryable: true,
            });
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let message;
        try {
            // Use streaming under the hood and collect into a final Message.
            // Anthropic's SDK refuses non-streaming calls it estimates may exceed
            // 10 minutes (which heavy thinking + tool_use synthesis trips). The
            // streaming path has no such restriction, and the SDK's
            // `.finalMessage()` returns the same Message shape we'd get from
            // .create() — so the rest of the handler is unchanged.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            message = await (0, anthropicClient_1.finalMessageWithUncertainSpendProtection)(async () => {
                const stream = client.messages.stream(payload);
                return stream.finalMessage();
            }, async (reason) => {
                await (0, budgetCounter_1.settleUncertainLlmBudget)(reservation, reason);
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }
        catch (error) {
            console.error("[llmProxy] Error:", error);
            if (error.status === 429) {
                res.status(429).json({
                    error: "Rate limit exceeded — please wait and retry.",
                    code: "RATE_LIMIT",
                    isRetryable: true,
                });
                return;
            }
            if (error.status === 401) {
                res.status(401).json({
                    error: "Invalid Anthropic API key.",
                    code: "INVALID_API_KEY",
                    isRetryable: false,
                });
                return;
            }
            if (error.status === 400) {
                res.status(400).json({
                    error: error.message || "Invalid request.",
                    code: "INVALID_INPUT",
                    isRetryable: false,
                });
                return;
            }
            res.status(500).json({
                error: error.message || "Internal proxy error",
                code: "NETWORK_ERROR",
                isRetryable: true,
            });
            return;
        }
        try {
            // Extract the first text block (back-compat).
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const textBlock = message.content.find((b) => b.type === "text");
            const text = textBlock?.text ?? "";
            // Extract tool_use blocks (new path) — the daemon and frontend can
            // read this directly to get schema-guaranteed JSON without parsing.
            const toolUses = message.content
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((b) => b.type === "tool_use")
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((b) => ({ id: b.id, name: b.name, input: b.input }));
            // Pull thinking blocks too (informational; useful for debugging).
            const thinking = message.content
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .filter((b) => b.type === "thinking")
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((b) => b.thinking ?? "")
                .join("\n");
            // Full usage breakdown (cache hits, thinking, output tokens).
            const usage = {
                input_tokens: message.usage.input_tokens ?? 0,
                output_tokens: message.usage.output_tokens ?? 0,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                cache_creation_input_tokens: message.usage.cache_creation_input_tokens ?? 0,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
            };
            const settlement = await (0, budgetCounter_1.settleLlmBudget)(reservation, usage);
            res.status(200).json({
                text,
                tool_uses: toolUses,
                thinking,
                content: message.content, // full block array for advanced callers
                model: message.model,
                stop_reason: message.stop_reason,
                usage: {
                    ...usage,
                    call_count: 1,
                    actual_cost_microusd: settlement.actual_cost_microusd,
                    actual_cost_usd: settlement.actual_cost_usd,
                },
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }
        catch (error) {
            // The Anthropic call happened, so leave the reservation in place. It
            // must never be released as though no money was spent.
            console.error("[llmProxy] Budget settlement failed:", error);
            res.status(503).json({
                error: "The model responded, but cost accounting could not be settled.",
                code: "BUDGET_ACCOUNTING_ERROR",
                isRetryable: false,
            });
        }
    });
});
//# sourceMappingURL=llmProxy.js.map