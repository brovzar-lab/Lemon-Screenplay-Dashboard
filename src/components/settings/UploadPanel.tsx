/**
 * Upload Panel
 * File/folder selection, category assignment, model selection, upload queue, API configuration.
 * Orchestrates sub-components under ./upload/ while owning all upload business logic.
 */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUploadStore, type UploadStatus } from '@/stores/uploadStore';
import { useApiConfigStore } from '@/stores/apiConfigStore';
import { SCREENPLAYS_QUERY_KEY } from '@/hooks/useScreenplays';
import { analyzeScreenplay } from '@/lib/analysisService';
import { saveAnalysis } from '@/lib/analysisStore';
import useCategories from '@/hooks/useCategories';
import { useToastStore } from '@/stores/toastStore';

import { ApiConfigToggle } from './upload/ApiConfigToggle';
import { ModelSelector } from './upload/ModelSelector';
import { CategorySelector } from './upload/CategorySelector';
import { UploadDropzone } from './upload/UploadDropzone';
import { UploadQueue } from './upload/UploadQueue';
import { UploadInstructions } from './upload/UploadInstructions';
import { MODEL_OPTIONS, MODEL_COSTS } from './upload/upload.constants';
import type { ModelOption } from './upload/upload.types';

export function UploadPanel() {
  const [selectedCategory, setSelectedCategory] = useState('LEMON');
  const [selectedModel, setSelectedModel] = useState<ModelOption>('sonnet');
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [analysisEngine, setAnalysisEngine] = useState<'v6' | 'v7'>('v7');
  const { categoryIds, addCategory: addCategoryToStore } = useCategories();

  const { jobs, addJob, updateJob, removeJob, clearCompleted, isProcessing, setProcessing, getFile } = useUploadStore();
  const { apiKey, canMakeRequest, incrementUsage } = useApiConfigStore();
  // Derive isConfigured from the actual key — never trust the persisted boolean flag
  const isConfigured = apiKey.length > 0;
  const queryClient = useQueryClient();

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        addJob(file.name, selectedCategory, file);
      }
    });
  };

  // Process pending jobs sequentially
  const processJobs = useCallback(async () => {
    if (isProcessing) return;
    setProcessing(true);

    const pending = useUploadStore.getState().jobs.filter((j) => j.status === 'pending');
    const isHybrid = selectedModel === 'hybrid';
    const firstPassModel = isHybrid ? 'sonnet' : selectedModel;
    const costRates = MODEL_COSTS[firstPassModel];

    for (const job of pending) {
      const file = getFile(job.id);
      if (!file) {
        updateJob(job.id, { status: 'error', error: 'File no longer available. Please re-add.' });
        continue;
      }

      try {
        // ─── Pass 1: Analyze with selected model (or Sonnet for hybrid) ───
        const result = await analyzeScreenplay(
          file,
          job.category,
          {
            apiKey,
            model: firstPassModel,
            lenses: ['commercial'],
            analysisVersion: analysisEngine,
            v7Mode: 'full',
          },
          (progress) => {
            updateJob(job.id, {
              status: progress.stage === 'error' ? 'error' : progress.stage as UploadStatus,
              progress: progress.percent,
            });
          },
        );

        // Estimate cost for first pass
        let totalCost = result.usage
          ? (result.usage.input_tokens * costRates.input + result.usage.output_tokens * costRates.output) / 1000
          : 0.50;

        // ─── Hybrid Pass 2: Check verdict and optionally re-analyze with Opus ───
        let finalRaw = result.raw;
        if (isHybrid) {
          const analysis = result.raw.analysis as Record<string, Record<string, unknown>> | undefined;
          const verdict = (analysis?.core_quality?.verdict as string) ?? '';
          const vLower = verdict.toLowerCase();
          const isPromoted = vLower.includes('recommend') || vLower.includes('film_now') || vLower.includes('film now');

          if (isPromoted) {
            // Promote to Opus deep analysis
            updateJob(job.id, { status: 'promoting', progress: 0 });

            const opusResult = await analyzeScreenplay(
              file,
              job.category,
              { apiKey, model: 'opus', lenses: ['commercial'] },
              (progress) => {
                updateJob(job.id, { status: 'promoting', progress: progress.percent });
              },
            );

            // Add Opus cost
            const opusCostRates = MODEL_COSTS.opus;
            if (opusResult.usage) {
              totalCost += (opusResult.usage.input_tokens * opusCostRates.input + opusResult.usage.output_tokens * opusCostRates.output) / 1000;
            } else {
              totalCost += 2.00; // estimate
            }

            finalRaw = opusResult.raw;
          }
        }

        // Save final result to Firestore
        await saveAnalysis(finalRaw);
        incrementUsage(totalCost);

        // Determine which model produced the final result
        const finalModel = (finalRaw.analysis_model as string) ?? firstPassModel;
        const wasPromoted = isHybrid && finalModel.includes('opus');

        updateJob(job.id, {
          status: 'complete',
          progress: 100,
          result: {
            title: result.parsed.title,
            author: wasPromoted ? '\u2B06\uFE0F Opus (promoted)' : 'See analysis',
            analysisPath: 'firestore',
          },
          completedAt: new Date().toISOString(),
        });

        // Invalidate the screenplays query so the new analysis appears
        queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY });
      } catch (err) {
        // FirebaseError from httpsCallable has .message with the Cloud Function's message
        let message = 'Unknown error';
        if (err instanceof Error) {
          message = err.message;
          message = message.replace(/^(functions\/[a-z-]+:\s*)/i, '');
        }
        console.error('[Upload] Analysis failed:', err);
        useToastStore.getState().addToast('Analysis failed — please check the file and try again');
        updateJob(job.id, { status: 'error', error: message });
      }
    }

    setProcessing(false);
  }, [isProcessing, setProcessing, getFile, updateJob, apiKey, selectedModel, analysisEngine, incrementUsage, queryClient]);

  // Retry a failed job: reset to pending and re-trigger processing
  const retryJob = useCallback((jobId: string) => {
    updateJob(jobId, { status: 'pending', error: undefined, progress: 0 });
    setTimeout(() => { processJobs(); }, 100);
  }, [updateJob, processJobs]);

  const pendingJobs = jobs.filter((j) => j.status === 'pending');

  // Calculate batch cost estimate
  const batchCostEstimate = pendingJobs.length > 0
    ? `~$${(pendingJobs.length * parseFloat(MODEL_OPTIONS.find(m => m.id === selectedModel)!.costPerScript.replace(/[^0-9.]/g, ''))).toFixed(2)}`
    : null;

  const handleStartProcessing = () => {
    if (!isConfigured) {
      setShowApiConfig(true);
      return;
    }
    if (!canMakeRequest()) {
      alert('Cannot process: Budget limit reached or daily request limit exceeded. Check API Configuration.');
      return;
    }
    processJobs();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-display text-gold-200 mb-2">Upload Screenplays</h2>
        <p className="text-sm text-black-400">
          Upload PDF screenplays for AI analysis. Select V6 (single-pass) or V7 Archaeology Engine (5-reader deep analysis).
        </p>
      </div>

      <ApiConfigToggle
        isConfigured={isConfigured}
        showApiConfig={showApiConfig}
        onToggle={() => setShowApiConfig(!showApiConfig)}
      />

      <ModelSelector
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        pendingCount={pendingJobs.length}
        batchCostEstimate={batchCostEstimate}
      />

      {/* Analysis Engine Toggle */}
      <div>
        <label className="block text-sm font-medium text-gold-300 mb-3">
          Analysis Engine
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setAnalysisEngine('v6')}
            className={`relative p-4 rounded-xl border text-left transition-all ${
              analysisEngine === 'v6'
                ? 'border-gold-500/60 bg-gold-500/10 ring-1 ring-gold-500/30'
                : 'border-black-700 bg-black-800/50 hover:border-gold-500/30 hover:bg-black-800'
            }`}
          >
            {analysisEngine === 'v6' && (
              <div className="absolute top-3 left-3">
                <div className="w-4 h-4 rounded-full bg-gold-500 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            )}
            <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider bg-black-600/50 text-black-300">
              LEGACY
            </span>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📋</span>
              <div>
                <p className={`font-semibold text-sm ${analysisEngine === 'v6' ? 'text-gold-200' : 'text-black-200'}`}>V6 Standard</p>
                <p className="text-xs text-black-400">Single-pass analysis</p>
              </div>
            </div>
            <p className="text-xs text-black-400 leading-relaxed">
              Original single-prompt analysis. 1 API call per script.
            </p>
          </button>

          <button
            onClick={() => setAnalysisEngine('v7')}
            className={`relative p-4 rounded-xl border text-left transition-all ${
              analysisEngine === 'v7'
                ? 'border-gold-500/60 bg-gold-500/10 ring-1 ring-gold-500/30'
                : 'border-black-700 bg-black-800/50 hover:border-gold-500/30 hover:bg-black-800'
            }`}
          >
            {analysisEngine === 'v7' && (
              <div className="absolute top-3 left-3">
                <div className="w-4 h-4 rounded-full bg-gold-500 flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            )}
            <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider bg-amber-500/20 text-amber-400">
              NEW
            </span>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">⛏️</span>
              <div>
                <p className={`font-semibold text-sm ${analysisEngine === 'v7' ? 'text-gold-200' : 'text-black-200'}`}>V7 Archaeology</p>
                <p className="text-xs text-black-400">5-reader deep analysis</p>
              </div>
            </div>
            <p className="text-xs text-black-400 leading-relaxed">
              5 expert readers in parallel + synthesis roundtable. 6 API calls, ~$1/script.
            </p>
          </button>
        </div>
      </div>

      <CategorySelector
        categoryIds={categoryIds}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onAddCategory={addCategoryToStore}
      />

      <UploadDropzone onFilesSelected={handleFileSelect} />

      <UploadQueue
        jobs={jobs}
        isProcessing={isProcessing}
        isConfigured={isConfigured}
        selectedModel={selectedModel}
        batchCostEstimate={batchCostEstimate}
        onRemoveJob={removeJob}
        onRetryJob={retryJob}
        onClearCompleted={clearCompleted}
        onStartProcessing={handleStartProcessing}
      />

      <UploadInstructions />
    </div>
  );
}

export default UploadPanel;
