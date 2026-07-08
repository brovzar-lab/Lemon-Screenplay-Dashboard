import { useEffect, useRef, useState } from 'react';

/**
 * Module-level set tracking which card IDs have already animated their ScoreBar.
 * Persists across re-renders and re-mounts; clears on page reload.
 */
const animatedCardIds = new Set<string>();

/** Mark a card as having completed its count-up animation. */
export function markCardAnimated(cardId: string): void {
  animatedCardIds.add(cardId);
}

/** Check whether a card has already animated its count-up. */
export function hasCardAnimated(cardId: string): boolean {
  return animatedCardIds.has(cardId);
}

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useCountUp(
  target: number,
  duration: number = 600,
  trigger: boolean = true
): number {
  // Initialize to target immediately for reduced-motion users — no effect needed.
  const [value, setValue] = useState(() => (prefersReducedMotion ? target : 0));
  // Latest displayed value, so a new animation continues from where the last
  // one left off instead of restarting at 0.
  const valueRef = useRef(value);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!trigger) return;

    // Reduced-motion users get the live value with no animation.
    if (prefersReducedMotion) {
      valueRef.current = target;
      setValue(target);
      return;
    }

    const from = valueRef.current;
    if (from === target) return;

    // Local start time: StrictMode's setup→cleanup→setup cancels the first
    // frame; each effect run must restart its own clock from the current value.
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);

      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (target - from) * eased;
      valueRef.current = next;
      setValue(next);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, trigger]);

  return trigger ? value : 0;
}
