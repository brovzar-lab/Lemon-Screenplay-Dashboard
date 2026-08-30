const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BenchmarkCapExceededError,
  BenchmarkCallConflictError,
  BenchmarkDuplicateCallError,
  BenchmarkRetryLineageError,
  PRIOR_AUDIT_SETTLED_CALL_COUNT,
  admitBenchmarkReservation,
  chargeUncertainBenchmarkReservation,
  normalizeBenchmarkRunLedger,
  normalizeBenchmarkAuditLedger,
  rejectExistingBenchmarkCall,
  releaseBenchmarkReservation,
  releasedBeforeGenerationCallUpdate,
  settleBenchmarkReservation,
  validateBenchmarkRetryLineage,
  validateStoredRun,
} = require('../lib/benchmarkLedger');
const { sha256CanonicalJson } = require('../lib/anthropicProxyCore');

const ledger = (limit = 1_000_000) => normalizeBenchmarkRunLedger(undefined, limit);

test('concurrent lifetime reservations cannot cross the immutable run cap', () => {
  const first = admitBenchmarkReservation(ledger(), 700_000);
  assert.throws(() => admitBenchmarkReservation(first, 400_000), BenchmarkCapExceededError);
});

test('process interruption leaves the lifetime reservation held without expiry', () => {
  const interrupted = admitBenchmarkReservation(ledger(), 700_000);
  assert.equal(interrupted.reserved_microusd, 700_000);
  assert.throws(
    () => admitBenchmarkReservation(interrupted, 400_000),
    BenchmarkCapExceededError,
  );
});

test('uncertain dispatch charges the full hold and a proven rejection releases it', () => {
  const reserved = admitBenchmarkReservation(ledger(), 700_000);
  const uncertain = chargeUncertainBenchmarkReservation(reserved, 700_000);
  assert.equal(uncertain.spent_microusd, 700_000);
  assert.equal(uncertain.uncertain_spend_microusd, 700_000);
  assert.equal(uncertain.reserved_microusd, 0);

  const rejected = releaseBenchmarkReservation(reserved, 700_000);
  assert.equal(rejected.spent_microusd, 0);
  assert.equal(rejected.reserved_microusd, 0);
});

test('pre-generation release has explicit zero telemetry and preserves its ceiling', () => {
  const update = releasedBeforeGenerationCallUpdate({
    run_id: 'run-1',
    call_id: 'call-1',
    requested_model: 'claude-sonnet-5',
    reserved_microusd: 125_000,
  }, {
    validation_failure_code: 'CANDIDATE_PROVIDER_CONFIGURATION_UNAVAILABLE',
    validation_failure_reason: 'Candidate provider configuration failed before dispatch.',
    configuration_error_sha256: 'a'.repeat(64),
  }, 'candidate_provider_configuration_before_dispatch');
  assert.equal(update.status, 'rejected');
  assert.equal(update.reservation_ceiling_microusd, 125_000);
  assert.equal(update.reserved_microusd, 0);
  assert.equal(update.actual_cost_microusd, 0);
  assert.equal(update.charged_cost_microusd, 0);
  assert.equal(update.returned_model, null);
  assert.equal(update.provider_usage, null);
  assert.equal(update.disposition, 'released_before_generation');
  assert.deepEqual(update.usage, {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  });
});

test('settlement cannot exceed the conservative reservation', () => {
  const reserved = admitBenchmarkReservation(ledger(), 100_000);
  assert.throws(
    () => settleBenchmarkReservation(reserved, 100_000, 100_001),
    /exceeded/,
  );
});

test('duplicate call IDs never dispatch again and conflicting hashes are rejected', () => {
  const contract = {
    request_sha256: 'a'.repeat(64),
    prompt_bundle_sha256: 'b'.repeat(64),
    schema_bundle_sha256: 'c'.repeat(64),
    prompt_sha256: 'd'.repeat(64),
    schema_mode: 'strict_tool',
    schema_sha256: 'e'.repeat(64),
    transport_schema_sha256: 'f'.repeat(64),
  };
  assert.throws(
    () => rejectExistingBenchmarkCall({ ...contract, status: 'in_progress' }, contract),
    BenchmarkDuplicateCallError,
  );
  try {
    rejectExistingBenchmarkCall({ ...contract, status: 'settled', actual_cost_microusd: 42 }, contract);
  } catch (error) {
    assert.equal(error.existingCostMicrousd, 42);
  }
  assert.throws(
    () => rejectExistingBenchmarkCall({ ...contract, request_sha256: 'd'.repeat(64) }, contract),
    BenchmarkCallConflictError,
  );
});

test('retry two requires exactly one settled compact structural replay lineage', () => {
  const base = {
    run_id: 'run-1',
    screenplay_sha256: 'a'.repeat(64),
    route: 'sonnet',
    generation: 'candidate',
    pipeline_stage: 'reader',
    pipeline_pass: 'sonnet',
    reader_name: 'concept',
    boundary_run: 1,
    prompt_bundle_sha256: 'b'.repeat(64),
    schema_bundle_sha256: 'c'.repeat(64),
    requested_model: 'claude-sonnet-5',
  };
  const compact = {
    ...base,
    status: 'settled',
    returned_model: base.requested_model,
    request_sha256: 'd'.repeat(64),
    prompt_sha256: 'e'.repeat(64),
    schema_mode: 'compact_strict_tool',
    schema_sha256: 'f'.repeat(64),
    transport_schema_sha256: '1'.repeat(64),
  };
  const prior = [
    { ...compact, call_id: '2'.repeat(64), response_id: 'msg_initial', retry_number: 0 },
    { ...compact, call_id: '3'.repeat(64), response_id: 'msg_fresh', retry_number: 1 },
  ];
  const target = {
    ...base,
    call_id: '4'.repeat(64),
    retry_number: 2,
    request_sha256: '5'.repeat(64),
    prompt_sha256: '6'.repeat(64),
    schema_mode: 'strict_tool',
    schema_sha256: '7'.repeat(64),
    transport_schema_sha256: '7'.repeat(64),
  };
  assert.doesNotThrow(() => validateBenchmarkRetryLineage(target, prior));
  assert.throws(
    () => validateBenchmarkRetryLineage(target, prior.slice(1)),
    BenchmarkRetryLineageError,
  );
  assert.throws(
    () => validateBenchmarkRetryLineage(target, [
      prior[0],
      { ...prior[1], schema_mode: 'strict_tool' },
    ]),
    BenchmarkRetryLineageError,
  );
  assert.throws(
    () => validateBenchmarkRetryLineage(target, [
      ...prior,
      { ...target, status: 'settled', response_id: 'msg_extra' },
    ]),
    BenchmarkRetryLineageError,
  );
  assert.throws(
    () => validateBenchmarkRetryLineage({ ...target, retry_number: 3 }, prior),
    BenchmarkRetryLineageError,
  );
});

test('settlement, uncertainty, and release cannot subtract a missing hold', () => {
  const empty = ledger();
  assert.throws(() => settleBenchmarkReservation(empty, 1, 1), /fully held/);
  assert.throws(() => chargeUncertainBenchmarkReservation(empty, 1), /fully held/);
  assert.throws(() => releaseBenchmarkReservation(empty, 1), /fully held/);
});

test('new ledgers initialize once but malformed existing counters fail closed', () => {
  assert.deepEqual(ledger(), {
    limit_microusd: 1_000_000,
    spent_microusd: 0,
    reserved_microusd: 0,
    call_count: 0,
    uncertain_call_count: 0,
    uncertain_spend_microusd: 0,
  });
  assert.throws(
    () => normalizeBenchmarkRunLedger({
      spent_microusd: 'corrupt',
      reserved_microusd: 0,
      call_count: 0,
      uncertain_call_count: 0,
      uncertain_spend_microusd: 0,
    }, 1_000_000),
    /spent_microusd/,
  );
});

test('an immutable run is bound to every release field', () => {
  const release = {
    git_sha: 'a'.repeat(40),
    source_clean: true,
    catalog_sha256: 'b'.repeat(64),
    pricing_sha256: 'c'.repeat(64),
    build_timestamp: '2026-08-27T12:00:00.000Z',
    deployment_config_sha256: 'd'.repeat(64),
    cloud_run_revision: 'llmproxycandidate-00001-abc',
  };
  const config = { runId: 'run-1', limitMicrousd: 1_000_000, release };
  const stored = {
    run_id: config.runId,
    limit_microusd: config.limitMicrousd,
    release,
    release_sha256: sha256CanonicalJson(release),
  };
  validateStoredRun(stored, config);
  for (const field of Object.keys(release)) {
    const changed = { ...release, [field]: `${String(release[field])}-changed` };
    assert.throws(
      () => validateStoredRun(stored, { ...config, release: changed }),
      /does not match/,
      field,
    );
  }
});

test('the cumulative audit ledger cannot be reset by a new run ID', () => {
  const config = {
    runId: 'run-2',
    limitMicrousd: 8_000_000,
    auditId: 'v9-trust-remediation-20260827',
    auditLimitMicrousd: 40_000_000,
    priorAuditSpendMicrousd: 106_425,
    release: {},
  };
  const initial = normalizeBenchmarkAuditLedger(undefined, config, true);
  assert.equal(initial.spent_microusd, 106_425);
  assert.equal(initial.call_count, PRIOR_AUDIT_SETTLED_CALL_COUNT);
  assert.throws(
    () => normalizeBenchmarkAuditLedger(
      undefined,
      { ...config, priorAuditSpendMicrousd: 10_000_000 },
      true,
    ),
    /exact settled pilot cost/,
  );
  assert.throws(
    () => normalizeBenchmarkAuditLedger(undefined, config, false, false),
    /missing after benchmark activity exists/,
  );
  const stored = {
    ...initial,
    audit_id: config.auditId,
    spent_microusd: 500_000,
  };
  assert.throws(
    () => normalizeBenchmarkAuditLedger(stored, config, true),
    /exact cumulative/,
  );
  assert.equal(
    normalizeBenchmarkAuditLedger(stored, config, false).spent_microusd,
    500_000,
  );
});

test('prior uncertain spend remains charged against the next run admission', () => {
  const config = {
    runId: 'run-after-uncertainty',
    limitMicrousd: 1_000_000,
    auditId: 'v9-trust-remediation-20260827',
    auditLimitMicrousd: 1_000_000,
    priorAuditSpendMicrousd: 900_000,
    release: {},
  };
  const stored = {
    limit_microusd: config.auditLimitMicrousd,
    spent_microusd: 900_000,
    reserved_microusd: 0,
    call_count: 3,
    uncertain_call_count: 1,
    uncertain_spend_microusd: 800_000,
    audit_id: config.auditId,
  };
  const cumulative = normalizeBenchmarkAuditLedger(stored, config, true);

  assert.throws(
    () => admitBenchmarkReservation(cumulative, 100_001),
    BenchmarkCapExceededError,
  );
  assert.equal(
    admitBenchmarkReservation(cumulative, 100_000).reserved_microusd,
    100_000,
  );
});
