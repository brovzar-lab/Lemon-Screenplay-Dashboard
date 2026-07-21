export interface VerifiedAnalysisIdentity {
  content_hash: string;
  identity_status: 'verified';
}

export interface AnalysisVersionIdentity extends VerifiedAnalysisIdentity {
  queued_at_ms: number;
  version_id: string;
}

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export async function computeContentHash(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function buildVerifiedIdentity(contentHash: string): VerifiedAnalysisIdentity {
  if (!SHA256_HEX_PATTERN.test(contentHash)) {
    throw new Error('A verified content identity requires a lowercase SHA-256 hash.');
  }
  return {
    content_hash: contentHash,
    identity_status: 'verified',
  };
}

export function requireVerifiedIdentity(record: Record<string, unknown>): VerifiedAnalysisIdentity {
  if (
    record.identity_status !== 'verified' ||
    typeof record.content_hash !== 'string' ||
    !SHA256_HEX_PATTERN.test(record.content_hash)
  ) {
    throw new Error('Permanent V9 coverage requires a verified content identity.');
  }
  return buildVerifiedIdentity(record.content_hash);
}

export function requireQueuedAtMs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error('queued_at_ms must be a positive safe integer.');
  }
  return value;
}

export function buildVersionId(contentHash: string, queuedAtMs: number): string {
  const identity = buildVerifiedIdentity(contentHash);
  return `${identity.content_hash}_${requireQueuedAtMs(queuedAtMs)}`;
}

export function buildAnalysisVersionIdentity(
  record: Record<string, unknown>,
  fallbackQueuedAtMs: number,
): AnalysisVersionIdentity {
  const identity = requireVerifiedIdentity(record);
  const queuedAtMs = requireQueuedAtMs(record.queued_at_ms ?? fallbackQueuedAtMs);
  return {
    ...identity,
    queued_at_ms: queuedAtMs,
    version_id: buildVersionId(identity.content_hash, queuedAtMs),
  };
}
