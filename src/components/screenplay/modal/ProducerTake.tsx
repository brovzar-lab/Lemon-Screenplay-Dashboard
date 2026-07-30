import { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';

import {
  EMPTY_PRODUCER_JUDGMENT,
  TASTE_SIGNAL_LABELS,
  isExpectedLocalCalibrationPredeployError,
  isLocalCalibrationPreviewMode,
  loadLocalProducerTakeDraft,
  loadProducerAssessment,
  saveLocalProducerTakeDraft,
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

const VERDICTS: RecommendationTier[] = [
  'pass',
  'consider',
  'recommend',
  'film_now',
];

function verdictLabel(value: RecommendationTier): string {
  return value === 'film_now'
    ? 'Film Now'
    : value.charAt(0).toUpperCase() + value.slice(1);
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

export function ProducerTake({ screenplay }: { screenplay: Screenplay }) {
  const projectId = screenplay.projectId ?? screenplay.id;
  const isLocalPreview = isLocalCalibrationPreviewMode();
  const [assessment, setAssessment] = useState<ProducerAssessment | null>(null);
  const [localDraft, setLocalDraft] = useState<LocalProducerTakeDraft | null>(
    null,
  );
  const [judgment, setJudgment] = useState<ProducerJudgment>(() =>
    judgmentFromAi(screenplay.weightedScore, screenplay.recommendation),
  );
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const applyLocalDraftOrNewTake = () => {
      const draft = loadLocalProducerTakeDraft(projectId);
      setLocalDraft(draft);
      const isExactLocalVersion =
        draft?.versionId === screenplay.latestVersionId;
      if (draft && isExactLocalVersion) {
        setJudgment(draft.judgment);
      } else {
        setJudgment(
          judgmentFromAi(screenplay.weightedScore, screenplay.recommendation),
        );
      }
      setEditing(!isExactLocalVersion);
    };
    loadProducerAssessment(projectId)
      .then((loaded) => {
        if (!active) return;
        setAssessment(loaded);
        const isExactVersion =
          loaded?.analysis.versionId === screenplay.latestVersionId;
        if (loaded && isExactVersion) {
          setLocalDraft(null);
          setJudgment(loaded.judgment);
          setEditing(false);
        } else if (isLocalPreview) {
          applyLocalDraftOrNewTake();
        } else {
          setJudgment(
            judgmentFromAi(screenplay.weightedScore, screenplay.recommendation),
          );
          setEditing(true);
        }
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        if (
          isLocalPreview &&
          isExpectedLocalCalibrationPredeployError(loadError)
        ) {
          setAssessment(null);
          applyLocalDraftOrNewTake();
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Producer Take could not be loaded.',
        );
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
    screenplay.recommendation,
    screenplay.weightedScore,
  ]);

  const scoreDelta = useMemo(
    () => judgment.producerScore - screenplay.weightedScore,
    [judgment.producerScore, screenplay.weightedScore],
  );
  const exactVersionAvailable = Boolean(screenplay.latestVersionId);
  const savedJudgment = assessment?.judgment ?? localDraft?.judgment ?? null;
  const hasSavedTake = savedJudgment !== null;
  const savedVersionId =
    assessment?.analysis.versionId ?? localDraft?.versionId ?? null;
  const isPriorVersion =
    savedVersionId !== null && savedVersionId !== screenplay.latestVersionId;

  const update = <K extends keyof ProducerJudgment>(
    key: K,
    value: ProducerJudgment[K],
  ) => setJudgment((current) => ({ ...current, [key]: value }));

  const toggleSignal = (signal: TasteSignal) => {
    update(
      'tasteSignals',
      judgment.tasteSignals.includes(signal)
        ? judgment.tasteSignals.filter((item) => item !== signal)
        : [...judgment.tasteSignals, signal],
    );
  };

  const handleSave = async () => {
    if (!screenplay.latestVersionId) return;
    setSaving(true);
    setError('');
    try {
      if (isLocalPreview) {
        const savedDraft = saveLocalProducerTakeDraft({
          projectId,
          versionId: screenplay.latestVersionId,
          title: screenplay.title,
          aiFinalScore: screenplay.weightedScore,
          aiVerdict: screenplay.recommendation,
          judgment,
        });
        setAssessment(null);
        setLocalDraft(savedDraft);
        setJudgment(savedDraft.judgment);
        setEditing(false);
        window.dispatchEvent(new Event(PRODUCER_ASSESSMENT_UPDATED_EVENT));
        return;
      }
      const saved = await submitProducerAssessment({
        projectId,
        versionId: screenplay.latestVersionId,
        judgment,
      });
      setAssessment(saved);
      setLocalDraft(null);
      setJudgment(saved.judgment);
      setEditing(false);
      window.dispatchEvent(new Event(PRODUCER_ASSESSMENT_UPDATED_EVENT));
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Producer Take could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section
        className="rounded-xl border border-black-700 bg-black-900/35 p-5"
        aria-label="Loading Producer Take"
      >
        <p className="text-sm text-black-400">Loading Producer Take…</p>
      </section>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-xl border border-[#3157d5]/30 bg-black-900/45"
      aria-labelledby={`producer-take-${screenplay.id}`}
      data-testid="producer-take"
    >
      <div className="border-l-4 border-[#3157d5] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3157d5]">
              Lemon decision layer
            </p>
            <h3
              id={`producer-take-${screenplay.id}`}
              className="mt-1 text-xl font-display text-black-100"
            >
              Producer Take
            </h3>
            <p className="mt-1 text-sm text-black-400">
              Your judgment stays beside the AI result. It never replaces it.
            </p>
          </div>
          {hasSavedTake && !editing && (
            <button
              type="button"
              className="btn btn-secondary text-sm"
              onClick={() => setEditing(true)}
            >
              Revise take
            </button>
          )}
        </div>

        <div className="mt-5 grid overflow-hidden rounded-lg border border-black-700 sm:grid-cols-2">
          <div className="bg-black-950/30 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black-500">
              AI final
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <strong className="text-4xl font-display tabular-nums text-black-100">
                {screenplay.weightedScore.toFixed(1)}
              </strong>
              <span className="text-sm font-semibold text-black-300">
                {verdictLabel(screenplay.recommendation)}
              </span>
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
                {verdictLabel(judgment.producerVerdict)}
              </span>
            </div>
            <p className="mt-2 text-xs text-black-400">
              {scoreDelta >= 0 ? '+' : ''}
              {scoreDelta.toFixed(1)} from AI
            </p>
          </div>
        </div>

        {isPriorVersion && (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
            Your saved take belongs to an earlier analysis version. Saving now
            creates a new version-specific assessment.
          </p>
        )}

        {!exactVersionAvailable ? (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
            Producer calibration requires a sealed analysis version. Reanalyze
            this legacy record before using it as taste evidence.
          </p>
        ) : !editing && savedJudgment ? (
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black-500">
                What the AI missed
              </p>
              <p className="mt-1 leading-6 text-black-200">
                {savedJudgment.aiMissed || 'No correction recorded.'}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black-500">
                What the AI got right
              </p>
              <p className="mt-1 leading-6 text-black-200">
                {savedJudgment.aiGotRight || 'No confirmation recorded.'}
              </p>
            </div>
            <p className="text-xs text-black-500 sm:col-span-2">
              {localDraft ? 'Local preview' : 'Published'} · Revision{' '}
              {assessment?.revision ?? localDraft?.revision} · Exact analysis
              version {savedVersionId?.slice(0, 12)}… ·{' '}
              {savedJudgment.includeInCalibration
                ? 'Included in calibration'
                : 'Held out of calibration'}
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {isLocalPreview && (
              <div className="rounded-lg border border-[#3157d5]/30 bg-[#3157d5]/8 p-3 text-sm leading-6 text-black-300">
                <strong className="block text-black-100">
                  Local review mode
                </strong>
                This take will be saved only on this Mac for Q5 review.
                Production publishing becomes available after Q5 is approved and
                deployed.
              </div>
            )}
            <div>
              <div className="flex items-center justify-between gap-4">
                <label
                  htmlFor={`producer-score-${screenplay.id}`}
                  className="text-xs font-semibold uppercase tracking-wider text-black-400"
                >
                  Your score
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
                onChange={(event) =>
                  update('producerScore', Number(event.target.value))
                }
                className="mt-2 w-full accent-[#3157d5]"
              />
            </div>

            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-black-400">
                Your verdict
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
                    {verdictLabel(verdict)}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-black-400">
                Would you pursue it?
                <select
                  value={judgment.pursuit}
                  onChange={(event) =>
                    update(
                      'pursuit',
                      event.target.value as ProducerJudgment['pursuit'],
                    )
                  }
                  className="input mt-2 w-full normal-case tracking-normal"
                >
                  <option value="yes">Yes</option>
                  <option value="maybe">Maybe</option>
                  <option value="no">No</option>
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-black-400">
                How fixable are the problems?
                <select
                  value={judgment.fixability}
                  onChange={(event) =>
                    update(
                      'fixability',
                      event.target.value as ProducerJudgment['fixability'],
                    )
                  }
                  className="input mt-2 w-full normal-case tracking-normal"
                >
                  <option value="high">Highly fixable</option>
                  <option value="medium">Partly fixable</option>
                  <option value="low">Hard to fix</option>
                  <option value="not_applicable">No meaningful problem</option>
                </select>
              </label>
            </div>

            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-black-400">
                What moved your decision?
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  Object.entries(TASTE_SIGNAL_LABELS) as Array<
                    [TasteSignal, string]
                  >
                ).map(([signal, label]) => (
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
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-black-400">
                What did the AI miss?
                <textarea
                  value={judgment.aiMissed}
                  onChange={(event) => update('aiMissed', event.target.value)}
                  rows={4}
                  className="input mt-2 w-full resize-y normal-case tracking-normal"
                  placeholder="Example: It over-penalized passive agency and undervalued the comic engine."
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wider text-black-400">
                What did the AI get right?
                <textarea
                  value={judgment.aiGotRight}
                  onChange={(event) => update('aiGotRight', event.target.value)}
                  rows={4}
                  className="input mt-2 w-full resize-y normal-case tracking-normal"
                  placeholder="Example: The protagonist still needs a more active final choice."
                />
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-black-700 p-3 text-sm text-black-300">
              <input
                type="checkbox"
                checked={judgment.includeInCalibration}
                onChange={(event) =>
                  update('includeInCalibration', event.target.checked)
                }
                className="mt-0.5 accent-[#3157d5]"
              />
              <span>
                <strong className="block text-black-100">
                  Use this as calibration evidence
                </strong>
                Leave this off when your opinion is tentative or the analysis
                version is not representative.
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
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={handleSave}
              >
                {saving
                  ? 'Saving…'
                  : isLocalPreview && hasSavedTake
                    ? 'Save local revision'
                    : isLocalPreview
                      ? 'Save local preview'
                      : assessment
                        ? 'Publish new revision'
                        : 'Publish Producer Take'}
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
