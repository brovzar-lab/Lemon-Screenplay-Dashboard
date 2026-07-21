import { describe, expect, it } from 'vitest';
import {
  buildVerifiedIdentity,
  computeContentHash,
  requireVerifiedIdentity,
} from './analysisIdentity';

const CONTENT_HASH = 'ab'.repeat(32);

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
});
