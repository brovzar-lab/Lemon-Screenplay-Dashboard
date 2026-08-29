const assert = require('node:assert/strict');
const test = require('node:test');

const {
  benchmarkUncertainAccounting,
  benchmarkRequestFailureState,
  candidateSettlementFailure,
  isolationApp,
  isPermissionDenied,
  providerRejectionFailure,
  providerRejectionReleaseFailure,
  providerConfigurationFailure,
  providerTransportFailure,
} = require('../lib/llmProxyCandidate');

test('online isolation probes recognize Firestore and Storage IAM denial codes', () => {
  assert.equal(isPermissionDenied({ code: 7 }), true);
  assert.equal(isPermissionDenied({ code: 403 }), true);
  assert.equal(isPermissionDenied({ code: 'permission-denied' }), true);
  assert.equal(isPermissionDenied({ code: 500 }), false);
});

test('staging and production probes use distinct explicit Admin SDK apps', () => {
  const staging = isolationApp('lemon-screenplay-staging');
  const production = isolationApp('lemon-screenplay-dashboard');

  assert.notEqual(staging.name, production.name);
  assert.equal(staging.options.projectId, 'lemon-screenplay-staging');
  assert.equal(production.options.projectId, 'lemon-screenplay-dashboard');
});

test('uncertain benchmark errors expose the exact call and cap charge', () => {
  const reservation = {
    run_id: 'run-1',
    call_id: 'call-1',
    requested_model: 'claude-sonnet-5',
    reserved_microusd: 125_000,
  };

  assert.deepEqual(
    benchmarkUncertainAccounting(reservation, {
      actual_cost_microusd: 125_000,
      actual_cost_usd: 0.125,
    }),
    {
      call_id: 'call-1',
      requested_model: 'claude-sonnet-5',
      uncertainty_status: 'charged_reservation',
      charged_cost_microusd: 125_000,
      charged_cost_usd: 0.125,
      reserved_cost_microusd: 0,
      reserved_cost_usd: 0,
      cap_cost_microusd: 125_000,
      cap_cost_usd: 0.125,
    },
  );
  assert.equal(
    benchmarkUncertainAccounting(reservation).uncertainty_status,
    'reservation_held',
  );
  assert.equal(
    benchmarkUncertainAccounting(reservation).cap_cost_microusd,
    125_000,
  );
});

test('ambiguous rejection acknowledgement recovered as rejected remains proven zero-spend', () => {
  const reservation = {
    run_id: 'run-1',
    call_id: 'call-1',
    requested_model: 'claude-sonnet-5',
    reserved_microusd: 125_000,
  };
  assert.deepEqual(
    benchmarkRequestFailureState(false, reservation, {
      ledger_status: 'rejected',
      actual_cost_microusd: 0,
      actual_cost_usd: 0,
    }),
    { rejected: true, benchmarkAccounting: undefined },
  );
});

test('candidate settlement failures retain finite privacy-safe validation causes', () => {
  const cacheFailure = candidateSettlementFailure(
    new Error('Anthropic response omitted valid cache_creation_input_tokens usage.'),
    'response_validation',
  );
  assert.equal(cacheFailure.validation_failure_code, 'PROVIDER_CACHE_TOTALS_MISSING');
  assert.equal(
    cacheFailure.validation_failure_reason,
    'Cached provider response omitted required aggregate cache usage.',
  );
  assert.match(cacheFailure.settlement_error_sha256, /^[a-f0-9]{64}$/);
  assert.equal(
    candidateSettlementFailure(
      new Error('Anthropic cache-creation usage detail does not reconcile.'),
      'response_validation',
    ).validation_failure_code,
    'PROVIDER_CACHE_DETAIL_MISMATCH',
  );
  assert.equal(
    candidateSettlementFailure(new Error('Firestore unavailable'), 'settlement')
      .validation_failure_code,
    'FIRESTORE_SETTLEMENT_FAILED',
  );
});

test('provider rejection evidence hashes but never persists arbitrary provider text', () => {
  const secret = 'PRIVATE_SCREENPLAY_SENTINEL sk-ant-secret';
  const evidence = providerRejectionFailure(secret);
  assert.match(evidence.provider_error_sha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(evidence).includes(secret), false);
  assert.equal(
    evidence.validation_failure_code,
    'PROVIDER_INVALID_REQUEST_BEFORE_GENERATION',
  );
});

test('provider transport uncertainty is finite and hashes private error text', () => {
  const evidence = providerTransportFailure('PRIVATE_SCREENPLAY_SENTINEL');
  assert.equal(evidence.validation_failure_code, 'PROVIDER_TRANSPORT_UNCERTAIN');
  assert.match(evidence.provider_error_sha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(evidence).includes('PRIVATE_SCREENPLAY_SENTINEL'), false);
});

test('failed zero-spend release keeps provider and settlement failures distinct', () => {
  const evidence = providerRejectionReleaseFailure(
    'PRIVATE_PROVIDER_REASON',
    new Error('PRIVATE_FIRESTORE_REASON'),
  );
  assert.equal(
    evidence.validation_failure_code,
    'PROVIDER_REJECTION_RELEASE_UNCERTAIN',
  );
  assert.match(evidence.provider_error_sha256, /^[a-f0-9]{64}$/);
  assert.match(evidence.settlement_error_sha256, /^[a-f0-9]{64}$/);
  assert.notEqual(evidence.provider_error_sha256, evidence.settlement_error_sha256);
  assert.equal(JSON.stringify(evidence).includes('PRIVATE_PROVIDER_REASON'), false);
  assert.equal(JSON.stringify(evidence).includes('PRIVATE_FIRESTORE_REASON'), false);
});

test('provider client configuration failure is finite, hashed, and pre-dispatch', () => {
  const evidence = providerConfigurationFailure(
    new Error('PRIVATE_CONFIGURATION sk-ant-secret'),
  );
  assert.equal(
    evidence.validation_failure_code,
    'CANDIDATE_PROVIDER_CONFIGURATION_UNAVAILABLE',
  );
  assert.match(evidence.configuration_error_sha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(evidence).includes('PRIVATE_CONFIGURATION'), false);
});
