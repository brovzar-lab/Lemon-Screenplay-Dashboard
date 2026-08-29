import { sha256CanonicalJson } from "./anthropicProxyCore";
import {
  BENCHMARK_AUDIT_ID,
  BENCHMARK_AUDIT_LIMIT_MICROUSD,
  BENCHMARK_DATABASE_ID,
  BENCHMARK_MODELS,
} from "./benchmarkCandidatePolicy";

export const BENCHMARK_RUNTIME_OPTIONS = {
  region: "us-central1",
  timeoutSeconds: 3600,
  memory: "512MiB",
  cpu: "0.3333",
  maxInstances: 5,
  minInstances: 0,
  concurrency: 1,
  invoker: "private",
  ingress: "all",
  runtimeUpdatePolicy: "automatic",
  buildEnvironment: "empty",
  buildWorkerPool: "none",
  dockerRepository: "regional-staging-gcf-artifacts",
  vpcConnector: "none",
  directVpc: "none",
  binaryAuthorization: "none",
  kmsKey: "none",
  databaseId: BENCHMARK_DATABASE_ID,
  models: BENCHMARK_MODELS,
  auditId: BENCHMARK_AUDIT_ID,
  auditLimitMicrousd: BENCHMARK_AUDIT_LIMIT_MICROUSD,
} as const;

export const BENCHMARK_STAGING_PROJECT_IDS = [
  "lemon-screenplay-staging",
] as const;
export const BENCHMARK_PRODUCTION_FIRESTORE_PROJECT_ID = "lemon-screenplay-dashboard";
export const BENCHMARK_PRODUCTION_STORAGE_BUCKET =
  "lemon-screenplay-dashboard.firebasestorage.app";

export interface BenchmarkReleaseIdentity {
  git_sha: string;
  source_clean: boolean;
  catalog_sha256: string;
  pricing_sha256: string;
  build_timestamp: string;
  deployment_config_sha256: string;
  cloud_run_revision: string;
  inference_geo: "global" | "us";
}

export interface BenchmarkDeploymentIdentityInput {
  gitSha: string;
  sourceClean: string;
  catalogSha256: string;
  pricingSha256: string;
  buildTimestamp: string;
  runId: string;
  capMicrousd: number;
  priorAuditSpendMicrousd: number;
  runtimeServiceAccount: string;
  runtimeProjectId: string;
  stagingFirestoreProjectId: string;
  productionFirestoreProjectId: string;
  productionStorageBucket: string;
  inferenceGeo: "global" | "us";
  cloudRunRevision?: string;
}

export interface BenchmarkIsolationResources {
  staging_default_database: string;
  production_default_database: string;
  production_storage_bucket: string;
}

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const SERVICE_ACCOUNT = /^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]@[a-z0-9-]+\.iam\.gserviceaccount\.com$/;

export function assertBenchmarkRuntimeProject(
    stagingFirestoreProjectId: string,
    _productionFirestoreProjectId: string,
    runtimeProjectId: string,
    runtimeServiceAccount: string,
): void {
  if (runtimeProjectId !== stagingFirestoreProjectId) {
    throw new Error("The function runtime project must match the staging Firestore project.");
  }
  if (!runtimeServiceAccount.endsWith(
    `@${runtimeProjectId}.iam.gserviceaccount.com`,
  )) {
    throw new Error("The benchmark runtime service account must belong to the runtime project.");
  }
}

export function benchmarkIsolationResources(
  stagingFirestoreProjectId: string,
  productionFirestoreProjectId: string,
  productionStorageBucket: string,
): BenchmarkIsolationResources {
  if (stagingFirestoreProjectId === productionFirestoreProjectId) {
    throw new Error("Staging and production Firestore projects must be different.");
  }
  if (!BENCHMARK_STAGING_PROJECT_IDS.includes(
    stagingFirestoreProjectId as typeof BENCHMARK_STAGING_PROJECT_IDS[number],
  )) {
    throw new Error("BENCHMARK_STAGING_FIRESTORE_PROJECT_ID is invalid.");
  }
  if (productionFirestoreProjectId !== BENCHMARK_PRODUCTION_FIRESTORE_PROJECT_ID) {
    throw new Error("BENCHMARK_PRODUCTION_FIRESTORE_PROJECT_ID is invalid.");
  }
  if (productionStorageBucket !== BENCHMARK_PRODUCTION_STORAGE_BUCKET) {
    throw new Error("BENCHMARK_STORAGE_BUCKET is invalid.");
  }
  return {
    staging_default_database: `projects/${stagingFirestoreProjectId}/databases/(default)`,
    production_default_database: `projects/${productionFirestoreProjectId}/databases/(default)`,
    production_storage_bucket: productionStorageBucket,
  };
}

export function deploymentConfigSha256(
  runId: string,
  capMicrousd: number,
  priorAuditSpendMicrousd: number,
  runtimeServiceAccount: string,
  runtimeProjectId: string,
  stagingFirestoreProjectId: string,
  productionFirestoreProjectId: string,
  productionStorageBucket: string,
  inferenceGeo: "global" | "us",
): string {
  return sha256CanonicalJson({
    ...BENCHMARK_RUNTIME_OPTIONS,
    runId,
    capMicrousd,
    priorAuditSpendMicrousd,
    runtimeServiceAccount,
    runtimeProjectId,
    stagingFirestoreProjectId,
    productionFirestoreProjectId,
    productionStorageBucket,
    inferenceGeo,
  });
}

export function buildBenchmarkReleaseIdentity(
  input: BenchmarkDeploymentIdentityInput,
): BenchmarkReleaseIdentity {
  if (!GIT_SHA.test(input.gitSha)) throw new Error("BENCHMARK_GIT_SHA is invalid.");
  if (input.sourceClean !== "true") {
    throw new Error("Candidate deployment requires a clean source tree.");
  }
  if (!SHA256.test(input.catalogSha256)) {
    throw new Error("BENCHMARK_CATALOG_SHA256 is invalid.");
  }
  if (!SHA256.test(input.pricingSha256)) {
    throw new Error("Candidate runtime pricing hash is invalid.");
  }
  if (!input.buildTimestamp || Number.isNaN(Date.parse(input.buildTimestamp))) {
    throw new Error("BENCHMARK_BUILD_TIMESTAMP is invalid.");
  }
  if (!SERVICE_ACCOUNT.test(input.runtimeServiceAccount)) {
    throw new Error("BENCHMARK_RUNTIME_SERVICE_ACCOUNT is invalid.");
  }
  assertBenchmarkRuntimeProject(
    input.stagingFirestoreProjectId,
    input.productionFirestoreProjectId,
    input.runtimeProjectId,
    input.runtimeServiceAccount,
  );
  benchmarkIsolationResources(
    input.stagingFirestoreProjectId,
    input.productionFirestoreProjectId,
    input.productionStorageBucket,
  );
  if (!Number.isInteger(input.capMicrousd) || input.capMicrousd <= 0) {
    throw new Error("Benchmark cap must be a positive integer number of micro-USD.");
  }
  if (input.inferenceGeo !== "global" && input.inferenceGeo !== "us") {
    throw new Error("BENCHMARK_INFERENCE_GEO must be global or us.");
  }
  return {
    git_sha: input.gitSha,
    source_clean: true,
    catalog_sha256: input.catalogSha256,
    pricing_sha256: input.pricingSha256,
    build_timestamp: new Date(input.buildTimestamp).toISOString(),
    deployment_config_sha256: deploymentConfigSha256(
      input.runId,
      input.capMicrousd,
      input.priorAuditSpendMicrousd,
      input.runtimeServiceAccount,
      input.runtimeProjectId,
      input.stagingFirestoreProjectId,
      input.productionFirestoreProjectId,
      input.productionStorageBucket,
      input.inferenceGeo,
    ),
    cloud_run_revision: input.cloudRunRevision ?? process.env.K_REVISION ?? "local",
    inference_geo: input.inferenceGeo,
  };
}
