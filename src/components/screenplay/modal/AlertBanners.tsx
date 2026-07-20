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

interface AlertBannersProps {
    screenplay: Screenplay;
}

export function AlertBanners({ screenplay }: AlertBannersProps) {
    return (
        <>
            {screenplay.analysisQuality?.status === 'partial' && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <h4 className="text-amber-400 font-semibold text-sm">Partial analysis</h4>
                    <p className="mt-1 text-amber-200/70 text-sm">
                        {screenplay.analysisQuality.completedReaders} of {screenplay.analysisQuality.expectedReaders} readers completed. The score was reweighted using only completed readers.
                        {screenplay.analysisQuality.failedReaders.length > 0 && ` Missing: ${screenplay.analysisQuality.failedReaders.map((reader) => reader.replaceAll('_', ' ')).join(', ')}.`}
                    </p>
                </div>
            )}

            {/* Verdict Statement */}
            <div className={clsx(
                'p-4 rounded-xl',
                screenplay.isFilmNow
                    ? 'bg-gradient-to-r from-gold-900/20 to-gold-800/10 border border-gold-500/30'
                    : 'bg-black-900/50'
            )}>
                <p className="text-black-200 leading-relaxed">{screenplay.verdictStatement}</p>
            </div>

            {/* Critical Failures */}
            {screenplay.criticalFailures.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <h4 className="text-amber-400/80 font-semibold mb-2 text-sm">⚑ Issues flagged in analysis</h4>
                    <ul className="list-disc list-inside space-y-1">
                        {screenplay.criticalFailures.map((failure, i) => (
                            <li key={i} className="text-amber-200/60 text-sm">
                                {typeof failure === 'string' ? failure : String((failure as Record<string, unknown>)?.failure || (failure as Record<string, unknown>)?.description || failure)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

        </>
    );
}
