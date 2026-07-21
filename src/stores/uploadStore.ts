/**
 * Upload Store
 * Manages screenplay upload queue and processing state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UploadStatus =
  | 'pending'
  | 'parsing'
  | 'analyzing'
  | 'promoting'
  | 'complete'
  | 'error'
  | 'skipped';

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
  };
  createdAt: string;
  completedAt?: string;
  /** Stable identity for this queued upload across browser retries. */
  uploadId?: string;
  /** False while title and SHA-256 archive checks are still running. */
  identityCheckComplete?: boolean;
  /** True only when SHA-256 proves these exact PDF bytes were already analyzed. */
  isDuplicate?: boolean;
  existingTitle?: string;
  /** Suggested parent from a title match. The user must confirm it. */
  possibleMatchProjectId?: string;
  matchResolution?: UploadMatchResolution;
  /** Stable uploaded_analyses parent for an explicitly identified revision. */
  targetProjectId?: string;
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
}

/**
 * In-memory map of job ID → File object.
 * Files can't be serialized to localStorage, so we keep them separately.
 */
const fileMap = new Map<string, File>();

interface UploadState {
  jobs: UploadJob[];
  isProcessing: boolean;

  // Queue management
  addJob: (filename: string, category: string, file: File) => string;
  updateJob: (jobId: string, update: Partial<UploadJob>) => void;
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

export const useUploadStore = create<UploadState>()(
  persist(
    (set, get) => ({
      jobs: [],
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

      removeJob: (jobId) => {
        fileMap.delete(jobId);
        set((state) => ({
          jobs: state.jobs.filter((j) => j.id !== jobId),
        }));
      },

      clearCompleted: () => {
        const completed = get().jobs.filter((j) => j.status === 'complete' || j.status === 'error');
        completed.forEach((j) => fileMap.delete(j.id));
        set((state) => ({
          jobs: state.jobs.filter((j) => j.status !== 'complete' && j.status !== 'error'),
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
        return get().jobs.find((j) => j.status === 'parsing' || j.status === 'analyzing' || j.status === 'promoting');
      },

      getFile: (jobId) => {
        return fileMap.get(jobId);
      },
    }),
    {
      name: 'lemon-uploads',
      partialize: (state) => ({
        // Only persist completed jobs for reference
        jobs: state.jobs.filter((j) => j.status === 'complete'),
      }),
    }
  )
);
