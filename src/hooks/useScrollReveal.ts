/**
 * useScrollReveal — IntersectionObserver hook for scroll-triggered reveals.
 *
 * Observes child elements of a container and adds `data-revealed="true"`
 * when they enter the viewport. Pairs with CSS that triggers entrance
 * animations on the `[data-revealed]` selector.
 *
 * Options:
 *   threshold  — visibility % to trigger (default 0.1 = 10%)
 *   rootMargin — extend/shrink the trigger area (default "0px 0px -40px 0px")
 *   once       — stop observing after first reveal (default true)
 */

import { useEffect, useRef, useCallback } from 'react';

interface ScrollRevealOptions {
    threshold?: number;
    rootMargin?: string;
    once?: boolean;
    selector?: string;
}

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
    options: ScrollRevealOptions = {}
) {
    const {
        threshold = 0.1,
        rootMargin = '0px 0px -40px 0px',
        once = true,
        selector = '[data-reveal]',
    } = options;

    const containerRef = useRef<T>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    const observe = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        // Disconnect any previous observer
        observerRef.current?.disconnect();

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const el = entry.target as HTMLElement;
                        el.dataset.revealed = 'true';
                        if (once) observer.unobserve(el);
                    }
                });
            },
            { threshold, rootMargin }
        );

        // Observe all matching children
        container.querySelectorAll<HTMLElement>(selector).forEach((el) => {
            // Skip already-revealed elements (e.g., after re-render)
            if (el.dataset.revealed !== 'true') {
                observer.observe(el);
            }
        });

        observerRef.current = observer;
    }, [threshold, rootMargin, once, selector]);

    useEffect(() => {
        // Use requestAnimationFrame to ensure DOM has painted
        const raf = requestAnimationFrame(observe);
        return () => {
            cancelAnimationFrame(raf);
            observerRef.current?.disconnect();
        };
    }, [observe]);

    // Re-observe when children change (call this after data updates)
    const refresh = useCallback(() => {
        requestAnimationFrame(observe);
    }, [observe]);

    return { containerRef, refresh };
}
