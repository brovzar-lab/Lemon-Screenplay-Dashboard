/**
 * Header Component
 * Main header with logo, stats, and global actions
 */

import { Link } from 'react-router-dom';
import { useScreenplayStats } from '@/hooks/useScreenplays';
import { useFilteredScreenplays } from '@/hooks/useFilteredScreenplays';
import { useThemeStore } from '@/stores/themeStore';
import { DevExecToggle } from '@/components/devexec';

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

export function Header() {
  const { data: stats, isLoading } = useScreenplayStats();
  const { filteredCount, totalCount } = useFilteredScreenplays();
  const { resolvedTheme, setTheme } = useThemeStore();

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-50 glass-dark border-b border-gold-500/10">
      <div className="max-w-[1800px] mx-auto px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-4">
            <span className="text-3xl" role="img" aria-label="Lemon">🍋</span>
            <h1 className="text-2xl font-display m-0">
              <span className="text-gradient-gold font-bold tracking-tight">LEMON</span>
              <span className="text-black-200 font-light ml-2">Screenplay Dashboard</span>
              <span className="text-xs text-black-500 font-light ml-2 opacity-50">v6.7.0</span>
            </h1>
          </div>

          {/* Stats Pills */}
          <div className="flex flex-wrap items-center gap-3">
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
                <StatPill
                  label="FILM NOW"
                  value={stats?.filmNowCount || 0}
                  highlight={true}
                />
              </>
            )}

            {/* Dev Exec AI */}
            <DevExecToggle />

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-black-400 hover:text-gold-400 hover:bg-black-800/50 transition-colors"
              title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label="Toggle theme"
            >
              {resolvedTheme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* Settings Link */}
            <Link
              to="/settings"
              className="p-2 rounded-lg text-black-400 hover:text-gold-400 hover:bg-black-800/50 transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
