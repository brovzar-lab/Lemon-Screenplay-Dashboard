const assert = require('node:assert/strict');
const test = require('node:test');

test('real emulator transactions isolate concurrent admissions and retain lifetime limits', {
  skip: process.env.LEMON_ROLLOUT_EMULATOR !== '1',
}, async (t) => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(localhost|127\.0\.0\.1):\d+$/);
  const { initializeApp } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  initializeApp({ projectId: 'demo-lemon-rollout' });
  const db = getFirestore();
  const { reserveLlmBudget, settleLlmBudget, releaseLlmBudget } = require('../lib/budgetCounter');
  const jobId = 'rollout-emulator-job';
  const rolloutRef = db.doc('system/coverage-rollout-emulator');
  const queueRef = db.doc(`ingest-queue/${jobId}`);
  const hashes = ['1', '2', '3', '4', '5'].map(c => c.repeat(64));
  await queueRef.set({
    status: 'processing', engine: 'coverage_v1', rollout_id: 'emulator', rollout_enabled: true,
    rollout_release_sha: 'a'.repeat(40), worker_release_sha: 'a'.repeat(40), worker_id: 'pilot',
    requested_model: 'sonnet', content_hash: hashes[0],
  });
  await rolloutRef.set({
    id: 'emulator', status: 'active', release_sha: 'a'.repeat(40), worker_id: 'pilot',
    limit_microusd: 50_000_000, source_limit_microusd: 10_000_000, source_sha256s: hashes,
    admitted_exposure_microusd: 0, admitted_attempts: 0,
    jobs: { [jobId]: { source_sha256: hashes[0], requested_model: 'sonnet', admitted_exposure_microusd: 0, admitted_attempts: 0 } },
  });
  const params = { model: 'claude-haiku-4-5-20251001', requestBytes: 1000, maxOutputTokens: 256, limitMicrousd: 100_000_000, jobId };
  try {
    const results = await Promise.allSettled([reserveLlmBudget(params), reserveLlmBudget(params)]);
    const fulfilled = results.filter(r => r.status === 'fulfilled');
    assert.equal(fulfilled.length, 1);
    const first = fulfilled[0].value;
    assert.equal((await rolloutRef.get()).data().admitted_attempts, 1);
    const tomorrow = Date.now() + 86_400_000;
    t.mock.method(Date, 'now', () => tomorrow);
    await assert.rejects(reserveLlmBudget(params), /unresolved accounting/);
    t.mock.restoreAll();
    const usage = { input_tokens: 10, output_tokens: 2, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
    await settleLlmBudget(first, usage);
    await settleLlmBudget(first, usage); // Idempotent accounting does not reopen admission.
    assert.equal((await rolloutRef.get()).data().admitted_attempts, 1);
    assert.equal((await queueRef.get()).data().llm_active_reservation_count, 0);
    const second = await reserveLlmBudget(params);
    await releaseLlmBudget(second, 'provider_invalid_request_before_generation', 'synthetic rejection');
    const held = (await rolloutRef.get()).data();
    assert.equal(held.admitted_attempts, 2);
    assert.equal(held.admitted_exposure_microusd, first.reserved_microusd + second.reserved_microusd);
    await queueRef.update({ worker_id: 'wrong-worker' });
    await assert.rejects(reserveLlmBudget(params), /worker or model mismatch/);
    assert.equal((await rolloutRef.get()).data().admitted_attempts, 2);
    const stale = await queueRef.get();
    await queueRef.update({ rollout_enabled: false });
    const staleUiBatch = db.batch();
    staleUiBatch.update(queueRef, { status: 'pending', requested_model: 'opus' }, { lastUpdateTime: stale.updateTime });
    await assert.rejects(staleUiBatch.commit());
    assert.equal((await queueRef.get()).data().status, 'processing');
  } finally {
    await db.terminate();
  }
});
