"use strict";
/**
 * LLM Proxy Cloud Function
 *
 * Receives model + messages from the browser, calls Anthropic directly.
 * API key lives in functions/.env — never exposed to the browser.
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
const anthropicApiKey = (0, params_1.defineString)("ANTHROPIC_API_KEY");
const corsMiddleware = (0, cors_1.default)({
    origin: [
        "https://lemon-screenplay-dashboard.web.app",
        "https://lemon-screenplay-dashboard.firebaseapp.com",
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
    ],
});
exports.llmProxy = (0, https_1.onRequest)({
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "256MiB",
    maxInstances: 50,
}, (req, res) => {
    corsMiddleware(req, res, async () => {
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed" });
            return;
        }
        const body = req.body;
        if (!body.model || !body.messages || !Array.isArray(body.messages)) {
            res.status(400).json({ error: "Missing required fields: model, messages", code: "INVALID_INPUT" });
            return;
        }
        try {
            const client = new sdk_1.default({ apiKey: anthropicApiKey.value() });
            // Split system messages out — Anthropic keeps them separate
            const systemParts = body.messages.filter(m => m.role === "system").map(m => m.content);
            const userMessages = body.messages.filter(m => m.role !== "system");
            const message = await client.messages.create({
                model: body.model,
                max_tokens: body.max_tokens ?? 8096,
                ...(systemParts.length > 0 ? { system: systemParts.join("\n") } : {}),
                messages: userMessages,
            });
            const text = message.content[0].type === "text" ? message.content[0].text : "";
            res.status(200).json({
                text,
                model: message.model,
                usage: {
                    input_tokens: message.usage.input_tokens,
                    output_tokens: message.usage.output_tokens,
                },
            });
        }
        catch (error) {
            console.error("[llmProxy] Error:", error);
            if (error.status === 429) {
                res.status(429).json({ error: "Rate limit exceeded — please wait and retry.", code: "RATE_LIMIT", isRetryable: true });
                return;
            }
            if (error.status === 401) {
                res.status(401).json({ error: "Invalid Anthropic API key.", code: "INVALID_API_KEY", isRetryable: false });
                return;
            }
            if (error.status === 400) {
                res.status(400).json({ error: error.message || "Invalid request.", code: "INVALID_INPUT", isRetryable: false });
                return;
            }
            res.status(500).json({ error: error.message || "Internal proxy error", code: "NETWORK_ERROR", isRetryable: true });
        }
    });
});
//# sourceMappingURL=llmProxy.js.map