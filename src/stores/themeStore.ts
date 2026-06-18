/**
 * Theme Store
 * Supports multiple design systems (Halation, Story to Screen) each with
 * dark & light modes. Writes `data-theme` on <html> for CSS variable scoping
 * and the legacy .dark/.light class for any Tailwind dark: utilities.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** The data-theme attribute values that drive CSS variable scoping */
export type ThemeId = 'dark' | 'light' | 's2s' | 's2s-dark';

/** What the user selects (includes system auto-detect) */
export type Theme = ThemeId | 'system';

/** Metadata for the theme picker UI */
export interface ThemeOption {
  id: ThemeId;
  label: string;
  family: 'halation' | 's2s';
  mode: 'dark' | 'light';
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'dark',     label: 'Halation Dark',           family: 'halation', mode: 'dark' },
  { id: 'light',    label: 'Halation Light',          family: 'halation', mode: 'light' },
  { id: 's2s',      label: 'Story to Screen',         family: 's2s',      mode: 'light' },
  { id: 's2s-dark', label: 'Story to Screen Dark',    family: 's2s',      mode: 'dark' },
];

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** The resolved data-theme value currently applied */
  resolvedTheme: ThemeId;
  /** Whether the resolved theme is visually dark */
  isDark: boolean;
}

const getSystemTheme = (): ThemeId => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const resolveTheme = (theme: Theme): ThemeId => {
  if (theme === 'system') return getSystemTheme();
  return theme;
};

const isDarkMode = (id: ThemeId): boolean => id === 'dark' || id === 's2s-dark';

const applyTheme = (resolved: ThemeId) => {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);

  // Keep the legacy .dark/.light class for Tailwind dark: utilities
  if (isDarkMode(resolved)) {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      resolvedTheme: 'light' as ThemeId,
      isDark: false,

      setTheme: (theme) => {
        const resolved = resolveTheme(theme);
        set({ theme, resolvedTheme: resolved, isDark: isDarkMode(resolved) });
        applyTheme(resolved);
      },
    }),
    {
      name: 'lemon-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolveTheme(state.theme);
          state.resolvedTheme = resolved;
          state.isDark = isDarkMode(resolved);
          applyTheme(resolved);
        }
      },
    }
  )
);
