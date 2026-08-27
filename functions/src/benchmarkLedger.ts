import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { calculateActualCostMicrousd, microusdToUsd, type LlmTokenUsage } from "./llmCost";
import type { BenchmarkCallContract } from "./benchmarkCandidatePolicy";
import type { BenchmarkReleaseIdentity } from "./benchmarkRelease";

export interface BenchmarkRunLedger {
  limit_microusd: number;
  spent_microusd: number;
  reserved_microusd: number;
  call_count: number;
  uncertain_call_count: number;
  uncertain_spend_microusd: number;
}

export interface BenchmarkReservation {
  run_id: string;
  call_id: string;
  requested_model: string;
  reserved_microusd: number;
}

export interface BenchmarkSettlement {
  actual_cost_microusd: number;
  actual_cost_usd: number;
}

export class BenchmarkCapExceededError extends Error {
  readonly code = "BENCHMARK_CAP_EXCEEDED";
  constructor(readonly ledger: BenchmarkRunLedger, readonly requestedMicrousd: number) {
    super("The immutable benchmark run cost cap is exhausted.");
    this.name = "BenchmarkCapExceededError";
  }
}

export class BenchmarkDuplicateCallError extends Error {
  readonly code = "BENCHMARK_DUPLICATE_CALL";
  constructor(readonly status: string) {
    super(`Call ID already exists with status ${status}; Anthropic was not called again.`);
    this.name = "BenchmarkDuplicateCallError";
  }
}

export class BenchmarkCallConflictError extends Error {
  readonly code = "BENCHMARK_CALL_CONFLICT";
  constructor() {
    super("Call ID was reused with different request hashes.");
    this.name = "BenchmarkCallConflictError";
  }
}

export function rejectExistingBenchmarkCall(
  prior: Record<string, unknown>,
  contract: BenchmarkCallContract,
): never {
  if (prior.request_sha256 !== contract.request_sha256
      || prior.prompt_bundle_sha256 !== contract.prompt_bundle_sha256
      || prior.structured_output_schema_sha256
        !== contract.structured_output_schema_sha256) {
    throw new BenchmarkCallConflictError();
  }
  throw new BenchmarkDuplicateCallError(String(prior.status ?? "unknown"));
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function normalizeBenchmarkRunLedger(
  value: unknown,
  limitMicrousd: number,
): BenchmarkRunLedger {
  const record = value && typeof value === "object"
    ? value as Record<string, unknown>
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

export function admitBenchmarkReservation(
  ledger: BenchmarkRunLedger,
  reservedMicrousd: number,
): BenchmarkRunLedger {
  if (!Number.isInteger(reservedMicrousd) || reservedMicrousd <= 0) {
    throw new Error("Benchmark reservation must be a positive integer.");
  }
  if (ledger.spent_microusd + ledger.reserved_microusd + reservedMicrousd
      > ledger.limit_microusd) {
    throw new BenchmarkCapExceededError(ledger, reservedMicrousd);
  }
  return { ...ledger, reserved_microusd: ledger.reserved_microusd + reservedMicrousd };
}

export function settleBenchmarkReservation(
  ledger: BenchmarkRunLedger,
  reservedMicrousd: number,
  actualCostMicrousd: number,
): BenchmarkRunLedger {
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

export function chargeUncertainBenchmarkReservation(
  ledger: BenchmarkRunLedger,
  reservedMicrousd: number,
): BenchmarkRunLedger {
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

export function releaseBenchmarkReservation(
  ledger: BenchmarkRunLedger,
  reservedMicrousd: number,
): BenchmarkRunLedger {
  if (!Number.isInteger(reservedMicrousd)
      || reservedMicrousd <= 0
      || reservedMicrousd > ledger.reserved_microusd) {
    throw new Error("Benchmark reservation is not fully held by the ledger.");
  }
  return { ...ledger, reserved_microusd: ledger.reserved_microusd - reservedMicrousd };
}

interface ImmutableRunConfig {
  runId: string;
  limitMicrousd: number;
  release: BenchmarkReleaseIdentity;
}

function validateStoredRun(
  value: Record<string, unknown>,
  config: ImmutableRunConfig,
): void {
  if (value.run_id !== config.runId
      || value.limit_microusd !== config.limitMicrousd
      || value.git_sha !== config.release.git_sha
      || value.catalog_sha256 !== config.release.catalog_sha256
      || value.deployment_config_sha256 !== config.release.deployment_config_sha256) {
    throw new Error("Stored benchmark run configuration does not match this deployment.");
  }
}

export async function reserveBenchmarkCall(
  db: Firestore,
  config: ImmutableRunConfig,
  contract: BenchmarkCallContract,
  reservedMicrousd: number,
): Promise<BenchmarkReservation> {
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
    if (runSnapshot.exists) validateStoredRun(priorRun, config);
    const ledger = normalizeBenchmarkRunLedger(priorRun, config.limitMicrousd);
    const next = admitBenchmarkReservation(ledger, reservedMicrousd);
    transaction.set(runRef, {
      ...next,
      run_id: config.runId,
      git_sha: config.release.git_sha,
      catalog_sha256: config.release.catalog_sha256,
      deployment_config_sha256: config.release.deployment_config_sha256,
      updated_at: FieldValue.serverTimestamp(),
      ...(runSnapshot.exists ? {} : { created_at: FieldValue.serverTimestamp() }),
    });
    transaction.create(callRef, {
      ...contract,
      status: "in_progress",
      reserved_microusd: reservedMicrousd,
      release: config.release,
      created_at: Timestamp.now(),
    });
  });
  return {
    run_id: config.runId,
    call_id: contract.call_id,
    requested_model: contract.requested_model,
    reserved_microusd: reservedMicrousd,
  };
}

export async function settleBenchmarkCall(
  db: Firestore,
  config: ImmutableRunConfig,
  reservation: BenchmarkReservation,
  usage: LlmTokenUsage,
  returnedModel: string,
  responseId: string,
  stopReason: string | null,
): Promise<BenchmarkSettlement> {
  const actualCostMicrousd = calculateActualCostMicrousd(returnedModel, usage);
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
      return { actual_cost_microusd: priorCost, actual_cost_usd: microusdToUsd(priorCost) };
    }
    if (call.status !== "in_progress") {
      throw new Error(`Benchmark reservation is ${String(call.status)}.`);
    }
    const run = runSnapshot.data() ?? {};
    validateStoredRun(run, config);
    const next = settleBenchmarkReservation(
      normalizeBenchmarkRunLedger(run, config.limitMicrousd),
      reservation.reserved_microusd,
      actualCostMicrousd,
    );
    transaction.update(runRef, { ...next, updated_at: FieldValue.serverTimestamp() });
    transaction.update(callRef, {
      status: "settled",
      returned_model: returnedModel,
      response_id: responseId,
      stop_reason: stopReason,
      usage,
      actual_cost_microusd: actualCostMicrousd,
      settled_at: FieldValue.serverTimestamp(),
    });
    return {
      actual_cost_microusd: actualCostMicrousd,
      actual_cost_usd: microusdToUsd(actualCostMicrousd),
    };
  });
}

export async function markBenchmarkCallUncertain(
  db: Firestore,
  config: ImmutableRunConfig,
  reservation: BenchmarkReservation,
  reason: "provider_error" | "response_lost" | "settlement_error",
): Promise<BenchmarkSettlement> {
  const runRef = db.collection("model_benchmark_runs").doc(config.runId);
  const callRef = runRef.collection("calls").doc(reservation.call_id);
  return db.runTransaction(async (transaction) => {
    const [runSnapshot, callSnapshot] = await Promise.all([
      transaction.get(runRef), transaction.get(callRef),
    ]);
    if (!runSnapshot.exists || !callSnapshot.exists) throw new Error("Benchmark reservation is missing.");
    const call = callSnapshot.data() ?? {};
    if (call.status === "settled" || call.status === "uncertain") {
      const priorCost = nonNegativeInteger(
        call.actual_cost_microusd ?? call.charged_cost_microusd,
      );
      return { actual_cost_microusd: priorCost, actual_cost_usd: microusdToUsd(priorCost) };
    }
    if (call.status !== "in_progress") throw new Error(`Benchmark reservation is ${String(call.status)}.`);
    const run = runSnapshot.data() ?? {};
    validateStoredRun(run, config);
    const next = chargeUncertainBenchmarkReservation(
      normalizeBenchmarkRunLedger(run, config.limitMicrousd),
      reservation.reserved_microusd,
    );
    transaction.update(runRef, { ...next, updated_at: FieldValue.serverTimestamp() });
    transaction.update(callRef, {
      status: "uncertain",
      charged_cost_microusd: reservation.reserved_microusd,
      uncertainty_reason: reason,
      settled_at: FieldValue.serverTimestamp(),
    });
    return {
      actual_cost_microusd: reservation.reserved_microusd,
      actual_cost_usd: microusdToUsd(reservation.reserved_microusd),
    };
  });
}

export async function rejectBenchmarkCallBeforeGeneration(
  db: Firestore,
  config: ImmutableRunConfig,
  reservation: BenchmarkReservation,
): Promise<void> {
  const runRef = db.collection("model_benchmark_runs").doc(config.runId);
  const callRef = runRef.collection("calls").doc(reservation.call_id);
  await db.runTransaction(async (transaction) => {
    const [runSnapshot, callSnapshot] = await Promise.all([
      transaction.get(runRef), transaction.get(callRef),
    ]);
    if (!runSnapshot.exists || !callSnapshot.exists) throw new Error("Benchmark reservation is missing.");
    const call = callSnapshot.data() ?? {};
    if (call.status === "rejected") return;
    if (call.status !== "in_progress") throw new Error(`Benchmark reservation is ${String(call.status)}.`);
    const run = runSnapshot.data() ?? {};
    validateStoredRun(run, config);
    const next = releaseBenchmarkReservation(
      normalizeBenchmarkRunLedger(run, config.limitMicrousd),
      reservation.reserved_microusd,
    );
    transaction.update(runRef, { ...next, updated_at: FieldValue.serverTimestamp() });
    transaction.update(callRef, {
      status: "rejected",
      rejection_kind: "anthropic_invalid_request_before_generation",
      settled_at: FieldValue.serverTimestamp(),
    });
  });
}
