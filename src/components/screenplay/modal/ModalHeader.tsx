/**
 * ModalHeader — Hero banner with title, author, recommendation badge,
 * weighted score, and genre/budget/collection chips.
 * Action buttons have moved to ModalActionsBar.
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
            'modal-header relative p-6 pb-5 border-b',
            screenplay.isFilmNow
                ? 'bg-gradient-to-br from-gold-900/40 via-burgundy-950 to-black-950 border-gold-500/30'
                : 'bg-gradient-to-br from-burgundy-950 to-black-950 border-black-700'
        )}>
            {/* Close button — absolute top-right */}
            <button
                ref={closeButtonRef}
                onClick={onClose}
                className="modal-close-btn absolute top-4 right-4 transition-all p-2 rounded-lg z-10 text-black-400 hover:text-black-200 hover:bg-white/10"
                aria-label="Close modal"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {/* Top row: Badge + Score */}
            <div className="flex items-start justify-between gap-4 mb-3">
                <RecommendationBadge tier={screenplay.recommendation} size="lg" />
                <span className="font-mono text-3xl font-bold text-gold-400 leading-none">
                    {screenplay.weightedScore?.toFixed(1) ?? '\u2014'}
                </span>
            </div>

            {/* Title + Author */}
            <div className="pr-10 mb-4">
                <h2
                    id="modal-title"
                    className={clsx(
                        'text-2xl font-heading mb-1',
                        screenplay.isFilmNow ? 'text-gradient-gold' : 'text-gold-100'
                    )}
                >
                    {screenplay.title}
                </h2>
                <p className="text-black-400">by {screenplay.author}</p>
            </div>

            {/* Chips */}
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
        </div>
    );
}
