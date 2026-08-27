import { sha256CanonicalJson } from "./anthropicProxyCore";

export const BENCHMARK_DATABASE_ID = "model-benchmarks";
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

export interface BenchmarkCallContract {
  run_id: string;
  call_id: string;
  screenplay_sha256: string;
  route: BenchmarkRoute;
  generation: BenchmarkGeneration;
  pipeline_stage: string;
  reader_name: string | null;
  retry_number: number;
  boundary_run: number;
  prompt_bundle_sha256: string;
  structured_output_schema_sha256: string;
  request_sha256: string;
  requested_model: string;
}

export class BenchmarkContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BenchmarkContractError";
  }
}

const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9._-]{1,120}$/;
const SAFE_STAGE = /^[a-z0-9_-]{1,64}$/;
const READERS = new Set([
  "structure", "character", "craft_scene", "concept", "emotional_resonance",
]);
const NON_BINDING_STAGES = new Set(["triage", "genre_detection", "cold_read"]);

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

export function validateBenchmarkContract(
  value: unknown,
  payloadHash: string,
  expectedRunId: string,
  requestModel: string,
): BenchmarkCallContract {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BenchmarkContractError("benchmark must be an object.");
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.run_id !== "string" || !SAFE_ID.test(raw.run_id)) {
    throw new BenchmarkContractError("run_id is invalid.");
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
  if (raw.reader_name !== null
      && (typeof raw.reader_name !== "string" || !READERS.has(raw.reader_name))) {
    throw new BenchmarkContractError("reader_name is invalid.");
  }
  if (!Number.isInteger(raw.retry_number)
      || Number(raw.retry_number) < 0
      || Number(raw.retry_number) > 10) {
    throw new BenchmarkContractError("retry_number must be an integer between 0 and 10.");
  }
  if (!Number.isInteger(raw.boundary_run)
      || Number(raw.boundary_run) < 1
      || Number(raw.boundary_run) > 10) {
    throw new BenchmarkContractError("boundary_run must be an integer between 1 and 10.");
  }
  if (typeof raw.requested_model !== "string" || raw.requested_model !== requestModel) {
    throw new BenchmarkContractError("requested_model does not match the proxy request.");
  }
  if (!BENCHMARK_MODELS.includes(requestModel as BenchmarkModel)) {
    throw new BenchmarkContractError("Model is not approved for screenplay benchmarks.");
  }
  const requestSha = requireSha(raw.request_sha256, "request_sha256");
  if (requestSha !== payloadHash) {
    throw new BenchmarkContractError("request_sha256 does not match the provider payload.");
  }
  const contractWithoutCallId: Omit<BenchmarkCallContract, "call_id"> = {
    run_id: raw.run_id,
    screenplay_sha256: requireSha(raw.screenplay_sha256, "screenplay_sha256"),
    route: raw.route,
    generation: raw.generation,
    pipeline_stage: raw.pipeline_stage,
    reader_name: raw.reader_name,
    retry_number: Number(raw.retry_number),
    boundary_run: Number(raw.boundary_run),
    prompt_bundle_sha256: requireSha(raw.prompt_bundle_sha256, "prompt_bundle_sha256"),
    structured_output_schema_sha256: requireSha(
      raw.structured_output_schema_sha256,
      "structured_output_schema_sha256",
    ),
    request_sha256: requestSha,
    requested_model: requestModel,
  };
  const expectedCallId = deriveBenchmarkCallId(contractWithoutCallId);
  if (raw.call_id !== expectedCallId) {
    throw new BenchmarkContractError("call_id is not the deterministic contract hash.");
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
      isNonBinding ? "sonnet" : contractWithoutCallId.route,
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
