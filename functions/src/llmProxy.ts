/**
 * LLM Proxy Cloud Function
 *
 * Receives model + messages from the browser, calls Anthropic directly.
 * API key lives in functions/.env — never exposed to the browser.
 */

import { onRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";
import cors from "cors";

const anthropicApiKey = defineString("ANTHROPIC_API_KEY");

const corsMiddleware = cors({
  origin: [
    "https://lemon-screenplay-dashboard.web.app",
    "https://lemon-screenplay-dashboard.firebaseapp.com",
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
  ],
});

interface ProxyRequestBody {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
}

export const llmProxy = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "256MiB",
    maxInstances: 50,
  },
  (req, res) => {
    corsMiddleware(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const body = req.body as ProxyRequestBody;

      if (!body.model || !body.messages || !Array.isArray(body.messages)) {
        res.status(400).json({ error: "Missing required fields: model, messages", code: "INVALID_INPUT" });
        return;
      }

      try {
        const client = new Anthropic({ apiKey: anthropicApiKey.value() });

        // Split system messages out — Anthropic keeps them separate
        const systemParts = body.messages.filter(m => m.role === "system").map(m => m.content);
        const userMessages = body.messages.filter(m => m.role !== "system") as Array<{ role: "user" | "assistant"; content: string }>;

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
      } catch (error: any) {
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
  }
);
