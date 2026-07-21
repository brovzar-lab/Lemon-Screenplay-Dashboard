/**
 * Upload Queue
 * Displays the job queue with active/pending/completed sections,
 * start button, and processing indicator.
 * Surfaces duplicate count banner and keeps duplicates out of the active queue.
 */

import { clsx } from 'clsx';
import { isUploadJobReady, type UploadJob } from '@/stores/uploadStore';
import { MODEL_OPTIONS } from './upload.constants';
import type { ModelOption } from './upload.types';
import { JobItem } from './JobItem';

interface UploadQueueProps {
  jobs: UploadJob[];
  isProcessing: boolean;
  isConfigured: boolean;
  selectedModel: ModelOption;
  batchCostEstimate: string | null;
  onRemoveJob: (id: string) => void;
  onRetryJob: (id: string) => void;
  onClearCompleted: () => void;
  onStartProcessing: () => void;
  onSkipJob: (id: string) => void;
  onChooseRevision: (id: string) => void;
  onChooseSeparate: (id: string) => void;
}

export function UploadQueue({
  jobs,
  isProcessing,
  isConfigured,
  selectedModel,
  batchCostEstimate,
  onRemoveJob,
  onRetryJob,
  onClearCompleted,
  onStartProcessing,
  onSkipJob,
  onChooseRevision,
  onChooseSeparate,
}: UploadQueueProps) {
  const pendingJobs = jobs.filter((j) => j.status === 'pending');
  const actionablePending = pendingJobs.filter(isUploadJobReady);
  const activeJobs = jobs.filter((j) => j.status === 'parsing' || j.status === 'analyzing' || j.status === 'promoting');
  const completedJobs = jobs.filter((j) => j.status === 'complete' || j.status === 'error');
  const skippedJobs = jobs.filter((j) => j.status === 'skipped');
  const duplicateCount = pendingJobs.filter((j) => j.isDuplicate).length;
  const decisionCount = pendingJobs.filter(
    (j) => !j.isDuplicate && j.possibleMatchProjectId && !j.matchResolution,
  ).length;

  if (jobs.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gold-200">Upload Queue</h3>
        {(completedJobs.length > 0 || skippedJobs.length > 0) && (
          <button
            onClick={onClearCompleted}
            className="text-sm text-black-400 hover:text-gold-400 transition-colors"
          >
            Clear completed
          </button>
        )}
      </div>

      {/* Duplicate summary banner */}
      {duplicateCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-xs text-amber-300">
            <span className="font-medium">{duplicateCount} exact duplicate{duplicateCount > 1 ? 's' : ''}</span> blocked to prevent unnecessary AI spend
          </p>
        </div>
      )}

      {decisionCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <p className="text-sm text-blue-200">
            <span className="font-medium">{decisionCount} possible match{decisionCount > 1 ? 'es' : ''}</span> need your decision before analysis
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
              'btn w-full',
              isConfigured ? 'btn-primary' : 'btn-secondary opacity-70'
            )}
          >
            {isConfigured ? (
              <>
                Start Analysis ({actionablePending.length} file{actionablePending.length > 1 ? 's' : ''})
                <span className="ml-2 text-xs opacity-70">
                  using {MODEL_OPTIONS.find(m => m.id === selectedModel)!.name}
                  {batchCostEstimate && ` \u2022 ${batchCostEstimate}`}
                </span>
              </>
            ) : (
              'Configure API to Start Analysis'
            )}
          </button>
          {duplicateCount > 0 && actionablePending.length > 0 && (
            <p className="text-xs text-amber-400/70 text-center">
              Exact duplicates are excluded from this analysis run.
            </p>
          )}
          {!isConfigured && (
            <p className="text-xs text-amber-400 text-center">
              Click &quot;API Configuration&quot; above to set up your API key and budget limits
            </p>
          )}
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-gold-500/10 border border-gold-500/20">
          <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gold-300">
            Processing with {MODEL_OPTIONS.find(m => m.id === selectedModel)!.name}... {' '}
            {selectedModel === 'haiku' ? 'This should be quick (~1 min per script).' :
              selectedModel === 'sonnet' ? 'This may take 2-3 minutes per screenplay.' :
                'Deep analysis in progress — ~5 minutes per screenplay.'}
          </p>
        </div>
      )}
    </div>
  );
}
