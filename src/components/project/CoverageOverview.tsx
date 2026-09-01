import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import type { Screenplay } from '@/types';
import { useTranslation } from 'react-i18next';

export function CoverageOverview({
  screenplay,
  onOpenCoverage,
}: {
  screenplay: Screenplay;
  onOpenCoverage: () => void;
}) {
  const { t } = useTranslation();
  const detail = screenplay.coverage;
  if (!detail) return null;

  return (
    <section className="space-y-7" aria-label={t('Coverage')}>
      <header className="flex flex-wrap items-start justify-between gap-5 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {t('Coverage · unscored by design')}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <RecommendationBadge tier={screenplay.recommendation} size="lg" />
            <strong className="text-lg text-slate-900">{detail.verdict}</strong>
          </div>
        </div>
        <dl className="text-sm text-slate-600">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('Confidence')}
          </dt>
          <dd className="mt-1 font-semibold text-slate-900">{t(detail.confidence)}</dd>
        </dl>
      </header>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          {t('Logline')}
        </h3>
        <p className="mt-2 text-base leading-7 text-slate-800">{screenplay.logline}</p>
      </div>

      <div className="grid gap-7 md:grid-cols-2">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {t('Strongest signals')}
          </h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-800">
            {screenplay.strengths.slice(0, 3).map((strength) => (
              <li key={strength}>{strength}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {t('Concerns')}
          </h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-800">
            {screenplay.weaknesses.slice(0, 3).map((concern) => (
              <li key={concern}>{concern}</li>
            ))}
          </ul>
        </section>
      </div>

      {screenplay.reviewReasons?.length ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <h3 className="text-sm font-semibold text-amber-900">{t('Human review recommended')}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-900">
            {screenplay.reviewReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <button
        type="button"
        onClick={onOpenCoverage}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
      >
        {t('Coverage')} →
      </button>
    </section>
  );
}
