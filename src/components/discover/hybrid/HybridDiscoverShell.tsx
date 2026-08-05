import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DiscoverDrawer } from '@/components/discover/DiscoverDrawer';
import type { DiscoverShellProps } from '@/components/discover/DiscoverShell';
import { DiscoverySelectionBar } from '@/components/discover/DiscoverySelectionBar';
import { HybridCommandRail } from '@/components/discover/hybrid/HybridCommandRail';
import { HybridHeader } from '@/components/discover/hybrid/HybridHeader';
import {
  HybridFeatureStage,
  HybridFilmNowRail,
  HybridSlateGrid,
} from '@/components/discover/hybrid/HybridResults';
import { usePercentiles } from '@/hooks/usePercentiles';
import { useProducerAssessmentHeads } from '@/hooks/useProducerAssessments';
import { useIsAdmin } from '@/stores/authStore';
import { useHasSelection } from '@/stores/selectionStore';
import { useSortStore } from '@/stores/sortStore';
import type { ProducerAssessmentHead, Screenplay, SortField } from '@/types';
import '@/components/discover/hybrid/hybrid-discovery.css';

function HybridLoading() {
  return (
    <div className="hybrid-loading" role="status">
      <div className="hybrid-loading__stage">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="hybrid-loading__heading" />
      <div className="hybrid-loading__grid">
        {Array.from({ length: 10 }).map((_, index) => <span key={index} />)}
      </div>
      <span className="sr-only">Loading Discovery</span>
    </div>
  );
}

function EmptyDiscovery({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <section className="hybrid-empty-state">
      <span aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M5 5h14v14H5zM8 9h8M8 12h5M8 15h6" />
        </svg>
      </span>
      <p className="hybrid-eyebrow">Discovery</p>
      <h1>{title}</h1>
      <p>{message}</p>
      {action && (
        <button type="button" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </section>
  );
}

export function HybridDiscoverShell({
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
}: DiscoverShellProps) {
  const [archivePosition, setArchivePosition] = useState({ signature: '', page: 1 });
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const previousSelectionRef = useRef<Screenplay | null>(selectedScreenplay);
  const isAdmin = useIsAdmin();
  const hasSelection = useHasSelection();
  const activeSort = useSortStore((state) => state.sortConfigs[0]?.field ?? 'weightedScore');
  const percentiles = usePercentiles(allScreenplays);
  const { data: producerAssessmentHeads = [] } = useProducerAssessmentHeads(isAdmin);
  const producerAssessments = useMemo(
    () => new Map<string, ProducerAssessmentHead>(
      producerAssessmentHeads.map((assessment) => [assessment.projectId, assessment]),
    ),
    [producerAssessmentHeads],
  );

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
  const promotedIds = new Set(
    [featured, ...topMatches].filter(Boolean).map((screenplay) => screenplay.id),
  );
  const filmNow = rankableScreenplays.filter(
    (screenplay) =>
      screenplay.recommendation === 'film_now' && !promotedIds.has(screenplay.id),
  );
  const grid = [...remaining.slice(4), ...reviewOnlyScreenplays];
  const archivePageSize = 50;
  const archivePageCount = Math.max(1, Math.ceil(grid.length / archivePageSize));
  const gridSignature = grid.map((screenplay) => screenplay.id).join('|');
  const archivePage = archivePosition.signature === gridSignature
    ? Math.min(archivePosition.page, archivePageCount)
    : 1;
  const visibleGrid = grid.slice(
    (archivePage - 1) * archivePageSize,
    archivePage * archivePageSize,
  );

  return (
    <div className="discovery-root hybrid-discovery min-h-screen">
      <HybridHeader
        screenplays={allScreenplays}
        shortcutsEnabled={!selectedScreenplay}
        onOpenScreenplay={handleOpen}
      />
      <HybridCommandRail
        genres={genres}
        themes={themes}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
      />

      <main className={hasSelection ? 'hybrid-main hybrid-main--selection' : 'hybrid-main'}>
        {isLoading ? (
          <HybridLoading />
        ) : isError ? (
          <EmptyDiscovery
            title="Discovery is temporarily unavailable"
            message="The classic Discovery view remains available while the live slate reconnects."
          />
        ) : totalCount === 0 ? (
          <EmptyDiscovery
            title="No analyzed screenplays yet"
            message="Completed analyses will appear here automatically through the live slate feed."
          />
        ) : screenplays.length === 0 ? (
          <EmptyDiscovery
            title="No screenplays match this view"
            message="Broaden the search or clear the active filters to reopen the full slate."
            action={{ label: 'Clear filters', onClick: onClearFilters }}
          />
        ) : !featured ? (
          <>
            <EmptyDiscovery
              title="These analyses cannot be ranked yet"
              message="Their screenplay evidence or specialist reader panel is incomplete. They remain available for review without being promoted as the strongest project."
            />
            <section className="hybrid-slate-section" aria-labelledby="hybrid-review-title">
              <header className="hybrid-slate-heading">
                <div>
                  <p className="hybrid-eyebrow">Review required</p>
                  <h2 id="hybrid-review-title">Needs review</h2>
                </div>
                <span>{reviewOnlyScreenplays.length} unranked</span>
              </header>
              <HybridSlateGrid
                screenplays={reviewOnlyScreenplays}
                onOpen={handleOpen}
                producerAssessments={producerAssessments}
                percentiles={percentiles}
              />
            </section>
          </>
        ) : (
          <>
            <HybridFeatureStage
              featured={featured}
              topMatches={topMatches}
              sortField={activeSort as SortField}
              onOpen={handleOpen}
              producerAssessments={producerAssessments}
              percentiles={percentiles}
            />

            <HybridFilmNowRail screenplays={filmNow} onOpen={handleOpen} />

            <section className="hybrid-slate-section" aria-labelledby="hybrid-slate-title">
              <header className="hybrid-slate-heading">
                <div>
                  <p className="hybrid-eyebrow">Current view</p>
                  <h2 id="hybrid-slate-title">The slate</h2>
                </div>
                <p aria-live="polite">
                  <strong>Showing {filteredCount} of {totalCount} screenplays</strong>
                  {producedHiddenCount > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        {producedHiddenCount} produced {producedHiddenCount === 1 ? 'film' : 'films'} hidden
                      </span>
                      <button type="button" onClick={onRevealProduced}>
                        Show produced films
                      </button>
                    </>
                  )}
                  {nonScreenplayHiddenCount > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        {nonScreenplayHiddenCount}{' '}
                        {nonScreenplayHiddenCount === 1 ? 'non-screenplay' : 'non-screenplays'} hidden
                      </span>
                      <button type="button" onClick={onRevealNonScreenplays}>
                        Show non-screenplays
                      </button>
                    </>
                  )}
                </p>
              </header>

              <HybridSlateGrid
                screenplays={visibleGrid}
                onOpen={handleOpen}
                producerAssessments={producerAssessments}
                percentiles={percentiles}
                rankOffset={(archivePage - 1) * archivePageSize}
              />

              {archivePageCount > 1 && (
                <nav className="hybrid-pagination" aria-label="Browse the slate pages">
                  <button
                    type="button"
                    onClick={() => setArchivePosition({
                      signature: gridSignature,
                      page: Math.max(1, archivePage - 1),
                    })}
                    disabled={archivePage === 1}
                  >
                    Previous 50
                  </button>
                  <span>Page {archivePage} of {archivePageCount}</span>
                  <button
                    type="button"
                    onClick={() => setArchivePosition({
                      signature: gridSignature,
                      page: Math.min(archivePageCount, archivePage + 1),
                    })}
                    disabled={archivePage === archivePageCount}
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
      />

      {selectedScreenplay && (
        <DiscoverDrawer screenplay={selectedScreenplay} onClose={onCloseScreenplay} />
      )}
    </div>
  );
}
