/**
 * Upload Panel
 * File/folder selection, category assignment, model selection, upload queue, API configuration
 */

import { useState, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import { useUploadStore, type UploadJob, type UploadStatus } from '@/stores/uploadStore';
import { useApiConfigStore } from '@/stores/apiConfigStore';
import { SCREENPLAYS_QUERY_KEY } from '@/hooks/useScreenplays';
import { analyzeScreenplay } from '@/lib/analysisService';
import { saveLocalAnalysis } from '@/lib/localAnalysisStore';
import useCategories from '@/hooks/useCategories';
import { ApiConfigPanel } from './ApiConfigPanel';


// ─── Model definitions ───────────────────────────────────────────────────────

type ModelOption = 'haiku' | 'sonnet' | 'opus';

interface ModelInfo {
  id: ModelOption;
  name: string;
  subtitle: string;
  costPerScript: string;
  speed: string;
  quality: string;
  badge: string;
  badgeColor: string;
  description: string;
  icon: string;
}

const MODEL_OPTIONS: ModelInfo[] = [
  {
    id: 'haiku',
    name: 'Haiku 4.5',
    subtitle: 'Fast & Affordable',
    costPerScript: '~$0.06',
    speed: '~1 min',
    quality: 'Good',
    badge: 'BUDGET',
    badgeColor: 'bg-emerald-500/20 text-emerald-400',
    description: 'Best for bulk scanning. Great accuracy for structured analysis at a fraction of the cost. Ideal for processing large batches of 100+ screenplays.',
    icon: '⚡',
  },
  {
    id: 'sonnet',
    name: 'Sonnet 4.5',
    subtitle: 'Balanced Power',
    costPerScript: '~$0.22',
    speed: '~3 min',
    quality: 'Excellent',
    badge: 'RECOMMENDED',
    badgeColor: 'bg-gold-500/20 text-gold-400',
    description: 'Best quality-to-cost ratio. Deep character analysis, nuanced genre detection, and reliable scoring. The default choice for professional analysis.',
    icon: '🎯',
  },
  {
    id: 'opus',
    name: 'Opus 4.6',
    subtitle: 'Maximum Depth',
    costPerScript: '~$0.90',
    speed: '~5 min',
    quality: 'Premium',
    badge: 'PREMIUM',
    badgeColor: 'bg-purple-500/20 text-purple-400',
    description: 'Deepest analysis with the most nuanced insights. Best for high-priority screenplays where you need every detail. 4x the cost of Sonnet.',
    icon: '👑',
  },
];

// ─── Status labels ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<UploadStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-black-400' },
  parsing: { label: 'Parsing PDF...', color: 'text-blue-400' },
  analyzing: { label: 'AI Analyzing...', color: 'text-gold-400' },
  complete: { label: 'Complete', color: 'text-emerald-400' },
  error: { label: 'Error', color: 'text-red-400' },
};

// Token cost multipliers per model (per 1K tokens)
const MODEL_COSTS: Record<ModelOption, { input: number; output: number }> = {
  haiku: { input: 0.001, output: 0.005 },
  sonnet: { input: 0.003, output: 0.015 },
  opus: { input: 0.015, output: 0.075 },
};

export function UploadPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState('LEMON');
  const [selectedModel, setSelectedModel] = useState<ModelOption>('sonnet');
  const [dragActive, setDragActive] = useState(false);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const { categoryIds, addCategory: addCategoryToStore } = useCategories();

  // Inline new category form
  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatError, setNewCatError] = useState('');

  const { jobs, addJob, updateJob, removeJob, clearCompleted, isProcessing, setProcessing, getFile } = useUploadStore();
  const { isConfigured, apiKey, canMakeRequest, incrementUsage } = useApiConfigStore();
  const queryClient = useQueryClient();

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
    const costRates = MODEL_COSTS[selectedModel];

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
            model: selectedModel,
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

          // Estimate cost based on selected model
          const cost = result.usage
            ? (result.usage.input_tokens * costRates.input + result.usage.output_tokens * costRates.output) / 1000
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
  }, [isProcessing, setProcessing, getFile, updateJob, apiKey, selectedModel, incrementUsage, queryClient]);

  const pendingJobs = jobs.filter((j) => j.status === 'pending');
  const activeJobs = jobs.filter((j) => j.status === 'parsing' || j.status === 'analyzing');
  const completedJobs = jobs.filter((j) => j.status === 'complete' || j.status === 'error');

  // Calculate batch cost estimate
  const batchCostEstimate = pendingJobs.length > 0
    ? `~$${(pendingJobs.length * parseFloat(MODEL_OPTIONS.find(m => m.id === selectedModel)!.costPerScript.replace(/[^0-9.]/g, ''))).toFixed(2)}`
    : null;

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

      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium text-gold-300 mb-3">
          Analysis Model
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {MODEL_OPTIONS.map((model) => (
            <button
              key={model.id}
              onClick={() => setSelectedModel(model.id)}
              className={clsx(
                'relative p-4 rounded-xl border text-left transition-all',
                selectedModel === model.id
                  ? 'border-gold-500/60 bg-gold-500/10 ring-1 ring-gold-500/30'
                  : 'border-black-700 bg-black-800/50 hover:border-gold-500/30 hover:bg-black-800'
              )}
            >
              {/* Badge */}
              <span className={clsx(
                'absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider',
                model.badgeColor
              )}>
                {model.badge}
              </span>

              {/* Model Header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{model.icon}</span>
                <div>
                  <p className={clsx(
                    'font-semibold text-sm',
                    selectedModel === model.id ? 'text-gold-200' : 'text-black-200'
                  )}>
                    {model.name}
                  </p>
                  <p className="text-xs text-black-400">{model.subtitle}</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 mt-3 mb-3">
                <div className="text-center">
                  <p className="text-xs text-black-500 mb-0.5">Cost</p>
                  <p className={clsx(
                    'text-sm font-mono font-bold',
                    model.id === 'haiku' ? 'text-emerald-400' :
                      model.id === 'sonnet' ? 'text-gold-400' : 'text-purple-400'
                  )}>
                    {model.costPerScript}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-black-500 mb-0.5">Speed</p>
                  <p className="text-sm font-mono text-black-300">{model.speed}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-black-500 mb-0.5">Quality</p>
                  <p className="text-sm font-mono text-black-300">{model.quality}</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-black-400 leading-relaxed">
                {model.description}
              </p>

              {/* Selection Indicator */}
              {selectedModel === model.id && (
                <div className="absolute top-3 left-3">
                  <div className="w-4 h-4 rounded-full bg-gold-500 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Batch cost estimate */}
        {pendingJobs.length > 0 && batchCostEstimate && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-black-400">
              Estimated batch cost for {pendingJobs.length} files with {MODEL_OPTIONS.find(m => m.id === selectedModel)!.name}: {' '}
              <span className="font-mono text-gold-300">{batchCostEstimate}</span>
            </span>
          </div>
        )}
      </div>

      {/* Category Selection */}
      <div>
        <label className="block text-sm font-medium text-gold-300 mb-2">
          Assign Category
        </label>
        <div className="flex flex-wrap gap-2">
          {categoryIds.map((cat) => (
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

          {/* New + Button */}
          <button
            onClick={() => setShowNewCatForm(!showNewCatForm)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              showNewCatForm
                ? 'bg-gold-500/30 text-gold-300 border border-gold-500/50'
                : 'bg-black-800/50 text-black-400 border border-dashed border-black-600 hover:border-gold-500/30 hover:text-gold-300'
            )}
          >
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New
            </span>
          </button>
        </div>

        {/* Inline New Category Form */}
        {showNewCatForm && (
          <div className="mt-3 p-3 rounded-lg bg-black-800/50 border border-black-700 space-y-3">
            <div>
              <label className="block text-xs text-black-400 mb-1">Category Name</label>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Independent Films"
                className="input w-full text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.target as HTMLInputElement).form?.querySelector<HTMLButtonElement>('.btn-primary')?.click();
                  }
                }}
              />
            </div>
            {newCatError && <p className="text-xs text-red-400">{newCatError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setNewCatError('');
                  const name = newCatName.trim();
                  if (!name) { setNewCatError('Enter a category name'); return; }
                  // Auto-generate ID from name: uppercase, no spaces, max 10 chars
                  const id = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                  if (id.length < 2) { setNewCatError('Name too short'); return; }
                  if (categoryIds.includes(id)) { setNewCatError(`"${id}" already exists`); return; }
                  addCategoryToStore({ id, name, description: `Created during upload` });
                  setSelectedCategory(id);
                  setNewCatName('');
                  setShowNewCatForm(false);
                }}
                className="btn btn-primary text-xs"
              >
                Create & Select
              </button>
              <button
                onClick={() => { setShowNewCatForm(false); setNewCatName(''); setNewCatError(''); }}
                className="btn text-xs text-black-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
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
                  <>
                    Start Analysis ({pendingJobs.length} files)
                    <span className="ml-2 text-xs opacity-70">
                      using {MODEL_OPTIONS.find(m => m.id === selectedModel)!.name}
                      {batchCostEstimate && ` • ${batchCostEstimate}`}
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
      )}

      {/* Instructions */}
      <div className="p-4 rounded-lg bg-black-800/50 border border-black-700">
        <h4 className="text-sm font-medium text-gold-300 mb-2">How It Works</h4>
        <ol className="text-sm text-black-400 space-y-1 list-decimal list-inside">
          <li>Configure your Anthropic API key above</li>
          <li>Choose your analysis model (Haiku for bulk, Sonnet for depth)</li>
          <li>Drop PDF screenplays into the upload zone</li>
          <li>Click &quot;Start Analysis&quot; — results appear automatically</li>
        </ol>
        <div className="mt-3 p-3 rounded-lg bg-black-900/60 border border-black-700/50">
          <p className="text-xs text-gold-400/80 font-medium mb-1">💡 Pro Tip: Hybrid Strategy</p>
          <p className="text-xs text-black-400">
            For large batches, scan everything with <strong className="text-emerald-400">Haiku</strong> first (~$0.06/script),
            then re-analyze your top picks with <strong className="text-gold-400">Sonnet</strong> for deeper insights.
            This gives you the best of both worlds at a fraction of the cost.
          </p>
        </div>
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
