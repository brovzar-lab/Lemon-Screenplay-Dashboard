/**
 * Theme Store
 * Manages dark/light theme preference and brand preview with localStorage persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light' | 'system';
export type BrandPreview = 'default' | 'editorial-punk';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'dark' | 'light';
  brandPreview: BrandPreview;
  setBrandPreview: (brand: BrandPreview) => void;
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

// Apply brand class to document
const applyBrand = (brand: BrandPreview) => {
  if (brand === 'editorial-punk') {
    document.documentElement.classList.add('brand-editorial-punk');
  } else {
    document.documentElement.classList.remove('brand-editorial-punk');
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      resolvedTheme: 'dark',
      brandPreview: 'default',

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

      setBrandPreview: (brand) => {
        set({ brandPreview: brand });
        applyBrand(brand);
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
          // Apply brand on rehydration
          applyBrand(state.brandPreview);
        }
      },
    }
  )
);
