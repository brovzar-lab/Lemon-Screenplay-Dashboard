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
const llmProxyCapability_1 = require("./llmProxyCapability");
const anthropicClient_1 = require("./anthropicClient");
const budgetCounter_1 = require("./budgetCounter");
const llmCost_1 = require("./llmCost");
const llmProxyErrors_1 = require("./llmProxyErrors");
const anthropicProxyCore_1 = require("./anthropicProxyCore");
const anthropicApiKey = (0, params_1.defineSecret)("ANTHROPIC_API_KEY");
const dailyLlmBudgetUsd = (0, params_1.defineString)("DAILY_LLM_BUDGET_USD", {
    default: String(llmCost_1.DEFAULT_DAILY_LLM_BUDGET_USD),
});
// Shared secret for the VPS daemon (server-side, no user session). Empty in
// local dev disables service-key auth; browser ID-token auth still applies.
const proxyServiceKey = (0, params_1.defineSecret)("PROXY_SERVICE_KEY");
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
// ─── Handler ─────────────────────────────────────────────────────────────────
exports.llmProxy = (0, https_1.onRequest)({
    region: "us-central1",
    // Up to 60 min — Opus synthesis with 16K thinking + 6K output can take
    // several minutes; streaming + a generous ceiling prevents the SDK's
    // "operations may take longer than 10 minutes" refusal.
    timeoutSeconds: 3600,
    memory: "512MiB",
    maxInstances: 50,
    secrets: [anthropicApiKey, proxyServiceKey],
    // One long-running request per instance keeps the active reservation map
    // bounded while still allowing up to 50 parallel model calls.
    concurrency: 1,
}, (req, res) => {
    corsMiddleware(req, res, async () => {
        if (req.method !== "GET" && req.method !== "POST") {
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
        // Free authenticated rollout preflight for the VPS daemon. This stays
        // before any budget reservation or model call.
        if (req.method === "GET") {
            if (authResult.kind !== "service") {
                res.status(403).json({
                    error: "The trust preflight is available to the ingest service only.",
                    code: "FORBIDDEN",
                    isRetryable: false,
                });
                return;
            }
            res.status(200).json((0, llmProxyCapability_1.buildTrustCapability)());
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
        let built;
        try {
            built = (0, anthropicProxyCore_1.buildAnthropicRequest)(req.body, authResult.kind, MAX_OUTPUT_TOKENS, MAX_THINKING_TOKENS);
        }
        catch (error) {
            const validation = error instanceof anthropicProxyCore_1.ProxyRequestValidationError
                ? error
                : new anthropicProxyCore_1.ProxyRequestValidationError("Invalid request.");
            res.status(400).json({ error: validation.message, code: validation.code });
            return;
        }
        const { body, payload, maxTokens, jobId, requestOptions } = built;
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
            res.status(503).json((0, llmProxyErrors_1.preCallAccountingUnavailableResponse)());
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
                const stream = client.messages.stream(payload, requestOptions);
                return stream.finalMessage();
            }, async (reason) => {
                await (0, budgetCounter_1.settleUncertainLlmBudget)(reservation, reason);
            }, async (reason) => {
                await (0, budgetCounter_1.releaseLlmBudget)(reservation, reason);
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }
        catch (error) {
            console.error("[llmProxy] Error:", error);
            if ((0, anthropicClient_1.isDefiniteAnthropicRequestRejection)(error)) {
                res.status(400).json((0, llmProxyErrors_1.upstreamInvalidRequestResponse)());
                return;
            }
            res.status(503).json((0, llmProxyErrors_1.postCallAccountingUncertainResponse)());
            return;
        }
        try {
            const parsed = (0, anthropicProxyCore_1.parseAnthropicMessage)(message);
            const settlement = await (0, budgetCounter_1.settleLlmBudget)(reservation, parsed.usage, parsed.model);
            if (parsed.model !== body.model) {
                res.status(502).json({
                    error: "Anthropic returned a different model than the exact model requested.",
                    code: "MODEL_PROVENANCE_MISMATCH",
                    isRetryable: false,
                    manualReviewRequired: true,
                    requested_model: body.model,
                    returned_model: parsed.model,
                    response_id: parsed.responseId,
                    stop_reason: parsed.stopReason,
                    usage: {
                        ...parsed.usage,
                        call_count: 1,
                        actual_cost_microusd: settlement.actual_cost_microusd,
                        actual_cost_usd: settlement.actual_cost_usd,
                    },
                });
                return;
            }
            res.status(200).json({
                text: parsed.text,
                tool_uses: parsed.toolUses,
                thinking: parsed.thinking,
                content: parsed.content,
                response_id: parsed.responseId,
                model: parsed.model,
                stop_reason: parsed.stopReason,
                usage: {
                    ...parsed.usage,
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
            res.status(503).json((0, llmProxyErrors_1.postCallAccountingUncertainResponse)());
        }
    });
});
//# sourceMappingURL=llmProxy.js.map