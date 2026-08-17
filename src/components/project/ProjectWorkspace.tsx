import { useEffect, useMemo, useRef } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

import { DiscoverAppHeader } from '@/components/discover/DiscoverAppHeader';
import { DiscoveryExportActions } from '@/components/discover/DiscoveryExportActions';
import { DiscoveryShareStatus } from '@/components/discover/DiscoveryShareStatus';
import { ScriptCover } from '@/components/discover/ScriptCover';
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
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { useProducerAssessmentHeads } from '@/hooks/useProducerAssessments';
import {
  getScreenplayDisplayAuthor,
  getScreenplayDisplayGenre,
  getScreenplayDisplayTitle,
} from '@/lib/screenplayDisplay';
import { useIsAdmin } from '@/stores/authStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import type { ProducerAssessmentHead, Screenplay } from '@/types';

export type ProjectWorkspaceTab =
  | 'overview'
  | 'reader-room'
  | 'story-x-ray'
  | 'producer-take'
  | 'notes-files';

export interface ProjectWorkspaceStats {
  total: number;
  avgWeightedScore: number;
  filmNowCount: number;
}

interface ProjectWorkspaceProps {
  screenplay: Screenplay;
  stats: ProjectWorkspaceStats;
  activeTab: ProjectWorkspaceTab;
  onSelectTab: (tab: ProjectWorkspaceTab) => void;
  onBack: () => void;
}

const TABS: Array<{ key: ProjectWorkspaceTab; label: string; adminOnly?: boolean }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'reader-room', label: 'Reader Room' },
  { key: 'story-x-ray', label: 'Story X-Ray' },
  { key: 'producer-take', label: 'Producer Take', adminOnly: true },
  { key: 'notes-files', label: 'Notes & Files' },
];

function exactProducerAssessment(
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
  switch (screenplay.producerProjection?.trustStatus) {
    case 'verified':
      return 'Verified analysis';
    case 'incomplete':
      return 'Decision blocked';
    case 'legacy_unverified':
      return 'Legacy evidence';
    default:
      return screenplay.analysisQuality?.status === 'complete'
        ? 'Complete analysis'
        : 'Evidence status unknown';
  }
}

function ExecutiveRead({ screenplay }: { screenplay: Screenplay }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <AnalysisWarnings screenplay={screenplay} />
      <section aria-labelledby="project-executive-read-title">
        <p className="dsc-kicker">{t('The decision brief')}</p>
        <h2 id="project-executive-read-title" className="dsc-display mt-2 text-4xl sm:text-5xl">
          {t('Executive read')}
        </h2>
        <div className="mt-7 grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
          <div>
            <p className="dsc-label dsc-label-faint">{t('Why it received this verdict')}</p>
            <p className="mt-3 text-base leading-8 text-[var(--dsc-ink-2)]">
              {screenplay.verdictStatement ||
                screenplay.recommendationRationale ||
                t('Verdict rationale not yet available.')}
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
            <div className="border-l-2 border-[var(--dsc-accent)] pl-4">
              <p className="dsc-label">{t('Strongest signals')}</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--dsc-ink-2)]">
                {screenplay.strengths.length > 0 ? (
                  screenplay.strengths
                    .slice(0, 3)
                    .map((strength) => <li key={strength}>● {strength}</li>)
                ) : (
                  <li>{t('No strengths were recorded in this analysis.')}</li>
                )}
              </ul>
            </div>
            <div className="border-l-2 border-amber-500 pl-4">
              <p className="dsc-label">{t('Watch points')}</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--dsc-ink-2)]">
                {[...screenplay.majorWeaknesses, ...screenplay.weaknesses].length > 0 ? (
                  [...screenplay.majorWeaknesses, ...screenplay.weaknesses]
                    .slice(0, 3)
                    .map((weakness) => <li key={weakness}>● {weakness}</li>)
                ) : (
                  <li>{t('No watch points were recorded in this analysis.')}</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </section>
      <section
        className="border-t border-[var(--dsc-line)] pt-8"
        aria-label={t('Scores and score lineage')}
      >
        <ScoresPanel screenplay={screenplay} presentation="workspace" />
      </section>
    </div>
  );
}

function ProjectHeader({
  screenplay,
  producerAssessment,
}: {
  screenplay: Screenplay;
  producerAssessment?: ProducerAssessmentHead;
}) {
  const { t } = useTranslation();
  const quickFavorites = useFavoritesStore((state) => state.quickFavorites);
  const toggleQuickFavorite = useFavoritesStore((state) => state.toggleQuickFavorite);
  const isFavorite = quickFavorites.includes(screenplay.id);
  const displayTitle = getScreenplayDisplayTitle(screenplay.title).title;
  const displayAuthor = getScreenplayDisplayAuthor(screenplay.author);
  const displayGenre = getScreenplayDisplayGenre(screenplay.genre);

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--dsc-line)] bg-[var(--dsc-surface)] shadow-2xl">
      <div className="grid md:grid-cols-[11rem_minmax(0,1fr)] xl:grid-cols-[12rem_minmax(0,1fr)_17rem]">
        <div className="border-b border-[var(--dsc-line)] bg-[#273448] p-4 md:border-b-0 md:border-r">
          <ScriptCover
            title={displayTitle}
            author={screenplay.author}
            seed={screenplay.projectId ?? screenplay.id}
            analysisVersion={screenplay.analysisVersion}
            className="mx-auto aspect-[2/3] w-full max-w-[12rem] shadow-2xl"
          />
        </div>
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-3">
            <span className="dsc-kicker">{t('Project workspace')}</span>
            <AnalysisTrustBadge screenplay={screenplay} />
            <DiscoveryShareStatus screenplay={screenplay} />
            <ProducerScoreBadge assessment={producerAssessment} />
          </div>
          <h1 className="dsc-display mt-3 text-4xl sm:text-5xl">{displayTitle}</h1>
          {displayAuthor && (
            <p className="mt-1 text-base text-[var(--dsc-ink-2)]">{t('by {{author}}', { author: displayAuthor })}</p>
          )}
          <p className="dsc-label dsc-label-faint mt-4">
            {[
              displayGenre,
              screenplay.metadata.pageCount ? t('{{count}} pages', { count: screenplay.metadata.pageCount }) : undefined,
              screenplay.analysisModel,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {screenplay.logline && (
            <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--dsc-ink-2)] line-clamp-3">
              {screenplay.logline}
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
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
              className="dsc-btn"
              aria-pressed={isFavorite}
            >
              <span aria-hidden="true">{isFavorite ? '★' : '☆'}</span>
              {isFavorite ? t('Favorited') : t('Favorite')}
            </button>
          </div>
        </div>
        <aside className="col-span-full flex items-center justify-between gap-8 border-t border-[#2a3b54] bg-[#101a29] p-5 text-[#f5f1e8] xl:col-span-1 xl:block xl:border-l xl:border-t-0 xl:p-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8290a5]">
              {t('Final score')}
            </p>
            <strong className="mt-1 block font-mono text-6xl leading-none">
              {screenplay.weightedScore.toFixed(1)}
            </strong>
            <div className="mt-4">
              <RecommendationBadge tier={screenplay.recommendation} size="lg" />
            </div>
          </div>
          <dl className="min-w-[13rem] space-y-2 border-l border-[#2a3b54] pl-6 text-xs xl:mt-7 xl:border-l-0 xl:border-t xl:pl-0 xl:pt-5">
            <div className="flex justify-between gap-4">
              <dt className="text-[#8290a5]">{t('Evidence')}</dt>
              <dd>{t(trustLabel(screenplay))}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#8290a5]">{t('Readers')}</dt>
              <dd>{screenplay.analysisQuality ? t('{{completed}}/{{expected}} readers complete', { completed: screenplay.analysisQuality.completedReaders, expected: screenplay.analysisQuality.expectedReaders }) : t('Legacy analysis')}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#8290a5]">{t('Analysis')}</dt>
              <dd>{screenplay.analysisVersion}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>
  );
}

export function ProjectWorkspace({
  screenplay,
  stats,
  activeTab,
  onSelectTab,
  onBack,
}: ProjectWorkspaceProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const isAdmin = useIsAdmin();
  const { data: assessmentHeads = [] } = useProducerAssessmentHeads(isAdmin);
  const producerAssessment = useMemo(
    () => exactProducerAssessment(assessmentHeads, screenplay),
    [assessmentHeads, screenplay],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    window.requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
  }, [activeTab, screenplay.id]);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'reader-room':
        return <ReaderRoom screenplay={screenplay} />;
      case 'story-x-ray':
        return (
          <section aria-labelledby="story-x-ray-title">
            <p className="dsc-kicker">{t('Inside the material')}</p>
            <h2 id="story-x-ray-title" className="dsc-display mt-2 text-4xl sm:text-5xl">
              {t('Story X-Ray')}
            </h2>
            <div className="mt-8">
              <ContentDetails screenplay={screenplay} presentation="workspace" />
            </div>
          </section>
        );
      case 'producer-take':
        return isAdmin ? (
          <ProducerTake screenplay={screenplay} />
        ) : (
          <ExecutiveRead screenplay={screenplay} />
        );
      case 'notes-files':
        return (
          <section aria-labelledby="notes-files-title">
            <p className="dsc-kicker">{t('Your private working layer')}</p>
            <h2 id="notes-files-title" className="dsc-display mt-2 text-4xl sm:text-5xl">
              {t('Notes & Files')}
            </h2>
            <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
              <NotesSection screenplayId={screenplay.id} presentation="workspace" />
              <aside className="rounded-lg border border-[var(--dsc-line)] bg-[var(--dsc-surface-2)] p-5">
                <p className="dsc-label">{t('Project files')}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--dsc-ink-2)]">
                  {t('Open the source screenplay or create the approved exports from the project header.')}
                </p>
                <div className="mt-4">
                  <ScreenplayPdfButton
                    screenplay={screenplay}
                    presentation="workspace"
                    allowReupload={false}
                  />
                </div>
              </aside>
            </div>
          </section>
        );
      case 'overview':
      default:
        return <ExecutiveRead screenplay={screenplay} />;
    }
  };

  return (
    <div
      className="discovery-root min-h-screen bg-[var(--dsc-surface-3)]"
      data-testid="project-workspace"
    >
      <DiscoverAppHeader
        total={stats.total}
        averageScore={stats.avgWeightedScore}
        filmNowCount={stats.filmNowCount}
        isLoading={false}
      />
      <main className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1680px]">
          <button type="button" onClick={onBack} className="dsc-btn mb-4 bg-[var(--dsc-surface)]">
            <span aria-hidden="true">←</span> {t('Back to Discovery')}
          </button>
          <ProjectHeader screenplay={screenplay} producerAssessment={producerAssessment} />
          <nav aria-label={t('Project workspace')} className="project-tabs mt-4">
            {TABS.filter((tab) => !tab.adminOnly || isAdmin).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onSelectTab(tab.key)}
                aria-current={activeTab === tab.key ? 'page' : undefined}
                className={clsx('project-tab', activeTab === tab.key && 'project-tab--active')}
              >
                {t(tab.label)}
              </button>
            ))}
          </nav>
          <div
            ref={panelRef}
            tabIndex={-1}
            className="project-tab-panel outline-none"
            data-testid={`project-tab-${activeTab}`}
          >
            {renderActiveTab()}
          </div>
        </div>
      </main>
    </div>
  );
}
