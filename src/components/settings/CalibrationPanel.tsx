import { useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { TasteMatch } from '@/components/charts/TasteMatch';

import {
  activateCalibrationCandidate,
  buildCalibrationCandidate,
  isExpectedLocalCalibrationPredeployError,
  isLocalCalibrationPreviewMode,
  loadActiveCalibrationProfile,
  loadCalibrationCandidates,
  loadLocalProducerAssessmentHeads,
  loadProducerAssessmentHeads,
  rollbackCalibrationProfile,
} from '@/lib/producerCalibration';
import type {
  ActiveCalibrationProfile,
  CalibrationCandidate,
  ProducerAssessmentHead,
} from '@/types';

type EvidenceAssignment = 'training' | 'holdout' | 'exclude';

function confidenceLabel(count: number): string {
  if (count < 5) return 'Not ready';
  if (count < 12) return 'Early signal';
  if (count < 25) return 'Developing';
  return 'Reliable';
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function candidateStatus(candidate: CalibrationCandidate): string {
  return candidate.benchmark.passed ? 'Passed benchmark' : 'Blocked';
}

export function CalibrationPanel() {
  const { t, i18n } = useTranslation();
  const isLocalPreview = isLocalCalibrationPreviewMode();
  const [assessments, setAssessments] = useState<ProducerAssessmentHead[]>([]);
  const [candidates, setCandidates] = useState<CalibrationCandidate[]>([]);
  const [activeProfile, setActiveProfile] = useState<ActiveCalibrationProfile | null>(null);
  const [assignments, setAssignments] = useState<Record<string, EvidenceAssignment>>({});
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [publishingId, setPublishingId] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [loadedAssessments, loadedCandidates, loadedProfile] = await Promise.all([
        loadProducerAssessmentHeads(),
        loadCalibrationCandidates(),
        loadActiveCalibrationProfile(),
      ]);
      const eligible = loadedAssessments.filter((assessment) => assessment.includeInCalibration);
      setAssessments(loadedAssessments);
      setCandidates(loadedCandidates);
      setActiveProfile(loadedProfile);
      setAssignments((current) => {
        if (Object.keys(current).length > 0) return current;
        return Object.fromEntries(
          eligible.map((assessment, index) => [
            assessment.latestAssessmentId,
            index === 0 ? 'holdout' : 'training',
          ]),
        );
      });
    } catch (loadError) {
      if (isLocalPreview && isExpectedLocalCalibrationPredeployError(loadError)) {
        const localAssessments = loadLocalProducerAssessmentHeads();
        const eligible = localAssessments.filter((assessment) => assessment.includeInCalibration);
        setAssessments(localAssessments);
        setCandidates([]);
        setActiveProfile(null);
        setAssignments((current) => {
          if (Object.keys(current).length > 0) return current;
          return Object.fromEntries(
            eligible.map((assessment, index) => [
              assessment.latestAssessmentId,
              index === 0 ? 'holdout' : 'training',
            ]),
          );
        });
        setError('');
        return;
      }
      console.error('[CalibrationPanel] Evidence load failed:', loadError);
      setError(t('Calibration evidence could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [isLocalPreview, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const trainingAssessmentIds = useMemo(
    () =>
      assessments
        .filter((assessment) => assignments[assessment.latestAssessmentId] === 'training')
        .map((assessment) => assessment.latestAssessmentId),
    [assessments, assignments],
  );
  const holdoutAssessmentIds = useMemo(
    () =>
      assessments
        .filter((assessment) => assignments[assessment.latestAssessmentId] === 'holdout')
        .map((assessment) => assessment.latestAssessmentId),
    [assessments, assignments],
  );
  const eligibleAssessmentCount = assessments.filter(
    (assessment) => assessment.includeInCalibration,
  ).length;
  const canBuild =
    !isLocalPreview && trainingAssessmentIds.length >= 4 && holdoutAssessmentIds.length >= 1;

  const handleBuild = async () => {
    if (!canBuild) return;
    const approved = window.confirm(
      t('Build a calibration candidate from the training set and run it against the sealed holdout set? This uses paid frontier-model calls but does not activate the result.'),
    );
    if (!approved) return;

    setBuilding(true);
    setError('');
    try {
      await buildCalibrationCandidate({
        trainingAssessmentIds,
        holdoutAssessmentIds,
      });
      await refresh();
    } catch (buildError) {
      console.error('[CalibrationPanel] Candidate build failed:', buildError);
      setError(t('The calibration candidate could not be built.'));
    } finally {
      setBuilding(false);
    }
  };

  const publish = async (candidate: CalibrationCandidate, mode: 'activate' | 'rollback') => {
    const approved = window.confirm(
      mode === 'activate'
        ? t('Activate this calibration profile for future analyses? Existing scores will not change.')
        : t('Roll back to this calibration profile for future analyses? Existing scores will not change.'),
    );
    if (!approved) return;

    setPublishingId(candidate.candidateId);
    setError('');
    try {
      const profile =
        mode === 'activate'
          ? await activateCalibrationCandidate(candidate.candidateId)
          : await rollbackCalibrationProfile(candidate.candidateId);
      setActiveProfile(profile);
    } catch (publishError) {
      console.error('[CalibrationPanel] Profile publish failed:', publishError);
      setError(t('The calibration profile could not be published.'));
    } finally {
      setPublishingId('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" role="status">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-black-700 border-t-[var(--settings-cobalt)]" />
        <span className="ml-3 text-black-400">{t('Loading calibration evidence…')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--settings-kicker)]">
          {t('Producer calibration')}
        </p>
        <h2 className="mt-2 text-3xl font-display text-black-100">
          {t('Teach the system your taste without rewriting history')}
        </h2>
        <p className="mt-2 max-w-3xl leading-7 text-black-400">
          {t('Producer Takes remain separate from the AI scores. A candidate must improve on sealed examples it was not trained on before it can be published for future analyses.')}
        </p>
      </header>

      {isLocalPreview && (
        <section className="rounded-xl border border-[var(--settings-line)] bg-[var(--settings-paper-muted)] p-4 text-sm leading-6 text-black-300">
          <strong className="block text-black-100">{t('Local review mode')}</strong>
          {t('Producer Takes shown here are real saved evidence. Building a candidate uses paid model calls, and activating a profile changes future analyses, so both actions remain disabled during local review. Nothing on this screen changes the production profile.')}
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-3" aria-label={t('Calibration status')}>
        <div className="rounded-xl border border-black-700 bg-black-900/35 p-5">
          <p className="text-xs uppercase tracking-wider text-black-500">{t('Recorded Producer Takes')}</p>
          <strong className="mt-2 block text-3xl tabular-nums text-black-100">
            {assessments.length}
          </strong>
          <span className="text-sm text-black-400">{t('producer decisions saved')}</span>
        </div>
        <div className="rounded-xl border border-black-700 bg-black-900/35 p-5">
          <p className="text-xs uppercase tracking-wider text-black-500">{t('Evidence confidence')}</p>
          <strong className="mt-2 block text-2xl text-black-100">
            {t(confidenceLabel(eligibleAssessmentCount))}
          </strong>
          <span className="text-sm text-black-400">
            {t('{{count}} eligible calibration example', { count: eligibleAssessmentCount })}
          </span>
        </div>
        <div className="rounded-xl border border-black-700 bg-black-900/35 p-5">
          <p className="text-xs uppercase tracking-wider text-black-500">{t('Active profile')}</p>
          <strong
            className={clsx(
              'mt-2 block text-2xl',
              activeProfile?.enabled ? 'text-emerald-400' : 'text-black-100',
            )}
          >
            {activeProfile?.enabled ? t('Active') : t('Not active')}
          </strong>
          <span className="text-sm text-black-400">
            {activeProfile?.activeVersionId
              ? t('Version {{version}}…', { version: activeProfile.activeVersionId.slice(0, 12) })
              : t('No calibration profile affects future analyses')}
          </span>
        </div>
      </section>

      <section aria-label={t('Producer alignment')}>
        <TasteMatch />
      </section>

      <section className="rounded-xl border border-black-700 bg-black-900/30 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-xl font-display text-black-100">{t('Evidence split')}</h3>
            <p className="mt-1 text-sm leading-6 text-black-400">
              {t('Training teaches the candidate. Holdout is the sealed test it cannot study first. At least four training reads and one holdout read are required. Only takes explicitly marked as calibration evidence are eligible.')}
            </p>
          </div>
          <div className="flex gap-3 text-sm tabular-nums">
            <span className="text-black-300">{t('{{count}} training', { count: trainingAssessmentIds.length })}</span>
            <span className="text-black-500">·</span>
            <span className="text-black-300">{t('{{count}} holdout', { count: holdoutAssessmentIds.length })}</span>
          </div>
        </div>

        {assessments.length === 0 ? (
          <div className="mt-5 rounded-lg border border-dashed border-black-700 p-6 text-center">
            <p className="text-black-200">{t('No Producer Takes yet.')}</p>
            <p className="mt-1 text-sm text-black-500">
              {t('Open a sealed screenplay analysis and publish your take first.')}
            </p>
          </div>
        ) : (
          <div className="mt-5 divide-y divide-black-700 overflow-hidden rounded-lg border border-black-700">
            {assessments.map((assessment) => (
              <div
                key={assessment.latestAssessmentId}
                className="grid gap-3 bg-black-950/20 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="truncate text-black-100">{assessment.title}</strong>
                    <span className="rounded border border-[var(--settings-line)] bg-[var(--settings-paper-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--settings-kicker)]">
                      {t('Billy')} {assessment.producerScore.toFixed(1)}
                    </span>
                    <span className="text-xs text-black-500">
                      {t('AI')} {assessment.aiFinalScore.toFixed(1)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-black-500">
                    {t('Revision {{revision}} · Exact analysis {{version}}…', {
                      revision: assessment.revision,
                      version: assessment.versionId.slice(0, 12),
                    })}
                  </p>
                </div>
                {assessment.includeInCalibration ? (
                  <select
                    aria-label={t('Evidence role for {{title}}', { title: assessment.title })}
                    value={assignments[assessment.latestAssessmentId] ?? 'exclude'}
                    onChange={(event) =>
                      setAssignments((current) => ({
                        ...current,
                        [assessment.latestAssessmentId]: event.target.value as EvidenceAssignment,
                      }))
                    }
                    className="input min-w-36 text-sm"
                  >
                    <option value="training">{t('Training')}</option>
                    <option value="holdout">{t('Holdout')}</option>
                    <option value="exclude">{t('Exclude')}</option>
                  </select>
                ) : (
                  <span
                    className="rounded-lg border border-black-700 px-3 py-2 text-xs font-semibold text-black-400"
                    title={t('This Producer Take was saved without Use as calibration evidence enabled.')}
                  >
                    {t('Not eligible')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-black-500">
            {t('Building uses the frontier compiler and one decision replay per holdout. It never activates the result automatically.')}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canBuild || building}
            onClick={handleBuild}
          >
            {building
              ? t('Building and benchmarking…')
              : isLocalPreview
                ? t('Disabled during local review')
                : t('Build candidate')}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-black-700 bg-black-900/30 p-5 sm:p-6">
        <h3 className="text-xl font-display text-black-100">{t('Candidate history')}</h3>
        <p className="mt-1 text-sm text-black-400">
          {t('Every candidate, benchmark, publication, and rollback keeps its exact evidence and model provenance.')}
        </p>

        {candidates.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-black-700 p-5 text-sm text-black-500">
            {t('No candidate has been built yet.')}
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {candidates.map((candidate) => {
              const isActive = activeProfile?.activeVersionId === candidate.candidateId;
              return (
                <article
                  key={candidate.candidateId}
                  className="rounded-lg border border-black-700 bg-black-950/25 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-black-100">
                          {new Date(candidate.createdAt).toLocaleString(i18n.language === 'es' ? 'es-MX' : 'en-US')}
                        </strong>
                        <span
                          className={clsx(
                            'rounded-full border px-2 py-0.5 text-xs font-semibold',
                            candidate.benchmark.passed
                              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400'
                              : 'border-red-500/35 bg-red-500/10 text-red-400',
                          )}
                        >
                          {t(candidateStatus(candidate))}
                        </span>
                        {isActive && (
                          <span className="rounded-full border border-[var(--settings-line)] bg-[var(--settings-paper-muted)] px-2 py-0.5 text-xs font-semibold text-[var(--settings-kicker)]">
                            {t('Active')}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-black-500">
                        {t('{{count}} training read', { count: candidate.sourceAssessmentIds.length })} ·{' '}
                        {t('{{count}} holdout read', { count: candidate.benchmark.holdoutAssessmentIds.length })} ·{' '}
                        {candidate.compilerModelId}
                      </p>
                    </div>
                    {candidate.benchmark.passed && !isActive && (
                      <button
                        type="button"
                        className="btn btn-secondary text-sm"
                        disabled={publishingId === candidate.candidateId}
                        onClick={() =>
                          void publish(
                            candidate,
                            activeProfile?.activeVersionId ? 'rollback' : 'activate',
                          )
                        }
                      >
                        {publishingId === candidate.candidateId
                          ? t('Publishing…')
                          : activeProfile?.activeVersionId
                            ? t('Roll back to this version')
                            : t('Activate for future analyses')}
                      </button>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <span className="text-xs text-black-500">{t('Score error')}</span>
                      <strong className="block text-black-100">
                        {candidate.benchmark.baselineMeanAbsoluteError.toFixed(2)}
                        {' → '}
                        {candidate.benchmark.candidateMeanAbsoluteError.toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-black-500">{t('Verdict agreement')}</span>
                      <strong className="block text-black-100">
                        {percent(candidate.benchmark.baselineVerdictAgreement)}
                        {' → '}
                        {percent(candidate.benchmark.candidateVerdictAgreement)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-black-500">{t('False passes')}</span>
                      <strong className="block text-black-100">
                        {candidate.benchmark.baselineFalsePasses}
                        {' → '}
                        {candidate.benchmark.candidateFalsePasses}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-black-500">{t('False recommendations')}</span>
                      <strong className="block text-black-100">
                        {candidate.benchmark.baselineFalseRecommendations}
                        {' → '}
                        {candidate.benchmark.candidateFalseRecommendations}
                      </strong>
                    </div>
                  </div>

                  {candidate.benchmark.reasons.length > 0 && (
                    <ul className="mt-4 space-y-1 text-sm text-red-400">
                      {candidate.benchmark.reasons.map((reason) => (
                        <li key={reason}>• {t(reason)}</li>
                      ))}
                    </ul>
                  )}

                  <details className="mt-4 border-t border-black-700 pt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-black-300">
                      {t('Provenance and policy')}
                    </summary>
                    <div className="mt-3 space-y-2 text-xs leading-5 text-black-500">
                      <p className="break-all">{t('Candidate')}: {candidate.candidateId}</p>
                      <p className="break-all">
                        {t('Evidence set')}: {candidate.sourceAssessmentSetSha256}
                      </p>
                      <p className="break-all">{t('Prompt seal')}: {candidate.promptSha256}</p>
                      <p>{candidate.policy.thesis}</p>
                    </div>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default CalibrationPanel;
