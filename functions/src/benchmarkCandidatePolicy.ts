import { sha256CanonicalJson } from "./anthropicProxyCore";

export const BENCHMARK_DATABASE_ID = "model-benchmarks";
export const MAX_BENCHMARK_CAP_USD = 40;
export const PRIOR_AUDIT_SPEND_MICROUSD = 106_425;
export const BENCHMARK_AUDIT_ID = "v9-trust-remediation-20260827";
export const BENCHMARK_AUDIT_LIMIT_MICROUSD = 40_000_000;
export const BENCHMARK_MODELS = [
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6",
  "claude-sonnet-5",
  "claude-opus-4-7",
  "claude-opus-5",
] as const;

type BenchmarkModel = typeof BENCHMARK_MODELS[number];
export type BenchmarkRoute = "sonnet" | "opus" | "hybrid";
export type BenchmarkGeneration = "old" | "candidate";
export type BenchmarkSchemaMode = "schema_free" | "strict_tool" | "compact_strict_tool";

export interface BenchmarkCallContract {
  run_id: string;
  call_id: string;
  screenplay_sha256: string;
  route: BenchmarkRoute;
  generation: BenchmarkGeneration;
  pipeline_stage: string;
  pipeline_pass: string;
  reader_name: string | null;
  retry_number: number;
  boundary_run: number;
  prompt_bundle_sha256: string;
  schema_bundle_sha256: string;
  prompt_sha256: string;
  schema_mode: BenchmarkSchemaMode;
  schema_sha256: string | null;
  transport_schema_sha256: string | null;
  request_sha256: string;
  requested_model: string;
}

export interface BenchmarkPayloadEvidence {
  request_sha256: string;
  prompt_sha256: string;
  schema_mode: BenchmarkSchemaMode;
  schema_sha256: string | null;
  transport_schema_sha256: string | null;
}

export class BenchmarkContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BenchmarkContractError";
  }
}

export function parseBenchmarkCapUsd(value: string): number {
  if (!/^[0-9]+(?:\.[0-9]{1,6})?$/.test(value)) {
    throw new BenchmarkContractError(
      `BENCHMARK_CAP_USD must be between 0 and ${MAX_BENCHMARK_CAP_USD}.`,
    );
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_BENCHMARK_CAP_USD) {
    throw new BenchmarkContractError(
      `BENCHMARK_CAP_USD must be between 0 and ${MAX_BENCHMARK_CAP_USD}.`,
    );
  }
  return parsed;
}

export function assertBenchmarkAuditBudget(
  capMicrousd: number,
  priorSpendMicrousd: number,
): void {
  if (!Number.isInteger(priorSpendMicrousd)
      || priorSpendMicrousd < PRIOR_AUDIT_SPEND_MICROUSD) {
    throw new BenchmarkContractError(
      "Prior audit spend must include the settled pilot cost.",
    );
  }
  if (!Number.isInteger(capMicrousd) || capMicrousd <= 0
      || capMicrousd + priorSpendMicrousd > BENCHMARK_AUDIT_LIMIT_MICROUSD) {
    throw new BenchmarkContractError(
      "Prior spend plus this run cap exceeds the authorized audit ceiling.",
    );
  }
}

const SHA256 = /^[a-f0-9]{64}$/;
const OPAQUE_RUN_ID = /^(?:[a-f0-9]{64}|[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/;
const SAFE_STAGE = /^[a-z0-9_-]{1,64}$/;
const CLAIM_BATCH = /^batch_([0-9]{3})_of_([0-9]{3})$/;
const READERS = new Set([
  "structure", "character", "craft_scene", "concept", "emotional_resonance",
]);
const NON_BINDING_STAGES = new Set(["triage", "genre_detection", "cold_read", "smoke"]);

export function isOpaqueBenchmarkRunId(value: unknown): value is string {
  return typeof value === "string" && OPAQUE_RUN_ID.test(value);
}

function validCallLineage(stage: string, readerName: unknown): boolean {
  if (stage === "reader") {
    return typeof readerName === "string" && READERS.has(readerName);
  }
  if (stage !== "claim_verification") return readerName === null;
  if (typeof readerName !== "string") return false;
  const match = CLAIM_BATCH.exec(readerName);
  if (!match) return false;
  const index = Number(match[1]);
  const total = Number(match[2]);
  return index >= 1 && index <= total;
}

function requireSha(value: unknown, field: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw new BenchmarkContractError(`${field} must be a lowercase SHA-256 hash.`);
  }
  return value;
}

function expectedRouteModels(
  route: BenchmarkRoute,
  generation: BenchmarkGeneration,
): ReadonlySet<string> {
  const sonnet = generation === "old" ? "claude-sonnet-4-6" : "claude-sonnet-5";
  const opus = generation === "old" ? "claude-opus-4-7" : "claude-opus-5";
  if (route === "sonnet") return new Set([sonnet]);
  if (route === "opus") return new Set([opus]);
  return new Set([sonnet, opus]);
}

export function deriveBenchmarkCallId(
  contract: Omit<BenchmarkCallContract, "call_id">,
): string {
  return sha256CanonicalJson(contract);
}

export function deriveBenchmarkPayloadEvidence(
  payload: Record<string, unknown>,
): BenchmarkPayloadEvidence {
  const requestSha256 = sha256CanonicalJson(payload);
  const promptEnvelope: Record<string, unknown> = {};
  for (const field of [
    "system", "messages", "tools", "tool_choice", "thinking", "output_config",
  ]) {
    if (payload[field] !== undefined) promptEnvelope[field] = payload[field];
  }
  const promptSha256 = sha256CanonicalJson(promptEnvelope);
  const tools = payload.tools;
  if (tools === undefined) {
    return {
      request_sha256: requestSha256,
      prompt_sha256: promptSha256,
      schema_mode: "schema_free",
      schema_sha256: null,
      transport_schema_sha256: null,
    };
  }
  if (!Array.isArray(tools) || tools.length !== 1) {
    throw new BenchmarkContractError("Benchmark requests must use exactly one strict tool.");
  }
  const tool = tools[0];
  if (!tool || typeof tool !== "object" || Array.isArray(tool)) {
    throw new BenchmarkContractError("Benchmark tool definition is invalid.");
  }
  const record = tool as Record<string, unknown>;
  if (record.strict !== true
      || !record.input_schema
      || typeof record.input_schema !== "object"
      || Array.isArray(record.input_schema)) {
    throw new BenchmarkContractError("Benchmark tool must carry a strict input schema.");
  }
  const transportSchema = record.input_schema as Record<string, unknown>;
  const transportSchemaSha256 = sha256CanonicalJson(transportSchema);
  const properties = transportSchema.properties;
  const applicationBinding = properties
      && typeof properties === "object"
      && !Array.isArray(properties)
    ? (properties as Record<string, unknown>).application_schema_sha256
    : undefined;
  if (applicationBinding !== undefined) {
    const binding = applicationBinding as Record<string, unknown>;
    const values = binding && Array.isArray(binding.enum) ? binding.enum : [];
    if (values.length !== 1 || typeof values[0] !== "string" || !SHA256.test(values[0])) {
      throw new BenchmarkContractError(
        "Compact benchmark schema must bind one application schema fingerprint.",
      );
    }
    return {
      request_sha256: requestSha256,
      prompt_sha256: promptSha256,
      schema_mode: "compact_strict_tool",
      schema_sha256: values[0],
      transport_schema_sha256: transportSchemaSha256,
    };
  }
  return {
    request_sha256: requestSha256,
    prompt_sha256: promptSha256,
    schema_mode: "strict_tool",
    schema_sha256: transportSchemaSha256,
    transport_schema_sha256: transportSchemaSha256,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function isTargetedCorrectionPayload(
  payload: Record<string, unknown>,
  expectedToolName: string,
): boolean {
  const tools = payload.tools;
  const tool = Array.isArray(tools) && tools.length === 1 && isRecord(tools[0])
    ? tools[0] : null;
  const choice = isRecord(payload.tool_choice) ? payload.tool_choice : null;
  const schema = tool && isRecord(tool.input_schema) ? tool.input_schema : null;
  const properties = schema && isRecord(schema.properties) ? schema.properties : null;
  const sourceHash = properties && isRecord(properties.source_report_sha256)
    ? properties.source_report_sha256 : null;
  const repairs = properties && isRecord(properties.repairs) ? properties.repairs : null;
  const repairProperties = repairs && isRecord(repairs.properties)
    ? repairs.properties : null;
  const repairKeys = repairProperties ? Object.keys(repairProperties).sort() : [];
  const requiredRepairs = repairs && Array.isArray(repairs.required)
    ? [...repairs.required].sort() : [];
  return Boolean(
    tool
    && hasExactKeys(tool, ["name", "description", "strict", "input_schema"])
    && tool.name === expectedToolName
    && typeof tool.description === "string"
    && tool.strict === true
    && choice
    && hasExactKeys(choice, ["type", "name"])
    && choice.type === "tool"
    && choice.name === expectedToolName
    && schema
    && hasExactKeys(schema, ["type", "properties", "required", "additionalProperties"])
    && schema.type === "object"
    && schema.additionalProperties === false
    && Array.isArray(schema.required)
    && JSON.stringify([...schema.required].sort())
      === JSON.stringify(["repairs", "source_report_sha256"])
    && properties
    && hasExactKeys(properties, ["source_report_sha256", "repairs"])
    && sourceHash
    && hasExactKeys(sourceHash, ["type", "enum"])
    && sourceHash.type === "string"
    && Array.isArray(sourceHash.enum)
    && sourceHash.enum.length === 1
    && typeof sourceHash.enum[0] === "string"
    && SHA256.test(sourceHash.enum[0])
    && repairs
    && hasExactKeys(repairs, ["type", "properties", "required", "additionalProperties"])
    && repairs.type === "object"
    && repairs.additionalProperties === false
    && repairKeys.length > 0
    && requiredRepairs.length === repairKeys.length
    && requiredRepairs.every((key, index) => key === repairKeys[index])
    && repairKeys.every((key) => {
      const repair = repairProperties?.[key];
      return isRecord(repair)
        && hasExactKeys(repair, ["type"])
        && repair.type === "string";
    })
  );
}

export function validateBenchmarkContract(
  value: unknown,
  evidence: BenchmarkPayloadEvidence,
  expectedRunId: string,
  requestModel: string,
  payload: Record<string, unknown>,
): BenchmarkCallContract {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BenchmarkContractError("benchmark must be an object.");
  }
  const raw = value as Record<string, unknown>;
  if (!isOpaqueBenchmarkRunId(raw.run_id)) {
    throw new BenchmarkContractError("run_id must be an opaque UUIDv4 or SHA-256 value.");
  }
  if (raw.run_id !== expectedRunId) {
    throw new BenchmarkContractError("run_id does not match this immutable deployment.");
  }
  if (raw.route !== "sonnet" && raw.route !== "opus" && raw.route !== "hybrid") {
    throw new BenchmarkContractError("route is invalid.");
  }
  if (raw.generation !== "old" && raw.generation !== "candidate") {
    throw new BenchmarkContractError("generation is invalid.");
  }
  if (typeof raw.pipeline_stage !== "string" || !SAFE_STAGE.test(raw.pipeline_stage)) {
    throw new BenchmarkContractError("pipeline_stage is invalid.");
  }
  if (typeof raw.pipeline_pass !== "string" || !SAFE_STAGE.test(raw.pipeline_pass)) {
    throw new BenchmarkContractError("pipeline_pass is invalid.");
  }
  if (!validCallLineage(raw.pipeline_stage, raw.reader_name)) {
    throw new BenchmarkContractError("reader_name is invalid for pipeline_stage.");
  }
  if (!Number.isInteger(raw.retry_number)
      || Number(raw.retry_number) < 0
      || Number(raw.retry_number) > 1) {
    throw new BenchmarkContractError("retry_number must be 0 or 1.");
  }
  if (!Number.isInteger(raw.boundary_run)
      || Number(raw.boundary_run) < 1
      || Number(raw.boundary_run) > 3) {
    throw new BenchmarkContractError("boundary_run must be an integer between 1 and 3.");
  }
  if (typeof raw.requested_model !== "string" || raw.requested_model !== requestModel) {
    throw new BenchmarkContractError("requested_model does not match the proxy request.");
  }
  if (!BENCHMARK_MODELS.includes(requestModel as BenchmarkModel)) {
    throw new BenchmarkContractError("Model is not approved for screenplay benchmarks.");
  }
  const requestSha = requireSha(raw.request_sha256, "request_sha256");
  if (requestSha !== evidence.request_sha256) {
    throw new BenchmarkContractError("request_sha256 does not match the provider payload.");
  }
  if (raw.schema_mode !== "schema_free"
      && raw.schema_mode !== "strict_tool"
      && raw.schema_mode !== "compact_strict_tool") {
    throw new BenchmarkContractError("schema_mode is invalid.");
  }
  const schemaMode = raw.schema_mode as BenchmarkSchemaMode;
  if (schemaMode !== evidence.schema_mode) {
    throw new BenchmarkContractError("schema_mode does not match the provider payload.");
  }
  if (raw.prompt_sha256 !== evidence.prompt_sha256) {
    throw new BenchmarkContractError("prompt_sha256 does not match the provider payload.");
  }
  let schemaSha256: string | null;
  let transportSchemaSha256: string | null;
  if (schemaMode === "schema_free") {
    if (raw.schema_sha256 !== null || raw.transport_schema_sha256 !== null) {
      throw new BenchmarkContractError("A schema-free call cannot carry schema fingerprints.");
    }
    schemaSha256 = null;
    transportSchemaSha256 = null;
  } else {
    schemaSha256 = requireSha(raw.schema_sha256, "schema_sha256");
    transportSchemaSha256 = requireSha(
      raw.transport_schema_sha256,
      "transport_schema_sha256",
    );
  }
  if (schemaSha256 !== evidence.schema_sha256
      || transportSchemaSha256 !== evidence.transport_schema_sha256) {
    throw new BenchmarkContractError(
      "Schema fingerprints do not match the provider payload.",
    );
  }
  const contractWithoutCallId: Omit<BenchmarkCallContract, "call_id"> = {
    run_id: raw.run_id,
    screenplay_sha256: requireSha(raw.screenplay_sha256, "screenplay_sha256"),
    route: raw.route,
    generation: raw.generation,
    pipeline_stage: raw.pipeline_stage,
    pipeline_pass: raw.pipeline_pass,
    reader_name: raw.reader_name as string | null,
    retry_number: Number(raw.retry_number),
    boundary_run: Number(raw.boundary_run),
    prompt_bundle_sha256: requireSha(raw.prompt_bundle_sha256, "prompt_bundle_sha256"),
    schema_bundle_sha256: requireSha(raw.schema_bundle_sha256, "schema_bundle_sha256"),
    prompt_sha256: requireSha(raw.prompt_sha256, "prompt_sha256"),
    schema_mode: schemaMode,
    schema_sha256: schemaSha256,
    transport_schema_sha256: transportSchemaSha256,
    request_sha256: requestSha,
    requested_model: requestModel,
  };
  const expectedCallId = deriveBenchmarkCallId(contractWithoutCallId);
  if (raw.call_id !== expectedCallId) {
    throw new BenchmarkContractError("call_id is not the deterministic contract hash.");
  }

  const stage = contractWithoutCallId.pipeline_stage;
  const correctionToolName = stage === "reader"
    ? `repair_${contractWithoutCallId.reader_name}_report`
    : "repair_synthesis_report";
  const validStageContract = (
    ((stage === "triage" || stage === "cold_read" || stage === "smoke")
      && contractWithoutCallId.reader_name === null
      && contractWithoutCallId.retry_number === 0
      && schemaMode === "schema_free")
    || (stage === "genre_detection"
      && contractWithoutCallId.reader_name === null
      && schemaMode === "strict_tool")
    || (stage === "reader"
      && contractWithoutCallId.reader_name !== null
      && schemaMode === (
        contractWithoutCallId.retry_number === 0
          ? "compact_strict_tool"
          : "strict_tool"
      )
      && (contractWithoutCallId.retry_number === 0
        || isTargetedCorrectionPayload(payload, correctionToolName)))
    || (stage === "synthesis"
      && contractWithoutCallId.reader_name === null
      && schemaMode === (
        contractWithoutCallId.retry_number === 0
          ? "compact_strict_tool"
          : "strict_tool"
      )
      && (contractWithoutCallId.retry_number === 0
        || isTargetedCorrectionPayload(payload, correctionToolName)))
    || (stage === "claim_verification"
      && contractWithoutCallId.reader_name !== null
      && contractWithoutCallId.retry_number === 0
      && schemaMode === "compact_strict_tool")
  );
  if (!validStageContract) {
    throw new BenchmarkContractError(
      "pipeline_stage, reader_name, and schema_mode do not match the V9 call matrix.",
    );
  }

  if (requestModel === "claude-haiku-4-5-20251001") {
    if (!NON_BINDING_STAGES.has(contractWithoutCallId.pipeline_stage)) {
      throw new BenchmarkContractError("Haiku 4.5 is restricted to non-binding cold-read work.");
    }
  } else {
    const isNonBinding = NON_BINDING_STAGES.has(
      contractWithoutCallId.pipeline_stage,
    );
    const allowed = expectedRouteModels(
      isNonBinding && stage !== "smoke" ? "sonnet" : contractWithoutCallId.route,
      contractWithoutCallId.generation,
    );
    if (!allowed.has(requestModel)) {
      throw new BenchmarkContractError(
        isNonBinding
          ? "Non-binding long-context work must use the generation-matched Sonnet route."
          : "Model does not match the requested route generation.",
      );
    }
  }

  return { ...contractWithoutCallId, call_id: expectedCallId };
}

export function validateCandidateEnvelope(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BenchmarkContractError("Request body must be an object.");
  }
  const allowed = new Set([
    "model", "messages", "system", "temperature", "top_p", "top_k", "max_tokens",
    "tools", "tool_choice", "thinking", "output_config", "benchmark",
  ]);
  const unknown = Object.keys(value as Record<string, unknown>)
    .filter((key) => !allowed.has(key));
  if (unknown.length) {
    throw new BenchmarkContractError(`Unsupported candidate field: ${unknown[0]}.`);
  }
}
