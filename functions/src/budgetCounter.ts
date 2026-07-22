/**
 * Authoritative Anthropic dollar ledger.
 *
 * Every proxy call reserves its worst-case cost before Anthropic is invoked,
 * then settles that reservation to the exact token cost returned by Anthropic.
 * The Firestore transaction makes the daily ceiling safe under concurrency.
 */

import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import {
  calculateActualCostMicrousd,
  calculateReservationMicrousd,
  microusdToUsd,
  type LlmTokenUsage,
} from "./llmCost";
import { INGEST_QUEUE_COLLECTION, SYSTEM_COLLECTION } from "./ingestQueue";

export interface ActiveReservation {
  reserved_microusd: number;
  expires_at_ms: number;
  model: string;
  job_id: string | null;
}

export interface ModelUsageTotals extends LlmTokenUsage {
  call_count: number;
  actual_cost_microusd: number;
}

export interface DailyBudgetLedger extends LlmTokenUsage {
  date: string;
  limit_microusd: number;
  spent_microusd: number;
  reserved_microusd: number;
  call_count: number;
  uncertain_call_count: number;
  uncertain_spend_microusd: number;
  by_model: Record<string, ModelUsageTotals>;
  active_reservations: Record<string, ActiveReservation>;
}

export interface LlmBudgetReservation extends ActiveReservation {
  id: string;
  budget_document_id: string;
}

export interface LlmBudgetSettlement {
  actual_cost_microusd: number;
  actual_cost_usd: number;
}

export class DailyBudgetExceededError extends Error {
  readonly code = "DAILY_BUDGET_EXCEEDED";

  constructor(
    readonly limitMicrousd: number,
    readonly spentMicrousd: number,
    readonly reservedMicrousd: number,
    readonly requestedMicrousd: number,
    readonly resetAt: Date,
  ) {
    super(
      `Daily AI budget of $${microusdToUsd(limitMicrousd).toFixed(2)} is exhausted. `
        + `It resets at ${resetAt.toISOString()}.`,
    );
    this.name = "DailyBudgetExceededError";
  }
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function emptyModelTotals(): ModelUsageTotals {
  return {
    call_count: 0,
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    actual_cost_microusd: 0,
  };
}

function readModelTotals(value: unknown): ModelUsageTotals {
  const record = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  return {
    call_count: nonNegativeInteger(record.call_count),
    input_tokens: nonNegativeInteger(record.input_tokens),
    output_tokens: nonNegativeInteger(record.output_tokens),
    cache_creation_input_tokens: nonNegativeInteger(record.cache_creation_input_tokens),
    cache_read_input_tokens: nonNegativeInteger(record.cache_read_input_tokens),
    actual_cost_microusd: nonNegativeInteger(record.actual_cost_microusd),
  };
}

function readActiveReservations(value: unknown): Record<string, ActiveReservation> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, ActiveReservation> = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const record = raw as Record<string, unknown>;
    const reserved = nonNegativeInteger(record.reserved_microusd);
    const expires = nonNegativeInteger(record.expires_at_ms);
    const model = typeof record.model === "string" ? record.model : "";
    const jobId = typeof record.job_id === "string" ? record.job_id : null;
    if (reserved > 0 && expires > 0 && model) {
      result[id] = {
        reserved_microusd: reserved,
        expires_at_ms: expires,
        model,
        job_id: jobId,
      };
    }
  }
  return result;
}

export function normalizeBudgetLedger(
  value: unknown,
  date: string,
  limitMicrousd: number,
): DailyBudgetLedger {
  const record = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const rawModels = record.by_model && typeof record.by_model === "object"
    ? record.by_model as Record<string, unknown>
    : {};
  const byModel: Record<string, ModelUsageTotals> = {};
  for (const [model, totals] of Object.entries(rawModels)) {
    byModel[model] = readModelTotals(totals);
  }
  return {
    date,
    limit_microusd: limitMicrousd,
    spent_microusd: nonNegativeInteger(record.spent_microusd),
    reserved_microusd: nonNegativeInteger(record.reserved_microusd),
    call_count: nonNegativeInteger(record.call_count),
    uncertain_call_count: nonNegativeInteger(record.uncertain_call_count),
    uncertain_spend_microusd: nonNegativeInteger(record.uncertain_spend_microusd),
    input_tokens: nonNegativeInteger(record.input_tokens),
    output_tokens: nonNegativeInteger(record.output_tokens),
    cache_creation_input_tokens: nonNegativeInteger(record.cache_creation_input_tokens),
    cache_read_input_tokens: nonNegativeInteger(record.cache_read_input_tokens),
    by_model: byModel,
    active_reservations: readActiveReservations(record.active_reservations),
  };
}

function activeReservationsAt(
  reservations: Record<string, ActiveReservation>,
  nowMs: number,
): Record<string, ActiveReservation> {
  return Object.fromEntries(
    Object.entries(reservations).filter(([, reservation]) => reservation.expires_at_ms > nowMs),
  );
}

function sumReserved(reservations: Record<string, ActiveReservation>): number {
  return Object.values(reservations).reduce(
    (total, reservation) => total + reservation.reserved_microusd,
    0,
  );
}

export function admitBudgetReservation(
  ledger: DailyBudgetLedger,
  reservationId: string,
  reservation: ActiveReservation,
  nowMs: number,
): DailyBudgetLedger {
  const active = activeReservationsAt(ledger.active_reservations, nowMs);
  const reserved = sumReserved(active);
  const resetAt = nextUtcReset(new Date(nowMs));
  if (
    ledger.spent_microusd
      + reserved
      + reservation.reserved_microusd
      > ledger.limit_microusd
  ) {
    throw new DailyBudgetExceededError(
      ledger.limit_microusd,
      ledger.spent_microusd,
      reserved,
      reservation.reserved_microusd,
      resetAt,
    );
  }

  const nextActive = { ...active, [reservationId]: reservation };
  return {
    ...ledger,
    reserved_microusd: sumReserved(nextActive),
    active_reservations: nextActive,
  };
}

export function settleBudgetReservationInLedger(
  ledger: DailyBudgetLedger,
  reservationId: string,
  model: string,
  usage: LlmTokenUsage,
  actualCostMicrousd: number,
  nowMs: number,
): DailyBudgetLedger {
  const active = activeReservationsAt(ledger.active_reservations, nowMs);
  if (!active[reservationId]) {
    throw new Error(`Budget reservation ${reservationId} is missing or expired.`);
  }
  delete active[reservationId];

  const priorModel = ledger.by_model[model] ?? emptyModelTotals();
  const modelTotals: ModelUsageTotals = {
    call_count: priorModel.call_count + 1,
    input_tokens: priorModel.input_tokens + usage.input_tokens,
    output_tokens: priorModel.output_tokens + usage.output_tokens,
    cache_creation_input_tokens:
      priorModel.cache_creation_input_tokens + usage.cache_creation_input_tokens,
    cache_read_input_tokens:
      priorModel.cache_read_input_tokens + usage.cache_read_input_tokens,
    actual_cost_microusd: priorModel.actual_cost_microusd + actualCostMicrousd,
  };

  return {
    ...ledger,
    spent_microusd: ledger.spent_microusd + actualCostMicrousd,
    reserved_microusd: sumReserved(active),
    call_count: ledger.call_count + 1,
    input_tokens: ledger.input_tokens + usage.input_tokens,
    output_tokens: ledger.output_tokens + usage.output_tokens,
    cache_creation_input_tokens:
      ledger.cache_creation_input_tokens + usage.cache_creation_input_tokens,
    cache_read_input_tokens:
      ledger.cache_read_input_tokens + usage.cache_read_input_tokens,
    by_model: { ...ledger.by_model, [model]: modelTotals },
    active_reservations: active,
  };
}

export function chargeUncertainBudgetReservationInLedger(
  ledger: DailyBudgetLedger,
  reservationId: string,
  reservedMicrousd: number,
  nowMs: number,
): DailyBudgetLedger {
  const chargedMicrousd = nonNegativeInteger(reservedMicrousd);
  if (chargedMicrousd <= 0) {
    throw new Error("Uncertain LLM spend must retain a positive reservation.");
  }

  const active = activeReservationsAt(ledger.active_reservations, nowMs);
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

export function dailyBudgetDocId(date = new Date()): string {
  return `llm-budget-${date.toISOString().slice(0, 10)}`;
}

export function nextUtcReset(date = new Date()): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  ));
}

export function reservationExpiresAtMs(nowMs: number): number {
  return nextUtcReset(new Date(nowMs)).getTime();
}

export async function reserveLlmBudget(params: {
  model: string;
  requestBytes: number;
  maxOutputTokens: number;
  limitMicrousd: number;
  jobId?: string;
}): Promise<LlmBudgetReservation> {
  const db = getFirestore();
  const nowMs = Date.now();
  const budgetDocumentId = dailyBudgetDocId(new Date(nowMs));
  const reservationId = randomUUID();
  const budgetRef = db.collection(SYSTEM_COLLECTION).doc(budgetDocumentId);
  const reservationRef = budgetRef.collection("reservations").doc(reservationId);
  const activeReservation: ActiveReservation = {
    reserved_microusd: calculateReservationMicrousd(
      params.model,
      params.requestBytes,
      params.maxOutputTokens,
    ),
    expires_at_ms: reservationExpiresAtMs(nowMs),
    model: params.model,
    job_id: params.jobId ?? null,
  };

  await db.runTransaction(async (transaction) => {
    const [reservationSnapshot, budgetSnapshot] = await Promise.all([
      transaction.get(reservationRef),
      transaction.get(budgetRef),
    ]);
    if (reservationSnapshot.exists) {
      throw new Error(`Duplicate budget reservation ${reservationId}.`);
    }
    const ledger = normalizeBudgetLedger(
      budgetSnapshot.exists ? budgetSnapshot.data() : undefined,
      budgetDocumentId.replace("llm-budget-", ""),
      params.limitMicrousd,
    );
    const next = admitBudgetReservation(
      ledger,
      reservationId,
      activeReservation,
      nowMs,
    );
    transaction.set(budgetRef, {
      ...next,
      updated_at: FieldValue.serverTimestamp(),
    });
    transaction.create(reservationRef, {
      ...activeReservation,
      status: "reserved",
      created_at: Timestamp.fromMillis(nowMs),
      expires_at: Timestamp.fromMillis(activeReservation.expires_at_ms),
    });
  });

  return {
    id: reservationId,
    budget_document_id: budgetDocumentId,
    ...activeReservation,
  };
}

export async function settleLlmBudget(
  reservation: LlmBudgetReservation,
  usage: LlmTokenUsage,
): Promise<LlmBudgetSettlement> {
  const db = getFirestore();
  const nowMs = Date.now();
  const budgetRef = db.collection(SYSTEM_COLLECTION).doc(reservation.budget_document_id);
  const reservationRef = budgetRef.collection("reservations").doc(reservation.id);
  const queueRef = reservation.job_id
    ? db.collection(INGEST_QUEUE_COLLECTION).doc(reservation.job_id)
    : null;
  const actualCostMicrousd = calculateActualCostMicrousd(reservation.model, usage);

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
      return {
        actual_cost_microusd: settledCost,
        actual_cost_usd: microusdToUsd(settledCost),
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
    if (storedLimit <= 0) throw new Error("Daily AI budget ledger is missing its limit.");
    const ledger = normalizeBudgetLedger(
      budgetSnapshot.data(),
      reservation.budget_document_id.replace("llm-budget-", ""),
      storedLimit,
    );
    const next = settleBudgetReservationInLedger(
      ledger,
      reservation.id,
      reservation.model,
      usage,
      actualCostMicrousd,
      nowMs,
    );
    transaction.set(budgetRef, {
      ...next,
      updated_at: FieldValue.serverTimestamp(),
    });
    transaction.update(reservationRef, {
      status: "settled",
      actual_cost_microusd: actualCostMicrousd,
      usage,
      settled_at: FieldValue.serverTimestamp(),
    });

    if (queueRef) {
      const modelPrefix = `llm_models.${reservation.model}`;
      transaction.update(queueRef, {
        llm_call_count: FieldValue.increment(1),
        llm_input_tokens: FieldValue.increment(usage.input_tokens),
        llm_output_tokens: FieldValue.increment(usage.output_tokens),
        llm_cache_creation_input_tokens: FieldValue.increment(
          usage.cache_creation_input_tokens,
        ),
        llm_cache_read_input_tokens: FieldValue.increment(usage.cache_read_input_tokens),
        actual_cost_microusd: FieldValue.increment(actualCostMicrousd),
        actual_cost_usd: FieldValue.increment(microusdToUsd(actualCostMicrousd)),
        [`${modelPrefix}.call_count`]: FieldValue.increment(1),
        [`${modelPrefix}.input_tokens`]: FieldValue.increment(usage.input_tokens),
        [`${modelPrefix}.output_tokens`]: FieldValue.increment(usage.output_tokens),
        [`${modelPrefix}.cache_creation_input_tokens`]: FieldValue.increment(
          usage.cache_creation_input_tokens,
        ),
        [`${modelPrefix}.cache_read_input_tokens`]: FieldValue.increment(
          usage.cache_read_input_tokens,
        ),
        [`${modelPrefix}.actual_cost_microusd`]: FieldValue.increment(actualCostMicrousd),
        last_llm_call_at: FieldValue.serverTimestamp(),
      });
    }

    return {
      actual_cost_microusd: actualCostMicrousd,
      actual_cost_usd: microusdToUsd(actualCostMicrousd),
    };
  });
}

export async function settleUncertainLlmBudget(
  reservation: LlmBudgetReservation,
  reason: string,
): Promise<LlmBudgetSettlement> {
  const db = getFirestore();
  const nowMs = Date.now();
  const budgetRef = db.collection(SYSTEM_COLLECTION).doc(reservation.budget_document_id);
  const reservationRef = budgetRef.collection("reservations").doc(reservation.id);
  const queueRef = reservation.job_id
    ? db.collection(INGEST_QUEUE_COLLECTION).doc(reservation.job_id)
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
      const priorCharge = nonNegativeInteger(
        reservationData.charged_cost_microusd
          ?? reservationData.actual_cost_microusd,
      );
      return {
        actual_cost_microusd: priorCharge,
        actual_cost_usd: microusdToUsd(priorCharge),
      };
    }
    if (reservationData.status !== "reserved") {
      throw new Error(`Budget reservation ${reservation.id} is ${reservationData.status}.`);
    }
    const storedLimit = nonNegativeInteger(budgetSnapshot.data()?.limit_microusd);
    if (storedLimit <= 0) throw new Error("Daily AI budget ledger is missing its limit.");
    const ledger = normalizeBudgetLedger(
      budgetSnapshot.data(),
      reservation.budget_document_id.replace("llm-budget-", ""),
      storedLimit,
    );
    const chargedMicrousd = reservation.reserved_microusd;
    const next = chargeUncertainBudgetReservationInLedger(
      ledger,
      reservation.id,
      chargedMicrousd,
      nowMs,
    );
    transaction.set(budgetRef, {
      ...next,
      updated_at: FieldValue.serverTimestamp(),
    });
    transaction.update(reservationRef, {
      status: "uncertain",
      charged_cost_microusd: chargedMicrousd,
      uncertainty_reason: reason.slice(0, 500),
      settled_at: FieldValue.serverTimestamp(),
    });

    if (queueRef && queueSnapshot?.exists) {
      const modelPrefix = `llm_models.${reservation.model}`;
      transaction.update(queueRef, {
        llm_uncertain_call_count: FieldValue.increment(1),
        uncertain_cost_microusd: FieldValue.increment(chargedMicrousd),
        uncertain_cost_usd: FieldValue.increment(microusdToUsd(chargedMicrousd)),
        [`${modelPrefix}.uncertain_call_count`]: FieldValue.increment(1),
        [`${modelPrefix}.uncertain_cost_microusd`]: FieldValue.increment(chargedMicrousd),
        last_llm_call_at: FieldValue.serverTimestamp(),
      });
    }

    return {
      actual_cost_microusd: chargedMicrousd,
      actual_cost_usd: microusdToUsd(chargedMicrousd),
    };
  });
}
