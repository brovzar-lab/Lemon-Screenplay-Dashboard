/**
 * ProducerMetricsPanel — Dashboard heuristic estimates grid.
 */

import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { getScoreColorClass } from '@/lib/calculations';
import { toNumber } from '@/lib/utils';
import { SectionHeader } from './SectionHeader';

interface ProducerMetricsPanelProps {
    screenplay: Screenplay;
}

export function ProducerMetricsPanel({ screenplay }: ProducerMetricsPanelProps) {
    if (!screenplay.producerMetrics) return null;

    const { producerMetrics } = screenplay;

    return (
        <div className="border border-dashed border-black-600 rounded-xl p-5">
            <SectionHeader icon="🎬">Dashboard Estimates</SectionHeader>
            <p className="text-xs text-black-500 -mt-3 mb-4">
                Computed from genre, budget, and score heuristics — not part of the AI analysis.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <MetricCard label="Market Potential">
                    <span className={clsx('text-2xl font-mono font-bold', getScoreColorClass(toNumber(producerMetrics.marketPotential)))}>
                        {toNumber(producerMetrics.marketPotential)}/10
                    </span>
                </MetricCard>
                <MetricCard label="Production Risk">
                    <span className={clsx(
                        'text-xl font-bold',
                        producerMetrics.productionRisk === 'Low' && 'text-emerald-400',
                        producerMetrics.productionRisk === 'Medium' && 'text-gold-400',
                        producerMetrics.productionRisk === 'High' && 'text-red-400'
                    )}>
                        {producerMetrics.productionRisk || 'N/A'}
                    </span>
                </MetricCard>
                <MetricCard label="Star Vehicle">
                    <span className={clsx('text-2xl font-mono font-bold', getScoreColorClass(toNumber(producerMetrics.starVehiclePotential)))}>
                        {toNumber(producerMetrics.starVehiclePotential)}/10
                    </span>
                </MetricCard>
                <MetricCard label="Festival Appeal">
                    <span className={clsx('text-2xl font-mono font-bold', getScoreColorClass(toNumber(producerMetrics.festivalAppeal)))}>
                        {toNumber(producerMetrics.festivalAppeal)}/10
                    </span>
                </MetricCard>
                <MetricCard label="ROI Indicator">
                    <span className="text-xl text-gold-400">
                        {'★'.repeat(Math.min(5, Math.max(0, Math.floor(toNumber(producerMetrics.roiIndicator, 3)))))}
                        {'☆'.repeat(Math.max(0, 5 - Math.floor(toNumber(producerMetrics.roiIndicator, 3))))}
                    </span>
                </MetricCard>
                <MetricCard label="USP Strength">
                    <span className={clsx(
                        'text-xl font-bold',
                        producerMetrics.uspStrength === 'Strong' && 'text-emerald-400',
                        producerMetrics.uspStrength === 'Moderate' && 'text-gold-400',
                        producerMetrics.uspStrength === 'Weak' && 'text-red-400'
                    )}>
                        {producerMetrics.uspStrength || 'N/A'}
                    </span>
                </MetricCard>
            </div>
        </div>
    );
}

function MetricCard({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="p-4 rounded-lg bg-black-900/50 text-center">
            <div className="text-xs text-black-500 mb-1">{label}</div>
            <div>{children}</div>
        </div>
    );
}
