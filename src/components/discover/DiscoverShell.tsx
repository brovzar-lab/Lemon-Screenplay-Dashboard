import { useCallback, useEffect, useRef } from 'react';
import { DiscoverAppHeader } from '@/components/discover/DiscoverAppHeader';
import { DiscoverControls } from '@/components/discover/DiscoverControls';
import { DiscoverDrawer } from '@/components/discover/DiscoverDrawer';
import { DiscoverGrid, DiscoverShowcase } from '@/components/discover/DiscoverResults';
import { DiscoverySelectionBar } from '@/components/discover/DiscoverySelectionBar';
import { useHasSelection } from '@/stores/selectionStore';
import type { Screenplay } from '@/types';
import '@/components/discover/discovery.css';

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
    <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="dsc-kicker mb-2">Lemon Studios · Development slate</p>
        <h1 className="dsc-display text-4xl sm:text-5xl">Discover</h1>
      </div>
      <p className="max-w-sm text-left text-sm leading-6 text-[var(--dsc-ink-2)] sm:text-right">
        Find the strongest story for the moment, then follow the signal through the slate.
      </p>
    </section>
  );
}

function DiscoverLoading() {
  return (
    <div className="animate-pulse" role="status">
      <div className="dsc-skeleton mb-7 h-16 w-64 max-w-full" />
      <div className="dsc-skeleton dsc-skeleton--card mb-8 h-48" />
      <div className="mb-12 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="dsc-skeleton dsc-skeleton--card h-[27rem]" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="dsc-skeleton dsc-skeleton--card h-48" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="dsc-skeleton dsc-skeleton--card h-72" />
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
    <div className="discovery-root min-h-screen">
      <DiscoverAppHeader
        total={stats.total}
        averageScore={stats.avgWeightedScore}
        filmNowCount={stats.filmNowCount}
        isLoading={isLoading}
      />

      <main className={`px-4 py-5 sm:px-6 sm:py-7 lg:px-8 ${hasSelection ? 'pb-56 sm:pb-28' : ''}`}>
        <div className="mx-auto max-w-[1480px]">
          {isLoading ? (
            <DiscoverLoading />
          ) : isError ? (
            <section className="dsc-card p-6 sm:p-8">
              <h1 className="dsc-display text-3xl">
                Discovery is temporarily unavailable
              </h1>
              <p className="mt-3 text-[var(--dsc-ink-2)]">
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
                <section className="dsc-card p-8 text-center sm:p-10">
                  <h2 className="dsc-display text-3xl">
                    No analyzed screenplays yet
                  </h2>
                  <p className="mt-3 text-[var(--dsc-ink-2)]">
                    New analyses will appear here through the live data feed.
                  </p>
                </section>
              ) : !featured ? (
                <section className="dsc-card p-8 text-center sm:p-10">
                  <p className="dsc-kicker">No match</p>
                  <h2 className="dsc-display mt-3 text-3xl">
                    No scripts match this view
                  </h2>
                  <p className="mx-auto mt-3 max-w-md text-[var(--dsc-ink-2)]">
                    Try a broader search or clear the active filters to reopen the full slate.
                  </p>
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="dsc-btn dsc-btn-primary mt-6"
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
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="dsc-kicker mb-2">The full read</p>
                        <h2 id="discovery-archive" className="text-2xl font-semibold text-[var(--dsc-ink)]">
                          Slate archive
                        </h2>
                      </div>
                      <span className="dsc-label dsc-label-faint">
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
