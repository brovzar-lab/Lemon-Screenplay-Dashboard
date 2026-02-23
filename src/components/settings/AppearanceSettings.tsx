/**
 * Appearance Settings
 * Theme toggle, brand preview, and display preferences
 */

import { clsx } from 'clsx';
import { useThemeStore, type Theme, type BrandPreview } from '@/stores/themeStore';

interface ThemeOption {
  id: Theme;
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface BrandOption {
  id: BrandPreview;
  label: string;
  description: string;
  colors: string[];
  fonts: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'dark',
    label: 'Dark',
    description: 'Dark theme with gold accents',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
  },
  {
    id: 'light',
    label: 'Light',
    description: 'Light theme with warm tones',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    id: 'system',
    label: 'System',
    description: 'Follow system preference',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const BRAND_OPTIONS: BrandOption[] = [
  {
    id: 'default',
    label: 'Current',
    description: 'Gold & Black — Cinematic Luxury',
    colors: ['#F59E0B', '#FBBF24', '#0F172A', '#1E293B'],
    fonts: 'Playfair Display / Inter',
  },
  {
    id: 'editorial-punk',
    label: 'Editorial Punk',
    description: 'Cyan, Yellow & Coral — Bold Editorial',
    colors: ['#00E5C8', '#FFFF00', '#FF6B6B', '#2A2A2A'],
    fonts: 'Barlow Condensed / Archivo',
  },
];

export function AppearanceSettings() {
  const { theme, setTheme, brandPreview, setBrandPreview } = useThemeStore();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-display text-gold-200 mb-2">Appearance</h2>
        <p className="text-sm text-black-400">
          Customize how the dashboard looks and feels.
        </p>
      </div>

      {/* Theme Selection */}
      <div>
        <label className="block text-sm font-medium text-gold-300 mb-4">
          Theme
        </label>
        <div className="grid grid-cols-3 gap-4">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setTheme(option.id)}
              className={clsx(
                'p-4 rounded-xl border-2 transition-all text-left',
                theme === option.id
                  ? 'border-gold-400 bg-gold-500/10'
                  : 'border-black-700 hover:border-gold-500/30 bg-black-800/50'
              )}
            >
              <div className={clsx(
                'mb-3',
                theme === option.id ? 'text-gold-400' : 'text-black-400'
              )}>
                {option.icon}
              </div>
              <p className={clsx(
                'font-medium',
                theme === option.id ? 'text-gold-200' : 'text-black-200'
              )}>
                {option.label}
              </p>
              <p className="text-xs text-black-500 mt-1">
                {option.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Brand Preview */}
      <div>
        <label className="block text-sm font-medium text-gold-300 mb-2">
          Brand Preview
        </label>
        <p className="text-xs text-black-500 mb-4">
          Test a new brand identity without changing your production theme.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {BRAND_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setBrandPreview(option.id)}
              className={clsx(
                'p-5 rounded-xl border-2 transition-all text-left',
                brandPreview === option.id
                  ? 'border-gold-400 bg-gold-500/10'
                  : 'border-black-700 hover:border-gold-500/30 bg-black-800/50'
              )}
            >
              {/* Color swatches */}
              <div className="flex gap-1.5 mb-3">
                {option.colors.map((color, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-md border border-white/10"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <p className={clsx(
                'font-medium text-sm',
                brandPreview === option.id ? 'text-gold-200' : 'text-black-200'
              )}>
                {option.label}
              </p>
              <p className="text-xs text-black-500 mt-1">
                {option.description}
              </p>
              <p className="text-xs text-black-600 mt-2 font-mono tracking-wider">
                {option.fonts}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Preview mode disclaimer */}
      {brandPreview !== 'default' && (
        <div className="p-4 rounded-lg border border-gold-500/30" style={{
          background: brandPreview === 'editorial-punk'
            ? 'rgba(0, 229, 200, 0.08)'
            : 'rgba(245, 158, 11, 0.1)'
        }}>
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <div>
              <p className="text-sm text-gold-200 font-medium">Preview mode active</p>
              <p className="text-xs text-gold-300/70 mt-1">
                You're previewing the {BRAND_OPTIONS.find(b => b.id === brandPreview)?.label} brand identity.
                This is temporary — select "Current" to revert.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Original tip (only when no brand preview) */}
      {brandPreview === 'default' && (
        <div className="p-4 rounded-lg bg-gold-500/10 border border-gold-500/30">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-gold-200 font-medium">Pro tip</p>
              <p className="text-xs text-gold-300/70 mt-1">
                Use "System" to automatically switch themes based on your device's display settings.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppearanceSettings;

