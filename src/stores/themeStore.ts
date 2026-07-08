/**
 * Theme Store — Multi-Design-System Switcher
 * Supports multiple visual design systems (Instrument, Story to Screen, Noir, etc.)
 * each with light/dark mode. Toggles via `data-theme` attribute on <html>.
 * Defaults to Instrument + system prefers-color-scheme.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

/** CSS data-theme attribute value */
export type ThemeId =
  | 'light' | 'dark'              // Instrument
  | 's2s' | 's2s-dark'            // Story to Screen
  | 'noir' | 'noir-dark'          // Noir Cinema
  | 'sundance' | 'sundance-dark'  // Sundance
  | 'neon' | 'neon-dark'          // Neon Terminal
  | 'arctic' | 'arctic-dark';     // Arctic Studio

/** Visual design system identifier */
export type DesignSystem =
  | 'instrument'
  | 's2s'
  | 'noir'
  | 'sundance'
  | 'neon'
  | 'arctic';

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
  {
    id: 's2s',
    label: 'Story to Screen',
    description: 'Warm editorial, burnished gold, serif elegance',
    lightThemeId: 's2s',
    darkThemeId: 's2s-dark',
    accentLight: '#C8A55C',
    accentDark: '#E8C870',
    fontHint: 'Playfair Display',
  },
  {
    id: 'noir',
    label: 'Noir Cinema',
    description: 'Classic film noir, crimson accents, silver text',
    lightThemeId: 'noir',
    darkThemeId: 'noir-dark',
    accentLight: '#B91C1C',
    accentDark: '#EF4444',
    fontHint: 'Playfair Display',
  },
  {
    id: 'sundance',
    label: 'Sundance',
    description: 'Desert indie warmth, terracotta and sand',
    lightThemeId: 'sundance',
    darkThemeId: 'sundance-dark',
    accentLight: '#C2410C',
    accentDark: '#FB923C',
    fontHint: 'DM Sans',
  },
  {
    id: 'neon',
    label: 'Neon Terminal',
    description: 'Cyberpunk hacker, electric cyan, monospace',
    lightThemeId: 'neon',
    darkThemeId: 'neon-dark',
    accentLight: '#0891B2',
    accentDark: '#22D3EE',
    fontHint: 'JetBrains Mono',
  },
  {
    id: 'arctic',
    label: 'Arctic Studio',
    description: 'Scandinavian minimalism, steel blue, ultra-clean',
    lightThemeId: 'arctic',
    darkThemeId: 'arctic-dark',
    accentLight: '#2563EB',
    accentDark: '#60A5FA',
    fontHint: 'Inter',
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
  { id: 'dark',  label: 'Dark',  family: 'instrument', mode: 'dark' },
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

const resolveThemeId = (ds: DesignSystem, mode: ColorMode): ThemeId => {
  const prefersDark = mode === 'dark' || (mode === 'system' && getSystemPrefersDark());
  const opt = DESIGN_SYSTEMS.find((d) => d.id === ds) ?? DESIGN_SYSTEMS[0];
  return prefersDark ? opt.darkThemeId : opt.lightThemeId;
};

const isDarkMode = (themeId: ThemeId): boolean =>
  themeId === 'dark' || themeId.endsWith('-dark');

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

      setDesignSystem: (ds) => {
        const mode = get().theme;
        const resolved = resolveThemeId(ds, mode);
        set({ designSystem: ds, resolvedTheme: resolved, isDark: isDarkMode(resolved) });
        applyTheme(resolved);
      },
    }),
    {
      name: 'lemon-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const resolved = resolveThemeId(state.designSystem, state.theme);
          state.resolvedTheme = resolved;
          state.isDark = isDarkMode(resolved);
          applyTheme(resolved);
        }
      },
    }
  )
);
