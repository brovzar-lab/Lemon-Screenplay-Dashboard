/**
 * Header Component — Instrument Design System
 * Solid surface, cobalt accent, sun/moon toggle, Schibsted body font.
 * Calm shell: the frame is quiet, the data is the loudest thing on screen.
 */

import { Link } from 'react-router-dom';
import { useScreenplayStats } from '@/hooks/useScreenplays';
import { useFilteredScreenplays } from '@/hooks/useFilteredScreenplays';
import { useThemeStore } from '@/stores/themeStore';
import { DevExecToggle } from '@/components/devexec';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';

interface StatPillProps {
  label: string;
  value: string | number;
  highlight?: boolean;
}

/** Stat pill — a card with shadow (Solidity: numbers have presence) */
function StatPill({ label, value, highlight = false }: StatPillProps) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 rounded-xl"
      style={{
        background: highlight ? 'var(--sp-accent)' : 'var(--sp-surface)',
        boxShadow: highlight ? 'var(--sp-shadow-btn)' : 'var(--sp-shadow-sm)',
        color: highlight ? 'var(--sp-accent-text)' : 'var(--sp-text)',
      }}
    >
      <span
        className="text-sm font-medium"
        style={{ color: highlight ? 'var(--sp-accent-text)' : 'var(--sp-text-3)' }}
      >
        {label}
      </span>
      <span
        className="font-bold"
        style={{
          color: highlight ? 'var(--sp-accent-text)' : 'var(--sp-text)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          fontWeight: 600,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function Header() {
  const { data: stats, isLoading } = useScreenplayStats();
  const { filteredCount, totalCount } = useFilteredScreenplays();
  const { isDark, setTheme } = useThemeStore();

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'var(--sp-surface)',
        borderBottom: '1px solid var(--sp-border)',
      }}
      role="banner"
    >
      <div className="max-w-[1800px] mx-auto px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo & Title — Playfair for the brand name only */}
          <div className="flex items-center gap-4">
            <img
              src={isDark ? '/lemon-logo-white.png' : '/lemon-logo-black.png'}
              alt="Lemon Studios"
              className="h-9 w-9"
            />
            <h1 className="text-2xl m-0" style={{ fontSize: '28px' }}>
              <span
                className="font-display"
                style={{ color: 'var(--sp-accent)', fontWeight: 700 }}
              >
                LEMON
              </span>
              <span
                style={{
                  color: 'var(--sp-text-2)',
                  fontWeight: 400,
                  marginLeft: '8px',
                  fontFamily: 'var(--sp-font)',
                  fontSize: '20px',
                }}
              >
                Screenplay Dashboard
              </span>
            </h1>
            {/* Version badge — accent-soft tint */}
            <span
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium select-none"
              style={{
                background: 'var(--sp-accent-soft)',
                color: 'var(--sp-accent)',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.05em',
                textTransform: 'uppercase' as const,
                fontWeight: 500,
                fontSize: '11px',
              }}
            >
              V9 · 6.9
            </span>
          </div>

          {/* Stats & Actions */}
          <nav className="flex flex-wrap items-center gap-3" aria-label="Dashboard controls">
            {isLoading ? (
              <div className="flex gap-3">
                {[32, 28, 24].map((w) => (
                  <div
                    key={w}
                    className="h-10 rounded-xl animate-pulse"
                    style={{ width: `${w * 4}px`, background: 'var(--sp-sunken)' }}
                  />
                ))}
              </div>
            ) : (
              <>
                <StatPill
                  label="Showing"
                  value={`${filteredCount} / ${totalCount}`}
                />
                <StatPill
                  label="Avg Score"
                  value={stats?.avgWeightedScore.toFixed(1) || '—'}
                />
                {(stats?.filmNowCount ?? 0) > 0 && (
                  <StatPill
                    label="FILM NOW"
                    value={stats!.filmNowCount}
                    highlight={true}
                  />
                )}
              </>
            )}

            <SyncStatusIndicator />
            <DevExecToggle />

            {/* Design System Switcher — dropdown with all available themes */}
            <ThemeSwitcher />

            {/* Theme Toggle — small sun/moon icon per DESIGN.md §6 */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg"
              style={{ color: 'var(--sp-text-3)', transition: 'color 120ms, background 120ms' }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.color = 'var(--sp-accent)';
                el.style.background = 'var(--sp-sunken)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.color = 'var(--sp-text-3)';
                el.style.background = 'transparent';
              }}
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-7.07-1.42 1.42M8.35 15.65l-1.42 1.42m12.14 0-1.42-1.42M8.35 8.35 6.93 6.93" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Settings Link */}
            <Link
              to="/settings"
              className="p-2 rounded-lg"
              style={{ color: 'var(--sp-text-3)', transition: 'color 120ms, background 120ms' }}
              title="Settings"
              aria-label="Settings"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;
