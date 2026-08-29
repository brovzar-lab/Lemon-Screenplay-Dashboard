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
  extractAnthropicResponseEvidence,
  parseAnthropicMessage,
  ProxyRequestValidationError,
  sha256CanonicalJson,
  type BuiltAnthropicRequest,
} from "./anthropicProxyCore";
import {
  BenchmarkCapExceededError,
  BenchmarkCallConflictError,
  BenchmarkDuplicateCallError,
  KNOWN_PILOT_RUN_ID,
  hasExactKnownPilotEvidence,
  markBenchmarkCallUncertain,
  rejectBenchmarkCallBeforeGeneration,
  reserveBenchmarkCall,
  settleBenchmarkCall,
  type BenchmarkFailureEvidence,
  type BenchmarkReservation,
  type BenchmarkSettlement,
  type BenchmarkUncertainEvidence,
} from "./benchmarkLedger";
import {
  BENCHMARK_DATABASE_ID,
  BENCHMARK_MODELS,
  BENCHMARK_AUDIT_ID,
  BENCHMARK_AUDIT_LIMIT_MICROUSD,
  assertBenchmarkAuditBudget,
  parseBenchmarkCapUsd,
  deriveBenchmarkPayloadEvidence,
  isOpaqueBenchmarkRunId,
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
import {
  calculateHighestAllowedReservationMicrousd,
  llmPricingSha256,
  PRICED_MODELS,
  usdToMicrousd,
} from "./llmCost";

if (!getApps().length) initializeApp();

const benchmarkAnthropicApiKey = defineSecret("BENCHMARK_ANTHROPIC_API_KEY");
const benchmarkRunId = defineString("BENCHMARK_RUN_ID");
const benchmarkCapUsd = defineString("BENCHMARK_CAP_USD");
const benchmarkPriorAuditSpendUsd = defineString("BENCHMARK_PRIOR_AUDIT_SPEND_USD");
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
const benchmarkInferenceGeo = defineString("BENCHMARK_INFERENCE_GEO");

const MAX_OUTPUT_TOKENS = 24_000;
const MAX_THINKING_TOKENS = 16_000;

export function candidateSettlementFailure(
  error: unknown,
  phase: "response_validation" | "settlement",
): BenchmarkFailureEvidence {
  const message = error instanceof Error ? error.message : "";
  let evidence: BenchmarkFailureEvidence;
  if (phase === "response_validation") {
    if (message.includes("cache_creation_input_tokens")
        || message.includes("cache_read_input_tokens")) {
      evidence = {
        validation_failure_code: "PROVIDER_CACHE_TOTALS_MISSING",
        validation_failure_reason: "Cached provider response omitted required aggregate cache usage.",
      };
    } else if (message.includes("cache_creation.ephemeral_")) {
      evidence = {
        validation_failure_code: "PROVIDER_CACHE_DETAIL_MISSING",
        validation_failure_reason: "Provider response omitted required cache-write TTL detail.",
      };
    } else if (message.includes("cache-creation usage detail does not reconcile")) {
      evidence = {
        validation_failure_code: "PROVIDER_CACHE_DETAIL_MISMATCH",
        validation_failure_reason: "Provider cache-write totals and TTL detail do not reconcile.",
      };
    } else if (message.includes("input_tokens usage") || message.includes("output_tokens usage")) {
      evidence = {
        validation_failure_code: "PROVIDER_CORE_USAGE_MISSING",
        validation_failure_reason: "Provider response omitted required input or output token usage.",
      };
    } else if (message.includes("exact provenance")) {
      evidence = {
        validation_failure_code: "PROVIDER_PROVENANCE_MISSING",
        validation_failure_reason: "Provider response omitted its exact model or response ID.",
      };
    } else {
      evidence = {
        validation_failure_code: "PROVIDER_RESPONSE_INVALID",
        validation_failure_reason: "Provider response did not satisfy the declared response contract.",
      };
    }
  } else if (message.includes("No pricing configured for approved model")) {
    evidence = {
      validation_failure_code: "RETURNED_MODEL_PRICING_MISSING",
      validation_failure_reason: "Returned provider model has no committed benchmark pricing.",
    };
  } else if (message.includes("Actual cost exceeded the conservative reservation")) {
    evidence = {
      validation_failure_code: "RESERVATION_CEILING_EXCEEDED",
      validation_failure_reason: "Settled provider cost exceeded the conservative server reservation.",
    };
  } else {
    evidence = {
      validation_failure_code: "FIRESTORE_SETTLEMENT_FAILED",
      validation_failure_reason: "Provider response was valid but its atomic cost settlement failed.",
    };
  }
  return {
    ...evidence,
    settlement_error_sha256: sha256CanonicalJson({ phase, message }),
  };
}

export function providerRejectionFailure(reason: string): BenchmarkFailureEvidence {
  return {
    validation_failure_code: "PROVIDER_INVALID_REQUEST_BEFORE_GENERATION",
    validation_failure_reason: "Anthropic rejected the request before model generation.",
    provider_error_sha256: sha256CanonicalJson({ reason }),
  };
}

export function providerTransportFailure(reason: string): BenchmarkUncertainEvidence {
  return {
    validation_failure_code: "PROVIDER_TRANSPORT_UNCERTAIN",
    validation_failure_reason: "Provider transport failed after dispatch; generation and spend are uncertain.",
    provider_error_sha256: sha256CanonicalJson({ reason }),
    provider_usage: null,
    provider_usage_validation: "unavailable_transport",
  };
}

export function providerRejectionReleaseFailure(
  providerReason: string,
  releaseError: unknown,
): BenchmarkFailureEvidence {
  const releaseReason = releaseError instanceof Error
    ? releaseError.message : String(releaseError);
  return {
    validation_failure_code: "PROVIDER_REJECTION_RELEASE_UNCERTAIN",
    validation_failure_reason: "Provider rejected before generation, but the zero-spend release did not settle.",
    provider_error_sha256: sha256CanonicalJson({ reason: providerReason }),
    settlement_error_sha256: sha256CanonicalJson({ reason: releaseReason }),
  };
}

export function providerConfigurationFailure(error: unknown): BenchmarkFailureEvidence {
  const reason = error instanceof Error ? error.message : String(error);
  return {
    validation_failure_code: "CANDIDATE_PROVIDER_CONFIGURATION_UNAVAILABLE",
    validation_failure_reason: "Candidate provider configuration failed before dispatch.",
    configuration_error_sha256: sha256CanonicalJson({ reason }),
  };
}

export function benchmarkUncertainAccounting(
  reservation: BenchmarkReservation,
  settlement?: BenchmarkSettlement,
) {
  const chargedMicrousd = settlement?.actual_cost_microusd ?? 0;
  const reservedMicrousd = settlement ? 0 : reservation.reserved_microusd;
  const capMicrousd = chargedMicrousd + reservedMicrousd;
  const uncertaintyStatus = settlement?.ledger_status === "settled"
    ? "settled_after_ambiguous_ack"
    : settlement?.ledger_status === "rejected"
      ? "released_before_generation"
      : settlement
        ? "charged_reservation"
        : "reservation_held";
  return {
    call_id: reservation.call_id,
    requested_model: reservation.requested_model,
    uncertainty_status: uncertaintyStatus,
    charged_cost_microusd: chargedMicrousd,
    charged_cost_usd: chargedMicrousd / 1_000_000,
    reserved_cost_microusd: reservedMicrousd,
    reserved_cost_usd: reservedMicrousd / 1_000_000,
    cap_cost_microusd: capMicrousd,
    cap_cost_usd: capMicrousd / 1_000_000,
  };
}

export function benchmarkRequestFailureState(
  rejectedByProvider: boolean,
  reservation: BenchmarkReservation,
  settlement?: BenchmarkSettlement,
) {
  const benchmarkAccounting = rejectedByProvider
    ? undefined
    : benchmarkUncertainAccounting(reservation, settlement);
  const rejected = rejectedByProvider
    || benchmarkAccounting?.uncertainty_status === "released_before_generation";
  return {
    rejected,
    benchmarkAccounting: rejected ? undefined : benchmarkAccounting,
  };
}

function runtimeConfig() {
  const capUsd = parseBenchmarkCapUsd(benchmarkCapUsd.value());
  const capMicrousd = usdToMicrousd(capUsd);
  const priorAuditSpendUsd = parseBenchmarkCapUsd(
    benchmarkPriorAuditSpendUsd.value(),
  );
  const priorAuditSpendMicrousd = usdToMicrousd(priorAuditSpendUsd);
  assertBenchmarkAuditBudget(capMicrousd, priorAuditSpendMicrousd);
  const runId = benchmarkRunId.value();
  if (!isOpaqueBenchmarkRunId(runId)) {
    throw new Error("BENCHMARK_RUN_ID must be an opaque UUIDv4 or SHA-256 value.");
  }
  const stagingFirestoreProjectId = benchmarkStagingFirestoreProjectId.value();
  const runtimeProjectId = projectID.value();
  const productionFirestoreProjectId = benchmarkProductionFirestoreProjectId.value();
  const productionStorageBucket = benchmarkStorageBucket.value();
  const rawInferenceGeo = benchmarkInferenceGeo.value();
  if (rawInferenceGeo !== "global" && rawInferenceGeo !== "us") {
    throw new Error("BENCHMARK_INFERENCE_GEO is invalid.");
  }
  const inferenceGeo: "global" | "us" = rawInferenceGeo;
  const isolationResources = benchmarkIsolationResources(
    stagingFirestoreProjectId,
    productionFirestoreProjectId,
    productionStorageBucket,
  );
  const release = buildBenchmarkReleaseIdentity({
    gitSha: benchmarkGitSha.value(),
    sourceClean: benchmarkSourceClean.value(),
    catalogSha256: benchmarkCatalogSha256.value(),
    pricingSha256: llmPricingSha256(),
    buildTimestamp: benchmarkBuildTimestamp.value(),
    runId,
    capMicrousd,
    priorAuditSpendMicrousd,
    runtimeServiceAccount: benchmarkRuntimeServiceAccount.value(),
    runtimeProjectId,
    stagingFirestoreProjectId,
    productionFirestoreProjectId,
    productionStorageBucket,
    inferenceGeo,
  });
  return {
    runId,
    capUsd,
    capMicrousd,
    priorAuditSpendUsd,
    priorAuditSpendMicrousd,
    release,
    isolationResources,
    runtimeProjectId,
    stagingFirestoreProjectId,
    productionFirestoreProjectId,
    productionStorageBucket,
    inferenceGeo,
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

function ledgerFields(
  value: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    fields
      .filter((field) => value[field] !== undefined)
      .map((field) => [field, value[field]]),
  );
}

async function benchmarkLedgerSnapshot(config: ReturnType<typeof runtimeConfig>) {
  const db = getFirestore(BENCHMARK_DATABASE_ID);
  const runRef = db.collection("model_benchmark_runs").doc(config.runId);
  const auditRef = db.collection("model_benchmark_audits").doc(BENCHMARK_AUDIT_ID);
  const pilotRunRef = db.collection("model_benchmark_runs").doc(KNOWN_PILOT_RUN_ID);
  const [run, audit, calls, existingRuns, pilotRun, pilotCalls] = await Promise.all([
    runRef.get(),
    auditRef.get(),
    runRef.collection("calls").get(),
    db.collection("model_benchmark_runs").limit(2).get(),
    pilotRunRef.get(),
    pilotRunRef.collection("calls").limit(3).get(),
  ]);
  const ledgerFieldNames = [
    "run_id", "audit_id", "limit_microusd", "spent_microusd",
    "reserved_microusd", "call_count", "uncertain_call_count",
    "uncertain_spend_microusd", "release_sha256",
  ] as const;
  const callFieldNames = [
    "status", "requested_model", "returned_model", "response_id", "stop_reason",
    "rejection_kind", "uncertainty_reason", "provider_usage",
    "provider_usage_validation", "validation_failure_code",
    "validation_failure_reason", "provider_error_sha256",
    "settlement_error_sha256", "configuration_error_sha256",
    "actual_cost_microusd", "reserved_microusd", "reservation_ceiling_microusd",
    "charged_cost_microusd", "disposition", "downstream_consumption",
    "estimated_cost_nanousd", "rounding_variance_nanousd", "rounding_reason",
    "screenplay_sha256", "route", "generation", "pipeline_stage", "pipeline_pass",
    "reader_name", "retry_number", "boundary_run",
    "prompt_bundle_sha256", "schema_bundle_sha256", "request_sha256",
    "prompt_sha256", "schema_mode", "schema_sha256",
    "transport_schema_sha256", "usage",
  ] as const;
  return {
    audit_bootstrap_status: audit.exists
      ? "not_needed"
      : existingRuns.docs.length === 1
        && existingRuns.docs[0].id === KNOWN_PILOT_RUN_ID
        && hasExactKnownPilotEvidence(
          pilotRun.exists ? pilotRun.data() : undefined,
          pilotCalls.docs.map((snapshot) => snapshot.data()),
        )
        ? "ready_from_known_pilot"
        : "blocked_missing_exact_history",
    run: run.exists
      ? ledgerFields(run.data() ?? {}, ledgerFieldNames)
      : null,
    audit: audit.exists
      ? ledgerFields(audit.data() ?? {}, ledgerFieldNames)
      : null,
    calls: calls.docs
      .map((snapshot) => ({
        call_id: snapshot.id,
        ...ledgerFields(snapshot.data(), callFieldNames),
      }))
      .sort((left, right) => String(left.call_id).localeCompare(String(right.call_id))),
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
      let ledger: Awaited<ReturnType<typeof benchmarkLedgerSnapshot>> | undefined;
      try {
        isolation = req.query.isolation === "1"
          ? await isolationPreflight(config)
          : undefined;
        ledger = req.query.ledger === "1"
          ? await benchmarkLedgerSnapshot(config)
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
        cap_microusd: config.capMicrousd,
        prior_audit_spend_usd: config.priorAuditSpendUsd,
        prior_audit_spend_microusd: config.priorAuditSpendMicrousd,
        audit_id: BENCHMARK_AUDIT_ID,
        audit_limit_microusd: BENCHMARK_AUDIT_LIMIT_MICROUSD,
        database_id: BENCHMARK_DATABASE_ID,
        runtime_project_id: config.runtimeProjectId,
        allowed_models: BENCHMARK_MODELS,
        inference_geo: config.inferenceGeo,
        service_tier: "standard_only",
        release: config.release,
        ...(isolation ? { isolation } : {}),
        ...(ledger ? { ledger } : {}),
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
        config.inferenceGeo,
      );
      const body = req.body as Record<string, unknown>;
      const evidence = deriveBenchmarkPayloadEvidence(
        built.payload as Record<string, unknown>,
      );
      contract = validateBenchmarkContract(
        body.benchmark,
        evidence,
        config.runId,
        built.body.model,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid benchmark request.";
      const code = error instanceof ProxyRequestValidationError ? error.code : "INVALID_BENCHMARK";
      res.status(400).json({
        error: message,
        code,
        isRetryable: false,
        release: config.release,
      });
      return;
    }

    const db = getFirestore(BENCHMARK_DATABASE_ID);
    const immutableRun = {
      runId: config.runId,
      limitMicrousd: config.capMicrousd,
      auditId: BENCHMARK_AUDIT_ID,
      auditLimitMicrousd: BENCHMARK_AUDIT_LIMIT_MICROUSD,
      priorAuditSpendMicrousd: config.priorAuditSpendMicrousd,
      release: config.release,
    };
    const reservedMicrousd = calculateHighestAllowedReservationMicrousd(
      PRICED_MODELS,
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
        res.status(429).json({
          error: error.message,
          code: error.code,
          isRetryable: false,
          release: config.release,
        });
        return;
      }
      if (error instanceof BenchmarkDuplicateCallError
          || error instanceof BenchmarkCallConflictError) {
        res.status(409).json({
          error: error.message,
          code: error.code,
          isRetryable: false,
          manualReviewRequired: true,
          release: config.release,
          benchmark_rejection: {
            call_id: contract.call_id,
            requested_model: contract.requested_model,
            request_sha256: contract.request_sha256,
            disposition: "no_new_dispatch",
            new_cost_microusd: 0,
            existing_status: error instanceof BenchmarkDuplicateCallError
              ? error.status : "conflict",
            existing_cost_microusd: error instanceof BenchmarkDuplicateCallError
              ? error.existingCostMicrousd : null,
          },
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
        release: config.release,
      });
      return;
    }

    let client: ReturnType<typeof createAnthropicClient>;
    try {
      const apiKey = benchmarkAnthropicApiKey.value();
      if (!apiKey.trim()) throw new Error("Benchmark provider key is unavailable.");
      client = createAnthropicClient(apiKey);
    } catch (error) {
      const failure = providerConfigurationFailure(error);
      let settlementErrorSha256: string | undefined;
      try {
        await rejectBenchmarkCallBeforeGeneration(
          db,
          immutableRun,
          reservation,
          failure,
          "candidate_provider_configuration_before_dispatch",
        );
      } catch (releaseError) {
        settlementErrorSha256 = sha256CanonicalJson({
          reason: releaseError instanceof Error
            ? releaseError.message : String(releaseError),
        });
        const settlementFailure = {
          ...failure,
          settlement_error_sha256: settlementErrorSha256,
        };
        let heldSettlement: BenchmarkSettlement | undefined;
        try {
          heldSettlement = await markBenchmarkCallUncertain(
            db,
            immutableRun,
            reservation,
            "settlement_error",
            settlementFailure,
          );
        } catch {
          // The original in-progress reservation remains held against the cap.
        }
        if (!benchmarkRequestFailureState(
          false,
          reservation,
          heldSettlement,
        ).rejected) {
          res.status(503).json({
            error: "Candidate provider configuration could not be released safely.",
            code: "BENCHMARK_SPEND_UNCERTAIN",
            isRetryable: false,
            manualReviewRequired: true,
            release: config.release,
            rejected_output_status: "unavailable_before_complete_response",
            ...settlementFailure,
            benchmark_accounting: benchmarkUncertainAccounting(
              reservation,
              heldSettlement,
            ),
          });
          return;
        }
      }
      res.status(503).json({
        error: "Candidate provider configuration is unavailable before dispatch.",
        code: "CANDIDATE_PROVIDER_CONFIGURATION_UNAVAILABLE",
        isRetryable: false,
        manualReviewRequired: true,
        release: config.release,
        benchmark_rejection: {
          call_id: reservation.call_id,
          requested_model: reservation.requested_model,
          disposition: "released_before_dispatch",
          charged_cost_microusd: 0,
          charged_cost_usd: 0,
          reserved_cost_microusd: 0,
          ...failure,
          ...(settlementErrorSha256 ? {
            settlement_error_sha256: settlementErrorSha256,
          } : {}),
        },
      });
      return;
    }
    let message: unknown;
    let uncertainSettlement: BenchmarkSettlement | undefined;
    let rejectionFailure: BenchmarkFailureEvidence | undefined;
    let providerUncertainFailure: BenchmarkUncertainEvidence | undefined;
    try {
      message = await finalMessageWithUncertainSpendProtection(
        async () => {
          const stream = client.messages.stream(
            built.payload as Parameters<typeof client.messages.stream>[0],
            built.requestOptions,
          );
          return stream.finalMessage();
        },
        async (reason) => {
          providerUncertainFailure = providerTransportFailure(reason);
          uncertainSettlement = await markBenchmarkCallUncertain(
            db,
            immutableRun,
            reservation,
            "provider_error",
            providerUncertainFailure,
          );
        },
        async (reason) => {
          rejectionFailure = providerRejectionFailure(reason);
          try {
            await rejectBenchmarkCallBeforeGeneration(
              db,
              immutableRun,
              reservation,
              rejectionFailure,
            );
          } catch (error) {
            providerUncertainFailure = providerRejectionReleaseFailure(reason, error);
            try {
              uncertainSettlement = await markBenchmarkCallUncertain(
                db,
                immutableRun,
                reservation,
                "settlement_error",
                providerUncertainFailure,
              );
            } catch {
              // The original in-progress reservation remains held against the cap.
            }
            throw error;
          }
        },
      );
    } catch (error) {
      const { rejected, benchmarkAccounting } = benchmarkRequestFailureState(
        isDefiniteAnthropicRequestRejection(error),
        reservation,
        uncertainSettlement,
      );
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
          : benchmarkAccounting?.uncertainty_status === "charged_reservation"
            ? "The provider result is uncertain and the reservation was charged against the cap."
            : benchmarkAccounting?.uncertainty_status === "settled_after_ambiguous_ack"
              ? "The provider response settled, but its acknowledgement was ambiguous."
              : "The provider result is uncertain and the reservation remains held against the cap.",
        code: rejected ? "UPSTREAM_INVALID_REQUEST" : "BENCHMARK_SPEND_UNCERTAIN",
        isRetryable: false,
        manualReviewRequired: !rejected,
        release: config.release,
        rejected_output_status: "unavailable_before_complete_response",
        ...(rejected ? {
          benchmark_rejection: {
            call_id: reservation.call_id,
            requested_model: reservation.requested_model,
            disposition: "released_before_generation",
            charged_cost_microusd: 0,
            charged_cost_usd: 0,
            ...rejectionFailure,
            ...(providerUncertainFailure?.settlement_error_sha256 ? {
              settlement_error_sha256:
                providerUncertainFailure.settlement_error_sha256,
            } : {}),
          },
        } : {}),
        ...(!rejected ? {
          ...providerUncertainFailure,
          benchmark_accounting: benchmarkAccounting,
        } : {}),
      });
      return;
    }

    let parsed: ReturnType<typeof parseAnthropicMessage> | undefined;
    const rawResponseEvidence = extractAnthropicResponseEvidence(message);
    const rawResponseContent = message && typeof message === "object"
      && Object.hasOwn(message, "content")
      ? (message as Record<string, unknown>).content
      : undefined;
    try {
      parsed = parseAnthropicMessage(
        message,
        built.requiresCacheUsage,
        built.body.model,
        config.inferenceGeo,
      );
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
        charged_cost_microusd: settlement.charged_cost_microusd,
        estimated_cost_nanousd: settlement.estimated_cost_nanousd,
        estimated_cost_usd: settlement.estimated_cost_usd,
        rounding_variance_nanousd: settlement.rounding_variance_nanousd,
        rounding_variance_usd: settlement.rounding_variance_usd,
        rounding_reason: settlement.rounding_reason,
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
          call_id: contract.call_id,
          requested_model: built.body.model,
          returned_model: parsed.model,
          response_id: parsed.responseId,
          stop_reason: parsed.stopReason,
          content: parsed.content,
          rejected_output_status: "available",
          rejected_output: parsed.content,
          rejected_output_kind: "content_blocks",
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
    } catch (error) {
      const failure = candidateSettlementFailure(
        error,
        parsed ? "settlement" : "response_validation",
      );
      let uncertainSettlement: BenchmarkSettlement | undefined;
      try {
        uncertainSettlement = await markBenchmarkCallUncertain(
          db,
          immutableRun,
          reservation,
          "settlement_error",
          parsed ? {
            ...failure,
            returned_model: parsed.model,
            response_id: parsed.responseId,
            stop_reason: parsed.stopReason,
            provider_usage: parsed.usage,
            provider_usage_validation: "unverified",
          } : { ...failure, ...rawResponseEvidence },
        );
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
        release: config.release,
        benchmark_accounting: benchmarkUncertainAccounting(
          reservation,
          uncertainSettlement,
        ),
        rejected_output_status: "available",
        rejected_output: rawResponseContent === undefined
          ? message : rawResponseContent,
        rejected_output_kind: rawResponseContent === undefined
          ? "full_provider_message" : "content_blocks",
        ...failure,
        ...(parsed ? {
          returned_model: parsed.model,
          response_id: parsed.responseId,
          stop_reason: parsed.stopReason,
          provider_usage: parsed.usage,
          provider_usage_validation: "unverified",
          content: parsed.content,
        } : {
          ...rawResponseEvidence,
          ...(rawResponseContent === undefined
            ? {} : { content: rawResponseContent }),
        }),
      });
    }
  },
);
