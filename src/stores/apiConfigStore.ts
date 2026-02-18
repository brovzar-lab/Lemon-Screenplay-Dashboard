/**
 * API Configuration Store
 * Manages API settings and budget controls for screenplay analysis
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ApiConfig {
  // API Connection (Anthropic)
  apiKey: string;
  apiEndpoint: string;
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
  lastResetDate: string; // ISO date string for daily reset
  monthResetDate: string; // ISO date string for monthly reset

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

export const useApiConfigStore = create<ApiConfig>()(
  persist(
    (set, get) => ({
      // Initial state - API key loaded from environment variable
      apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
      apiEndpoint: 'https://api.anthropic.com/v1/messages',
      isConfigured: Boolean(import.meta.env.VITE_ANTHROPIC_API_KEY),
      googleApiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
      isGoogleConfigured: Boolean(import.meta.env.VITE_GOOGLE_API_KEY),
      monthlyBudgetLimit: 50, // $50 default
      dailyRequestLimit: 100,
      currentMonthSpend: 0,
      currentDayRequests: 0,
      lastResetDate: getToday(),
      monthResetDate: getThisMonth(),

      // Actions
      setApiKey: (key) =>
        set({
          apiKey: key,
          isConfigured: key.length > 0,
        }),

      setApiEndpoint: (endpoint) =>
        set({ apiEndpoint: endpoint }),

      setGoogleApiKey: (key) =>
        set({
          googleApiKey: key,
          isGoogleConfigured: key.length > 0,
        }),

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
        set({
          currentDayRequests: 0,
          lastResetDate: getToday(),
        }),

      resetMonthlySpend: () =>
        set({
          currentMonthSpend: 0,
          monthResetDate: getThisMonth(),
        }),

      canMakeRequest: () => {
        const state = get();
        // Check daily limit
        if (state.currentDayRequests >= state.dailyRequestLimit) {
          return false;
        }
        // Check monthly budget
        if (state.currentMonthSpend >= state.monthlyBudgetLimit) {
          return false;
        }
        // Check if API is configured
        if (!state.isConfigured) {
          return false;
        }
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

        // Reset daily count if day changed
        if (state.lastResetDate !== today) {
          set({
            currentDayRequests: 0,
            lastResetDate: today,
          });
        }

        // Reset monthly spend if month changed
        if (state.monthResetDate !== thisMonth) {
          set({
            currentMonthSpend: 0,
            monthResetDate: thisMonth,
          });
        }
      },
    }),
    {
      name: 'lemon-api-config',
      partialize: (state) => ({
        apiKey: state.apiKey,
        apiEndpoint: state.apiEndpoint,
        isConfigured: state.isConfigured,
        googleApiKey: state.googleApiKey,
        isGoogleConfigured: state.isGoogleConfigured,
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
