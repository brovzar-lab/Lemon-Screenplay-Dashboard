/**
 * Header Component
 * Main header with logo, stats, and global actions
 */

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useScreenplayStats } from '@/hooks/useScreenplays';
import { useFilteredScreenplays } from '@/hooks/useFilteredScreenplays';
import { useThemeStore, THEME_OPTIONS } from '@/stores/themeStore';
import type { ThemeId } from '@/stores/themeStore';
import { DevExecToggle } from '@/components/devexec';
import { SyncStatusIndicator } from './SyncStatusIndicator';

interface StatPillProps {
  label: string;
  value: string | number;
  highlight?: boolean;
}

function StatPill({ label, value, highlight = false }: StatPillProps) {
  return (
    <div
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg
        ${highlight ? 'bg-gradient-to-r from-gold-500 to-gold-600 text-black-950' : 'glass'}
      `}
    >
      <span className={`text-sm ${highlight ? 'text-black-800' : 'text-black-400'}`}>
        {label}
      </span>
      <span className={`font-mono font-bold ${highlight ? 'text-black-950' : 'text-gold-400'}`}>
        {value}
      </span>
    </div>
  );
}

/** Small color swatch for the theme picker */
function ThemeSwatch({ themeId }: { themeId: ThemeId }) {
  const swatchColors: Record<ThemeId, { bg: string; accent: string }> = {
    dark:       { bg: '#0B0A12', accent: '#7C6AF6' },
    light:      { bg: '#F1F0F7', accent: '#6655E6' },
    's2s':      { bg: '#F5F1E8', accent: '#C49B4B' },
    's2s-dark': { bg: '#141210', accent: '#D4A94F' },
  };
  const { bg, accent } = swatchColors[themeId];
  return (
    <span
      className="inline-block w-4 h-4 rounded-full border border-current/20 flex-shrink-0"
      style={{
        background: `linear-gradient(135deg, ${bg} 50%, ${accent} 50%)`,
      }}
    />
  );
}

export function Header() {
  const { data: stats, isLoading } = useScreenplayStats();
  const { filteredCount, totalCount } = useFilteredScreenplays();
  const { resolvedTheme, isDark, setTheme } = useThemeStore();
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isThemeOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setIsThemeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isThemeOpen]);

  return (
    <header className="sticky top-0 z-50 glass-dark border-b border-gold-500/10" role="banner">
      <div className="max-w-[1800px] mx-auto px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <img src={isDark ? '/lemon-logo-white.png' : '/lemon-logo-black.png'} alt="Lemon Studios" className="h-9 w-9" />
            <h1 className="text-2xl font-display m-0">
              <span className="text-gradient-gold font-bold tracking-tight">LEMON</span>
              <span className="text-black-200 font-light ml-2">Screenplay Dashboard</span>
            </h1>
            {/* Engine + version badge */}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono tracking-wide select-none">
              V9 &middot; 6.9
            </span>
          </div>

          {/* Stats Pills */}
          <nav className="flex flex-wrap items-center gap-3" aria-label="Dashboard controls">
            {isLoading ? (
              <div className="flex gap-3">
                <div className="h-10 w-32 rounded-lg bg-black-800 animate-pulse" />
                <div className="h-10 w-28 rounded-lg bg-black-800 animate-pulse" />
                <div className="h-10 w-24 rounded-lg bg-black-800 animate-pulse" />
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

            {/* Sync Status */}
            <SyncStatusIndicator />

            {/* Dev Exec AI */}
            <DevExecToggle />

            {/* Theme Picker */}
            <div className="relative" ref={themeRef}>
              <button
                onClick={() => setIsThemeOpen(!isThemeOpen)}
                className="flex items-center gap-2 p-2 rounded-lg text-black-400 hover:text-gold-400 hover:bg-black-800/50 transition-colors"
                title="Change theme"
                aria-label="Change theme"
                aria-expanded={isThemeOpen}
                aria-haspopup="true"
              >
                <ThemeSwatch themeId={resolvedTheme} />
                <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 12 12" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5l3 3 3-3" />
                </svg>
              </button>

              {isThemeOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-52 rounded-xl border overflow-hidden z-50"
                  style={{
                    background: 'var(--sp-surface)',
                    borderColor: 'var(--sp-border-strong)',
                    boxShadow: 'var(--sp-shadow-lg)',
                  }}
                  role="menu"
                >
                  <div className="p-1.5">
                    {THEME_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          setTheme(option.id);
                          setIsThemeOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors"
                        style={{
                          background: resolvedTheme === option.id ? 'var(--sp-accent-soft)' : 'transparent',
                          color: resolvedTheme === option.id ? 'var(--sp-accent)' : 'var(--sp-text-2)',
                        }}
                        role="menuitem"
                      >
                        <ThemeSwatch themeId={option.id} />
                        <span
                          className="text-sm"
                          style={{
                            fontWeight: resolvedTheme === option.id ? 600 : 400,
                            fontFamily: option.family === 's2s' ? '"Playfair Display", Georgia, serif' : 'inherit',
                          }}
                        >
                          {option.label}
                        </span>
                        {resolvedTheme === option.id && (
                          <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Settings Link */}
            <Link
              to="/settings"
              className="p-2 rounded-lg text-black-400 hover:text-gold-400 hover:bg-black-800/50 transition-colors"
              title="Settings"
              aria-label="Settings"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;
