const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildIngestJobId,
  parseIngestPath,
  readTargetProjectId,
} = require('../lib/ingestUploadIdentity');
const { buildPendingJob } = require('../lib/ingestQueue');

test('same filename revisions create different queue jobs', () => {
  const firstPath = 'ingest-queue/LEMON/upload-one/Same_Draft.pdf';
  const secondPath = 'ingest-queue/LEMON/upload-two/Same_Draft.pdf';

  assert.deepEqual(parseIngestPath(firstPath), {
    collection_id: 'LEMON',
    upload_id: 'upload-one',
    filename: 'Same_Draft.pdf',
  });
  assert.deepEqual(parseIngestPath(secondPath), {
    collection_id: 'LEMON',
    upload_id: 'upload-two',
    filename: 'Same_Draft.pdf',
  });
  assert.notEqual(
    buildIngestJobId(firstPath, '1001'),
    buildIngestJobId(secondPath, '1002'),
  );
});

test('event retries for one object generation are idempotent', () => {
  const path = 'ingest-queue/LEMON/upload-one/Same_Draft.pdf';
  assert.equal(
    buildIngestJobId(path, '1001'),
    buildIngestJobId(path, '1001'),
  );
});

test('legacy three-segment ingest paths remain accepted', () => {
  const legacyPath = 'ingest-queue/LEMON/Legacy_Draft.pdf';
  assert.deepEqual(parseIngestPath(legacyPath), {
    collection_id: 'LEMON',
    upload_id: null,
    filename: 'Legacy_Draft.pdf',
  });
  assert.notEqual(
    buildIngestJobId(legacyPath, 'old-generation'),
    buildIngestJobId(legacyPath, 'new-generation'),
  );
});

test('renamed revision target is accepted only as a Firestore document id', () => {
  assert.equal(
    readTargetProjectId({ targetProjectId: 'Original_Draft.pdf' }),
    'Original_Draft.pdf',
  );
  assert.throws(
    () => readTargetProjectId({ targetProjectId: 'projects/Original_Draft.pdf' }),
    /targetProjectId/,
  );
});

test('queue document preserves upload identity and renamed revision target', () => {
  const job = buildPendingJob({
    id: 'job-id',
    collection_id: 'LEMON',
    filename: 'Renamed_Draft.pdf',
    storage_path: 'gs://bucket/ingest-queue/LEMON/upload-id/Renamed_Draft.pdf',
    storage_generation: '1001',
    upload_id: 'upload-id',
    target_project_id: 'Original_Draft.pdf',
    content_hash: 'pending',
  });

  assert.equal(job.storage_generation, '1001');
  assert.equal(job.upload_id, 'upload-id');
  assert.equal(job.target_project_id, 'Original_Draft.pdf');
});
