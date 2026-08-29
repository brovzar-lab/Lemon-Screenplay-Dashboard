/**
 * Authoritative Anthropic dollar ledger.
 *
 * Every proxy call reserves its worst-case cost before Anthropic is invoked,
 * then settles that reservation to the exact token cost returned by Anthropic.
 * The Firestore transaction makes the daily ceiling safe under concurrency.
 */

import { createHash, randomUUID } from "node:crypto";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import {
  calculateActualCostMicrousd,
  calculateEstimatedCostNanousd,
  calculateHighestAllowedReservationMicrousd,
  microusdToUsd,
  nanousdToUsd,
  PRICED_MODELS,
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

export interface QueueLlmReservationMarker {
  reservation_id: string;
  budget_document_id: string;
  model: string;
  reserved_microusd: number;
  reserved_at_ms: number;
  state: "reserved_before_provider_dispatch";
}

export function buildQueueLlmReservationMarker(
  reservationId: string,
  budgetDocumentId: string,
  reservation: ActiveReservation,
  nowMs: number,
): QueueLlmReservationMarker {
  return {
    reservation_id: reservationId,
    budget_document_id: budgetDocumentId,
    model: reservation.model,
    reserved_microusd: reservation.reserved_microusd,
    reserved_at_ms: nowMs,
    state: "reserved_before_provider_dispatch",
  };
}

function queueHasReservationMarker(value: unknown, reservationId: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const reservations = (value as Record<string, unknown>).llm_active_reservations;
  return Boolean(
    reservations
    && typeof reservations === "object"
    && !Array.isArray(reservations)
    && Object.prototype.hasOwnProperty.call(reservations, reservationId),
  );
}

export interface LlmBudgetSettlement {
  actual_cost_microusd: number;
  actual_cost_usd: number;
  charged_cost_microusd: number;
  estimated_cost_nanousd: number;
  estimated_cost_usd: number;
  rounding_variance_nanousd: number;
  rounding_variance_usd: number;
  rounding_reason: "ceil_to_microusd_for_atomic_budget" | null;
}

export type LlmUncertainBudgetSettlement = Pick<
  LlmBudgetSettlement,
  "actual_cost_microusd" | "actual_cost_usd"
>;

export type LlmAccountingReasonCode =
  | "provider_transport_or_stream_failure"
  | "provider_invalid_request_before_generation"
  | "post_response_validation_or_settlement_failure";

function accountingReasonEvidence(
  reasonCode: LlmAccountingReasonCode,
  detail: string,
): { reason_code: LlmAccountingReasonCode; reason_sha256: string } {
  return {
    reason_code: reasonCode,
    reason_sha256: createHash("sha256").update(detail).digest("hex"),
  };
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

function requiredNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`Stored daily budget ${field} must be a non-negative integer.`);
  }
  return value;
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
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored daily budget model totals must be an object.");
  }
  const record = value as Record<string, unknown>;
  return {
    call_count: requiredNonNegativeInteger(record.call_count, "model call_count"),
    input_tokens: requiredNonNegativeInteger(record.input_tokens, "model input_tokens"),
    output_tokens: requiredNonNegativeInteger(record.output_tokens, "model output_tokens"),
    cache_creation_input_tokens: requiredNonNegativeInteger(
      record.cache_creation_input_tokens,
      "model cache_creation_input_tokens",
    ),
    cache_read_input_tokens: requiredNonNegativeInteger(
      record.cache_read_input_tokens,
      "model cache_read_input_tokens",
    ),
    actual_cost_microusd: requiredNonNegativeInteger(
      record.actual_cost_microusd,
      "model actual_cost_microusd",
    ),
  };
}

function readActiveReservations(value: unknown): Record<string, ActiveReservation> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored daily budget active_reservations must be an object.");
  }
  const result: Record<string, ActiveReservation> = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`Stored daily budget reservation ${id} must be an object.`);
    }
    const record = raw as Record<string, unknown>;
    const reserved = requiredNonNegativeInteger(
      record.reserved_microusd,
      `reservation ${id} reserved_microusd`,
    );
    const expires = requiredNonNegativeInteger(
      record.expires_at_ms,
      `reservation ${id} expires_at_ms`,
    );
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
      job_id: record.job_id as string | null,
    };
  }
  return result;
}

export function normalizeBudgetLedger(
  value: unknown,
  date: string,
  limitMicrousd: number,
): DailyBudgetLedger {
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
  const record = value as Record<string, unknown>;
  if (!record.by_model || typeof record.by_model !== "object" || Array.isArray(record.by_model)) {
    throw new Error("Stored daily budget by_model must be an object.");
  }
  const rawModels = record.by_model as Record<string, unknown>;
  const byModel: Record<string, ModelUsageTotals> = {};
  for (const [model, totals] of Object.entries(rawModels)) {
    byModel[model] = readModelTotals(totals);
  }
  const activeReservations = readActiveReservations(record.active_reservations);
  const ledger = {
    date,
    limit_microusd: limitMicrousd,
    spent_microusd: requiredNonNegativeInteger(record.spent_microusd, "spent_microusd"),
    reserved_microusd: requiredNonNegativeInteger(
      record.reserved_microusd,
      "reserved_microusd",
    ),
    call_count: requiredNonNegativeInteger(record.call_count, "call_count"),
    uncertain_call_count: requiredNonNegativeInteger(
      record.uncertain_call_count,
      "uncertain_call_count",
    ),
    uncertain_spend_microusd: requiredNonNegativeInteger(
      record.uncertain_spend_microusd,
      "uncertain_spend_microusd",
    ),
    input_tokens: requiredNonNegativeInteger(record.input_tokens, "input_tokens"),
    output_tokens: requiredNonNegativeInteger(record.output_tokens, "output_tokens"),
    cache_creation_input_tokens: requiredNonNegativeInteger(
      record.cache_creation_input_tokens,
      "cache_creation_input_tokens",
    ),
    cache_read_input_tokens: requiredNonNegativeInteger(
      record.cache_read_input_tokens,
      "cache_read_input_tokens",
    ),
    by_model: byModel,
    active_reservations: activeReservations,
  };
  if (ledger.reserved_microusd !== sumReserved(activeReservations)) {
    throw new Error("Stored daily budget reservations do not reconcile.");
  }
  return ledger;
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
  _nowMs: number,
): DailyBudgetLedger {
  const active = { ...ledger.active_reservations };
  const held = active[reservationId];
  if (!held) {
    throw new Error(`Budget reservation ${reservationId} is missing or expired.`);
  }
  if (actualCostMicrousd > held.reserved_microusd) {
    throw new Error("Actual cost exceeded the conservative budget reservation.");
  }
  if (
    ledger.spent_microusd
      + sumReserved(active)
      - held.reserved_microusd
      + actualCostMicrousd
      > ledger.limit_microusd
  ) {
    throw new DailyBudgetExceededError(
      ledger.limit_microusd,
      ledger.spent_microusd,
      sumReserved(active),
      actualCostMicrousd,
      nextUtcReset(new Date(_nowMs)),
    );
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
  _nowMs: number,
): DailyBudgetLedger {
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

export function releaseBudgetReservationInLedger(
  ledger: DailyBudgetLedger,
  reservationId: string,
  _nowMs: number,
): DailyBudgetLedger {
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
  const queueRef = params.jobId
    ? db.collection(INGEST_QUEUE_COLLECTION).doc(params.jobId)
    : null;
  const activeReservation: ActiveReservation = {
    reserved_microusd: calculateHighestAllowedReservationMicrousd(
      PRICED_MODELS,
      params.requestBytes,
      params.maxOutputTokens,
    ),
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
    if (
      queueRef
      && (queueSnapshot?.exists !== true || queueSnapshot.data()?.status !== "processing")
    ) {
      throw new Error(`Ingest queue job ${params.jobId} is not actively processing.`);
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
      queue_marker_written: Boolean(queueRef),
    });
    if (queueRef) {
      transaction.update(queueRef, {
        [`llm_active_reservations.${reservationId}`]: buildQueueLlmReservationMarker(
          reservationId,
          budgetDocumentId,
          activeReservation,
          nowMs,
        ),
        llm_active_reservation_count: FieldValue.increment(1),
        last_llm_reservation_at: FieldValue.serverTimestamp(),
      });
    }
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
  returnedModel: string = reservation.model,
): Promise<LlmBudgetSettlement> {
  const db = getFirestore();
  const nowMs = Date.now();
  const budgetRef = db.collection(SYSTEM_COLLECTION).doc(reservation.budget_document_id);
  const reservationRef = budgetRef.collection("reservations").doc(reservation.id);
  const queueRef = reservation.job_id
    ? db.collection(INGEST_QUEUE_COLLECTION).doc(reservation.job_id)
    : null;
  const actualCostMicrousd = calculateActualCostMicrousd(returnedModel, usage);
  const estimatedCostNanousd = calculateEstimatedCostNanousd(returnedModel, usage);
  const roundingVarianceNanousd = actualCostMicrousd * 1_000 - estimatedCostNanousd;
  const settlement: LlmBudgetSettlement = {
    actual_cost_microusd: actualCostMicrousd,
    actual_cost_usd: microusdToUsd(actualCostMicrousd),
    charged_cost_microusd: actualCostMicrousd,
    estimated_cost_nanousd: estimatedCostNanousd,
    estimated_cost_usd: nanousdToUsd(estimatedCostNanousd),
    rounding_variance_nanousd: roundingVarianceNanousd,
    rounding_variance_usd: nanousdToUsd(roundingVarianceNanousd),
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
      const settledEstimate = nonNegativeInteger(
        reservationData.estimated_cost_nanousd,
      );
      const settledVariance = nonNegativeInteger(
        reservationData.rounding_variance_nanousd,
      );
      if (settledCost * 1_000 - settledEstimate !== settledVariance) {
        throw new Error("Stored LLM settlement lacks exact cost evidence.");
      }
      return {
        actual_cost_microusd: settledCost,
        actual_cost_usd: microusdToUsd(settledCost),
        charged_cost_microusd: settledCost,
        estimated_cost_nanousd: settledEstimate,
        estimated_cost_usd: nanousdToUsd(settledEstimate),
        rounding_variance_nanousd: settledVariance,
        rounding_variance_usd: nanousdToUsd(settledVariance),
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
    if (storedLimit <= 0) throw new Error("Daily AI budget ledger is missing its limit.");
    const ledger = normalizeBudgetLedger(
      budgetSnapshot.data(),
      reservation.budget_document_id.replace("llm-budget-", ""),
      storedLimit,
    );
    const next = settleBudgetReservationInLedger(
      ledger,
      reservation.id,
      returnedModel,
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
      requested_model: reservation.model,
      returned_model: returnedModel,
      actual_cost_microusd: actualCostMicrousd,
      charged_cost_microusd: actualCostMicrousd,
      estimated_cost_nanousd: estimatedCostNanousd,
      rounding_variance_nanousd: roundingVarianceNanousd,
      rounding_reason: settlement.rounding_reason,
      usage,
      settled_at: FieldValue.serverTimestamp(),
    });

    if (queueRef) {
      const modelPrefix = `llm_models.${returnedModel}`;
      const clearMarker = queueHasReservationMarker(
        queueSnapshot?.data(),
        reservation.id,
      );
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
        ...(clearMarker ? {
          [`llm_active_reservations.${reservation.id}`]: FieldValue.delete(),
          llm_active_reservation_count: FieldValue.increment(-1),
        } : {}),
      });
    }

    return settlement;
  });
}

export async function settleUncertainLlmBudget(
  reservation: LlmBudgetReservation,
  reasonCode: LlmAccountingReasonCode,
  detail: string,
): Promise<LlmUncertainBudgetSettlement> {
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
      ...accountingReasonEvidence(reasonCode, detail),
      settled_at: FieldValue.serverTimestamp(),
    });

    if (queueRef && queueSnapshot?.exists) {
      const modelPrefix = `llm_models.${reservation.model}`;
      const clearMarker = queueHasReservationMarker(
        queueSnapshot.data(),
        reservation.id,
      );
      transaction.update(queueRef, {
        llm_uncertain_call_count: FieldValue.increment(1),
        uncertain_cost_microusd: FieldValue.increment(chargedMicrousd),
        uncertain_cost_usd: FieldValue.increment(microusdToUsd(chargedMicrousd)),
        [`${modelPrefix}.uncertain_call_count`]: FieldValue.increment(1),
        [`${modelPrefix}.uncertain_cost_microusd`]: FieldValue.increment(chargedMicrousd),
        last_llm_call_at: FieldValue.serverTimestamp(),
        ...(clearMarker ? {
          [`llm_active_reservations.${reservation.id}`]: FieldValue.delete(),
          llm_active_reservation_count: FieldValue.increment(-1),
        } : {}),
      });
    }

    return {
      actual_cost_microusd: chargedMicrousd,
      actual_cost_usd: microusdToUsd(chargedMicrousd),
    };
  });
}

export async function releaseLlmBudget(
  reservation: LlmBudgetReservation,
  reasonCode: LlmAccountingReasonCode,
  detail: string,
): Promise<void> {
  const db = getFirestore();
  const nowMs = Date.now();
  const budgetRef = db.collection(SYSTEM_COLLECTION).doc(reservation.budget_document_id);
  const reservationRef = budgetRef.collection("reservations").doc(reservation.id);
  const queueRef = reservation.job_id
    ? db.collection(INGEST_QUEUE_COLLECTION).doc(reservation.job_id)
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
    if (reservationData.status === "released") return;
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
    const next = releaseBudgetReservationInLedger(
      ledger,
      reservation.id,
      nowMs,
    );
    transaction.set(budgetRef, {
      ...next,
      updated_at: FieldValue.serverTimestamp(),
    });
    transaction.update(reservationRef, {
      status: "released",
      ...accountingReasonEvidence(reasonCode, detail),
      released_at: FieldValue.serverTimestamp(),
    });
    if (queueRef && queueSnapshot?.exists) {
      const clearMarker = queueHasReservationMarker(
        queueSnapshot.data(),
        reservation.id,
      );
      transaction.update(queueRef, {
        ...(clearMarker ? {
          [`llm_active_reservations.${reservation.id}`]: FieldValue.delete(),
          llm_active_reservation_count: FieldValue.increment(-1),
        } : {}),
        last_llm_reservation_release_at: FieldValue.serverTimestamp(),
      });
    }
  });
}
