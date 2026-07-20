import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FilterState, SortState } from '@/types';

export interface LensSnapshot {
  filters: FilterState;
  sort: SortState;
}

export interface SavedLens {
  id: string;
  name: string;
  snapshot: LensSnapshot;
  createdAt: string;
}

interface LensState {
  lenses: SavedLens[];
  activeLensId: string | null;
  saveLens: (name: string, snapshot: LensSnapshot) => string;
  deleteLens: (id: string) => void;
  setActiveLens: (id: string) => void;
}

export const useLensStore = create<LensState>()(
  persist(
    (set) => ({
      lenses: [],
      activeLensId: null,
      saveLens: (name, snapshot) => {
        const id = crypto.randomUUID();
        set((state) => ({
          lenses: [
            ...state.lenses,
            { id, name: name.trim(), snapshot, createdAt: new Date().toISOString() },
          ],
          activeLensId: id,
        }));
        return id;
      },
      deleteLens: (id) =>
        set((state) => ({
          lenses: state.lenses.filter((lens) => lens.id !== id),
          activeLensId: state.activeLensId === id ? null : state.activeLensId,
        })),
      setActiveLens: (id) => set({ activeLensId: id }),
    }),
    { name: 'lemon-lenses' },
  ),
);
