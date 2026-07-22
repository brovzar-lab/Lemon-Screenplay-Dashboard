const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DailyBudgetExceededError,
  admitBudgetReservation,
  normalizeBudgetLedger,
  settleBudgetReservationInLedger,
} = require('../lib/budgetCounter');

function ledger(limit = 1_000_000) {
  return normalizeBudgetLedger(undefined, '2026-07-21', limit);
}

test('concurrent reservations cannot cross the daily dollar ceiling', () => {
  const first = admitBudgetReservation(
    ledger(1_000_000),
    'first',
    {
      reserved_microusd: 700_000,
      expires_at_ms: 10_000,
      model: 'claude-sonnet-4-6',
      job_id: 'job-1',
    },
    1_000,
  );

  assert.throws(
    () => admitBudgetReservation(
      first,
      'second',
      {
        reserved_microusd: 400_000,
        expires_at_ms: 10_000,
        model: 'claude-opus-4-7',
        job_id: 'job-2',
      },
      1_000,
    ),
    DailyBudgetExceededError,
  );
});

test('expired reservations are reclaimed before admitting new work', () => {
  const stale = {
    ...ledger(1_000_000),
    reserved_microusd: 900_000,
    active_reservations: {
      stale: {
        reserved_microusd: 900_000,
        expires_at_ms: 999,
        model: 'claude-sonnet-4-6',
        job_id: null,
      },
    },
  };
  const admitted = admitBudgetReservation(
    stale,
    'fresh',
    {
      reserved_microusd: 500_000,
      expires_at_ms: 10_000,
      model: 'claude-sonnet-4-6',
      job_id: null,
    },
    1_000,
  );

  assert.equal(admitted.reserved_microusd, 500_000);
  assert.deepEqual(Object.keys(admitted.active_reservations), ['fresh']);
});

test('settlement records exact calls, tokens, model, and dollars', () => {
  const reserved = admitBudgetReservation(
    ledger(1_000_000),
    'call-one',
    {
      reserved_microusd: 500_000,
      expires_at_ms: 10_000,
      model: 'claude-opus-4-7',
      job_id: 'job-1',
    },
    1_000,
  );
  const usage = {
    input_tokens: 1_000,
    output_tokens: 100,
    cache_creation_input_tokens: 200,
    cache_read_input_tokens: 300,
  };
  const settled = settleBudgetReservationInLedger(
    reserved,
    'call-one',
    'claude-opus-4-7',
    usage,
    9_000,
    2_000,
  );

  assert.equal(settled.call_count, 1);
  assert.equal(settled.spent_microusd, 9_000);
  assert.equal(settled.reserved_microusd, 0);
  assert.deepEqual(settled.by_model['claude-opus-4-7'], {
    call_count: 1,
    ...usage,
    actual_cost_microusd: 9_000,
  });
});
