/**
 * ScoresPanel — Dimension scores and CVS breakdown side-by-side.
 */

import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { CVS_CONFIG } from '@/types';
import { getScoreColorClass } from '@/lib/calculations';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import { toNumber } from '@/lib/utils';
import { ScoreBar } from '@/components/ui/ScoreBar';
import { SectionHeader } from './SectionHeader';
import { CVSFactor } from './CVSFactor';

interface ScoresPanelProps {
    screenplay: Screenplay;
}

export function ScoresPanel({ screenplay }: ScoresPanelProps) {
    return (
        <div className="grid md:grid-cols-2 gap-6">
            {/* Dimension Scores */}
            <div>
                <SectionHeader icon="📊">Dimension Scores</SectionHeader>
                <div className="space-y-4">
                    {getDimensionDisplay(screenplay).map((dim) => (
                        <ScoreBar
                            key={dim.key}
                            label={`${dim.label} (${Math.round(dim.weight * 100)}%)`}
                            score={dim.score}
                            showJustification
                            justification={dim.justification}
                        />
                    ))}
                    <div className="pt-4 border-t border-black-700">
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-medium text-gold-200">Weighted Score</span>
                            <span className={clsx(
                                'text-2xl font-mono font-bold',
                                getScoreColorClass(toNumber(screenplay.weightedScore))
                            )}>
                                {toNumber(screenplay.weightedScore).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* CVS Breakdown */}
            <div>
                <SectionHeader icon="💰">Commercial Viability Score</SectionHeader>
                {screenplay.commercialViability.cvsAssessed === false ? (
                    <div className="p-4 rounded-lg bg-black-900/50 border border-black-700 border-dashed">
                        <p className="text-sm text-black-400 italic">
                            Commercial viability was not assessed for this screenplay (commercial lens was not enabled during analysis).
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {CVS_CONFIG.map(({ key, label }) => (
                            <CVSFactor
                                key={key}
                                label={label}
                                score={screenplay.commercialViability[key].score}
                                note={screenplay.commercialViability[key].note}
                            />
                        ))}
                        <div className="pt-4 border-t border-black-700 mt-4">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-medium text-gold-200">CVS Total</span>
                                <span className={clsx(
                                    'text-2xl font-mono font-bold',
                                    getScoreColorClass(toNumber(screenplay.cvsTotal), 18)
                                )}>
                                    {toNumber(screenplay.cvsTotal)}/18
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
