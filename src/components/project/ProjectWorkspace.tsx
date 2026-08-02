import { useEffect, useMemo, useRef, useState } from 'react';

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

const DOSSIER_SECTIONS = [
  { label: 'Overview', href: '#project-executive-read' },
  { label: 'Scores', href: '#project-scores' },
  { label: 'Reader Room', href: '#project-readers' },
  { label: 'Story X-Ray', href: '#project-story-xray' },
  { label: 'Producer Take', href: '#project-producer-take', adminOnly: true },
  { label: 'Notes', href: '#project-notes' },
];

function ProjectDecisionDocket({
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
    <section
      aria-label="Project decision docket"
      className="overflow-hidden border-x border-b border-[#25344a] bg-[#101a29] text-[#f5f1e8] shadow-2xl"
    >
      <div className="grid md:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="flex items-center border-b border-[#2a3b54] px-5 py-4 md:border-b-0 md:border-r">
          <div>
            <p className="font-semibold uppercase tracking-[0.12em] text-white">Decision docket</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8290a5]">At a glance</p>
          </div>
        </div>
        <ol className="grid grid-cols-2 divide-x divide-y divide-[#2a3b54] sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          {spineItems.map((item) => (
            <li key={item.label} className="min-w-0">
              <a href={item.href} className="group block min-h-24 px-4 py-4 hover:bg-[#16243a]">
                <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#8290a5]">
                  {item.label}
                </span>
                <strong className="mt-2 block truncate text-sm text-[#f5f1e8] group-hover:text-[#7da0ff]">
                  {item.value}
                </strong>
                <span className="mt-1 block text-xs leading-5 text-[#9da9ba]">{item.detail}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ProjectDossierNav({ isAdmin }: { isAdmin: boolean }) {
  const [activeHash, setActiveHash] = useState(() => window.location.hash || '#project-executive-read');

  useEffect(() => {
    const syncActiveHash = () => setActiveHash(window.location.hash || '#project-executive-read');
    window.addEventListener('hashchange', syncActiveHash);
    return () => window.removeEventListener('hashchange', syncActiveHash);
  }, []);

  return (
    <nav
      aria-label="Project dossier"
      className="sticky top-[9rem] z-30 mt-5 overflow-x-auto rounded-t-xl border border-[var(--dsc-line)] bg-[var(--dsc-surface)] shadow-lg lg:top-[6.4rem]"
    >
      <div className="flex min-w-max px-3 pt-2">
        {DOSSIER_SECTIONS.filter((section) => !section.adminOnly || isAdmin).map((section) => (
          <a
            key={section.label}
            href={section.href}
            className={`min-h-12 border-b-2 px-5 py-3 text-xs font-bold uppercase tracking-[0.11em] transition-colors ${
              activeHash === section.href
                ? 'border-[var(--dsc-accent)] text-[var(--dsc-accent)]'
                : 'border-transparent text-[var(--dsc-ink-2)] hover:border-[var(--dsc-line)] hover:text-[var(--dsc-ink)]'
            }`}
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
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
    const frame = window.requestAnimationFrame(() => {
      const targetId = window.location.hash.slice(1);
      if (targetId) {
        document.getElementById(targetId)?.scrollIntoView({ block: 'start' });
        return;
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      titleRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [screenplay.id]);

  return (
    <div className="discovery-root min-h-screen bg-[var(--dsc-surface-3)]" data-testid="project-workspace">
      <DiscoverAppHeader
        total={stats.total}
        averageScore={stats.avgWeightedScore}
        filmNowCount={stats.filmNowCount}
        isLoading={false}
      />

      <main className="px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1680px]">
          <button type="button" onClick={onBack} className="dsc-btn mb-4 bg-[var(--dsc-surface)]">
            <span aria-hidden="true">←</span>
            Back to Discovery
          </button>

          <section
            id="project-overview"
            aria-labelledby="project-workspace-title"
            className="overflow-hidden rounded-xl border border-[var(--dsc-line)] bg-[var(--dsc-surface)] shadow-2xl"
          >
            <div className="grid md:grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[14rem_minmax(0,1fr)_18rem] 2xl:grid-cols-[15rem_minmax(0,1fr)_19rem]">
              <div className="border-b border-[var(--dsc-line)] bg-[#2b3748] p-5 sm:p-6 md:border-b-0 md:border-r">
                <ScriptCover
                  title={screenplay.title}
                  author={screenplay.author}
                  seed={screenplay.projectId ?? screenplay.id}
                  analysisVersion={screenplay.analysisVersion}
                  className="mx-auto aspect-[2/3] max-h-[22rem] w-full max-w-[15rem] shadow-2xl"
                />
              </div>

              <div className="p-6 sm:p-8 2xl:p-9">
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
                <p className="mt-5 max-w-3xl text-base leading-7 text-[var(--dsc-ink-2)] lg:text-lg lg:leading-8">
                  {screenplay.logline || 'Logline not yet available.'}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-2">
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

              <div className="col-span-full flex flex-col justify-between border-t border-[#2a3b54] bg-[#101a29] p-6 text-[#f5f1e8] md:flex-row md:items-center md:gap-10 lg:col-span-1 lg:flex-col lg:items-stretch lg:border-l lg:border-t-0 lg:p-7">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8290a5]">Final score</p>
                  <strong className="mt-2 block font-mono text-7xl leading-none text-[#f5f1e8] 2xl:text-8xl">
                    {screenplay.weightedScore.toFixed(1)}
                  </strong>
                  <div className="mt-5 [&_.badge-consider]:!bg-[#e8ecff] [&_.badge-consider]:!text-[#2449d8] [&_.badge-film-now]:!bg-[#d9f6e9] [&_.badge-film-now]:!text-[#146844] [&_.badge-pass]:!bg-[#edeff3] [&_.badge-pass]:!text-[#465267] [&_.badge-recommend]:!bg-[#d9f6e9] [&_.badge-recommend]:!text-[#146844]">
                    <RecommendationBadge tier={screenplay.recommendation} size="lg" />
                  </div>
                </div>
                <div id="project-provenance" className="mt-6 min-w-[16rem] border-t border-[#2a3b54] pt-5 md:mt-0 md:border-l md:border-t-0 md:pl-8 lg:mt-8 lg:border-l-0 lg:border-t lg:pl-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8290a5]">Decision provenance</p>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-[#8290a5]">Evidence</dt>
                      <dd className="text-right font-semibold text-[#f5f1e8]">{trustLabel(screenplay)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-[#8290a5]">Readers</dt>
                      <dd className="text-right font-semibold text-[#f5f1e8]">{readerLabel(screenplay)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-[#8290a5]">Analysis</dt>
                      <dd className="text-right font-semibold text-[#f5f1e8]">{screenplay.analysisVersion}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </section>

          <ProjectDecisionDocket
            screenplay={screenplay}
            producerAssessment={producerAssessment}
            isAdmin={isAdmin}
          />
          <ProjectDossierNav isAdmin={isAdmin} />

          <div data-presentation="discovery" className="min-w-0 space-y-5 rounded-b-xl border-x border-b border-[var(--dsc-line)] bg-[var(--dsc-bg)] p-4 shadow-xl sm:p-6 lg:p-8">
              <AnalysisWarnings screenplay={screenplay} />

              <section id="project-executive-read" className="scroll-mt-40 rounded-lg border border-[var(--dsc-line)] bg-[var(--dsc-surface)] p-5 shadow-md sm:p-7 lg:p-9" aria-labelledby="project-executive-read-title">
                <p className="dsc-kicker">The read</p>
                <h2 id="project-executive-read-title" className="dsc-display mt-2 text-3xl sm:text-4xl">
                  Executive read
                </h2>
                <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
                  <div>
                    <p className="dsc-label dsc-label-faint">Why it received this verdict</p>
                    <p className="mt-3 text-base leading-7 text-[var(--dsc-ink-2)]">
                      {screenplay.verdictStatement || screenplay.recommendationRationale || 'Verdict rationale not yet available.'}
                    </p>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="border-l-2 border-[var(--dsc-accent)] pl-4">
                      <p className="dsc-label">Strongest signals</p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--dsc-ink-2)]">
                        {screenplay.strengths.length > 0
                          ? screenplay.strengths.slice(0, 3).map((strength) => <li key={strength}>● {strength}</li>)
                          : <li>No strengths were recorded in this analysis.</li>}
                      </ul>
                    </div>
                    <div className="border-l-2 border-amber-500 pl-4">
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
                className="scroll-mt-40 rounded-lg border border-[var(--dsc-line)] bg-[var(--dsc-surface)] p-5 shadow-md sm:p-7 lg:p-9"
                aria-label="Scores and score lineage"
              >
                <ScoresPanel screenplay={screenplay} presentation="workspace" />
              </section>

              <section
                id="project-readers"
                data-testid="project-reader-room"
                className="scroll-mt-40 rounded-lg border border-[var(--dsc-line)] bg-[var(--dsc-surface)] p-5 shadow-md sm:p-7 lg:p-9"
                aria-label="Reader room"
              >
                <div className="mb-6">
                  <p className="dsc-kicker">Who scored what</p>
                  <h2 className="dsc-display mt-2 text-3xl sm:text-4xl">Reader room</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--dsc-ink-2)]">
                    Open each specialist lens to see its score, written case, page evidence, flags, and roundtable disagreements.
                  </p>
                </div>
                <DeferredReaderEvidence screenplay={screenplay} presentation="workspace" />
              </section>

              <section
                id="project-story-xray"
                data-testid="project-story-xray"
                className="scroll-mt-40 space-y-8 rounded-lg border border-[var(--dsc-line)] bg-[var(--dsc-surface)] p-5 shadow-md sm:p-7 lg:p-9"
                aria-label="Story X-Ray"
              >
                <div>
                  <p className="dsc-kicker">Inside the material</p>
                  <h2 className="dsc-display mt-2 text-3xl sm:text-4xl">Story X-Ray</h2>
                </div>
                <ContentDetails screenplay={screenplay} presentation="workspace" />
              </section>

              {isAdmin && (
                <div id="project-producer-take" className="scroll-mt-40">
                  <ProducerTake screenplay={screenplay} />
                </div>
              )}

              <section
                id="project-notes"
                data-testid="project-notes"
                className="scroll-mt-40 rounded-lg border border-[var(--dsc-line)] bg-[var(--dsc-surface)] p-5 shadow-md sm:p-7 lg:p-9"
                aria-label="Private notes"
              >
                <NotesSection screenplayId={screenplay.id} presentation="workspace" />
              </section>
          </div>
        </div>
      </main>
    </div>
  );
}
