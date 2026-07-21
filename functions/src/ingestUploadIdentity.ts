import { createHash } from 'node:crypto';
import { VALID_COLLECTIONS, type CollectionId } from './ingestQueue';

export interface ParsedIngestPath {
  collection_id: CollectionId;
  upload_id: string | null;
  filename: string;
}

/** Accept current upload-ID paths and legacy three-segment paths. */
export function parseIngestPath(objectName: string): ParsedIngestPath | null {
  const name = objectName.startsWith('/') ? objectName.slice(1) : objectName;
  const parts = name.split('/');
  const isLegacy = parts.length === 3;
  const isCurrent = parts.length === 4;

  if ((!isLegacy && !isCurrent) || parts[0] !== 'ingest-queue') return null;

  const rawCollection = parts[1].toUpperCase();
  if (!(VALID_COLLECTIONS as readonly string[]).includes(rawCollection)) return null;

  const uploadId = isCurrent ? parts[2] : null;
  const filename = isCurrent ? parts[3] : parts[2];
  if (!filename || !filename.toLowerCase().endsWith('.pdf')) return null;
  if (uploadId !== null && !/^[a-zA-Z0-9_-]{8,128}$/.test(uploadId)) return null;

  return {
    collection_id: rawCollection as CollectionId,
    upload_id: uploadId,
    filename,
  };
}

/** One object generation maps to one deterministic queue document. */
export function buildIngestJobId(objectName: string, storageGeneration: string): string {
  if (!storageGeneration.trim()) {
    throw new Error('Storage generation is required for ingest idempotency.');
  }
  const digest = createHash('sha256')
    .update(objectName)
    .update('\0')
    .update(storageGeneration)
    .digest('hex');
  return `upload_${digest}`;
}

/** Read an optional stable parent ID from trusted upload metadata. */
export function readTargetProjectId(
  metadata: Record<string, string | undefined>,
): string | null {
  const raw = metadata.targetProjectId;
  if (!raw) return null;

  const targetProjectId = raw.trim();
  if (
    !targetProjectId ||
    targetProjectId.length > 200 ||
    targetProjectId.includes('/')
  ) {
    throw new Error('Storage metadata targetProjectId is not a valid Firestore document ID.');
  }
  return targetProjectId;
}

/** Read the user's explicit choice to keep a title collision separate. */
export function readSeparateProject(
  metadata: Record<string, string | undefined>,
): boolean {
  const raw = metadata.separateProject;
  if (raw == null || raw === 'false') return false;
  if (raw === 'true') return true;
  throw new Error('Storage metadata separateProject must be true or false.');
}
