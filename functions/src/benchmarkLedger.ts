import {
  FieldValue,
  Timestamp,
  type DocumentReference,
  type Firestore,
} from "firebase-admin/firestore";
import {
  calculateActualCostMicrousd,
  calculateEstimatedCostNanousd,
  microusdToUsd,
  nanousdToUsd,
  NANO_USD_PER_MICRO_USD,
  type LlmTokenUsage,
} from "./llmCost";
import type { BenchmarkCallContract } from "./benchmarkCandidatePolicy";
import type { BenchmarkReleaseIdentity } from "./benchmarkRelease";
import { sha256CanonicalJson } from "./anthropicProxyCore";

export const PRIOR_AUDIT_SETTLED_CALL_COUNT = 2;
export const KNOWN_PILOT_RUN_ID = "v9-pilot-20260827-69906f09-santa";
export const KNOWN_PILOT_GIT_SHA = "69906f09ddfa617e6cc6b504b9db3aeb38e2b26c";
export const KNOWN_PILOT_SPEND_MICROUSD = 106_425;

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
  ledger_status?: "settled" | "uncertain" | "rejected";
  actual_cost_microusd: number;
  actual_cost_usd: number;
  charged_cost_microusd?: number;
  estimated_cost_nanousd?: number;
  estimated_cost_usd?: number;
  rounding_variance_nanousd?: number;
  rounding_variance_usd?: number;
  rounding_reason?: string | null;
}

function storedTerminalSettlement(
  call: Record<string, unknown>,
): BenchmarkSettlement | undefined {
  if (call.status === "rejected") {
    return {
      ledger_status: "rejected",
      actual_cost_microusd: 0,
      actual_cost_usd: 0,
      charged_cost_microusd: 0,
    };
  }
  if (call.status === "uncertain") {
    const charged = requireNonNegativeInteger(
      call.charged_cost_microusd,
      "call charged_cost_microusd",
    );
    return {
      ledger_status: "uncertain",
      actual_cost_microusd: charged,
      actual_cost_usd: microusdToUsd(charged),
      charged_cost_microusd: charged,
    };
  }
  if (call.status !== "settled") return undefined;
  const actual = requireNonNegativeInteger(
    call.actual_cost_microusd,
    "call actual_cost_microusd",
  );
  const estimated = requireNonNegativeInteger(
    call.estimated_cost_nanousd,
    "call estimated_cost_nanousd",
  );
  const variance = requireNonNegativeInteger(
    call.rounding_variance_nanousd,
    "call rounding_variance_nanousd",
  );
  return {
    ledger_status: "settled",
    actual_cost_microusd: actual,
    actual_cost_usd: microusdToUsd(actual),
    charged_cost_microusd: actual,
    estimated_cost_nanousd: estimated,
    estimated_cost_usd: nanousdToUsd(estimated),
    rounding_variance_nanousd: variance,
    rounding_variance_usd: nanousdToUsd(variance),
    rounding_reason: variance === 0
      ? null : "ceil_to_microusd_for_atomic_budget",
  };
}

async function recoverTerminalSettlement(
  callRef: DocumentReference,
  allowed: ReadonlySet<BenchmarkSettlement["ledger_status"]>,
  originalError: unknown,
): Promise<BenchmarkSettlement> {
  try {
    const snapshot = await callRef.get();
    const terminal = snapshot.exists
      ? storedTerminalSettlement(snapshot.data() ?? {})
      : undefined;
    if (terminal && allowed.has(terminal.ledger_status)) return terminal;
  } catch {
    // Preserve the original mutation error when its terminal state cannot be proven.
  }
  throw originalError;
}

export interface BenchmarkFailureEvidence {
  validation_failure_code: string;
  validation_failure_reason: string;
  provider_error_sha256?: string;
  settlement_error_sha256?: string;
  configuration_error_sha256?: string;
}

export interface BenchmarkUncertainEvidence extends BenchmarkFailureEvidence {
  returned_model?: string;
  response_id?: string;
  stop_reason?: string | null;
  provider_usage?: LlmTokenUsage | Record<string, unknown> | null;
  provider_usage_validation?: "unverified" | "unavailable_transport";
}

export function releasedBeforeGenerationCallUpdate(
  reservation: BenchmarkReservation,
  evidence: BenchmarkFailureEvidence,
  rejectionKind: string,
): Record<string, unknown> {
  return {
    status: "rejected",
    rejection_kind: rejectionKind,
    reservation_ceiling_microusd: reservation.reserved_microusd,
    reserved_microusd: 0,
    returned_model: null,
    response_id: null,
    stop_reason: null,
    provider_usage: null,
    provider_usage_validation: "not_generated",
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
    actual_cost_microusd: 0,
    charged_cost_microusd: 0,
    estimated_cost_nanousd: 0,
    rounding_variance_nanousd: 0,
    rounding_reason: null,
    disposition: "released_before_generation",
    downstream_consumption: "not_consumed",
    ...evidence,
  };
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
  constructor(
    readonly status: string,
    readonly existingCostMicrousd: number | null,
  ) {
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
      || prior.schema_bundle_sha256 !== contract.schema_bundle_sha256
      || prior.prompt_sha256 !== contract.prompt_sha256
      || prior.schema_mode !== contract.schema_mode
      || prior.schema_sha256 !== contract.schema_sha256
      || prior.transport_schema_sha256 !== contract.transport_schema_sha256) {
    throw new BenchmarkCallConflictError();
  }
  const existingCost = prior.actual_cost_microusd;
  throw new BenchmarkDuplicateCallError(
    String(prior.status ?? "unknown"),
    typeof existingCost === "number" && Number.isInteger(existingCost)
      && existingCost >= 0 ? existingCost : null,
  );
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`Stored benchmark ${field} must be a non-negative integer.`);
  }
  return value;
}

export function normalizeBenchmarkRunLedger(
  value: unknown,
  limitMicrousd: number,
): BenchmarkRunLedger {
  if (value === undefined) {
    return {
      limit_microusd: limitMicrousd,
      spent_microusd: 0,
      reserved_microusd: 0,
      call_count: 0,
      uncertain_call_count: 0,
      uncertain_spend_microusd: 0,
    };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored benchmark run ledger must be an object.");
  }
  const record = value as Record<string, unknown>;
  return {
    limit_microusd: limitMicrousd,
    spent_microusd: requireNonNegativeInteger(record.spent_microusd, "spent_microusd"),
    reserved_microusd: requireNonNegativeInteger(record.reserved_microusd, "reserved_microusd"),
    call_count: requireNonNegativeInteger(record.call_count, "call_count"),
    uncertain_call_count: requireNonNegativeInteger(
      record.uncertain_call_count,
      "uncertain_call_count",
    ),
    uncertain_spend_microusd: requireNonNegativeInteger(
      record.uncertain_spend_microusd,
      "uncertain_spend_microusd",
    ),
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

export interface ImmutableRunConfig {
  runId: string;
  limitMicrousd: number;
  auditId: string;
  auditLimitMicrousd: number;
  priorAuditSpendMicrousd: number;
  release: BenchmarkReleaseIdentity;
}

export function normalizeBenchmarkAuditLedger(
  value: unknown,
  config: ImmutableRunConfig,
  isNewRun: boolean,
  canBootstrap = isNewRun,
): BenchmarkRunLedger {
  if (value === undefined) {
    if (!canBootstrap) {
      throw new Error("Cumulative benchmark audit ledger is missing after benchmark activity exists.");
    }
    if (!Number.isInteger(config.priorAuditSpendMicrousd)
        || config.priorAuditSpendMicrousd !== KNOWN_PILOT_SPEND_MICROUSD) {
      throw new Error("Prior audit spend must equal the exact settled pilot cost.");
    }
    return {
      ...normalizeBenchmarkRunLedger(undefined, config.auditLimitMicrousd),
      spent_microusd: config.priorAuditSpendMicrousd,
      call_count: PRIOR_AUDIT_SETTLED_CALL_COUNT,
    };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored benchmark audit ledger must be an object.");
  }
  const record = value as Record<string, unknown>;
  if (record.audit_id !== config.auditId
      || record.limit_microusd !== config.auditLimitMicrousd) {
    throw new Error("Stored benchmark audit configuration does not match this deployment.");
  }
  const ledger = normalizeBenchmarkRunLedger(record, config.auditLimitMicrousd);
  if (isNewRun && (
    ledger.reserved_microusd !== 0
    || ledger.spent_microusd !== config.priorAuditSpendMicrousd
    || ledger.call_count < PRIOR_AUDIT_SETTLED_CALL_COUNT
  )) {
    throw new Error(
      "A new benchmark run must declare the exact cumulative settled and uncertain spend.",
    );
  }
  return ledger;
}

export function hasExactKnownPilotEvidence(
  runValue: unknown,
  calls: readonly Record<string, unknown>[],
): boolean {
  if (!runValue || typeof runValue !== "object" || Array.isArray(runValue)) return false;
  const run = runValue as Record<string, unknown>;
  return (
    run.run_id === KNOWN_PILOT_RUN_ID
    && run.git_sha === KNOWN_PILOT_GIT_SHA
    && run.spent_microusd === KNOWN_PILOT_SPEND_MICROUSD
    && run.reserved_microusd === 0
    && run.call_count === PRIOR_AUDIT_SETTLED_CALL_COUNT
    && run.uncertain_call_count === 0
    && run.uncertain_spend_microusd === 0
    && calls.length === PRIOR_AUDIT_SETTLED_CALL_COUNT
    && calls.every((call) => (
      call.status === "settled"
      && call.returned_model === "claude-haiku-4-5-20251001"
      && typeof call.actual_cost_microusd === "number"
      && Number.isInteger(call.actual_cost_microusd)
      && call.actual_cost_microusd >= 0
    ))
    && calls.reduce(
      (total, call) => total + Number(call.actual_cost_microusd),
      0,
    ) === KNOWN_PILOT_SPEND_MICROUSD
  );
}

export function validateStoredRun(
  value: Record<string, unknown>,
  config: ImmutableRunConfig,
): void {
  const releaseSha256 = sha256CanonicalJson(config.release);
  if (value.run_id !== config.runId
      || value.limit_microusd !== config.limitMicrousd
      || value.release_sha256 !== releaseSha256
      || sha256CanonicalJson(value.release) !== releaseSha256) {
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
  const existingRuns = db.collection("model_benchmark_runs").limit(2);
  const pilotRunRef = db.collection("model_benchmark_runs").doc(KNOWN_PILOT_RUN_ID);
  const pilotCalls = pilotRunRef.collection("calls").limit(3);
  const auditRef = db.collection("model_benchmark_audits").doc(config.auditId);
  const callRef = runRef.collection("calls").doc(contract.call_id);
  await db.runTransaction(async (transaction) => {
    const [
      runSnapshot,
      auditSnapshot,
      callSnapshot,
      existingRunsSnapshot,
      pilotRunSnapshot,
      pilotCallsSnapshot,
    ] = await Promise.all([
      transaction.get(runRef),
      transaction.get(auditRef),
      transaction.get(callRef),
      transaction.get(existingRuns),
      transaction.get(pilotRunRef),
      transaction.get(pilotCalls),
    ]);
    if (callSnapshot.exists) {
      rejectExistingBenchmarkCall(callSnapshot.data() ?? {}, contract);
    }
    const priorRun = runSnapshot.exists ? runSnapshot.data() ?? {} : undefined;
    if (runSnapshot.exists) validateStoredRun(priorRun ?? {}, config);
    const ledger = normalizeBenchmarkRunLedger(priorRun, config.limitMicrousd);
    const next = admitBenchmarkReservation(ledger, reservedMicrousd);
    const audit = normalizeBenchmarkAuditLedger(
      auditSnapshot.exists ? auditSnapshot.data() ?? {} : undefined,
      config,
      !runSnapshot.exists,
      !runSnapshot.exists && (
        existingRunsSnapshot.docs.length === 1
        && existingRunsSnapshot.docs[0].id === KNOWN_PILOT_RUN_ID
        && hasExactKnownPilotEvidence(
          pilotRunSnapshot.exists ? pilotRunSnapshot.data() : undefined,
          pilotCallsSnapshot.docs.map((snapshot) => snapshot.data()),
        )
      ),
    );
    const nextAudit = admitBenchmarkReservation(audit, reservedMicrousd);
    transaction.set(runRef, {
      ...next,
      run_id: config.runId,
      release: config.release,
      release_sha256: sha256CanonicalJson(config.release),
      updated_at: FieldValue.serverTimestamp(),
      ...(runSnapshot.exists ? {} : { created_at: FieldValue.serverTimestamp() }),
    });
    transaction.set(auditRef, {
      ...nextAudit,
      audit_id: config.auditId,
      updated_at: FieldValue.serverTimestamp(),
      ...(auditSnapshot.exists ? {} : { created_at: FieldValue.serverTimestamp() }),
    });
    transaction.create(callRef, {
      ...contract,
      status: "in_progress",
      reserved_microusd: reservedMicrousd,
      reservation_ceiling_microusd: reservedMicrousd,
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
  const estimatedCostNanousd = calculateEstimatedCostNanousd(returnedModel, usage);
  const roundingVarianceNanousd = (
    actualCostMicrousd * NANO_USD_PER_MICRO_USD - estimatedCostNanousd
  );
  const settlement = {
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
  const runRef = db.collection("model_benchmark_runs").doc(config.runId);
  const auditRef = db.collection("model_benchmark_audits").doc(config.auditId);
  const callRef = runRef.collection("calls").doc(reservation.call_id);
  try {
    return await db.runTransaction(async (transaction) => {
    const [runSnapshot, auditSnapshot, callSnapshot] = await Promise.all([
      transaction.get(runRef),
      transaction.get(auditRef),
      transaction.get(callRef),
    ]);
    if (!runSnapshot.exists || !auditSnapshot.exists || !callSnapshot.exists) {
      throw new Error("Benchmark reservation is missing.");
    }
    const call = callSnapshot.data() ?? {};
    if (call.status === "settled") {
      return storedTerminalSettlement(call) as BenchmarkSettlement;
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
    const nextAudit = settleBenchmarkReservation(
      normalizeBenchmarkAuditLedger(auditSnapshot.data() ?? {}, config, false),
      reservation.reserved_microusd,
      actualCostMicrousd,
    );
    transaction.update(runRef, { ...next, updated_at: FieldValue.serverTimestamp() });
    transaction.update(auditRef, {
      ...nextAudit,
      updated_at: FieldValue.serverTimestamp(),
    });
    transaction.update(callRef, {
      status: "settled",
      reserved_microusd: 0,
      returned_model: returnedModel,
      response_id: responseId,
      stop_reason: stopReason,
      usage,
      actual_cost_microusd: actualCostMicrousd,
      charged_cost_microusd: actualCostMicrousd,
      estimated_cost_nanousd: estimatedCostNanousd,
      rounding_variance_nanousd: roundingVarianceNanousd,
      rounding_reason: settlement.rounding_reason,
      settled_at: FieldValue.serverTimestamp(),
    });
      return { ...settlement, ledger_status: "settled" };
    });
  } catch (error) {
    return recoverTerminalSettlement(callRef, new Set(["settled"]), error);
  }
}

export async function markBenchmarkCallUncertain(
  db: Firestore,
  config: ImmutableRunConfig,
  reservation: BenchmarkReservation,
  reason: "provider_error" | "response_lost" | "settlement_error",
  evidence?: BenchmarkUncertainEvidence,
): Promise<BenchmarkSettlement> {
  const runRef = db.collection("model_benchmark_runs").doc(config.runId);
  const auditRef = db.collection("model_benchmark_audits").doc(config.auditId);
  const callRef = runRef.collection("calls").doc(reservation.call_id);
  try {
    return await db.runTransaction(async (transaction) => {
    const [runSnapshot, auditSnapshot, callSnapshot] = await Promise.all([
      transaction.get(runRef), transaction.get(auditRef), transaction.get(callRef),
    ]);
    if (!runSnapshot.exists || !auditSnapshot.exists || !callSnapshot.exists) {
      throw new Error("Benchmark reservation is missing.");
    }
    const call = callSnapshot.data() ?? {};
    if (["settled", "uncertain", "rejected"].includes(String(call.status))) {
      return storedTerminalSettlement(call) as BenchmarkSettlement;
    }
    if (call.status !== "in_progress") throw new Error(`Benchmark reservation is ${String(call.status)}.`);
    const run = runSnapshot.data() ?? {};
    validateStoredRun(run, config);
    const next = chargeUncertainBenchmarkReservation(
      normalizeBenchmarkRunLedger(run, config.limitMicrousd),
      reservation.reserved_microusd,
    );
    const nextAudit = chargeUncertainBenchmarkReservation(
      normalizeBenchmarkAuditLedger(auditSnapshot.data() ?? {}, config, false),
      reservation.reserved_microusd,
    );
    transaction.update(runRef, { ...next, updated_at: FieldValue.serverTimestamp() });
    transaction.update(auditRef, {
      ...nextAudit,
      updated_at: FieldValue.serverTimestamp(),
    });
    transaction.update(callRef, {
      status: "uncertain",
      reserved_microusd: 0,
      reservation_ceiling_microusd: reservation.reserved_microusd,
      charged_cost_microusd: reservation.reserved_microusd,
      uncertainty_reason: reason,
      ...(evidence ?? {}),
      settled_at: FieldValue.serverTimestamp(),
    });
    return {
      ledger_status: "uncertain",
      actual_cost_microusd: reservation.reserved_microusd,
      actual_cost_usd: microusdToUsd(reservation.reserved_microusd),
      charged_cost_microusd: reservation.reserved_microusd,
    };
    });
  } catch (error) {
    return recoverTerminalSettlement(
      callRef,
      new Set(["settled", "uncertain", "rejected"]),
      error,
    );
  }
}

export async function rejectBenchmarkCallBeforeGeneration(
  db: Firestore,
  config: ImmutableRunConfig,
  reservation: BenchmarkReservation,
  evidence: BenchmarkFailureEvidence,
  rejectionKind = "anthropic_invalid_request_before_generation",
): Promise<void> {
  const runRef = db.collection("model_benchmark_runs").doc(config.runId);
  const auditRef = db.collection("model_benchmark_audits").doc(config.auditId);
  const callRef = runRef.collection("calls").doc(reservation.call_id);
  try {
    await db.runTransaction(async (transaction) => {
      const [runSnapshot, auditSnapshot, callSnapshot] = await Promise.all([
        transaction.get(runRef), transaction.get(auditRef), transaction.get(callRef),
      ]);
      if (!runSnapshot.exists || !auditSnapshot.exists || !callSnapshot.exists) {
        throw new Error("Benchmark reservation is missing.");
      }
      const call = callSnapshot.data() ?? {};
      if (call.status === "rejected") return;
      if (call.status !== "in_progress") {
        throw new Error(`Benchmark reservation is ${String(call.status)}.`);
      }
      const run = runSnapshot.data() ?? {};
      validateStoredRun(run, config);
      const next = releaseBenchmarkReservation(
        normalizeBenchmarkRunLedger(run, config.limitMicrousd),
        reservation.reserved_microusd,
      );
      const nextAudit = releaseBenchmarkReservation(
        normalizeBenchmarkAuditLedger(auditSnapshot.data() ?? {}, config, false),
        reservation.reserved_microusd,
      );
      transaction.update(runRef, { ...next, updated_at: FieldValue.serverTimestamp() });
      transaction.update(auditRef, {
        ...nextAudit,
        updated_at: FieldValue.serverTimestamp(),
      });
      transaction.update(callRef, {
        ...releasedBeforeGenerationCallUpdate(
          reservation,
          evidence,
          rejectionKind,
        ),
        settled_at: FieldValue.serverTimestamp(),
      });
    });
  } catch (error) {
    await recoverTerminalSettlement(callRef, new Set(["rejected"]), error);
  }
}
