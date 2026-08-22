"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BenchmarkContractError = exports.BENCHMARK_MODELS = exports.BENCHMARK_DATABASE_ID = void 0;
exports.deriveBenchmarkCallId = deriveBenchmarkCallId;
exports.validateBenchmarkContract = validateBenchmarkContract;
exports.validateCandidateEnvelope = validateCandidateEnvelope;
const anthropicProxyCore_1 = require("./anthropicProxyCore");
exports.BENCHMARK_DATABASE_ID = "model-benchmarks";
exports.BENCHMARK_MODELS = [
    "claude-haiku-4-5-20251001",
    "claude-sonnet-4-6",
    "claude-sonnet-5",
    "claude-opus-4-7",
    "claude-opus-5",
];
class BenchmarkContractError extends Error {
    constructor(message) {
        super(message);
        this.name = "BenchmarkContractError";
    }
}
exports.BenchmarkContractError = BenchmarkContractError;
const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9._-]{1,120}$/;
const SAFE_STAGE = /^[a-z0-9_-]{1,64}$/;
const READERS = new Set([
    "structure", "character", "craft_scene", "concept", "emotional_resonance",
]);
const NON_BINDING_HAIKU_STAGES = new Set(["triage", "genre_detection", "cold_read"]);
function requireSha(value, field) {
    if (typeof value !== "string" || !SHA256.test(value)) {
        throw new BenchmarkContractError(`${field} must be a lowercase SHA-256 hash.`);
    }
    return value;
}
function expectedRouteModels(route, generation) {
    const sonnet = generation === "old" ? "claude-sonnet-4-6" : "claude-sonnet-5";
    const opus = generation === "old" ? "claude-opus-4-7" : "claude-opus-5";
    if (route === "sonnet")
        return new Set([sonnet]);
    if (route === "opus")
        return new Set([opus]);
    return new Set([sonnet, opus]);
}
function deriveBenchmarkCallId(contract) {
    return (0, anthropicProxyCore_1.sha256CanonicalJson)(contract);
}
function validateBenchmarkContract(value, payloadHash, expectedRunId, requestModel) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new BenchmarkContractError("benchmark must be an object.");
    }
    const raw = value;
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
    if (!exports.BENCHMARK_MODELS.includes(requestModel)) {
        throw new BenchmarkContractError("Model is not approved for screenplay benchmarks.");
    }
    const requestSha = requireSha(raw.request_sha256, "request_sha256");
    if (requestSha !== payloadHash) {
        throw new BenchmarkContractError("request_sha256 does not match the provider payload.");
    }
    const contractWithoutCallId = {
        run_id: raw.run_id,
        screenplay_sha256: requireSha(raw.screenplay_sha256, "screenplay_sha256"),
        route: raw.route,
        generation: raw.generation,
        pipeline_stage: raw.pipeline_stage,
        reader_name: raw.reader_name,
        retry_number: Number(raw.retry_number),
        boundary_run: Number(raw.boundary_run),
        prompt_bundle_sha256: requireSha(raw.prompt_bundle_sha256, "prompt_bundle_sha256"),
        structured_output_schema_sha256: requireSha(raw.structured_output_schema_sha256, "structured_output_schema_sha256"),
        request_sha256: requestSha,
        requested_model: requestModel,
    };
    const expectedCallId = deriveBenchmarkCallId(contractWithoutCallId);
    if (raw.call_id !== expectedCallId) {
        throw new BenchmarkContractError("call_id is not the deterministic contract hash.");
    }
    if (requestModel === "claude-haiku-4-5-20251001") {
        if (!NON_BINDING_HAIKU_STAGES.has(contractWithoutCallId.pipeline_stage)) {
            throw new BenchmarkContractError("Haiku 4.5 is restricted to non-binding cold-read work.");
        }
    }
    else {
        if (NON_BINDING_HAIKU_STAGES.has(contractWithoutCallId.pipeline_stage)) {
            throw new BenchmarkContractError("Cold-read work must use Haiku 4.5.");
        }
        const allowed = expectedRouteModels(contractWithoutCallId.route, contractWithoutCallId.generation);
        if (!allowed.has(requestModel)) {
            throw new BenchmarkContractError("Model does not match the requested route generation.");
        }
    }
    return { ...contractWithoutCallId, call_id: expectedCallId };
}
function validateCandidateEnvelope(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new BenchmarkContractError("Request body must be an object.");
    }
    const allowed = new Set([
        "model", "messages", "system", "temperature", "top_p", "top_k", "max_tokens",
        "tools", "tool_choice", "thinking", "output_config", "benchmark",
    ]);
    const unknown = Object.keys(value)
        .filter((key) => !allowed.has(key));
    if (unknown.length) {
        throw new BenchmarkContractError(`Unsupported candidate field: ${unknown[0]}.`);
    }
}
//# sourceMappingURL=benchmarkCandidatePolicy.js.map