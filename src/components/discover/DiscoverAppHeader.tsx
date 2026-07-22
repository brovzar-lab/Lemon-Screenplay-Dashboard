import { NavLink } from 'react-router-dom';
import { UserMenu } from '@/components/auth';
import { SyncStatusIndicator } from '@/components/layout/SyncStatusIndicator';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useIsAdmin } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';

interface DiscoverAppHeaderProps {
  total: number;
  averageScore: number;
  filmNowCount: number;
  isLoading: boolean;
}

interface LedgerStatProps {
  value: string;
  label: string;
  accent?: boolean;
}

function LedgerStat({ value, label, accent = false }: LedgerStatProps) {
  return (
    <div className="flex min-w-0 flex-1 items-baseline gap-2 border-r border-black-700 px-4 py-2.5 last:border-r-0 sm:px-6">
      <span
        className={`font-mono text-base font-semibold tabular-nums sm:text-lg ${accent ? 'text-gold-300' : 'text-black-50'}`}
      >
        {value}
      </span>
      <span className="truncate text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-black-500 sm:text-[0.65rem]">
        {label}
      </span>
    </div>
  );
}

export function DiscoverAppHeader({
  total,
  averageScore,
  filmNowCount,
  isLoading,
}: DiscoverAppHeaderProps) {
  const isAdmin = useIsAdmin();
  const isDark = useThemeStore((state) => state.isDark);
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `border-b-2 px-1 py-3 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
      isActive
        ? 'border-gold-400 text-black-50'
        : 'border-transparent text-black-400 hover:text-black-50'
    }`;

  return (
    <header
      role="banner"
      className="sticky top-0 z-40 border-b border-black-700 bg-black-950/95 text-black-50 backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-6 px-4 sm:px-6 lg:px-10">
        <NavLink
          to="/discover"
          className="flex min-w-0 items-center gap-3 py-3"
          aria-label="Discovery home"
        >
          <img
            src={isDark ? '/lemon-logo-white.png' : '/lemon-logo-black.png'}
            alt="Lemon Studios"
            className="h-8 w-8 shrink-0"
          />
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="font-display text-lg font-bold tracking-[0.04em] text-gold-300">
              LEMON
            </span>
            <span className="hidden truncate text-sm text-black-300 sm:inline">Discovery</span>
          </span>
        </NavLink>

        <nav
          aria-label="Discovery navigation"
          className="order-3 flex w-full gap-5 sm:order-none sm:w-auto"
        >
          <NavLink to="/discover" end={false} className={navClass}>
            Discover
          </NavLink>
          {isAdmin && (
            <NavLink to="/settings" className={navClass}>
              Settings
            </NavLink>
          )}
        </nav>

        <div
          className="ml-auto flex items-center gap-1.5 py-2"
          aria-label="Account and sync controls"
        >
          <SyncStatusIndicator />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>

      <div
        className="border-t border-black-700 bg-black-900"
        aria-label="Discovery slate statistics"
      >
        <div className="mx-auto flex max-w-[1800px] overflow-hidden">
          <LedgerStat value={isLoading ? '—' : String(total)} label="Total scripts" />
          <LedgerStat
            value={isLoading || total === 0 ? '—' : averageScore.toFixed(1)}
            label="Average score"
          />
          <LedgerStat value={isLoading ? '—' : String(filmNowCount)} label="Film Now" accent />
        </div>
      </div>
    </header>
  );
}
