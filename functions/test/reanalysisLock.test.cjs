const assert = require('node:assert/strict');
const test = require('node:test');

const {
  acquireReanalysisLock,
  markReanalysisLockQueued,
} = require('../lib/reanalysisLock');

function createMemoryRepository() {
  let current = null;
  let tail = Promise.resolve();
  const jobStatuses = new Map();

  return {
    transact(_projectId, update) {
      const operation = tail.then(() => {
        const status = current ? (jobStatuses.get(current.storagePath) ?? null) : null;
        const transition = update(current, status);
        if (Object.hasOwn(transition, 'next')) current = transition.next;
        return transition.result;
      });
      tail = operation.then(() => undefined, () => undefined);
      return operation;
    },
    setJobStatus(storagePath, status) {
      jobStatuses.set(storagePath, status);
    },
  };
}

function candidate(uploadId, storagePath) {
  return {
    projectId: 'Project.pdf',
    uploadId,
    storagePath,
    state: 'preparing',
    createdAtMs: 1_000,
  };
}

test('concurrent requests for one project acquire only one paid queue slot', async () => {
  const repository = createMemoryRepository();
  const firstCandidate = candidate('upload-first', 'gs://bucket/first.pdf');
  const secondCandidate = candidate('upload-second', 'gs://bucket/second.pdf');

  const results = await Promise.all([
    acquireReanalysisLock(repository, firstCandidate, 1_000),
    acquireReanalysisLock(repository, secondCandidate, 1_000),
  ]);

  assert.equal(results.filter((result) => result.kind === 'acquired').length, 1);
  assert.equal(results.filter((result) => result.kind === 'busy').length, 1);
});

test('active work coalesces, then completed work permits a fresh re-analysis', async () => {
  const repository = createMemoryRepository();
  const first = candidate('upload-first', 'gs://bucket/first.pdf');
  assert.equal((await acquireReanalysisLock(repository, first, 1_000)).kind, 'acquired');
  await markReanalysisLockQueued(repository, first.projectId, first.uploadId);
  repository.setJobStatus(first.storagePath, 'processing');

  const coalesced = await acquireReanalysisLock(
    repository,
    candidate('upload-second', 'gs://bucket/second.pdf'),
    2_000,
  );
  assert.deepEqual(coalesced, {
    kind: 'coalesced',
    storagePath: first.storagePath,
  });

  repository.setJobStatus(first.storagePath, 'complete');
  const fresh = await acquireReanalysisLock(
    repository,
    candidate('upload-third', 'gs://bucket/third.pdf'),
    3_000,
  );
  assert.equal(fresh.kind, 'acquired');
  assert.equal(fresh.storagePath, 'gs://bucket/third.pdf');
});
