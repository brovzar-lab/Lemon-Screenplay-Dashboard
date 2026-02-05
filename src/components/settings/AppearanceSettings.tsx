/**
 * Appearance Settings
 * Theme toggle and display preferences
 */

import { clsx } from 'clsx';
import { useThemeStore, type Theme } from '@/stores/themeStore';

interface ThemeOption {
  id: Theme;
  label: string;
  icon: React.ReactNode;
  description: string;
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

export function AppearanceSettings() {
  const { theme, setTheme } = useThemeStore();

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

      {/* Preview Box */}
      <div className="p-6 rounded-xl bg-gradient-to-br from-black-800/50 to-black-900/50 border border-black-700">
        <h3 className="text-lg font-medium text-gold-200 mb-4">Preview</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Sample Card */}
          <div className="p-4 rounded-lg bg-black-800 border border-black-700">
            <div className="w-full h-20 rounded bg-gradient-to-br from-gold-500/20 to-gold-600/10 mb-3" />
            <div className="h-3 w-3/4 rounded bg-gold-400/30 mb-2" />
            <div className="h-2 w-1/2 rounded bg-black-600" />
          </div>
          {/* Sample Stats */}
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-black-800 border border-black-700">
              <div className="text-xs text-black-500">Weighted Score</div>
              <div className="text-lg font-bold text-gold-400">8.5</div>
            </div>
            <div className="p-3 rounded-lg bg-black-800 border border-black-700">
              <div className="text-xs text-black-500">Recommendation</div>
              <div className="text-lg font-bold text-emerald-400">RECOMMEND</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tip about system theme */}
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
    </div>
  );
}

export default AppearanceSettings;
