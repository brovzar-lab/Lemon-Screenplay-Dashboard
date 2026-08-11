import { NavLink } from 'react-router-dom';
import { UserMenu } from '@/components/auth';
import { SyncStatusIndicator } from '@/components/layout/SyncStatusIndicator';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useThemeStore } from '@/stores/themeStore';
import { AuthenticatedNavigation } from '@/components/layout/AuthenticatedNavigation';

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
  const isDark = useThemeStore((state) => state.isDark);

  return (
    <header role="banner" className="dsc-header sticky top-0 z-40">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-6 px-4 sm:px-6 lg:px-10">
        <NavLink
          to="/"
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

        <AuthenticatedNavigation className="order-3 w-full lg:order-none lg:w-auto" />

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
