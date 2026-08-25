import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 50;

function ScreenplayState({
  title,
  message,
  action,
  actionLabel = 'Clear filters',
  loading = false,
}: {
  title: string;
  message: string;
  action?: () => void;
  actionLabel?: string;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section className="screenplay-state" role={loading ? 'status' : undefined}>
      <p className="screenplay-ui-eyebrow">{t('The slate')}</p>
      <h1>{title}</h1>
      <p>{message}</p>
      {action && (
        <button type="button" onClick={action}>
          {t(actionLabel)}
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
  const { t } = useTranslation();
  const navigate = useNavigate();
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
      <section className="screenplay-discovery__findbar" aria-label={t('Discovery tools')}>
        <div className="screenplay-discovery__findbar-inner">
          <DiscoverySearch
            id="screenplay-discovery-search"
            className="screenplay-discovery__search"
            shortcutsEnabled={!selectedScreenplay}
          />
          <div className="screenplay-discovery__find-actions">
            <LensMenu presentation="discovery" triggerLabel={t('Saved Views')} />
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
            title={t('Opening the development slate')}
            message={t('Loading the latest screenplay decisions and evidence.')}
          />
        ) : isError ? (
          <ScreenplayState
            title={t('Discovery is temporarily unavailable')}
            message={t('Please try again shortly.')}
          />
        ) : totalCount === 0 ? (
          <ScreenplayState
            title={t('No analyzed screenplays yet')}
            message={t('Completed analyses will appear here automatically.')}
            action={
              authProfile?.role === 'admin'
                ? () => navigate('/settings?tab=intake')
                : undefined
            }
            actionLabel="Upload Screenplays"
          />
        ) : screenplays.length === 0 ? (
          <ScreenplayState
            title={t('No screenplays match this view')}
            message={t('Broaden the search or clear the active filters.')}
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
                producerAssessments={producerAssessments}
                producerLookIds={producerLookIds}
                onOpen={handleOpen}
              />
            )}
            <section className="screenplay-slate" aria-labelledby="screenplay-slate-title">
              <header className="screenplay-slate__heading">
                <div>
                  <p className="screenplay-ui-eyebrow">{t('Searchable archive')}</p>
                  <h2 id="screenplay-slate-title">
                    {t('Continue through the slate')}
                  </h2>
                </div>
                <p aria-live="polite">
                  <strong>
                    {t('Showing {{filtered}} of {{total}} screenplays', {
                      filtered: filteredCount,
                      total: totalCount,
                    })}
                  </strong>
                  {producedHiddenCount > 0 && (
                    <>
                      <span> · {t('{{count}} produced hidden', { count: producedHiddenCount })}</span>
                      <button type="button" onClick={onRevealProduced}>
                        {t('Show produced films')}
                      </button>
                    </>
                  )}
                  {nonScreenplayHiddenCount > 0 && (
                    <>
                      <span>
                        {' · '}
                        {t('{{count}} non-screenplays hidden', {
                          count: nonScreenplayHiddenCount,
                        })}
                      </span>
                      <button type="button" onClick={onRevealNonScreenplays}>
                        {t('Show non-screenplays')}
                      </button>
                    </>
                  )}
                </p>
              </header>
              <ScreenplayGrid
                entries={visibleEntries}
                producerAssessments={producerAssessments}
                producerLookIds={producerLookIds}
                onOpen={handleOpen}
              />
              {pageCount > 1 && (
                <nav className="screenplay-pagination" aria-label={t('Browse slate pages')}>
                  <button
                    type="button"
                    disabled={safePage === 1}
                    onClick={() =>
                      setArchivePosition({ signature, page: Math.max(1, safePage - 1) })
                    }
                  >
                    {t('Previous 50')}
                  </button>
                  <span>
                    {t('Page {{page}} of {{count}}', { page: safePage, count: pageCount })}
                  </span>
                  <button
                    type="button"
                    disabled={safePage === pageCount}
                    onClick={() =>
                      setArchivePosition({ signature, page: Math.min(pageCount, safePage + 1) })
                    }
                  >
                    {t('Next 50')}
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
