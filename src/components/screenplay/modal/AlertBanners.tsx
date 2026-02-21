/**
 * AlertBanners — Verdict, False Positive Warning, Critical Failures.
 *
 * Uses the Weighted Trap Tier system:
 * 🔴 Fundamental (1.0) — hard to fix
 * 🟡 Addressable (0.5) — fixable in development
 * ⚪ Warning (0.0) — informational only
 */

import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import type { ScreenplayWithV6 } from '@/lib/normalize';
import { getTrapInfo, calculateWeightedTrapScore } from '@/types/screenplay-v6';
import { hasV6Fields } from './utils';

interface AlertBannersProps {
    screenplay: Screenplay;
}

export function AlertBanners({ screenplay }: AlertBannersProps) {
    return (
        <>
            {/* Verdict Statement */}
            <div className={clsx(
                'p-4 rounded-xl',
                screenplay.isFilmNow
                    ? 'bg-gradient-to-r from-gold-900/20 to-gold-800/10 border border-gold-500/30'
                    : 'bg-black-900/50'
            )}>
                <p className="text-black-200 leading-relaxed">{screenplay.verdictStatement}</p>
            </div>

            {/* V6 False Positive Warning */}
            {hasV6Fields(screenplay) && screenplay.trapsTriggered && screenplay.trapsTriggered > 0 && (
                <FalsePositiveWarning screenplay={screenplay as Screenplay & ScreenplayWithV6} />
            )}

            {/* Critical Failures */}
            {screenplay.criticalFailures.length > 0 && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                    <h4 className="text-red-400 font-bold mb-2">⚠️ Critical Failures (Auto-PASS)</h4>
                    <ul className="list-disc list-inside space-y-1">
                        {screenplay.criticalFailures.map((failure, i) => (
                            <li key={i} className="text-red-300 text-sm">
                                {typeof failure === 'string' ? failure : String((failure as Record<string, unknown>)?.failure || (failure as Record<string, unknown>)?.description || failure)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </>
    );
}

function FalsePositiveWarning({ screenplay }: { screenplay: Screenplay & ScreenplayWithV6 }) {
    const trapsEvaluated = screenplay.v6CoreQuality?.false_positive_check?.traps_evaluated ?? [];
    const triggeredTraps = trapsEvaluated.filter(t => t.triggered);
    const weightedScore = screenplay.v6CoreQuality?.false_positive_check?.weighted_trap_score
        ?? calculateWeightedTrapScore(trapsEvaluated);

    // Determine severity based on weighted score, not raw count
    const severity = weightedScore >= 3.0 ? 'high' : weightedScore >= 2.0 ? 'moderate' : 'low';

    const colors = {
        high: { bg: 'bg-red-500/10 border-red-500/30', title: 'text-red-400', text: 'text-red-300' },
        moderate: { bg: 'bg-orange-500/10 border-orange-500/30', title: 'text-orange-400', text: 'text-orange-300' },
        low: { bg: 'bg-yellow-500/10 border-yellow-500/30', title: 'text-yellow-400', text: 'text-yellow-300' },
    };
    const labels = {
        high: '🚨 High False Positive Risk',
        moderate: '⚠️ Moderate False Positive Risk',
        low: '💡 False Positive Flag',
    };
    const descriptions = {
        high: 'This script has fundamental craft issues that are difficult to address in development. The verdict has been capped at CONSIDER.',
        moderate: 'This script has been downgraded one tier due to false positive indicators. Review the triggered traps to assess development feasibility.',
        low: 'Minor flags detected. These are typically addressable through development and editorial guidance.',
    };

    // Categorize triggered traps by tier
    const fundamentalTraps = triggeredTraps.filter(t => getTrapInfo(t.name).tier === 'fundamental');
    const addressableTraps = triggeredTraps.filter(t => getTrapInfo(t.name).tier === 'addressable');
    const warningTraps = triggeredTraps.filter(t => getTrapInfo(t.name).tier === 'warning');

    return (
        <div className={clsx('p-4 rounded-xl border', colors[severity].bg)}>
            <h4 className={clsx('font-bold mb-2', colors[severity].title)}>
                {labels[severity]} (weighted score: {weightedScore.toFixed(1)})
            </h4>
            <p className={clsx('text-sm mb-3', colors[severity].text)}>
                {descriptions[severity]}
            </p>

            {/* Triggered traps by tier */}
            {triggeredTraps.length > 0 && (
                <div className="space-y-2">
                    {fundamentalTraps.length > 0 && (
                        <div className="text-xs">
                            <span className="font-semibold text-red-400">🔴 Fundamental: </span>
                            <span className="text-red-300">
                                {fundamentalTraps.map(t => getTrapInfo(t.name).label).join(', ')}
                            </span>
                        </div>
                    )}
                    {addressableTraps.length > 0 && (
                        <div className="text-xs">
                            <span className="font-semibold text-yellow-400">🟡 Addressable: </span>
                            <span className="text-yellow-300">
                                {addressableTraps.map(t => getTrapInfo(t.name).label).join(', ')}
                            </span>
                        </div>
                    )}
                    {warningTraps.length > 0 && (
                        <div className="text-xs">
                            <span className="font-semibold text-black-400">⚪ Dev opportunity: </span>
                            <span className="text-black-300">
                                {warningTraps.map(t => getTrapInfo(t.name).label).join(', ')}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
