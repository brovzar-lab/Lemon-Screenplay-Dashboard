import { VALID_COLLECTIONS, type CollectionId, type IngestModel } from './ingestQueue';

interface StoredScreenplayRecord {
  project_id?: unknown;
  latest_source_file?: unknown;
  source_file?: unknown;
  collection_id?: unknown;
  collection?: unknown;
  storage_path?: unknown;
  _storagePath?: unknown;
  storage_generation?: unknown;
}

export interface ReanalysisCopyPlan {
  screenplayId: string;
  source: {
    bucket: string;
    objectName: string;
    generation: string;
  };
  destination: {
    bucket: string;
    objectName: string;
    metadata: Record<string, string>;
  };
}

function requireDocumentId(value: string, field: string): string {
  const result = value.trim();
  if (!result || result.length > 200 || result.includes('/')) {
    throw new Error(`${field} must be a valid Firestore document ID.`);
  }
  return result;
}

function sanitizeFilename(value: string): string {
  const base = value
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  if (!base) throw new Error('The archived screenplay filename is invalid.');
  return `${base}.pdf`;
}

function parseGsPath(value: unknown): { bucket: string; objectName: string } {
  if (typeof value !== 'string' || !value.startsWith('gs://')) {
    throw new Error('This screenplay has no archived PDF available for re-analysis.');
  }
  const withoutScheme = value.slice(5);
  const slash = withoutScheme.indexOf('/');
  if (slash <= 0 || slash === withoutScheme.length - 1) {
    throw new Error('The archived PDF location is invalid.');
  }
  return {
    bucket: withoutScheme.slice(0, slash),
    objectName: withoutScheme.slice(slash + 1),
  };
}

export function buildReanalysisCopyPlan(params: {
  screenplayId: string;
  screenplay: StoredScreenplayRecord;
  requestedModel: IngestModel;
  uploadId: string;
  destinationBucket: string;
}): ReanalysisCopyPlan {
  const screenplayId = requireDocumentId(params.screenplayId, 'screenplayId');
  const projectId = typeof params.screenplay.project_id === 'string'
    ? requireDocumentId(params.screenplay.project_id, 'project_id')
    : '';
  if (projectId !== screenplayId) {
    throw new Error('The screenplay project identity does not match its parent document.');
  }
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(params.uploadId)) {
    throw new Error('uploadId must be a safe Storage path component.');
  }

  const source = parseGsPath(
    params.screenplay.storage_path ?? params.screenplay._storagePath,
  );
  const generationValue = params.screenplay.storage_generation;
  const generation = typeof generationValue === 'string' || typeof generationValue === 'number'
    ? String(generationValue).trim()
    : '';
  if (!/^\d+$/.test(generation)) {
    throw new Error('The archived PDF has no pinned Storage generation.');
  }

  const rawCollection = String(
    params.screenplay.collection_id ?? params.screenplay.collection ?? 'OTHER',
  ).toUpperCase();
  if (!(VALID_COLLECTIONS as readonly string[]).includes(rawCollection)) {
    throw new Error(`Unsupported screenplay collection: ${rawCollection}.`);
  }
  const collection = rawCollection as CollectionId;
  const filename = sanitizeFilename(String(
    params.screenplay.latest_source_file ?? params.screenplay.source_file ?? 'screenplay.pdf',
  ));

  return {
    screenplayId,
    source: { ...source, generation },
    destination: {
      bucket: params.destinationBucket,
      objectName: `ingest-queue/${collection}/${params.uploadId}/${filename}`,
      metadata: {
        originalFilename: filename,
        category: collection,
        model: params.requestedModel,
        uploadId: params.uploadId,
        targetProjectId: screenplayId,
        bypassDuplicate: 'true',
        bypassTmdb: 'true',
        requestKind: 'reanalysis',
      },
    },
  };
}
