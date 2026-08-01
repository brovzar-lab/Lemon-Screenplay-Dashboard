/**
 * Upload Panel
 * File/folder selection, category assignment, model selection, upload queue, API configuration.
 * Orchestrates sub-components under ./upload/ while owning all upload business logic.
 *
 * Analysis runs on the VPS daemon (not in-browser):
 *   PDF -> Storage (ingest-queue/{collection}/{uploadId}/{file}.pdf)
 *        -> onScreenplayUploaded CF creates the Firestore queue doc
 *        -> daemon claims, runs V9 readers + synthesis, writes uploaded_analyses
 *        -> browser subscribes to the queue doc by storage_path and mirrors status
 *
 * Duplicate detection still runs client-side at queue-add time so the UI can
 * warn before uploading. TMDB enrichment used to fire post-save here; it's
 * temporarily disabled in this code path until a CF trigger on
 * uploaded_analyses takes over the job.
 */

import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isUploadJobReady, useUploadStore } from '@/stores/uploadStore';
import { useApiConfigStore } from '@/stores/apiConfigStore';
import { useScreenplays, SCREENPLAYS_QUERY_KEY } from '@/hooks/useScreenplays';
import { uploadPdfToIngestQueue } from '@/lib/firebase';
import { subscribeToIngestJob } from '@/lib/ingestQueueClient';
import useCategories from '@/hooks/useCategories';
import { useToastStore } from '@/stores/toastStore';
import { getPdfFileError } from '@/lib/pdfValidation';
import { computeContentHash } from '@/lib/analysisIdentity';
import { findAnalysisByContentHash } from '@/lib/analysisLookup';
import { toDocId } from '@/lib/analysisStore';
import { IntakeConfirmationDialog } from '@/components/intake';

import { ApiConfigToggle } from './upload/ApiConfigToggle';
import { ModelSelector } from './upload/ModelSelector';
import { CategorySelector } from './upload/CategorySelector';
import { UploadDropzone } from './upload/UploadDropzone';
import { UploadQueue } from './upload/UploadQueue';
import { UploadInstructions } from './upload/UploadInstructions';
import { MODEL_OPTIONS } from './upload/upload.constants';
import type { ModelOption } from './upload/upload.types';

interface UploadPanelProps {
  /** Keeps the established Settings presentation as the default. */
  presentation?: 'settings' | 'intake';
  initialModel?: ModelOption;
  onOpenAnalysis?: (projectId: string) => void;
}

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

export function UploadPanel({
  presentation = 'settings',
  initialModel = 'sonnet',
  onOpenAnalysis,
}: UploadPanelProps = {}) {
  const [selectedCategory, setSelectedCategory] = useState('LEMON');
  const [selectedModel, setSelectedModel] = useState<ModelOption>(initialModel);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { categoryIds, addCategory: addCategoryToStore } = useCategories();

  const {
    jobs,
    addJob,
    updateJob,
    removeJob,
    clearCompleted,
    chooseRevision,
    chooseSeparateProject,
    isProcessing,
    setProcessing,
    getFile,
  } = useUploadStore();
  const { canMakeRequest } = useApiConfigStore();
  const { data: screenplays } = useScreenplays();
  // Proxy is always available (API keys are server-side)
  const isConfigured = true;
  const queryClient = useQueryClient();

  // ─── File selection + duplicate detection ──────────────────────────────────

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;
    // Process all files in parallel — hashing is async but local-only.
    await Promise.all(
      Array.from(files).map(async (file) => {
        const fileError = getPdfFileError(file);
        if (fileError) {
          useToastStore.getState().addToast(fileError, 'warning');
          return;
        }
        const jobId = addJob(file.name, selectedCategory, file);

        // Layer 1 (fast): a title match identifies a likely revision target.
        // It is not proof of duplicate bytes and must not block the upload.
        if (screenplays && screenplays.length > 0) {
          const inferred = inferTitleFromFilename(file.name).toLowerCase();
          const match = screenplays.find(
            (s) => s.title.toLowerCase().trim() === inferred,
          );
          if (match) {
            updateJob(jobId, {
              existingTitle: match.title,
              possibleMatchProjectId: match.projectId ?? toDocId(match.sourceFile),
            });
          }
        }

        // Layer 2 (true content dedup): SHA-256 of file bytes → Firestore lookup.
        // Catches re-uploads of the same PDF under a different filename.
        try {
          const hash = await computeContentHash(file);
          const existing = await findAnalysisByContentHash(hash);
          if (existing) {
            updateJob(jobId, {
              isDuplicate: true,
              existingTitle: existing,
              matchResolution: undefined,
              targetProjectId: undefined,
              separateProject: false,
            });
          }
        } catch (err) {
          console.warn('[upload] hash compute failed (proceeding):', err);
        } finally {
          updateJob(jobId, { identityCheckComplete: true });
        }
      }),
    );
  };

  // ─── Duplicate action handlers ─────────────────────────────────────────────

  const handleSkipJob = useCallback((jobId: string) => {
    updateJob(jobId, { status: 'skipped' });
  }, [updateJob]);

  // ─── Process pending jobs via VPS daemon ──────────────────────────────────
  //
  // Browser uploads PDF to ingest-queue/{collection}/{uploadId}/{filename}.pdf in Storage.
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
    if (!isUploadJobReady(job)) return;

    try {
      updateJob(jobId, { status: 'parsing', progress: 5 });
      const { storagePath } = await uploadPdfToIngestQueue(file, job.category, {
        requestedModel,
        targetProjectId: job.targetProjectId,
        separateProject: job.separateProject,
        uploadId: job.uploadId,
      });
      updateJob(jobId, { status: 'analyzing', progress: 15, ingestQueueStoragePath: storagePath });

      await new Promise<void>((resolve) => {
        const unsub = subscribeToIngestJob(
          storagePath,
          (update) => {
            if (update.status === 'pending') {
              updateJob(jobId, { status: 'analyzing', progress: 20 });
            } else if (update.status === 'processing') {
              updateJob(jobId, { status: 'analyzing', progress: 60 });
            } else if (update.status === 'waiting_for_budget') {
              updateJob(jobId, {
                status: 'analyzing',
                progress: 20,
                error: 'Waiting for the next daily AI budget window',
              });
            } else if (update.status === 'complete') {
              updateJob(jobId, {
                status: 'complete',
                progress: 100,
                result: {
                  title: inferTitleFromFilename(file.name),
                  author: 'See analysis',
                  analysisPath: 'firestore',
                  projectId: update.screenplayDocId,
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
            } else if (update.status === 'needs_review') {
              updateJob(jobId, {
                status: 'needs_review',
                error: update.error || 'The screenplay evidence needs review',
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

    const pending = useUploadStore.getState().jobs.filter(isUploadJobReady);

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

  const pendingJobs = jobs.filter(isUploadJobReady);
  const displayJobs = useMemo(
    () => jobs.map((job) => {
      if (job.status !== 'complete' || job.result?.projectId) return job;
      const inferredTitle = inferTitleFromFilename(job.filename).toLowerCase();
      const screenplay = screenplays?.find(
        (candidate) => candidate.sourceFile === job.filename
          || candidate.title.toLowerCase().trim() === inferredTitle,
      );
      const projectId = screenplay?.projectId ?? screenplay?.id;
      if (!projectId || !job.result) return job;
      return { ...job, result: { ...job.result, projectId } };
    }),
    [jobs, screenplays],
  );

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
    if (presentation === 'intake') {
      setShowConfirmation(true);
      return;
    }
    processJobs();
  };

  const confirmStartProcessing = () => {
    setShowConfirmation(false);
    processJobs();
  };

  if (presentation === 'intake') {
    return (
      <div className="space-y-6" data-testid="intake-workbench">
        <section className="dsc-card overflow-hidden" aria-labelledby="intake-routing-heading">
          <div className="border-b border-[var(--dsc-line)] px-5 py-4 sm:px-7">
            <p className="dsc-kicker">Reading route</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="intake-routing-heading" className="dsc-display text-3xl">Choose the level of review</h2>
                <p className="mt-1 text-sm text-[var(--dsc-ink-2)]">
                  Hybrid is the studio default: complete coverage first, deeper review for the strongest material.
                </p>
              </div>
              {pendingJobs.length > 0 && batchCostEstimate && (
                <div className="rounded-full border border-[var(--dsc-line)] bg-[var(--dsc-surface-2)] px-4 py-2 text-sm text-[var(--dsc-ink-2)]">
                  {pendingJobs.length} ready · estimated {batchCostEstimate}
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-7 px-5 py-6 sm:px-7 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <ModelSelector
              selectedModel={selectedModel}
              onSelectModel={setSelectedModel}
              pendingCount={pendingJobs.length}
              batchCostEstimate={batchCostEstimate}
              presentation="intake"
            />
            <CategorySelector
              categoryIds={categoryIds}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              onAddCategory={addCategoryToStore}
              presentation="intake"
            />
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
          <div className="dsc-card p-5 sm:p-7">
            <div className="mb-5">
              <p className="dsc-kicker">New screenplay</p>
              <h2 className="dsc-display mt-2 text-3xl">Place material on the desk</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--dsc-ink-2)]">
                PDF screenplays only. Identity and exact-byte checks happen before anything can enter paid analysis.
              </p>
            </div>
            <UploadDropzone onFilesSelected={handleFileSelect} presentation="intake" />
          </div>

          <aside className="dsc-card flex flex-col justify-between p-5 sm:p-7" aria-label="Intake safeguards">
            <div>
              <p className="dsc-kicker">Before the readers begin</p>
              <h2 className="dsc-display mt-2 text-3xl">Nothing enters silently</h2>
              <ul className="mt-6 space-y-5">
                {[
                  ['Identity', 'Exact duplicates stop before any AI spend.'],
                  ['Revisions', 'Same-title drafts wait for your project decision.'],
                  ['Authority', 'The five-reader engine runs only after final confirmation.'],
                ].map(([label, copy]) => (
                  <li key={label} className="grid grid-cols-[0.75rem_1fr] gap-3">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-[var(--dsc-accent)]" aria-hidden="true" />
                    <span>
                      <strong className="block text-sm text-[var(--dsc-ink)]">{label}</strong>
                      <span className="mt-1 block text-sm leading-5 text-[var(--dsc-ink-2)]">{copy}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-8 border-t border-[var(--dsc-line)] pt-4 text-xs leading-5 text-[var(--dsc-ink-3)]">
              Adding files is free. Analysis begins only from the confirmation screen.
            </p>
          </aside>
        </section>

        <section className="dsc-card p-5 sm:p-7" aria-labelledby="intake-queue-heading">
          <UploadQueue
            jobs={displayJobs}
            isProcessing={isProcessing}
            isConfigured={isConfigured}
            selectedModel={selectedModel}
            batchCostEstimate={batchCostEstimate}
            onRemoveJob={removeJob}
            onRetryJob={retryJob}
            onClearCompleted={clearCompleted}
            onStartProcessing={handleStartProcessing}
            onSkipJob={handleSkipJob}
            onChooseRevision={chooseRevision}
            onChooseSeparate={chooseSeparateProject}
            onOpenAnalysis={onOpenAnalysis}
            presentation="intake"
            headingId="intake-queue-heading"
          />
        </section>

        <IntakeConfirmationDialog
          isOpen={showConfirmation}
          projectCount={pendingJobs.length}
          modelName={MODEL_OPTIONS.find((model) => model.id === selectedModel)?.name ?? selectedModel}
          costEstimate={batchCostEstimate}
          onCancel={() => setShowConfirmation(false)}
          onConfirm={confirmStartProcessing}
        />
      </div>
    );
  }

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
        onSkipJob={handleSkipJob}
        onChooseRevision={chooseRevision}
        onChooseSeparate={chooseSeparateProject}
      />

      <UploadInstructions />
    </div>
  );
}

export default UploadPanel;
