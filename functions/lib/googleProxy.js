"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleProxy = void 0;
const node_crypto_1 = require("node:crypto");
const genai_1 = require("@google/genai");
const cors_1 = __importDefault(require("cors"));
const params_1 = require("firebase-functions/params");
const https_1 = require("firebase-functions/v2/https");
const proxyAuth_1 = require("./proxyAuth");
const posterCore_1 = require("./posterCore");
const posterService_1 = require("./posterService");
const googleApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
const proxyServiceKey = (0, params_1.defineSecret)('PROXY_SERVICE_KEY');
const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
const corsMiddleware = (0, cors_1.default)({
    origin: [
        'https://lemon-screenplay-dashboard.web.app',
        'https://lemon-screenplay-dashboard.firebaseapp.com',
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
    ],
});
exports.googleProxy = (0, https_1.onRequest)({
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '512MiB',
    maxInstances: 10,
    secrets: [googleApiKey, proxyServiceKey],
}, (req, res) => {
    corsMiddleware(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        const authResult = await (0, proxyAuth_1.authenticateProxyRequest)(req, proxyServiceKey.value());
        if (!authResult.ok) {
            res.status(authResult.status).json({ error: authResult.message, code: 'UNAUTHORIZED' });
            return;
        }
        if (authResult.kind !== 'user' ||
            !authResult.emailVerified ||
            !authResult.email.endsWith('@lemonfilms.com')) {
            res.status(403).json({ error: 'A verified Lemon Studios account is required.' });
            return;
        }
        const body = req.body;
        try {
            if (body.action === 'live-token') {
                const ai = new genai_1.GoogleGenAI({ apiKey: googleApiKey.value() });
                const now = Date.now();
                const token = await ai.authTokens.create({
                    config: {
                        uses: 1,
                        newSessionExpireTime: new Date(now + 60_000).toISOString(),
                        expireTime: new Date(now + 30 * 60_000).toISOString(),
                        liveConnectConstraints: {
                            model: LIVE_MODEL,
                            config: { responseModalities: [genai_1.Modality.AUDIO] },
                        },
                        lockAdditionalFields: [],
                        httpOptions: { apiVersion: 'v1alpha' },
                    },
                });
                res.status(200).json({ token: token.name, model: LIVE_MODEL });
                return;
            }
            if (body.action === 'generate-poster') {
                if (!(0, posterCore_1.isPosterAdmin)(authResult.email)) {
                    res.status(403).json({ error: 'Admin access is required for poster generation.' });
                    return;
                }
                const model = (0, posterCore_1.normalizePosterModel)(body.model);
                if (typeof body.screenplayId !== 'string' || !body.screenplayId || !model) {
                    res.status(400).json({ error: 'A screenplay and approved poster model are required.' });
                    return;
                }
                const result = await (0, posterService_1.generatePosterForProject)({
                    apiKey: googleApiKey.value(),
                    projectId: body.screenplayId,
                    requestId: `manual-${(0, node_crypto_1.randomUUID)()}`,
                    sourceId: authResult.uid,
                    model,
                });
                res.status(200).json(result);
                return;
            }
            res.status(400).json({ error: 'Unknown Google AI action.' });
        }
        catch (error) {
            console.error('[googleProxy] Error:', error);
            res.status(502).json({ error: 'Google AI request failed.', code: 'GOOGLE_AI_ERROR' });
        }
    });
});
//# sourceMappingURL=googleProxy.js.map