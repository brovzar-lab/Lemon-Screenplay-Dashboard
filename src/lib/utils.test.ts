import { describe, it, expect } from 'vitest';
import { safeJsonParse } from './utils';

describe('safeJsonParse', () => {
  it('returns parsed object for valid JSON string', () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
  });

  it('returns fallback for corrupt/invalid JSON string', () => {
    expect(safeJsonParse('not json', [])).toEqual([]);
  });

  it('returns fallback for null input', () => {
    expect(safeJsonParse(null, 'default')).toBe('default');
  });

  it('returns fallback for undefined input', () => {
    expect(safeJsonParse(undefined, 0)).toBe(0);
  });

  it('returns fallback for empty string', () => {
    expect(safeJsonParse('', {})).toEqual({});
  });

  it('returns parsed array for valid JSON array', () => {
    expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3]);
  });

  it('preserves fallback type (number fallback returns number)', () => {
    const result = safeJsonParse('invalid', 42);
    expect(result).toBe(42);
    expect(typeof result).toBe('number');
  });
});
