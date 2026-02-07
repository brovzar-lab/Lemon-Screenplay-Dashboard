/**
 * Upload Panel
 * File/folder selection, category assignment, upload queue, API configuration
 */

import { useState, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import { useUploadStore, type UploadJob, type UploadStatus } from '@/stores/uploadStore';
import { useApiConfigStore } from '@/stores/apiConfigStore';
import { SCREENPLAYS_QUERY_KEY } from '@/hooks/useScreenplays';
import { analyzeScreenplay } from '@/lib/analysisService';
import { saveLocalAnalysis } from '@/lib/localAnalysisStore';
import { ApiConfigPanel } from './ApiConfigPanel';

// Default categories - will be merged with custom categories
const DEFAULT_CATEGORIES = ['BLKLST', 'LEMON', 'SUBMISSION', 'CONTEST', 'OTHER'];

// Get all categories including custom ones from localStorage
function getAllCategories(): string[] {
  const stored = localStorage.getItem('lemon-custom-categories');
  if (stored) {
    try {
      const custom = JSON.parse(stored) as { id: string }[];
      return [...DEFAULT_CATEGORIES, ...custom.map(c => c.id)];
    } catch {
      return DEFAULT_CATEGORIES;
    }
  }
  return DEFAULT_CATEGORIES;
}

const STATUS_LABELS: Record<UploadStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-black-400' },
  parsing: { label: 'Parsing PDF...', color: 'text-blue-400' },
  analyzing: { label: 'AI Analyzing...', color: 'text-gold-400' },
  complete: { label: 'Complete', color: 'text-emerald-400' },
  error: { label: 'Error', color: 'text-red-400' },
};

const UPLOAD_PASSWORD = '1234';

export function UploadPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState('LEMON');
  const [dragActive, setDragActive] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [categories] = useState(getAllCategories);

  // Password protection state
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const { jobs, addJob, updateJob, removeJob, clearCompleted, isProcessing, setProcessing, getFile } = useUploadStore();
  const { isConfigured, apiKey, canMakeRequest, incrementUsage } = useApiConfigStore();
  const queryClient = useQueryClient();

  const handlePasswordSubmit = () => {
    if (passwordInput === UPLOAD_PASSWORD) {
      setIsUnlocked(true);
      setPasswordError('');
    } else {
      setPasswordError('Incorrect password');
      setPasswordInput('');
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        addJob(file.name, selectedCategory, file);
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  // Process pending jobs sequentially
  const processJobs = useCallback(async () => {
    if (isProcessing) return;
    setProcessing(true);

    const pending = useUploadStore.getState().jobs.filter((j) => j.status === 'pending');

    for (const job of pending) {
      const file = getFile(job.id);
      if (!file) {
        updateJob(job.id, { status: 'error', error: 'File no longer available. Please re-add.' });
        continue;
      }

      try {
        await analyzeScreenplay(
          file,
          job.category,
          {
            apiKey,
            model: 'sonnet',
            lenses: ['commercial'],
          },
          (progress) => {
            updateJob(job.id, {
              status: progress.stage === 'error' ? 'error' : progress.stage as UploadStatus,
              progress: progress.percent,
            });
          },
        ).then((result) => {
          // Save to localStorage for persistence
          saveLocalAnalysis(result.raw);

          // Estimate cost (~$0.015 per 1K input + $0.075 per 1K output for Sonnet)
          const cost = result.usage
            ? (result.usage.input_tokens * 0.003 + result.usage.output_tokens * 0.015) / 1000
            : 0.50; // estimate if no usage data

          incrementUsage(cost);

          updateJob(job.id, {
            status: 'complete',
            progress: 100,
            result: {
              title: result.parsed.title,
              author: 'See analysis',
              analysisPath: 'localStorage',
            },
            completedAt: new Date().toISOString(),
          });

          // Invalidate the screenplays query so the new analysis appears
          queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY });
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        updateJob(job.id, {
          status: 'error',
          error: message,
        });
      }
    }

    setProcessing(false);
  }, [isProcessing, setProcessing, getFile, updateJob, apiKey, incrementUsage, queryClient]);

  const pendingJobs = jobs.filter((j) => j.status === 'pending');
  const activeJobs = jobs.filter((j) => j.status === 'parsing' || j.status === 'analyzing');
  const completedJobs = jobs.filter((j) => j.status === 'complete' || j.status === 'error');

  // Password protection gate
  if (!isUnlocked) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-display text-gold-200 mb-2">Upload Screenplays</h2>
          <p className="text-sm text-black-400">
            Upload PDF screenplays for AI analysis. Files will be parsed and analyzed using the V6 Core + Lenses system.
          </p>
        </div>

        {/* Password Protection */}
        <div className="p-8 rounded-xl bg-black-800/50 border border-black-700 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-gold-500/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gold-200 mb-2">Protected Section</h3>
          <p className="text-sm text-black-400 mb-6">Enter password to access the upload functionality</p>
          <div className="max-w-xs mx-auto space-y-4">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              placeholder="Enter password"
              className="input text-center w-full"
              autoFocus
            />
            {passwordError && (
              <p className="text-sm text-red-400">{passwordError}</p>
            )}
            <button
              onClick={handlePasswordSubmit}
              className="btn btn-primary w-full"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              Unlock Upload
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-display text-gold-200 mb-2">Upload Screenplays</h2>
        <p className="text-sm text-black-400">
          Upload PDF screenplays for AI analysis. Files will be parsed and analyzed using the V6 Core + Lenses system.
        </p>
      </div>

      {/* API Configuration Toggle */}
      <div className="border border-black-700 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowApiConfig(!showApiConfig)}
          className="w-full flex items-center justify-between p-4 bg-black-800/50 hover:bg-black-800 transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div className="text-left">
              <span className="font-medium text-gold-200">API Configuration</span>
              <span className={clsx(
                'ml-2 text-xs px-2 py-0.5 rounded-full',
                isConfigured ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
              )}>
                {isConfigured ? 'Configured' : 'Not Configured'}
              </span>
            </div>
          </div>
          <svg
            className={clsx('w-5 h-5 text-black-400 transition-transform', showApiConfig && 'rotate-180')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showApiConfig && (
          <div className="p-4 border-t border-black-700">
            <ApiConfigPanel />
          </div>
        )}
      </div>

      {/* Category Selection */}
      <div>
        <label className="block text-sm font-medium text-gold-300 mb-2">
          Assign Category
        </label>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                selectedCategory === cat
                  ? 'bg-gold-500/30 text-gold-300 border border-gold-500/50'
                  : 'bg-black-800/50 text-black-300 border border-black-700 hover:border-gold-500/30'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={clsx(
          'relative border-2 border-dashed rounded-xl p-12 text-center transition-all',
          dragActive
            ? 'border-gold-400 bg-gold-500/10'
            : 'border-black-600 hover:border-gold-500/50'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-gold-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <div>
            <p className="text-gold-200 font-medium">
              Drop PDF files here or click to browse
            </p>
            <p className="text-sm text-black-400 mt-1">
              Supports multiple PDF screenplays
            </p>
          </div>
        </div>
      </div>

      {/* Upload Queue */}
      {jobs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gold-200">Upload Queue</h3>
            {completedJobs.length > 0 && (
              <button
                onClick={clearCompleted}
                className="text-sm text-black-400 hover:text-gold-400 transition-colors"
              >
                Clear completed
              </button>
            )}
          </div>

          <div className="space-y-2">
            {/* Active Jobs */}
            {activeJobs.map((job) => (
              <JobItem key={job.id} job={job} onRemove={removeJob} />
            ))}

            {/* Pending Jobs */}
            {pendingJobs.map((job) => (
              <JobItem key={job.id} job={job} onRemove={removeJob} />
            ))}

            {/* Completed Jobs */}
            {completedJobs.map((job) => (
              <JobItem key={job.id} job={job} onRemove={removeJob} />
            ))}
          </div>

          {/* Start Processing Button */}
          {pendingJobs.length > 0 && !isProcessing && (
            <div className="space-y-2">
              <button
                onClick={() => {
                  if (!isConfigured) {
                    setShowApiConfig(true);
                    return;
                  }
                  if (!canMakeRequest()) {
                    alert('Cannot process: Budget limit reached or daily request limit exceeded. Check API Configuration.');
                    return;
                  }
                  processJobs();
                }}
                disabled={!isConfigured}
                className={clsx(
                  'btn w-full',
                  isConfigured ? 'btn-primary' : 'btn-secondary opacity-70'
                )}
              >
                {isConfigured ? (
                  `Start Analysis (${pendingJobs.length} files)`
                ) : (
                  'Configure API to Start Analysis'
                )}
              </button>
              {!isConfigured && (
                <p className="text-xs text-amber-400 text-center">
                  Click "API Configuration" above to set up your API key and budget limits
                </p>
              )}
            </div>
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gold-500/10 border border-gold-500/20">
              <div className="w-5 h-5 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gold-300">Processing... This may take 2-5 minutes per screenplay.</p>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="p-4 rounded-lg bg-black-800/50 border border-black-700">
        <h4 className="text-sm font-medium text-gold-300 mb-2">How It Works</h4>
        <ol className="text-sm text-black-400 space-y-1 list-decimal list-inside">
          <li>Configure your Anthropic API key above</li>
          <li>Drop PDF screenplays into the upload zone</li>
          <li>Click "Start Analysis" — each script takes 2-5 minutes</li>
          <li>Results appear automatically in the dashboard</li>
        </ol>
        <p className="text-xs text-black-500 mt-3">
          Analysis uses Claude Sonnet with the V6 Core + Lenses system.
          Estimated cost: ~$0.10-0.50 per screenplay depending on length.
        </p>
      </div>
    </div>
  );
}

interface JobItemProps {
  job: UploadJob;
  onRemove: (id: string) => void;
}

function JobItem({ job, onRemove }: JobItemProps) {
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

      {/* Remove Button */}
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

export default UploadPanel;
