const assert = require('node:assert/strict');
const test = require('node:test');

const {
  calculateActualCostMicrousd,
  calculateReservationMicrousd,
  parseDailyBudgetUsd,
} = require('../lib/llmCost');

test('actual cost uses the approved per-model and cache rates', () => {
  const usage = {
    input_tokens: 1_000,
    output_tokens: 500,
    cache_creation_input_tokens: 200,
    cache_read_input_tokens: 100,
  };

  assert.equal(calculateActualCostMicrousd('claude-haiku-4-5-20251001', usage), 3_760);
  assert.equal(calculateActualCostMicrousd('claude-sonnet-4-6', usage), 11_280);
  assert.equal(calculateActualCostMicrousd('claude-opus-4-7', usage), 18_800);
});

test('a hybrid Sonnet and Opus run is the sum of both real model costs', () => {
  const sonnetUsage = {
    input_tokens: 10_000,
    output_tokens: 2_000,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };
  const opusUsage = {
    input_tokens: 8_000,
    output_tokens: 3_000,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };

  const hybridCost =
    calculateActualCostMicrousd('claude-sonnet-4-6', sonnetUsage)
    + calculateActualCostMicrousd('claude-opus-4-7', opusUsage);

  assert.equal(hybridCost, 175_000);
  assert.notEqual(
    hybridCost,
    calculateActualCostMicrousd('claude-sonnet-4-6', {
      input_tokens: 18_000,
      output_tokens: 5_000,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    }),
  );
});

test('reservation is conservative enough to cover the maximum response', () => {
  const reservation = calculateReservationMicrousd(
    'claude-sonnet-4-6',
    100_000,
    8_000,
  );
  const maximumRepresentedCost = calculateActualCostMicrousd('claude-sonnet-4-6', {
    input_tokens: 100_000,
    output_tokens: 8_000,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  });

  assert.ok(reservation >= maximumRepresentedCost);
});

test('daily dollar limit rejects malformed or unsafe configuration', () => {
  assert.equal(parseDailyBudgetUsd('100'), 100);
  assert.equal(parseDailyBudgetUsd('12.50'), 12.5);
  assert.throws(() => parseDailyBudgetUsd('0'), /between 0 and 100000/);
  assert.throws(() => parseDailyBudgetUsd('not-money'), /between 0 and 100000/);
});
