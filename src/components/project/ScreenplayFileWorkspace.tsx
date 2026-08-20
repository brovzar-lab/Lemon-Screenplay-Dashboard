import { useEffect, useMemo, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { clsx } from 'clsx';
import { DiscoveryExportActions } from '@/components/discover/DiscoveryExportActions';
import { DiscoveryShareStatus } from '@/components/discover/DiscoveryShareStatus';
import { BlueSpineScript } from '@/components/discover/screenplay/BlueSpineScript';
import { PosterControls } from '@/components/project/PosterControls';
import { ApplicationHeader } from '@/components/layout/ApplicationHeader';
import { ReaderRoom } from '@/components/project/ReaderRoom';
import { AnalysisTrustBadge } from '@/components/screenplay/AnalysisTrustBadge';
import { ProducerScoreBadge } from '@/components/screenplay/ProducerScoreBadge';
import {
  AnalysisWarnings,
  ContentDetails,
  NotesSection,
  ProducerTake,
  ScoresPanel,
  ShareButton,
} from '@/components/screenplay/modal';
import { ScreenplayPdfButton } from '@/components/screenplay/modal/ScreenplayPdfButton';
import { useProducerAssessmentHeads } from '@/hooks/useProducerAssessments';
import {
  formatAnalysisVersion,
  formatProducerTaxonomy,
  formatProducerText,
} from '@/lib/producerDisplay';
import { evaluateDevelopmentOpportunity } from '@/lib/developmentOpportunity';
import { getScreenplayDisplayAuthor, getScreenplayDisplayTitle } from '@/lib/screenplayDisplay';
import { useIsAdmin } from '@/stores/authStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import type { ProducerAssessmentHead, Screenplay } from '@/types';
import '@/components/project/screenplay-file.css';
import { useTranslation } from 'react-i18next';

export type ScreenplayFileTab =
  | 'overview'
  | 'scores'
  | 'reader-room'
  | 'story-x-ray'
  | 'poster'
  | 'producer-take'
  | 'notes-files';

interface ScreenplayFileWorkspaceProps {
  screenplay: Screenplay;
  activeTab: ScreenplayFileTab;
  onSelectTab: (tab: ScreenplayFileTab) => void;
  onBack: () => void;
}

const TABS: Array<{ key: ScreenplayFileTab; label: string; adminOnly?: boolean }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'scores', label: 'Scores' },
  { key: 'reader-room', label: 'Reader Room' },
  { key: 'story-x-ray', label: 'Story X-Ray' },
  { key: 'poster', label: 'Poster' },
  { key: 'producer-take', label: 'Producer Take', adminOnly: true },
  { key: 'notes-files', label: 'Notes' },
];

const TAB_INTROS: Record<
  Exclude<ScreenplayFileTab, 'reader-room'>,
  { title: string; description: string }
> = {
  overview: {
    title: 'Overview',
    description: 'The decision, the strongest signals, and the evidence that needs attention.',
  },
  scores: {
    title: 'Scores',
    description: 'The five reader pillars, score lineage, and commercial viability evidence.',
  },
  'story-x-ray': {
    title: 'Story X-Ray',
    description: 'Characters, comparable films, standout scenes, and development priorities.',
  },
  poster: {
    title: 'Poster',
    description: 'View the project artwork or create a new poster for this screenplay.',
  },
  'producer-take': {
    title: 'Producer Take',
    description: 'Record your judgment beside the analysis without changing the original score.',
  },
  'notes-files': {
    title: 'Notes',
    description: 'Private working notes for this project.',
  },
};

function exactAssessment(
  assessments: ProducerAssessmentHead[],
  screenplay: Screenplay,
): ProducerAssessmentHead | undefined {
  const projectId = screenplay.projectId ?? screenplay.id;
  return assessments.find(
    (assessment) =>
      assessment.projectId === projectId && assessment.versionId === screenplay.latestVersionId,
  );
}

function trustLabel(screenplay: Screenplay): string {
  if (screenplay.producerProjection?.trustStatus === 'verified') return 'Verified';
  if (screenplay.producerProjection?.trustStatus === 'incomplete') return 'Needs review';
  if (screenplay.producerProjection?.trustStatus === 'legacy_unverified') return 'Legacy evidence';
  return screenplay.analysisQuality?.status === 'complete' ? 'Complete' : 'Unknown';
}

function recommendationLabel(screenplay: Screenplay): string {
  if (screenplay.recommendation === 'film_now') return 'FILM NOW';
  return screenplay.recommendation.toUpperCase();
}

function recommendationTitle(screenplay: Screenplay): string {
  if (screenplay.recommendation === 'film_now') return 'Film Now';
  return screenplay.recommendation.charAt(0).toUpperCase() + screenplay.recommendation.slice(1);
}

function finalScore(screenplay: Screenplay): number {
  return screenplay.producerProjection?.finalScore ?? screenplay.weightedScore;
}

function EvidenceRail({
  screenplay,
  hasProducerTake,
  producerTakeVisible,
}: {
  screenplay: Screenplay;
  hasProducerTake: boolean;
  producerTakeVisible: boolean;
}) {
  const { t } = useTranslation();
  const quality = screenplay.analysisQuality;
  return (
    <aside className="screenplay-file__evidence" aria-label={t('Decision evidence')}>
      <p className="screenplay-file__micro">{t('Decision evidence')}</p>
      <dl>
        <div>
          <dt>{t('Trust status')}</dt>
          <dd>{t(trustLabel(screenplay))}</dd>
        </div>
        <div>
          <dt>{t('Reader panel')}</dt>
          <dd>
            {quality
              ? t('{{complete}}/{{expected}} complete', {
                  complete: quality.completedReaders,
                  expected: quality.expectedReaders,
                })
              : t('Legacy record')}
          </dd>
        </div>
        <div>
          <dt>{t('Reader alignment')}</dt>
          <dd>
            {screenplay.producerProjection
              ? t('{{count}} disagreement', {
                  count: screenplay.producerProjection.readerDisagreementCount,
                })
              : t('Not recorded')}
          </dd>
        </div>
        {producerTakeVisible && (
          <div>
            <dt>{t('Producer take')}</dt>
            <dd>{hasProducerTake ? t('Submitted') : t('Not yet submitted')}</dd>
          </div>
        )}
        <div>
          <dt>{t('Analysis version')}</dt>
          <dd>{formatAnalysisVersion(screenplay.analysisVersion)}</dd>
        </div>
        <div>
          <dt>{t('Project versions')}</dt>
          <dd>
            {screenplay.versionCount && screenplay.versionCount > 1
              ? t('{{count}} stored', { count: screenplay.versionCount })
              : t('Current version')}
          </dd>
        </div>
      </dl>
    </aside>
  );
}

function PanelIntro({ tab }: { tab: Exclude<ScreenplayFileTab, 'reader-room'> }) {
  const { t } = useTranslation();
  const intro = TAB_INTROS[tab];
  return (
    <header className="screenplay-file__panel-intro">
      <p className="screenplay-file__micro screenplay-file__micro--blue">{t('Project section')}</p>
      <h2 id={`screenplay-file-section-${tab}`}>{t(intro.title)}</h2>
      <p>{t(intro.description)}</p>
    </header>
  );
}

function PosterPanel({ screenplay }: { screenplay: Screenplay }) {
  const { t } = useTranslation();
  const title = getScreenplayDisplayTitle(screenplay.title).title;
  const posterUrl =
    screenplay.recommendation === 'pass' ? '/pass-poster-gallery-drape.jpg' : screenplay.posterUrl;

  return (
    <section className="screenplay-file__poster-panel" aria-label={t('Project poster')}>
      <div className="screenplay-file__poster-frame">
        {posterUrl ? (
          <img
            src={posterUrl}
            loading="lazy"
            decoding="async"
            alt={
              screenplay.recommendation === 'pass'
                ? t('Poster withheld for a Pass verdict')
                : t('{{title}} poster', { title })
            }
          />
        ) : (
          <div role="img" aria-label={t('No poster has been generated for {{title}}', { title })}>
            <span>{t('Poster not generated yet')}</span>
          </div>
        )}
      </div>
      <div className="screenplay-file__poster-workbench">
        <p className="screenplay-file__micro screenplay-file__micro--blue">
          {t('Poster artwork')}
        </p>
        <h3>
          {screenplay.recommendation === 'pass'
            ? t('Archived for a Pass verdict')
            : posterUrl
              ? t('Current project poster')
              : t('Create the first poster')}
        </h3>
        <p>
          {screenplay.recommendation === 'pass'
            ? t('Pass projects keep the screenplay cover and use the archive cloth here.')
            : t('Poster art stays separate from the screenplay cover shown in Discovery.')}
        </p>
        <PosterControls screenplay={screenplay} />
      </div>
    </section>
  );
}

function Overview({
  screenplay,
  producerAssessment,
  producerTakeVisible,
}: {
  screenplay: Screenplay;
  producerAssessment?: ProducerAssessmentHead;
  producerTakeVisible: boolean;
}) {
  const { t } = useTranslation();
  const strengths = screenplay.strengths.slice(0, 3);
  const watchPoints = [...screenplay.majorWeaknesses, ...screenplay.weaknesses].slice(0, 2);
  const executiveRead =
    screenplay.verdictStatement ||
    screenplay.recommendationRationale ||
    t('The stored analysis does not yet include an executive verdict.');
  const opportunity = evaluateDevelopmentOpportunity(screenplay, producerAssessment);
  return (
    <div className="screenplay-file__overview-grid">
      <article className="screenplay-file__read">
        <AnalysisWarnings screenplay={screenplay} />
        {opportunity.requiresProducerLook && (
          <section
            className="screenplay-file__opportunity"
            aria-labelledby="screenplay-file-opportunity-heading"
          >
            <div>
              <p className="screenplay-file__micro">{t('Development opportunity')}</p>
              <h3 id="screenplay-file-opportunity-heading">{t('Producer Look')}</h3>
              <p>{formatProducerText(opportunity.rationale)}</p>
            </div>
            <dl>
              <div>
                <dt>{t('Strongest upside')}</dt>
                <dd>{opportunity.evidence[0]?.label ?? t('Development upside')}</dd>
              </div>
              <div>
                <dt>{t('Fixability')}</dt>
                <dd>
                  {opportunity.fixability === 'unknown'
                    ? t('Needs producer judgment')
                    : formatProducerTaxonomy(opportunity.fixability)}
                </dd>
              </div>
              <div>
                <dt>{t('Decision status')}</dt>
                <dd>
                  {finalScore(screenplay).toFixed(1)} · {recommendationTitle(screenplay)} preserved
                </dd>
              </div>
            </dl>
          </section>
        )}
        <section
          className="screenplay-file__decision-brief"
          aria-labelledby="screenplay-file-decision-heading"
        >
          <p className="screenplay-file__micro screenplay-file__micro--blue">
            {t('Executive read')}
          </p>
          <h3 id="screenplay-file-decision-heading">
            {t('Why this landed at {{verdict}}', {
              verdict: t(recommendationLabel(screenplay)),
            })}
          </h3>
          <p className="screenplay-file__executive-copy">{formatProducerText(executiveRead)}</p>
        </section>
        <div className="screenplay-file__signals">
          <section>
            <h3>{t('Strongest signals')}</h3>
            <ul>
              {strengths.length ? (
                strengths.map((item) => (
                  <li key={item}>
                    <span>✓</span>
                    {formatProducerText(item)}
                  </li>
                ))
              ) : (
                <li>{t('No strengths were recorded.')}</li>
              )}
            </ul>
          </section>
          <section>
            <h3>{t('Watch points')}</h3>
            <ul>
              {watchPoints.length ? (
                watchPoints.map((item) => (
                  <li key={item}>
                    <span>△</span>
                    {formatProducerText(item)}
                  </li>
                ))
              ) : (
                <li>{t('No watch points were recorded.')}</li>
              )}
            </ul>
          </section>
        </div>
        {screenplay.developmentNotes.length > 0 && (
          <section className="screenplay-file__priority">
            <h3>{t('Development priority')}</h3>
            <p>{formatProducerText(screenplay.developmentNotes[0])}</p>
          </section>
        )}
      </article>
      <EvidenceRail
        screenplay={screenplay}
        hasProducerTake={Boolean(producerAssessment)}
        producerTakeVisible={producerTakeVisible}
      />
    </div>
  );
}

export function ScreenplayFileWorkspace({
  screenplay,
  activeTab,
  onSelectTab,
  onBack,
}: ScreenplayFileWorkspaceProps) {
  const { t } = useTranslation();
  const displayTitle = getScreenplayDisplayTitle(screenplay.title).title;
  const displayAuthor = getScreenplayDisplayAuthor(screenplay.author);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousProjectRef = useRef<string | null>(null);
  const isAdmin = useIsAdmin();
  const quickFavorites = useFavoritesStore((state) => state.quickFavorites);
  const toggleQuickFavorite = useFavoritesStore((state) => state.toggleQuickFavorite);
  const isFavorite = quickFavorites.includes(screenplay.id);
  const { data: assessmentHeads = [] } = useProducerAssessmentHeads(isAdmin);
  const producerAssessment = useMemo(
    () => exactAssessment(assessmentHeads, screenplay),
    [assessmentHeads, screenplay],
  );

  useEffect(() => {
    const projectChanged = previousProjectRef.current !== screenplay.id;
    previousProjectRef.current = screenplay.id;

    if (projectChanged) {
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
    }
  }, [screenplay.id]);

  useEffect(() => {
    panelRef.current?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
  }, [activeTab]);

  useEffect(() => {
    if (!isAdmin && activeTab === 'producer-take') onSelectTab('overview');
  }, [activeTab, isAdmin, onSelectTab]);

  const renderPanel = () => {
    if (activeTab === 'scores')
      return (
        <ScoresPanel
          screenplay={screenplay}
          presentation="workspace"
          onOpenReaderRoom={() => onSelectTab('reader-room')}
        />
      );
    if (activeTab === 'reader-room') return <ReaderRoom screenplay={screenplay} />;
    if (activeTab === 'story-x-ray')
      return <ContentDetails screenplay={screenplay} presentation="workspace" />;
    if (activeTab === 'poster') return <PosterPanel screenplay={screenplay} />;
    if (activeTab === 'producer-take')
      return isAdmin ? <ProducerTake screenplay={screenplay} /> : null;
    if (activeTab === 'notes-files')
      return (
        <div className="screenplay-file__notes">
          <p className="screenplay-file__notes-scope">
            {t('These notes stay on this browser and are not shared with the team.')}
          </p>
          <NotesSection
            screenplayId={screenplay.projectId ?? screenplay.id}
            presentation="workspace"
          />
        </div>
      );
    return (
      <Overview
        screenplay={screenplay}
        producerAssessment={producerAssessment}
        producerTakeVisible={isAdmin}
      />
    );
  };

  const panelLabelledBy =
    activeTab === 'reader-room'
      ? 'screenplay-file-tab-reader-room'
      : `screenplay-file-tab-${activeTab}`;

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [],
    );
    const currentIndex = tabs.indexOf(event.currentTarget);
    if (currentIndex < 0) return;
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : event.key === 'ArrowRight'
            ? (currentIndex + 1) % tabs.length
            : (currentIndex - 1 + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    const nextKey = nextTab?.dataset.tabKey as ScreenplayFileTab | undefined;
    if (!nextTab || !nextKey) return;
    event.preventDefault();
    nextTab.focus();
    onSelectTab(nextKey);
  }

  return (
    <div className="discovery-root screenplay-file" data-testid="screenplay-file-workspace">
      <ApplicationHeader />
      <div className="screenplay-file__context">
        <nav className="screenplay-file__context-inner" aria-label={t('Breadcrumb')}>
          <button type="button" onClick={onBack} aria-label={t('Back to slate')}>
            ← {t('Screenplays')}
          </button>
          <span aria-hidden="true">/</span>
          <strong aria-current="page">{displayTitle}</strong>
        </nav>
      </div>

      <section className="screenplay-file__hero">
        <div className="screenplay-file__poster-column">
          <BlueSpineScript screenplay={screenplay} featured />
        </div>
        <div className="screenplay-file__identity">
          <p className="screenplay-file__micro screenplay-file__micro--blue">
            {t('Screenplay file')}
          </p>
          <h1>{displayTitle}</h1>
          <p className="screenplay-file__meta">
            {[
              formatProducerTaxonomy(screenplay.genre),
              displayAuthor,
              screenplay.metadata.pageCount
                ? t('{{count}} pages', { count: screenplay.metadata.pageCount })
                : undefined,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {screenplay.logline && (
            <p className="screenplay-file__logline">{formatProducerText(screenplay.logline)}</p>
          )}
          <div className="screenplay-file__status">
            <AnalysisTrustBadge screenplay={screenplay} />
            <DiscoveryShareStatus screenplay={screenplay} />
            <ProducerScoreBadge assessment={producerAssessment} />
          </div>
          <div className="screenplay-file__actions">
            <ScreenplayPdfButton
              screenplay={screenplay}
              presentation="workspace"
              allowReupload={false}
            />
            <ShareButton screenplay={screenplay} waitForExistingLink presentation="discovery" />
            <DiscoveryExportActions screenplay={screenplay} />
            <button
              type="button"
              onClick={() => toggleQuickFavorite(screenplay.id)}
              aria-pressed={isFavorite}
            >
              {isFavorite ? `★ ${t('Favorited')}` : `☆ ${t('Favorite')}`}
            </button>
          </div>
        </div>
        <div className="screenplay-file__hero-score" data-verdict={screenplay.recommendation}>
          <span>{t('AI verdict')}</span>
          <strong>{finalScore(screenplay).toFixed(1)}</strong>
          <b>{t(recommendationLabel(screenplay))}</b>
        </div>
      </section>

      <main className="screenplay-file__main">
        <div className="screenplay-file__binder">
          <div className="screenplay-file__toolbar">
            <nav aria-label={t('Screenplay file sections')} role="tablist">
              {TABS.filter((tab) => !tab.adminOnly || isAdmin).map((tab) => (
                <button
                  key={tab.key}
                  id={`screenplay-file-tab-${tab.key}`}
                  data-tab-key={tab.key}
                  type="button"
                  role="tab"
                  tabIndex={activeTab === tab.key ? 0 : -1}
                  onClick={() => onSelectTab(tab.key)}
                  onKeyDown={handleTabKeyDown}
                  aria-selected={activeTab === tab.key}
                  aria-controls="screenplay-file-panel"
                  className={clsx(activeTab === tab.key && 'is-active')}
                >
                  {t(tab.label)}
                </button>
              ))}
            </nav>
          </div>
          <div
            ref={panelRef}
            id="screenplay-file-panel"
            tabIndex={-1}
            role="tabpanel"
            aria-labelledby={panelLabelledBy}
            className={clsx('screenplay-file__panel', `screenplay-file__section--${activeTab}`)}
            data-testid={`screenplay-file-tab-${activeTab}`}
          >
            {activeTab !== 'reader-room' && <PanelIntro tab={activeTab} />}
            {renderPanel()}
          </div>
        </div>
      </main>
    </div>
  );
}
