import type { Screenplay } from '@/types';
import { useTranslation } from 'react-i18next';

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
  const average =
    screenplays.length > 0
      ? screenplays.reduce((sum, screenplay) => sum + screenplay.weightedScore, 0) /
        screenplays.length
      : 0;
  const priorityCount = screenplays.filter(
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
          <span>
            <strong>{producerLookCount}</strong>
            <small>{t('Producer Look')}</small>
          </span>
        </>
      )}
    </section>
  );
}
