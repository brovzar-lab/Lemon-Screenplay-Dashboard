import { useCallback, useEffect, useMemo, useRef } from 'react';
import { DiscoverAppHeader } from '@/components/discover/DiscoverAppHeader';
import { DiscoverControls } from '@/components/discover/DiscoverControls';
import { DiscoverDrawer } from '@/components/discover/DiscoverDrawer';
import {
  DiscoverFeature,
  DiscoverFilmNowShelf,
  DiscoverGrid,
  DiscoverRankedShelf,
} from '@/components/discover/DiscoverResults';
import { DiscoverySelectionBar } from '@/components/discover/DiscoverySelectionBar';
import { useHasSelection } from '@/stores/selectionStore';
import { useIsAdmin } from '@/stores/authStore';
import { useProducerAssessmentHeads } from '@/hooks/useProducerAssessments';
import type { ProducerAssessmentHead, Screenplay } from '@/types';
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
    <section className="cinema-page-intro">
      <div>
        <p className="dsc-kicker">Lemon Studios · Development slate</p>
        <h1>Cinema Browse</h1>
      </div>
      <p>
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
  const isAdmin = useIsAdmin();
  const hasSelection = useHasSelection();
  const { data: producerAssessmentHeads = [] } =
    useProducerAssessmentHeads(isAdmin);
  const producerAssessments = useMemo(
    () =>
      new Map<string, ProducerAssessmentHead>(
        producerAssessmentHeads.map((assessment) => [
          assessment.projectId,
          assessment,
        ]),
      ),
    [producerAssessmentHeads],
  );
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

  const rankableScreenplays = screenplays.filter(
    (screenplay) => screenplay.producerProjection?.rankable !== false,
  );
  const reviewOnlyScreenplays = screenplays.filter(
    (screenplay) => screenplay.producerProjection?.rankable === false,
  );
  const [featured, ...remaining] = rankableScreenplays;
  const topMatches = remaining.slice(0, 4);
  const grid = [...remaining.slice(4), ...reviewOnlyScreenplays];
  const filmNow = rankableScreenplays.filter(
    (screenplay) => screenplay.recommendation === 'film_now',
  );

  return (
    <div className="discovery-root min-h-screen">
      <DiscoverAppHeader
        total={stats.total}
        averageScore={stats.avgWeightedScore}
        filmNowCount={stats.filmNowCount}
        isLoading={isLoading}
      />

      <main className={`px-4 py-5 sm:px-6 lg:px-8 ${hasSelection ? 'pb-56 sm:pb-28' : ''}`}>
        <div className="mx-auto max-w-[1800px]">
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
              ) : screenplays.length === 0 ? (
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
              ) : !featured ? (
                <>
                  <section className="dsc-card border-amber-500/30 p-8 text-center sm:p-10">
                    <p className="dsc-kicker">Review required</p>
                    <h2 className="dsc-display mt-3 text-3xl">
                      These analyses cannot be ranked yet
                    </h2>
                    <p className="mx-auto mt-3 max-w-xl text-[var(--dsc-ink-2)]">
                      Their screenplay evidence or specialist reader panel is incomplete.
                      They remain available below for diagnosis, but Discovery will not
                      promote one as the best script.
                    </p>
                  </section>
                  <section aria-labelledby="discovery-review-only" className="cinema-shelf">
                    <div className="cinema-shelf-head">
                      <h2 id="discovery-review-only">Needs review</h2>
                      <span>{reviewOnlyScreenplays.length} unranked</span>
                    </div>
                    <DiscoverGrid
                      screenplays={reviewOnlyScreenplays}
                      onOpen={handleOpen}
                      producerAssessments={producerAssessments}
                    />
                  </section>
                </>
              ) : (
                <>
                  <DiscoverFeature
                    featured={featured}
                    onOpen={handleOpen}
                    producerAssessments={producerAssessments}
                  />
                  <DiscoverFilmNowShelf
                    screenplays={filmNow}
                    onOpen={handleOpen}
                    producerAssessments={producerAssessments}
                  />
                  <DiscoverRankedShelf
                    screenplays={topMatches}
                    onOpen={handleOpen}
                    producerAssessments={producerAssessments}
                  />

                  <section aria-labelledby="discovery-archive" className="cinema-shelf">
                    <div className="cinema-shelf-head">
                      <h2 id="discovery-archive">Browse the slate</h2>
                      <span>{grid.length} more in this view</span>
                    </div>
                    <DiscoverGrid
                      screenplays={grid}
                      onOpen={handleOpen}
                      producerAssessments={producerAssessments}
                    />
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </main>

      <DiscoverySelectionBar
        screenplays={allScreenplays}
        visibleScreenplays={screenplays}
        escapeEnabled={!selectedScreenplay}
      />

      {selectedScreenplay && (
        <DiscoverDrawer screenplay={selectedScreenplay} onClose={onCloseScreenplay} />
      )}
    </div>
  );
}
