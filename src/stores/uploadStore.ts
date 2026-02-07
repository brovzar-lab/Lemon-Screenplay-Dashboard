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
  | 'complete'
  | 'error';

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

  // Processing control
  setProcessing: (isProcessing: boolean) => void;

  // Getters
  getPendingCount: () => number;
  getActiveJob: () => UploadJob | undefined;
  getFile: (jobId: string) => File | undefined;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

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

      setProcessing: (isProcessing) => set({ isProcessing }),

      getPendingCount: () => {
        return get().jobs.filter((j) => j.status === 'pending').length;
      },

      getActiveJob: () => {
        return get().jobs.find((j) => j.status === 'parsing' || j.status === 'analyzing');
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
