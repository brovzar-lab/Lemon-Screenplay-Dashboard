import { describe, expect, it } from 'vitest';

import { getAuthErrorKey } from '@/stores/authStore';

describe('getAuthErrorKey', () => {
  it('maps known Firebase codes to safe application errors', () => {
    expect(getAuthErrorKey({ code: 'auth/network-request-failed' })).toBe('auth.error.network');
  });

  it('never exposes raw provider error text', () => {
    expect(getAuthErrorKey(new Error('RAW FIREBASE PROVIDER MESSAGE'))).toBe('auth.error.generic');
  });
});
