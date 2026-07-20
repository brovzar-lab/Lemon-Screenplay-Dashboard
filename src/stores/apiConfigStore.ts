/**
 * API Configuration Store
 * Manages API settings and budget controls for screenplay analysis.
 *
 * Anthropic and Google API keys are server-side behind authenticated proxies.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ApiConfig {
  // TMDB (The Movie Database) — production status checks
  tmdbApiKey: string;
  isTmdbConfigured: boolean;

  // Budget Controls
  monthlyBudgetLimit: number; // in USD
  dailyRequestLimit: number;
  currentMonthSpend: number;
  currentDayRequests: number;

  // Usage Tracking
  lastResetDate: string;
  monthResetDate: string;

  // Actions
  setTmdbApiKey: (key: string) => void;
  setMonthlyBudgetLimit: (limit: number) => void;
  setDailyRequestLimit: (limit: number) => void;
  incrementUsage: (cost: number) => void;
  resetDailyCount: () => void;
  resetMonthlySpend: () => void;
  canMakeRequest: () => boolean;
  getBudgetRemaining: () => number;
  getDailyRequestsRemaining: () => number;
  checkAndResetIfNeeded: () => void;
}

const getToday = () => new Date().toISOString().split('T')[0];
const getThisMonth = () => new Date().toISOString().slice(0, 7);

// TMDB key from .env — hard-codes production-status checks without manual entry
const ENV_TMDB_KEY = import.meta.env.VITE_TMDB_API_KEY as string | undefined ?? '';


export const useApiConfigStore = create<ApiConfig>()(
  persist(
    (set, get) => ({
      tmdbApiKey: ENV_TMDB_KEY,
      isTmdbConfigured: ENV_TMDB_KEY.length > 0,

      monthlyBudgetLimit: 50,
      dailyRequestLimit: 100,
      currentMonthSpend: 0,
      currentDayRequests: 0,
      lastResetDate: getToday(),
      monthResetDate: getThisMonth(),

      // Actions
      setTmdbApiKey: (key) =>
        set({ tmdbApiKey: key, isTmdbConfigured: key.length > 0 }),

      setMonthlyBudgetLimit: (limit) =>
        set({ monthlyBudgetLimit: Math.max(0, limit) }),

      setDailyRequestLimit: (limit) =>
        set({ dailyRequestLimit: Math.max(0, limit) }),

      incrementUsage: (cost) =>
        set((state) => ({
          currentMonthSpend: state.currentMonthSpend + cost,
          currentDayRequests: state.currentDayRequests + 1,
        })),

      resetDailyCount: () =>
        set({ currentDayRequests: 0, lastResetDate: getToday() }),

      resetMonthlySpend: () =>
        set({ currentMonthSpend: 0, monthResetDate: getThisMonth() }),

      canMakeRequest: () => {
        const state = get();
        if (state.currentDayRequests >= state.dailyRequestLimit) return false;
        if (state.currentMonthSpend >= state.monthlyBudgetLimit) return false;
        return true;
      },

      getBudgetRemaining: () => {
        const state = get();
        return Math.max(0, state.monthlyBudgetLimit - state.currentMonthSpend);
      },

      getDailyRequestsRemaining: () => {
        const state = get();
        return Math.max(0, state.dailyRequestLimit - state.currentDayRequests);
      },

      checkAndResetIfNeeded: () => {
        const state = get();
        const today = getToday();
        const thisMonth = getThisMonth();
        if (state.lastResetDate !== today) {
          set({ currentDayRequests: 0, lastResetDate: today });
        }
        if (state.monthResetDate !== thisMonth) {
          set({ currentMonthSpend: 0, monthResetDate: thisMonth });
        }
      },
    }),
    {
      name: 'lemon-api-config',
      version: 5,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 3) {
          // Remove Anthropic key from localStorage — now server-side
          delete state.apiKey;
          delete state.apiEndpoint;
          delete state.isConfigured;
        }
        if (version < 4) {
          // Add TMDB key fields
          state.tmdbApiKey = state.tmdbApiKey ?? '';
          state.isTmdbConfigured = false;
        }
        if (version < 5) {
          delete state.googleApiKey;
          delete state.isGoogleConfigured;
        }
        return state;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // Fallback to env var for TMDB key
        let tKey = (state.tmdbApiKey as string) || '';
        if (!tKey) tKey = ENV_TMDB_KEY;
        (state as ApiConfig).tmdbApiKey = tKey;
        (state as ApiConfig).isTmdbConfigured = tKey.length > 0;
      },
      partialize: (state) => ({
        tmdbApiKey: state.tmdbApiKey,
        monthlyBudgetLimit: state.monthlyBudgetLimit,
        dailyRequestLimit: state.dailyRequestLimit,
        currentMonthSpend: state.currentMonthSpend,
        currentDayRequests: state.currentDayRequests,
        lastResetDate: state.lastResetDate,
        monthResetDate: state.monthResetDate,
      }),
    }
  )
);
