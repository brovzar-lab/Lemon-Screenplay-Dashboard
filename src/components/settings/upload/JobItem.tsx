/**
 * Job Item
 * Displays a single upload job with status, progress bar, and action buttons
 */

import type { UploadJob } from '@/stores/uploadStore';
import { STATUS_LABELS } from './upload.constants';

interface JobItemProps {
  job: UploadJob;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

export function JobItem({ job, onRemove, onRetry }: JobItemProps) {
  const status = STATUS_LABELS[job.status];

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-black-800/50 border border-black-700">
      {/* Status Icon */}
      <div className="w-8 h-8 shrink-0 flex items-center justify-center">
        {job.status === 'parsing' || job.status === 'analyzing' ? (
          <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
        ) : job.status === 'complete' ? (
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : job.status === 'error' ? (
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
        <div className="flex items-center gap-2 text-xs">
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
      </div>

      {/* Progress Bar */}
      {(job.status === 'parsing' || job.status === 'analyzing') && (
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
      {(job.status === 'pending' || job.status === 'complete' || job.status === 'error') && (
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
  );
}
