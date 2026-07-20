import { GoogleGenAI, Modality } from "@google/genai";
import cors from "cors";
import { defineString } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { authenticateProxyRequest } from "./proxyAuth";

const googleApiKey = defineString("GOOGLE_API_KEY");
const proxyServiceKey = defineString("PROXY_SERVICE_KEY");

const POSTER_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image",
  "gemini-3-pro-image",
] as const;
const LIVE_MODEL = "gemini-3.1-flash-live-preview";

const corsMiddleware = cors({
  origin: [
    "https://lemon-screenplay-dashboard.web.app",
    "https://lemon-screenplay-dashboard.firebaseapp.com",
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
  ],
});

type GoogleAction =
  | { action: "generate-poster"; prompt: string }
  | { action: "live-token" };

export const googleProxy = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "512MiB",
    maxInstances: 10,
  },
  (req, res) => {
    corsMiddleware(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const authResult = await authenticateProxyRequest(req, proxyServiceKey.value());
      if (!authResult.ok) {
        res.status(authResult.status).json({ error: authResult.message, code: "UNAUTHORIZED" });
        return;
      }
      if (authResult.kind !== "user"
          || !authResult.emailVerified
          || !authResult.email.endsWith("@lemonfilms.com")) {
        res.status(403).json({ error: "A verified Lemon Studios account is required." });
        return;
      }

      const body = req.body as GoogleAction;
      const ai = new GoogleGenAI({ apiKey: googleApiKey.value() });

      try {
        if (body.action === "live-token") {
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
              httpOptions: { apiVersion: "v1alpha" },
            },
          });
          res.status(200).json({ token: token.name, model: LIVE_MODEL });
          return;
        }

        if (body.action === "generate-poster") {
          if (typeof body.prompt !== "string" || body.prompt.length < 10 || body.prompt.length > 8_000) {
            res.status(400).json({ error: "Poster prompt must be between 10 and 8,000 characters." });
            return;
          }
          if (authResult.email !== "billy@lemonfilms.com") {
            res.status(403).json({ error: "Admin access is required for poster generation." });
            return;
          }

          let lastError: unknown = new Error("No poster model returned an image.");
          for (const model of POSTER_MODELS) {
            try {
              const response = await ai.models.generateContent({
                model,
                contents: body.prompt,
                config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
              });
              const parts = response.candidates?.[0]?.content?.parts ?? [];
              const image = parts.find((part) => part.inlineData?.mimeType?.startsWith("image/")
                && part.inlineData.data);
              if (image?.inlineData?.data) {
                res.status(200).json({
                  data: image.inlineData.data,
                  mimeType: image.inlineData.mimeType ?? "image/png",
                  model,
                });
                return;
              }
            } catch (error) {
              lastError = error;
            }
          }
          throw lastError;
        }

        res.status(400).json({ error: "Unknown Google AI action." });
      } catch (error) {
        console.error("[googleProxy] Error:", error);
        res.status(502).json({ error: "Google AI request failed.", code: "GOOGLE_AI_ERROR" });
      }
    });
  },
);
