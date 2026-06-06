/**
 * Upload Panel
 * File/folder selection, category assignment, model selection, upload queue, API configuration.
 * Orchestrates sub-components under ./upload/ while owning all upload business logic.
 *
 * Analysis runs on the VPS daemon (not in-browser):
 *   PDF -> Storage (ingest-queue/{collection}/{file}.pdf)
 *        -> onScreenplayUploaded CF creates the Firestore queue doc
 *        -> daemon claims, runs V9 readers + synthesis, writes uploaded_analyses
 *        -> browser subscribes to the queue doc by storage_path and mirrors status
 *
 * Duplicate detection still runs client-side at queue-add time so the UI can
 * warn before uploading. TMDB enrichment used to fire post-save here; it's
 * temporarily disabled in this code path until a CF trigger on
 * uploaded_analyses takes over the job.
 */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUploadStore } from '@/stores/uploadStore';
import { useApiConfigStore } from '@/stores/apiConfigStore';
import { useScreenplays, SCREENPLAYS_QUERY_KEY } from '@/hooks/useScreenplays';
import { uploadPdfToIngestQueue } from '@/lib/firebase';
import { subscribeToIngestJob } from '@/lib/ingestQueueClient';
import useCategories from '@/hooks/useCategories';
import { useToastStore } from '@/stores/toastStore';

import { ApiConfigToggle } from './upload/ApiConfigToggle';
import { ModelSelector } from './upload/ModelSelector';
import { CategorySelector } from './upload/CategorySelector';
import { UploadDropzone } from './upload/UploadDropzone';
import { UploadQueue } from './upload/UploadQueue';
import { UploadInstructions } from './upload/UploadInstructions';
import { MODEL_OPTIONS } from './upload/upload.constants';
import type { ModelOption } from './upload/upload.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Infer screenplay title from a PDF filename — identical logic to pdfParser.ts.
 * We need this client-side before parsing so we can check for duplicates immediately.
 */
function inferTitleFromFilename(filename: string): string {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[_-]/g, ' ')
    .trim();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UploadPanel() {
  const [selectedCategory, setSelectedCategory] = useState('LEMON');
  const [selectedModel, setSelectedModel] = useState<ModelOption>('sonnet');
  const [showApiConfig, setShowApiConfig] = useState(false);
  const { categoryIds, addCategory: addCategoryToStore } = useCategories();

  const { jobs, addJob, updateJob, removeJob, clearCompleted, isProcessing, setProcessing, getFile } = useUploadStore();
  const { canMakeRequest } = useApiConfigStore();
  const { data: screenplays } = useScreenplays();
  // Proxy is always available (API keys are server-side)
  const isConfigured = true;
  const queryClient = useQueryClient();

  // ─── File selection + duplicate detection ──────────────────────────────────

  /** SHA-256 of a File via Web Crypto. Returns lowercase hex. */
  async function sha256Hex(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /** Query Firestore for any uploaded_analyses doc with matching content_hash.
   *  Returns the existing source_file/title if found. */
  async function findByContentHash(hash: string): Promise<string | null> {
    try {
      const { getDocs, query, collection, where, limit } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const q = query(
        collection(db, 'uploaded_analyses'),
        where('content_hash', '==', hash),
        limit(1),
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const data = snap.docs[0].data() as Record<string, unknown>;
      const analysis = (data.analysis as Record<string, unknown>) || {};
      return (
        (analysis.title as string) ||
        (data.source_file as string) ||
        snap.docs[0].id
      );
    } catch (err) {
      console.warn('[upload] content-hash dedup check failed:', err);
      return null;
    }
  }

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    // Process all files in parallel — hashing is async but local-only.
    await Promise.all(
      Array.from(files).map(async (file) => {
        if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) return;
        const jobId = addJob(file.name, selectedCategory, file);

        // Layer 1 (fast): title-match against already-loaded screenplays.
        if (screenplays && screenplays.length > 0) {
          const inferred = inferTitleFromFilename(file.name).toLowerCase();
          const match = screenplays.find(
            (s) => s.title.toLowerCase().trim() === inferred,
          );
          if (match) {
            updateJob(jobId, { isDuplicate: true, existingTitle: match.title });
            return; // skip the hash check — title match is enough
          }
        }

        // Layer 2 (true content dedup): SHA-256 of file bytes → Firestore lookup.
        // Catches re-uploads of the same PDF under a different filename.
        try {
          const hash = await sha256Hex(file);
          const existing = await findByContentHash(hash);
          if (existing) {
            updateJob(jobId, { isDuplicate: true, existingTitle: existing });
          }
        } catch (err) {
          console.warn('[upload] hash compute failed (proceeding):', err);
        }
      }),
    );
  };

  // ─── Duplicate action handlers ─────────────────────────────────────────────

  const handleForceReanalyze = useCallback((jobId: string) => {
    // Clear the duplicate flag so processJobs will include this job
    updateJob(jobId, { isDuplicate: false, existingTitle: undefined });
  }, [updateJob]);

  const handleSkipJob = useCallback((jobId: string) => {
    updateJob(jobId, { status: 'skipped' });
  }, [updateJob]);

  // ─── Process pending jobs via VPS daemon ──────────────────────────────────
  //
  // Browser uploads PDF to ingest-queue/{collection}/{filename}.pdf in Storage.
  // The onScreenplayUploaded Cloud Function creates the Firestore queue doc.
  // The VPS daemon claims it, runs V9 analysis, writes uploaded_analyses.
  // Browser subscribes to the queue doc by storage_path and mirrors status.

  const processOne = useCallback(async (jobId: string, requestedModel: string) => {
    const file = getFile(jobId);
    if (!file) {
      updateJob(jobId, { status: 'error', error: 'File no longer available. Please re-add.' });
      return;
    }
    const job = useUploadStore.getState().jobs.find((j) => j.id === jobId);
    if (!job) return;

    try {
      updateJob(jobId, { status: 'parsing', progress: 5 });
      const { storagePath } = await uploadPdfToIngestQueue(file, job.category, { requestedModel });
      updateJob(jobId, { status: 'analyzing', progress: 15, ingestQueueStoragePath: storagePath });

      await new Promise<void>((resolve) => {
        const unsub = subscribeToIngestJob(
          storagePath,
          (update) => {
            if (update.status === 'pending') {
              updateJob(jobId, { status: 'analyzing', progress: 20 });
            } else if (update.status === 'processing') {
              updateJob(jobId, { status: 'analyzing', progress: 60 });
            } else if (update.status === 'complete') {
              updateJob(jobId, {
                status: 'complete',
                progress: 100,
                result: {
                  title: inferTitleFromFilename(file.name),
                  author: 'See analysis',
                  analysisPath: 'firestore',
                },
                completedAt: new Date().toISOString(),
              });
              queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY });
              unsub();
              resolve();
            } else if (update.status === 'failed') {
              updateJob(jobId, {
                status: 'error',
                error: update.error || 'Daemon analysis failed',
              });
              unsub();
              resolve();
            } else if (update.status === 'skipped') {
              updateJob(jobId, {
                status: 'skipped',
                error: update.error || 'Job skipped',
              });
              unsub();
              resolve();
            }
          },
          (err) => {
            updateJob(jobId, { status: 'error', error: `Subscription error: ${err.message}` });
            unsub();
            resolve();
          },
        );
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Upload] Failed to enqueue job:', err);
      useToastStore.getState().addToast(`Upload failed: ${message}`);
      updateJob(jobId, { status: 'error', error: message });
    }
  }, [getFile, updateJob, queryClient]);

  const processJobs = useCallback(async () => {
    if (isProcessing) return;
    setProcessing(true);

    const pending = useUploadStore.getState().jobs.filter(
      (j) => j.status === 'pending' && !j.isDuplicate
    );

    // V9: daemon now supports `hybrid` directly via ingest_v9.run_v9_hybrid()
    // (Sonnet first pass; RECOMMEND/FILM_NOW results re-run on Opus).
    // Pass the user's selection through unchanged.
    const requestedModel = selectedModel;

    // Run uploads in parallel — daemon enforces its own worker concurrency cap
    await Promise.all(pending.map((job) => processOne(job.id, requestedModel)));

    setProcessing(false);
  }, [isProcessing, setProcessing, selectedModel, processOne]);

  // Retry a failed job: reset to pending and re-trigger processing
  const retryJob = useCallback((jobId: string) => {
    updateJob(jobId, { status: 'pending', error: undefined, progress: 0, isDuplicate: false });
    setTimeout(() => { processJobs(); }, 100);
  }, [updateJob, processJobs]);

  const pendingJobs = jobs.filter((j) => j.status === 'pending' && !j.isDuplicate);

  // Calculate batch cost estimate (only actionable pending jobs)
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
          Upload PDF screenplays for AI analysis using the V9 Archaeology Engine (5-reader deep analysis).
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
        onForceReanalyze={handleForceReanalyze}
        onSkipJob={handleSkipJob}
      />

      <UploadInstructions />
    </div>
  );
}

export default UploadPanel;
