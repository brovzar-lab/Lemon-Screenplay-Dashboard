/**
 * FeedbackSection — Structured producer feedback on a screenplay analysis.
 *
 * Displayed in the screenplay modal, allowing the admin to:
 * - Override the overall score and verdict
 * - Override the displayed specialist pillars (or honest legacy dimensions)
 * - Add corrections and highlights
 * - Mark greenlight decision
 *
 * Feedback is stored in Firestore and used by the Calibration Profile
 * to tune future AI analyses.
 */

import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { DIMENSION_CONFIG, type Screenplay } from '@/types';
import { SectionHeader } from './SectionHeader';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import {
    saveFeedback,
    loadFeedback,
    type ScreenplayFeedback,
    type DimensionOverride,
} from '@/lib/feedbackStore';

interface FeedbackSectionProps {
    screenplay: Screenplay;
}

const VERDICTS = ['pass', 'consider', 'recommend', 'film_now'] as const;

function verdictLabel(v: string): string {
    return v.replace(/_/g, ' ').toUpperCase();
}

function verdictColor(v: string): string {
    switch (v) {
        case 'film_now': return 'bg-gold-500/20 text-gold-300 border-gold-500/40';
        case 'recommend': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
        case 'consider': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
        case 'pass': return 'bg-red-500/20 text-red-300 border-red-500/40';
        default: return 'bg-black-700 text-black-300 border-black-600';
    }
}

function buildEvidenceOverrides(
    screenplay: Screenplay,
): Record<string, DimensionOverride> {
    return Object.fromEntries(
        getDimensionDisplay(screenplay).map((dimension) => [
            dimension.key,
            {
                aiScore: dimension.score,
                userScore: dimension.score,
            },
        ]),
    );
}

export function FeedbackSection({ screenplay }: FeedbackSectionProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loaded, setLoaded] = useState(false);

    // Feedback state
    const [userScore, setUserScore] = useState<number | null>(null);
    const [userVerdict, setUserVerdict] = useState<string | null>(null);
    const [dimensionOverrides, setDimensionOverrides] = useState<Record<string, DimensionOverride>>({});
    const [aiMissed, setAiMissed] = useState('');
    const [aiGotRight, setAiGotRight] = useState('');
    const [greenlight, setGreenlight] = useState<'yes' | 'no' | 'maybe' | null>(null);
    const evidenceDimensions = getDimensionDisplay(screenplay);
    const currentEvidenceKeys = new Set(
        evidenceDimensions.map((dimension) => dimension.key),
    );
    const preservedLegacyOverrides = Object.entries(dimensionOverrides).filter(
        ([key]) => !currentEvidenceKeys.has(key),
    );

    // Load existing feedback
    useEffect(() => {
        if (!screenplay.id || loaded) return;
        loadFeedback(screenplay.id).then((fb) => {
            if (fb) {
                setUserScore(fb.userScore);
                setUserVerdict(fb.userVerdict);
                setDimensionOverrides({
                    ...buildEvidenceOverrides(screenplay),
                    ...fb.dimensionOverrides,
                });
                setAiMissed(fb.aiMissed);
                setAiGotRight(fb.aiGotRight);
                setGreenlight(fb.greenlight);
                setIsOpen(true);
            }
            setLoaded(true);
        });
    }, [screenplay, loaded]);

    // Initialize dimension overrides with AI scores
    useEffect(() => {
        if (Object.keys(dimensionOverrides).length > 0) return;
        const initial = buildEvidenceOverrides(screenplay);
        // Use functional update to avoid stale closure; only runs when overrides are empty
        setDimensionOverrides((current) => Object.keys(current).length > 0 ? current : initial);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screenplay.id]); // Only re-init on screenplay change, not on overrides change

    const handleSave = useCallback(async () => {
        setSaving(true);
        const feedback: ScreenplayFeedback = {
            screenplayId: screenplay.id,
            screenplayTitle: screenplay.title,
            userScore,
            userVerdict,
            dimensionOverrides,
            aiMissed,
            aiGotRight,
            greenlight,
            aiWeightedScore: screenplay.weightedScore,
            aiVerdict: screenplay.recommendation,
            updatedAt: new Date().toISOString(),
        };
        await saveFeedback(feedback);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }, [screenplay, userScore, userVerdict, dimensionOverrides, aiMissed, aiGotRight, greenlight]);

    const updateDimension = (key: string, score: number) => {
        setDimensionOverrides((prev) => ({
            ...prev,
            [key]: { ...prev[key], userScore: score },
        }));
    };

    const hasFeedback = userScore !== null || userVerdict !== null || aiMissed.trim() || aiGotRight.trim() || greenlight !== null;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <SectionHeader icon="🎯">{t('Producer Feedback')}</SectionHeader>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="btn btn-secondary text-sm"
                >
                    {isOpen ? t('Collapse') : hasFeedback ? t('Edit Feedback') : `+ ${t('Add Feedback')}`}
                </button>
            </div>

            {!isOpen && hasFeedback && (
                <div className="flex items-center gap-3 text-sm text-black-400">
                    {userScore !== null && <span>{t('Your Score:')} <strong className="text-gold-300">{userScore.toFixed(1)}</strong></span>}
                    {userVerdict && <span className={clsx('px-2 py-0.5 rounded text-xs border', verdictColor(userVerdict))}>{t(verdictLabel(userVerdict))}</span>}
                    {greenlight && <span>{greenlight === 'yes' ? '🟢' : greenlight === 'no' ? '🔴' : '🟡'} {t('Greenlight')}</span>}
                </div>
            )}

            {isOpen && (
                <div className="space-y-5 p-4 rounded-xl bg-black-900/50 border border-gold-500/10">
                    {/* Your Overall Score */}
                    <div>
                        <label className="text-xs text-black-500 uppercase tracking-wider mb-2 block">
                            {t('Your Overall Score')}
                            <span className="text-black-600 ml-2">({t('AI')}: {screenplay.weightedScore.toFixed(1)})</span>
                        </label>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="1"
                                max="10"
                                step="0.1"
                                value={userScore ?? screenplay.weightedScore}
                                onChange={(e) => setUserScore(parseFloat(e.target.value))}
                                className="flex-1 accent-gold-500"
                            />
                            <span className={clsx(
                                'text-2xl font-display font-bold min-w-[3rem] text-right',
                                (userScore ?? 0) >= 8 ? 'text-gold-400' :
                                    (userScore ?? 0) >= 6.5 ? 'text-emerald-400' :
                                        (userScore ?? 0) >= 5 ? 'text-blue-400' : 'text-red-400',
                            )}>
                                {(userScore ?? screenplay.weightedScore).toFixed(1)}
                            </span>
                        </div>
                        {userScore !== null && Math.abs(userScore - screenplay.weightedScore) >= 0.5 && (
                            <p className="text-xs text-amber-400 mt-1">
                                Δ {(userScore - screenplay.weightedScore) >= 0 ? '+' : ''}{(userScore - screenplay.weightedScore).toFixed(1)} {t('from AI')}
                            </p>
                        )}
                    </div>

                    {/* Your Verdict */}
                    <div>
                        <label className="text-xs text-black-500 uppercase tracking-wider mb-2 block">
                            {t('Your Verdict')}
                            <span className="text-black-600 ml-2">({t('AI')}: {t(verdictLabel(screenplay.recommendation))})</span>
                        </label>
                        <div className="flex gap-2">
                            {VERDICTS.map((v) => (
                                <button
                                    key={v}
                                    onClick={() => setUserVerdict(userVerdict === v ? null : v)}
                                    className={clsx(
                                        'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all',
                                        userVerdict === v
                                            ? verdictColor(v)
                                            : 'bg-black-800 text-black-400 border-black-700 hover:border-black-500',
                                    )}
                                >
                                    {t(verdictLabel(v))}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Per-evidence score overrides */}
                    <div>
                        <label className="text-xs text-black-500 uppercase tracking-wider mb-3 block">
                            {screenplay.pillarScores?.length
                                ? t('Five-Pillar Score Overrides')
                                : t('Legacy Dimension Score Overrides')}
                        </label>
                        <div className="space-y-2">
                            {evidenceDimensions.map((dim) => {
                                const override = dimensionOverrides[dim.key];
                                if (!override) return null;
                                const delta = override.userScore - override.aiScore;
                                return (
                                    <div key={dim.key} className="flex items-center gap-3">
                                        <span className="text-xs text-black-400 w-28 shrink-0">{t(dim.label)}</span>
                                        <span className="text-xs text-black-600 w-8 text-right">{override.aiScore.toFixed(1)}</span>
                                        <input
                                            type="range"
                                            min="1"
                                            max="10"
                                            step="0.1"
                                            value={override.userScore}
                                            onChange={(e) => updateDimension(dim.key, parseFloat(e.target.value))}
                                            className="flex-1 accent-gold-500"
                                        />
                                        <span className={clsx(
                                            'text-sm w-8 text-right',
                                            override.userScore >= 8 ? 'text-gold-400' :
                                                override.userScore >= 6 ? 'text-emerald-400' : 'text-black-300',
                                        )}>
                                            {override.userScore.toFixed(1)}
                                        </span>
                                        {Math.abs(delta) >= 0.5 && (
                                            <span className={clsx('text-xs w-10', delta > 0 ? 'text-emerald-400' : 'text-red-400')}>
                                                {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {preservedLegacyOverrides.length > 0 && (
                            <div
                                className="mt-4 border-t border-black-700 pt-4"
                                data-testid="preserved-legacy-feedback"
                            >
                                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-300">
                                    {t('Previously Saved Legacy Dimension Overrides')}
                                </p>
                                <p className="mb-3 text-xs leading-5 text-black-500">
                                    {t('These producer corrections belong to the older seven-dimension system. They are preserved as historical feedback and are not relabeled as five-pillar evidence.')}
                                </p>
                                <div className="space-y-2">
                                    {preservedLegacyOverrides.map(([key, override]) => {
                                        const label = DIMENSION_CONFIG.find(
                                            (dimension) => dimension.key === key,
                                        )?.label ?? key.replaceAll('_', ' ');
                                        const delta = override.userScore - override.aiScore;
                                        return (
                                            <div key={key} className="flex items-center gap-3">
                                                <span className="w-28 shrink-0 text-xs text-black-400">
                                                    {label}
                                                </span>
                                                <span className="w-8 text-right text-xs text-black-600">
                                                    {override.aiScore.toFixed(1)}
                                                </span>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="10"
                                                    step="0.1"
                                                    value={override.userScore}
                                                    onChange={(event) =>
                                                        updateDimension(
                                                            key,
                                                            parseFloat(event.target.value),
                                                        )}
                                                    className="flex-1 accent-gold-500"
                                                    aria-label={t('{{label}} legacy override', { label: t(label) })}
                                                />
                                                <span className="w-8 text-right text-sm text-black-300">
                                                    {override.userScore.toFixed(1)}
                                                </span>
                                                {Math.abs(delta) >= 0.5 && (
                                                    <span
                                                        className={clsx(
                                                            'w-10 text-xs',
                                                            delta > 0
                                                                ? 'text-emerald-400'
                                                                : 'text-red-400',
                                                        )}
                                                    >
                                                        {delta > 0 ? '+' : ''}
                                                        {delta.toFixed(1)}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Greenlight Decision */}
                    <div>
                        <label className="text-xs text-black-500 uppercase tracking-wider mb-2 block">
                            {t('Would You Greenlight This?')}
                        </label>
                        <div className="flex gap-3">
                            {([['yes', '🟢', 'Yes'], ['maybe', '🟡', 'Maybe'], ['no', '🔴', 'No']] as const).map(([val, icon, label]) => (
                                <button
                                    key={val}
                                    onClick={() => setGreenlight(greenlight === val ? null : val)}
                                    className={clsx(
                                        'px-4 py-2 rounded-lg text-sm border transition-all',
                                        greenlight === val
                                            ? val === 'yes' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                                : val === 'no' ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                            : 'bg-black-800 text-black-400 border-black-700 hover:border-black-500',
                                    )}
                                >
                                    {icon} {t(label)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Free-text feedback */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-black-500 uppercase tracking-wider mb-1 block">
                                {t('What the AI Missed')}
                            </label>
                            <textarea
                                className="input w-full resize-none text-sm"
                                rows={3}
                                placeholder={t('e.g., The protagonist is passive in Act 2...')}
                                value={aiMissed}
                                onChange={(e) => setAiMissed(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-black-500 uppercase tracking-wider mb-1 block">
                                {t('What the AI Got Right')}
                            </label>
                            <textarea
                                className="input w-full resize-none text-sm"
                                rows={3}
                                placeholder={t('e.g., Budget assessment was spot on...')}
                                value={aiGotRight}
                                onChange={(e) => setAiGotRight(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex items-center justify-between pt-2">
                        <p className="text-xs text-black-600">
                            {t('Feedback trains the Calibration Profile in Settings → Calibration')}
                        </p>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={clsx(
                                'px-6 py-2 rounded-lg font-medium text-sm transition-all',
                                saved
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-gradient-to-r from-gold-500/80 to-amber-500/80 text-black-900 hover:from-gold-400 hover:to-amber-400',
                            )}
                        >
                            {saving ? t('Saving...') : saved ? `✓ ${t('Saved')}` : t('Save Feedback')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
