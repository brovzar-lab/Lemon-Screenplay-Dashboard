import type { Screenplay } from '@/types';
import { useTranslation } from 'react-i18next';

export function AnalysisTrustBadge({ screenplay }: { screenplay: Screenplay }) {
  const { t } = useTranslation();
  const warnings = screenplay.producerProjection?.warnings ?? [];
  const blocking = warnings.filter((warning) => warning.severity === 'blocking');
  const review = warnings.filter((warning) => warning.severity === 'warning');

  if (blocking.length > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-red-300"
        title={blocking.map((warning) => t(`analysis.warning.${warning.code}.title`, { ...warning.params, defaultValue: warning.title })).join('. ')}
        aria-label={t('Decision blocked: {{warnings}}', { warnings: blocking.map((warning) => t(`analysis.warning.${warning.code}.title`, { ...warning.params, defaultValue: warning.title })).join(', ') })}
      >
        <span aria-hidden="true">!</span>
        {t('Not rankable')}
      </span>
    );
  }

  if (review.length > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-amber-300"
        title={review.map((warning) => t(`analysis.warning.${warning.code}.title`, { ...warning.params, defaultValue: warning.title })).join('. ')}
        aria-label={t('Review required: {{warnings}}', { warnings: review.map((warning) => t(`analysis.warning.${warning.code}.title`, { ...warning.params, defaultValue: warning.title })).join(', ') })}
      >
        <span aria-hidden="true">!</span>
        {t('Review')}
      </span>
    );
  }

  return null;
}
