import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importWithReload, isChunkLoadError } from './lazyWithReload';

describe('lazy route recovery', () => {
  beforeEach(() => sessionStorage.clear());

  it('recognizes stale deployment chunk failures', () => {
    expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('ordinary render failure'))).toBe(false);
  });

  it('does not hide a repeated or unrelated failure', async () => {
    sessionStorage.setItem('lemon-lazy-retry:settings', '1');
    const failure = new Error('Failed to fetch dynamically imported module');

    await expect(importWithReload('settings', vi.fn().mockRejectedValue(failure))).rejects.toBe(failure);
    expect(sessionStorage.getItem('lemon-lazy-retry:settings')).toBeNull();
  });

  it('clears the retry marker after a successful load', async () => {
    sessionStorage.setItem('lemon-lazy-retry:settings', '1');
    const module = { default: () => null };

    await expect(importWithReload('settings', async () => module)).resolves.toBe(module);
    expect(sessionStorage.getItem('lemon-lazy-retry:settings')).toBeNull();
  });
});
