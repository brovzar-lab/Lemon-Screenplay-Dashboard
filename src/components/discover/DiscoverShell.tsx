import { useCallback, useEffect, useRef } from 'react';
import { DiscoverAppHeader } from '@/components/discover/DiscoverAppHeader';
import { DiscoverControls } from '@/components/discover/DiscoverControls';
import { DiscoverDrawer } from '@/components/discover/DiscoverDrawer';
import { DiscoverGrid, DiscoverShowcase } from '@/components/discover/DiscoverResults';
import { DiscoverySelectionBar } from '@/components/discover/DiscoverySelectionBar';
import { useHasSelection } from '@/stores/selectionStore';
import type { Screenplay } from '@/types';

interface DiscoverStats {
  total: number;
  avgWeightedScore: number;
  filmNowCount: number;
}

interface DiscoverShellProps {
  screenplays: Screenplay[];
  allScreenplays: Screenplay[];
  totalCount: number;
  filteredCount: number;
  genres: string[];
  themes: string[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  producedHiddenCount: number;
  onRevealProduced: () => void;
  nonScreenplayHiddenCount: number;
  onRevealNonScreenplays: () => void;
  stats: DiscoverStats;
  selectedScreenplay: Screenplay | null;
  onOpenScreenplay: (screenplay: Screenplay) => void;
  onCloseScreenplay: () => void;
  isLoading: boolean;
  isError: boolean;
}

function DiscoverIntro() {
  return (
    <section className="mb-7 flex flex-col gap-5 border-b border-black-700 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-gold-400">
          Lemon Studios · Development slate
        </p>
        <h1 className="font-display text-5xl leading-none text-black-50 sm:text-6xl">Discover</h1>
      </div>
      <p className="max-w-sm text-left text-sm leading-6 text-black-400 sm:text-right">
        Find the strongest story for the moment, then follow the signal through the slate.
      </p>
    </section>
  );
}

function DiscoverLoading() {
  return (
    <div className="animate-pulse" role="status">
      <div className="mb-7 h-16 w-64 max-w-full rounded-xl bg-black-800" />
      <div className="mb-8 h-48 rounded-2xl bg-black-900 shadow-[var(--shadow-card)] dark:border dark:border-black-700" />
      <div className="mb-12 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="h-[27rem] rounded-2xl bg-black-900 shadow-[var(--shadow-card)] dark:border dark:border-black-700" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-48 rounded-xl bg-black-900 shadow-[var(--shadow-card)] dark:border dark:border-black-700" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-72 rounded-2xl bg-black-900 shadow-[var(--shadow-card)] dark:border dark:border-black-700" />
        ))}
      </div>
      <span className="sr-only">Loading Discovery</span>
    </div>
  );
}

export function DiscoverShell({
  screenplays,
  allScreenplays,
  totalCount,
  filteredCount,
  genres,
  themes,
  hasActiveFilters,
  onClearFilters,
  producedHiddenCount,
  onRevealProduced,
  nonScreenplayHiddenCount,
  onRevealNonScreenplays,
  stats,
  selectedScreenplay,
  onOpenScreenplay,
  onCloseScreenplay,
  isLoading,
  isError,
}: DiscoverShellProps) {
  const hasSelection = useHasSelection();
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const previousSelectionRef = useRef<Screenplay | null>(selectedScreenplay);

  const handleOpen = useCallback(
    (screenplay: Screenplay, trigger: HTMLButtonElement) => {
      returnFocusRef.current = trigger;
      onOpenScreenplay(screenplay);
    },
    [onOpenScreenplay],
  );

  useEffect(() => {
    if (previousSelectionRef.current && !selectedScreenplay) {
      const returnTarget = returnFocusRef.current;
      window.requestAnimationFrame(() => {
        if (returnTarget?.isConnected) returnTarget.focus();
      });
    }
    previousSelectionRef.current = selectedScreenplay;
  }, [selectedScreenplay]);

  const [featured, ...remaining] = screenplays;
  const topMatches = remaining.slice(0, 4);
  const grid = remaining.slice(4);

  return (
    <div className="min-h-screen bg-black-950 text-black-50">
      <DiscoverAppHeader
        total={stats.total}
        averageScore={stats.avgWeightedScore}
        filmNowCount={stats.filmNowCount}
        isLoading={isLoading}
      />

      <main className={`px-4 py-6 sm:px-6 sm:py-8 lg:px-10 ${hasSelection ? 'pb-56 sm:pb-28' : ''}`}>
        <div className="mx-auto max-w-[1600px]">
          {isLoading ? (
            <DiscoverLoading />
          ) : isError ? (
            <section className="rounded-2xl bg-red-500/10 p-6 shadow-[var(--shadow-card)] sm:p-8 dark:border dark:border-red-500/30">
              <h1 className="font-display text-3xl text-black-50">
                Discovery is temporarily unavailable
              </h1>
              <p className="mt-3 text-black-300">
                The existing dashboard is still available at the main route.
              </p>
            </section>
          ) : (
            <>
              <DiscoverIntro />
              <DiscoverControls
                genres={genres}
                themes={themes}
                filteredCount={filteredCount}
                totalCount={totalCount}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={onClearFilters}
                producedHiddenCount={producedHiddenCount}
                onRevealProduced={onRevealProduced}
                nonScreenplayHiddenCount={nonScreenplayHiddenCount}
                onRevealNonScreenplays={onRevealNonScreenplays}
                shortcutsEnabled={!selectedScreenplay}
                screenplays={allScreenplays}
                onOpenScreenplay={handleOpen}
              />

              {totalCount === 0 ? (
                <section className="rounded-2xl bg-black-900 p-8 text-center shadow-[var(--shadow-card)] sm:p-10 dark:border dark:border-black-700">
                  <h2 className="font-display text-3xl text-black-50">
                    No analyzed screenplays yet
                  </h2>
                  <p className="mt-3 text-black-400">
                    New analyses will appear here through the live data feed.
                  </p>
                </section>
              ) : !featured ? (
                <section className="rounded-2xl bg-black-900 p-8 text-center shadow-[var(--shadow-card)] sm:p-10 dark:border dark:border-black-700">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-gold-400">
                    No match
                  </p>
                  <h2 className="mt-3 font-display text-3xl text-black-50">
                    No scripts match this view
                  </h2>
                  <p className="mx-auto mt-3 max-w-md text-black-400">
                    Try a broader search or clear the active filters to reopen the full slate.
                  </p>
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="btn btn-primary mt-6 min-h-11 px-5 text-xs uppercase tracking-[0.15em]"
                  >
                    Clear filters
                  </button>
                </section>
              ) : (
                <>
                  <DiscoverShowcase
                    featured={featured}
                    topMatches={topMatches}
                    onOpen={handleOpen}
                  />

                  <section aria-labelledby="discovery-archive">
                    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-black-700 pb-4">
                      <div>
                        <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-gold-400">
                          The full read
                        </p>
                        <h2 id="discovery-archive" className="font-display text-3xl text-black-50">
                          Slate archive
                        </h2>
                      </div>
                      <span className="font-mono text-xs text-black-500">
                        {grid.length} beyond the shelf
                      </span>
                    </div>
                    <DiscoverGrid screenplays={grid} onOpen={handleOpen} />
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </main>

      <DiscoverySelectionBar
        screenplays={allScreenplays}
        escapeEnabled={!selectedScreenplay}
      />

      {selectedScreenplay && (
        <DiscoverDrawer screenplay={selectedScreenplay} onClose={onCloseScreenplay} />
      )}
    </div>
  );
}
