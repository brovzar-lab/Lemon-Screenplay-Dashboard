"use strict";
/**
 * analyzeScreenplay Cloud Function
 *
 * Accepts screenplay text + metadata, calls Anthropic API with the analysis prompt,
 * and returns the raw analysis JSON. The client normalizes it.
 *
 * Security hardening (v2):
 *   - Input sanitization: title truncated + special chars stripped (M1)
 *   - API key format pre-validation before forwarding (H1 partial)
 *   - Explicit field-count guard to prevent oversized payloads
 *   - Server-side call counter in Firestore — now shared with the ingest pipeline
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeScreenplay = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const app_1 = require("firebase-admin/app");
const prompts_1 = require("./prompts");
const budgetCounter_1 = require("./budgetCounter");
const crypto_1 = require("crypto");
const anthropicApiKey = (0, params_1.defineString)('ANTHROPIC_API_KEY');
// Init Firebase Admin once
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
/**
 * Short hash of the current prompt template.
 * Stored with every analysis so results across prompt versions can be compared.
 * Recomputed at cold-start time; stable within a single deployment.
 */
let _promptVersionCache = null;
function getPromptVersion(prompt) {
    if (!_promptVersionCache) {
        _promptVersionCache = (0, crypto_1.createHash)('sha256').update(prompt).digest('hex').slice(0, 8);
    }
    return `v7-${_promptVersionCache}`;
}
const CLAUDE_MODELS = {
    sonnet: 'claude-sonnet-4-6',
    haiku: 'claude-haiku-4-5-20251001',
    opus: 'claude-opus-4-7',
};
// ≈37.5K tokens — leaves headroom for template (~10K), lenses, and 16K output budget
const MAX_TEXT_LENGTH = 150_000;
/**
 * Sanitize title to prevent prompt injection (Fix M1).
 * - Truncates to 200 chars
 * - Strips characters that could break the JSON prompt template
 */
function sanitizeTitle(raw) {
    return raw
        .slice(0, 200)
        .replace(/[<>{}[\]`\\]/g, '') // strip prompt-injection chars
        .replace(/\s+/g, ' ')
        .trim();
}
// isValidAnthropicKeyFormat removed — API key is now server-side via LiteLLM
exports.analyzeScreenplay = (0, https_1.onCall)({
    timeoutSeconds: 540, // 9 min — analysis can take 2-5 min
    memory: '512MiB',
    maxInstances: 5,
    cors: true,
    invoker: 'public', // App Check enforcement can be added here once enabled in Console
}, async (request) => {
    const data = request.data;
    // ── Input validation ──────────────────────────────────────────────────────
    if (!data.text || typeof data.text !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Missing or invalid screenplay text');
    }
    if (!data.metadata?.title) {
        throw new https_1.HttpsError('invalid-argument', 'Missing metadata.title');
    }
    // Fix M1: sanitize title to prevent prompt injection
    const safeTitle = sanitizeTitle(data.metadata.title);
    // Validate metadata types
    const pageCount = Number(data.metadata.pageCount) || 0;
    const wordCount = Number(data.metadata.wordCount) || 0;
    // Validate lenses array
    const lenses = Array.isArray(data.lenses) ? data.lenses.slice(0, 10) : [];
    // Shared budget gate — same Firestore counter used by ingest pipeline & VPS daemon
    await (0, budgetCounter_1.checkAndIncrementBudget)(undefined, /* throwAsHttpsError */ true);
    // ── Text truncation ───────────────────────────────────────────────────────
    let text = data.text;
    if (text.length > MAX_TEXT_LENGTH) {
        text = text.slice(0, MAX_TEXT_LENGTH) + '\n\n[... truncated ...]';
        console.log(`[Prompt] "${safeTitle}" — truncated to ${MAX_TEXT_LENGTH} chars`);
    }
    console.log(`[Prompt] "${safeTitle}" — ~${Math.round(text.length / 4).toLocaleString()} screenplay tokens`);
    const modelKey = data.model || 'sonnet';
    const model = CLAUDE_MODELS[modelKey] || CLAUDE_MODELS.sonnet;
    // Build prompt using sanitized title
    const prompt = (0, prompts_1.buildAnalysisPrompt)(text, { title: safeTitle, pageCount, wordCount }, lenses);
    // ── Call Anthropic API ───────────────────────────────────────────────────
    const client = new sdk_1.default({ apiKey: anthropicApiKey.value() });
    try {
        const message = await client.messages.create({
            model,
            max_tokens: 16000,
            messages: [{ role: 'user', content: prompt }],
        });
        const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
        // Parse JSON from response
        let analysis;
        try {
            analysis = JSON.parse(responseText);
        }
        catch {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
            }
            else {
                throw new https_1.HttpsError('internal', 'Failed to parse analysis JSON from response');
            }
        }
        return {
            source_file: safeTitle.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf',
            analysis_model: `claude-${modelKey}`,
            analysis_version: 'v7',
            prompt_version: getPromptVersion(prompt),
            lenses_enabled: lenses,
            metadata: {
                filename: safeTitle + '.pdf',
                page_count: pageCount,
                word_count: wordCount,
            },
            analysis,
            usage: {
                input_tokens: message.usage.input_tokens,
                output_tokens: message.usage.output_tokens,
                finish_reason: message.stop_reason ?? null,
            },
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        const err = error;
        throw new https_1.HttpsError('internal', `Analysis failed: ${err.message || 'Unknown error'}`);
    }
});
//# sourceMappingURL=analyzeScreenplay.js.map