/**
 * ScoresPanel — Dimension scores and CVS breakdown side-by-side.
 */

import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { CVS_CONFIG } from '@/types';
import { getScoreColorClass } from '@/lib/calculations';
import { getDimensionDisplay, hasPillarScores } from '@/lib/dimensionDisplay';
import { toNumber } from '@/lib/utils';
import { ScoreBar } from '@/components/ui/ScoreBar';
import { SectionHeader } from './SectionHeader';
import { CVSFactor } from './CVSFactor';

interface ScoresPanelProps {
    screenplay: Screenplay;
}

export function ScoresPanel({ screenplay }: ScoresPanelProps) {
    const projection = screenplay.producerProjection;
    const scoreLabel = projection?.scoreSource === 'adjusted'
        ? 'Final adjusted score'
        : projection?.scoreSource === 'triage'
            ? 'Triage score'
            : 'Stored score';
    const rawScoreLabel = projection?.scoreSource === 'triage'
        ? 'Raw triage score'
        : 'Raw five-pillar score';

    return (
        <div className="grid md:grid-cols-2 gap-6">
            {/* Analysis evidence */}
            <div>
                <SectionHeader icon="📊">
                    {hasPillarScores(screenplay)
                        ? 'Five-Pillar Reader Evidence'
                        : 'Legacy Dimension Scores'}
                </SectionHeader>
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
                            <span className="text-lg font-medium text-gold-200">
                                {scoreLabel}
                            </span>
                            <span className={clsx(
                                'text-2xl font-bold',
                                getScoreColorClass(toNumber(screenplay.weightedScore))
                            )}>
                                {toNumber(screenplay.weightedScore).toFixed(2)}
                            </span>
                        </div>
                        {projection && (
                            <div
                                className="mt-4 space-y-2 rounded-xl border border-black-700 bg-black-900/40 p-3"
                                data-testid="score-lineage"
                            >
                                <div className="flex items-center justify-between gap-4 text-sm">
                                    <span className="text-black-300">{rawScoreLabel}</span>
                                    <span className="font-mono font-semibold text-black-100">
                                        {projection.rawScore.toFixed(2)}
                                    </span>
                                </div>
                                {Math.abs(projection.reportedPenalty - projection.penaltyApplied) > 0.005 && (
                                    <div className="flex items-center justify-between gap-4 text-sm">
                                        <span className="text-black-300">Critical-failure issues reported</span>
                                        <span className="font-mono font-semibold text-black-100">
                                            {projection.reportedPenalty.toFixed(2)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between gap-4 text-sm">
                                    <span className="text-black-300">Critical-failure deduction applied</span>
                                    <span className="font-mono font-semibold text-black-100">
                                        {projection.penaltyApplied > 0
                                            ? `−${projection.penaltyApplied.toFixed(2)}`
                                            : '0.00'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-4 border-t border-black-700 pt-2 text-sm">
                                    <span className="font-semibold text-black-100">Final score used for ranking</span>
                                    <span className="font-mono font-bold text-gold-200">
                                        {projection.finalScore.toFixed(2)}
                                    </span>
                                </div>
                                {projection.scoreSource === 'legacy_raw' && projection.reportedPenalty > 0 && (
                                    <p className="text-xs leading-5 text-black-400">
                                        This legacy record reports {projection.reportedPenalty.toFixed(2)} points of issues,
                                        but it does not prove that deduction was applied. The app does not subtract it again.
                                    </p>
                                )}
                            </div>
                        )}
                        {projection && projection.gates.some((gate) => gate.triggered) && (
                            <div className="mt-3 space-y-2" aria-label="Verdict gates">
                                {projection.gates.filter((gate) => gate.triggered).map((gate) => (
                                    <div
                                        key={gate.key}
                                        className="rounded-lg border border-black-700/80 bg-black-900/30 px-3 py-2"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-xs font-semibold uppercase tracking-wide text-black-200">
                                                {gate.label}
                                            </span>
                                            <span className="text-[0.65rem] font-bold uppercase tracking-wide text-amber-300">
                                                {gate.applied ? 'Applied' : 'Flagged'}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs leading-5 text-black-400">{gate.detail}</p>
                                    </div>
                                ))}
                            </div>
                        )}
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
                                    'text-2xl font-bold',
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
