const assert = require('node:assert/strict');
const test = require('node:test');

const {
  benchmarkUncertainAccounting,
  isolationApp,
  isPermissionDenied,
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
