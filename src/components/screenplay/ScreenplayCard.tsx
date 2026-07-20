/**
 * ScreenplayCard Component
 *
 * Fixed-height card (280px) — never grows regardless of content length.
 * Shows only what's needed to decide whether to click:
 *   Verdict badge · Title (1 line) · Genre + Budget chips
 *   Logline (1 line) ←→ swaps on hover with top-3 dimension pills
 *   Score (big) + CVS · 3 top dimension pills strip (always visible)
 *
 * Author, collection chip, full score grid, and all detail → modal only.
 */

import { useState, useEffect, useRef, memo } from 'react';
import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import { useIsSelected, useSelectionStore } from '@/stores/selectionStore';
import { useDeleteSelectionStore, useIsSelectedForDelete } from '@/stores/deleteSelectionStore';
import { useDeleteScreenplays } from '@/hooks/useScreenplays';
import { DeleteConfirmDialog } from '@/components/ui/DeleteConfirmDialog';
import { ProductionBadge } from './ProductionBadge';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { useIsAdmin } from '@/stores/authStore';
import { PercentileBadge } from '@/components/ui/PercentileBadge';
import type { PercentileRank } from '@/lib/percentileRanking';

interface ScreenplayCardProps {
  screenplay: Screenplay;
  onClick?: () => void;
  percentileRank?: PercentileRank;
}

export const ScreenplayCard = memo(function ScreenplayCard({ screenplay, onClick, percentileRank }: ScreenplayCardProps) {
  const isAdmin = useIsAdmin();
  const isBulkSelected = useIsSelected(screenplay.id);
  const toggleBulkSelection = useSelectionStore((s) => s.toggle);
  const isDeleteMode = useDeleteSelectionStore((s) => s.isDeleteMode);
  const toggleDeleteSelection = useDeleteSelectionStore((s) => s.toggle);
  const isDeleteSelected = useIsSelectedForDelete(screenplay.id);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteMutation = useDeleteScreenplays();

  // Hover peek: swap logline ↔ top-3 dimension pills (card height stays locked)
  const [isPeeking, setIsPeeking] = useState(false);
  const peekTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const supportsHover = typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover)').matches;

  const handlePeekEnter = () => {
    if (!supportsHover) return;
    peekTimerRef.current = setTimeout(() => setIsPeeking(true), 400);
  };
  const handlePeekLeave = () => {
    clearTimeout(peekTimerRef.current);
    setIsPeeking(false);
  };
  useEffect(() => () => clearTimeout(peekTimerRef.current), []);

  const handleBulkSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBulkSelection(screenplay.id);
  };
  const handleDeleteSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleDeleteSelection(screenplay.id);
  };
  const handleTrashClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };
  const handleConfirmDelete = () => {
    const sourceFile = screenplay.sourceFile || screenplay.title;
    deleteMutation.mutate(sourceFile, {
      onSuccess: () => setShowDeleteConfirm(false),
    });
  };

  // Tier highlight class
  const tierClass = (() => {
    const rec = screenplay.recommendation;
    if (rec === 'film_now') return 'card-film-now';
    if (rec === 'recommend') return 'card-recommend';
    if (rec === 'pass') return 'card-pass';
    return '';
  })();

  const isPass = screenplay.recommendation === 'pass';

  // Top-3 dimensions by score (for hover swap and bottom strip)
  const allDims = getDimensionDisplay(screenplay);
  const top3Dims = [...allDims].sort((a, b) => b.score - a.score).slice(0, 3);

  // Scores
  const weightedScore = (Number(screenplay.weightedScore) || 0).toFixed(1);
  const cvsTotal = Number(screenplay.cvsTotal) || 0;
  const cvsAssessed = screenplay.commercialViability?.cvsAssessed !== false;

  return (
    <>
      <article
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label={`View details for ${screenplay.title}`}
        onMouseEnter={handlePeekEnter}
        onMouseLeave={handlePeekLeave}
        className={clsx(
          // Fixed height — the entire point of this redesign
          'card cursor-pointer relative group',
          'flex flex-col',
          'h-[280px] overflow-hidden',
          'transition-transform duration-200 ease-out',
          tierClass,
          isDeleteMode && isDeleteSelected && 'ring-2 ring-red-500/50',
          !isDeleteMode && isBulkSelected && 'ring-2 ring-blue-500/50',
          // Subtle lift on hover — no layout shift
          'hover:-translate-y-0.5',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60',
        )}
      >
        {/* ── Bulk select checkbox ────────────────────────────────────────── */}
        {!isDeleteMode && (
          <button
            onClick={handleBulkSelectClick}
            className={clsx(
              'absolute top-3 left-3 w-5 h-5 rounded border-2 flex items-center justify-center',
              'transition-all duration-150 z-10',
              isBulkSelected
                ? 'bg-blue-500 border-blue-400 text-white'
                : 'border-black-500 bg-black-800/50 hover:border-blue-500/50',
            )}
            aria-label={isBulkSelected ? 'Deselect screenplay' : 'Select screenplay'}
          >
            {isBulkSelected && (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}

        {/* ── Delete mode checkbox ────────────────────────────────────────── */}
        {isAdmin && isDeleteMode && (
          <button
            onClick={handleDeleteSelectClick}
            className={clsx(
              'absolute top-3 right-3 w-5 h-5 rounded-md border-2 flex items-center justify-center',
              'transition-all duration-150 z-10',
              isDeleteSelected
                ? 'opacity-100 bg-red-500 border-red-400 text-white'
                : 'opacity-0 group-hover:opacity-100 border-red-400/50 text-transparent hover:border-red-400',
            )}
            aria-label={isDeleteSelected ? 'Deselect for deletion' : 'Select for deletion'}
          >
            {isDeleteSelected && '✓'}
          </button>
        )}

        {/* ── Trash icon ──────────────────────────────────────────────────── */}
        {isAdmin && !isDeleteMode && (
          <button
            onClick={handleTrashClick}
            className={clsx(
              'absolute top-3 right-3 w-6 h-6 rounded flex items-center justify-center',
              'transition-all duration-150 z-10',
              'opacity-0 group-hover:opacity-100',
              'bg-red-600/10 text-red-400 hover:bg-red-600/20 hover:text-red-300 border border-red-500/20',
            )}
            aria-label="Delete screenplay"
            title="Delete screenplay"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}

        {/* ── HEADER: badge + title ───────────────────────────────────────── */}
        <div className="pl-8 pr-8 mb-2 flex-shrink-0">
          <div className="mb-2 flex items-center gap-2 min-w-0">
            <RecommendationBadge tier={screenplay.recommendation} />
            <PercentileBadge rank={percentileRank} showAll />
          </div>
          {/* Title: always 1 line, truncated */}
          <h3 className="text-base font-display leading-tight truncate" style={{ color: 'var(--sp-text)' }}>
            {screenplay.title}
          </h3>
        </div>

        {/* ── TAGS: genre + budget only ───────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5 px-4 mb-2 flex-shrink-0">
          <span className="chip chip-genre">{screenplay.genre}</span>
          <span className="chip chip-budget">{screenplay.budgetCategory}</span>
          <ProductionBadge tmdbStatus={screenplay.tmdbStatus} compact />
        </div>

        {/* ── LOGLINE / PEEK AREA (fixed height, content swaps on hover) ─── */}
        {/* This area is exactly 2 lines tall and never changes size */}
        <div className="px-4 mb-3 flex-shrink-0 h-[40px] overflow-hidden relative">
          {/* Logline: visible when NOT peeking */}
          <p
            className={clsx(
              'text-xs text-black-300 leading-5 line-clamp-2',
              'absolute inset-0 px-4',
              'transition-opacity duration-200',
              isPeeking ? 'opacity-0' : 'opacity-100',
            )}
          >
            {screenplay.logline}
          </p>

          {/* Top-3 dimension pills: visible when peeking */}
          <div
            className={clsx(
              'absolute inset-0 px-4 flex items-center gap-1.5 flex-wrap',
              'transition-opacity duration-200',
              isPeeking ? 'opacity-100' : 'opacity-0',
            )}
          >
            {top3Dims.map((dim) => (
              <span
                key={dim.key}
                className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: 'var(--sp-surface-2)', color: 'var(--sp-text-2)', fontVariantNumeric: 'tabular-nums' }}
              >
                {dim.label}: {dim.score.toFixed(1)}
              </span>
            ))}
          </div>
        </div>

        {/* ── SPACER: pushes score footer to bottom ───────────────────────── */}
        <div className="flex-1 min-h-0" />

        {/* ── SCORE FOOTER ────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-4 pt-2.5 pb-3">
          {/* Score row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-baseline gap-3">
              {/* Weighted score — the primary number */}
              <div>
                <span className="text-[9px] font-medium tracking-widest uppercase block leading-none mb-0.5" style={{ color: 'var(--sp-text-3)' }}>
                  Score
                </span>
                <span
                  className={clsx(isPass ? 'text-lg' : 'text-2xl', 'font-bold leading-none')}
                  style={{ color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', fontWeight: 600 }}
                >
                  {weightedScore}
                </span>
              </div>

              {/* CVS — secondary, smaller */}
              {cvsAssessed && (
                <div>
                  <span className="text-[9px] font-medium tracking-widest uppercase block leading-none mb-0.5" style={{ color: 'var(--sp-text-3)' }}>
                    CVS
                  </span>
                  <span
                    className="text-sm font-bold leading-none"
                    style={{ color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {cvsTotal}/18
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Top-3 dimension mini pills — always visible */}
          <div className="flex gap-1.5 flex-wrap">
            {top3Dims.map((dim) => (
              <span
                key={dim.key}
                className="text-[9px] px-1.5 py-0.5 rounded"
                style={{ background: 'var(--sp-surface-2)', color: 'var(--sp-text-3)', fontVariantNumeric: 'tabular-nums' }}
              >
                {dim.label.split(' ')[0]} {dim.score.toFixed(1)}
              </span>
            ))}
          </div>
        </div>
      </article>

      {isAdmin && <DeleteConfirmDialog
        isOpen={showDeleteConfirm}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title={`Delete "${screenplay.title}"?`}
        message={`Remove "${screenplay.title}" from the dashboard? You can restore it from Settings > Data.`}
        isPending={deleteMutation.isPending}
      />}
    </>
  );
});

export default ScreenplayCard;
