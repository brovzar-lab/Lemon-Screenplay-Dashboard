/**
 * Theme Store
 * Manages dark/light theme preference with localStorage persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'dark' | 'light';
}

// Get system preference
const getSystemTheme = (): 'dark' | 'light' => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Resolve theme (handle 'system' option)
const resolveTheme = (theme: Theme): 'dark' | 'light' => {
  if (theme === 'system') return getSystemTheme();
  return theme;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      resolvedTheme: 'dark',

      setTheme: (theme) => {
        const resolved = resolveTheme(theme);
        set({ theme, resolvedTheme: resolved });

        // Apply to document
        if (resolved === 'dark') {
          document.documentElement.classList.add('dark');
          document.documentElement.classList.remove('light');
        } else {
          document.documentElement.classList.add('light');
          document.documentElement.classList.remove('dark');
        }
      },
    }),
    {
      name: 'lemon-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Apply theme on rehydration
          const resolved = resolveTheme(state.theme);
          if (resolved === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
          } else {
            document.documentElement.classList.add('light');
            document.documentElement.classList.remove('dark');
          }
        }
      },
    }
  )
);
