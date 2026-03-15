import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useCountUp(
  target: number,
  duration: number = 600,
  trigger: boolean = true
): number {
  const [value, setValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (prefersReducedMotion) {
      setValue(target);
      return;
    }

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
