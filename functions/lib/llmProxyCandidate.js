"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmProxyCandidate = void 0;
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
const benchmarkGitSha = (0, params_1.defineString)("BENCHMARK_GIT_SHA");
const benchmarkSourceClean = (0, params_1.defineString)("BENCHMARK_SOURCE_CLEAN");
const benchmarkCatalogSha256 = (0, params_1.defineString)("BENCHMARK_CATALOG_SHA256");
const benchmarkBuildTimestamp = (0, params_1.defineString)("BENCHMARK_BUILD_TIMESTAMP");
const benchmarkRuntimeServiceAccount = (0, params_1.defineString)("BENCHMARK_RUNTIME_SERVICE_ACCOUNT");
const benchmarkStagingFirestoreProjectId = (0, params_1.defineString)("BENCHMARK_STAGING_FIRESTORE_PROJECT_ID");
const benchmarkProductionFirestoreProjectId = (0, params_1.defineString)("BENCHMARK_PRODUCTION_FIRESTORE_PROJECT_ID");
const benchmarkStorageBucket = (0, params_1.defineString)("BENCHMARK_STORAGE_BUCKET");
const MAX_OUTPUT_TOKENS = 24_000;
const MAX_THINKING_TOKENS = 16_000;
function runtimeConfig() {
    const capUsd = Number(benchmarkCapUsd.value());
    if (!Number.isFinite(capUsd) || capUsd <= 0 || capUsd > 1_000) {
        throw new Error("BENCHMARK_CAP_USD must be between 0 and 1000.");
    }
    const capMicrousd = (0, llmCost_1.usdToMicrousd)(capUsd);
    const runId = benchmarkRunId.value();
    if (!/^[A-Za-z0-9._-]{1,120}$/.test(runId))
        throw new Error("BENCHMARK_RUN_ID is invalid.");
    const stagingFirestoreProjectId = benchmarkStagingFirestoreProjectId.value();
    const runtimeProjectId = params_1.projectID.value();
    const productionFirestoreProjectId = benchmarkProductionFirestoreProjectId.value();
    const productionStorageBucket = benchmarkStorageBucket.value();
    const isolationResources = (0, benchmarkRelease_1.benchmarkIsolationResources)(stagingFirestoreProjectId, productionFirestoreProjectId, productionStorageBucket);
    const release = (0, benchmarkRelease_1.buildBenchmarkReleaseIdentity)({
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
        try {
            isolation = req.query.isolation === "1"
                ? await isolationPreflight(config)
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
            database_id: benchmarkCandidatePolicy_1.BENCHMARK_DATABASE_ID,
            runtime_project_id: config.runtimeProjectId,
            allowed_models: benchmarkCandidatePolicy_1.BENCHMARK_MODELS,
            release: config.release,
            ...(isolation ? { isolation } : {}),
        });
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed.", code: "METHOD_NOT_ALLOWED" });
        return;
    }
    let built;
    let contract;
    try {
        (0, benchmarkCandidatePolicy_1.validateCandidateEnvelope)(req.body);
        built = (0, anthropicProxyCore_1.buildAnthropicRequest)(req.body, "service", MAX_OUTPUT_TOKENS, MAX_THINKING_TOKENS);
        const body = req.body;
        const requestSha256 = (0, anthropicProxyCore_1.sha256CanonicalJson)(built.payload);
        contract = (0, benchmarkCandidatePolicy_1.validateBenchmarkContract)(body.benchmark, requestSha256, config.runId, built.body.model);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Invalid benchmark request.";
        const code = error instanceof anthropicProxyCore_1.ProxyRequestValidationError ? error.code : "INVALID_BENCHMARK";
        res.status(400).json({ error: message, code, isRetryable: false });
        return;
    }
    const db = (0, firestore_1.getFirestore)(benchmarkCandidatePolicy_1.BENCHMARK_DATABASE_ID);
    const immutableRun = {
        runId: config.runId,
        limitMicrousd: config.capMicrousd,
        release: config.release,
    };
    const reservedMicrousd = (0, llmCost_1.calculateReservationMicrousd)(built.body.model, node_buffer_1.Buffer.byteLength(JSON.stringify(built.payload), "utf8"), built.maxTokens);
    let reservation;
    try {
        reservation = await (0, benchmarkLedger_1.reserveBenchmarkCall)(db, immutableRun, contract, reservedMicrousd);
    }
    catch (error) {
        if (error instanceof benchmarkLedger_1.BenchmarkCapExceededError) {
            res.status(429).json({ error: error.message, code: error.code, isRetryable: false });
            return;
        }
        if (error instanceof benchmarkLedger_1.BenchmarkDuplicateCallError
            || error instanceof benchmarkLedger_1.BenchmarkCallConflictError) {
            res.status(409).json({
                error: error.message,
                code: error.code,
                isRetryable: false,
                manualReviewRequired: true,
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
        });
        return;
    }
    const client = (0, anthropicClient_1.createAnthropicClient)(benchmarkAnthropicApiKey.value());
    let message;
    try {
        message = await (0, anthropicClient_1.finalMessageWithUncertainSpendProtection)(async () => {
            const stream = client.messages.stream(built.payload, built.requestOptions);
            return stream.finalMessage();
        }, async () => {
            await (0, benchmarkLedger_1.markBenchmarkCallUncertain)(db, immutableRun, reservation, "provider_error");
        }, async () => {
            await (0, benchmarkLedger_1.rejectBenchmarkCallBeforeGeneration)(db, immutableRun, reservation);
        });
    }
    catch (error) {
        const rejected = (0, anthropicClient_1.isDefiniteAnthropicRequestRejection)(error);
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
                : "The provider result is uncertain and the reservation remains held against the cap.",
            code: rejected ? "UPSTREAM_INVALID_REQUEST" : "BENCHMARK_SPEND_UNCERTAIN",
            isRetryable: false,
            manualReviewRequired: !rejected,
        });
        return;
    }
    try {
        const parsed = (0, anthropicProxyCore_1.parseAnthropicMessage)(message);
        const settlement = await (0, benchmarkLedger_1.settleBenchmarkCall)(db, immutableRun, reservation, parsed.usage, parsed.model, parsed.responseId, parsed.stopReason);
        const usage = {
            ...parsed.usage,
            call_count: 1,
            actual_cost_microusd: settlement.actual_cost_microusd,
            actual_cost_usd: settlement.actual_cost_usd,
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
    }
    catch {
        try {
            await (0, benchmarkLedger_1.markBenchmarkCallUncertain)(db, immutableRun, reservation, "settlement_error");
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
        });
    }
});
//# sourceMappingURL=llmProxyCandidate.js.map