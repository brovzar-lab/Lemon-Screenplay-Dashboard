/**
 * AlertBanners — Verdict, False Positive Warning, Critical Failures.
 */

import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import type { ScreenplayWithV6 } from '@/lib/normalize';
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
                            <li key={i} className="text-red-300 text-sm">{failure}</li>
                        ))}
                    </ul>
                </div>
            )}
        </>
    );
}

function FalsePositiveWarning({ screenplay }: { screenplay: Screenplay & ScreenplayWithV6 }) {
    const traps = screenplay.trapsTriggered ?? 0;
    const severity = traps >= 3 ? 'high' : traps >= 2 ? 'moderate' : 'low';
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
        high: 'This script has characteristics that often lead to disappointing outcomes. The verdict has been capped at CONSIDER. Review execution quality carefully.',
        moderate: 'This script has been downgraded one tier due to potential false positive indicators. Verify execution matches the premise quality.',
        low: 'A minor flag was detected. The core quality may be slightly inflated by attractive surface elements.',
    };

    return (
        <div className={clsx('p-4 rounded-xl border', colors[severity].bg)}>
            <h4 className={clsx('font-bold mb-2', colors[severity].title)}>
                {labels[severity]} ({traps} trap{traps > 1 ? 's' : ''} triggered)
            </h4>
            <p className={clsx('text-sm', colors[severity].text)}>
                {descriptions[severity]}
            </p>
            {screenplay.v6CoreQuality?.false_positive_check?.traps_evaluated && (
                <div className="mt-3 text-xs text-black-400">
                    <span className="font-medium">Triggered traps: </span>
                    {screenplay.v6CoreQuality.false_positive_check.traps_evaluated
                        .filter(trap => trap.triggered)
                        .map(trap => trap.name.replace(/_/g, ' '))
                        .join(', ')}
                </div>
            )}
        </div>
    );
}
