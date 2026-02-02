/**
 * Header Component
 * Main header with logo, stats, and global actions
 */

import { useScreenplayStats } from '@/hooks/useScreenplays';
import { useFilteredScreenplays } from '@/hooks/useFilteredScreenplays';

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

  return (
    <header className="sticky top-0 z-50 glass-dark border-b border-gold-500/10">
      <div className="max-w-[1800px] mx-auto px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <span className="text-4xl animate-pulse-glow" role="img" aria-label="Lemon">
              🍋
            </span>
            <div>
              <h1 className="text-2xl font-display text-gradient-gold m-0">
                Lemon Screenplay Dashboard
              </h1>
              <p className="text-sm text-black-400 m-0">
                Production Company Intelligence
              </p>
            </div>
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
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
