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

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import type { ModelOption, UploadPresentation } from './upload/upload.types';

interface UploadPanelProps {
  /** Keeps the established Settings presentation as the default. */
  presentation?: UploadPresentation;
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

function estimateBatchCost(model: ModelOption, projectCount: number): string | null {
  if (projectCount === 0) return null;
  const option = MODEL_OPTIONS.find((candidate) => candidate.id === model);
  const perScriptCosts = option?.costPerScript.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (perScriptCosts.length === 0) return null;
  const totals = perScriptCosts.map((cost) => (cost * projectCount).toFixed(2));
  return totals.length === 1 ? `~$${totals[0]}` : `~$${totals[0]}–$${totals[totals.length - 1]}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UploadPanel({
  presentation = 'settings',
  initialModel = 'sonnet',
  onOpenAnalysis,
}: UploadPanelProps = {}) {
  const { t } = useTranslation();
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
    const validFiles = Array.from(files).filter((file) => {
      const fileError = getPdfFileError(file);
      if (fileError) useToastStore.getState().addToast(fileError, 'warning');
      return !fileError;
    });
    const identityResults = await Promise.all(
      validFiles.map(async (file) => {
        try {
          const hash = await computeContentHash(file);
          const existing = await findAnalysisByContentHash(hash);
          return { file, hash, existing };
        } catch (err) {
          console.warn('[upload] hash compute failed (proceeding):', err);
          return { file, hash: undefined, existing: null };
        }
      }),
    );
    const batchHashes = new Map<string, string>();
    const batchTitles = new Map<string, { filename: string; title: string }>();
    jobs.forEach((job) => {
      if (job.status !== 'pending' || job.isDuplicate) return;
      if (job.contentHash) batchHashes.set(job.contentHash, job.filename);
      const title = inferTitleFromFilename(job.filename);
      batchTitles.set(title.toLowerCase(), { filename: job.filename, title });
    });

    identityResults.forEach(({ file, hash, existing }) => {
      const jobId = addJob(file.name, selectedCategory, file);
      const inferredTitle = inferTitleFromFilename(file.name);
      const normalizedTitle = inferredTitle.toLowerCase();
      const batchTitleMatch = batchTitles.get(normalizedTitle);
      const batchHashMatch = hash ? batchHashes.get(hash) : undefined;
      const archiveTitleMatch = screenplays?.find(
        (screenplay) => screenplay.title.toLowerCase().trim() === normalizedTitle,
      );
      const possibleMatchProjectId = archiveTitleMatch
        ? archiveTitleMatch.projectId ?? toDocId(archiveTitleMatch.sourceFile)
        : batchTitleMatch
          ? toDocId(batchTitleMatch.filename)
          : undefined;

      // Content hashes are compared against both Firestore and this selection.
      // Exact duplicates never become actionable, even when selected together.
      const isDuplicate = Boolean(existing || batchHashMatch);
      updateJob(jobId, {
        identityCheckComplete: true,
        isDuplicate,
        contentHash: hash,
        existingTitle: existing
          ?? (batchHashMatch
            ? inferTitleFromFilename(batchHashMatch)
            : archiveTitleMatch?.title ?? batchTitleMatch?.title),
        possibleMatchProjectId: isDuplicate ? undefined : possibleMatchProjectId,
        matchResolution: undefined,
        targetProjectId: undefined,
        separateProject: false,
      });

      if (hash && !batchHashes.has(hash)) batchHashes.set(hash, file.name);
      if (!batchTitles.has(normalizedTitle)) {
        batchTitles.set(normalizedTitle, { filename: file.name, title: inferredTitle });
      }
    });
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

    if (presentation === 'intake') {
      // A same-batch revision may target the project immediately before it.
      // Preserve selection order so that parent exists before the revision runs.
      for (const job of pending) await processOne(job.id, requestedModel);
    } else {
      // Preserve the established Settings upload behavior.
      await Promise.all(pending.map((job) => processOne(job.id, requestedModel)));
    }

    setProcessing(false);
  }, [isProcessing, setProcessing, selectedModel, processOne, presentation]);

  // Reconnect to accepted queue jobs after navigation or a browser reload.
  useEffect(() => {
    if (isProcessing) return;
    const resumableJobs = useUploadStore.getState().jobs.filter(
      (job) => (
        job.status === 'analyzing'
        || job.status === 'promoting'
        || job.status === 'needs_review'
      ) && job.ingestQueueStoragePath,
    );
    const subscriptions = resumableJobs.map((job) => subscribeToIngestJob(
      job.ingestQueueStoragePath!,
      (update) => {
        if (update.status === 'pending' || update.status === 'waiting_for_budget') {
          updateJob(job.id, { status: 'analyzing', progress: 20, error: update.error });
        } else if (update.status === 'processing') {
          updateJob(job.id, { status: 'analyzing', progress: 60, error: undefined });
        } else if (update.status === 'complete') {
          updateJob(job.id, {
            status: 'complete',
            progress: 100,
            error: undefined,
            result: {
              title: inferTitleFromFilename(job.filename),
              author: 'See analysis',
              analysisPath: 'firestore',
              projectId: update.screenplayDocId,
            },
            completedAt: new Date().toISOString(),
          });
          queryClient.invalidateQueries({ queryKey: SCREENPLAYS_QUERY_KEY });
        } else if (update.status === 'failed') {
          updateJob(job.id, { status: 'error', error: update.error || 'Daemon analysis failed' });
        } else if (update.status === 'skipped') {
          updateJob(job.id, { status: 'skipped', error: update.error || 'Job skipped' });
        } else if (update.status === 'needs_review') {
          updateJob(job.id, { status: 'needs_review', error: update.error || 'The screenplay evidence needs review' });
        }
      },
      (err) => updateJob(job.id, { status: 'error', error: `Subscription error: ${err.message}` }),
    ));
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [isProcessing, queryClient, updateJob]);

  // Retry a failed job: reset to pending and re-trigger processing
  const retryJob = useCallback((jobId: string) => {
    updateJob(jobId, { status: 'pending', error: undefined, progress: 0, isDuplicate: false });
    setTimeout(() => { processJobs(); }, 100);
  }, [updateJob, processJobs]);

  const pendingJobs = jobs.filter(isUploadJobReady);

  // Calculate batch cost estimate (only actionable pending jobs)
  const batchCostEstimate = estimateBatchCost(selectedModel, pendingJobs.length);

  const handleStartProcessing = () => {
    if (!isConfigured) {
      setShowApiConfig(true);
      return;
    }
    if (!canMakeRequest()) {
      alert(t('Cannot process: Budget limit reached or daily request limit exceeded. Check API Configuration.'));
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
  const cancelConfirmation = useCallback(() => setShowConfirmation(false), []);

  if (presentation === 'intake') {
    return (
      <div className="space-y-6" data-testid="intake-workbench">
        <section className="dsc-card overflow-hidden" aria-labelledby="intake-routing-heading">
          <div className="border-b border-[var(--dsc-line)] px-5 py-4 sm:px-7">
            <p className="dsc-kicker">{t('Reading route')}</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="intake-routing-heading" className="dsc-display text-3xl">{t('Choose the level of review')}</h2>
                <p className="mt-1 text-sm text-[var(--dsc-ink-2)]">
                  {t('Hybrid is the studio default: complete coverage first, deeper review for the strongest material.')}
                </p>
              </div>
              {pendingJobs.length > 0 && batchCostEstimate && (
                <div className="rounded-full border border-[var(--dsc-line)] bg-[var(--dsc-surface-2)] px-4 py-2 text-sm text-[var(--dsc-ink-2)]">
                  {t('{{count}} ready · estimated {{cost}}', { count: pendingJobs.length, cost: batchCostEstimate })}
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
              <p className="dsc-kicker">{t('New screenplay')}</p>
              <h2 className="dsc-display mt-2 text-3xl">{t('Place material on the desk')}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--dsc-ink-2)]">
                {t('PDF screenplays only. Identity and exact-byte checks happen before anything can enter paid analysis.')}
              </p>
            </div>
            <UploadDropzone onFilesSelected={handleFileSelect} presentation="intake" />
          </div>

          <aside className="dsc-card flex flex-col justify-between p-5 sm:p-7" aria-label={t('Intake safeguards')}>
            <div>
              <p className="dsc-kicker">{t('Before the readers begin')}</p>
              <h2 className="dsc-display mt-2 text-3xl">{t('Nothing enters silently')}</h2>
              <ul className="mt-6 space-y-5">
                {[
                  [t('Identity'), t('Exact duplicates stop before any AI spend.')],
                  [t('Revisions'), t('Same-title drafts wait for your project decision.')],
                  [t('Authority'), t('The five-reader engine runs only after final confirmation.')],
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
              {t('Adding files is free. Analysis begins only from the confirmation screen.')}
            </p>
          </aside>
        </section>

        <section className="dsc-card p-5 sm:p-7" aria-labelledby="intake-queue-heading">
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
            onOpenAnalysis={onOpenAnalysis}
            presentation="intake"
            headingId="intake-queue-heading"
          />
        </section>

        {showConfirmation && (
          <IntakeConfirmationDialog
            filenames={pendingJobs.map((job) => job.filename)}
            modelName={MODEL_OPTIONS.find((model) => model.id === selectedModel)?.name ?? selectedModel}
            costEstimate={batchCostEstimate}
            onCancel={cancelConfirmation}
            onConfirm={confirmStartProcessing}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-display text-gold-200 mb-2">{t('Upload Screenplays')}</h2>
        <p className="text-sm text-black-400">
          {t('Upload PDF screenplays for AI analysis using the V9 Archaeology Engine (5-reader deep analysis).')}
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
