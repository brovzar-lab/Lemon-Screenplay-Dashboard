import { randomUUID } from 'node:crypto';
import { GoogleGenAI, Modality } from '@google/genai';
import cors from 'cors';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { authenticateProxyRequest } from './proxyAuth';
import { isPosterAdmin, normalizePosterModel } from './posterCore';
import { generatePosterForProject } from './posterService';

const googleApiKey = defineSecret('GEMINI_API_KEY');
const proxyServiceKey = defineSecret('PROXY_SERVICE_KEY');

const LIVE_MODEL = 'gemini-3.1-flash-live-preview';

const corsMiddleware = cors({
  origin: [
    'https://lemon-screenplay-dashboard.web.app',
    'https://lemon-screenplay-dashboard.firebaseapp.com',
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
  ],
});

type GoogleAction =
  | { action: 'generate-poster'; screenplayId: string; model: string }
  | { action: 'live-token' };

export const googleProxy = onRequest(
  {
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '512MiB',
    maxInstances: 10,
    secrets: [googleApiKey, proxyServiceKey],
  },
  (req, res) => {
    corsMiddleware(req, res, async () => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      const authResult = await authenticateProxyRequest(req, proxyServiceKey.value());
      if (!authResult.ok) {
        res.status(authResult.status).json({ error: authResult.message, code: 'UNAUTHORIZED' });
        return;
      }
      if (
        authResult.kind !== 'user' ||
        !authResult.emailVerified ||
        !authResult.email.endsWith('@lemonfilms.com')
      ) {
        res.status(403).json({ error: 'A verified Lemon Studios account is required.' });
        return;
      }

      const body = req.body as GoogleAction;

      try {
        if (body.action === 'live-token') {
          const ai = new GoogleGenAI({ apiKey: googleApiKey.value() });
          const now = Date.now();
          const token = await ai.authTokens.create({
            config: {
              uses: 1,
              newSessionExpireTime: new Date(now + 60_000).toISOString(),
              expireTime: new Date(now + 30 * 60_000).toISOString(),
              liveConnectConstraints: {
                model: LIVE_MODEL,
                config: { responseModalities: [Modality.AUDIO] },
              },
              lockAdditionalFields: [],
              httpOptions: { apiVersion: 'v1alpha' },
            },
          });
          res.status(200).json({ token: token.name, model: LIVE_MODEL });
          return;
        }

        if (body.action === 'generate-poster') {
          if (!isPosterAdmin(authResult.email)) {
            res.status(403).json({ error: 'Admin access is required for poster generation.' });
            return;
          }
          const model = normalizePosterModel(body.model);
          if (typeof body.screenplayId !== 'string' || !body.screenplayId || !model) {
            res.status(400).json({ error: 'A screenplay and approved poster model are required.' });
            return;
          }
          const result = await generatePosterForProject({
            apiKey: googleApiKey.value(),
            projectId: body.screenplayId,
            requestId: `manual-${randomUUID()}`,
            sourceId: authResult.uid,
            model,
          });
          res.status(200).json(result);
          return;
        }

        res.status(400).json({ error: 'Unknown Google AI action.' });
      } catch (error) {
        console.error('[googleProxy] Error:', error);
        res.status(502).json({ error: 'Google AI request failed.', code: 'GOOGLE_AI_ERROR' });
      }
    });
  },
);
