import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DiscoverDrawer } from '@/components/discover/DiscoverDrawer';
import type { DiscoverShellProps } from '@/components/discover/DiscoverShell';
import { DiscoverySelectionBar } from '@/components/discover/DiscoverySelectionBar';
import { HybridCommandRail } from '@/components/discover/hybrid/HybridCommandRail';
import { HybridHeader } from '@/components/discover/hybrid/HybridHeader';
import {
  ScreenplayFeature,
  ScreenplayGrid,
} from '@/components/discover/screenplay/ScreenplayResults';
import { usePercentiles } from '@/hooks/usePercentiles';
import { useHasSelection } from '@/stores/selectionStore';
import { useSortStore } from '@/stores/sortStore';
import type { Screenplay, SortField } from '@/types';
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
  const hasSelection = useHasSelection();
  const activeSort = useSortStore(
    (state) => state.sortConfigs[0]?.field ?? 'weightedScore',
  ) as SortField;
  const percentiles = usePercentiles(allScreenplays);
  const signature = useMemo(
    () => screenplays.map((screenplay) => screenplay.id).join('|'),
    [screenplays],
  );
  const pageCount = Math.max(1, Math.ceil(screenplays.length / PAGE_SIZE));
  const safePage =
    archivePosition.signature === signature ? Math.min(archivePosition.page, pageCount) : 1;
  const visibleScreenplays = screenplays.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const featured =
    screenplays.find((screenplay) => screenplay.producerProjection?.rankable !== false) ??
    screenplays[0];

  const handleOpen = useCallback(
    (screenplay: Screenplay, trigger: HTMLButtonElement) => {
      returnFocusRef.current = trigger;
      onOpenScreenplay(screenplay);
    },
    [onOpenScreenplay],
  );

  useEffect(() => {
    if (previousSelectionRef.current && !selectedScreenplay) {
      const target = returnFocusRef.current;
      window.requestAnimationFrame(() => target?.isConnected && target.focus());
    }
    previousSelectionRef.current = selectedScreenplay;
  }, [selectedScreenplay]);

  return (
    <div className="discovery-root hybrid-discovery screenplay-discovery min-h-screen">
      <HybridHeader
        screenplays={allScreenplays}
        shortcutsEnabled={!selectedScreenplay}
        onOpenScreenplay={handleOpen}
        presentation="screenplay"
      />
      <HybridCommandRail
        genres={genres}
        themes={themes}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        producerLookCount={producerLookCount}
        producerLookActive={producerLookActive}
        onToggleProducerLook={onToggleProducerLook}
      />
      <main
        className={
          hasSelection
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
            {featured && (
              <ScreenplayFeature
                screenplay={featured}
                sortField={activeSort}
                percentiles={percentiles}
                producerAssessment={producerAssessments.get(featured.projectId ?? featured.id)}
                producerLookIds={producerLookIds}
                onOpen={handleOpen}
              />
            )}
            <section className="screenplay-slate" aria-labelledby="screenplay-slate-title">
              <header className="screenplay-slate__heading">
                <div>
                  <p className="screenplay-ui-eyebrow">Searchable archive</p>
                  <h2 id="screenplay-slate-title">The complete slate</h2>
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
                screenplays={visibleScreenplays}
                rankOffset={(safePage - 1) * PAGE_SIZE}
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
      />
      {selectedScreenplay && (
        <DiscoverDrawer screenplay={selectedScreenplay} onClose={onCloseScreenplay} />
      )}
    </div>
  );
}
