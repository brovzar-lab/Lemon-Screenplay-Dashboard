const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildIngestJobId,
  parseIngestPath,
  readBooleanMetadata,
  readDependsOnUploadId,
  readOriginalFilename,
  readSeparateProject,
  readTargetProjectId,
} = require('../lib/ingestUploadIdentity');
const {
  buildPendingJob,
  parseIngestEngine,
  parseIngestModel,
} = require('../lib/ingestQueue');

test('analysis routes default only when absent and reject present invalid values', () => {
  assert.equal(parseIngestModel(undefined, 'sonnet'), 'sonnet');
  assert.equal(parseIngestModel('hybrid', 'sonnet'), 'hybrid');
  assert.throws(
    () => parseIngestModel('claude-whatever', 'sonnet'),
    /model is invalid/i,
  );
});

test('analysis engines default legacy uploads to V9 and validate explicit Coverage', () => {
  assert.equal(parseIngestEngine(undefined), 'v9');
  assert.equal(parseIngestEngine('coverage_v1'), 'coverage_v1');
  assert.throws(() => parseIngestEngine('coverage_v2'), /engine is invalid/i);
});

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
  assert.notEqual(buildIngestJobId(firstPath, '1001'), buildIngestJobId(secondPath, '1002'));
});

test('event retries for one object generation are idempotent', () => {
  const path = 'ingest-queue/LEMON/upload-one/Same_Draft.pdf';
  assert.equal(buildIngestJobId(path, '1001'), buildIngestJobId(path, '1001'));
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

test('original Unicode PDF filename survives the ASCII Storage path', () => {
  assert.equal(
    readOriginalFilename({ originalFilename: 'Hermanos Márquez.pdf' }, 'Hermanos_Mrquez.pdf'),
    'Hermanos Márquez.pdf',
  );
  assert.equal(readOriginalFilename({}, 'Fallback.pdf'), 'Fallback.pdf');
  for (const invalid of ['folder/Draft.pdf', 'folder\\Draft.pdf', 'Draft.txt', 'Draft\n.pdf']) {
    assert.throws(
      () => readOriginalFilename({ originalFilename: invalid }, 'Fallback.pdf'),
      /originalFilename/,
    );
  }
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

test('explicit separate-project choice reaches the queue without a target', () => {
  assert.equal(readSeparateProject({ separateProject: 'true' }), true);
  assert.equal(readSeparateProject({}), false);
  assert.throws(() => readSeparateProject({ separateProject: 'yes' }), /must be true or false/);

  const job = buildPendingJob({
    id: 'separate-job',
    collection_id: 'LEMON',
    filename: 'Shared_Title.pdf',
    storage_path: 'gs://bucket/ingest-queue/LEMON/separate-id/Shared_Title.pdf',
    storage_generation: '1002',
    upload_id: 'separate-id',
    target_project_id: null,
    separate_project: true,
    content_hash: 'pending',
  });

  assert.equal(job.target_project_id, null);
  assert.equal(job.separate_project, true);
});

test('reanalysis metadata reaches the queue as explicit bypass flags', () => {
  const metadata = {
    bypassDuplicate: 'true',
    bypassTmdb: 'true',
  };
  const job = buildPendingJob({
    id: 'reanalysis-job',
    collection_id: 'LEMON',
    filename: 'Draft.pdf',
    storage_path: 'gs://bucket/ingest-queue/LEMON/reanalysis-id/Draft.pdf',
    storage_generation: '1003',
    upload_id: 'reanalysis-id',
    target_project_id: 'Original_Draft.pdf',
    content_hash: 'pending',
    bypass_duplicate: readBooleanMetadata(metadata, 'bypassDuplicate'),
    bypass_tmdb: readBooleanMetadata(metadata, 'bypassTmdb'),
    request_kind: 'reanalysis',
  });

  assert.equal(job.bypass_duplicate, true);
  assert.equal(job.bypass_tmdb, true);
  assert.equal(job.request_kind, 'reanalysis');
  assert.throws(
    () => readBooleanMetadata({ bypassDuplicate: 'yes' }, 'bypassDuplicate'),
    /must be true or false/,
  );
});

test('same-batch revision dependency reaches the typed queue job', () => {
  const metadata = { dependsOnUploadId: 'parent-upload-123' };
  const dependsOnUploadId = readDependsOnUploadId(metadata);
  const job = buildPendingJob({
    id: 'child-job',
    collection_id: 'LEMON',
    filename: 'Draft_2.pdf',
    storage_path: 'gs://bucket/ingest-queue/LEMON/child-id/Draft_2.pdf',
    storage_generation: '1004',
    upload_id: 'child-id',
    target_project_id: 'Draft.pdf',
    depends_on_upload_id: dependsOnUploadId,
    engine: 'coverage_v1',
    content_hash: 'pending',
  });

  assert.equal(job.engine, 'coverage_v1');
  assert.equal(job.depends_on_upload_id, 'parent-upload-123');
  assert.throws(
    () => readDependsOnUploadId({ dependsOnUploadId: 'bad/path' }),
    /dependsOnUploadId is invalid/i,
  );
});
