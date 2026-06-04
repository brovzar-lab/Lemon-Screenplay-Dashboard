/**
 * Appearance Settings — Soft Print
 * Light is primary; dark is a warm-charcoal counterpart.
 */

import { clsx } from 'clsx';
import { useThemeStore, type Theme } from '@/stores/themeStore';

interface ThemeOption {
  id: Theme;
  label: string;
  icon: React.ReactNode;
  description: string;
  swatch: { bg: string; surface: string; rose: string };
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'light',
    label: 'Light',
    description: 'Warm paper — primary',
    swatch: { bg: '#F1EBE0', surface: '#FBF8F2', rose: '#BC6A77' },
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Warm charcoal counterpart',
    swatch: { bg: '#1A1714', surface: '#232019', rose: '#DE939D' },
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
  },
  {
    id: 'system',
    label: 'System',
    description: 'Follow device preference',
    swatch: { bg: 'linear-gradient(135deg, #F1EBE0 50%, #1A1714 50%)', surface: '#BC6A77', rose: '#BC6A77' },
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export function AppearanceSettings() {
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl mb-2" style={{ color: 'var(--sp-text)' }}>Appearance</h2>
        <p className="text-sm" style={{ color: 'var(--sp-text-2)' }}>
          Soft Print is a calm, warm system. Light is the primary theme.
        </p>
      </div>

      <div>
        <label
          className="block text-xs mb-4 uppercase"
          style={{
            color: 'var(--sp-text-3)',
            fontFamily: 'var(--sp-mono)',
            letterSpacing: '0.14em',
          }}
        >
          Theme
        </label>
        <div className="grid grid-cols-3 gap-4">
          {THEME_OPTIONS.map((option) => {
            const selected = theme === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setTheme(option.id)}
                className={clsx('text-left transition-all p-4')}
                style={{
                  background: selected ? 'var(--sp-rose-tint)' : 'var(--sp-surface)',
                  border: `1px solid ${selected ? 'var(--sp-rose)' : 'var(--sp-border)'}`,
                  borderRadius: 'var(--sp-r-lg)',
                  color: 'var(--sp-text)',
                  cursor: 'pointer',
                }}
              >
                <div
                  className="mb-3 flex items-center gap-2"
                  style={{ color: selected ? 'var(--sp-rose-strong)' : 'var(--sp-text-2)' }}
                >
                  {option.icon}
                  <div
                    aria-hidden
                    style={{
                      width: 28,
                      height: 14,
                      borderRadius: 'var(--sp-r-full)',
                      background: option.swatch.bg,
                      border: '1px solid var(--sp-border)',
                    }}
                  />
                </div>
                <p className="font-medium text-sm" style={{ color: 'var(--sp-text)' }}>
                  {option.label}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--sp-text-3)' }}>
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="p-4 flex gap-3"
        style={{
          background: 'var(--sp-surface)',
          border: '1px solid var(--sp-border)',
          borderRadius: 'var(--sp-r-md)',
        }}
      >
        <svg
          className="w-5 h-5 shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          style={{ color: 'var(--sp-rose)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--sp-text)' }}>
            Single brand, three signals
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--sp-text-2)' }}>
            Rose carries the brand and primary actions. Sage, sand, and clay carry status only —
            and never overlap with brand.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AppearanceSettings;
