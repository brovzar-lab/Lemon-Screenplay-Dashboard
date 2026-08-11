import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DiscoverDrawer } from '@/components/discover/DiscoverDrawer';
import type { DiscoverShellProps } from '@/components/discover/DiscoverShell';
import { DiscoveryFavoritesMenu } from '@/components/discover/DiscoveryFavoritesMenu';
import { DiscoverySearch } from '@/components/discover/DiscoverySearch';
import { DiscoverySelectionBar } from '@/components/discover/DiscoverySelectionBar';
import { HybridCommandRail } from '@/components/discover/hybrid/HybridCommandRail';
import { ScreenplayRanking } from '@/components/discover/screenplay/ScreenplayRanking';
import { ScreenplayGrid } from '@/components/discover/screenplay/ScreenplayResults';
import { ScreenplaySlateInsights } from '@/components/discover/screenplay/ScreenplaySlateInsights';
import { ScreenplaySlateStats } from '@/components/discover/screenplay/ScreenplaySlateStats';
import { LensMenu } from '@/components/filters/LensMenu';
import { ApplicationHeader } from '@/components/layout/ApplicationHeader';
import { useFeaturedProject } from '@/hooks/useFeaturedProject';
import { usePercentiles } from '@/hooks/usePercentiles';
import { recordFeaturedEngagement } from '@/lib/featuredProjectSettings';
import { useAuthStore } from '@/stores/authStore';
import {
  useHasSelection,
  useSelectionCount,
  useSelectionStore,
} from '@/stores/selectionStore';
import type { Screenplay } from '@/types';
import '@/components/discover/hybrid/hybrid-discovery.css';
import '@/components/discover/screenplay/screenplay-discovery.css';

const PAGE_SIZE = 50;

function ScreenplayState({
  title,
  message,
  action,
  loading = false,
}: {
  title: string;
  message: string;
  action?: () => void;
  loading?: boolean;
}) {
  return (
    <section className="screenplay-state" role={loading ? 'status' : undefined}>
      <p className="screenplay-ui-eyebrow">The slate</p>
      <h1>{title}</h1>
      <p>{message}</p>
      {action && (
        <button type="button" onClick={action}>
          Clear filters
        </button>
      )}
      {loading && (
        <div className="screenplay-state__skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      )}
    </section>
  );
}

export function ScreenplayDiscoverShell(props: DiscoverShellProps) {
  const {
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
    selectedScreenplay,
    onOpenScreenplay,
    onCloseScreenplay,
    isLoading,
    isError,
    producerAssessments = new Map(),
    producerLookIds,
    producerLookCount,
    producerLookActive,
    onToggleProducerLook,
  } = props;
  const [archivePosition, setArchivePosition] = useState({ signature: '', page: 1 });
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const previousSelectionRef = useRef<Screenplay | null>(selectedScreenplay);
  const [selectionMode, setSelectionMode] = useState(false);
  const hasSelection = useHasSelection();
  const selectionCount = useSelectionCount();
  const deselectAll = useSelectionStore((state) => state.deselectAll);
  const authProfile = useAuthStore((state) => state.profile);
  const percentiles = usePercentiles(allScreenplays);
  const featured = useFeaturedProject(allScreenplays, producerLookIds);
  const featuredId = featured.screenplay?.id;
  const featuredRank = useMemo(() => {
    if (!featured.screenplay) return 1;
    return (
      [...allScreenplays]
        .sort(
          (a, b) =>
            (b.producerProjection?.finalScore ?? b.weightedScore) -
              (a.producerProjection?.finalScore ?? a.weightedScore) ||
            a.title.localeCompare(b.title),
        )
        .findIndex((item) => item.id === featured.screenplay?.id) + 1
    );
  }, [allScreenplays, featured.screenplay]);
  const wall = useMemo(
    () =>
      screenplays
        .map((screenplay, index) => ({ screenplay, rank: index + 1 }))
        .filter((entry) => entry.screenplay.id !== featuredId),
    [featuredId, screenplays],
  );
  const signature = useMemo(
    () => wall.map((entry) => entry.screenplay.id).join('|'),
    [wall],
  );
  const pageCount = Math.max(1, Math.ceil(wall.length / PAGE_SIZE));
  const safePage =
    archivePosition.signature === signature ? Math.min(archivePosition.page, pageCount) : 1;
  const visibleEntries = wall.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const exitSelectionMode = useCallback(() => {
    deselectAll();
    setSelectionMode(false);
  }, [deselectAll]);

  useEffect(() => () => deselectAll(), [deselectAll]);

  const toggleSelectionMode = useCallback(() => {
    if (selectionMode) exitSelectionMode();
    else setSelectionMode(true);
  }, [exitSelectionMode, selectionMode]);

  const handleOpen = useCallback(
    (screenplay: Screenplay, trigger: HTMLButtonElement) => {
      returnFocusRef.current = trigger;
      const id = screenplay.projectId ?? screenplay.id;
      if (
        id === (featured.screenplay?.projectId ?? featured.screenplay?.id) &&
        authProfile?.role === 'admin'
      ) {
        recordFeaturedEngagement(id, { uid: authProfile.uid, role: authProfile.role });
      }
      onOpenScreenplay(screenplay);
    },
    [authProfile, featured.screenplay, onOpenScreenplay],
  );

  useEffect(() => {
    if (previousSelectionRef.current && !selectedScreenplay) {
      const target = returnFocusRef.current;
      window.requestAnimationFrame(() => target?.isConnected && target.focus());
    }
    previousSelectionRef.current = selectedScreenplay;
  }, [selectedScreenplay]);

  return (
    <div
      className={`discovery-root hybrid-discovery screenplay-discovery min-h-screen ${
        selectionMode ? 'discovery-root--selection-mode' : ''
      }`}
    >
      <ApplicationHeader />
      <section className="screenplay-discovery__findbar" aria-label="Discovery tools">
        <div className="screenplay-discovery__findbar-inner">
          <DiscoverySearch
            id="screenplay-discovery-search"
            className="screenplay-discovery__search"
            shortcutsEnabled={!selectedScreenplay}
          />
          <div className="screenplay-discovery__find-actions">
            <LensMenu presentation="discovery" triggerLabel="Saved Views" />
            <DiscoveryFavoritesMenu screenplays={allScreenplays} onOpen={handleOpen} />
          </div>
        </div>
      </section>
      <ScreenplaySlateStats
        screenplays={screenplays}
        totalCount={totalCount}
        producerLookCount={producerLookCount ?? 0}
        loading={isLoading}
      />
      <HybridCommandRail
        genres={genres}
        themes={themes}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        producerLookCount={producerLookCount}
        producerLookActive={producerLookActive}
        onToggleProducerLook={onToggleProducerLook}
        allScreenplays={allScreenplays}
        selectionMode={selectionMode}
        selectionCount={selectionCount}
        onToggleSelectionMode={toggleSelectionMode}
      />
      <main
        className={
          selectionMode && hasSelection
            ? 'screenplay-discovery__main screenplay-discovery__main--selection'
            : 'screenplay-discovery__main'
        }
      >
        {isLoading ? (
          <ScreenplayState
            loading
            title="Opening the development slate"
            message="Loading the latest screenplay decisions and evidence."
          />
        ) : isError ? (
          <ScreenplayState
            title="Discovery is temporarily unavailable"
            message="Classic Discovery remains available at ?ui=classic while the live slate reconnects."
          />
        ) : totalCount === 0 ? (
          <ScreenplayState
            title="No analyzed screenplays yet"
            message="Completed analyses will appear here automatically."
          />
        ) : screenplays.length === 0 ? (
          <ScreenplayState
            title="No screenplays match this view"
            message="Broaden the search or clear the active filters."
            action={onClearFilters}
          />
        ) : (
          <>
            <ScreenplaySlateInsights screenplays={screenplays} allScreenplays={allScreenplays} />
            {featured.screenplay && (
              <ScreenplayRanking
                screenplay={featured.screenplay}
                rank={featuredRank}
                reason={featured.reason}
                outsideCurrentView={!screenplays.some((item) => item.id === featured.screenplay?.id)}
                percentiles={percentiles}
                producerAssessments={producerAssessments}
                producerLookIds={producerLookIds}
                onOpen={handleOpen}
              />
            )}
            <section className="screenplay-slate" aria-labelledby="screenplay-slate-title">
              <header className="screenplay-slate__heading">
                <div>
                  <p className="screenplay-ui-eyebrow">Searchable archive</p>
                  <h2 id="screenplay-slate-title">
                    Continue through the slate
                  </h2>
                </div>
                <p aria-live="polite">
                  <strong>
                    Showing {filteredCount} of {totalCount} screenplays
                  </strong>
                  {producedHiddenCount > 0 && (
                    <>
                      <span> · {producedHiddenCount} produced hidden</span>
                      <button type="button" onClick={onRevealProduced}>
                        Show produced films
                      </button>
                    </>
                  )}
                  {nonScreenplayHiddenCount > 0 && (
                    <>
                      <span> · {nonScreenplayHiddenCount} non-screenplays hidden</span>
                      <button type="button" onClick={onRevealNonScreenplays}>
                        Show non-screenplays
                      </button>
                    </>
                  )}
                </p>
              </header>
              <ScreenplayGrid
                entries={visibleEntries}
                percentiles={percentiles}
                producerAssessments={producerAssessments}
                producerLookIds={producerLookIds}
                onOpen={handleOpen}
              />
              {pageCount > 1 && (
                <nav className="screenplay-pagination" aria-label="Browse slate pages">
                  <button
                    type="button"
                    disabled={safePage === 1}
                    onClick={() =>
                      setArchivePosition({ signature, page: Math.max(1, safePage - 1) })
                    }
                  >
                    Previous 50
                  </button>
                  <span>
                    Page {safePage} of {pageCount}
                  </span>
                  <button
                    type="button"
                    disabled={safePage === pageCount}
                    onClick={() =>
                      setArchivePosition({ signature, page: Math.min(pageCount, safePage + 1) })
                    }
                  >
                    Next 50
                  </button>
                </nav>
              )}
            </section>
          </>
        )}
      </main>
      <DiscoverySelectionBar
        screenplays={allScreenplays}
        visibleScreenplays={screenplays}
        escapeEnabled={!selectedScreenplay}
        selectionMode={selectionMode}
        onExitSelectionMode={exitSelectionMode}
      />
      {selectedScreenplay && (
        <DiscoverDrawer screenplay={selectedScreenplay} onClose={onCloseScreenplay} />
      )}
    </div>
  );
}
