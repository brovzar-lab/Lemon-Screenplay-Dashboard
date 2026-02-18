import { create } from 'zustand';

interface PosterData {
    url: string;
    status: 'generating' | 'ready' | 'error';
}

interface PosterState {
    posters: Record<string, PosterData>;
    setPosterStatus: (id: string, status: 'generating' | 'ready' | 'error', url?: string) => void;
    getPoster: (id: string) => PosterData | undefined;
}

export const usePosterStore = create<PosterState>((set, get) => ({
    posters: {},

    setPosterStatus: (id, status, url) => set((state) => ({
        posters: {
            ...state.posters,
            [id]: {
                status,
                url: url || state.posters[id]?.url || ''
            }
        }
    })),

    getPoster: (id) => get().posters[id]
}));
