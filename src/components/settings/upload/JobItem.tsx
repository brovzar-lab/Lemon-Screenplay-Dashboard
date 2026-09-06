/**
 * Job Item
 * Displays a single upload job with status, progress bar, and action buttons.
 * Handles duplicate detection warnings and TMDB produced/unproduced badges.
 */

import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import type { UploadJob } from '@/stores/uploadStore';
import type { UploadPresentation } from '@/components/settings/upload/upload.types';
import { STATUS_LABELS } from '@/components/settings/upload/upload.constants';

interface JobItemProps {
  job: UploadJob;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onSkip?: (id: string) => void;
  onChooseRevision: (id: string) => void;
  onChooseSeparate: (id: string) => void;
  onOpenAnalysis?: (projectId: string) => void;
  presentation?: UploadPresentation;
}

export function JobItem({
  job,
  onRemove,
  onRetry,
  onSkip,
  onChooseRevision,
  onChooseSeparate,
  onOpenAnalysis,
  presentation = 'settings',
}: JobItemProps) {
  const { t } = useTranslation();
  const status = STATUS_LABELS[job.status];
  const isActive = job.status === 'uploading'
    || job.status === 'uploaded'
    || job.status === 'queued'
    || job.status === 'parsing'
    || job.status === 'analyzing'
    || job.status === 'promoting'
    || job.status === 'waiting_for_budget';
  const isSkipped = job.status === 'skipped';
  const needsReview = job.status === 'needs_review';
  const isIntake = presentation === 'intake';

  return (
    <div className={clsx(
      'rounded-lg border transition-all',
      isIntake
        ? job.isDuplicate && job.status === 'pending'
          ? 'border-amber-500/40 bg-amber-500/10'
          : needsReview || job.status === 'error'
            ? 'border-amber-500/40 bg-[var(--dsc-surface-2)]'
            : 'border-[var(--dsc-line)] bg-[var(--dsc-surface-2)]'
        : job.isDuplicate && job.status === 'pending'
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
            <p className="text-sm text-amber-200">
              <span className="font-medium">{t('Exact duplicate.')}</span> {t('Already analyzed')}
              {job.existingTitle && job.existingTitle !== job.filename.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ') && (
                <> {t('as')} <span className="font-medium">"{job.existingTitle}"</span></>
              )}
              . {t('This PDF has exactly the same bytes, so the engine will not run or spend AI credits again.')}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              id={`skip-${job.id}`}
              onClick={() => onSkip?.(job.id)}
              className="px-2 py-0.5 text-xs text-black-400 hover:text-red-400 border border-black-700 hover:border-red-500/30 rounded transition-all"
            >
              {t('Skip upload')}
            </button>
          </div>
        </div>
      )}

      {!job.isDuplicate && job.possibleMatchProjectId && job.status === 'pending' && (
        <div className="px-3 py-3 border-b border-blue-500/20 bg-blue-500/5">
          <p className="text-sm text-blue-100">
            <span className="font-medium">{t('Possible match:')}</span> &quot;{job.existingTitle}&quot; {t('already exists. Is this a new draft of that project or a different screenplay with the same title?')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={job.matchResolution === 'revision'}
              onClick={() => onChooseRevision(job.id)}
              className={clsx(
                'px-3 py-1.5 text-sm border rounded-md transition-colors',
                job.matchResolution === 'revision'
                  ? 'bg-blue-500 text-white border-blue-400'
                  : 'text-blue-200 border-blue-500/40 hover:bg-blue-500/10',
              )}
            >
              {t('New revision of {{title}}', { title: job.existingTitle })}
            </button>
            <button
              type="button"
              aria-pressed={job.matchResolution === 'separate'}
              onClick={() => onChooseSeparate(job.id)}
              className={clsx(
                'px-3 py-1.5 text-sm border rounded-md transition-colors',
                job.matchResolution === 'separate'
                  ? 'bg-blue-500 text-white border-blue-400'
                  : 'text-blue-200 border-blue-500/40 hover:bg-blue-500/10',
              )}
            >
              {t('Separate project')}
            </button>
          </div>
        </div>
      )}

      {job.status === 'pending' && job.identityCheckComplete === false && (
        <div className="px-3 py-2 border-b border-black-700 bg-black-800/40">
          <p className="text-sm text-black-300">
            {t('Checking the archive for revisions and exact duplicates...')}
          </p>
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
          ) : needsReview ? (
            <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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
          <p className={clsx('truncate text-sm font-medium', isIntake ? 'text-[var(--dsc-ink)]' : 'text-gold-200')}>{job.filename}</p>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className={status.color}>
              {t(isIntake && job.status === 'complete'
                ? 'Ready'
                : isIntake && job.status === 'error'
                  ? 'Failed'
                  : status.label)}
            </span>
            <span className="text-black-500">&middot;</span>
            <span className="text-black-500">{job.category}</span>
            {job.engine && <span className="text-black-500">{job.engine === 'coverage_v1' ? t('Coverage V1.2') : 'V9'}</span>}
            {job.error && (job.status === 'error' || needsReview) && (
              <>
                <span className="text-black-500">&middot;</span>
                <span className="text-red-400 truncate" title={t(job.error)}>
                  {t(job.error)}
                </span>
              </>
            )}
            {job.error && (job.status === 'queued' || job.status === 'waiting_for_budget') && (
              <>
                <span className="text-black-500">&middot;</span>
                <span className="text-amber-500">{t(job.error)}</span>
              </>
            )}
          </div>

          {job.connectionError && <p className="mt-1 text-xs text-amber-500">{t(job.connectionError)}</p>}

          {job.matchResolution === 'revision' && job.status === 'pending' && (
            <p className="mt-1 text-xs text-blue-300">
              {t('Will be added to {{title}}', { title: job.existingTitle || job.targetProjectId })}
            </p>
          )}
          {job.matchResolution === 'separate' && job.status === 'pending' && (
            <p className="mt-1 text-xs text-blue-300">
              {t('Will create a separate project')}
            </p>
          )}

          {/* TMDB result badge — shown on completed jobs */}
          {job.status === 'complete' && (
            <div className="mt-1">
              {job.tmdbChecking ? (
                <span className="inline-flex items-center gap-1 text-xs text-black-400">
                  <div className="w-2.5 h-2.5 border border-black-400 border-t-transparent rounded-full animate-spin" />
                  {t('Checking TMDB…')}
                </span>
              ) : job.tmdbStatus ? (
                job.tmdbStatus.isProduced ? (
                  <span className={clsx(
                    'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded',
                    job.tmdbStatus.confidence === 'high'
                      ? 'bg-red-500/15 text-red-300'
                      : 'bg-amber-500/15 text-amber-300'
                  )}>
                    🎬 {job.tmdbStatus.tmdbTitle
                      ? t('Produced as "{{title}}"', { title: job.tmdbStatus.tmdbTitle })
                      : t('Produced')}
                    {job.tmdbStatus.releaseDate && ` (${job.tmdbStatus.releaseDate.slice(0, 4)})`}
                    {job.tmdbStatus.confidence === 'medium' && ' ~'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                    ✓ {t('Not yet produced')}
                  </span>
                )
              ) : null}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {isActive && (
          <progress aria-label={t('Upload progress')} max={100} value={job.progress}
            className="w-24 h-1.5 accent-gold-400" />
        )}

        {/* Retry + Remove Buttons */}
        {job.status === 'error' && !job.queueJobId && (
          <button
            onClick={() => onRetry(job.id)}
            className="px-3 py-1 text-xs font-medium text-gold-300 bg-gold-500/10 border border-gold-500/30 rounded-md hover:bg-gold-500/20 hover:border-gold-500/50 transition-all"
          >
            ↻ {t('Retry')}
          </button>
        )}
        {job.status === 'error' && job.queueJobId && (
          <button type="button" onClick={() => onRetry(job.id)} className="dsc-btn shrink-0">{t('Upload Issues')}</button>
        )}
        {(job.status === 'complete' || needsReview) && job.result?.projectId && onOpenAnalysis && (
          <button
            type="button"
            onClick={() => onOpenAnalysis(job.result!.projectId!)}
            className={isIntake ? 'dsc-btn dsc-btn-primary shrink-0' : 'btn btn-primary shrink-0'}
          >
            {t('Open analysis')}
          </button>
        )}
        {(job.status === 'pending' || job.status === 'complete' || job.status === 'error' || isSkipped || needsReview) && (
          <button
            type="button"
            onClick={() => onRemove(job.id)}
            aria-label={t('Remove {{filename}} from intake', { filename: job.filename })}
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
