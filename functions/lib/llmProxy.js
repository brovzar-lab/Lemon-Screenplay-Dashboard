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
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const cors_1 = __importDefault(require("cors"));
const proxyAuth_1 = require("./proxyAuth");
const anthropicApiKey = (0, params_1.defineString)("ANTHROPIC_API_KEY");
// Shared secret for the VPS daemon (server-side, no user session). Empty in
// local dev disables service-key auth; browser ID-token auth still applies.
const proxyServiceKey = (0, params_1.defineString)("PROXY_SERVICE_KEY");
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
        const body = req.body;
        if (!body.model || !body.messages || !Array.isArray(body.messages)) {
            res.status(400).json({
                error: "Missing required fields: model, messages",
                code: "INVALID_INPUT",
            });
            return;
        }
        try {
            const client = new sdk_1.default({ apiKey: anthropicApiKey.value() });
            const system = extractSystem(body);
            const messages = userAssistantMessages(body);
            // Build the request payload with all optional fields forwarded.
            const payload = {
                model: body.model,
                max_tokens: body.max_tokens ?? 8096,
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
            // Use streaming under the hood and collect into a final Message.
            // Anthropic's SDK refuses non-streaming calls it estimates may exceed
            // 10 minutes (which heavy thinking + tool_use synthesis trips). The
            // streaming path has no such restriction, and the SDK's
            // `.finalMessage()` returns the same Message shape we'd get from
            // .create() — so the rest of the handler is unchanged.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const stream = client.messages.stream(payload);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const message = await stream.finalMessage();
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
            res.status(200).json({
                text,
                tool_uses: toolUses,
                thinking,
                content: message.content, // full block array for advanced callers
                model: message.model,
                stop_reason: message.stop_reason,
                usage,
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
        }
    });
});
//# sourceMappingURL=llmProxy.js.map