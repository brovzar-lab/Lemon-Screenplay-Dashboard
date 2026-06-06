/**
 * Job Item
 * Displays a single upload job with status, progress bar, and action buttons.
 * Handles duplicate detection warnings and TMDB produced/unproduced badges.
 */

import { clsx } from 'clsx';
import type { UploadJob } from '@/stores/uploadStore';
import { STATUS_LABELS } from './upload.constants';

interface JobItemProps {
  job: UploadJob;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onForceReanalyze?: (id: string) => void;
  onSkip?: (id: string) => void;
}

export function JobItem({ job, onRemove, onRetry, onForceReanalyze, onSkip }: JobItemProps) {
  const status = STATUS_LABELS[job.status];
  const isActive = job.status === 'parsing' || job.status === 'analyzing' || job.status === 'promoting';
  const isSkipped = job.status === 'skipped';

  return (
    <div className={clsx(
      'rounded-lg border transition-all',
      job.isDuplicate && job.status === 'pending'
        ? 'border-amber-500/30 bg-amber-500/5'
        : isSkipped
          ? 'border-black-700 bg-black-800/30 opacity-60'
          : 'border-black-700 bg-black-800/50'
    )}>
      {/* Duplicate warning banner */}
      {job.isDuplicate && job.status === 'pending' && (
        <div className="flex items-center justify-between gap-3 px-3 pt-2.5 pb-2 border-b border-amber-500/20">
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs text-amber-300 truncate">
              Already analyzed
              {job.existingTitle && job.existingTitle !== job.filename.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ') && (
                <> as <span className="font-medium">"{job.existingTitle}"</span></>
              )}
              {' '}— re-analyzing will overwrite
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              id={`reanalyze-${job.id}`}
              onClick={() => onForceReanalyze?.(job.id)}
              className="px-2 py-0.5 text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded hover:bg-amber-500/20 hover:border-amber-500/50 transition-all whitespace-nowrap"
            >
              Re-analyze anyway
            </button>
            <button
              id={`skip-${job.id}`}
              onClick={() => onSkip?.(job.id)}
              className="px-2 py-0.5 text-xs text-black-400 hover:text-red-400 border border-black-700 hover:border-red-500/30 rounded transition-all"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 p-3">
        {/* Status Icon */}
        <div className="w-8 h-8 shrink-0 flex items-center justify-center">
          {isActive ? (
            <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          ) : job.status === 'complete' ? (
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : job.status === 'error' ? (
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : isSkipped ? (
            <svg className="w-5 h-5 text-black-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-black-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gold-200 truncate">{job.filename}</p>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className={status.color}>{status.label}</span>
            <span className="text-black-500">&middot;</span>
            <span className="text-black-500">{job.category}</span>
            {job.error && (
              <>
                <span className="text-black-500">&middot;</span>
                <span className="text-red-400 truncate" title={job.error}>{job.error}</span>
              </>
            )}
          </div>

          {/* TMDB result badge — shown on completed jobs */}
          {job.status === 'complete' && (
            <div className="mt-1">
              {job.tmdbChecking ? (
                <span className="inline-flex items-center gap-1 text-xs text-black-400">
                  <div className="w-2.5 h-2.5 border border-black-400 border-t-transparent rounded-full animate-spin" />
                  Checking TMDB…
                </span>
              ) : job.tmdbStatus ? (
                job.tmdbStatus.isProduced ? (
                  <span className={clsx(
                    'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
                    job.tmdbStatus.confidence === 'high'
                      ? 'bg-red-500/15 text-red-300'
                      : 'bg-amber-500/15 text-amber-300'
                  )}>
                    🎬 Produced
                    {job.tmdbStatus.tmdbTitle && ` as "${job.tmdbStatus.tmdbTitle}"`}
                    {job.tmdbStatus.releaseDate && ` (${job.tmdbStatus.releaseDate.slice(0, 4)})`}
                    {job.tmdbStatus.confidence === 'medium' && ' ~'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                    ✓ Not yet produced
                  </span>
                )
              ) : null}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {isActive && (
          <div className="w-24 h-1.5 bg-black-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gold-400 rounded-full transition-all"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}

        {/* Retry + Remove Buttons */}
        {job.status === 'error' && (
          <button
            onClick={() => onRetry(job.id)}
            className="px-3 py-1 text-xs font-medium text-gold-300 bg-gold-500/10 border border-gold-500/30 rounded-md hover:bg-gold-500/20 hover:border-gold-500/50 transition-all"
          >
            ↻ Retry
          </button>
        )}
        {(job.status === 'pending' || job.status === 'complete' || job.status === 'error' || isSkipped) && (
          <button
            onClick={() => onRemove(job.id)}
            className="p-1 text-black-500 hover:text-red-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
