/**
 * ScoresPanel — Dimension scores and CVS breakdown side-by-side.
 */

import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import type { Screenplay } from '@/types';
import { CVS_CONFIG } from '@/types';
import { getScoreColorClass } from '@/lib/calculations';
import { getDimensionDisplay, hasPillarScores } from '@/lib/dimensionDisplay';
import { toNumber } from '@/lib/utils';
import { formatProducerHeading, formatProducerText } from '@/lib/producerDisplay';
import { isCoverageV1Screenplay, isDecisionReady } from '@/lib/producerProjection';
import { ScoreBar } from '@/components/ui/ScoreBar';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { SectionHeader } from './SectionHeader';
import { CVSFactor } from './CVSFactor';

interface ScoresPanelProps {
    screenplay: Screenplay;
    presentation?: 'default' | 'workspace';
    onOpenReaderRoom?: () => void;
}

function signalDescription(score: number): string {
    if (score >= 8) return 'Standout';
    if (score >= 7) return 'Strong signal';
    if (score >= 5.5) return 'Needs development';
    return 'Material risk';
}

function DevelopmentSignalMap({
    screenplay,
    onOpenReaderRoom,
}: {
    screenplay: Screenplay;
    onOpenReaderRoom?: () => void;
}) {
    const { t } = useTranslation();
    const decisionReady = isDecisionReady(screenplay);
    const dimensions = getDimensionDisplay(screenplay);
    const ranked = [...dimensions].sort((left, right) => right.score - left.score);
    const strongest = ranked[0];
    const weakest = ranked[ranked.length - 1];
    const projection = screenplay.producerProjection;
    const quality = screenplay.analysisQuality;
    const strongestEvidence = screenplay.strengths[0];
    const weakestEvidence = screenplay.majorWeaknesses[0]
        ?? screenplay.weaknesses[0]
        ?? undefined;
    const trustLabel = projection?.trustStatus === 'verified'
        ? 'Verified evidence'
        : projection?.trustStatus === 'incomplete'
            ? 'Incomplete evidence'
            : projection?.trustStatus === 'legacy_unverified'
                ? 'Legacy evidence'
                : 'Trust not available';
    const boundaryLabel = projection?.boundary.checked
        ? projection.boundary.stable ? 'Stable boundary' : 'Unstable boundary'
        : 'Boundary not checked';
    const disagreementCount = projection?.readerDisagreementCount;

    return (
        <section className="development-map" aria-labelledby="development-signal-map-title">
            <header className="development-map__header">
                <div>
                    <p className="development-map__kicker">{t(decisionReady ? 'Decision clarity' : 'Trust')}</p>
                    <h3 id="development-signal-map-title">
                        {t(decisionReady ? 'Development Signal Map' : 'Decision data unavailable until verification')}
                    </h3>
                    <p>{t('One shared scale shows where the screenplay is strongest, where development work concentrates, and how much trust to place in the result.')}</p>
                </div>
                <div className="development-map__decision">
                    {decisionReady ? <>
                        <span>{t('Final score')}</span>
                        <strong>{screenplay.weightedScore.toFixed(1)}</strong>
                        <b>{t(screenplay.recommendation === 'film_now' ? 'Film Now' : formatProducerHeading(screenplay.recommendation))}</b>
                    </> : <b>{t('Not verified / not rankable')}</b>}
                </div>
            </header>

            <div className="development-map__trust" aria-label={t('Analysis trust summary')}>
                <span><b>{t('Trust')}</b>{t(trustLabel)}</span>
                <span><b>{t('Reader panel')}</b>{quality ? t('{{complete}} of {{expected}} readers', { complete: quality.completedReaders, expected: quality.expectedReaders }) : t('Not available')}</span>
                <span><b>{t('Boundary')}</b>{t(boundaryLabel)}</span>
                <span><b>{t('Roundtable')}</b>{disagreementCount === undefined ? t('Not available') : t('{{count}} disagreement', { count: disagreementCount })}</span>
            </div>

            <div className="development-map__scale" aria-label={t('Five reader scores on a shared one to ten scale')}>
                <div className="development-map__axis" aria-hidden="true">
                    <span>{t('Material risk')}</span><span>{t('Developing')}</span><span>{t('Strong')}</span><span>{t('Standout')}</span>
                </div>
                {dimensions.map((dimension) => (
                    <article className="development-map__row" key={dimension.key}>
                        <div className="development-map__reader">
                            <strong>{t(dimension.label)}</strong>
                            <span>{t(signalDescription(dimension.score))}</span>
                        </div>
                        <div className="development-map__cells" aria-label={t('{{label}}: {{score}} out of 10', { label: t(dimension.label), score: dimension.score.toFixed(1) })}>
                            {Array.from({ length: 10 }, (_, index) => {
                                const filled = index + 1 <= Math.round(dimension.score);
                                return <i key={index} className={clsx(filled && 'is-filled', index + 1 === Math.round(dimension.score) && 'is-marker')} />;
                            })}
                        </div>
                        <strong className="development-map__score">{dimension.score.toFixed(1)}</strong>
                    </article>
                ))}
            </div>

            <div className="development-map__drivers">
                <article className="development-map__driver development-map__driver--strength">
                    <span>{t('Strongest signal')}</span>
                    <h4>{strongest ? `${t(strongest.label)} · ${strongest.score.toFixed(1)}` : t('Not available')}</h4>
                    <p>{strongestEvidence ? formatProducerText(strongestEvidence) : t('No written strength was preserved.')}</p>
                </article>
                <article className="development-map__driver development-map__driver--risk">
                    <span>{t('Primary development risk')}</span>
                    <h4>{weakest ? `${t(weakest.label)} · ${weakest.score.toFixed(1)}` : t('Not available')}</h4>
                    <p>{weakestEvidence ? formatProducerText(weakestEvidence) : t('No written development risk was preserved.')}</p>
                </article>
            </div>

            {onOpenReaderRoom && (
                <button type="button" className="development-map__reader-link" onClick={onOpenReaderRoom}>
                    {t('Open the Reader Room for the evidence behind these scores')}
                </button>
            )}

            {projection && decisionReady && (
                <div className="development-map__lineage" data-testid="score-lineage">
                    <span><b>{t('Raw five-reader score')}</b>{projection.rawScore.toFixed(2)}</span>
                    <span><b>{t('Verified deduction')}</b>{projection.penaltyApplied > 0 ? `−${projection.penaltyApplied.toFixed(2)}` : '0.00'}</span>
                    <span><b>{t('Final ranking score')}</b>{projection.finalScore.toFixed(2)}</span>
                </div>
            )}

            <section className="development-map__commercial" aria-labelledby="development-commercial-title">
                <h4 id="development-commercial-title">{t('Commercial viability')}</h4>
                {screenplay.commercialViability.cvsAssessed === false ? (
                    <p>{t('Not assessed in this analysis.')}</p>
                ) : (
                    <div>
                        {CVS_CONFIG.map(({ key, label }) => (
                            <span key={key}><b>{t(label)}</b>{screenplay.commercialViability[key].score}/3</span>
                        ))}
                        <strong>{toNumber(screenplay.cvsTotal)}/18 {t('total')}</strong>
                    </div>
                )}
            </section>
        </section>
    );
}

export function ScoresPanel({ screenplay, presentation = 'default', onOpenReaderRoom }: ScoresPanelProps) {
    const { t } = useTranslation();
    const isWorkspace = presentation === 'workspace';
    const projection = screenplay.producerProjection;
    const decisionReady = isDecisionReady(screenplay);
    const isCoverage = isCoverageV1Screenplay(screenplay);
    const scoreLabel = projection?.scoreSource === 'adjusted'
        ? 'Final adjusted score'
        : projection?.scoreSource === 'triage'
            ? 'Triage score'
            : 'Stored score';
    const rawScoreLabel = projection?.scoreSource === 'triage'
        ? 'Raw triage score'
        : 'Raw five-pillar score';

    if (isCoverage) {
        return (
            <section className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-5" aria-label={t('Coverage')}>
                <div className="flex flex-wrap items-center gap-3">
                    <RecommendationBadge tier={screenplay.recommendation} />
                    <strong className="text-lg text-black-100">{screenplay.coverage?.verdict}</strong>
                </div>
                <p className="mt-3 text-sm font-semibold text-sky-200">
                    {t('Coverage · unscored by design')}
                </p>
                {screenplay.coverage?.confidence && (
                    <p className="mt-2 text-sm text-black-300">
                        {t('Confidence')}: <strong>{t(screenplay.coverage.confidence)}</strong>
                    </p>
                )}
            </section>
        );
    }

    if (isWorkspace) {
        return <DevelopmentSignalMap screenplay={screenplay} onOpenReaderRoom={onOpenReaderRoom} />;
    }

    return (
        <div className={clsx(
            'grid gap-6',
            isWorkspace ? 'xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)] xl:gap-10' : 'md:grid-cols-2',
        )}>
            {/* Analysis evidence */}
            <div>
                {!decisionReady && (
                    <p role="status" className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                        {t('Decision data unavailable until verification')}
                    </p>
                )}
                <SectionHeader icon={isWorkspace ? undefined : '📊'}>
                    {!decisionReady
                        ? t('Decision data unavailable until verification')
                        : hasPillarScores(screenplay)
                        ? t('Five-Pillar Reader Evidence')
                        : t('Legacy Dimension Scores')}
                </SectionHeader>
                <div className="space-y-4">
                    {getDimensionDisplay(screenplay).map((dim) => (
                        <ScoreBar
                            key={dim.key}
                            label={`${t(dim.label)} (${Math.round(dim.weight * 100)}%)`}
                            score={dim.score}
                            showJustification
                            justification={formatProducerText(dim.justification)}
                        />
                    ))}
                    <div className="pt-4 border-t border-black-700">
                        {decisionReady && (!isWorkspace || !projection) && (
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-medium text-gold-200">
                                    {t(scoreLabel)}
                                </span>
                                <span className={clsx(
                                    'text-2xl font-bold',
                                    getScoreColorClass(toNumber(screenplay.weightedScore))
                                )}>
                                    {toNumber(screenplay.weightedScore).toFixed(2)}
                                </span>
                            </div>
                        )}
                        {projection && decisionReady && (
                            <div
                                className={clsx(
                                    'mt-4 space-y-2 border border-black-700 p-3',
                                    isWorkspace ? 'rounded-sm bg-black-900/20' : 'rounded-xl bg-black-900/40',
                                )}
                                data-testid="score-lineage"
                            >
                                <div className="flex items-center justify-between gap-4 text-sm">
                                    <span className="text-black-300">{t(rawScoreLabel)}</span>
                                    <span className="font-mono font-semibold text-black-100">
                                        {projection.rawScore.toFixed(2)}
                                    </span>
                                </div>
                                {Math.abs(projection.reportedPenalty - projection.penaltyApplied) > 0.005 && (
                                    <div className="flex items-center justify-between gap-4 text-sm">
                                        <span className="text-black-300">{t('Critical-failure issues reported')}</span>
                                        <span className="font-mono font-semibold text-black-100">
                                            {projection.reportedPenalty.toFixed(2)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between gap-4 text-sm">
                                    <span className="text-black-300">{t('Critical-failure deduction applied')}</span>
                                    <span className="font-mono font-semibold text-black-100">
                                        {projection.penaltyApplied > 0
                                            ? `−${projection.penaltyApplied.toFixed(2)}`
                                            : '0.00'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-4 border-t border-black-700 pt-2 text-sm">
                                    <span className="font-semibold text-black-100">{t('Final score used for ranking')}</span>
                                    <span className="font-mono font-bold text-gold-200">
                                        {projection.finalScore.toFixed(2)}
                                    </span>
                                </div>
                                {projection.scoreSource === 'legacy_raw' && projection.reportedPenalty > 0 && (
                                    <p className="text-xs leading-5 text-black-400">
                                        {t('This legacy record reports {{points}} points of issues, but it does not prove that deduction was applied. The app does not subtract it again.', { points: projection.reportedPenalty.toFixed(2) })}
                                    </p>
                                )}
                            </div>
                        )}
                        {projection && decisionReady && projection.gates.some((gate) => gate.triggered) && (
                            <div className="mt-3 space-y-2" aria-label={t('Verdict gates')}>
                                {projection.gates.filter((gate) => gate.triggered).map((gate) => (
                                    <div
                                        key={gate.key}
                                        className="rounded-lg border border-black-700/80 bg-black-900/30 px-3 py-2"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-xs font-semibold uppercase tracking-wide text-black-200">
                                                {formatProducerHeading(gate.label)}
                                            </span>
                                            <span className="text-[0.65rem] font-bold uppercase tracking-wide text-amber-300">
                                                {t(gate.applied ? 'Applied' : 'Flagged')}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-xs leading-5 text-black-400">{formatProducerText(gate.detail)}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* CVS Breakdown */}
            <div>
                <SectionHeader icon={isWorkspace ? undefined : '💰'}>{t('Commercial Viability Score')}</SectionHeader>
                {screenplay.commercialViability.cvsAssessed === false ? (
                    <div className="p-4 rounded-lg bg-black-900/50 border border-black-700 border-dashed">
                        <p className="text-sm text-black-400 italic">
                            {t('Commercial viability was not assessed for this screenplay (commercial lens was not enabled during analysis).')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {CVS_CONFIG.map(({ key, label }) => (
                            <CVSFactor
                                key={key}
                                label={t(label)}
                                score={screenplay.commercialViability[key].score}
                                note={screenplay.commercialViability[key].note}
                            />
                        ))}
                        <div className="pt-4 border-t border-black-700 mt-4">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-medium text-gold-200">{t('CVS Total')}</span>
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
