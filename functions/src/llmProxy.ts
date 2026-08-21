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

import { onRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import cors from "cors";
import { authenticateProxyRequest } from "./proxyAuth";
import { buildTrustCapability } from "./llmProxyCapability";
import {
  createAnthropicClient,
  finalMessageWithUncertainSpendProtection,
  isDefiniteAnthropicRequestRejection,
} from "./anthropicClient";
import {
  DailyBudgetExceededError,
  releaseLlmBudget,
  reserveLlmBudget,
  settleLlmBudget,
  settleUncertainLlmBudget,
  type LlmBudgetReservation,
} from "./budgetCounter";
import {
  DEFAULT_DAILY_LLM_BUDGET_USD,
  parseDailyBudgetUsd,
  usdToMicrousd,
  type LlmTokenUsage,
} from "./llmCost";
import {
  postCallAccountingUncertainResponse,
  preCallAccountingUnavailableResponse,
  upstreamInvalidRequestResponse,
} from "./llmProxyErrors";
import {
  approvedMaxOutputTokens,
  isApprovedProxyModel,
  validateModelRequest,
  type ApprovedEffort,
} from "./llmProxyPolicy";

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const dailyLlmBudgetUsd = defineString("DAILY_LLM_BUDGET_USD", {
  default: String(DEFAULT_DAILY_LLM_BUDGET_USD),
});
// Shared secret for the VPS daemon (server-side, no user session). Empty in
// local dev disables service-key auth; browser ID-token auth still applies.
const proxyServiceKey = defineSecret("PROXY_SERVICE_KEY");
const MAX_OUTPUT_TOKENS = 24_000;
const MAX_THINKING_TOKENS = 16_000;

const corsMiddleware = cors({
  origin: [
    "https://lemon-screenplay-dashboard.web.app",
    "https://lemon-screenplay-dashboard.firebaseapp.com",
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
  ],
});

// ─── Types ───────────────────────────────────────────────────────────────────

type ContentBlock =
  | { type: "text"; text: string; cache_control?: CacheControl }
  | {
      type: "image";
      source: { type: "base64"; media_type: string; data: string };
      cache_control?: CacheControl;
    }
  | {
      type: "document";
      source:
        | { type: "base64"; media_type: "application/pdf"; data: string }
        | { type: "url"; url: string };
      cache_control?: CacheControl;
      citations?: { enabled: boolean };
    }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string | ContentBlock[];
      is_error?: boolean;
    };

interface InboundMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentBlock[];
}

interface CacheControl {
  type: "ephemeral";
  ttl?: "5m" | "1h";
}

interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface ProxyRequestBody {
  model: string;
  messages: InboundMessage[];
  /** VPS-only queue identity used for exact per-job cost telemetry. */
  job_id?: string;
  // System can be a string OR an array of cacheable text blocks
  system?: string | Array<{ type: "text"; text: string; cache_control?: CacheControl }>;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_tokens?: number;
  // tool_use forced output
  tools?: ToolDefinition[];
  tool_choice?:
    | { type: "auto" }
    | { type: "any" }
    | { type: "tool"; name: string };
  // Extended thinking (Sonnet 4.6 / Opus 4.7)
  thinking?:
    | { type: "enabled"; budget_tokens: number }
    | { type: "adaptive" };
  output_config?: {
    effort?: ApprovedEffort;
  };
}

const EXTENDED_CACHE_TTL_BETA = "extended-cache-ttl-2025-04-11";

function usesOneHourCache(body: ProxyRequestBody): boolean {
  const systemUsesOneHourCache = Array.isArray(body.system)
    && body.system.some((block) => block.cache_control?.ttl === "1h");
  if (systemUsesOneHourCache) return true;

  return body.messages.some((message) => (
    Array.isArray(message.content)
    && message.content.some((block) => (
      "cache_control" in block && block.cache_control?.ttl === "1h"
    ))
  ));
}

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
function extractSystem(
  body: ProxyRequestBody
):
  | undefined
  | string
  | Array<{ type: "text"; text: string; cache_control?: CacheControl }> {
  // Preferred: explicit top-level system field
  if (body.system !== undefined) return body.system;

  // Legacy: system-role messages embedded in messages[]
  const systemMessages = body.messages.filter((m) => m.role === "system");
  if (systemMessages.length === 0) return undefined;

  // If any system message has block content with cache_control, build a block array.
  const hasBlocks = systemMessages.some(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some(
        (b) => b.type === "text" && (b as { cache_control?: unknown }).cache_control
      )
  );

  if (hasBlocks) {
    const blocks: Array<{ type: "text"; text: string; cache_control?: CacheControl }> = [];
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
      } else {
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
function userAssistantMessages(body: ProxyRequestBody) {
  return body.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content })) as Array<{
    role: "user" | "assistant";
    content: string | ContentBlock[];
  }>;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const llmProxy = onRequest(
  {
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
  },
  (req, res) => {
    corsMiddleware(req, res, async () => {
      if (req.method !== "GET" && req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // ── Authenticate the caller before spending the Anthropic key ──
      const authResult = await authenticateProxyRequest(req, proxyServiceKey.value());
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
        res.status(200).json(buildTrustCapability());
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

      const body = req.body as ProxyRequestBody;

      if (!body.model || !body.messages || !Array.isArray(body.messages)) {
        res.status(400).json({
          error: "Missing required fields: model, messages",
          code: "INVALID_INPUT",
        });
        return;
      }
      if (!isApprovedProxyModel(body.model, authResult.kind)) {
        res.status(400).json({ error: "Model is not approved.", code: "INVALID_MODEL" });
        return;
      }
      const modelOutputLimit = approvedMaxOutputTokens(body.model, MAX_OUTPUT_TOKENS);
      const maxTokens = body.max_tokens ?? 8_096;
      if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > modelOutputLimit) {
        res.status(400).json({
          error: `max_tokens must be an integer between 1 and ${modelOutputLimit}.`,
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
      }
      let outputConfig: { effort: ApprovedEffort } | undefined;
      try {
        outputConfig = validateModelRequest(body.model, authResult.kind, {
          thinking: body.thinking,
          temperature: body.temperature,
          top_p: body.top_p,
          top_k: body.top_k,
          tool_choice: body.tool_choice,
          output_config: body.output_config,
        });
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : "Invalid output_config.",
          code: "INVALID_INPUT",
        });
        return;
      }

      let jobId: string | undefined;
      if (authResult.kind === "service" && body.job_id !== undefined) {
        if (
          typeof body.job_id !== "string"
          || body.job_id.length < 1
          || body.job_id.length > 1_500
          || body.job_id.includes("/")
        ) {
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
      const payload: Record<string, unknown> = {
        model: body.model,
        max_tokens: maxTokens,
        messages,
      };
      if (system !== undefined) payload.system = system;
      if (typeof body.temperature === "number") payload.temperature = body.temperature;
      if (typeof body.top_p === "number") payload.top_p = body.top_p;
      if (typeof body.top_k === "number") payload.top_k = body.top_k;
      if (body.tools && body.tools.length > 0) payload.tools = body.tools;
      if (body.tool_choice) payload.tool_choice = body.tool_choice;
      if (body.thinking) payload.thinking = body.thinking;
      if (outputConfig) payload.output_config = outputConfig;

      const client = createAnthropicClient(anthropicApiKey.value());
      let reservation: LlmBudgetReservation;
      try {
        const limitUsd = parseDailyBudgetUsd(dailyLlmBudgetUsd.value());
        reservation = await reserveLlmBudget({
          model: body.model,
          requestBytes: Buffer.byteLength(JSON.stringify(payload), "utf8"),
          maxOutputTokens: maxTokens,
          limitMicrousd: usdToMicrousd(limitUsd),
          jobId,
        });
      } catch (error) {
        if (error instanceof DailyBudgetExceededError) {
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
        res.status(503).json(preCallAccountingUnavailableResponse());
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let message: any;
      try {
        // Use streaming under the hood and collect into a final Message.
        // Anthropic's SDK refuses non-streaming calls it estimates may exceed
        // 10 minutes (which heavy thinking + tool_use synthesis trips). The
        // streaming path has no such restriction, and the SDK's
        // `.finalMessage()` returns the same Message shape we'd get from
        // .create() — so the rest of the handler is unchanged.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message = await finalMessageWithUncertainSpendProtection(
          async () => {
            const requestOptions = usesOneHourCache(body)
              ? {
                  headers: {
                    "anthropic-beta": EXTENDED_CACHE_TTL_BETA,
                  },
                }
              : undefined;
            const stream = client.messages.stream(
              payload as Parameters<typeof client.messages.stream>[0],
              requestOptions,
            );
            return stream.finalMessage();
          },
          async (reason) => {
            await settleUncertainLlmBudget(reservation, reason);
          },
          async (reason) => {
            await releaseLlmBudget(reservation, reason);
          },
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.error("[llmProxy] Error:", error);
        if (isDefiniteAnthropicRequestRejection(error)) {
          res.status(400).json(upstreamInvalidRequestResponse());
          return;
        }
        res.status(503).json(postCallAccountingUncertainResponse());
        return;
      }

      try {
        // Extract the first text block (back-compat).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textBlock = message.content.find((b: any) => b.type === "text");
        const text = textBlock?.text ?? "";

        // Extract tool_use blocks (new path) — the daemon and frontend can
        // read this directly to get schema-guaranteed JSON without parsing.
        const toolUses = message.content
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((b: any) => b.type === "tool_use")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((b: any) => ({ id: b.id, name: b.name, input: b.input }));

        // Pull thinking blocks too (informational; useful for debugging).
        const thinking = message.content
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((b: any) => b.type === "thinking")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((b: any) => b.thinking ?? "")
          .join("\n");

        // Full usage breakdown (cache hits, thinking, output tokens).
        const usageWithCache = message.usage as typeof message.usage & {
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
          cache_creation?: {
            ephemeral_5m_input_tokens?: number;
            ephemeral_1h_input_tokens?: number;
          };
        };
        const usage: LlmTokenUsage = {
          input_tokens: message.usage.input_tokens ?? 0,
          output_tokens: message.usage.output_tokens ?? 0,
          cache_creation_input_tokens: usageWithCache.cache_creation_input_tokens ?? 0,
          cache_read_input_tokens: usageWithCache.cache_read_input_tokens ?? 0,
          ...(usageWithCache.cache_creation
            ? {
                cache_creation: {
                  ephemeral_5m_input_tokens:
                    usageWithCache.cache_creation.ephemeral_5m_input_tokens ?? 0,
                  ephemeral_1h_input_tokens:
                    usageWithCache.cache_creation.ephemeral_1h_input_tokens ?? 0,
                },
              }
            : {}),
        };

        const returnedModel = typeof message.model === "string" ? message.model : "";
        const settlement = await settleLlmBudget(reservation, usage, returnedModel);

        if (returnedModel !== body.model) {
          res.status(502).json({
            error: "Anthropic returned a different model than the exact model requested.",
            code: "MODEL_PROVENANCE_MISMATCH",
            isRetryable: false,
            manualReviewRequired: true,
            requested_model: body.model,
            returned_model: returnedModel,
            response_id: message.id,
            stop_reason: message.stop_reason,
            usage: {
              ...usage,
              call_count: 1,
              actual_cost_microusd: settlement.actual_cost_microusd,
              actual_cost_usd: settlement.actual_cost_usd,
            },
          });
          return;
        }

        res.status(200).json({
          text,
          tool_uses: toolUses,
          thinking,
          content: message.content, // full block array for advanced callers
          response_id: message.id,
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
      } catch (error: any) {
        // The Anthropic call happened, so leave the reservation in place. It
        // must never be released as though no money was spent.
        console.error("[llmProxy] Budget settlement failed:", error);
        res.status(503).json(postCallAccountingUncertainResponse());
      }
    });
  }
);
