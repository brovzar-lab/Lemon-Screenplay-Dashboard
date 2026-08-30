"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmProxyCandidate = exports.CANDIDATE_MAX_OUTPUT_TOKENS = void 0;
exports.candidateContractRejection = candidateContractRejection;
exports.candidateSettlementFailure = candidateSettlementFailure;
exports.providerRejectionFailure = providerRejectionFailure;
exports.providerTransportFailure = providerTransportFailure;
exports.providerRejectionReleaseFailure = providerRejectionReleaseFailure;
exports.providerConfigurationFailure = providerConfigurationFailure;
exports.benchmarkUncertainAccounting = benchmarkUncertainAccounting;
exports.benchmarkRequestFailureState = benchmarkRequestFailureState;
exports.isPermissionDenied = isPermissionDenied;
exports.isolationApp = isolationApp;
const node_buffer_1 = require("node:buffer");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const params_1 = require("firebase-functions/params");
const https_1 = require("firebase-functions/v2/https");
const anthropicClient_1 = require("./anthropicClient");
const anthropicProxyCore_1 = require("./anthropicProxyCore");
const benchmarkLedger_1 = require("./benchmarkLedger");
const benchmarkCandidatePolicy_1 = require("./benchmarkCandidatePolicy");
const candidateLog_1 = require("./candidateLog");
const benchmarkRelease_1 = require("./benchmarkRelease");
const llmCost_1 = require("./llmCost");
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
const benchmarkAnthropicApiKey = (0, params_1.defineSecret)("BENCHMARK_ANTHROPIC_API_KEY");
const benchmarkRunId = (0, params_1.defineString)("BENCHMARK_RUN_ID");
const benchmarkCapUsd = (0, params_1.defineString)("BENCHMARK_CAP_USD");
const benchmarkPriorAuditSpendUsd = (0, params_1.defineString)("BENCHMARK_PRIOR_AUDIT_SPEND_USD");
const benchmarkGitSha = (0, params_1.defineString)("BENCHMARK_GIT_SHA");
const benchmarkSourceClean = (0, params_1.defineString)("BENCHMARK_SOURCE_CLEAN");
const benchmarkCatalogSha256 = (0, params_1.defineString)("BENCHMARK_CATALOG_SHA256");
const benchmarkBuildTimestamp = (0, params_1.defineString)("BENCHMARK_BUILD_TIMESTAMP");
const benchmarkRuntimeServiceAccount = (0, params_1.defineString)("BENCHMARK_RUNTIME_SERVICE_ACCOUNT");
const benchmarkStagingFirestoreProjectId = (0, params_1.defineString)("BENCHMARK_STAGING_FIRESTORE_PROJECT_ID");
const benchmarkProductionFirestoreProjectId = (0, params_1.defineString)("BENCHMARK_PRODUCTION_FIRESTORE_PROJECT_ID");
const benchmarkStorageBucket = (0, params_1.defineString)("BENCHMARK_STORAGE_BUCKET");
const benchmarkInferenceGeo = (0, params_1.defineString)("BENCHMARK_INFERENCE_GEO");
exports.CANDIDATE_MAX_OUTPUT_TOKENS = 32_000;
const MAX_THINKING_TOKENS = 16_000;
function candidateContractRejection(value, evidence, requestedModel) {
    if (!value || typeof value !== "object" || Array.isArray(value)
        || !evidence || !requestedModel)
        return undefined;
    const benchmark = value;
    if (typeof benchmark.call_id !== "string"
        || !/^[a-f0-9]{64}$/.test(benchmark.call_id)
        || benchmark.requested_model !== requestedModel
        || benchmark.request_sha256 !== evidence.request_sha256)
        return undefined;
    return {
        call_id: benchmark.call_id,
        requested_model: requestedModel,
        request_sha256: evidence.request_sha256,
        disposition: "rejected_before_reservation",
        new_cost_microusd: 0,
        charged_cost_microusd: 0,
        reserved_cost_microusd: 0,
        validation_failure_code: "CANDIDATE_CONTRACT_REJECTED",
        validation_failure_reason: ("Candidate rejected the request contract before reservation or provider dispatch."),
    };
}
function candidateSettlementFailure(error, phase) {
    const message = error instanceof Error ? error.message : "";
    let evidence;
    if (phase === "response_validation") {
        if (message.includes("cache_creation_input_tokens")
            || message.includes("cache_read_input_tokens")) {
            evidence = {
                validation_failure_code: "PROVIDER_CACHE_TOTALS_MISSING",
                validation_failure_reason: "Cached provider response omitted required aggregate cache usage.",
            };
        }
        else if (message.includes("cache_creation.ephemeral_")) {
            evidence = {
                validation_failure_code: "PROVIDER_CACHE_DETAIL_MISSING",
                validation_failure_reason: "Provider response omitted required cache-write TTL detail.",
            };
        }
        else if (message.includes("cache-creation usage detail does not reconcile")) {
            evidence = {
                validation_failure_code: "PROVIDER_CACHE_DETAIL_MISMATCH",
                validation_failure_reason: "Provider cache-write totals and TTL detail do not reconcile.",
            };
        }
        else if (message.includes("input_tokens usage") || message.includes("output_tokens usage")) {
            evidence = {
                validation_failure_code: "PROVIDER_CORE_USAGE_MISSING",
                validation_failure_reason: "Provider response omitted required input or output token usage.",
            };
        }
        else if (message.includes("exact provenance")) {
            evidence = {
                validation_failure_code: "PROVIDER_PROVENANCE_MISSING",
                validation_failure_reason: "Provider response omitted its exact model or response ID.",
            };
        }
        else {
            evidence = {
                validation_failure_code: "PROVIDER_RESPONSE_INVALID",
                validation_failure_reason: "Provider response did not satisfy the declared response contract.",
            };
        }
    }
    else if (message.includes("No pricing configured for approved model")) {
        evidence = {
            validation_failure_code: "RETURNED_MODEL_PRICING_MISSING",
            validation_failure_reason: "Returned provider model has no committed benchmark pricing.",
        };
    }
    else if (message.includes("Actual cost exceeded the conservative reservation")) {
        evidence = {
            validation_failure_code: "RESERVATION_CEILING_EXCEEDED",
            validation_failure_reason: "Settled provider cost exceeded the conservative server reservation.",
        };
    }
    else {
        evidence = {
            validation_failure_code: "FIRESTORE_SETTLEMENT_FAILED",
            validation_failure_reason: "Provider response was valid but its atomic cost settlement failed.",
        };
    }
    return {
        ...evidence,
        settlement_error_sha256: (0, anthropicProxyCore_1.sha256CanonicalJson)({ phase, message }),
    };
}
function providerRejectionFailure(reason) {
    return {
        validation_failure_code: "PROVIDER_INVALID_REQUEST_BEFORE_GENERATION",
        validation_failure_reason: "Anthropic rejected the request before model generation.",
        provider_error_sha256: (0, anthropicProxyCore_1.sha256CanonicalJson)({ reason }),
    };
}
function providerTransportFailure(reason) {
    return {
        validation_failure_code: "PROVIDER_TRANSPORT_UNCERTAIN",
        validation_failure_reason: "Provider transport failed after dispatch; generation and spend are uncertain.",
        provider_error_sha256: (0, anthropicProxyCore_1.sha256CanonicalJson)({ reason }),
        provider_usage: null,
        provider_usage_validation: "unavailable_transport",
    };
}
function providerRejectionReleaseFailure(providerReason, releaseError) {
    const releaseReason = releaseError instanceof Error
        ? releaseError.message : String(releaseError);
    return {
        validation_failure_code: "PROVIDER_REJECTION_RELEASE_UNCERTAIN",
        validation_failure_reason: "Provider rejected before generation, but the zero-spend release did not settle.",
        provider_error_sha256: (0, anthropicProxyCore_1.sha256CanonicalJson)({ reason: providerReason }),
        settlement_error_sha256: (0, anthropicProxyCore_1.sha256CanonicalJson)({ reason: releaseReason }),
    };
}
function providerConfigurationFailure(error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
        validation_failure_code: "CANDIDATE_PROVIDER_CONFIGURATION_UNAVAILABLE",
        validation_failure_reason: "Candidate provider configuration failed before dispatch.",
        configuration_error_sha256: (0, anthropicProxyCore_1.sha256CanonicalJson)({ reason }),
    };
}
function benchmarkUncertainAccounting(reservation, settlement) {
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
function benchmarkRequestFailureState(rejectedByProvider, reservation, settlement) {
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
    const capUsd = (0, benchmarkCandidatePolicy_1.parseBenchmarkCapUsd)(benchmarkCapUsd.value());
    const capMicrousd = (0, llmCost_1.usdToMicrousd)(capUsd);
    const priorAuditSpendUsd = (0, benchmarkCandidatePolicy_1.parseBenchmarkCapUsd)(benchmarkPriorAuditSpendUsd.value());
    const priorAuditSpendMicrousd = (0, llmCost_1.usdToMicrousd)(priorAuditSpendUsd);
    (0, benchmarkCandidatePolicy_1.assertBenchmarkAuditBudget)(capMicrousd, priorAuditSpendMicrousd);
    const runId = benchmarkRunId.value();
    if (!(0, benchmarkCandidatePolicy_1.isOpaqueBenchmarkRunId)(runId)) {
        throw new Error("BENCHMARK_RUN_ID must be an opaque UUIDv4 or SHA-256 value.");
    }
    const stagingFirestoreProjectId = benchmarkStagingFirestoreProjectId.value();
    const runtimeProjectId = params_1.projectID.value();
    const productionFirestoreProjectId = benchmarkProductionFirestoreProjectId.value();
    const productionStorageBucket = benchmarkStorageBucket.value();
    const rawInferenceGeo = benchmarkInferenceGeo.value();
    if (rawInferenceGeo !== "global" && rawInferenceGeo !== "us") {
        throw new Error("BENCHMARK_INFERENCE_GEO is invalid.");
    }
    const inferenceGeo = rawInferenceGeo;
    const isolationResources = (0, benchmarkRelease_1.benchmarkIsolationResources)(stagingFirestoreProjectId, productionFirestoreProjectId, productionStorageBucket);
    const release = (0, benchmarkRelease_1.buildBenchmarkReleaseIdentity)({
        gitSha: benchmarkGitSha.value(),
        sourceClean: benchmarkSourceClean.value(),
        catalogSha256: benchmarkCatalogSha256.value(),
        pricingSha256: (0, llmCost_1.llmPricingSha256)(),
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
function permissionCode(error) {
    return error && typeof error === "object" ? error.code : undefined;
}
function isPermissionDenied(error) {
    const code = permissionCode(error);
    return code === 7 || code === 403 || code === "permission-denied";
}
async function deniedProbe(operation) {
    try {
        await operation();
        return "allowed";
    }
    catch (error) {
        return isPermissionDenied(error) ? "denied" : "error";
    }
}
function isolationApp(projectId) {
    const name = `benchmark-isolation-${projectId}`;
    return (0, app_1.getApps)().find((app) => app.name === name)
        ?? (0, app_1.initializeApp)({ projectId }, name);
}
async function isolationPreflight(config) {
    const benchmarkDb = (0, firestore_1.getFirestore)(benchmarkCandidatePolicy_1.BENCHMARK_DATABASE_ID);
    const namedDatabase = await deniedProbe(() => benchmarkDb.collection("model_benchmark_runs").doc(config.runId).get());
    const stagingDefaultDatabase = await deniedProbe(() => (0, firestore_1.getFirestore)(isolationApp(config.stagingFirestoreProjectId))
        .collection("_benchmark_isolation_probe_").doc("staging-default").get());
    const productionDefaultDatabase = await deniedProbe(() => (0, firestore_1.getFirestore)(isolationApp(config.productionFirestoreProjectId))
        .collection("_benchmark_isolation_probe_").doc("production-default").get());
    const productionStorage = await deniedProbe(() => (0, storage_1.getStorage)().bucket(config.productionStorageBucket)
        .file("_benchmark_isolation_probe_/production-storage").exists());
    return {
        named_database: namedDatabase,
        staging_default_database: stagingDefaultDatabase,
        production_default_database: productionDefaultDatabase,
        production_storage: productionStorage,
        targets: config.isolationResources,
    };
}
function ledgerFields(value, fields) {
    return Object.fromEntries(fields
        .filter((field) => value[field] !== undefined)
        .map((field) => [field, value[field]]));
}
async function benchmarkLedgerSnapshot(config) {
    const db = (0, firestore_1.getFirestore)(benchmarkCandidatePolicy_1.BENCHMARK_DATABASE_ID);
    const runRef = db.collection("model_benchmark_runs").doc(config.runId);
    const auditRef = db.collection("model_benchmark_audits").doc(benchmarkCandidatePolicy_1.BENCHMARK_AUDIT_ID);
    const pilotRunRef = db.collection("model_benchmark_runs").doc(benchmarkLedger_1.KNOWN_PILOT_RUN_ID);
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
    ];
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
    ];
    return {
        audit_bootstrap_status: audit.exists
            ? "not_needed"
            : existingRuns.docs.length === 1
                && existingRuns.docs[0].id === benchmarkLedger_1.KNOWN_PILOT_RUN_ID
                && (0, benchmarkLedger_1.hasExactKnownPilotEvidence)(pilotRun.exists ? pilotRun.data() : undefined, pilotCalls.docs.map((snapshot) => snapshot.data()))
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
exports.llmProxyCandidate = (0, https_1.onRequest)({
    region: benchmarkRelease_1.BENCHMARK_RUNTIME_OPTIONS.region,
    timeoutSeconds: benchmarkRelease_1.BENCHMARK_RUNTIME_OPTIONS.timeoutSeconds,
    memory: benchmarkRelease_1.BENCHMARK_RUNTIME_OPTIONS.memory,
    maxInstances: benchmarkRelease_1.BENCHMARK_RUNTIME_OPTIONS.maxInstances,
    concurrency: benchmarkRelease_1.BENCHMARK_RUNTIME_OPTIONS.concurrency,
    invoker: benchmarkRelease_1.BENCHMARK_RUNTIME_OPTIONS.invoker,
    serviceAccount: benchmarkRuntimeServiceAccount,
    secrets: [benchmarkAnthropicApiKey],
}, async (req, res) => {
    let config;
    try {
        config = runtimeConfig();
    }
    catch {
        (0, candidateLog_1.candidateLog)({ event: "configuration_rejected", status_code: 503 });
        res.status(503).json({ error: "Candidate configuration is invalid.", code: "INVALID_CONFIG" });
        return;
    }
    if (req.method === "GET") {
        let isolation;
        let ledger;
        try {
            isolation = req.query.isolation === "1"
                ? await isolationPreflight(config)
                : undefined;
            ledger = req.query.ledger === "1"
                ? await benchmarkLedgerSnapshot(config)
                : undefined;
        }
        catch {
            (0, candidateLog_1.candidateLog)({
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
            audit_id: benchmarkCandidatePolicy_1.BENCHMARK_AUDIT_ID,
            audit_limit_microusd: benchmarkCandidatePolicy_1.BENCHMARK_AUDIT_LIMIT_MICROUSD,
            database_id: benchmarkCandidatePolicy_1.BENCHMARK_DATABASE_ID,
            runtime_project_id: config.runtimeProjectId,
            allowed_models: benchmarkCandidatePolicy_1.BENCHMARK_MODELS,
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
    let built;
    let contract;
    let evidence;
    let requestedModel;
    try {
        (0, benchmarkCandidatePolicy_1.validateCandidateEnvelope)(req.body);
        built = (0, anthropicProxyCore_1.buildAnthropicRequest)(req.body, "service", exports.CANDIDATE_MAX_OUTPUT_TOKENS, MAX_THINKING_TOKENS, config.inferenceGeo, true);
        requestedModel = built.body.model;
        const body = req.body;
        evidence = (0, benchmarkCandidatePolicy_1.deriveBenchmarkPayloadEvidence)(built.payload);
        contract = (0, benchmarkCandidatePolicy_1.validateBenchmarkContract)(body.benchmark, evidence, config.runId, built.body.model, built.payload);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Invalid benchmark request.";
        const code = error instanceof anthropicProxyCore_1.ProxyRequestValidationError ? error.code : "INVALID_BENCHMARK";
        const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
            ? req.body : {};
        const rejection = candidateContractRejection(body.benchmark, evidence, requestedModel);
        res.status(400).json({
            error: message,
            code,
            isRetryable: false,
            release: config.release,
            ...(rejection ? { benchmark_rejection: rejection } : {}),
        });
        return;
    }
    const db = (0, firestore_1.getFirestore)(benchmarkCandidatePolicy_1.BENCHMARK_DATABASE_ID);
    const immutableRun = {
        runId: config.runId,
        limitMicrousd: config.capMicrousd,
        auditId: benchmarkCandidatePolicy_1.BENCHMARK_AUDIT_ID,
        auditLimitMicrousd: benchmarkCandidatePolicy_1.BENCHMARK_AUDIT_LIMIT_MICROUSD,
        priorAuditSpendMicrousd: config.priorAuditSpendMicrousd,
        release: config.release,
    };
    const reservedMicrousd = (0, llmCost_1.calculateHighestAllowedReservationMicrousd)(llmCost_1.PRICED_MODELS, node_buffer_1.Buffer.byteLength(JSON.stringify(built.payload), "utf8"), built.maxTokens);
    let reservation;
    try {
        reservation = await (0, benchmarkLedger_1.reserveBenchmarkCall)(db, immutableRun, contract, reservedMicrousd);
    }
    catch (error) {
        if (error instanceof benchmarkLedger_1.BenchmarkCapExceededError) {
            res.status(429).json({
                error: error.message,
                code: error.code,
                isRetryable: false,
                release: config.release,
            });
            return;
        }
        if (error instanceof benchmarkLedger_1.BenchmarkRetryLineageError) {
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
                },
            });
            return;
        }
        if (error instanceof benchmarkLedger_1.BenchmarkDuplicateCallError
            || error instanceof benchmarkLedger_1.BenchmarkCallConflictError) {
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
                    existing_status: error instanceof benchmarkLedger_1.BenchmarkDuplicateCallError
                        ? error.status : "conflict",
                    existing_cost_microusd: error instanceof benchmarkLedger_1.BenchmarkDuplicateCallError
                        ? error.existingCostMicrousd : null,
                },
            });
            return;
        }
        (0, candidateLog_1.candidateLog)({
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
    let client;
    try {
        const apiKey = benchmarkAnthropicApiKey.value();
        if (!apiKey.trim())
            throw new Error("Benchmark provider key is unavailable.");
        client = (0, anthropicClient_1.createAnthropicClient)(apiKey);
    }
    catch (error) {
        const failure = providerConfigurationFailure(error);
        let settlementErrorSha256;
        try {
            await (0, benchmarkLedger_1.rejectBenchmarkCallBeforeGeneration)(db, immutableRun, reservation, failure, "candidate_provider_configuration_before_dispatch");
        }
        catch (releaseError) {
            settlementErrorSha256 = (0, anthropicProxyCore_1.sha256CanonicalJson)({
                reason: releaseError instanceof Error
                    ? releaseError.message : String(releaseError),
            });
            const settlementFailure = {
                ...failure,
                settlement_error_sha256: settlementErrorSha256,
            };
            let heldSettlement;
            try {
                heldSettlement = await (0, benchmarkLedger_1.markBenchmarkCallUncertain)(db, immutableRun, reservation, "settlement_error", settlementFailure);
            }
            catch {
                // The original in-progress reservation remains held against the cap.
            }
            if (!benchmarkRequestFailureState(false, reservation, heldSettlement).rejected) {
                res.status(503).json({
                    error: "Candidate provider configuration could not be released safely.",
                    code: "BENCHMARK_SPEND_UNCERTAIN",
                    isRetryable: false,
                    manualReviewRequired: true,
                    release: config.release,
                    rejected_output_status: "unavailable_before_complete_response",
                    ...settlementFailure,
                    benchmark_accounting: benchmarkUncertainAccounting(reservation, heldSettlement),
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
    let message;
    let uncertainSettlement;
    let rejectionFailure;
    let providerUncertainFailure;
    try {
        message = await (0, anthropicClient_1.finalMessageWithUncertainSpendProtection)(async () => {
            const stream = client.messages.stream(built.payload, built.requestOptions);
            return stream.finalMessage();
        }, async (reason) => {
            providerUncertainFailure = providerTransportFailure(reason);
            uncertainSettlement = await (0, benchmarkLedger_1.markBenchmarkCallUncertain)(db, immutableRun, reservation, "provider_error", providerUncertainFailure);
        }, async (reason) => {
            rejectionFailure = providerRejectionFailure(reason);
            try {
                await (0, benchmarkLedger_1.rejectBenchmarkCallBeforeGeneration)(db, immutableRun, reservation, rejectionFailure);
            }
            catch (error) {
                providerUncertainFailure = providerRejectionReleaseFailure(reason, error);
                try {
                    uncertainSettlement = await (0, benchmarkLedger_1.markBenchmarkCallUncertain)(db, immutableRun, reservation, "settlement_error", providerUncertainFailure);
                }
                catch {
                    // The original in-progress reservation remains held against the cap.
                }
                throw error;
            }
        });
    }
    catch (error) {
        const { rejected, benchmarkAccounting } = benchmarkRequestFailureState((0, anthropicClient_1.isDefiniteAnthropicRequestRejection)(error), reservation, uncertainSettlement);
        (0, candidateLog_1.candidateLog)({
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
                        settlement_error_sha256: providerUncertainFailure.settlement_error_sha256,
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
    let parsed;
    const rawResponseEvidence = (0, anthropicProxyCore_1.extractAnthropicResponseEvidence)(message);
    const rawResponseContent = message && typeof message === "object"
        && Object.hasOwn(message, "content")
        ? message.content
        : undefined;
    try {
        parsed = (0, anthropicProxyCore_1.parseAnthropicMessage)(message, built.requiresCacheUsage, built.body.model, config.inferenceGeo);
        const settlement = await (0, benchmarkLedger_1.settleBenchmarkCall)(db, immutableRun, reservation, parsed.usage, parsed.model, parsed.responseId, parsed.stopReason);
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
        (0, candidateLog_1.candidateLog)({
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
    }
    catch (error) {
        const failure = candidateSettlementFailure(error, parsed ? "settlement" : "response_validation");
        let uncertainSettlement;
        try {
            uncertainSettlement = await (0, benchmarkLedger_1.markBenchmarkCallUncertain)(db, immutableRun, reservation, "settlement_error", parsed ? {
                ...failure,
                returned_model: parsed.model,
                response_id: parsed.responseId,
                stop_reason: parsed.stopReason,
                provider_usage: parsed.usage,
                provider_usage_validation: "unverified",
            } : { ...failure, ...rawResponseEvidence });
        }
        catch {
            // The permanent in-progress reservation still protects the cap.
        }
        (0, candidateLog_1.candidateLog)({
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
            benchmark_accounting: benchmarkUncertainAccounting(reservation, uncertainSettlement),
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
});
//# sourceMappingURL=llmProxyCandidate.js.map