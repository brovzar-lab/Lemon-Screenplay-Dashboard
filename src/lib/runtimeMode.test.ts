import { describe, expect, it } from 'vitest';
import { isLocalE2E } from '@/lib/runtimeMode';

describe('local E2E isolation', () => {
  it('requires both the E2E flag and a loopback hostname', () => {
    expect(isLocalE2E('lemon-screenplay-dashboard.web.app', true)).toBe(false);
    expect(isLocalE2E('localhost', false)).toBe(false);
    expect(isLocalE2E('localhost', true)).toBe(true);
    expect(isLocalE2E('127.0.0.1', true)).toBe(true);
  });
});
