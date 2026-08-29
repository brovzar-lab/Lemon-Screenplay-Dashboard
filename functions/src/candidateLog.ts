import { createHash } from "node:crypto";

export interface CandidateLogFields {
  call_id?: string;
  run_id_sha256?: string;
  model?: string;
  status_code?: number;
  response_id?: string;
  usage?: Record<string, number>;
  cost_microusd?: number;
  release?: Record<string, string | boolean>;
  event: string;
}

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

function sanitizedRecord(
  value: unknown,
  allowed: ReadonlySet<string>,
): Record<string, string | boolean | number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, string | boolean | number> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!allowed.has(key)) continue;
    if (typeof item === "string" || typeof item === "boolean" || typeof item === "number") {
      result[key] = item;
    }
  }
  return result;
}

export function sanitizeCandidateLog(value: unknown): CandidateLogFields {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const event = typeof record.event === "string" ? record.event : "candidate_event";
  const result: Record<string, unknown> = { event };
  for (const [key, item] of Object.entries(record)) {
    if (!TOP_LEVEL_FIELDS.has(key) || key === "event") continue;
    if (key === "run_id" && typeof item === "string") {
      result.run_id_sha256 = createHash("sha256").update(item).digest("hex");
    } else if (key === "usage") {
      const usage = sanitizedRecord(item, USAGE_FIELDS);
      if (usage) result.usage = usage;
    } else if (key === "release") {
      const release = sanitizedRecord(item, RELEASE_FIELDS);
      if (release) result.release = release;
    } else if (typeof item === "string" || typeof item === "number") {
      result[key] = item;
    }
  }
  return result as unknown as CandidateLogFields;
}

/** Log only the operational fields approved by the benchmark privacy contract. */
export function candidateLog(fields: unknown): void {
  console.log(JSON.stringify(sanitizeCandidateLog(fields)));
}
