/**
 * ModalHeader — title, author, badges, chips, close/download buttons.
 */

import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { BUDGET_TIERS } from '@/types';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import type { RefObject } from 'react';

interface ModalHeaderProps {
    screenplay: Screenplay;
    closeButtonRef: RefObject<HTMLButtonElement | null>;
    onClose: () => void;
}

export function ModalHeader({ screenplay, closeButtonRef, onClose }: ModalHeaderProps) {
    const budgetInfo = BUDGET_TIERS[screenplay.budgetCategory];

    return (
        <div className={clsx(
            'p-6 border-b',
            screenplay.isFilmNow
                ? 'bg-gradient-to-r from-gold-900/30 to-gold-800/20 border-gold-500/30'
                : 'bg-black-900/50 border-black-700'
        )}>
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
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
                    <div className="flex flex-wrap gap-2 mt-3">
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
                </div>
                <div className="flex flex-col items-end gap-3">
                    <RecommendationBadge tier={screenplay.recommendation} size="lg" />
                    <div className="flex items-center gap-2">
                        {/* Download PDF Button */}
                        <button
                            onClick={() => {
                                const filename = screenplay.sourceFile || `${screenplay.title}.pdf`;
                                const bucketName = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'your-project.appspot.com';
                                const encodedFilename = encodeURIComponent(filename);
                                const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/screenplays%2F${encodedFilename}?alt=media`;
                                window.open(downloadUrl, '_blank');
                            }}
                            className="btn btn-primary text-sm flex items-center gap-2"
                            title={`Download ${screenplay.sourceFile || screenplay.title}`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            PDF
                        </button>
                        <button
                            ref={closeButtonRef}
                            onClick={onClose}
                            className="text-black-400 hover:text-gold-400 transition-colors p-2"
                            aria-label="Close modal"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
