"use strict";
/**
 * Authoritative Anthropic dollar ledger.
 *
 * Every proxy call reserves its worst-case cost before Anthropic is invoked,
 * then settles that reservation to the exact token cost returned by Anthropic.
 * The Firestore transaction makes the daily ceiling safe under concurrency.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyBudgetExceededError = void 0;
exports.buildQueueLlmReservationMarker = buildQueueLlmReservationMarker;
exports.normalizeBudgetLedger = normalizeBudgetLedger;
exports.admitBudgetReservation = admitBudgetReservation;
exports.settleBudgetReservationInLedger = settleBudgetReservationInLedger;
exports.chargeUncertainBudgetReservationInLedger = chargeUncertainBudgetReservationInLedger;
exports.releaseBudgetReservationInLedger = releaseBudgetReservationInLedger;
exports.dailyBudgetDocId = dailyBudgetDocId;
exports.nextUtcReset = nextUtcReset;
exports.reservationExpiresAtMs = reservationExpiresAtMs;
exports.reserveLlmBudget = reserveLlmBudget;
exports.settleLlmBudget = settleLlmBudget;
exports.settleUncertainLlmBudget = settleUncertainLlmBudget;
exports.releaseLlmBudget = releaseLlmBudget;
const node_crypto_1 = require("node:crypto");
const firestore_1 = require("firebase-admin/firestore");
const llmCost_1 = require("./llmCost");
const ingestQueue_1 = require("./ingestQueue");
function buildQueueLlmReservationMarker(reservationId, budgetDocumentId, reservation, nowMs) {
    return {
        reservation_id: reservationId,
        budget_document_id: budgetDocumentId,
        model: reservation.model,
        reserved_microusd: reservation.reserved_microusd,
        reserved_at_ms: nowMs,
        state: "reserved_before_provider_dispatch",
    };
}
function queueHasReservationMarker(value, reservationId) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
    const reservations = value.llm_active_reservations;
    return Boolean(reservations
        && typeof reservations === "object"
        && !Array.isArray(reservations)
        && Object.prototype.hasOwnProperty.call(reservations, reservationId));
}
function accountingReasonEvidence(reasonCode, detail) {
    return {
        reason_code: reasonCode,
        reason_sha256: (0, node_crypto_1.createHash)("sha256").update(detail).digest("hex"),
    };
}
class DailyBudgetExceededError extends Error {
    limitMicrousd;
    spentMicrousd;
    reservedMicrousd;
    requestedMicrousd;
    resetAt;
    code = "DAILY_BUDGET_EXCEEDED";
    constructor(limitMicrousd, spentMicrousd, reservedMicrousd, requestedMicrousd, resetAt) {
        super(`Daily AI budget of $${(0, llmCost_1.microusdToUsd)(limitMicrousd).toFixed(2)} is exhausted. `
            + `It resets at ${resetAt.toISOString()}.`);
        this.limitMicrousd = limitMicrousd;
        this.spentMicrousd = spentMicrousd;
        this.reservedMicrousd = reservedMicrousd;
        this.requestedMicrousd = requestedMicrousd;
        this.resetAt = resetAt;
        this.name = "DailyBudgetExceededError";
    }
}
exports.DailyBudgetExceededError = DailyBudgetExceededError;
function nonNegativeInteger(value) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}
function requiredNonNegativeInteger(value, field) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        throw new Error(`Stored daily budget ${field} must be a non-negative integer.`);
    }
    return value;
}
function emptyModelTotals() {
    return {
        call_count: 0,
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        actual_cost_microusd: 0,
    };
}
function readModelTotals(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Stored daily budget model totals must be an object.");
    }
    const record = value;
    return {
        call_count: requiredNonNegativeInteger(record.call_count, "model call_count"),
        input_tokens: requiredNonNegativeInteger(record.input_tokens, "model input_tokens"),
        output_tokens: requiredNonNegativeInteger(record.output_tokens, "model output_tokens"),
        cache_creation_input_tokens: requiredNonNegativeInteger(record.cache_creation_input_tokens, "model cache_creation_input_tokens"),
        cache_read_input_tokens: requiredNonNegativeInteger(record.cache_read_input_tokens, "model cache_read_input_tokens"),
        actual_cost_microusd: requiredNonNegativeInteger(record.actual_cost_microusd, "model actual_cost_microusd"),
    };
}
function readActiveReservations(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Stored daily budget active_reservations must be an object.");
    }
    const result = {};
    for (const [id, raw] of Object.entries(value)) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            throw new Error(`Stored daily budget reservation ${id} must be an object.`);
        }
        const record = raw;
        const reserved = requiredNonNegativeInteger(record.reserved_microusd, `reservation ${id} reserved_microusd`);
        const expires = requiredNonNegativeInteger(record.expires_at_ms, `reservation ${id} expires_at_ms`);
        if (reserved <= 0 || expires <= 0 || typeof record.model !== "string" || !record.model) {
            throw new Error(`Stored daily budget reservation ${id} is invalid.`);
        }
        if (record.job_id !== null && typeof record.job_id !== "string") {
            throw new Error(`Stored daily budget reservation ${id} job_id is invalid.`);
        }
        result[id] = {
            reserved_microusd: reserved,
            expires_at_ms: expires,
            model: record.model,
            job_id: record.job_id,
        };
    }
    return result;
}
function normalizeBudgetLedger(value, date, limitMicrousd) {
    if (value === undefined) {
        return {
            date,
            limit_microusd: limitMicrousd,
            spent_microusd: 0,
            reserved_microusd: 0,
            call_count: 0,
            uncertain_call_count: 0,
            uncertain_spend_microusd: 0,
            input_tokens: 0,
            output_tokens: 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
            by_model: {},
            active_reservations: {},
        };
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Stored daily budget ledger must be an object.");
    }
    const record = value;
    if (!record.by_model || typeof record.by_model !== "object" || Array.isArray(record.by_model)) {
        throw new Error("Stored daily budget by_model must be an object.");
    }
    const rawModels = record.by_model;
    const byModel = {};
    for (const [model, totals] of Object.entries(rawModels)) {
        byModel[model] = readModelTotals(totals);
    }
    const activeReservations = readActiveReservations(record.active_reservations);
    const ledger = {
        date,
        limit_microusd: limitMicrousd,
        spent_microusd: requiredNonNegativeInteger(record.spent_microusd, "spent_microusd"),
        reserved_microusd: requiredNonNegativeInteger(record.reserved_microusd, "reserved_microusd"),
        call_count: requiredNonNegativeInteger(record.call_count, "call_count"),
        uncertain_call_count: requiredNonNegativeInteger(record.uncertain_call_count, "uncertain_call_count"),
        uncertain_spend_microusd: requiredNonNegativeInteger(record.uncertain_spend_microusd, "uncertain_spend_microusd"),
        input_tokens: requiredNonNegativeInteger(record.input_tokens, "input_tokens"),
        output_tokens: requiredNonNegativeInteger(record.output_tokens, "output_tokens"),
        cache_creation_input_tokens: requiredNonNegativeInteger(record.cache_creation_input_tokens, "cache_creation_input_tokens"),
        cache_read_input_tokens: requiredNonNegativeInteger(record.cache_read_input_tokens, "cache_read_input_tokens"),
        by_model: byModel,
        active_reservations: activeReservations,
    };
    if (ledger.reserved_microusd !== sumReserved(activeReservations)) {
        throw new Error("Stored daily budget reservations do not reconcile.");
    }
    return ledger;
}
function activeReservationsAt(reservations, nowMs) {
    return Object.fromEntries(Object.entries(reservations).filter(([, reservation]) => reservation.expires_at_ms > nowMs));
}
function sumReserved(reservations) {
    return Object.values(reservations).reduce((total, reservation) => total + reservation.reserved_microusd, 0);
}
function admitBudgetReservation(ledger, reservationId, reservation, nowMs) {
    const active = activeReservationsAt(ledger.active_reservations, nowMs);
    const reserved = sumReserved(active);
    const resetAt = nextUtcReset(new Date(nowMs));
    if (ledger.spent_microusd
        + reserved
        + reservation.reserved_microusd
        > ledger.limit_microusd) {
        throw new DailyBudgetExceededError(ledger.limit_microusd, ledger.spent_microusd, reserved, reservation.reserved_microusd, resetAt);
    }
    const nextActive = { ...active, [reservationId]: reservation };
    return {
        ...ledger,
        reserved_microusd: sumReserved(nextActive),
        active_reservations: nextActive,
    };
}
function settleBudgetReservationInLedger(ledger, reservationId, model, usage, actualCostMicrousd, _nowMs) {
    const active = { ...ledger.active_reservations };
    const held = active[reservationId];
    if (!held) {
        throw new Error(`Budget reservation ${reservationId} is missing or expired.`);
    }
    if (actualCostMicrousd > held.reserved_microusd) {
        throw new Error("Actual cost exceeded the conservative budget reservation.");
    }
    if (ledger.spent_microusd
        + sumReserved(active)
        - held.reserved_microusd
        + actualCostMicrousd
        > ledger.limit_microusd) {
        throw new DailyBudgetExceededError(ledger.limit_microusd, ledger.spent_microusd, sumReserved(active), actualCostMicrousd, nextUtcReset(new Date(_nowMs)));
    }
    delete active[reservationId];
    const priorModel = ledger.by_model[model] ?? emptyModelTotals();
    const modelTotals = {
        call_count: priorModel.call_count + 1,
        input_tokens: priorModel.input_tokens + usage.input_tokens,
        output_tokens: priorModel.output_tokens + usage.output_tokens,
        cache_creation_input_tokens: priorModel.cache_creation_input_tokens + usage.cache_creation_input_tokens,
        cache_read_input_tokens: priorModel.cache_read_input_tokens + usage.cache_read_input_tokens,
        actual_cost_microusd: priorModel.actual_cost_microusd + actualCostMicrousd,
    };
    return {
        ...ledger,
        spent_microusd: ledger.spent_microusd + actualCostMicrousd,
        reserved_microusd: sumReserved(active),
        call_count: ledger.call_count + 1,
        input_tokens: ledger.input_tokens + usage.input_tokens,
        output_tokens: ledger.output_tokens + usage.output_tokens,
        cache_creation_input_tokens: ledger.cache_creation_input_tokens + usage.cache_creation_input_tokens,
        cache_read_input_tokens: ledger.cache_read_input_tokens + usage.cache_read_input_tokens,
        by_model: { ...ledger.by_model, [model]: modelTotals },
        active_reservations: active,
    };
}
function chargeUncertainBudgetReservationInLedger(ledger, reservationId, reservedMicrousd, _nowMs) {
    const chargedMicrousd = nonNegativeInteger(reservedMicrousd);
    if (chargedMicrousd <= 0) {
        throw new Error("Uncertain LLM spend must retain a positive reservation.");
    }
    const active = { ...ledger.active_reservations };
    const held = active[reservationId];
    if (!held || held.reserved_microusd !== chargedMicrousd) {
        throw new Error(`Budget reservation ${reservationId} is missing, expired, or changed.`);
    }
    delete active[reservationId];
    return {
        ...ledger,
        spent_microusd: ledger.spent_microusd + chargedMicrousd,
        reserved_microusd: sumReserved(active),
        uncertain_call_count: ledger.uncertain_call_count + 1,
        uncertain_spend_microusd: ledger.uncertain_spend_microusd + chargedMicrousd,
        active_reservations: active,
    };
}
function releaseBudgetReservationInLedger(ledger, reservationId, _nowMs) {
    const active = { ...ledger.active_reservations };
    if (!active[reservationId]) {
        throw new Error(`Budget reservation ${reservationId} is missing or expired.`);
    }
    delete active[reservationId];
    return {
        ...ledger,
        reserved_microusd: sumReserved(active),
        active_reservations: active,
    };
}
function dailyBudgetDocId(date = new Date()) {
    return `llm-budget-${date.toISOString().slice(0, 10)}`;
}
function nextUtcReset(date = new Date()) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1));
}
function reservationExpiresAtMs(nowMs) {
    return nextUtcReset(new Date(nowMs)).getTime();
}
async function reserveLlmBudget(params) {
    const db = (0, firestore_1.getFirestore)();
    const nowMs = Date.now();
    const budgetDocumentId = dailyBudgetDocId(new Date(nowMs));
    const reservationId = (0, node_crypto_1.randomUUID)();
    const budgetRef = db.collection(ingestQueue_1.SYSTEM_COLLECTION).doc(budgetDocumentId);
    const reservationRef = budgetRef.collection("reservations").doc(reservationId);
    const queueRef = params.jobId
        ? db.collection(ingestQueue_1.INGEST_QUEUE_COLLECTION).doc(params.jobId)
        : null;
    const activeReservation = {
        reserved_microusd: (0, llmCost_1.calculateHighestAllowedReservationMicrousd)(llmCost_1.PRICED_MODELS, params.requestBytes, params.maxOutputTokens),
        expires_at_ms: reservationExpiresAtMs(nowMs),
        model: params.model,
        job_id: params.jobId ?? null,
    };
    await db.runTransaction(async (transaction) => {
        const [reservationSnapshot, budgetSnapshot, queueSnapshot] = await Promise.all([
            transaction.get(reservationRef),
            transaction.get(budgetRef),
            queueRef ? transaction.get(queueRef) : Promise.resolve(null),
        ]);
        if (reservationSnapshot.exists) {
            throw new Error(`Duplicate budget reservation ${reservationId}.`);
        }
        if (queueRef
            && (queueSnapshot?.exists !== true || queueSnapshot.data()?.status !== "processing")) {
            throw new Error(`Ingest queue job ${params.jobId} is not actively processing.`);
        }
        const ledger = normalizeBudgetLedger(budgetSnapshot.exists ? budgetSnapshot.data() : undefined, budgetDocumentId.replace("llm-budget-", ""), params.limitMicrousd);
        const next = admitBudgetReservation(ledger, reservationId, activeReservation, nowMs);
        transaction.set(budgetRef, {
            ...next,
            updated_at: firestore_1.FieldValue.serverTimestamp(),
        });
        transaction.create(reservationRef, {
            ...activeReservation,
            status: "reserved",
            created_at: firestore_1.Timestamp.fromMillis(nowMs),
            expires_at: firestore_1.Timestamp.fromMillis(activeReservation.expires_at_ms),
            queue_marker_written: Boolean(queueRef),
        });
        if (queueRef) {
            transaction.update(queueRef, {
                [`llm_active_reservations.${reservationId}`]: buildQueueLlmReservationMarker(reservationId, budgetDocumentId, activeReservation, nowMs),
                llm_active_reservation_count: firestore_1.FieldValue.increment(1),
                last_llm_reservation_at: firestore_1.FieldValue.serverTimestamp(),
            });
        }
    });
    return {
        id: reservationId,
        budget_document_id: budgetDocumentId,
        ...activeReservation,
    };
}
async function settleLlmBudget(reservation, usage, returnedModel = reservation.model) {
    const db = (0, firestore_1.getFirestore)();
    const nowMs = Date.now();
    const budgetRef = db.collection(ingestQueue_1.SYSTEM_COLLECTION).doc(reservation.budget_document_id);
    const reservationRef = budgetRef.collection("reservations").doc(reservation.id);
    const queueRef = reservation.job_id
        ? db.collection(ingestQueue_1.INGEST_QUEUE_COLLECTION).doc(reservation.job_id)
        : null;
    const actualCostMicrousd = (0, llmCost_1.calculateActualCostMicrousd)(returnedModel, usage);
    const estimatedCostNanousd = (0, llmCost_1.calculateEstimatedCostNanousd)(returnedModel, usage);
    const roundingVarianceNanousd = actualCostMicrousd * 1_000 - estimatedCostNanousd;
    const settlement = {
        actual_cost_microusd: actualCostMicrousd,
        actual_cost_usd: (0, llmCost_1.microusdToUsd)(actualCostMicrousd),
        charged_cost_microusd: actualCostMicrousd,
        estimated_cost_nanousd: estimatedCostNanousd,
        estimated_cost_usd: (0, llmCost_1.nanousdToUsd)(estimatedCostNanousd),
        rounding_variance_nanousd: roundingVarianceNanousd,
        rounding_variance_usd: (0, llmCost_1.nanousdToUsd)(roundingVarianceNanousd),
        rounding_reason: roundingVarianceNanousd === 0
            ? null : "ceil_to_microusd_for_atomic_budget",
    };
    return db.runTransaction(async (transaction) => {
        const reservationSnapshot = await transaction.get(reservationRef);
        const budgetSnapshot = await transaction.get(budgetRef);
        const queueSnapshot = queueRef ? await transaction.get(queueRef) : null;
        if (!reservationSnapshot.exists) {
            throw new Error(`Budget reservation ${reservation.id} does not exist.`);
        }
        const reservationData = reservationSnapshot.data() ?? {};
        if (reservationData.status === "settled") {
            const settledCost = nonNegativeInteger(reservationData.actual_cost_microusd);
            const settledEstimate = nonNegativeInteger(reservationData.estimated_cost_nanousd);
            const settledVariance = nonNegativeInteger(reservationData.rounding_variance_nanousd);
            if (settledCost * 1_000 - settledEstimate !== settledVariance) {
                throw new Error("Stored LLM settlement lacks exact cost evidence.");
            }
            return {
                actual_cost_microusd: settledCost,
                actual_cost_usd: (0, llmCost_1.microusdToUsd)(settledCost),
                charged_cost_microusd: settledCost,
                estimated_cost_nanousd: settledEstimate,
                estimated_cost_usd: (0, llmCost_1.nanousdToUsd)(settledEstimate),
                rounding_variance_nanousd: settledVariance,
                rounding_variance_usd: (0, llmCost_1.nanousdToUsd)(settledVariance),
                rounding_reason: settledVariance === 0
                    ? null : "ceil_to_microusd_for_atomic_budget",
            };
        }
        if (reservationData.status !== "reserved") {
            throw new Error(`Budget reservation ${reservation.id} is ${reservationData.status}.`);
        }
        if (queueRef && queueSnapshot?.exists !== true) {
            throw new Error(`Ingest queue job ${reservation.job_id} does not exist.`);
        }
        const storedLimit = budgetSnapshot.exists
            ? nonNegativeInteger(budgetSnapshot.data()?.limit_microusd)
            : 0;
        if (storedLimit <= 0)
            throw new Error("Daily AI budget ledger is missing its limit.");
        const ledger = normalizeBudgetLedger(budgetSnapshot.data(), reservation.budget_document_id.replace("llm-budget-", ""), storedLimit);
        const next = settleBudgetReservationInLedger(ledger, reservation.id, returnedModel, usage, actualCostMicrousd, nowMs);
        transaction.set(budgetRef, {
            ...next,
            updated_at: firestore_1.FieldValue.serverTimestamp(),
        });
        transaction.update(reservationRef, {
            status: "settled",
            requested_model: reservation.model,
            returned_model: returnedModel,
            actual_cost_microusd: actualCostMicrousd,
            charged_cost_microusd: actualCostMicrousd,
            estimated_cost_nanousd: estimatedCostNanousd,
            rounding_variance_nanousd: roundingVarianceNanousd,
            rounding_reason: settlement.rounding_reason,
            usage,
            settled_at: firestore_1.FieldValue.serverTimestamp(),
        });
        if (queueRef) {
            const modelPrefix = `llm_models.${returnedModel}`;
            const clearMarker = queueHasReservationMarker(queueSnapshot?.data(), reservation.id);
            transaction.update(queueRef, {
                llm_call_count: firestore_1.FieldValue.increment(1),
                llm_input_tokens: firestore_1.FieldValue.increment(usage.input_tokens),
                llm_output_tokens: firestore_1.FieldValue.increment(usage.output_tokens),
                llm_cache_creation_input_tokens: firestore_1.FieldValue.increment(usage.cache_creation_input_tokens),
                llm_cache_read_input_tokens: firestore_1.FieldValue.increment(usage.cache_read_input_tokens),
                actual_cost_microusd: firestore_1.FieldValue.increment(actualCostMicrousd),
                actual_cost_usd: firestore_1.FieldValue.increment((0, llmCost_1.microusdToUsd)(actualCostMicrousd)),
                [`${modelPrefix}.call_count`]: firestore_1.FieldValue.increment(1),
                [`${modelPrefix}.input_tokens`]: firestore_1.FieldValue.increment(usage.input_tokens),
                [`${modelPrefix}.output_tokens`]: firestore_1.FieldValue.increment(usage.output_tokens),
                [`${modelPrefix}.cache_creation_input_tokens`]: firestore_1.FieldValue.increment(usage.cache_creation_input_tokens),
                [`${modelPrefix}.cache_read_input_tokens`]: firestore_1.FieldValue.increment(usage.cache_read_input_tokens),
                [`${modelPrefix}.actual_cost_microusd`]: firestore_1.FieldValue.increment(actualCostMicrousd),
                last_llm_call_at: firestore_1.FieldValue.serverTimestamp(),
                ...(clearMarker ? {
                    [`llm_active_reservations.${reservation.id}`]: firestore_1.FieldValue.delete(),
                    llm_active_reservation_count: firestore_1.FieldValue.increment(-1),
                } : {}),
            });
        }
        return settlement;
    });
}
async function settleUncertainLlmBudget(reservation, reasonCode, detail) {
    const db = (0, firestore_1.getFirestore)();
    const nowMs = Date.now();
    const budgetRef = db.collection(ingestQueue_1.SYSTEM_COLLECTION).doc(reservation.budget_document_id);
    const reservationRef = budgetRef.collection("reservations").doc(reservation.id);
    const queueRef = reservation.job_id
        ? db.collection(ingestQueue_1.INGEST_QUEUE_COLLECTION).doc(reservation.job_id)
        : null;
    return db.runTransaction(async (transaction) => {
        const [reservationSnapshot, budgetSnapshot, queueSnapshot] = await Promise.all([
            transaction.get(reservationRef),
            transaction.get(budgetRef),
            queueRef ? transaction.get(queueRef) : Promise.resolve(null),
        ]);
        if (!reservationSnapshot.exists) {
            throw new Error(`Budget reservation ${reservation.id} does not exist.`);
        }
        const reservationData = reservationSnapshot.data() ?? {};
        if (reservationData.status === "uncertain" || reservationData.status === "settled") {
            const priorCharge = nonNegativeInteger(reservationData.charged_cost_microusd
                ?? reservationData.actual_cost_microusd);
            return {
                actual_cost_microusd: priorCharge,
                actual_cost_usd: (0, llmCost_1.microusdToUsd)(priorCharge),
            };
        }
        if (reservationData.status !== "reserved") {
            throw new Error(`Budget reservation ${reservation.id} is ${reservationData.status}.`);
        }
        const storedLimit = nonNegativeInteger(budgetSnapshot.data()?.limit_microusd);
        if (storedLimit <= 0)
            throw new Error("Daily AI budget ledger is missing its limit.");
        const ledger = normalizeBudgetLedger(budgetSnapshot.data(), reservation.budget_document_id.replace("llm-budget-", ""), storedLimit);
        const chargedMicrousd = reservation.reserved_microusd;
        const next = chargeUncertainBudgetReservationInLedger(ledger, reservation.id, chargedMicrousd, nowMs);
        transaction.set(budgetRef, {
            ...next,
            updated_at: firestore_1.FieldValue.serverTimestamp(),
        });
        transaction.update(reservationRef, {
            status: "uncertain",
            charged_cost_microusd: chargedMicrousd,
            ...accountingReasonEvidence(reasonCode, detail),
            settled_at: firestore_1.FieldValue.serverTimestamp(),
        });
        if (queueRef && queueSnapshot?.exists) {
            const modelPrefix = `llm_models.${reservation.model}`;
            const clearMarker = queueHasReservationMarker(queueSnapshot.data(), reservation.id);
            transaction.update(queueRef, {
                llm_uncertain_call_count: firestore_1.FieldValue.increment(1),
                uncertain_cost_microusd: firestore_1.FieldValue.increment(chargedMicrousd),
                uncertain_cost_usd: firestore_1.FieldValue.increment((0, llmCost_1.microusdToUsd)(chargedMicrousd)),
                [`${modelPrefix}.uncertain_call_count`]: firestore_1.FieldValue.increment(1),
                [`${modelPrefix}.uncertain_cost_microusd`]: firestore_1.FieldValue.increment(chargedMicrousd),
                last_llm_call_at: firestore_1.FieldValue.serverTimestamp(),
                ...(clearMarker ? {
                    [`llm_active_reservations.${reservation.id}`]: firestore_1.FieldValue.delete(),
                    llm_active_reservation_count: firestore_1.FieldValue.increment(-1),
                } : {}),
            });
        }
        return {
            actual_cost_microusd: chargedMicrousd,
            actual_cost_usd: (0, llmCost_1.microusdToUsd)(chargedMicrousd),
        };
    });
}
async function releaseLlmBudget(reservation, reasonCode, detail) {
    const db = (0, firestore_1.getFirestore)();
    const nowMs = Date.now();
    const budgetRef = db.collection(ingestQueue_1.SYSTEM_COLLECTION).doc(reservation.budget_document_id);
    const reservationRef = budgetRef.collection("reservations").doc(reservation.id);
    const queueRef = reservation.job_id
        ? db.collection(ingestQueue_1.INGEST_QUEUE_COLLECTION).doc(reservation.job_id)
        : null;
    await db.runTransaction(async (transaction) => {
        const [reservationSnapshot, budgetSnapshot, queueSnapshot] = await Promise.all([
            transaction.get(reservationRef),
            transaction.get(budgetRef),
            queueRef ? transaction.get(queueRef) : Promise.resolve(null),
        ]);
        if (!reservationSnapshot.exists) {
            throw new Error(`Budget reservation ${reservation.id} does not exist.`);
        }
        const reservationData = reservationSnapshot.data() ?? {};
        if (reservationData.status === "released")
            return;
        if (reservationData.status !== "reserved") {
            throw new Error(`Budget reservation ${reservation.id} is ${reservationData.status}.`);
        }
        const storedLimit = nonNegativeInteger(budgetSnapshot.data()?.limit_microusd);
        if (storedLimit <= 0)
            throw new Error("Daily AI budget ledger is missing its limit.");
        const ledger = normalizeBudgetLedger(budgetSnapshot.data(), reservation.budget_document_id.replace("llm-budget-", ""), storedLimit);
        const next = releaseBudgetReservationInLedger(ledger, reservation.id, nowMs);
        transaction.set(budgetRef, {
            ...next,
            updated_at: firestore_1.FieldValue.serverTimestamp(),
        });
        transaction.update(reservationRef, {
            status: "released",
            ...accountingReasonEvidence(reasonCode, detail),
            released_at: firestore_1.FieldValue.serverTimestamp(),
        });
        if (queueRef && queueSnapshot?.exists) {
            const clearMarker = queueHasReservationMarker(queueSnapshot.data(), reservation.id);
            transaction.update(queueRef, {
                ...(clearMarker ? {
                    [`llm_active_reservations.${reservation.id}`]: firestore_1.FieldValue.delete(),
                    llm_active_reservation_count: firestore_1.FieldValue.increment(-1),
                } : {}),
                last_llm_reservation_release_at: firestore_1.FieldValue.serverTimestamp(),
            });
        }
    });
}
//# sourceMappingURL=budgetCounter.js.map