const assert = require('node:assert/strict');
const test = require('node:test');

const { buildReanalysisCopyPlan } = require('../lib/reanalysisQueue');

test('reanalysis copies the archived version into a unique ingest job', () => {
  const plan = buildReanalysisCopyPlan({
    screenplayId: 'Original_Draft.pdf',
    screenplay: {
      project_id: 'Original_Draft.pdf',
      latest_source_file: 'Renamed_Draft.pdf',
      collection_id: 'LEMON',
      storage_path: 'gs://archive-bucket/screenplays/Original_Draft.pdf/versions/hash_1000.pdf',
      storage_generation: '998877',
    },
    requestedModel: 'opus',
    uploadId: 'reanalysis-upload-id',
    destinationBucket: 'lemon-screenplay-dashboard.firebasestorage.app',
  });

  assert.equal(plan.source.bucket, 'archive-bucket');
  assert.equal(
    plan.source.objectName,
    'screenplays/Original_Draft.pdf/versions/hash_1000.pdf',
  );
  assert.equal(plan.source.generation, '998877');
  assert.equal(
    plan.destination.objectName,
    'ingest-queue/LEMON/reanalysis-upload-id/Renamed_Draft.pdf',
  );
  assert.deepEqual(plan.destination.metadata, {
    originalFilename: 'Renamed_Draft.pdf',
    category: 'LEMON',
    model: 'opus',
    uploadId: 'reanalysis-upload-id',
    targetProjectId: 'Original_Draft.pdf',
    bypassDuplicate: 'true',
    bypassTmdb: 'true',
    requestKind: 'reanalysis',
  });
});

test('reanalysis rejects a missing immutable PDF pointer', () => {
  assert.throws(
    () => buildReanalysisCopyPlan({
      screenplayId: 'Legacy.pdf',
      screenplay: { project_id: 'Legacy.pdf', collection_id: 'LEMON' },
      requestedModel: 'sonnet',
      uploadId: 'reanalysis-upload-id',
      destinationBucket: 'lemon-screenplay-dashboard.firebasestorage.app',
    }),
    /archived PDF/i,
  );
});

test('reanalysis requires the stable parent id to match the requested project', () => {
  assert.throws(
    () => buildReanalysisCopyPlan({
      screenplayId: 'Expected.pdf',
      screenplay: {
        project_id: 'Different.pdf',
        collection_id: 'LEMON',
        storage_path: 'gs://bucket/screenplays/Different.pdf/versions/hash_1000.pdf',
        storage_generation: '123',
      },
      requestedModel: 'sonnet',
      uploadId: 'reanalysis-upload-id',
      destinationBucket: 'lemon-screenplay-dashboard.firebasestorage.app',
    }),
    /project identity/i,
  );
});
