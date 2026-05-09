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
  const { categoryIds, addCategory: addCategoryToStore } = useCategories();

  const { jobs, addJob, updateJob, removeJob, clearCompleted, isProcessing, setProcessing, getFile } = useUploadStore();
  const { canMakeRequest, incrementUsage } = useApiConfigStore();
  // Proxy is always available (API keys are server-side)
  const isConfigured = true;
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
            model: firstPassModel,
            lenses: ['commercial'],
            analysisVersion: 'v7',
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
              { model: 'opus', lenses: ['commercial'] },
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
  }, [isProcessing, setProcessing, getFile, updateJob, selectedModel, incrementUsage, queryClient]);

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
          Upload PDF screenplays for AI analysis using the V7 Archaeology Engine (5-reader deep analysis).
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
