import type {
  ProducerProjectionWarning,
  Screenplay,
} from '@/types';
import { useTranslation } from 'react-i18next';
import { buildIncompleteReaderWarning } from '@/lib/producerProjection';
import { formatProducerText } from '@/lib/producerDisplay';

interface AnalysisWarningsProps {
  screenplay: Screenplay;
}

const WARNING_STYLES: Record<
  ProducerProjectionWarning['severity'],
  { shell: string; title: string; label: string }
> = {
  blocking: {
    shell: 'border-red-500/35 bg-red-500/10',
    title: 'text-red-300',
    label: 'Decision blocked',
  },
  warning: {
    shell: 'border-amber-500/35 bg-amber-500/10',
    title: 'text-amber-300',
    label: 'Review required',
  },
  information: {
    shell: 'border-gold-500/25 bg-gold-500/10',
    title: 'text-gold-400',
    label: 'Context',
  },
};

function warningCopy(warning: ProducerProjectionWarning, t: ReturnType<typeof useTranslation>['t']) {
  const titleKey = `analysis.warning.${warning.code}.title`;
  const detailKey = `analysis.warning.${warning.code}.detail`;
  return {
    title: t(titleKey, { ...warning.params, defaultValue: warning.title }),
    detail: t(detailKey, { ...warning.params, defaultValue: warning.detail }),
  };
}

export function AnalysisWarnings({ screenplay }: AnalysisWarningsProps) {
  const { t } = useTranslation();
  const fallback = buildIncompleteReaderWarning(screenplay.analysisQuality);
  const projected = screenplay.producerProjection?.warnings;
  const warnings = projected?.length ? projected : fallback ? [fallback] : [];
  if (warnings.length === 0) return null;

  return (
    <section className="space-y-2" aria-label={t('Analysis trust warnings')}>
      {warnings.map((warning) => {
        const styles = WARNING_STYLES[warning.severity];
        const copy = warningCopy(warning, t);
        return (
          <div
            key={warning.code}
            className={`rounded-xl border p-4 ${styles.shell}`}
            data-warning-code={warning.code}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className={`text-[0.65rem] font-bold uppercase tracking-[0.16em] ${styles.title}`}>
                {t(styles.label)}
              </span>
              <h4 className={`text-sm font-semibold ${styles.title}`}>
                {formatProducerText(copy.title)}
              </h4>
            </div>
            <p className="mt-1.5 text-sm leading-6 text-black-200">
              {formatProducerText(copy.detail)}
            </p>
          </div>
        );
      })}
    </section>
  );
}
