/**
 * API Configuration Store
 * Manages API settings and budget controls for screenplay analysis.
 *
 * DESIGN: `isConfigured` and `isGoogleConfigured` are NOT stored in
 * localStorage — they are always derived from `apiKey.length > 0` so a
 * stale persisted `false` can never block a user who already has a key.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ApiConfig {
  // API Connection (Anthropic)
  apiKey: string;
  apiEndpoint: string;

  // Derived (never persisted) — always computed from key length
  isConfigured: boolean;

  // Google AI (Gemini / Imagen)
  googleApiKey: string;
  isGoogleConfigured: boolean;

  // Budget Controls
  monthlyBudgetLimit: number; // in USD
  dailyRequestLimit: number;
  currentMonthSpend: number;
  currentDayRequests: number;

  // Usage Tracking
  lastResetDate: string;
  monthResetDate: string;

  // Actions
  setApiKey: (key: string) => void;
  setApiEndpoint: (endpoint: string) => void;
  setGoogleApiKey: (key: string) => void;
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

// Read from .env at build time — safe for an internal tool.
// localStorage (via persist) will override these if the user has
// manually entered a different key via Settings.
const ENV_ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined ?? '';

export const useApiConfigStore = create<ApiConfig>()(
  persist(
    (set, get) => ({
      apiKey: ENV_ANTHROPIC_KEY,
      apiEndpoint: 'https://api.anthropic.com/v1/messages',
      isConfigured: ENV_ANTHROPIC_KEY.length > 0,

      googleApiKey: '',
      isGoogleConfigured: false,

      monthlyBudgetLimit: 50,
      dailyRequestLimit: 100,
      currentMonthSpend: 0,
      currentDayRequests: 0,
      lastResetDate: getToday(),
      monthResetDate: getThisMonth(),

      // Actions
      setApiKey: (key) =>
        set({ apiKey: key, isConfigured: key.length > 0 }),

      setApiEndpoint: (endpoint) =>
        set({ apiEndpoint: endpoint }),

      setGoogleApiKey: (key) =>
        set({ googleApiKey: key, isGoogleConfigured: key.length > 0 }),

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
        // Derive from the actual key — never trust a cached boolean flag
        if (!state.apiKey || state.apiKey.length === 0) return false;
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
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 2) {
          const LEAKED_KEY = 'AIzaSyACzpPPOfpQHA7BmnlWtjzZ_SijTH3p-oY';
          if (state.googleApiKey === LEAKED_KEY) {
            state.googleApiKey = '';
          }
        }
        return state as Record<string, unknown> & { googleApiKey: string };
      },
      // onRehydrateStorage: recompute derived flags from the restored keys.
      // This is THE only reliable way to fix stale `isConfigured: false` in storage.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // If localStorage had an empty key (e.g. previously cleared), fall back
        // to the env-var key so the app stays configured after a store reset.
        let key = (state.apiKey as string) || '';
        if (!key) key = ENV_ANTHROPIC_KEY;
        (state as ApiConfig).apiKey = key;
        const gKey = (state.googleApiKey as string) || '';
        (state as ApiConfig).isConfigured = key.length > 0;
        (state as ApiConfig).isGoogleConfigured = gKey.length > 0;
      },
      // Persist keys but NOT the derived flags — they are recomputed above.
      partialize: (state) => ({
        apiKey: state.apiKey,
        apiEndpoint: state.apiEndpoint,
        googleApiKey: state.googleApiKey,
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
