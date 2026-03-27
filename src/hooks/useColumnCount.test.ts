import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useColumnCount } from './useColumnCount';

/** Helper: set window.innerWidth and render the hook */
function renderWithWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true });
  return renderHook(() => useColumnCount());
}

describe('useColumnCount', () => {
  const originalWidth = window.innerWidth;

  afterEach(() => {
    // Restore original width
    Object.defineProperty(window, 'innerWidth', { value: originalWidth, writable: true, configurable: true });
  });

  it('returns 4 when window.innerWidth is 1536 (2xl breakpoint)', () => {
    const { result } = renderWithWidth(1536);
    expect(result.current).toBe(4);
  });

  it('returns 3 when window.innerWidth is 1280 (xl breakpoint)', () => {
    const { result } = renderWithWidth(1280);
    expect(result.current).toBe(3);
  });

  it('returns 2 when window.innerWidth is 640 (sm breakpoint)', () => {
    const { result } = renderWithWidth(640);
    expect(result.current).toBe(2);
  });

  it('returns 1 when window.innerWidth is 400 (mobile)', () => {
    const { result } = renderWithWidth(400);
    expect(result.current).toBe(1);
  });

  it('returns 2 when window.innerWidth is 1024 (lg breakpoint, still 2 cols)', () => {
    const { result } = renderWithWidth(1024);
    expect(result.current).toBe(2);
  });

  it('returns 4 for very wide screens (e.g. 2560)', () => {
    const { result } = renderWithWidth(2560);
    expect(result.current).toBe(4);
  });
});
