/**
 * Upload Queue
 * Displays the job queue with active/pending/completed sections,
 * start button, and processing indicator.
 * Surfaces duplicate count banner and keeps duplicates out of the active queue.
 */

import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import {
  isUploadJobReady,
  isUploadTerminalStatus,
  type UploadJob,
} from '@/stores/uploadStore';
import { MODEL_OPTIONS } from './upload.constants';
import type { ModelOption, UploadPresentation } from '@/components/settings/upload/upload.types';
import { JobItem } from './JobItem';

interface UploadQueueProps {
  jobs: UploadJob[];
  isProcessing: boolean;
  isConfigured: boolean;
  selectedModel: ModelOption;
  engine: 'coverage_v1' | 'v9';
  batchCostEstimate: string | null;
  onRemoveJob: (id: string) => void;
  onRetryJob: (id: string) => void;
  onClearCompleted: () => void;
  onStartProcessing: () => void;
  onSkipJob: (id: string) => void;
  onChooseRevision: (id: string) => void;
  onChooseSeparate: (id: string) => void;
  onOpenAnalysis?: (projectId: string) => void;
  presentation?: UploadPresentation;
  headingId?: string;
}

export function UploadQueue({
  jobs,
  isProcessing,
  isConfigured,
  selectedModel,
  engine,
  batchCostEstimate,
  onRemoveJob,
  onRetryJob,
  onClearCompleted,
  onStartProcessing,
  onSkipJob,
  onChooseRevision,
  onChooseSeparate,
  onOpenAnalysis,
  presentation = 'settings',
  headingId,
}: UploadQueueProps) {
  const { t } = useTranslation();
  const pendingJobs = jobs.filter((j) => j.status === 'pending');
  const actionablePending = pendingJobs.filter(isUploadJobReady);
  const activeJobs = jobs.filter((job) =>
    job.status === 'uploading'
    || job.status === 'uploaded'
    || job.status === 'queued'
    || job.status === 'parsing'
    || job.status === 'analyzing'
    || job.status === 'promoting'
    || job.status === 'waiting_for_budget'
  );
  const terminalJobs = jobs.filter((job) => isUploadTerminalStatus(job.status));
  const completedJobs = terminalJobs.filter((job) => job.status !== 'skipped');
  const skippedJobs = jobs.filter((j) => j.status === 'skipped');
  const duplicateCount = pendingJobs.filter((j) => j.isDuplicate).length;
  const decisionCount = pendingJobs.filter(
    (j) => !j.isDuplicate && j.possibleMatchProjectId && !j.matchResolution,
  ).length;

  const isIntake = presentation === 'intake';
  const routeName = engine === 'coverage_v1'
    ? t('Coverage V1.2')
    : MODEL_OPTIONS.find((model) => model.id === selectedModel)?.name ?? selectedModel;
  const statusCounts = [
    [t('Uploaded'), jobs.filter((job) => job.status === 'uploaded').length],
    [t('Queued'), jobs.filter((job) => job.status === 'queued').length],
    [t('Analyzing'), jobs.filter((job) => (
      job.status === 'parsing' || job.status === 'analyzing' || job.status === 'promoting'
    )).length],
    [t('Ready'), jobs.filter((job) => job.status === 'complete').length],
    [t('Needs review'), jobs.filter((job) => job.status === 'needs_review').length],
    [t('Waiting for Budget'), jobs.filter((job) => job.status === 'waiting_for_budget').length],
    [t('Failed'), jobs.filter((job) => job.status === 'error').length],
  ] as const;

  if (jobs.length === 0) {
    if (!isIntake) return null;
    return (
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="dsc-kicker">{t('Live docket')}</p>
            <h2 id={headingId} className="dsc-display mt-2 text-3xl">{t('Intake ledger')}</h2>
          </div>
          <span className="text-sm text-[var(--dsc-ink-3)]">{t('0 projects in motion')}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" aria-label={t('Intake status counts')}>
          {statusCounts.map(([label, count]) => (
            <span
              key={label}
              className="rounded-full border border-[var(--dsc-line)] bg-[var(--dsc-surface-2)] px-3 py-1 text-xs text-[var(--dsc-ink-2)]"
            >
              {label} <strong className="text-[var(--dsc-ink)]">{count}</strong>
            </span>
          ))}
        </div>
        <div className="mt-6 grid min-h-40 place-items-center rounded-[var(--dsc-radius-card)] border border-dashed border-[var(--dsc-line)] bg-[var(--dsc-surface-2)] px-6 py-10 text-center">
          <div>
            <p className="font-semibold text-[var(--dsc-ink)]">{t('The desk is clear')}</p>
            <p className="mt-2 text-sm text-[var(--dsc-ink-3)]">{t('Add screenplay PDFs above. Their status will stay visible here.')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          {isIntake && <p className="dsc-kicker">{t('Live docket')}</p>}
          <h3 id={headingId} className={clsx(isIntake ? 'dsc-display mt-2 text-3xl' : 'text-lg font-medium text-gold-200')}>
            {t(isIntake ? 'Intake ledger' : 'Upload Queue')}
          </h3>
        </div>
        {terminalJobs.length > 0 && (
          <button
            onClick={onClearCompleted}
            className={clsx(
              'text-sm transition-colors',
              isIntake ? 'text-[var(--dsc-ink-3)] hover:text-[var(--dsc-accent)]' : 'text-black-400 hover:text-gold-400',
            )}
          >
            {t('Clear completed')}
          </button>
        )}
      </div>

      {isIntake && (
        <div className="flex flex-wrap gap-2" aria-label={t('Intake status counts')}>
          {statusCounts.map(([label, count]) => (
            <span
              key={label}
              className="rounded-full border border-[var(--dsc-line)] bg-[var(--dsc-surface-2)] px-3 py-1 text-xs text-[var(--dsc-ink-2)]"
            >
              {label} <strong className="text-[var(--dsc-ink)]">{count}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Duplicate summary banner */}
      {duplicateCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-amber-300">
            <span className="font-medium">{t('{{count}} exact duplicate', { count: duplicateCount })}</span> {t('blocked to prevent unnecessary AI spend')}
          </p>
        </div>
      )}

      {decisionCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <p className="text-sm text-blue-200">
            <span className="font-medium">{t('{{count}} possible match', { count: decisionCount })}</span> {t('need your decision before analysis')}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {/* Active Jobs */}
        {activeJobs.map((job) => (
          <JobItem
            key={job.id}
            job={job}
            onRemove={onRemoveJob}
            onRetry={onRetryJob}
            onSkip={onSkipJob}
            onChooseRevision={onChooseRevision}
            onChooseSeparate={onChooseSeparate}
            onOpenAnalysis={onOpenAnalysis}
            presentation={presentation}
          />
        ))}

        {/* Pending Jobs (duplicates appear here with their banner) */}
        {pendingJobs.map((job) => (
          <JobItem
            key={job.id}
            job={job}
            onRemove={onRemoveJob}
            onRetry={onRetryJob}
            onSkip={onSkipJob}
            onChooseRevision={onChooseRevision}
            onChooseSeparate={onChooseSeparate}
            onOpenAnalysis={onOpenAnalysis}
            presentation={presentation}
          />
        ))}

        {/* Skipped Jobs */}
        {skippedJobs.map((job) => (
          <JobItem
            key={job.id}
            job={job}
            onRemove={onRemoveJob}
            onRetry={onRetryJob}
            onChooseRevision={onChooseRevision}
            onChooseSeparate={onChooseSeparate}
            onOpenAnalysis={onOpenAnalysis}
            presentation={presentation}
          />
        ))}

        {/* Completed Jobs */}
        {completedJobs.map((job) => (
          <JobItem
            key={job.id}
            job={job}
            onRemove={onRemoveJob}
            onRetry={onRetryJob}
            onChooseRevision={onChooseRevision}
            onChooseSeparate={onChooseSeparate}
            onOpenAnalysis={onOpenAnalysis}
            presentation={presentation}
          />
        ))}
      </div>

      {/* Start Processing Button */}
      {actionablePending.length > 0 && !isProcessing && (
        <div className="space-y-2">
          <button
            id="start-analysis-btn"
            onClick={onStartProcessing}
            disabled={!isConfigured}
            className={clsx(
              'w-full',
              isIntake ? 'dsc-btn dsc-btn-primary' : 'btn',
              !isIntake && (isConfigured ? 'btn-primary' : 'btn-secondary opacity-70'),
            )}
          >
            {isConfigured ? (
              <>
                {t(isIntake ? 'Review and start analysis' : 'Start Analysis')} ({t('{{count}} file', { count: actionablePending.length })})
                <span className="ml-2 text-xs opacity-70">
                  {t('using {{model}}', { model: routeName })}
                  {batchCostEstimate && ` \u2022 ${batchCostEstimate}`}
                </span>
              </>
            ) : (
              t('Configure API to Start Analysis')
            )}
          </button>
          {duplicateCount > 0 && actionablePending.length > 0 && (
            <p className="text-xs text-amber-400/70 text-center">
              {t('Exact duplicates are excluded from this analysis run.')}
            </p>
          )}
          {!isConfigured && (
            <p className="text-xs text-amber-400 text-center">
              {t('Click “API Configuration” above to set up your API key and budget limits')}
            </p>
          )}
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className={clsx(
          'flex items-center gap-3 rounded-lg border p-3',
          isIntake ? 'border-[var(--dsc-accent)] bg-[var(--dsc-accent-soft)]' : 'border-gold-500/20 bg-gold-500/10',
        )}>
          <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gold-300">
            {t('Uploading files to the background queue...')}
          </p>
        </div>
      )}
    </div>
  );
}
