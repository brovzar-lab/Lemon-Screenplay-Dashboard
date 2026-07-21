import { describe, expect, it } from 'vitest';
import {
  buildAnalysisVersionIdentity,
  buildVerifiedIdentity,
  buildVersionId,
  computeContentHash,
  requireQueuedAtMs,
  requireVerifiedIdentity,
} from './analysisIdentity';

const CONTENT_HASH = 'ab'.repeat(32);
const QUEUED_AT_MS = 1_784_588_800_123;

describe('writer identity parity', () => {
  it('uses the same verified identity shape as the daemon and CLI writers', () => {
    expect(buildVerifiedIdentity(CONTENT_HASH)).toEqual({
      content_hash: CONTENT_HASH,
      identity_status: 'verified',
    });
  });

  it('uses the same raw-byte SHA-256 algorithm as the daemon and CLI', async () => {
    await expect(computeContentHash(new Blob(['abc']))).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('rejects missing or malformed permanent identity fields', () => {
    expect(() => requireVerifiedIdentity({})).toThrow(/verified content identity/i);
    expect(() =>
      requireVerifiedIdentity({
        content_hash: 'not-a-hash',
        identity_status: 'verified',
      }),
    ).toThrow(/verified content identity/i);
  });

  it('builds the same retry-stable version ID as the Python writers', () => {
    const expected = `${CONTENT_HASH}_${QUEUED_AT_MS}`;

    expect(buildVersionId(CONTENT_HASH, QUEUED_AT_MS)).toBe(expected);
    expect(
      buildAnalysisVersionIdentity(
        {
          content_hash: CONTENT_HASH,
          identity_status: 'verified',
          queued_at_ms: QUEUED_AT_MS,
        },
        Date.now(),
      ),
    ).toEqual({
      content_hash: CONTENT_HASH,
      identity_status: 'verified',
      queued_at_ms: QUEUED_AT_MS,
      version_id: expected,
    });
  });

  it('rejects non-integer queued timestamps', () => {
    expect(() => requireQueuedAtMs(QUEUED_AT_MS + 0.5)).toThrow(/safe integer/i);
  });
});
