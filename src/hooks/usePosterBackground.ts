/**
 * usePosterBackground — Background poster generation hook.
 *
 * When screenplays are loaded, this hook auto-generates posters
 * in the background (one at a time, sequentially) so they're
 * ready when the user opens a modal.
 */

import { useEffect, useRef } from 'react';
import type { Screenplay } from '@/types';
import { usePosterStore } from '@/stores/posterStore';
import { generatePoster } from '@/lib/analysisService';

export function usePosterBackground(screenplays: Screenplay[]) {
    const { posters, setPosterStatus } = usePosterStore();
    const generatingRef = useRef<Set<string>>(new Set());
    const queueRef = useRef<string[]>([]);
    const activeRef = useRef(false);

    useEffect(() => {
        if (!screenplays.length) return;

        // Find screenplays that need posters
        const needsPoster = screenplays.filter((sp) => {
            const stored = posters[sp.id];
            const alreadyHas = stored?.status === 'ready' || stored?.status === 'generating';
            const alreadyQueued = generatingRef.current.has(sp.id);
            return !alreadyHas && !alreadyQueued && !sp.posterUrl;
        });

        if (!needsPoster.length) return;

        // Add to queue (don't duplicate)
        for (const sp of needsPoster) {
            if (!queueRef.current.includes(sp.id)) {
                queueRef.current.push(sp.id);
                generatingRef.current.add(sp.id);
            }
        }

        // Process queue sequentially (one at a time to avoid API rate limits)
        const processQueue = async () => {
            if (activeRef.current) return; // Already processing
            activeRef.current = true;

            while (queueRef.current.length > 0) {
                const id = queueRef.current.shift();
                if (!id) break;

                const sp = screenplays.find((s) => s.id === id);
                if (!sp) continue;

                // Check again in case it was generated while queued
                const current = usePosterStore.getState().posters[id];
                if (current?.status === 'ready') continue;

                setPosterStatus(id, 'generating');

                try {
                    const url = await generatePoster(sp.title, sp.logline, sp.genre, sp.id);
                    setPosterStatus(id, 'ready', url);
                } catch (error) {
                    console.error(`[PosterBG] Failed for "${sp.title}":`, error);
                    setPosterStatus(id, 'error');
                }

                // Small delay between requests to avoid rate limiting
                await new Promise((r) => setTimeout(r, 1000));
            }

            activeRef.current = false;
        };

        processQueue();
    }, [screenplays, posters, setPosterStatus]);
}
