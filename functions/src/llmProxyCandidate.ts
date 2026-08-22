import { Buffer } from "node:buffer";
import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { defineSecret, defineString, projectID } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import {
  createAnthropicClient,
  finalMessageWithUncertainSpendProtection,
  isDefiniteAnthropicRequestRejection,
} from "./anthropicClient";
import {
  buildAnthropicRequest,
  parseAnthropicMessage,
  ProxyRequestValidationError,
  sha256CanonicalJson,
  type BuiltAnthropicRequest,
} from "./anthropicProxyCore";
import {
  BenchmarkCapExceededError,
  BenchmarkCallConflictError,
  BenchmarkDuplicateCallError,
  markBenchmarkCallUncertain,
  rejectBenchmarkCallBeforeGeneration,
  reserveBenchmarkCall,
  settleBenchmarkCall,
  type BenchmarkReservation,
} from "./benchmarkLedger";
import {
  BENCHMARK_DATABASE_ID,
  BENCHMARK_MODELS,
  validateBenchmarkContract,
  validateCandidateEnvelope,
  type BenchmarkCallContract,
} from "./benchmarkCandidatePolicy";
import { candidateLog } from "./candidateLog";
import {
  BENCHMARK_RUNTIME_OPTIONS,
  benchmarkIsolationResources,
  buildBenchmarkReleaseIdentity,
} from "./benchmarkRelease";
import { calculateReservationMicrousd, usdToMicrousd } from "./llmCost";

if (!getApps().length) initializeApp();

const benchmarkAnthropicApiKey = defineSecret("BENCHMARK_ANTHROPIC_API_KEY");
const benchmarkRunId = defineString("BENCHMARK_RUN_ID");
const benchmarkCapUsd = defineString("BENCHMARK_CAP_USD");
const benchmarkGitSha = defineString("BENCHMARK_GIT_SHA");
const benchmarkSourceClean = defineString("BENCHMARK_SOURCE_CLEAN");
const benchmarkCatalogSha256 = defineString("BENCHMARK_CATALOG_SHA256");
const benchmarkBuildTimestamp = defineString("BENCHMARK_BUILD_TIMESTAMP");
const benchmarkRuntimeServiceAccount = defineString("BENCHMARK_RUNTIME_SERVICE_ACCOUNT");
const benchmarkStagingFirestoreProjectId = defineString(
  "BENCHMARK_STAGING_FIRESTORE_PROJECT_ID",
);
const benchmarkProductionFirestoreProjectId = defineString(
  "BENCHMARK_PRODUCTION_FIRESTORE_PROJECT_ID",
);
const benchmarkStorageBucket = defineString("BENCHMARK_STORAGE_BUCKET");

const MAX_OUTPUT_TOKENS = 24_000;
const MAX_THINKING_TOKENS = 16_000;

function runtimeConfig() {
  const capUsd = Number(benchmarkCapUsd.value());
  if (!Number.isFinite(capUsd) || capUsd <= 0 || capUsd > 1_000) {
    throw new Error("BENCHMARK_CAP_USD must be between 0 and 1000.");
  }
  const capMicrousd = usdToMicrousd(capUsd);
  const runId = benchmarkRunId.value();
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(runId)) throw new Error("BENCHMARK_RUN_ID is invalid.");
  const stagingFirestoreProjectId = benchmarkStagingFirestoreProjectId.value();
  const runtimeProjectId = projectID.value();
  const productionFirestoreProjectId = benchmarkProductionFirestoreProjectId.value();
  const productionStorageBucket = benchmarkStorageBucket.value();
  const isolationResources = benchmarkIsolationResources(
    stagingFirestoreProjectId,
    productionFirestoreProjectId,
    productionStorageBucket,
  );
  const release = buildBenchmarkReleaseIdentity({
    gitSha: benchmarkGitSha.value(),
    sourceClean: benchmarkSourceClean.value(),
    catalogSha256: benchmarkCatalogSha256.value(),
    buildTimestamp: benchmarkBuildTimestamp.value(),
    runId,
    capMicrousd,
    runtimeServiceAccount: benchmarkRuntimeServiceAccount.value(),
    runtimeProjectId,
    stagingFirestoreProjectId,
    productionFirestoreProjectId,
    productionStorageBucket,
  });
  return {
    runId,
    capUsd,
    capMicrousd,
    release,
    isolationResources,
    runtimeProjectId,
    stagingFirestoreProjectId,
    productionFirestoreProjectId,
    productionStorageBucket,
  };
}

function permissionCode(error: unknown): unknown {
  return error && typeof error === "object" ? (error as { code?: unknown }).code : undefined;
}

export function isPermissionDenied(error: unknown): boolean {
  const code = permissionCode(error);
  return code === 7 || code === 403 || code === "permission-denied";
}

async function deniedProbe(operation: () => Promise<unknown>): Promise<"denied" | "allowed" | "error"> {
  try {
    await operation();
    return "allowed";
  } catch (error) {
    return isPermissionDenied(error) ? "denied" : "error";
  }
}

export function isolationApp(projectId: string): App {
  const name = `benchmark-isolation-${projectId}`;
  return getApps().find((app) => app.name === name)
    ?? initializeApp({ projectId }, name);
}

async function isolationPreflight(config: ReturnType<typeof runtimeConfig>) {
  const benchmarkDb = getFirestore(BENCHMARK_DATABASE_ID);
  const namedDatabase = await deniedProbe(
    () => benchmarkDb.collection("model_benchmark_runs").doc(config.runId).get(),
  );
  const stagingDefaultDatabase = await deniedProbe(
    () => getFirestore(isolationApp(config.stagingFirestoreProjectId))
      .collection("_benchmark_isolation_probe_").doc("staging-default").get(),
  );
  const productionDefaultDatabase = await deniedProbe(
    () => getFirestore(isolationApp(config.productionFirestoreProjectId))
      .collection("_benchmark_isolation_probe_").doc("production-default").get(),
  );
  const productionStorage = await deniedProbe(
    () => getStorage().bucket(config.productionStorageBucket)
      .file("_benchmark_isolation_probe_/production-storage").exists(),
  );
  return {
    named_database: namedDatabase,
    staging_default_database: stagingDefaultDatabase,
    production_default_database: productionDefaultDatabase,
    production_storage: productionStorage,
    targets: config.isolationResources,
  };
}

export const llmProxyCandidate = onRequest(
  {
    region: BENCHMARK_RUNTIME_OPTIONS.region,
    timeoutSeconds: BENCHMARK_RUNTIME_OPTIONS.timeoutSeconds,
    memory: BENCHMARK_RUNTIME_OPTIONS.memory,
    maxInstances: BENCHMARK_RUNTIME_OPTIONS.maxInstances,
    concurrency: BENCHMARK_RUNTIME_OPTIONS.concurrency,
    invoker: BENCHMARK_RUNTIME_OPTIONS.invoker,
    serviceAccount: benchmarkRuntimeServiceAccount,
    secrets: [benchmarkAnthropicApiKey],
  },
  async (req, res) => {
    let config: ReturnType<typeof runtimeConfig>;
    try {
      config = runtimeConfig();
    } catch {
      candidateLog({ event: "configuration_rejected", status_code: 503 });
      res.status(503).json({ error: "Candidate configuration is invalid.", code: "INVALID_CONFIG" });
      return;
    }

    if (req.method === "GET") {
      let isolation: Awaited<ReturnType<typeof isolationPreflight>> | undefined;
      try {
        isolation = req.query.isolation === "1"
          ? await isolationPreflight(config)
          : undefined;
      } catch {
        candidateLog({
          event: "isolation_preflight_failed",
          run_id: config.runId,
          status_code: 503,
          release: config.release,
        });
        res.status(503).json({
          error: "Candidate isolation could not be verified.",
          code: "ISOLATION_PREFLIGHT_FAILED",
        });
        return;
      }
      res.set("Cache-Control", "no-store");
      res.status(200).json({
        service: "llmProxyCandidate",
        run_id: config.runId,
        cap_usd: config.capUsd,
        database_id: BENCHMARK_DATABASE_ID,
        runtime_project_id: config.runtimeProjectId,
        allowed_models: BENCHMARK_MODELS,
        release: config.release,
        ...(isolation ? { isolation } : {}),
      });
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed.", code: "METHOD_NOT_ALLOWED" });
      return;
    }

    let built: BuiltAnthropicRequest;
    let contract: BenchmarkCallContract;
    try {
      validateCandidateEnvelope(req.body);
      built = buildAnthropicRequest(
        req.body,
        "service",
        MAX_OUTPUT_TOKENS,
        MAX_THINKING_TOKENS,
      );
      const body = req.body as Record<string, unknown>;
      const requestSha256 = sha256CanonicalJson(built.payload);
      contract = validateBenchmarkContract(
        body.benchmark,
        requestSha256,
        config.runId,
        built.body.model,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid benchmark request.";
      const code = error instanceof ProxyRequestValidationError ? error.code : "INVALID_BENCHMARK";
      res.status(400).json({ error: message, code, isRetryable: false });
      return;
    }

    const db = getFirestore(BENCHMARK_DATABASE_ID);
    const immutableRun = {
      runId: config.runId,
      limitMicrousd: config.capMicrousd,
      release: config.release,
    };
    const reservedMicrousd = calculateReservationMicrousd(
      built.body.model,
      Buffer.byteLength(JSON.stringify(built.payload), "utf8"),
      built.maxTokens,
    );
    let reservation: BenchmarkReservation;
    try {
      reservation = await reserveBenchmarkCall(
        db,
        immutableRun,
        contract,
        reservedMicrousd,
      );
    } catch (error) {
      if (error instanceof BenchmarkCapExceededError) {
        res.status(429).json({ error: error.message, code: error.code, isRetryable: false });
        return;
      }
      if (error instanceof BenchmarkDuplicateCallError
          || error instanceof BenchmarkCallConflictError) {
        res.status(409).json({
          error: error.message,
          code: error.code,
          isRetryable: false,
          manualReviewRequired: true,
        });
        return;
      }
      candidateLog({
        event: "reservation_failed",
        run_id: config.runId,
        call_id: contract.call_id,
        model: built.body.model,
        status_code: 503,
        release: config.release,
      });
      res.status(503).json({
        error: "Benchmark accounting is unavailable before dispatch.",
        code: "PRE_CALL_ACCOUNTING_UNAVAILABLE",
        isRetryable: false,
      });
      return;
    }

    const client = createAnthropicClient(benchmarkAnthropicApiKey.value());
    let message: unknown;
    try {
      message = await finalMessageWithUncertainSpendProtection(
        async () => {
          const stream = client.messages.stream(
            built.payload as Parameters<typeof client.messages.stream>[0],
            built.requestOptions,
          );
          return stream.finalMessage();
        },
        async () => {
          await markBenchmarkCallUncertain(db, immutableRun, reservation, "provider_error");
        },
        async () => {
          await rejectBenchmarkCallBeforeGeneration(db, immutableRun, reservation);
        },
      );
    } catch (error) {
      const rejected = isDefiniteAnthropicRequestRejection(error);
      candidateLog({
        event: rejected ? "provider_rejected" : "provider_uncertain",
        run_id: config.runId,
        call_id: contract.call_id,
        model: built.body.model,
        status_code: rejected ? 400 : 503,
        release: config.release,
      });
      res.status(rejected ? 400 : 503).json({
        error: rejected
          ? "Anthropic rejected the request before generation."
          : "The provider result is uncertain and the reservation remains held against the cap.",
        code: rejected ? "UPSTREAM_INVALID_REQUEST" : "BENCHMARK_SPEND_UNCERTAIN",
        isRetryable: false,
        manualReviewRequired: !rejected,
      });
      return;
    }

    try {
      const parsed = parseAnthropicMessage(message);
      const settlement = await settleBenchmarkCall(
        db,
        immutableRun,
        reservation,
        parsed.usage,
        parsed.model,
        parsed.responseId,
        parsed.stopReason,
      );
      const usage = {
        ...parsed.usage,
        call_count: 1,
        actual_cost_microusd: settlement.actual_cost_microusd,
        actual_cost_usd: settlement.actual_cost_usd,
      };
      candidateLog({
        event: "settled",
        run_id: config.runId,
        call_id: contract.call_id,
        model: parsed.model,
        status_code: parsed.model === built.body.model ? 200 : 502,
        response_id: parsed.responseId,
        usage,
        cost_microusd: settlement.actual_cost_microusd,
        release: config.release,
      });
      if (parsed.model !== built.body.model) {
        res.status(502).json({
          error: "Anthropic returned a different model than requested.",
          code: "MODEL_PROVENANCE_MISMATCH",
          isRetryable: false,
          manualReviewRequired: true,
          requested_model: built.body.model,
          returned_model: parsed.model,
          response_id: parsed.responseId,
          stop_reason: parsed.stopReason,
          usage,
          release: config.release,
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
        usage,
        release: config.release,
      });
    } catch {
      try {
        await markBenchmarkCallUncertain(db, immutableRun, reservation, "settlement_error");
      } catch {
        // The permanent in-progress reservation still protects the cap.
      }
      candidateLog({
        event: "settlement_uncertain",
        run_id: config.runId,
        call_id: contract.call_id,
        model: built.body.model,
        status_code: 503,
        release: config.release,
      });
      res.status(503).json({
        error: "The response could not be settled safely.",
        code: "BENCHMARK_SPEND_UNCERTAIN",
        isRetryable: false,
        manualReviewRequired: true,
      });
    }
  },
);
