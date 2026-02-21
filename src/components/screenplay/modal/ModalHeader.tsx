/**
 * ModalHeader — title, author, badges, chips, close/download buttons.
 * Reorganized layout: Close (X) top-right, then Title row, then action bar.
 */

import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { BUDGET_TIERS } from '@/types';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { ReanalyzeButton } from './ReanalyzeButton';
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

    return (
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

                {/* Right: Re-analyze + PDF + Badge */}
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
                    <RecommendationBadge tier={screenplay.recommendation} size="lg" />
                </div>
            </div>
        </div>
    );
}
