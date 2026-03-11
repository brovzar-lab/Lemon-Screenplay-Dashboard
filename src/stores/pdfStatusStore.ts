/**
 * PDF Status Store
 *
 * Holds live Firebase Storage check results for every screenplay.
 * Populated by PdfUploadPanel when it scans Storage.
 * Read by useFilteredScreenplays for the "No PDF linked" filter.
 *
 * This solves the core problem: hasPdf in Firestore is only written after
 * an explicit "Rescan & Sync". This store gives the filter immediate,
 * accurate data the moment the PDF Files panel performs a scan.
 */

import { create } from 'zustand';

export type PdfStorageStatus = 'checking' | 'found' | 'missing';

interface PdfStatusState {
    /** screenplayId → storage status */
    statuses: Record<string, PdfStorageStatus>;
    /** true while a scan is in progress */
    isScanning: boolean;
    /** true once at least one scan has completed */
    hasScanResult: boolean;

    setStatus: (id: string, status: PdfStorageStatus) => void;
    setBulkStatuses: (updates: Record<string, PdfStorageStatus>) => void;
    setIsScanning: (scanning: boolean) => void;
    clearStatuses: () => void;
}

export const usePdfStatusStore = create<PdfStatusState>()((set) => ({
    statuses: {},
    isScanning: false,
    hasScanResult: false,

    setStatus: (id, status) =>
        set((state) => ({
            statuses: { ...state.statuses, [id]: status },
        })),

    setBulkStatuses: (updates) =>
        set((state) => ({
            statuses: { ...state.statuses, ...updates },
            hasScanResult: true,
        })),

    setIsScanning: (scanning) => set({ isScanning: scanning }),

    clearStatuses: () => set({ statuses: {}, hasScanResult: false }),
}));
