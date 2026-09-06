/**
 * Upload Store
 * Manages screenplay upload queue and processing state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IngestQueueJob } from '@/lib/ingestQueueClient';

export type UploadStatus =
  | 'pending'
  | 'uploading'
  | 'uploaded'
  | 'queued'
  | 'parsing'
  | 'analyzing'
  | 'promoting'
  | 'waiting_for_budget'
  | 'complete'
  | 'error'
  | 'skipped'
  | 'needs_review';

export type UploadMatchResolution = 'revision' | 'separate';

export interface UploadJob {
  id: string;
  filename: string;
  category: string;
  status: UploadStatus;
  progress: number; // 0-100
  error?: string;
  result?: {
    title: string;
    author: string;
    analysisPath: string;
    /** Stable project route returned by the authoritative ingest queue. */
    projectId?: string;
    versionId?: string;
  };
  createdAt: string;
  completedAt?: string;
  /** Stable identity for this queued upload across browser retries. */
  uploadId?: string;
  /** False while title and SHA-256 archive checks are still running. */
  identityCheckComplete?: boolean;
  /** True only when SHA-256 proves these exact PDF bytes were already analyzed. */
  isDuplicate?: boolean;
  /** Local SHA-256 used to block duplicates selected in the same intake batch. */
  contentHash?: string;
  existingTitle?: string;
  /** Suggested parent from a title match. The user must confirm it. */
  possibleMatchProjectId?: string;
  /** Same-batch upload that will establish the suggested revision parent. */
  possibleMatchUploadId?: string;
  matchResolution?: UploadMatchResolution;
  /** Stable uploaded_analyses parent for an explicitly identified revision. */
  targetProjectId?: string;
  /** Same-batch parent that must become Ready before this revision runs. */
  dependsOnUploadId?: string;
  /** Explicitly create a distinct parent even when title/filename collides. */
  separateProject?: boolean;
  /** TMDB production status — populated after save, non-blocking */
  tmdbStatus?: {
    isProduced: boolean;
    tmdbTitle?: string;
    releaseDate?: string;
    confidence: 'high' | 'medium' | 'low';
  } | null;
  /** Whether TMDB check is currently running */
  tmdbChecking?: boolean;
  /** Storage path (gs://...) for daemon-path uploads — used to find the queue doc */
  ingestQueueStoragePath?: string;
  storageGeneration?: string;
  queueJobId?: string;
  replacesQueueJobId?: string;
  engine?: 'coverage_v1' | 'v9';
  connectionError?: string;
}

/**
 * In-memory map of job ID → File object.
 * Files can't be serialized to localStorage, so we keep them separately.
 */
const fileMap = new Map<string, File>();

interface UploadState {
  jobs: UploadJob[];
  dismissedQueueJobs: Record<string, UploadStatus>;
  isProcessing: boolean;

  // Queue management
  addJob: (filename: string, category: string, file: File) => string;
  updateJob: (jobId: string, update: Partial<UploadJob>) => void;
  reconcileQueue: (queue: IngestQueueJob[]) => void;
  removeJob: (jobId: string) => void;
  clearCompleted: () => void;
  chooseRevision: (jobId: string) => void;
  chooseSeparateProject: (jobId: string) => void;

  // Processing control
  setProcessing: (isProcessing: boolean) => void;

  // Getters
  getPendingCount: () => number;
  getActiveJob: () => UploadJob | undefined;
  getFile: (jobId: string) => File | undefined;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

/** Only resolved, non-duplicate jobs may enter the paid analysis queue. */
export function isUploadJobReady(job: UploadJob): boolean {
  if (job.status !== 'pending' || job.isDuplicate || job.identityCheckComplete === false)
    return false;
  if (!job.possibleMatchProjectId) return true;
  if (job.matchResolution === 'revision') {
    return job.targetProjectId === job.possibleMatchProjectId && !job.separateProject;
  }
  return job.matchResolution === 'separate' && job.separateProject === true && !job.targetProjectId;
}

export function isUploadTerminalStatus(status: UploadStatus): boolean {
  return status === 'complete'
    || status === 'error'
    || status === 'skipped'
    || status === 'needs_review';
}

export const useUploadStore = create<UploadState>()(
  persist(
    (set, get) => ({
      jobs: [],
      dismissedQueueJobs: {},
      isProcessing: false,

      addJob: (filename, category, file) => {
        const id = generateId();
        fileMap.set(id, file);
        set((state) => ({
          jobs: [
            ...state.jobs,
            {
              id,
              filename,
              category,
              status: 'pending' as const,
              progress: 0,
              createdAt: new Date().toISOString(),
              uploadId: crypto.randomUUID(),
              identityCheckComplete: false,
            },
          ],
        }));
        return id;
      },

      updateJob: (jobId, update) => {
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === jobId ? { ...j, ...update } : j
          ),
        }));
      },

      reconcileQueue: (queue) => {
        set((state) => {
          const jobs = [...state.jobs];
          const dismissedQueueJobs = { ...state.dismissedQueueJobs };
          for (const remote of queue) {
            const status: UploadStatus = remote.status === 'pending' || remote.status === 'waiting_for_engine'
              ? 'queued' : remote.status === 'processing' ? 'analyzing'
                : remote.status === 'failed' ? 'error' : remote.status;
            if (dismissedQueueJobs[remote.jobId] === status) continue;
            delete dismissedQueueJobs[remote.jobId];
            const index = jobs.findIndex((local) => local.queueJobId === remote.jobId
              || (!local.queueJobId && local.ingestQueueStoragePath === remote.storagePath
                && (local.storageGeneration ? local.storageGeneration === remote.storageGeneration
                  : queue.filter((item) => item.storagePath === remote.storagePath).length === 1)));
            const local = index >= 0 ? jobs[index] : undefined;
            const next: UploadJob = {
              ...local,
              id: local?.id ?? `queue-${remote.jobId}`,
              filename: local?.filename ?? remote.filename,
              category: remote.category,
              createdAt: local?.createdAt ?? remote.queuedAt,
              status,
              progress: status === 'complete' ? 100 : status === 'analyzing' ? 60 : 20,
              queueJobId: remote.jobId,
              engine: remote.engine,
              uploadId: remote.uploadId ?? local?.uploadId,
              storageGeneration: remote.storageGeneration,
              ingestQueueStoragePath: remote.storagePath,
              connectionError: undefined,
              error: remote.status === 'waiting_for_engine' ? 'Waiting for the Coverage worker'
                : remote.status === 'waiting_for_budget' ? 'Waiting for the next daily AI budget window'
                  : remote.error,
              result: remote.screenplayDocId ? {
                title: remote.filename.replace(/\.pdf$/i, ''),
                author: 'See analysis',
                analysisPath: remote.reportId ?? 'firestore',
                projectId: remote.screenplayDocId,
                versionId: remote.versionId,
              } : undefined,
            };
            if (index >= 0) jobs[index] = next;
            else jobs.push(next);
          }
          return { jobs, dismissedQueueJobs };
        });
      },

      removeJob: (jobId) => {
        fileMap.delete(jobId);
        set((state) => ({
          dismissedQueueJobs: { ...state.dismissedQueueJobs, ...Object.fromEntries(state.jobs
            .filter((job) => job.id === jobId && job.queueJobId && isUploadTerminalStatus(job.status))
            .map((job) => [job.queueJobId!, job.status])) },
          jobs: state.jobs.filter((j) => j.id !== jobId),
        }));
      },

      clearCompleted: () => {
        const completed = get().jobs.filter((job) => isUploadTerminalStatus(job.status));
        completed.forEach((j) => fileMap.delete(j.id));
        set((state) => ({
          dismissedQueueJobs: { ...state.dismissedQueueJobs, ...Object.fromEntries(completed
            .filter((job) => job.queueJobId).map((job) => [job.queueJobId!, job.status])) },
          jobs: state.jobs.filter((job) => !isUploadTerminalStatus(job.status)),
        }));
      },

      chooseRevision: (jobId) => {
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === jobId && job.possibleMatchProjectId
              ? {
                  ...job,
                  matchResolution: 'revision' as const,
                  targetProjectId: job.possibleMatchProjectId,
                  dependsOnUploadId: job.possibleMatchUploadId,
                  separateProject: false,
                }
              : job,
          ),
        }));
      },

      chooseSeparateProject: (jobId) => {
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === jobId && job.possibleMatchProjectId
              ? {
                  ...job,
                  matchResolution: 'separate' as const,
                  targetProjectId: undefined,
                  dependsOnUploadId: undefined,
                  separateProject: true,
                }
              : job,
          ),
        }));
      },

      setProcessing: (isProcessing) => set({ isProcessing }),

      getPendingCount: () => {
        return get().jobs.filter((j) => j.status === 'pending').length;
      },

      getActiveJob: () => {
        return get().jobs.find((j) =>
          j.status === 'uploading'
          || j.status === 'uploaded'
          || j.status === 'queued'
          || j.status === 'parsing'
          || j.status === 'analyzing'
          || j.status === 'promoting'
          || j.status === 'waiting_for_budget'
        );
      },

      getFile: (jobId) => {
        return fileMap.get(jobId);
      },
    }),
    {
      name: 'lemon-uploads',
      partialize: (state) => ({
        dismissedQueueJobs: state.dismissedQueueJobs,
        // Keep accepted queue jobs so Intake can reconnect after navigation/reload.
        // Pending files remain memory-only because File objects cannot be serialized.
        jobs: state.jobs.filter((job) =>
          isUploadTerminalStatus(job.status)
          || (job.status !== 'pending' && job.ingestQueueStoragePath),
        ),
      }),
    }
  )
);
