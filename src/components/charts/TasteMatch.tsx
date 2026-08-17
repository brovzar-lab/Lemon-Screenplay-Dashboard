import { useEffect, useMemo, useState } from 'react';
import { loadAllBrainVerdicts, type BrainVerdict } from '@/lib/feedbackStore';
import { calculateTasteMatch } from '@/lib/tasteMatch';
import { useTranslation } from 'react-i18next';

function verdictLabel(value: string): string {
  return value === 'film_now' ? 'Film Now' : value.charAt(0).toUpperCase() + value.slice(1);
}

export function TasteMatch() {
  const { t } = useTranslation();
  const [verdicts, setVerdicts] = useState<BrainVerdict[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const stats = useMemo(() => calculateTasteMatch(verdicts), [verdicts]);

  useEffect(() => {
    let active = true;
    loadAllBrainVerdicts().then((loaded) => {
      if (active) {
        setVerdicts(loaded);
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="producer-alignment mt-4" role="status">
        {t('Loading Producer Alignment…')}
      </div>
    );
  }

  if (stats.reviewed === 0) {
    return (
      <div className="producer-alignment mt-4">
        <h2>{t('Producer Alignment')}</h2>
        <p>{t('Publish a Producer Take to start comparing producer decisions with AI verdicts.')}</p>
      </div>
    );
  }

  const confidence =
    stats.reviewed < 10 ? 'Early signal' : stats.reviewed < 30 ? 'Developing' : 'Strong sample';

  return (
    <section className="producer-alignment mt-4" aria-labelledby="taste-match-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="taste-match-title">{t('Producer Alignment')}</h2>
          <p>{t('Recorded producer decisions compared with AI verdicts')}</p>
        </div>
        <span className="text-xs text-black-500">
          {t(confidence)} · {t('{{count}} reviewed', { count: stats.reviewed })}
        </span>
      </div>

      <div className="producer-alignment__metrics mt-4 grid grid-cols-2 md:grid-cols-4">
        <div>
          <p>{stats.reviewed}</p>
          <span>{t('Recorded decisions')}</span>
        </div>
        <div>
          <p>{stats.matchRate.toFixed(0)}%</p>
          <span>{t('Exact agreement')}</span>
        </div>
        <div>
          <p>{stats.aiTooHigh}</p>
          <span>{t('AI too generous')}</span>
        </div>
        <div>
          <p>{stats.aiTooLow}</p>
          <span>{t('AI too harsh')}</span>
        </div>
      </div>
      <p className="producer-alignment__note">
        {t('Alignment includes every recorded Producer Take. Calibration uses only takes explicitly marked as eligible evidence.')}
      </p>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-semibold uppercase text-black-400">{t('Agreement by genre')}</h3>
          <div className="mt-2 space-y-2">
            {stats.genreStats.slice(0, 5).map((genre) => (
              <div
                key={genre.genre}
                className="grid grid-cols-[minmax(0,1fr)_5rem_3rem] items-center gap-3 text-sm"
              >
                <span className="truncate text-black-200">{genre.genre}</span>
                <progress
                  className="h-1.5 w-full accent-gold-500"
                  max={100}
                  value={genre.matchRate}
                  aria-label={t('{{genre}} agreement', { genre: genre.genre })}
                />
                <span className="text-right text-black-400 tabular-nums">
                  {genre.matchRate.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase text-black-400">{t('Biggest disagreements')}</h3>
          {stats.disagreements.length === 0 ? (
            <p className="mt-2 text-sm text-emerald-400">{t('Every recorded verdict matches.')}</p>
          ) : (
            <div className="mt-2 divide-y divide-black-700">
              {stats.disagreements.slice(0, 4).map((item) => (
                <div
                  key={item.screenplayId}
                  className="py-2 flex items-center justify-between gap-4 text-sm"
                >
                  <span className="truncate text-black-200">{item.screenplayTitle}</span>
                  <span className="shrink-0 text-xs text-black-400">
                    {t('AI')} {t(verdictLabel(item.aiVerdict))} · {t('Billy')} {t(verdictLabel(item.billyVerdict))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
