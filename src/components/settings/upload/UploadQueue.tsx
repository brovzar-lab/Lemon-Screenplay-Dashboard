/**
 * Upload Queue
 * Displays the job queue with active/pending/completed sections,
 * start button, and processing indicator
 */

import { clsx } from 'clsx';
import type { UploadJob } from '@/stores/uploadStore';
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
}: UploadQueueProps) {
  const pendingJobs = jobs.filter((j) => j.status === 'pending');
  const activeJobs = jobs.filter((j) => j.status === 'parsing' || j.status === 'analyzing');
  const completedJobs = jobs.filter((j) => j.status === 'complete' || j.status === 'error');

  if (jobs.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gold-200">Upload Queue</h3>
        {completedJobs.length > 0 && (
          <button
            onClick={onClearCompleted}
            className="text-sm text-black-400 hover:text-gold-400 transition-colors"
          >
            Clear completed
          </button>
        )}
      </div>

      <div className="space-y-2">
        {/* Active Jobs */}
        {activeJobs.map((job) => (
          <JobItem key={job.id} job={job} onRemove={onRemoveJob} onRetry={onRetryJob} />
        ))}

        {/* Pending Jobs */}
        {pendingJobs.map((job) => (
          <JobItem key={job.id} job={job} onRemove={onRemoveJob} onRetry={onRetryJob} />
        ))}

        {/* Completed Jobs */}
        {completedJobs.map((job) => (
          <JobItem key={job.id} job={job} onRemove={onRemoveJob} onRetry={onRetryJob} />
        ))}
      </div>

      {/* Start Processing Button */}
      {pendingJobs.length > 0 && !isProcessing && (
        <div className="space-y-2">
          <button
            onClick={onStartProcessing}
            disabled={!isConfigured}
            className={clsx(
              'btn w-full',
              isConfigured ? 'btn-primary' : 'btn-secondary opacity-70'
            )}
          >
            {isConfigured ? (
              <>
                Start Analysis ({pendingJobs.length} files)
                <span className="ml-2 text-xs opacity-70">
                  using {MODEL_OPTIONS.find(m => m.id === selectedModel)!.name}
                  {batchCostEstimate && ` \u2022 ${batchCostEstimate}`}
                </span>
              </>
            ) : (
              'Configure API to Start Analysis'
            )}
          </button>
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
