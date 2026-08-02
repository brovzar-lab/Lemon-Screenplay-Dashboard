import { useEffect, useMemo, useRef } from 'react';

import { DiscoverAppHeader } from '@/components/discover/DiscoverAppHeader';
import { DiscoveryExportActions } from '@/components/discover/DiscoveryExportActions';
import { DiscoveryShareStatus } from '@/components/discover/DiscoveryShareStatus';
import { ScriptCover } from '@/components/discover/ScriptCover';
import { AnalysisTrustBadge } from '@/components/screenplay/AnalysisTrustBadge';
import { ProducerScoreBadge } from '@/components/screenplay/ProducerScoreBadge';
import {
  AnalysisWarnings,
  ContentDetails,
  DeferredReaderEvidence,
  NotesSection,
  ProducerTake,
  ScoresPanel,
  ShareButton,
} from '@/components/screenplay/modal';
import { ScreenplayPdfButton } from '@/components/screenplay/modal/ScreenplayPdfButton';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { useProducerAssessmentHeads } from '@/hooks/useProducerAssessments';
import { useIsAdmin } from '@/stores/authStore';
import { useFavoritesStore } from '@/stores/favoritesStore';
import type { ProducerAssessmentHead, Screenplay } from '@/types';

export interface ProjectWorkspaceStats {
  total: number;
  avgWeightedScore: number;
  filmNowCount: number;
}

interface ProjectWorkspaceProps {
  screenplay: Screenplay;
  stats: ProjectWorkspaceStats;
  onBack: () => void;
}

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

function readerLabel(screenplay: Screenplay): string {
  const quality = screenplay.analysisQuality;
  if (!quality) return 'Legacy analysis';
  return `${quality.completedReaders}/${quality.expectedReaders} readers complete`;
}

function ProjectDecisionSpine({
  screenplay,
  producerAssessment,
  isAdmin,
}: {
  screenplay: Screenplay;
  producerAssessment?: ProducerAssessmentHead;
  isAdmin: boolean;
}) {
  const spineItems = [
    {
      label: 'AI decision',
      value: screenplay.recommendation === 'film_now'
        ? 'Film Now'
        : screenplay.recommendation.charAt(0).toUpperCase() + screenplay.recommendation.slice(1),
      detail: `${screenplay.weightedScore.toFixed(1)} final score`,
      href: '#project-overview',
    },
    {
      label: 'Trust',
      value: trustLabel(screenplay),
      detail: readerLabel(screenplay),
      href: '#project-scores',
    },
    {
      label: 'Reader room',
      value: screenplay.readerDisagreements?.length
        ? `${screenplay.readerDisagreements.length} disagreement${screenplay.readerDisagreements.length === 1 ? '' : 's'}`
        : 'Roundtable settled',
      detail: 'Five specialist lenses',
      href: '#project-readers',
    },
    ...(isAdmin
      ? [{
          label: 'Producer Take',
          value: producerAssessment ? 'Recorded' : 'Not recorded',
          detail: producerAssessment ? 'Bound to this analysis' : 'Your decision layer is ready',
          href: '#project-producer-take',
        }]
      : []),
    {
      label: 'Analysis version',
      value: screenplay.versionCount ? `Version ${screenplay.versionCount}` : screenplay.analysisVersion,
      detail: screenplay.latestVersionId ? 'Sealed source and evidence' : 'Legacy record',
      href: '#project-provenance',
    },
  ];

  return (
    <aside className="xl:sticky xl:top-6 xl:self-start" aria-label="Project decision spine">
      <div className="dsc-card overflow-hidden">
        <div className="border-b border-[var(--dsc-line)] px-5 py-4">
          <p className="dsc-kicker">Decision spine</p>
          <p className="mt-2 text-sm leading-6 text-[var(--dsc-ink-2)]">
            The system&apos;s judgment, its evidence, and your decision in one line of sight.
          </p>
        </div>
        <nav aria-label="Workspace sections">
          <ol className="divide-y divide-[var(--dsc-line)]">
            {spineItems.map((item, index) => (
              <li key={item.label} className="relative px-5 py-4 pl-10">
                <span
                  aria-hidden="true"
                  className="absolute left-5 top-5 h-2.5 w-2.5 rounded-full border-2 border-[var(--dsc-accent)] bg-[var(--dsc-surface)]"
                />
                {index < spineItems.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-[-1rem] left-[1.48rem] top-7 w-px bg-[var(--dsc-line-strong)]"
                  />
                )}
                <a href={item.href} className="group block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--dsc-accent)]">
                  <span className="dsc-label dsc-label-faint block">{item.label}</span>
                  <strong className="mt-1 block text-sm text-[var(--dsc-ink)] group-hover:text-[var(--dsc-accent)]">
                    {item.value}
                  </strong>
                  <span className="mt-1 block text-xs leading-5 text-[var(--dsc-ink-3)]">
                    {item.detail}
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </aside>
  );
}

export function ProjectWorkspace({ screenplay, stats, onBack }: ProjectWorkspaceProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const isAdmin = useIsAdmin();
  const { data: assessmentHeads = [] } = useProducerAssessmentHeads(isAdmin);
  const producerAssessment = useMemo(
    () => exactProducerAssessment(assessmentHeads, screenplay),
    [assessmentHeads, screenplay],
  );
  const quickFavorites = useFavoritesStore((state) => state.quickFavorites);
  const toggleQuickFavorite = useFavoritesStore((state) => state.toggleQuickFavorite);
  const isFavorite = quickFavorites.includes(screenplay.id);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const frame = window.requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [screenplay.id]);

  return (
    <div className="discovery-root min-h-screen" data-testid="project-workspace">
      <DiscoverAppHeader
        total={stats.total}
        averageScore={stats.avgWeightedScore}
        filmNowCount={stats.filmNowCount}
        isLoading={false}
      />

      <main className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1800px]">
          <button type="button" onClick={onBack} className="dsc-btn mb-5">
            <span aria-hidden="true">←</span>
            Back to Discovery
          </button>

          <section
            id="project-overview"
            aria-labelledby="project-workspace-title"
            className="dsc-card overflow-hidden"
          >
            <div className="grid xl:grid-cols-[minmax(13rem,0.32fr)_minmax(0,1fr)_minmax(17rem,0.34fr)]">
              <div className="border-b border-[var(--dsc-line)] bg-[var(--dsc-surface-2)] p-5 sm:p-7 xl:border-b-0 xl:border-r">
                <ScriptCover
                  title={screenplay.title}
                  author={screenplay.author}
                  seed={screenplay.projectId ?? screenplay.id}
                  analysisVersion={screenplay.analysisVersion}
                  className="mx-auto aspect-[2/3] max-w-[17rem] shadow-xl"
                />
              </div>

              <div className="p-6 sm:p-8 lg:p-10">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="dsc-kicker">Project workspace</span>
                  <AnalysisTrustBadge screenplay={screenplay} />
                  <DiscoveryShareStatus screenplay={screenplay} />
                  <ProducerScoreBadge assessment={producerAssessment} />
                </div>
                <h1
                  ref={titleRef}
                  id="project-workspace-title"
                  tabIndex={-1}
                  className="dsc-display mt-4 text-4xl outline-none focus-visible:!outline-none sm:text-5xl lg:text-6xl"
                >
                  {screenplay.title}
                </h1>
                <p className="mt-2 text-lg text-[var(--dsc-ink-2)]">
                  by {screenplay.author || 'Unknown writer'}
                </p>
                <p className="dsc-label dsc-label-faint mt-5">
                  {screenplay.genre} · {screenplay.metadata.pageCount || 'Unknown'} pages · {screenplay.analysisModel}
                </p>
                <p className="mt-6 max-w-3xl text-lg leading-8 text-[var(--dsc-ink-2)]">
                  {screenplay.logline || 'Logline not yet available.'}
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-2">
                  <ScreenplayPdfButton screenplay={screenplay} presentation="workspace" allowReupload={false} />
                  <ShareButton screenplay={screenplay} waitForExistingLink presentation="discovery" />
                  <DiscoveryExportActions screenplay={screenplay} />
                  <button
                    type="button"
                    onClick={() => toggleQuickFavorite(screenplay.id)}
                    className="dsc-btn"
                    aria-pressed={isFavorite}
                  >
                    <span aria-hidden="true">{isFavorite ? '★' : '☆'}</span>
                    {isFavorite ? 'Favorited' : 'Favorite'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col justify-between border-t border-[var(--dsc-line)] bg-[var(--dsc-surface-2)] p-6 sm:p-8 xl:border-l xl:border-t-0">
                <div>
                  <p className="dsc-label dsc-label-faint">Final score</p>
                  <strong className="dsc-num mt-2 block text-7xl leading-none text-[var(--dsc-ink)]">
                    {screenplay.weightedScore.toFixed(1)}
                  </strong>
                  <div className="mt-5">
                    <RecommendationBadge tier={screenplay.recommendation} size="lg" />
                  </div>
                </div>
                <div id="project-provenance" className="mt-8 border-t border-[var(--dsc-line)] pt-5">
                  <p className="dsc-label dsc-label-faint">Decision provenance</p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-[var(--dsc-ink-3)]">Evidence</dt>
                      <dd className="text-right font-semibold text-[var(--dsc-ink)]">{trustLabel(screenplay)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-[var(--dsc-ink-3)]">Readers</dt>
                      <dd className="text-right font-semibold text-[var(--dsc-ink)]">{readerLabel(screenplay)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-[var(--dsc-ink-3)]">Analysis</dt>
                      <dd className="text-right font-semibold text-[var(--dsc-ink)]">{screenplay.analysisVersion}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[17rem_minmax(0,1fr)]">
            <ProjectDecisionSpine
              screenplay={screenplay}
              producerAssessment={producerAssessment}
              isAdmin={isAdmin}
            />

            <div className="min-w-0 space-y-6">
              <AnalysisWarnings screenplay={screenplay} />

              <section className="dsc-card p-5 sm:p-7" aria-labelledby="project-executive-read">
                <p className="dsc-kicker">The read</p>
                <h2 id="project-executive-read" className="dsc-display mt-2 text-3xl sm:text-4xl">
                  Executive read
                </h2>
                <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
                  <div>
                    <p className="dsc-label dsc-label-faint">Why it received this verdict</p>
                    <p className="mt-3 text-base leading-7 text-[var(--dsc-ink-2)]">
                      {screenplay.verdictStatement || screenplay.recommendationRationale || 'Verdict rationale not yet available.'}
                    </p>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                    <div>
                      <p className="dsc-label">Strongest signals</p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--dsc-ink-2)]">
                        {screenplay.strengths.length > 0
                          ? screenplay.strengths.slice(0, 3).map((strength) => <li key={strength}>● {strength}</li>)
                          : <li>No strengths were recorded in this analysis.</li>}
                      </ul>
                    </div>
                    <div>
                      <p className="dsc-label">Watch points</p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--dsc-ink-2)]">
                        {[...screenplay.majorWeaknesses, ...screenplay.weaknesses].length > 0
                          ? [...screenplay.majorWeaknesses, ...screenplay.weaknesses].slice(0, 3).map((weakness) => <li key={weakness}>● {weakness}</li>)
                          : <li>No watch points were recorded in this analysis.</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              </section>

              <section
                id="project-scores"
                data-testid="project-scores-panel"
                className="dsc-card scroll-mt-6 p-5 sm:p-7"
                aria-label="Scores and score lineage"
              >
                <ScoresPanel screenplay={screenplay} />
              </section>

              <section
                id="project-readers"
                data-testid="project-reader-room"
                className="dsc-card scroll-mt-6 p-5 sm:p-7"
                aria-label="Reader room"
              >
                <div className="mb-6">
                  <p className="dsc-kicker">Who scored what</p>
                  <h2 className="dsc-display mt-2 text-3xl sm:text-4xl">Reader room</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--dsc-ink-2)]">
                    Open each specialist lens to see its score, written case, page evidence, flags, and roundtable disagreements.
                  </p>
                </div>
                <DeferredReaderEvidence screenplay={screenplay} />
              </section>

              <section
                id="project-story-xray"
                data-testid="project-story-xray"
                className="dsc-card scroll-mt-6 space-y-8 p-5 sm:p-7"
                aria-label="Story X-Ray"
              >
                <div>
                  <p className="dsc-kicker">Inside the material</p>
                  <h2 className="dsc-display mt-2 text-3xl sm:text-4xl">Story X-Ray</h2>
                </div>
                <ContentDetails screenplay={screenplay} />
              </section>

              {isAdmin && (
                <div id="project-producer-take" className="scroll-mt-6">
                  <ProducerTake screenplay={screenplay} />
                </div>
              )}

              <section
                id="project-notes"
                data-testid="project-notes"
                className="dsc-card scroll-mt-6 p-5 sm:p-7"
                aria-label="Private notes"
              >
                <NotesSection screenplayId={screenplay.id} />
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
