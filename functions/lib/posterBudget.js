"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.posterBudgetDate = posterBudgetDate;
exports.posterReservationExpiresAtMs = posterReservationExpiresAtMs;
exports.settlePosterLedger = settlePosterLedger;
exports.reservePosterBudget = reservePosterBudget;
exports.settlePosterBudget = settlePosterBudget;
const firestore_1 = require("firebase-admin/firestore");
const budgetCounter_1 = require("./budgetCounter");
const posterCore_1 = require("./posterCore");
const SYSTEM_COLLECTION = 'system';
const DEFAULT_DAILY_LIMIT_MICROUSD = 5_000_000;
const SETTLEMENT_BUFFER_MS = 60 * 60 * 1000;
function dailyLimitMicrousd() {
    const configured = Number(process.env.POSTER_DAILY_BUDGET_MICROUSD);
    return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_DAILY_LIMIT_MICROUSD;
}
function posterBudgetDate(now) {
    return now.toISOString().slice(0, 10);
}
function posterReservationExpiresAtMs(now) {
    const nextDay = new Date(`${posterBudgetDate(now)}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    return nextDay.getTime() + SETTLEMENT_BUFFER_MS;
}
function settlePosterLedger(ledger, requestId, model, uncertain, nowMs) {
    if (!ledger.active_reservations[requestId])
        return ledger;
    const cost = posterCore_1.POSTER_MODELS[model].costMicrousd;
    return uncertain
        ? (0, budgetCounter_1.chargeUncertainBudgetReservationInLedger)(ledger, requestId, cost, nowMs)
        : (0, budgetCounter_1.settleBudgetReservationInLedger)(ledger, requestId, posterCore_1.POSTER_MODELS[model].id, {
            input_tokens: 0,
            output_tokens: 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
        }, cost, nowMs);
}
async function reservePosterBudget(requestId, model, sourceId) {
    const now = new Date();
    const date = posterBudgetDate(now);
    const limit = dailyLimitMicrousd();
    const ref = (0, firestore_1.getFirestore)().collection(SYSTEM_COLLECTION).doc(`poster-budget-${date}`);
    await (0, firestore_1.getFirestore)().runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const ledger = (0, budgetCounter_1.normalizeBudgetLedger)(snapshot.data(), date, limit);
        const next = (0, budgetCounter_1.admitBudgetReservation)(ledger, requestId, {
            reserved_microusd: posterCore_1.POSTER_MODELS[model].costMicrousd,
            expires_at_ms: posterReservationExpiresAtMs(now),
            model: posterCore_1.POSTER_MODELS[model].id,
            job_id: sourceId,
        }, now.getTime());
        transaction.set(ref, { ...next, budget_kind: 'poster_images' });
    });
    return date;
}
async function settlePosterBudget(requestId, model, uncertain, reservationDate) {
    const now = new Date();
    const limit = dailyLimitMicrousd();
    const ref = (0, firestore_1.getFirestore)().collection(SYSTEM_COLLECTION).doc(`poster-budget-${reservationDate}`);
    await (0, firestore_1.getFirestore)().runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const ledger = (0, budgetCounter_1.normalizeBudgetLedger)(snapshot.data(), reservationDate, limit);
        const next = settlePosterLedger(ledger, requestId, model, uncertain, now.getTime());
        transaction.set(ref, { ...next, budget_kind: 'poster_images' });
    });
}
//# sourceMappingURL=posterBudget.js.map