/**
 * ProducerMetricsPanel — AI Market Analysis display.
 *
 * Shows AI-analyzed Market Potential and USP Strength with rationales.
 * Displays "N/A" for screenplays that haven't been re-analyzed yet.
 */

import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import type { Screenplay } from '@/types';
import { getScoreColorClass } from '@/lib/calculations';
import { SectionHeader } from './SectionHeader';

interface ProducerMetricsPanelProps {
    screenplay: Screenplay;
}

export function ProducerMetricsPanel({ screenplay }: ProducerMetricsPanelProps) {
    const { t } = useTranslation();
    if (!screenplay.producerMetrics) return null;

    const { producerMetrics } = screenplay;
    const hasAnyData = producerMetrics.marketPotential !== null || producerMetrics.uspStrength !== null;

    return (
        <div className="rounded-xl p-5 bg-black-900/30">
            <SectionHeader icon="🎯">{t('AI Market Analysis')}</SectionHeader>
            {!hasAnyData && (
                <p className="text-sm text-black-500 italic -mt-2">
                    {t('Not yet analyzed. Re-analyze this screenplay to generate AI market intelligence.')}
                </p>
            )}
            {hasAnyData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <MetricCard label={t('Market Potential')}>
                        {producerMetrics.marketPotential !== null ? (
                            <>
                                <span className={clsx('text-2xl font-bold', getScoreColorClass(producerMetrics.marketPotential))}>
                                    {producerMetrics.marketPotential}/10
                                </span>
                                {producerMetrics.marketPotentialRationale && (
                                    <p className="text-xs text-black-400 mt-2 leading-relaxed">
                                        {producerMetrics.marketPotentialRationale}
                                    </p>
                                )}
                            </>
                        ) : (
                            <span className="text-sm text-black-500 italic">{t('N/A')}</span>
                        )}
                    </MetricCard>
                    <MetricCard label={t('USP Strength')}>
                        {producerMetrics.uspStrength !== null ? (
                            <>
                                <span className={clsx(
                                    'text-xl font-bold',
                                    producerMetrics.uspStrength === 'Strong' && 'text-emerald-400',
                                    producerMetrics.uspStrength === 'Moderate' && 'text-gold-400',
                                    producerMetrics.uspStrength === 'Weak' && 'text-red-400'
                                )}>
                                    {t(producerMetrics.uspStrength)}
                                </span>
                                {producerMetrics.uspStrengthRationale && (
                                    <p className="text-xs text-black-400 mt-2 leading-relaxed">
                                        {producerMetrics.uspStrengthRationale}
                                    </p>
                                )}
                            </>
                        ) : (
                            <span className="text-sm text-black-500 italic">{t('N/A')}</span>
                        )}
                    </MetricCard>
                </div>
            )}
        </div>
    );
}

function MetricCard({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="p-4 rounded-lg bg-black-900/50">
            <div className="text-xs text-black-500 mb-2">{label}</div>
            <div>{children}</div>
        </div>
    );
}
