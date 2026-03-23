/**
 * usePdfScan
 *
 * Shared hook to trigger a Firebase Storage scan for PDF existence.
 * Populates pdfStatusStore so both "Has PDF" and "Missing PDF" filters
 * work immediately without requiring the user to open Settings → PDF Files.
 *
 * The scan runs at most once per session (tracked by hasScanResult in the store).
 */

import { useCallback, useRef } from 'react';
import { ref, getMetadata } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { usePdfStatusStore } from '@/stores/pdfStatusStore';
import { buildStoragePath } from '@/components/settings/pdfUploadPanel.helpers';
import type { Screenplay } from '@/types';

export function usePdfScan() {
    const hasScanResult = usePdfStatusStore((s) => s.hasScanResult);
    const isScanning = usePdfStatusStore((s) => s.isScanning);
    const setBulkStatuses = usePdfStatusStore((s) => s.setBulkStatuses);
    const setIsScanning = usePdfStatusStore((s) => s.setIsScanning);
    const scanStarted = useRef(false);

    const triggerScan = useCallback(
        async (screenplays: Screenplay[]) => {
            // Skip if already scanned or currently scanning
            if (hasScanResult || isScanning || scanStarted.current) return;
            if (!screenplays || screenplays.length === 0) return;

            scanStarted.current = true;
            setIsScanning(true);

            const batchSize = 10;
            const batchResults: Record<string, 'found' | 'missing'> = {};

            for (let i = 0; i < screenplays.length; i += batchSize) {
                const batch = screenplays.slice(i, i + batchSize);
                await Promise.allSettled(
                    batch.map(async (sp) => {
                        const path = buildStoragePath(sp);
                        try {
                            await getMetadata(ref(storage, path));
                            batchResults[sp.id] = 'found';
                        } catch {
                            batchResults[sp.id] = 'missing';
                        }
                    })
                );
            }

            setBulkStatuses(batchResults);
            setIsScanning(false);
        },
        [hasScanResult, isScanning, setBulkStatuses, setIsScanning]
    );

    return { triggerScan, hasScanResult, isScanning };
}
