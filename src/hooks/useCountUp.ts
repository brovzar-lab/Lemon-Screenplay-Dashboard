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
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const hasAnimated = useRef(false);

  useEffect(() => {
    // Reduced-motion users skip the animation — their value is already initialized
    // to `target` in useState(), so there's nothing to do in the effect for that case.
    if (prefersReducedMotion) return;

    if (!trigger || hasAnimated.current || target === 0) return;

    hasAnimated.current = true;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * target);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setValue(target);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, trigger]);

  return trigger ? value : 0;
}
