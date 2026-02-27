/**
 * ModalHeader — title, author, badges, chips, close/download/delete buttons.
 * Reorganized layout: Close (X) top-right, then Title row, then action bar.
 */

import { useState } from 'react';
import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { BUDGET_TIERS } from '@/types';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { DeleteConfirmDialog } from '@/components/ui/DeleteConfirmDialog';
import { ReanalyzeButton } from './ReanalyzeButton';
import { useDeleteScreenplays } from '@/hooks/useScreenplays';
import { storage } from '@/lib/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import type { RefObject } from 'react';

interface ModalHeaderProps {
    screenplay: Screenplay;
    closeButtonRef: RefObject<HTMLButtonElement | null>;
    onClose: () => void;
    onReanalyzeComplete?: () => void;
}

export function ModalHeader({ screenplay, closeButtonRef, onClose, onReanalyzeComplete }: ModalHeaderProps) {
    const budgetInfo = BUDGET_TIERS[screenplay.budgetCategory];
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const deleteMutation = useDeleteScreenplays();

    /**
     * Open the PDF from Firebase Storage.
     * The upload path in firebase.ts is: screenplays/{category}/{safeName}.pdf
     * We reconstruct the same path here.
     */
    const handleDownloadPdf = async () => {
        const category = screenplay.category || 'OTHER';
        const safeName = (screenplay.title || screenplay.sourceFile || 'untitled')
            .replace(/\.pdf$/i, '')
            .replace(/[^a-zA-Z0-9_\- ]/g, '')
            .trim()
            .replace(/\s+/g, '_');
        const storagePath = `screenplays/${category}/${safeName}.pdf`;

        try {
            const fileRef = ref(storage, storagePath);
            const url = await getDownloadURL(fileRef);
            window.open(url, '_blank');
        } catch (err) {
            console.error('[PDF Download] Failed:', err);
            // Fallback: try without category subfolder
            try {
                const fallbackRef = ref(storage, `screenplays/${safeName}.pdf`);
                const url = await getDownloadURL(fallbackRef);
                window.open(url, '_blank');
            } catch {
                alert(`PDF not found in storage. The screenplay may not have been uploaded yet.\n\nPath tried: ${storagePath}`);
            }
        }
    };

    const handleDelete = () => {
        const sourceFile = screenplay.sourceFile || screenplay.title;
        deleteMutation.mutate(sourceFile, {
            onSuccess: () => {
                setShowDeleteConfirm(false);
                onClose();
            },
        });
    };

    return (
        <>
            <div className={clsx(
                'relative p-6 border-b',
                screenplay.isFilmNow
                    ? 'bg-gradient-to-r from-gold-900/30 to-gold-800/20 border-gold-500/30'
                    : 'bg-black-900/80 border-black-700'
            )}>
                {/* Close button — absolute top-right */}
                <button
                    ref={closeButtonRef}
                    onClick={onClose}
                    className="absolute top-4 right-4 text-black-400 hover:text-gold-400 transition-colors p-2 rounded-lg hover:bg-white/5 z-10"
                    aria-label="Close modal"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Title + Author */}
                <div className="pr-10 mb-3">
                    <h2
                        id="modal-title"
                        className={clsx(
                            'text-2xl font-display mb-1',
                            screenplay.isFilmNow ? 'text-gradient-gold' : 'text-gold-100'
                        )}
                    >
                        {screenplay.title}
                    </h2>
                    <p className="text-black-400">by {screenplay.author}</p>
                </div>

                {/* Action Bar: Chips + Badge + Actions */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    {/* Left: Chips */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="chip chip-genre">
                            {screenplay.genre}
                        </span>
                        <span className="chip chip-budget">
                            {budgetInfo.label} ({budgetInfo.range})
                        </span>
                        <span className="chip">
                            {screenplay.collection}
                        </span>
                    </div>

                    {/* Right: Re-analyze + PDF + Delete + Badge */}
                    <div className="flex items-center gap-2">
                        <ReanalyzeButton screenplay={screenplay} onComplete={onReanalyzeComplete} />
                        <button
                            onClick={handleDownloadPdf}
                            className="btn btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3"
                            title={`Download ${screenplay.sourceFile || screenplay.title}`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            PDF
                        </button>
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-medium transition-colors bg-red-600/10 text-red-400 hover:bg-red-600/20 hover:text-red-300 border border-red-500/20"
                            title="Delete this screenplay"
                            aria-label="Delete screenplay"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                        </button>
                        <RecommendationBadge tier={screenplay.recommendation} size="lg" />
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmDialog
                isOpen={showDeleteConfirm}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                title={`Delete "${screenplay.title}"?`}
                message={`This will permanently remove the analysis for "${screenplay.title}" from your database.`}
                isPending={deleteMutation.isPending}
            />
        </>
    );
}

