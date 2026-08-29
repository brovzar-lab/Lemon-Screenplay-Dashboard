import type { Screenplay } from '@/types';
import { useTranslation } from 'react-i18next';
import { decisionReadyScreenplays } from '@/lib/producerProjection';

interface ScreenplaySlateStatsProps {
  screenplays: Screenplay[];
  totalCount: number;
  producerLookCount: number;
  loading?: boolean;
}

export function ScreenplaySlateStats({
  screenplays,
  totalCount,
  producerLookCount,
  loading = false,
}: ScreenplaySlateStatsProps) {
  const { t } = useTranslation();
  const decisionReady = decisionReadyScreenplays(screenplays);
  const average =
    decisionReady.length > 0
      ? decisionReady.reduce((sum, screenplay) => sum + screenplay.weightedScore, 0) /
        decisionReady.length
      : 0;
  const priorityCount = decisionReady.filter(
    (screenplay) =>
      screenplay.recommendation === 'film_now' || screenplay.recommendation === 'recommend',
  ).length;

  return (
    <section
      className="screenplay-slate-stats"
      aria-label={t('Current slate statistics')}
      aria-busy={loading}
    >
      {loading ? (
        Array.from({ length: 5 }, (_, index) => (
          <span key={index} className="screenplay-slate-stats__skeleton" aria-hidden="true" />
        ))
      ) : (
        <>
          <span>
            <strong>{totalCount}</strong>
            <small>{t('Total scripts')}</small>
          </span>
          <span>
            <strong>{screenplays.length}</strong>
            <small>{t('Visible')}</small>
          </span>
          <span>
            <strong>{average.toFixed(1)}</strong>
            <small>{t('Average score')}</small>
          </span>
          <span>
            <strong>{priorityCount}</strong>
            <small>{t('Film Now + Recommend')}</small>
          </span>
          {decisionReady.length !== screenplays.length && (
            <span>
              <strong>{screenplays.length - decisionReady.length}</strong>
              <small>{t('Unverified omitted')}</small>
            </span>
          )}
          <span>
            <strong>{producerLookCount}</strong>
            <small>{t('Producer Look')}</small>
          </span>
        </>
      )}
    </section>
  );
}
