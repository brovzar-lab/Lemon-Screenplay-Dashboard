"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BenchmarkCallConflictError = exports.BenchmarkDuplicateCallError = exports.BenchmarkCapExceededError = void 0;
exports.rejectExistingBenchmarkCall = rejectExistingBenchmarkCall;
exports.normalizeBenchmarkRunLedger = normalizeBenchmarkRunLedger;
exports.admitBenchmarkReservation = admitBenchmarkReservation;
exports.settleBenchmarkReservation = settleBenchmarkReservation;
exports.chargeUncertainBenchmarkReservation = chargeUncertainBenchmarkReservation;
exports.releaseBenchmarkReservation = releaseBenchmarkReservation;
exports.reserveBenchmarkCall = reserveBenchmarkCall;
exports.settleBenchmarkCall = settleBenchmarkCall;
exports.markBenchmarkCallUncertain = markBenchmarkCallUncertain;
exports.rejectBenchmarkCallBeforeGeneration = rejectBenchmarkCallBeforeGeneration;
const firestore_1 = require("firebase-admin/firestore");
const llmCost_1 = require("./llmCost");
class BenchmarkCapExceededError extends Error {
    ledger;
    requestedMicrousd;
    code = "BENCHMARK_CAP_EXCEEDED";
    constructor(ledger, requestedMicrousd) {
        super("The immutable benchmark run cost cap is exhausted.");
        this.ledger = ledger;
        this.requestedMicrousd = requestedMicrousd;
        this.name = "BenchmarkCapExceededError";
    }
}
exports.BenchmarkCapExceededError = BenchmarkCapExceededError;
class BenchmarkDuplicateCallError extends Error {
    status;
    code = "BENCHMARK_DUPLICATE_CALL";
    constructor(status) {
        super(`Call ID already exists with status ${status}; Anthropic was not called again.`);
        this.status = status;
        this.name = "BenchmarkDuplicateCallError";
    }
}
exports.BenchmarkDuplicateCallError = BenchmarkDuplicateCallError;
class BenchmarkCallConflictError extends Error {
    code = "BENCHMARK_CALL_CONFLICT";
    constructor() {
        super("Call ID was reused with different request hashes.");
        this.name = "BenchmarkCallConflictError";
    }
}
exports.BenchmarkCallConflictError = BenchmarkCallConflictError;
function rejectExistingBenchmarkCall(prior, contract) {
    if (prior.request_sha256 !== contract.request_sha256
        || prior.prompt_bundle_sha256 !== contract.prompt_bundle_sha256
        || prior.structured_output_schema_sha256
            !== contract.structured_output_schema_sha256) {
        throw new BenchmarkCallConflictError();
    }
    throw new BenchmarkDuplicateCallError(String(prior.status ?? "unknown"));
}
function nonNegativeInteger(value) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}
function normalizeBenchmarkRunLedger(value, limitMicrousd) {
    const record = value && typeof value === "object"
        ? value
        : {};
    return {
        limit_microusd: limitMicrousd,
        spent_microusd: nonNegativeInteger(record.spent_microusd),
        reserved_microusd: nonNegativeInteger(record.reserved_microusd),
        call_count: nonNegativeInteger(record.call_count),
        uncertain_call_count: nonNegativeInteger(record.uncertain_call_count),
        uncertain_spend_microusd: nonNegativeInteger(record.uncertain_spend_microusd),
    };
}
function admitBenchmarkReservation(ledger, reservedMicrousd) {
    if (!Number.isInteger(reservedMicrousd) || reservedMicrousd <= 0) {
        throw new Error("Benchmark reservation must be a positive integer.");
    }
    if (ledger.spent_microusd + ledger.reserved_microusd + reservedMicrousd
        > ledger.limit_microusd) {
        throw new BenchmarkCapExceededError(ledger, reservedMicrousd);
    }
    return { ...ledger, reserved_microusd: ledger.reserved_microusd + reservedMicrousd };
}
function settleBenchmarkReservation(ledger, reservedMicrousd, actualCostMicrousd) {
    if (!Number.isInteger(reservedMicrousd)
        || reservedMicrousd <= 0
        || reservedMicrousd > ledger.reserved_microusd) {
        throw new Error("Benchmark reservation is not fully held by the ledger.");
    }
    if (!Number.isInteger(actualCostMicrousd) || actualCostMicrousd < 0) {
        throw new Error("Actual cost must be a non-negative integer.");
    }
    if (actualCostMicrousd > reservedMicrousd) {
        throw new Error("Actual cost exceeded the conservative reservation.");
    }
    return {
        ...ledger,
        spent_microusd: ledger.spent_microusd + actualCostMicrousd,
        reserved_microusd: ledger.reserved_microusd - reservedMicrousd,
        call_count: ledger.call_count + 1,
    };
}
function chargeUncertainBenchmarkReservation(ledger, reservedMicrousd) {
    if (!Number.isInteger(reservedMicrousd)
        || reservedMicrousd <= 0
        || reservedMicrousd > ledger.reserved_microusd) {
        throw new Error("Benchmark reservation is not fully held by the ledger.");
    }
    return {
        ...ledger,
        spent_microusd: ledger.spent_microusd + reservedMicrousd,
        reserved_microusd: ledger.reserved_microusd - reservedMicrousd,
        uncertain_call_count: ledger.uncertain_call_count + 1,
        uncertain_spend_microusd: ledger.uncertain_spend_microusd + reservedMicrousd,
    };
}
function releaseBenchmarkReservation(ledger, reservedMicrousd) {
    if (!Number.isInteger(reservedMicrousd)
        || reservedMicrousd <= 0
        || reservedMicrousd > ledger.reserved_microusd) {
        throw new Error("Benchmark reservation is not fully held by the ledger.");
    }
    return { ...ledger, reserved_microusd: ledger.reserved_microusd - reservedMicrousd };
}
function validateStoredRun(value, config) {
    if (value.run_id !== config.runId
        || value.limit_microusd !== config.limitMicrousd
        || value.git_sha !== config.release.git_sha
        || value.catalog_sha256 !== config.release.catalog_sha256
        || value.deployment_config_sha256 !== config.release.deployment_config_sha256) {
        throw new Error("Stored benchmark run configuration does not match this deployment.");
    }
}
async function reserveBenchmarkCall(db, config, contract, reservedMicrousd) {
    const runRef = db.collection("model_benchmark_runs").doc(config.runId);
    const callRef = runRef.collection("calls").doc(contract.call_id);
    await db.runTransaction(async (transaction) => {
        const [runSnapshot, callSnapshot] = await Promise.all([
            transaction.get(runRef),
            transaction.get(callRef),
        ]);
        if (callSnapshot.exists) {
            rejectExistingBenchmarkCall(callSnapshot.data() ?? {}, contract);
        }
        const priorRun = runSnapshot.exists ? runSnapshot.data() ?? {} : {};
        if (runSnapshot.exists)
            validateStoredRun(priorRun, config);
        const ledger = normalizeBenchmarkRunLedger(priorRun, config.limitMicrousd);
        const next = admitBenchmarkReservation(ledger, reservedMicrousd);
        transaction.set(runRef, {
            ...next,
            run_id: config.runId,
            git_sha: config.release.git_sha,
            catalog_sha256: config.release.catalog_sha256,
            deployment_config_sha256: config.release.deployment_config_sha256,
            updated_at: firestore_1.FieldValue.serverTimestamp(),
            ...(runSnapshot.exists ? {} : { created_at: firestore_1.FieldValue.serverTimestamp() }),
        });
        transaction.create(callRef, {
            ...contract,
            status: "in_progress",
            reserved_microusd: reservedMicrousd,
            release: config.release,
            created_at: firestore_1.Timestamp.now(),
        });
    });
    return {
        run_id: config.runId,
        call_id: contract.call_id,
        requested_model: contract.requested_model,
        reserved_microusd: reservedMicrousd,
    };
}
async function settleBenchmarkCall(db, config, reservation, usage, returnedModel, responseId, stopReason) {
    const actualCostMicrousd = (0, llmCost_1.calculateActualCostMicrousd)(returnedModel, usage);
    const runRef = db.collection("model_benchmark_runs").doc(config.runId);
    const callRef = runRef.collection("calls").doc(reservation.call_id);
    return db.runTransaction(async (transaction) => {
        const [runSnapshot, callSnapshot] = await Promise.all([
            transaction.get(runRef),
            transaction.get(callRef),
        ]);
        if (!runSnapshot.exists || !callSnapshot.exists) {
            throw new Error("Benchmark reservation is missing.");
        }
        const call = callSnapshot.data() ?? {};
        if (call.status === "settled") {
            const priorCost = nonNegativeInteger(call.actual_cost_microusd);
            return { actual_cost_microusd: priorCost, actual_cost_usd: (0, llmCost_1.microusdToUsd)(priorCost) };
        }
        if (call.status !== "in_progress") {
            throw new Error(`Benchmark reservation is ${String(call.status)}.`);
        }
        const run = runSnapshot.data() ?? {};
        validateStoredRun(run, config);
        const next = settleBenchmarkReservation(normalizeBenchmarkRunLedger(run, config.limitMicrousd), reservation.reserved_microusd, actualCostMicrousd);
        transaction.update(runRef, { ...next, updated_at: firestore_1.FieldValue.serverTimestamp() });
        transaction.update(callRef, {
            status: "settled",
            returned_model: returnedModel,
            response_id: responseId,
            stop_reason: stopReason,
            usage,
            actual_cost_microusd: actualCostMicrousd,
            settled_at: firestore_1.FieldValue.serverTimestamp(),
        });
        return {
            actual_cost_microusd: actualCostMicrousd,
            actual_cost_usd: (0, llmCost_1.microusdToUsd)(actualCostMicrousd),
        };
    });
}
async function markBenchmarkCallUncertain(db, config, reservation, reason) {
    const runRef = db.collection("model_benchmark_runs").doc(config.runId);
    const callRef = runRef.collection("calls").doc(reservation.call_id);
    return db.runTransaction(async (transaction) => {
        const [runSnapshot, callSnapshot] = await Promise.all([
            transaction.get(runRef), transaction.get(callRef),
        ]);
        if (!runSnapshot.exists || !callSnapshot.exists)
            throw new Error("Benchmark reservation is missing.");
        const call = callSnapshot.data() ?? {};
        if (call.status === "settled" || call.status === "uncertain") {
            const priorCost = nonNegativeInteger(call.actual_cost_microusd ?? call.charged_cost_microusd);
            return { actual_cost_microusd: priorCost, actual_cost_usd: (0, llmCost_1.microusdToUsd)(priorCost) };
        }
        if (call.status !== "in_progress")
            throw new Error(`Benchmark reservation is ${String(call.status)}.`);
        const run = runSnapshot.data() ?? {};
        validateStoredRun(run, config);
        const next = chargeUncertainBenchmarkReservation(normalizeBenchmarkRunLedger(run, config.limitMicrousd), reservation.reserved_microusd);
        transaction.update(runRef, { ...next, updated_at: firestore_1.FieldValue.serverTimestamp() });
        transaction.update(callRef, {
            status: "uncertain",
            charged_cost_microusd: reservation.reserved_microusd,
            uncertainty_reason: reason,
            settled_at: firestore_1.FieldValue.serverTimestamp(),
        });
        return {
            actual_cost_microusd: reservation.reserved_microusd,
            actual_cost_usd: (0, llmCost_1.microusdToUsd)(reservation.reserved_microusd),
        };
    });
}
async function rejectBenchmarkCallBeforeGeneration(db, config, reservation) {
    const runRef = db.collection("model_benchmark_runs").doc(config.runId);
    const callRef = runRef.collection("calls").doc(reservation.call_id);
    await db.runTransaction(async (transaction) => {
        const [runSnapshot, callSnapshot] = await Promise.all([
            transaction.get(runRef), transaction.get(callRef),
        ]);
        if (!runSnapshot.exists || !callSnapshot.exists)
            throw new Error("Benchmark reservation is missing.");
        const call = callSnapshot.data() ?? {};
        if (call.status === "rejected")
            return;
        if (call.status !== "in_progress")
            throw new Error(`Benchmark reservation is ${String(call.status)}.`);
        const run = runSnapshot.data() ?? {};
        validateStoredRun(run, config);
        const next = releaseBenchmarkReservation(normalizeBenchmarkRunLedger(run, config.limitMicrousd), reservation.reserved_microusd);
        transaction.update(runRef, { ...next, updated_at: firestore_1.FieldValue.serverTimestamp() });
        transaction.update(callRef, {
            status: "rejected",
            rejection_kind: "anthropic_invalid_request_before_generation",
            settled_at: firestore_1.FieldValue.serverTimestamp(),
        });
    });
}
//# sourceMappingURL=benchmarkLedger.js.map