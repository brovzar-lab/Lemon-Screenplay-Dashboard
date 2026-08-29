"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeCandidateLog = sanitizeCandidateLog;
exports.candidateLog = candidateLog;
const node_crypto_1 = require("node:crypto");
const TOP_LEVEL_FIELDS = new Set([
    "event", "call_id", "run_id", "model", "status_code", "response_id",
    "usage", "cost_microusd", "release",
]);
const USAGE_FIELDS = new Set([
    "input_tokens", "output_tokens", "cache_creation_input_tokens",
    "cache_read_input_tokens", "call_count",
]);
const RELEASE_FIELDS = new Set([
    "git_sha", "source_clean", "catalog_sha256", "build_timestamp",
    "deployment_config_sha256", "cloud_run_revision",
]);
function sanitizedRecord(value, allowed) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return undefined;
    const result = {};
    for (const [key, item] of Object.entries(value)) {
        if (!allowed.has(key))
            continue;
        if (typeof item === "string" || typeof item === "boolean" || typeof item === "number") {
            result[key] = item;
        }
    }
    return result;
}
function sanitizeCandidateLog(value) {
    const record = value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
    const event = typeof record.event === "string" ? record.event : "candidate_event";
    const result = { event };
    for (const [key, item] of Object.entries(record)) {
        if (!TOP_LEVEL_FIELDS.has(key) || key === "event")
            continue;
        if (key === "run_id" && typeof item === "string") {
            result.run_id_sha256 = (0, node_crypto_1.createHash)("sha256").update(item).digest("hex");
        }
        else if (key === "usage") {
            const usage = sanitizedRecord(item, USAGE_FIELDS);
            if (usage)
                result.usage = usage;
        }
        else if (key === "release") {
            const release = sanitizedRecord(item, RELEASE_FIELDS);
            if (release)
                result.release = release;
        }
        else if (typeof item === "string" || typeof item === "number") {
            result[key] = item;
        }
    }
    return result;
}
/** Log only the operational fields approved by the benchmark privacy contract. */
function candidateLog(fields) {
    console.log(JSON.stringify(sanitizeCandidateLog(fields)));
}
//# sourceMappingURL=candidateLog.js.map