import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useScreenplays } from '@/hooks/useScreenplays';
import { getScreenplayDisplayTitle } from '@/lib/screenplayDisplay';
import type { RecommendationTier, Screenplay } from '@/types';

const VERDICTS: Array<{ id: RecommendationTier; label: string; color: string }> = [
  { id: 'film_now', label: 'Film Now', color: 'bg-amber-400' },
  { id: 'recommend', label: 'Recommend', color: 'bg-emerald-500' },
  { id: 'consider', label: 'Consider', color: 'bg-blue-500' },
  { id: 'pass', label: 'Pass', color: 'bg-red-500' },
];

function percentage(value: number, total: number): string {
  return total > 0 ? `${Math.round((value / total) * 100)}%` : '0%';
}

const BAR_WIDTHS = [
  'w-0',
  'w-[10%]',
  'w-[20%]',
  'w-[30%]',
  'w-[40%]',
  'w-1/2',
  'w-[60%]',
  'w-[70%]',
  'w-[80%]',
  'w-[90%]',
  'w-full',
] as const;

function barWidth(value: number, total: number): string {
  if (total <= 0) return BAR_WIDTHS[0];
  const bucket = Math.min(10, Math.max(0, Math.round((value / total) * 10)));
  return BAR_WIDTHS[bucket];
}

function issueFor(screenplay: Screenplay): string | null {
  if (screenplay.analysisQuality?.status === 'partial') {
    const missing = screenplay.analysisQuality.failedReaders.length;
    return `${missing || 1} reader report${missing === 1 ? '' : 's'} incomplete`;
  }
  const blockingWarning = screenplay.producerProjection?.warnings.find(
    (warning) => warning.severity === 'blocking' || warning.severity === 'warning',
  );
  if (blockingWarning) return blockingWarning.title;
  if (screenplay.producerProjection?.trustStatus === 'legacy_unverified') {
    return 'Legacy analysis, evidence lineage not verified';
  }
  return null;
}

export function AnalysisOverview() {
  const { t } = useTranslation();
  const { data: screenplays = [] } = useScreenplays();

  const health = useMemo(() => {
    const total = screenplays.length;
    const completePanels = screenplays.filter((screenplay) => {
      const quality = screenplay.analysisQuality;
      return quality
        ? quality.status === 'complete' && quality.completedReaders >= quality.expectedReaders
        : false;
    }).length;
    const verified = screenplays.filter(
      (screenplay) => screenplay.producerProjection?.trustStatus === 'verified',
    ).length;
    const pdfReady = screenplays.filter((screenplay) => screenplay.hasPdf).length;
    const attention = screenplays
      .map((screenplay) => ({ screenplay, issue: issueFor(screenplay) }))
      .filter((item): item is { screenplay: Screenplay; issue: string } => Boolean(item.issue));
    const scoreValues = screenplays
      .map((screenplay) => Number(screenplay.weightedScore))
      .filter(Number.isFinite);
    const averageScore = scoreValues.length
      ? scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length
      : 0;
    const genreCounts = new Map<string, number>();
    screenplays.forEach((screenplay) => {
      const genre = screenplay.genre?.trim() || 'Unclassified';
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    });
    const topGenre = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['No data', 0];
    const verdictCounts = Object.fromEntries(
      VERDICTS.map(({ id }) => [
        id,
        screenplays.filter((screenplay) => screenplay.recommendation === id).length,
      ]),
    ) as Record<RecommendationTier, number>;

    return {
      total,
      completePanels,
      verified,
      pdfReady,
      attention,
      averageScore,
      topGenre,
      verdictCounts,
    };
  }, [screenplays]);

  const metrics = [
    {
      label: t('Complete reader panels'),
      value: health.completePanels,
      detail: t('{{percent}} of the slate has every expected reader', { percent: percentage(health.completePanels, health.total) }),
    },
    {
      label: t('Verified evidence'),
      value: health.verified,
      detail: t('{{percent}} has current evidence lineage', { percent: percentage(health.verified, health.total) }),
    },
    {
      label: t('Needs review'),
      value: health.attention.length,
      detail:
        health.attention.length === 0
          ? t('No analysis warnings found')
          : t('Open items are listed below'),
    },
    {
      label: t('Source PDFs ready'),
      value: health.pdfReady,
      detail: t('{{percent}} can open the original screenplay', { percent: percentage(health.pdfReady, health.total) }),
    },
  ];

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--settings-kicker)]">
          {t('Analysis readiness')}
        </p>
        <h2 className="mt-2 text-3xl font-display text-black-100">{t('Know what can be trusted')}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-black-400">
          {t('This view reports the health of the analyses already in the slate. It does not run a new analysis or alter a score.')}
        </p>
      </header>

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label={t('Analysis health summary')}
      >
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-xl border border-black-700 bg-black-900/30 p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-black-500">
              {metric.label}
            </p>
            <strong className="mt-2 block text-3xl tabular-nums text-black-100">
              {metric.value}
              <span className="ml-1 text-sm font-normal text-black-500">{t('of {{total}}', { total: health.total })}</span>
            </strong>
            <p className="mt-2 text-sm leading-5 text-black-400">{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 rounded-xl border border-black-700 bg-black-900/30 p-5 lg:grid-cols-[0.7fr_1.3fr] lg:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-black-500">
            {t('Slate snapshot')}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-black-700 bg-black-950/20 p-4">
              <span className="text-xs text-black-500">{t('Average score')}</span>
              <strong className="mt-1 block text-2xl tabular-nums text-black-100">
                {health.averageScore.toFixed(1)}
              </strong>
            </div>
            <div className="rounded-lg border border-black-700 bg-black-950/20 p-4">
              <span className="text-xs text-black-500">{t('Most common genre')}</span>
              <strong className="mt-1 block text-base leading-5 text-black-100">
                {health.topGenre[0]}
              </strong>
              <small className="text-black-500">{t('{{count}} project', { count: health.topGenre[1] })}</small>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-black-500">
            {t('Verdict mix')}
          </p>
          <div className="mt-4 space-y-3">
            {VERDICTS.map((verdict) => {
              const count = health.verdictCounts[verdict.id];
              return (
                <div
                  key={verdict.id}
                  className="grid grid-cols-[86px_minmax(0,1fr)_52px] items-center gap-3"
                >
                  <span className="text-sm text-black-300">{t(verdict.label)}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-black-700" aria-hidden="true">
                    <div
                      className={`h-full rounded-full ${verdict.color} ${barWidth(count, health.total)}`}
                    />
                  </div>
                  <span className="text-right text-sm tabular-nums text-black-300">
                    {count}{' '}
                    <span className="text-black-500">{percentage(count, health.total)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-black-700 bg-black-900/30 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-xl font-display text-black-100">{t('Attention required')}</h3>
            <p className="mt-1 text-sm text-black-400">
              {t('Projects with incomplete readers, trust warnings, or legacy evidence.')}
            </p>
          </div>
          <span className="text-sm font-semibold tabular-nums text-black-300">
            {t('{{count}} open', { count: health.attention.length })}
          </span>
        </div>

        {health.attention.length === 0 ? (
          <p className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-400">
            {t('No analysis-health warnings were found in the current slate.')}
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-black-700 overflow-hidden rounded-lg border border-black-700">
            {health.attention.slice(0, 8).map(({ screenplay, issue }) => (
              <li
                key={screenplay.id}
                className="grid gap-1 bg-black-950/20 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
              >
                <strong className="truncate text-sm text-black-100">
                  {getScreenplayDisplayTitle(screenplay.title).title}
                </strong>
                <span className="text-sm text-black-400">{t(issue)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="rounded-xl border border-black-700 bg-black-900/30 p-5 sm:p-6">
        <summary className="cursor-pointer font-semibold text-black-100">
          {t('How V9 analysis works')}
        </summary>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-black-400">
          {t('Five independent readers examine structure, character, craft and scene, concept, and emotional resonance. Their reports are synthesized into one assessment while reader failures and disagreements remain visible.')}
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-5">
          {['Structure', 'Character', 'Craft & Scene', 'Concept', 'Emotion'].map(
            (reader, index) => (
              <li key={reader} className="rounded-lg border border-black-700 bg-black-950/20 p-3">
                <span className="text-xs font-semibold text-[var(--settings-kicker)]">
                  0{index + 1}
                </span>
                <strong className="mt-1 block text-sm text-black-100">{t(reader)}</strong>
              </li>
            ),
          )}
        </ol>
      </details>
    </div>
  );
}
