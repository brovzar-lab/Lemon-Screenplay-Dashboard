/**
 * Theme Store — Instrument light/dark preference.
 * Toggles via `data-theme` attribute on <html>.
 * Defaults to Instrument + system prefers-color-scheme.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

/** CSS data-theme attribute value */
export type ThemeId =
  | 'light'
  | 'dark';

/** Visual design system identifier */
export type DesignSystem = 'instrument';

/** What the user selects for light/dark preference */
export type ColorMode = 'light' | 'dark' | 'system';

/** Theme family (kept for backward compatibility) */
export type ThemeFamily = DesignSystem;
export type Theme = ColorMode;

/** Metadata shown in the theme picker dropdown */
export interface DesignSystemOption {
  id: DesignSystem;
  label: string;
  description: string;
  lightThemeId: ThemeId;
  darkThemeId: ThemeId;
  /** Accent color swatch for the dropdown preview */
  accentLight: string;
  accentDark: string;
  /** Font family hint */
  fontHint: string;
}

export const DESIGN_SYSTEMS: DesignSystemOption[] = [
  {
    id: 'instrument',
    label: 'Instrument',
    description: 'Cool grey-white, cobalt accent, Playfair + Schibsted',
    lightThemeId: 'light',
    darkThemeId: 'dark',
    accentLight: '#2B54F0',
    accentDark: '#6E8BFF',
    fontHint: 'Playfair Display',
  },
];

/* -------------------------------------------------------------------------- */
/*  Backward-compatible exports                                               */
/* -------------------------------------------------------------------------- */

export interface ThemeOption {
  id: ThemeId;
  label: string;
  family: ThemeFamily;
  mode: 'dark' | 'light';
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'light', label: 'Light', family: 'instrument', mode: 'light' },
  { id: 'dark', label: 'Dark', family: 'instrument', mode: 'dark' },
];

/* -------------------------------------------------------------------------- */
/*  Store                                                                     */
/* -------------------------------------------------------------------------- */

interface ThemeState {
  /** Light/dark/system preference */
  theme: ColorMode;
  /** Active design system family */
  designSystem: DesignSystem;
  /** Resolved CSS data-theme attribute */
  resolvedTheme: ThemeId;
  /** Convenience boolean */
  isDark: boolean;

  setTheme: (theme: ColorMode) => void;
  setDesignSystem: (ds: DesignSystem) => void;
}

const getSystemPrefersDark = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const resolveThemeId = (_ds: DesignSystem, mode: ColorMode): ThemeId => {
  const prefersDark = mode === 'dark' || (mode === 'system' && getSystemPrefersDark());
  const opt = DESIGN_SYSTEMS[0];
  return prefersDark ? opt.darkThemeId : opt.lightThemeId;
};

const isDarkMode = (themeId: ThemeId): boolean => themeId === 'dark' || themeId.endsWith('-dark');

const applyTheme = (resolved: ThemeId) => {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);

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
    (set, get) => ({
      theme: 'system' as ColorMode,
      designSystem: 'instrument' as DesignSystem,
      resolvedTheme: 'light' as ThemeId,
      isDark: false,

      setTheme: (theme) => {
        const ds = get().designSystem;
        const resolved = resolveThemeId(ds, theme);
        set({ theme, resolvedTheme: resolved, isDark: isDarkMode(resolved) });
        applyTheme(resolved);
      },

      setDesignSystem: (_ds) => {
        const mode = get().theme;
        const resolved = resolveThemeId('instrument', mode);
        set({ designSystem: 'instrument', resolvedTheme: resolved, isDark: isDarkMode(resolved) });
        applyTheme(resolved);
      },
    }),
    {
      name: 'lemon-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.designSystem = 'instrument';
          const resolved = resolveThemeId('instrument', state.theme);
          state.resolvedTheme = resolved;
          state.isDark = isDarkMode(resolved);
          applyTheme(resolved);
        }
      },
    },
  ),
);
