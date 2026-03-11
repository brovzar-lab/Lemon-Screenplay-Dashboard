/**
 * PDF Upload Panel
 * Checks Firebase Storage for existing PDFs (using the same path ModalHeader uses),
 * allows drag-and-drop uploads, and syncs hasPdf status to Firestore.
 *
 * ROOT-CAUSE FIX: previously relied on a `hasPdf` Firestore field that was
 * never written for pre-existing screenplays. Now does live getMetadata checks
 * with the title-based path (screen screenplays/{CATEGORY}/{safe_title}.pdf)
 * — identical to what ModalHeader builds when the PDF button is clicked.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, getMetadata } from 'firebase/storage';
import { useQueryClient } from '@tanstack/react-query';
import { db, storage, uploadScreenplayPdf } from '@/lib/firebase';
import { useScreenplays, useDeleteScreenplays, SCREENPLAYS_QUERY_KEY } from '@/hooks/useScreenplays';
import { usePdfStatusStore } from '@/stores/pdfStatusStore';
import type { Screenplay } from '@/types';

// ─── Firestore / Storage helpers ──────────────────────────────────────────────

const FIRESTORE_COLLECTION = 'screenplays';

/** Mirror the toDocId logic from analysisStore.ts */
function toDocId(sourceFile: string): string {
    return String(sourceFile || '')
        .replace(/\\/g, '/')
        .split('/')
        .pop()!
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '')
        .slice(0, 200) || `doc_${Date.now()}`;
}

/**
 * Build the Firebase Storage path for a screenplay's PDF.
 * MUST match the logic in ModalHeader.tsx handleDownloadPdf exactly.
 */
export function buildStoragePath(screenplay: Screenplay): string {
    const category = screenplay.category || 'OTHER';
    const safeName = (screenplay.title || screenplay.sourceFile || 'untitled')
        .replace(/\.pdf$/i, '')
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .trim()
        .replace(/\s+/g, '_');
    return `screenplays/${category}/${safeName}.pdf`;
}

// ─── Filename matching ────────────────────────────────────────────────────────

function matchScore(droppedName: string, screenplay: Screenplay): number {
    const normalize = (s: string) =>
        s.toLowerCase()
            .replace(/\.pdf$/i, '')
            .replace(/[_\s-]+/g, ' ')
            .trim();

    const dropped = normalize(droppedName);
    const title = normalize(screenplay.title);
    const source = normalize(screenplay.sourceFile);

    if (dropped === title || dropped === source) return 100;
    if (title.includes(dropped) || dropped.includes(title)) return 80;
    if (source.includes(dropped) || dropped.includes(source)) return 70;

    const droppedWords = new Set(dropped.split(' ').filter(Boolean));
    const titleWords = title.split(' ').filter(Boolean);
    const matched = titleWords.filter((w) => droppedWords.has(w)).length;
    if (matched > 0) return Math.min(60, matched * 25);

    return 0;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type StorageStatus = 'checking' | 'found' | 'missing' | 'error';
type UploadState = 'idle' | 'uploading' | 'done' | 'error';

// ─── Component ────────────────────────────────────────────────────────────────

export function PdfUploadPanel() {
    const { data: screenplays, isLoading } = useScreenplays();
    const queryClient = useQueryClient();
    const deleteMutation = useDeleteScreenplays();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { setBulkStatuses, setStatus: setPdfStoreStatus, setIsScanning: setPdfStoreScanning } = usePdfStatusStore();

    // Per-row inline delete confirmation: screenplayId → true
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // Live storage check results: screenplayId → status
    const [storageStatuses, setStorageStatuses] = useState<Record<string, StorageStatus>>({});
    const [isScanning, setIsScanning] = useState(false);
    const [uploadEntries, setUploadEntries] = useState<Record<string, { state: UploadState; error?: string }>>({});

    // Upload confirmation flow
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [manualPickId, setManualPickId] = useState('');
    const [dragActive, setDragActive] = useState(false);

    // UI state
    const [searchQuery, setSearchQuery] = useState('');
    const [showMissingOnly, setShowMissingOnly] = useState(false);

    // ─── Live storage scan ──────────────────────────────────────────────────

    const checkStoragePaths = useCallback(async (list: Screenplay[]) => {
        if (list.length === 0) return;

        // Set all to 'checking'
        setStorageStatuses((prev) => {
            const next = { ...prev };
            for (const s of list) next[s.id] = 'checking';
            return next;
        });

        // Batch in groups of 5 to avoid overwhelming Firebase
        const batchSize = 5;
        const batchResults: Record<string, 'found' | 'missing'> = {};

        for (let i = 0; i < list.length; i += batchSize) {
            const batch = list.slice(i, i + batchSize);
            await Promise.allSettled(
                batch.map(async (screenplay) => {
                    try {
                        const path = buildStoragePath(screenplay);
                        await getMetadata(ref(storage, path));
                        setStorageStatuses((prev) => ({ ...prev, [screenplay.id]: 'found' }));
                        batchResults[screenplay.id] = 'found';
                    } catch {
                        setStorageStatuses((prev) => ({ ...prev, [screenplay.id]: 'missing' }));
                        batchResults[screenplay.id] = 'missing';
                    }
                })
            );
            // Small delay between batches
            if (i + batchSize < list.length) {
                await new Promise((r) => setTimeout(r, 200));
            }
        }

        // Write all results to shared store so the filter pipeline reacts
        setBulkStatuses(batchResults);
    }, [setBulkStatuses]);

    // Auto-scan when the panel loads (or when screenplay list changes)
    useEffect(() => {
        if (!screenplays || screenplays.length === 0) return;
        setPdfStoreScanning(true);
        checkStoragePaths(screenplays).finally(() => setPdfStoreScanning(false));
    }, [screenplays, checkStoragePaths, setPdfStoreScanning]);

    // ─── "Scan & Sync" — write hasPdf to Firestore for found PDFs ──────────

    const handleScanAndSync = useCallback(async () => {
        if (!screenplays || isScanning) return;
        setIsScanning(true);

        await checkStoragePaths(screenplays);

        // After scan, write hasPdf to Firestore for all found PDFs
        const found = screenplays.filter((s) => storageStatuses[s.id] === 'found');
        await Promise.allSettled(
            found.map(async (screenplay) => {
                try {
                    const docId = toDocId(screenplay.sourceFile);
                    await updateDoc(doc(db, FIRESTORE_COLLECTION, docId), { hasPdf: true });
                } catch {
                    // Non-critical — the scan status itself is authoritative in this panel
                }
            })
        );

        queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY });
        setIsScanning(false);
    }, [screenplays, isScanning, storageStatuses, checkStoragePaths, queryClient]);

    // ─── Upload logic ────────────────────────────────────────────────────────

    const doUpload = useCallback(
        async (file: File, screenplay: Screenplay) => {
            const id = screenplay.id;
            setUploadEntries((prev) => ({ ...prev, [id]: { state: 'uploading' } }));
            setStorageStatuses((prev) => ({ ...prev, [id]: 'checking' }));

            try {
                const category = screenplay.category || 'OTHER';
                // Pass screenplay.title so path matches ModalHeader exactly
                await uploadScreenplayPdf(file, category, screenplay.title);

                // Mark hasPdf: true in Firestore
                const docId = toDocId(screenplay.sourceFile);
                try {
                    await updateDoc(doc(db, FIRESTORE_COLLECTION, docId), { hasPdf: true });
                } catch {
                    // Non-critical
                }

                setUploadEntries((prev) => ({ ...prev, [id]: { state: 'done' } }));
                setStorageStatuses((prev) => ({ ...prev, [id]: 'found' }));
                setPdfStoreStatus(id, 'found'); // update shared store so filter reacts
                queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Upload failed';
                setUploadEntries((prev) => ({ ...prev, [id]: { state: 'error', error: message } }));
                setStorageStatuses((prev) => ({ ...prev, [id]: 'missing' }));
                setPdfStoreStatus(id, 'missing'); // update shared store
            }
        },
        [queryClient]
    );

    const handleFile = useCallback(
        (file: File) => {
            if (!screenplays) return;
            const scored = screenplays
                .map((s) => ({ screenplay: s, score: matchScore(file.name, s) }))
                .sort((a, b) => b.score - a.score);

            const best = scored[0];
            setPendingFile(file);
            setManualPickId(best?.screenplay.id ?? screenplays[0]?.id ?? '');
        },
        [screenplays]
    );

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files[0];
        if (file?.name.endsWith('.pdf')) handleFile(file);
    };

    const confirmUpload = async () => {
        if (!pendingFile || !screenplays) return;
        const screenplay = screenplays.find((s) => s.id === manualPickId);
        if (!screenplay) return;
        setPendingFile(null);
        await doUpload(pendingFile, screenplay);
    };

    const handleRowUpload = useCallback(
        (screenplay: Screenplay) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.pdf';
            input.onchange = () => {
                const file = input.files?.[0];
                if (file) doUpload(file, screenplay);
            };
            input.click();
        },
        [doUpload]
    );

    // ─── Derived state ────────────────────────────────────────────────────────

    const foundCount = useMemo(
        () => Object.values(storageStatuses).filter((s) => s === 'found').length,
        [storageStatuses]
    );
    const missingCount = useMemo(
        () => Object.values(storageStatuses).filter((s) => s === 'missing').length,
        [storageStatuses]
    );
    const checkingCount = useMemo(
        () => Object.values(storageStatuses).filter((s) => s === 'checking').length,
        [storageStatuses]
    );

    const sortedScreenplays = useMemo(() => {
        if (!screenplays) return [];
        return [...screenplays].sort((a, b) => {
            const aFound = storageStatuses[a.id] === 'found';
            const bFound = storageStatuses[b.id] === 'found';
            if (aFound === bFound) return a.title.localeCompare(b.title);
            return aFound ? 1 : -1;
        });
    }, [screenplays, storageStatuses]);

    const filteredScreenplays = useMemo(() => {
        let list = sortedScreenplays;
        if (showMissingOnly) list = list.filter((s) => storageStatuses[s.id] !== 'found');
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (s) => s.title.toLowerCase().includes(q) || s.sourceFile.toLowerCase().includes(q)
            );
        }
        return list;
    }, [sortedScreenplays, storageStatuses, showMissingOnly, searchQuery]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const totalCount = screenplays?.length ?? 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-display text-gold-200 mb-1">PDF File Management</h2>
                    <p className="text-sm text-black-400">
                        Live check against Firebase Storage —{' '}
                        {checkingCount > 0
                            ? `checking ${checkingCount} remaining...`
                            : 'storage scan complete'}
                    </p>
                </div>
                <button
                    onClick={handleScanAndSync}
                    disabled={isScanning || checkingCount > 0}
                    className={clsx(
                        'btn text-sm flex items-center gap-2 shrink-0',
                        isScanning || checkingCount > 0 ? 'btn-secondary opacity-60' : 'btn-primary'
                    )}
                >
                    {isScanning || checkingCount > 0 ? (
                        <div className="w-4 h-4 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    )}
                    {isScanning ? 'Scanning…' : 'Rescan & Sync'}
                </button>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-black-800/60 border border-black-700 text-center">
                    <p className="text-2xl font-mono font-bold text-gold-300">{totalCount}</p>
                    <p className="text-xs text-black-500 mt-1">Total</p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <p className="text-2xl font-mono font-bold text-emerald-400">
                        {checkingCount > 0 ? <span className="text-lg">…{foundCount}</span> : foundCount}
                    </p>
                    <p className="text-xs text-black-500 mt-1">PDF Found ✓</p>
                </div>
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                    <p className="text-2xl font-mono font-bold text-red-400">
                        {checkingCount > 0 ? <span className="text-lg">…{missingCount}</span> : missingCount}
                    </p>
                    <p className="text-xs text-black-500 mt-1">Missing PDF ✗</p>
                </div>
            </div>

            {/* Drag-drop zone */}
            <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onClick={() => fileInputRef.current?.click()}
                className={clsx(
                    'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                    dragActive
                        ? 'border-gold-400 bg-gold-500/10'
                        : 'border-black-600 hover:border-gold-500/50 hover:bg-black-800/30'
                )}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    className="hidden"
                />
                <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gold-500/20 flex items-center justify-center">
                        <svg className="w-6 h-6 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-gold-200 font-medium">Drop a PDF here or click to browse</p>
                        <p className="text-xs text-black-400 mt-1">Matched to screenplay and uploaded to <code className="bg-black-900 px-1 rounded">screenplays/{'{CATEGORY}'}/{'{TITLE}'}.pdf</code></p>
                    </div>
                </div>
            </div>

            {/* Pending upload confirmation */}
            {pendingFile && screenplays && (
                <div className="p-4 rounded-xl bg-gold-500/10 border border-gold-500/30 space-y-4">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-sm font-medium text-gold-200 flex-1 truncate">{pendingFile.name}</p>
                    </div>

                    <div>
                        <label className="block text-xs text-black-400 mb-1">Link to screenplay:</label>
                        <select
                            value={manualPickId}
                            onChange={(e) => setManualPickId(e.target.value)}
                            className="w-full bg-black-800 border border-black-600 rounded-lg text-sm text-gold-200 px-3 py-2 focus:outline-none focus:border-gold-500/50"
                        >
                            {sortedScreenplays.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.title} {storageStatuses[s.id] === 'found' ? '✓' : '✗'}
                                </option>
                            ))}
                        </select>
                        {manualPickId && (
                            <p className="text-xs text-black-500 mt-1 font-mono">
                                → {buildStoragePath(screenplays.find(s => s.id === manualPickId) ?? screenplays[0])}
                            </p>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <button onClick={confirmUpload} className="btn btn-primary flex-1">Upload PDF</button>
                        <button onClick={() => setPendingFile(null)} className="btn btn-ghost">Cancel</button>
                    </div>
                </div>
            )}

            {/* Search + filter bar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search screenplays..."
                        className="input w-full pl-9 text-sm"
                    />
                </div>
                <button
                    onClick={() => setShowMissingOnly(!showMissingOnly)}
                    className={clsx(
                        'px-4 py-2 rounded-lg text-sm font-medium border transition-all whitespace-nowrap',
                        showMissingOnly
                            ? 'bg-red-500/20 text-red-400 border-red-500/40'
                            : 'bg-black-800/50 text-black-300 border-black-700 hover:border-red-500/30'
                    )}
                >
                    {showMissingOnly ? '● Missing only' : 'Show all'}
                </button>
            </div>

            {/* Screenplay list */}
            <div className="space-y-2">
                {filteredScreenplays.length === 0 && (
                    <p className="text-center text-black-500 py-8 text-sm">
                        {showMissingOnly ? 'All PDFs found! 🎉' : 'No screenplays found.'}
                    </p>
                )}
                {filteredScreenplays.map((screenplay) => {
                    const storageStatus = storageStatuses[screenplay.id] ?? 'checking';
                    const uploadEntry = uploadEntries[screenplay.id];
                    const isUploading = uploadEntry?.state === 'uploading';
                    const storagePath = buildStoragePath(screenplay);

                    return (
                        <div
                            key={screenplay.id}
                            className={clsx(
                                'flex items-center gap-4 p-3 rounded-xl border transition-all',
                                isUploading
                                    ? 'border-gold-500/20 bg-gold-500/5'
                                    : storageStatus === 'found'
                                        ? 'border-emerald-500/20 bg-emerald-500/5'
                                        : storageStatus === 'checking'
                                            ? 'border-black-700 bg-black-800/30'
                                            : 'border-red-500/10 bg-black-800/30'
                            )}
                        >
                            {/* Status icon */}
                            <div className="shrink-0 w-8 h-8 flex items-center justify-center">
                                {isUploading || storageStatus === 'checking' ? (
                                    <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
                                ) : storageStatus === 'found' ? (
                                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5 text-red-500/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gold-200 truncate">{screenplay.title}</p>
                                <p className="text-xs text-black-500 truncate font-mono">{storagePath}</p>
                                {uploadEntry?.error && (
                                    <p className="text-xs text-red-400 mt-0.5 truncate">{uploadEntry.error}</p>
                                )}
                            </div>

                            {/* Category badge */}
                            <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-black-700 text-black-400">
                                {screenplay.category ?? 'OTHER'}
                            </span>

                            {/* Upload button */}
                            {!isUploading && (
                                <button
                                    onClick={() => handleRowUpload(screenplay)}
                                    title={storageStatus === 'found' ? 'Re-upload PDF' : 'Upload PDF'}
                                    className={clsx(
                                        'shrink-0 p-2 rounded-lg border transition-all',
                                        storageStatus === 'found'
                                            ? 'border-black-700 text-black-500 hover:border-gold-500/30 hover:text-gold-400'
                                            : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50'
                                    )}
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                </button>
                            )}

                            {/* Delete button — inline two-click confirm */}
                            {!isUploading && (
                                confirmDeleteId === screenplay.id ? (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => {
                                                setConfirmDeleteId(null);
                                                deleteMutation.mutate(screenplay.sourceFile);
                                                setStorageStatuses((prev) => { const n = { ...prev }; delete n[screenplay.id]; return n; });
                                            }}
                                            className="px-2 py-1 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-500 transition-all"
                                        >
                                            Confirm
                                        </button>
                                        <button
                                            onClick={() => setConfirmDeleteId(null)}
                                            className="px-2 py-1 text-xs rounded-lg bg-black-700 text-black-400 hover:text-white transition-all"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setConfirmDeleteId(screenplay.id)}
                                        title="Delete project"
                                        className="shrink-0 p-2 rounded-lg border border-red-500/20 text-red-500/50 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Help */}
            <div className="p-4 rounded-lg bg-black-800/50 border border-black-700">
                <p className="text-xs text-black-400 leading-relaxed">
                    <span className="text-gold-400 font-medium">💡 Path convention:</span>{' '}
                    Storage path = <code className="text-xs bg-black-900 px-1 py-0.5 rounded text-black-300">screenplays/{'{CATEGORY}'}/{'{TITLE}'}.pdf</code>{' '}
                    (matches the modal PDF button). Use <strong className="text-gold-300">Rescan & Sync</strong> after uploading
                    files directly to Firebase Storage console.
                </p>
            </div>
        </div>
    );
}

export default PdfUploadPanel;
