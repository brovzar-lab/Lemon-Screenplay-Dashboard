const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BENCHMARK_RUNTIME_OPTIONS,
  buildBenchmarkReleaseIdentity,
} = require('../lib/benchmarkRelease');

const input = {
  gitSha: 'a'.repeat(40),
  sourceClean: 'true',
  catalogSha256: 'b'.repeat(64),
  buildTimestamp: '2026-08-21T12:00:00Z',
  runId: 'staging-smoke',
  capMicrousd: 1_000_000,
  runtimeServiceAccount: 'benchmark-runtime@lemon-screenplay-staging.iam.gserviceaccount.com',
  cloudRunRevision: 'llmproxycandidate-00001-abc',
};

test('release identity binds clean Git, catalog, runtime, run, and cap', () => {
  const release = buildBenchmarkReleaseIdentity(input);
  const changedCap = buildBenchmarkReleaseIdentity({ ...input, capMicrousd: 75_000_000 });
  assert.equal(release.git_sha, input.gitSha);
  assert.equal(release.cloud_run_revision, input.cloudRunRevision);
  assert.notEqual(release.deployment_config_sha256, changedCap.deployment_config_sha256);
});

test('dirty source is refused and candidate invocation is service-only', () => {
  assert.throws(
    () => buildBenchmarkReleaseIdentity({ ...input, sourceClean: 'false' }),
    /clean source tree/,
  );
  assert.equal(BENCHMARK_RUNTIME_OPTIONS.invoker, 'private');
  assert.equal(BENCHMARK_RUNTIME_OPTIONS.databaseId, 'model-benchmarks');
});
