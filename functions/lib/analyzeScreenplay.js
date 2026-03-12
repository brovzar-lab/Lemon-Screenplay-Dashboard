"use strict";
/**
 * analyzeScreenplay Cloud Function
 *
 * Accepts screenplay text + metadata, calls Anthropic API with the V6 prompt,
 * and returns the raw analysis JSON. The client normalizes it.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeScreenplay = void 0;
const https_1 = require("firebase-functions/v2/https");
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const prompts_1 = require("./prompts");
const CLAUDE_MODELS = {
    sonnet: 'claude-sonnet-4-5-20250929',
    haiku: 'claude-haiku-4-5-20251001',
    opus: 'claude-3-opus-20240229', // claude-opus-4 not yet on API
};
// ≈37.5K tokens — leaves headroom for template (~10K), lenses, and 16K output budget
const MAX_TEXT_LENGTH = 150_000;
exports.analyzeScreenplay = (0, https_1.onCall)({
    timeoutSeconds: 540, // 9 min — analysis can take 2-5 min
    memory: '512MiB',
    maxInstances: 5,
    cors: true,
    invoker: 'public', // Allow unauthenticated Firebase SDK calls from the browser
}, async (request) => {
    const data = request.data;
    // Validate required fields
    if (!data.text || typeof data.text !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Missing or invalid screenplay text');
    }
    if (!data.apiKey || typeof data.apiKey !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Missing API key');
    }
    if (!data.metadata?.title) {
        throw new https_1.HttpsError('invalid-argument', 'Missing metadata.title');
    }
    // Truncate text if too long
    let text = data.text;
    if (text.length > MAX_TEXT_LENGTH) {
        text = text.slice(0, MAX_TEXT_LENGTH) + '\n\n[... truncated ...]';
        console.log(`[Prompt] "${data.metadata.title}" — truncated to ${MAX_TEXT_LENGTH} chars`);
    }
    // Token estimate for Firebase monitoring (~1 token per 4 chars)
    console.log(`[Prompt] "${data.metadata.title}" — ~${Math.round(text.length / 4).toLocaleString()} screenplay tokens`);
    const modelKey = data.model || 'sonnet';
    const model = CLAUDE_MODELS[modelKey] || CLAUDE_MODELS.sonnet;
    const lenses = data.lenses || [];
    // Build prompt
    const prompt = (0, prompts_1.buildV6Prompt)(text, data.metadata, lenses);
    // Call Anthropic API
    const client = new sdk_1.default({ apiKey: data.apiKey });
    try {
        const message = await client.messages.create({
            model,
            max_tokens: 16000,
            messages: [{ role: 'user', content: prompt }],
        });
        const responseText = message.content[0].type === 'text'
            ? message.content[0].text
            : '';
        // Parse JSON from response
        let analysis;
        try {
            analysis = JSON.parse(responseText);
        }
        catch {
            // Try to extract JSON from response with extra text
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = JSON.parse(jsonMatch[0]);
            }
            else {
                throw new https_1.HttpsError('internal', 'Failed to parse analysis JSON from Claude response');
            }
        }
        // Wrap in standard V6 output structure
        return {
            source_file: data.metadata.title.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf',
            analysis_model: `claude-${modelKey}`,
            analysis_version: 'v6_unified',
            lenses_enabled: lenses,
            metadata: {
                filename: data.metadata.title + '.pdf',
                page_count: data.metadata.pageCount,
                word_count: data.metadata.wordCount,
            },
            analysis,
            usage: {
                input_tokens: message.usage.input_tokens,
                output_tokens: message.usage.output_tokens,
            },
        };
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        const err = error;
        if (err.status === 401) {
            throw new https_1.HttpsError('unauthenticated', 'Invalid Anthropic API key');
        }
        if (err.status === 429) {
            throw new https_1.HttpsError('resource-exhausted', 'Anthropic rate limit exceeded. Please wait and try again.');
        }
        throw new https_1.HttpsError('internal', `Analysis failed: ${err.message || 'Unknown error'}`);
    }
});
//# sourceMappingURL=analyzeScreenplay.js.map