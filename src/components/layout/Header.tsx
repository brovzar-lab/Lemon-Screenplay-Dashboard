/**
 * Header Component — Instrument Design System
 * Solid surface, cobalt accent, sun/moon toggle, Schibsted body font.
 * Calm shell: the frame is quiet, the data is the loudest thing on screen.
 */

import { useScreenplayStats } from '@/hooks/useScreenplays';
import { useFilteredScreenplays } from '@/hooks/useFilteredScreenplays';
import { useThemeStore } from '@/stores/themeStore';
import { DevExecToggle } from '@/components/devexec';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { UserMenu } from '@/components/auth';
import { AuthenticatedNavigation } from './AuthenticatedNavigation';
import { LanguageControl } from './LanguageControl';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const { data: stats, isLoading } = useScreenplayStats();
  const { filteredCount, totalCount } = useFilteredScreenplays();
  const { isDark } = useThemeStore();

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
            <AuthenticatedNavigation />
          </div>

          {/* Stats & Actions */}
          <div className="flex flex-wrap items-center gap-3" aria-label={t('Dashboard controls')}>
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
                  label={t('Showing')}
                  value={`${filteredCount} / ${totalCount}`}
                />
                <StatPill
                  label={t('Avg Score')}
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
            <LanguageControl />

            {/* Design System Switcher — dropdown with all available themes */}
            <ThemeSwitcher />

            {/* Theme Toggle — shared with the Discovery shell. */}
            <ThemeToggle />

            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
