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
import { ShareButton } from './ShareButton';
import { useDeleteScreenplays } from '@/hooks/useScreenplays';
// downloadCoveragePdf is dynamically imported below to defer @react-pdf/renderer
import { useToastStore } from '@/stores/toastStore';
import { useIsAdmin } from '@/stores/authStore';
import type { ReactNode, RefObject } from 'react';
import { ScreenplayPdfButton } from './ScreenplayPdfButton';

interface ModalHeaderProps {
    screenplay: Screenplay;
    closeButtonRef: RefObject<HTMLButtonElement | null>;
    onClose: () => void;
    onReanalyzeComplete?: () => void;
    showActions?: boolean;
    titleId?: string;
    closeLabel?: string;
    supplementalActions?: ReactNode;
    presentation?: 'default' | 'discovery';
    authorFallback?: string;
}
export function ModalHeader({
    screenplay,
    closeButtonRef,
    onClose,
    onReanalyzeComplete,
    showActions = true,
    titleId = 'modal-title',
    closeLabel = 'Close modal',
    supplementalActions,
    presentation = 'default',
    authorFallback,
}: ModalHeaderProps) {
    const isDiscovery = presentation === 'discovery';
    const isAdmin = useIsAdmin();
    const budgetInfo = BUDGET_TIERS[screenplay.budgetCategory];
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const deleteMutation = useDeleteScreenplays();

    const [coverageState, setCoverageState] = useState<'idle' | 'loading' | 'error'>('idle');

    const handleDownloadCoverage = async () => {
        if (coverageState === 'loading') return;
        setCoverageState('loading');
        try {
            // Dynamic import — defers 1.5MB @react-pdf/renderer until user clicks
            const { downloadCoveragePdf } = await import('@/components/export/exportCoverage');
            await downloadCoveragePdf(screenplay);
            setCoverageState('idle');
        } catch (error) {
            console.error('[Coverage PDF] Generation failed:', error);
            useToastStore.getState().addToast('Coverage PDF generation failed — please try again');
            setCoverageState('error');
            setTimeout(() => setCoverageState('idle'), 3000);
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
                'modal-header relative border-b border-black-700',
                isDiscovery
                    ? 'bg-black-900 p-5 sm:p-6 lg:px-8'
                    : 'p-6',
                !isDiscovery && (
                    screenplay.isFilmNow
                        ? 'bg-gradient-to-r from-black-900/30 to-black-800/20'
                        : 'bg-black-900/80'
                ),
            )}>
                {/* Tier 1: Verdict Badge (top-left) + Close (top-right) */}
                <div className="flex items-start justify-between mb-3">
                    <RecommendationBadge tier={screenplay.recommendation} size="lg" />
                    <button
                        ref={closeButtonRef}
                        onClick={onClose}
                        className={clsx(
                            'modal-close-btn shrink-0 rounded-lg text-black-400 transition-all hover:text-black-200',
                            isDiscovery
                                ? 'btn btn-ghost !h-11 !min-h-11 !w-11 !min-w-11 !p-0'
                                : 'p-2 hover:bg-white/10',
                        )}
                        aria-label={closeLabel}
                    >
                        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tier 2: Title + Author */}
                <div className="mb-4">
                    <h2
                        id={titleId}
                        className={clsx(
                            'font-display mb-1',
                            isDiscovery ? 'text-3xl sm:text-4xl' : 'text-2xl',
                            !isDiscovery && screenplay.isFilmNow ? 'text-gradient-gold' : ''
                        )}
                    >
                        {screenplay.title}
                    </h2>
                    <p className="text-black-400">by {screenplay.author || authorFallback || ''}</p>
                </div>

                {/* Tier 3: Chips (left) + Actions (right) */}
                <div className={clsx(
                    'flex justify-between gap-3 flex-wrap',
                    isDiscovery ? 'items-end' : 'items-center',
                )}>
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

                    {supplementalActions}

                    {/* Right: Share + Coverage + Re-analyze + PDF + Delete */}
                    {showActions && <div className="flex items-center gap-2">
                        <ShareButton screenplay={screenplay} />
                        <button
                            onClick={handleDownloadCoverage}
                            disabled={coverageState === 'loading'}
                            className={clsx(
                                'btn text-xs flex items-center gap-1.5 py-1.5 px-3 transition-all',
                                coverageState === 'error'
                                    ? 'bg-red-600/20 text-red-400 border border-red-500/30 cursor-default'
                                    : 'btn-primary',
                                coverageState === 'loading' && 'opacity-60 cursor-wait',
                            )}
                            title={
                                coverageState === 'error'
                                    ? 'Coverage PDF generation failed'
                                    : 'Download coverage report as PDF'
                            }
                        >
                            {coverageState === 'loading' ? (
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                            ) : coverageState === 'error' ? (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                </svg>
                            ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            )}
                            {coverageState === 'error' ? 'Failed' : 'Coverage'}
                        </button>
                        {isAdmin && <ReanalyzeButton screenplay={screenplay} onComplete={onReanalyzeComplete} />}
                        <ScreenplayPdfButton screenplay={screenplay} />
                        {isAdmin && <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="modal-delete-btn text-xs flex items-center gap-1.5 py-1.5 px-3 rounded-lg font-medium transition-all border"
                            title="Delete this screenplay"
                            aria-label="Delete screenplay"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                        </button>}
                    </div>}
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            {showActions && isAdmin && <DeleteConfirmDialog
                isOpen={showDeleteConfirm}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                title={`Delete "${screenplay.title}"?`}
                message={`This will permanently remove the analysis for "${screenplay.title}" from your database.`}
                isPending={deleteMutation.isPending}
            />}
        </>
    );
}
