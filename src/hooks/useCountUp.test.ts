import { StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCountUp } from './useCountUp';

// Deterministic rAF: callbacks are queued and fired manually with controlled
// timestamps so animation progress is exact.
let rafCallbacks: Map<number, FrameRequestCallback>;
let nextRafId: number;

beforeEach(() => {
  rafCallbacks = new Map();
  nextRafId = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextRafId++;
    rafCallbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks.delete(id);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Fire all pending rAF callbacks once per timestamp, in order. */
function flushFrames(timestamps: number[]) {
  for (const ts of timestamps) {
    const pending = [...rafCallbacks.values()];
    rafCallbacks.clear();
    act(() => {
      pending.forEach((cb) => cb(ts));
    });
  }
}

describe('useCountUp', () => {
  it('counts up from 0 to the target once triggered', () => {
    const { result } = renderHook(() => useCountUp(10, 600, true));
    expect(result.current).toBe(0);
    flushFrames([100, 400]);
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(10);
    flushFrames([800]);
    expect(result.current).toBe(10);
  });

  it('returns 0 while not triggered', () => {
    const { result } = renderHook(() => useCountUp(10, 600, false));
    flushFrames([100, 800]);
    expect(result.current).toBe(0);
  });

  it('reaches the target under StrictMode double-mounted effects', () => {
    // StrictMode runs effect setup -> cleanup -> setup on mount. The cleanup
    // cancels the first animation frame; the value must still reach the
    // target via the second setup instead of freezing at 0.
    const { result } = renderHook(() => useCountUp(4, 600, true), {
      wrapper: StrictMode,
    });
    flushFrames([100, 400, 800, 1500]);
    expect(result.current).toBe(4);
  });

  it('re-animates when the target changes after the first animation', () => {
    // The analytics strip passes live filtered counts as the target; when the
    // user changes filters the displayed value must follow, not stay frozen.
    const { result, rerender } = renderHook(({ t }) => useCountUp(t, 600, true), {
      initialProps: { t: 4 },
    });
    flushFrames([100, 800]);
    expect(result.current).toBe(4);

    rerender({ t: 9 });
    flushFrames([1000, 1700]);
    expect(result.current).toBe(9);
  });

  it('animates to a late-arriving target (async data after mount at 0)', () => {
    // Firestore data arrives after first render: target starts 0, then updates.
    const { result, rerender } = renderHook(({ t }) => useCountUp(t, 600, true), {
      initialProps: { t: 0 },
    });
    flushFrames([100, 800]);
    expect(result.current).toBe(0);

    rerender({ t: 17 });
    flushFrames([1000, 1700]);
    expect(result.current).toBe(17);
  });
});
