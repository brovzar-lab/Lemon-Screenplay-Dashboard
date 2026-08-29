import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { isDecisionReady } from '@/lib/producerProjection';

import {
  EMPTY_PRODUCER_JUDGMENT,
  TASTE_SIGNAL_LABELS,
  isExpectedLocalCalibrationPredeployError,
  isLocalCalibrationPreviewMode,
  clearLocalProducerWorkingDraft,
  loadLocalProducerTakeDraft,
  loadLocalProducerWorkingDraft,
  loadProducerAssessment,
  saveLocalProducerTakeDraft,
  saveLocalProducerWorkingDraft,
  submitProducerAssessment,
  type LocalProducerTakeDraft,
} from '@/lib/producerCalibration';
import type {
  ProducerAssessment,
  ProducerJudgment,
  RecommendationTier,
  Screenplay,
  TasteSignal,
} from '@/types';
import { PRODUCER_ASSESSMENT_UPDATED_EVENT } from '@/hooks/useProducerAssessments';

const VERDICTS: RecommendationTier[] = ['pass', 'consider', 'recommend', 'film_now'];

function verdictLabel(value: RecommendationTier): string {
  return value === 'film_now' ? 'Film Now' : value.charAt(0).toUpperCase() + value.slice(1);
}

function judgmentFromAi(
  producerScore: number,
  producerVerdict: RecommendationTier,
): ProducerJudgment {
  return {
    ...EMPTY_PRODUCER_JUDGMENT,
    producerScore,
    producerVerdict,
  };
}

function formatSavedAt(value: string | undefined): string {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function ProducerTake({ screenplay }: { screenplay: Screenplay }) {
  const { t } = useTranslation();
  const projectId = screenplay.projectId ?? screenplay.id;
  const decisionReady = isDecisionReady(screenplay);
  const isLocalPreview = isLocalCalibrationPreviewMode();
  const [assessment, setAssessment] = useState<ProducerAssessment | null>(null);
  const [localDraft, setLocalDraft] = useState<LocalProducerTakeDraft | null>(null);
  const [judgment, setJudgment] = useState<ProducerJudgment>(() =>
    judgmentFromAi(screenplay.weightedScore, screenplay.recommendation),
  );
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [workingDraftRestored, setWorkingDraftRestored] = useState(false);
  const producerVersionId = screenplay.latestVersionId ?? 'legacy-unverified';

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const applyLocalDraftOrNewTake = () => {
      const draft = loadLocalProducerTakeDraft(projectId);
      const workingDraft = loadLocalProducerWorkingDraft(projectId);
      setLocalDraft(draft);
      const isExactLocalVersion = draft?.versionId === producerVersionId;
      const isExactWorkingVersion = workingDraft?.versionId === producerVersionId;
      if (draft && isExactLocalVersion) {
        setJudgment(draft.judgment);
        setWorkingDraftRestored(false);
      } else if (workingDraft && isExactWorkingVersion) {
        setJudgment(workingDraft.judgment);
        setWorkingDraftRestored(true);
      } else {
        setJudgment(judgmentFromAi(screenplay.weightedScore, screenplay.recommendation));
        setWorkingDraftRestored(false);
      }
      setEditing(!isExactLocalVersion || isExactWorkingVersion);
    };
    if (!decisionReady) {
      applyLocalDraftOrNewTake();
      setLoading(false);
      return () => { active = false; };
    }
    loadProducerAssessment(projectId)
      .then((loaded) => {
        if (!active) return;
        setAssessment(loaded);
        const isExactVersion = loaded?.analysis.versionId === screenplay.latestVersionId;
        if (loaded && isExactVersion) {
          setLocalDraft(null);
          setJudgment(loaded.judgment);
          setEditing(false);
        } else if (isLocalPreview || !screenplay.latestVersionId) {
          applyLocalDraftOrNewTake();
        } else {
          const workingDraft = loadLocalProducerWorkingDraft(projectId);
          if (workingDraft?.versionId === producerVersionId) {
            setJudgment(workingDraft.judgment);
            setWorkingDraftRestored(true);
          } else {
            setJudgment(judgmentFromAi(screenplay.weightedScore, screenplay.recommendation));
            setWorkingDraftRestored(false);
          }
          setEditing(true);
        }
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        if (
          !screenplay.latestVersionId ||
          (isLocalPreview && isExpectedLocalCalibrationPredeployError(loadError))
        ) {
          setAssessment(null);
          applyLocalDraftOrNewTake();
          return;
        }
        console.error('[ProducerTake] Load failed:', loadError);
        setError(t('Producer Take could not be loaded.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    projectId,
    isLocalPreview,
    screenplay.latestVersionId,
    producerVersionId,
    screenplay.recommendation,
    screenplay.weightedScore,
    t,
    decisionReady,
  ]);

  useEffect(() => {
    if (loading || !editing) return;
    saveLocalProducerWorkingDraft({
      projectId,
      versionId: producerVersionId,
      judgment,
    });
  }, [editing, judgment, loading, producerVersionId, projectId]);

  const scoreDelta = useMemo(
    () => judgment.producerScore - screenplay.weightedScore,
    [judgment.producerScore, screenplay.weightedScore],
  );
  const exactVersionAvailable = Boolean(screenplay.latestVersionId) && decisionReady;
  const isLegacyDraft = !exactVersionAvailable;
  const savedJudgment = assessment?.judgment ?? localDraft?.judgment ?? null;
  const hasSavedTake = savedJudgment !== null;
  const savedVersionId = assessment?.analysis.versionId ?? localDraft?.versionId ?? null;
  const isPriorVersion = savedVersionId !== null && savedVersionId !== producerVersionId;
  const savedAt = assessment?.publishedAt ?? localDraft?.savedAt;

  const update = <K extends keyof ProducerJudgment>(key: K, value: ProducerJudgment[K]) =>
    setJudgment((current) => ({
      ...current,
      [key]: value,
      ...(key === 'confidence' && value === 'low' ? { includeInCalibration: false } : {}),
    }));

  const toggleSignal = (signal: TasteSignal) => {
    update(
      'tasteSignals',
      judgment.tasteSignals.includes(signal)
        ? judgment.tasteSignals.filter((item) => item !== signal)
        : [...judgment.tasteSignals, signal],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (isLocalPreview || isLegacyDraft) {
        const localJudgment = isLegacyDraft
          ? { ...judgment, includeInCalibration: false }
          : judgment;
        const savedDraft = saveLocalProducerTakeDraft({
          projectId,
          versionId: producerVersionId,
          title: screenplay.title,
          aiFinalScore: screenplay.weightedScore,
          aiVerdict: screenplay.recommendation,
          judgment: localJudgment,
        });
        setAssessment(null);
        setLocalDraft(savedDraft);
        setJudgment(savedDraft.judgment);
        setEditing(false);
        setWorkingDraftRestored(false);
        clearLocalProducerWorkingDraft(projectId);
        window.dispatchEvent(new Event(PRODUCER_ASSESSMENT_UPDATED_EVENT));
        return;
      }
      const saved = await submitProducerAssessment({
        projectId,
        versionId: producerVersionId,
        judgment,
      });
      setAssessment(saved);
      setLocalDraft(null);
      setJudgment(saved.judgment);
      setEditing(false);
      clearLocalProducerWorkingDraft(projectId);
      window.dispatchEvent(new Event(PRODUCER_ASSESSMENT_UPDATED_EVENT));
    } catch (saveError) {
      console.error('[ProducerTake] Save failed:', saveError);
      setError(t('Producer Take could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section
        className="rounded-xl border border-black-700 bg-black-900/35 p-5"
        aria-label={t('Loading Producer Take')}
      >
        <p className="text-sm text-black-400">{t('Loading Producer Take…')}</p>
      </section>
    );
  }

  return (
    <section
      className={clsx(
        'overflow-hidden rounded-xl border bg-black-900/45 transition-colors',
        hasSavedTake && !editing ? 'border-emerald-500/45' : 'border-[#3157d5]/30',
      )}
      aria-labelledby={`producer-take-${screenplay.id}`}
      data-testid="producer-take"
    >
      <div
        className={clsx(
          'border-l-4 px-5 py-4',
          hasSavedTake && !editing ? 'border-emerald-500' : 'border-[#3157d5]',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3157d5]">
              {t('Lemon decision layer')}
            </p>
            <h3
              id={`producer-take-${screenplay.id}`}
              className="mt-1 text-xl font-display text-black-100"
            >
              {isLegacyDraft ? t('Legacy Producer Draft') : t('Producer Take')}
            </h3>
            <p className="mt-1 text-sm text-black-400">
              {t('Your judgment stays beside the AI result. It never replaces it.')}
            </p>
          </div>
          {hasSavedTake && !editing && (
            <button
              type="button"
              className="btn btn-secondary text-sm"
              onClick={() => setEditing(true)}
            >
              {t('Revise take')}
            </button>
          )}
        </div>

        <div className="mt-5 grid overflow-hidden rounded-lg border border-black-700 sm:grid-cols-2">
          <div className="bg-black-950/30 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black-500">
              {t('AI final')}
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              {decisionReady ? <>
                <strong className="text-4xl font-display tabular-nums text-black-100">
                  {screenplay.weightedScore.toFixed(1)}
                </strong>
                <span className="text-sm font-semibold text-black-300">
                  {t(verdictLabel(screenplay.recommendation))}
                </span>
              </> : (
                <strong className="text-sm font-semibold text-amber-200">
                  {t('Not verified / not rankable')}
                </strong>
              )}
            </div>
          </div>
          <div className="border-t border-black-700 bg-[#3157d5]/8 p-4 sm:border-l sm:border-t-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#3157d5]">
              Billy
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <strong className="text-4xl font-display tabular-nums text-[#3157d5]">
                {judgment.producerScore.toFixed(1)}
              </strong>
              <span className="text-sm font-semibold text-black-200">
                {t(verdictLabel(judgment.producerVerdict))}
              </span>
            </div>
            {decisionReady && (
              <p className="mt-2 text-xs text-black-400">
                {scoreDelta >= 0 ? '+' : ''}
                {scoreDelta.toFixed(1)} {t('from AI')}
              </p>
            )}
          </div>
        </div>

        {isPriorVersion && (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
            {t('Your saved take belongs to an earlier analysis version. Saving now creates a new version-specific assessment.')}
          </p>
        )}

        {!editing && savedJudgment && (
          <div
            role="status"
            aria-label={t('Producer Take saved')}
            className="mt-4 rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-4"
          >
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white"
              >
                ✓
              </span>
              <div className="min-w-0">
                <strong className="block text-sm text-black-100">
                  {localDraft ? t('Saved on this Mac') : t('Published to calibration evidence')}
                </strong>
                <p className="mt-1 text-xs leading-5 text-black-400">
                  {localDraft
                    ? t('Your review is safely stored on this Mac. It has not changed the AI score, published a production record, or activated calibration.')
                    : t('Your review is now part of the evidence set. It has not changed the AI score or activated a calibration profile.')}
                  {savedAt ? ` ${t('Saved {{date}}.', { date: formatSavedAt(savedAt) })}` : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {!editing && savedJudgment ? (
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black-500">
                {t('What the AI missed')}
              </p>
              <p className="mt-1 leading-6 text-black-200">
                {savedJudgment.aiMissed || t('No correction recorded.')}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black-500">
                {t('What the AI got right')}
              </p>
              <p className="mt-1 leading-6 text-black-200">
                {savedJudgment.aiGotRight || t('No confirmation recorded.')}
              </p>
            </div>
            <p className="text-xs text-black-500 sm:col-span-2">
              {localDraft ? t('Local preview') : t('Published')} · {t('Revision')}{' '}
              {assessment?.revision ?? localDraft?.revision} ·{' '}
              {isLegacyDraft ? t('Legacy analysis snapshot') : t('Current sealed analysis')} ·{' '}
              {localDraft && savedJudgment.includeInCalibration
                ? t('Marked for calibration if published')
                : savedJudgment.includeInCalibration
                  ? t('Included in calibration')
                  : t('Held out of calibration')}
            </p>
            <p className="text-xs text-black-500 sm:col-span-2">
              {t('Confidence')}: {savedJudgment.confidence === 'low'
                ? t('Tentative')
                : savedJudgment.confidence === 'medium'
                  ? t('Medium')
                  : t('High')}
            </p>
            <div className="sm:col-span-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black-500">
                {t('What happens next')}
              </p>
              <ol className="mt-3 grid gap-2 sm:grid-cols-4">
                {[
                  {
                    label: 'Producer Take saved',
                    state: 'complete',
                    detail: 'Your judgment is recorded',
                  },
                  {
                    label: 'Calibration evidence',
                    state: savedJudgment.includeInCalibration ? 'complete' : 'held',
                    detail: savedJudgment.includeInCalibration
                      ? 'Eligible when published'
                      : 'Held out by your choice',
                  },
                  {
                    label: 'Candidate test',
                    state: 'pending',
                    detail: 'Needs a larger evidence set',
                  },
                  {
                    label: 'Future analyses',
                    state: 'pending',
                    detail: 'Only after manual activation',
                  },
                ].map((step, index) => (
                  <li
                    key={step.label}
                    className={clsx(
                      'rounded-lg border p-3',
                      step.state === 'complete'
                        ? 'border-emerald-500/35 bg-emerald-500/8'
                        : 'border-black-700 bg-black-950/20',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={clsx(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                          step.state === 'complete'
                            ? 'bg-emerald-500 text-white'
                            : 'border border-black-600 text-black-400',
                        )}
                      >
                        {step.state === 'complete' ? '✓' : index + 1}
                      </span>
                      <strong className="text-xs text-black-200">{t(step.label)}</strong>
                    </div>
                    <p className="mt-2 text-[11px] leading-4 text-black-500">{t(step.detail)}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs leading-5 text-black-500">
                  {t('Historical AI scores stay untouched. A tested profile can influence only future analyses after you approve activation.')}
                </p>
                <a
                  href="/settings?tab=calibration"
                  className="text-xs font-semibold text-[#3157d5] hover:underline"
                >
                  {t('View in Calibration')}
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {isLocalPreview && (
              <div className="rounded-lg border border-[#3157d5]/30 bg-[#3157d5]/8 p-3 text-sm leading-6 text-black-300">
                <strong className="block text-black-100">{t('Local review mode')}</strong>
                {t('This take will be saved only on this Mac. No production record or calibration profile changes during local review.')}
              </div>
            )}
            {isLegacyDraft && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm leading-6 text-black-300">
                <strong className="block text-black-100">{t('Legacy Producer Draft')}</strong>
                {t('You can preserve your judgment now, but this older analysis cannot prove the sealed evidence required for calibration. This draft stays privately on this device and never enters calibration.')}
              </div>
            )}
            {workingDraftRestored && (
              <p role="status" className="rounded-lg border border-[#3157d5]/30 bg-[#3157d5]/8 p-3 text-sm text-black-300">
                {t('Unpublished draft restored. Your unfinished writing was preserved on this Mac.')}
              </p>
            )}
            <div>
              <div className="flex items-center justify-between gap-4">
                <label
                  htmlFor={`producer-score-${screenplay.id}`}
                  className="text-xs font-semibold uppercase tracking-wider text-black-400"
                >
                  {t('Your score')}
                </label>
                <strong className="text-2xl tabular-nums text-[#3157d5]">
                  {judgment.producerScore.toFixed(1)}
                </strong>
              </div>
              <input
                id={`producer-score-${screenplay.id}`}
                type="range"
                min="1"
                max="10"
                step="0.1"
                value={judgment.producerScore}
                onChange={(event) => update('producerScore', Number(event.target.value))}
                className="mt-2 w-full accent-[#3157d5]"
              />
            </div>

            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-black-400">
                {t('Your verdict')}
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {VERDICTS.map((verdict) => (
                  <button
                    key={verdict}
                    type="button"
                    aria-pressed={judgment.producerVerdict === verdict}
                    onClick={() => update('producerVerdict', verdict)}
                    className={clsx(
                      'rounded-md border px-3 py-2 text-xs font-semibold transition-colors',
                      judgment.producerVerdict === verdict
                        ? 'border-[#3157d5] bg-[#3157d5] text-white'
                        : 'border-black-700 text-black-300 hover:border-black-500',
                    )}
                  >
                    {t(verdictLabel(verdict))}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-black-400">
                {t('How confident are you in this take?')}
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {([
                  ['high', 'High confidence'],
                  ['medium', 'Medium confidence'],
                  ['low', 'Tentative'],
                ] as const).map(([confidence, label]) => (
                  <button
                    key={confidence}
                    type="button"
                    aria-pressed={judgment.confidence === confidence}
                    onClick={() => update('confidence', confidence)}
                    className={clsx(
                      'rounded-md border px-3 py-2 text-xs font-semibold transition-colors',
                      judgment.confidence === confidence
                        ? 'border-[#3157d5] bg-[#3157d5] text-white'
                        : 'border-black-700 text-black-300 hover:border-black-500',
                    )}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs leading-5 text-black-500">
                {judgment.confidence === 'low'
                  ? t('Tentative takes are always held out of calibration evidence.')
                  : t('Only include this take in calibration when your judgment feels settled.')}
              </p>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-black-400">
                {t('Would you pursue it?')}
                <select
                  value={judgment.pursuit}
                  onChange={(event) =>
                    update('pursuit', event.target.value as ProducerJudgment['pursuit'])
                  }
                  className="input mt-2 w-full normal-case tracking-normal"
                >
                  <option value="yes">{t('Yes')}</option>
                  <option value="maybe">{t('Maybe')}</option>
                  <option value="no">{t('No')}</option>
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-black-400">
                {t('How fixable are the problems?')}
                <select
                  value={judgment.fixability}
                  onChange={(event) =>
                    update('fixability', event.target.value as ProducerJudgment['fixability'])
                  }
                  className="input mt-2 w-full normal-case tracking-normal"
                >
                  <option value="high">{t('Highly fixable')}</option>
                  <option value="medium">{t('Partly fixable')}</option>
                  <option value="low">{t('Hard to fix')}</option>
                  <option value="not_applicable">{t('No meaningful problem')}</option>
                </select>
              </label>
            </div>

            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-black-400">
                {t('What moved your decision?')}
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.entries(TASTE_SIGNAL_LABELS) as Array<[TasteSignal, string]>).map(
                  ([signal, label]) => (
                    <button
                      key={signal}
                      type="button"
                      aria-pressed={judgment.tasteSignals.includes(signal)}
                      onClick={() => toggleSignal(signal)}
                      className={clsx(
                        'rounded-full border px-3 py-1.5 text-xs transition-colors',
                        judgment.tasteSignals.includes(signal)
                          ? 'border-[#3157d5]/60 bg-[#3157d5]/12 text-[#3157d5]'
                          : 'border-black-700 text-black-400 hover:border-black-500',
                      )}
                    >
                      {t(label)}
                    </button>
                  ),
                )}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-black-400">
                {t('What did the AI miss?')}
                <textarea
                  value={judgment.aiMissed}
                  onChange={(event) => update('aiMissed', event.target.value)}
                  rows={4}
                  className="input mt-2 w-full resize-y normal-case tracking-normal"
                  placeholder={t('Example: It over-penalized passive agency and undervalued the comic engine.')}
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-black-400">
                {t('What did the AI get right?')}
                <textarea
                  value={judgment.aiGotRight}
                  onChange={(event) => update('aiGotRight', event.target.value)}
                  rows={4}
                  className="input mt-2 w-full resize-y normal-case tracking-normal"
                  placeholder={t('Example: The protagonist still needs a more active final choice.')}
                />
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-black-700 p-3 text-sm text-black-300">
              <input
                type="checkbox"
                aria-label={t('Use this as calibration evidence')}
                checked={judgment.includeInCalibration && !isLegacyDraft}
                onChange={(event) => update('includeInCalibration', event.target.checked)}
                disabled={judgment.confidence === 'low' || isLegacyDraft}
                className="mt-0.5 accent-[#3157d5]"
              />
              <span>
                <strong className="block text-black-100">{t('Use this as calibration evidence')}</strong>
                {t('Leave this off when your opinion is tentative or the analysis version is not representative.')}
              </span>
            </label>

            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {hasSavedTake && savedJudgment && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setJudgment(savedJudgment);
                    setEditing(false);
                    setError('');
                    setWorkingDraftRestored(false);
                    clearLocalProducerWorkingDraft(projectId);
                  }}
                >
                  {t('Cancel')}
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={handleSave}
              >
                {saving
                  ? t('Saving…')
                  : isLegacyDraft
                    ? t('Save Producer Draft')
                  : isLocalPreview && hasSavedTake
                    ? t('Save local revision')
                    : isLocalPreview
                      ? t('Save local preview')
                      : assessment
                        ? t('Publish new revision')
                        : t('Publish Producer Take')}
              </button>
            </div>
          </div>
        )}

        {error && !editing && hasSavedTake && (
          <p role="alert" className="mt-4 text-sm text-red-400">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
