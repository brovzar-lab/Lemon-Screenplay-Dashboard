import { useCallback, useEffect, useRef } from 'react';
import { DiscoverAppHeader } from '@/components/discover/DiscoverAppHeader';
import { DiscoverControls } from '@/components/discover/DiscoverControls';
import { DiscoverDrawer } from '@/components/discover/DiscoverDrawer';
import { DiscoverGrid, DiscoverShowcase } from '@/components/discover/DiscoverResults';
import type { Screenplay } from '@/types';

interface DiscoverStats {
  total: number;
  avgWeightedScore: number;
  filmNowCount: number;
}

interface DiscoverShellProps {
  screenplays: Screenplay[];
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
    <section className="mb-7 flex flex-wrap items-end justify-between gap-5 border-b border-black-700 pb-6">
      <div>
        <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-gold-400">
          Lemon Studios · Development slate
        </p>
        <h1 className="font-display text-5xl leading-none text-black-50 sm:text-6xl">Discover</h1>
      </div>
      <p className="max-w-sm text-right text-sm leading-6 text-black-400">
        Find the strongest story for the moment, then follow the signal through the slate.
      </p>
    </section>
  );
}

function DiscoverLoading() {
  return (
    <div className="animate-pulse" role="status">
      <div className="mb-7 h-16 w-72 bg-black-800" />
      <div className="mb-8 h-48 border border-black-700 bg-black-900" />
      <div className="mb-12 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="h-[27rem] border border-black-700 bg-black-900" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-48 border border-black-700 bg-black-900" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-72 border border-black-700 bg-black-900" />
        ))}
      </div>
      <span className="sr-only">Loading Discovery</span>
    </div>
  );
}

export function DiscoverShell({
  screenplays,
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

      <main className="px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1600px]">
          {isLoading ? (
            <DiscoverLoading />
          ) : isError ? (
            <section className="border border-red-500/30 bg-black-900 p-8">
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
              />

              {totalCount === 0 ? (
                <section className="border border-black-700 bg-black-900 p-10 text-center">
                  <h2 className="font-display text-3xl text-black-50">
                    No analyzed screenplays yet
                  </h2>
                  <p className="mt-3 text-black-400">
                    New analyses will appear here through the live data feed.
                  </p>
                </section>
              ) : !featured ? (
                <section className="border border-black-700 bg-black-900 p-10 text-center">
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
                    className="mt-6 border border-gold-500/60 px-5 py-2 text-xs font-bold uppercase tracking-[0.15em] text-gold-300 hover:bg-gold-500/10"
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

      {selectedScreenplay && (
        <DiscoverDrawer screenplay={selectedScreenplay} onClose={onCloseScreenplay} />
      )}
    </div>
  );
}
