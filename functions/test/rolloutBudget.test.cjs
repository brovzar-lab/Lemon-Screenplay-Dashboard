const assert = require('node:assert/strict');
const test = require('node:test');
const { admitRolloutExposure } = require('../lib/budgetCounter');

function fixture() {
  const hashes = ['1', '2', '3', '4', '5'].map(c => c.repeat(64));
  const rollout = {
    id: 'private-five', status: 'active', worker_id: 'pilot-worker', release_sha: 'a'.repeat(40),
    limit_microusd: 50_000_000, source_limit_microusd: 10_000_000,
    admitted_exposure_microusd: 0, admitted_attempts: 0, source_sha256s: hashes,
    jobs: { one: { source_sha256: hashes[0], requested_model: 'sonnet', admitted_exposure_microusd: 0, admitted_attempts: 0 } },
  };
  const queues = { one: {
    content_hash: hashes[0], rollout_id: rollout.id, engine: 'coverage_v1',
    rollout_release_sha: rollout.release_sha, worker_release_sha: rollout.release_sha,
    worker_id: rollout.worker_id, status: 'processing', requested_model: 'sonnet', rollout_enabled: true,
  } };
  return { rollout, queues };
}

test('fixed exposure and attempts survive settlement, midnight and rejection', () => {
  const { rollout, queues } = fixture();
  Object.assign(rollout, admitRolloutExposure(rollout, queues, 'one', 4_000_000));
  Object.assign(rollout, admitRolloutExposure(rollout, queues, 'one', 4_000_000));
  assert.equal(rollout.admitted_attempts, 2);
  assert.equal(rollout.admitted_exposure_microusd, 8_000_000);
  // There is deliberately no date, refund or reset input.
  assert.throws(() => admitRolloutExposure(rollout, queues, 'one', 3_000_000), /ROLLOUT_LIMIT_REACHED/);
  Object.assign(rollout, admitRolloutExposure(rollout, queues, 'one', 1));
  assert.throws(() => admitRolloutExposure(rollout, queues, 'one', 1), /ROLLOUT_LIMIT_REACHED/);
});

test('all admitted sources reconcile and cannot exceed aggregate cap', () => {
  const { rollout, queues } = fixture();
  rollout.limit_microusd = 5_000_000;
  Object.assign(rollout, admitRolloutExposure(rollout, queues, 'one', 4_000_000));
  rollout.jobs.two = { ...rollout.jobs.one, source_sha256: rollout.source_sha256s[1], admitted_attempts: 0, admitted_exposure_microusd: 0 };
  queues.two = { ...queues.one, content_hash: rollout.source_sha256s[1] };
  assert.throws(() => admitRolloutExposure(rollout, queues, 'two', 2_000_000), /ROLLOUT_LIMIT_REACHED/);
  rollout.admitted_attempts = 0;
  assert.throws(() => admitRolloutExposure(rollout, queues, 'two', 1), /reconcile/);
});

test('missing or changed bindings fail closed without modifying counters', () => {
  for (const patch of [
    { content_hash: 'f'.repeat(64) }, { rollout_id: null }, { rollout_release_sha: 'b'.repeat(40) },
    { worker_release_sha: 'b'.repeat(40) }, { worker_id: 'other' }, { status: 'pending' },
    { requested_model: 'opus' }, { engine: 'v9' }, { rollout_enabled: false },
    { llm_active_reservation_count: 1 }, { llm_active_reservations: { expired: {} } },
    { llm_uncertain_call_count: 1 }, { uncertain_cost_microusd: 10 },
  ]) {
    const { rollout, queues } = fixture();
    Object.assign(queues.one, patch);
    assert.throws(() => admitRolloutExposure(rollout, queues, 'one', 1));
    assert.equal(rollout.admitted_attempts, 0);
  }
});

test('duplicate source jobs, malformed config and unbound jobs cannot reset allowance', () => {
  const { rollout, queues } = fixture();
  for (const patch of [
    { admitted_attempts: -1 }, { admitted_exposure_microusd: NaN }, { status: 'paused' },
    { limit_microusd: 51_000_000 }, { source_limit_microusd: 11_000_000 },
    { source_sha256s: [] }, { release_sha: 'unknown' },
  ]) assert.throws(() => admitRolloutExposure({ ...rollout, ...patch }, queues, 'one', 1));
  assert.throws(() => admitRolloutExposure(rollout, queues, 'unbound', 1));
  rollout.jobs.two = { ...rollout.jobs.one };
  queues.two = { ...queues.one };
  assert.throws(() => admitRolloutExposure(rollout, queues, 'one', 1), /mismatch/);
});
