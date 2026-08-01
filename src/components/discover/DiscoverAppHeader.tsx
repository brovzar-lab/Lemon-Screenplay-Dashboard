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
  sectionTitle?: string;
}

interface LedgerStatProps {
  value: string;
  label: string;
  accent?: boolean;
}

function LedgerStat({ value, label, accent = false }: LedgerStatProps) {
  return (
    <div className="dsc-stat flex min-w-0 flex-1 items-baseline gap-2 px-4 py-2.5 sm:px-6">
      <span className={`dsc-stat-value ${accent ? 'dsc-stat-value--accent' : ''}`}>{value}</span>
      <span className="dsc-label dsc-label-faint truncate">{label}</span>
    </div>
  );
}

export function DiscoverAppHeader({
  total,
  averageScore,
  filmNowCount,
  isLoading,
  sectionTitle = 'Cinema Browse',
}: DiscoverAppHeaderProps) {
  const isAdmin = useIsAdmin();
  const isDark = useThemeStore((state) => state.isDark);
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `dsc-tab ${isActive ? 'dsc-tab--active' : ''}`;

  return (
    <header role="banner" className="dsc-header sticky top-0 z-40">
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
          <span className="flex min-w-0 flex-col">
            <span className="dsc-brand-name">LEMON</span>
            <span className="dsc-brand-sub hidden truncate sm:block">Discovery</span>
          </span>
        </NavLink>

        <div className="cinema-header-title hidden lg:flex">
          <span aria-hidden="true" />
          <strong>{sectionTitle}</strong>
        </div>

        <nav
          aria-label="Discovery navigation"
          className="order-3 flex w-full gap-5 lg:order-none lg:w-auto"
        >
          <NavLink to="/discover" end={false} className={navClass}>
            Discover
          </NavLink>
          {isAdmin && (
            <NavLink to="/intake" className={navClass}>
              Intake
            </NavLink>
          )}
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

      <div className="dsc-statbar" aria-label="Discovery slate statistics">
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
