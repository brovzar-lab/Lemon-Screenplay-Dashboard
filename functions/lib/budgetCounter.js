"use strict";
/**
 * budgetCounter.ts — Shared Anthropic daily call budget
 *
 * SINGLE SOURCE OF TRUTH for the daily API call limit.
 * Used by:
 *   - analyzeScreenplay  (Cloud Function — existing browser-initiated path)
 *   - onScreenplayUploaded (Cloud Function — new ingest pipeline path)
 *   - VPS daemon         (Python — imports the same Firestore doc, same logic)
 *
 * The counter document lives at: system/api-budget-{YYYY-MM-DD}
 *
 * Firestore transactions guarantee exactly-once increments even under
 * concurrent access from multiple workers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BudgetExceededError = void 0;
exports.dailyBudgetDocId = dailyBudgetDocId;
exports.checkAndIncrementBudget = checkAndIncrementBudget;
exports.getDailyBudgetStatus = getDailyBudgetStatus;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const ingestQueue_1 = require("./ingestQueue");
/** Thrown when the daily limit is reached. */
class BudgetExceededError extends Error {
    constructor(limit) {
        super(`Daily analysis limit of ${limit} calls reached. Try again tomorrow.`);
        this.name = 'BudgetExceededError';
    }
}
exports.BudgetExceededError = BudgetExceededError;
/**
 * Returns today's budget document ID (UTC date).
 * Both the Cloud Function and VPS daemon must use this same key format.
 */
function dailyBudgetDocId(date) {
    const d = date ?? new Date();
    return `api-budget-${d.toISOString().split('T')[0]}`; // api-budget-2026-05-30
}
/**
 * Atomically increments the daily call counter and throws if the limit
 * has been reached. Safe to call concurrently from multiple workers.
 *
 * @param limit - Max calls per UTC day (default: 200)
 * @throws BudgetExceededError if limit reached
 * @throws HttpsError('resource-exhausted') when called from a Cloud Function context
 */
async function checkAndIncrementBudget(limit = ingestQueue_1.DAILY_BUDGET_LIMIT, throwAsHttpsError = false) {
    const db = (0, firestore_1.getFirestore)();
    const docId = dailyBudgetDocId();
    const ref = db.collection(ingestQueue_1.SYSTEM_COLLECTION).doc(docId);
    const newCount = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const current = snap.exists ? (snap.data()?.count ?? 0) : 0;
        if (current >= limit) {
            if (throwAsHttpsError) {
                throw new https_1.HttpsError('resource-exhausted', `Daily analysis limit of ${limit} calls reached. Please try again tomorrow.`);
            }
            throw new BudgetExceededError(limit);
        }
        tx.set(ref, {
            count: firestore_1.FieldValue.increment(1),
            date: docId.replace('api-budget-', ''),
            limit,
        }, { merge: true });
        return current + 1;
    });
    console.log(`[Budget] Daily call count: ${newCount}/${limit}`);
    return newCount;
}
/**
 * Read-only: returns the current call count for today without modifying it.
 * Safe to call from the dashboard or monitoring.
 */
async function getDailyBudgetStatus(limit = ingestQueue_1.DAILY_BUDGET_LIMIT) {
    const db = (0, firestore_1.getFirestore)();
    const docId = dailyBudgetDocId();
    const snap = await db.collection(ingestQueue_1.SYSTEM_COLLECTION).doc(docId).get();
    const count = snap.exists ? (snap.data()?.count ?? 0) : 0;
    return {
        count,
        limit,
        remaining: Math.max(0, limit - count),
        date: docId.replace('api-budget-', ''),
    };
}
//# sourceMappingURL=budgetCounter.js.map