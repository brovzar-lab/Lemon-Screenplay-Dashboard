const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BENCHMARK_RUNTIME_OPTIONS,
  benchmarkIsolationResources,
  buildBenchmarkReleaseIdentity,
  deploymentConfigSha256,
} = require('../lib/benchmarkRelease');

const input = {
  gitSha: 'a'.repeat(40),
  sourceClean: 'true',
  catalogSha256: 'b'.repeat(64),
  buildTimestamp: '2026-08-21T12:00:00Z',
  runId: 'staging-smoke',
  capMicrousd: 1_000_000,
  runtimeServiceAccount: 'benchmark-runtime@lemon-screenplay-staging.iam.gserviceaccount.com',
  runtimeProjectId: 'lemon-screenplay-staging',
  stagingFirestoreProjectId: 'lemon-screenplay-staging',
  productionFirestoreProjectId: 'lemon-screenplay-dashboard',
  productionStorageBucket: 'lemon-screenplay-dashboard.firebasestorage.app',
  cloudRunRevision: 'llmproxycandidate-00001-abc',
};

test('release identity binds clean Git, catalog, runtime, run, and cap', () => {
  const release = buildBenchmarkReleaseIdentity(input);
  const changedCap = buildBenchmarkReleaseIdentity({ ...input, capMicrousd: 75_000_000 });
  assert.equal(release.git_sha, input.gitSha);
  assert.equal(release.cloud_run_revision, input.cloudRunRevision);
  assert.notEqual(release.deployment_config_sha256, changedCap.deployment_config_sha256);
});

test('release identity binds every negative isolation target', () => {
  const release = buildBenchmarkReleaseIdentity(input);
  const hash = (staging, production, storage) => deploymentConfigSha256(
    input.runId,
    input.capMicrousd,
    input.runtimeServiceAccount,
    input.runtimeProjectId,
    staging,
    production,
    storage,
  );
  const changedStaging = hash(
    'lemon-sp-dashboard-stg-493694',
    input.productionFirestoreProjectId,
    input.productionStorageBucket,
  );
  const changedProduction = hash(
    input.stagingFirestoreProjectId,
    'lemon-screenplay-production-copy',
    input.productionStorageBucket,
  );
  const changedStorage = hash(
    input.stagingFirestoreProjectId,
    input.productionFirestoreProjectId,
    'lemon-screenplay-dashboard-copy.firebasestorage.app',
  );

  assert.notEqual(release.deployment_config_sha256, changedStaging);
  assert.notEqual(release.deployment_config_sha256, changedProduction);
  assert.notEqual(release.deployment_config_sha256, changedStorage);
});

test('staging and production default Firestore targets stay distinct', () => {
  assert.deepEqual(
    benchmarkIsolationResources(
      'lemon-screenplay-staging',
      'lemon-screenplay-dashboard',
      'lemon-screenplay-dashboard.firebasestorage.app',
    ),
    {
      staging_default_database: 'projects/lemon-screenplay-staging/databases/(default)',
      production_default_database: 'projects/lemon-screenplay-dashboard/databases/(default)',
      production_storage_bucket: 'lemon-screenplay-dashboard.firebasestorage.app',
    },
  );
  assert.throws(
    () => benchmarkIsolationResources(
      'lemon-screenplay-dashboard',
      'lemon-screenplay-dashboard',
      'lemon-screenplay-dashboard.firebasestorage.app',
    ),
    /must be different/,
  );
});

test('runtime identity must match either the staging or production isolation target', () => {
  assert.throws(
    () => buildBenchmarkReleaseIdentity({
      ...input,
      runtimeProjectId: 'lemon-sp-dashboard-stg-493694',
    }),
    /must match an approved isolation target/,
  );
  assert.throws(
    () => buildBenchmarkReleaseIdentity({
      ...input,
      runtimeServiceAccount: 'benchmark-runtime@lemon-screenplay-dashboard.iam.gserviceaccount.com',
    }),
    /must belong to the runtime project/,
  );
  assert.doesNotThrow(() => buildBenchmarkReleaseIdentity({
    ...input,
    runtimeProjectId: 'lemon-screenplay-dashboard',
    runtimeServiceAccount: 'benchmark-runtime@lemon-screenplay-dashboard.iam.gserviceaccount.com',
  }));
});

test('dirty source is refused and candidate invocation is service-only', () => {
  assert.throws(
    () => buildBenchmarkReleaseIdentity({ ...input, sourceClean: 'false' }),
    /clean source tree/,
  );
  assert.equal(BENCHMARK_RUNTIME_OPTIONS.invoker, 'private');
  assert.equal(BENCHMARK_RUNTIME_OPTIONS.databaseId, 'model-benchmarks');
});
