import { useCallback, useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';

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
  const isLocalPreview = isLocalCalibrationPreviewMode();
  const [assessments, setAssessments] = useState<ProducerAssessmentHead[]>([]);
  const [candidates, setCandidates] = useState<CalibrationCandidate[]>([]);
  const [activeProfile, setActiveProfile] =
    useState<ActiveCalibrationProfile | null>(null);
  const [assignments, setAssignments] = useState<
    Record<string, EvidenceAssignment>
  >({});
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [publishingId, setPublishingId] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [loadedAssessments, loadedCandidates, loadedProfile] =
        await Promise.all([
          loadProducerAssessmentHeads(),
          loadCalibrationCandidates(),
          loadActiveCalibrationProfile(),
        ]);
      const eligible = loadedAssessments.filter(
        (assessment) => assessment.includeInCalibration,
      );
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
      if (
        isLocalPreview &&
        isExpectedLocalCalibrationPredeployError(loadError)
      ) {
        const localAssessments = loadLocalProducerAssessmentHeads();
        const eligible = localAssessments.filter(
          (assessment) => assessment.includeInCalibration,
        );
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
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Calibration evidence could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [isLocalPreview]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const trainingAssessmentIds = useMemo(
    () =>
      assessments
        .filter(
          (assessment) =>
            assignments[assessment.latestAssessmentId] === 'training',
        )
        .map((assessment) => assessment.latestAssessmentId),
    [assessments, assignments],
  );
  const holdoutAssessmentIds = useMemo(
    () =>
      assessments
        .filter(
          (assessment) =>
            assignments[assessment.latestAssessmentId] === 'holdout',
        )
        .map((assessment) => assessment.latestAssessmentId),
    [assessments, assignments],
  );
  const canBuild =
    !isLocalPreview &&
    trainingAssessmentIds.length >= 4 &&
    holdoutAssessmentIds.length >= 1;

  const handleBuild = async () => {
    if (!canBuild) return;
    const approved = window.confirm(
      'Build a calibration candidate from the training set and run it against the sealed holdout set? This uses paid frontier-model calls but does not activate the result.',
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
      setError(
        buildError instanceof Error
          ? buildError.message
          : 'The calibration candidate could not be built.',
      );
    } finally {
      setBuilding(false);
    }
  };

  const publish = async (
    candidate: CalibrationCandidate,
    mode: 'activate' | 'rollback',
  ) => {
    const verb = mode === 'activate' ? 'activate' : 'roll back to';
    const approved = window.confirm(
      `Are you sure you want to ${verb} this calibration profile for future analyses? Existing scores will not change.`,
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
      setError(
        publishError instanceof Error
          ? publishError.message
          : 'The calibration profile could not be published.',
      );
    } finally {
      setPublishingId('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" role="status">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-black-700 border-t-[#3157d5]" />
        <span className="ml-3 text-black-400">
          Loading calibration evidence…
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#3157d5]">
          Producer calibration
        </p>
        <h2 className="mt-2 text-3xl font-display text-black-100">
          Teach the system your taste without rewriting history
        </h2>
        <p className="mt-2 max-w-3xl leading-7 text-black-400">
          Producer Takes remain separate from the AI scores. A candidate must
          improve on sealed examples it was not trained on before it can be
          published for future analyses.
        </p>
      </header>

      {isLocalPreview && (
        <section className="rounded-xl border border-[#3157d5]/30 bg-[#3157d5]/8 p-4 text-sm leading-6 text-black-300">
          <strong className="block text-black-100">Local review mode</strong>
          Producer Takes shown here are saved only on this Mac. Candidate
          compilation, paid model calls, and calibration activation remain
          unavailable until Q5 is approved and deployed.
        </section>
      )}

      <section
        className="grid gap-4 sm:grid-cols-3"
        aria-label="Calibration status"
      >
        <div className="rounded-xl border border-black-700 bg-black-900/35 p-5">
          <p className="text-xs uppercase tracking-wider text-black-500">
            Taste evidence
          </p>
          <strong className="mt-2 block text-3xl tabular-nums text-black-100">
            {assessments.filter((item) => item.includeInCalibration).length}
          </strong>
          <span className="text-sm text-black-400">
            included Producer Takes
          </span>
        </div>
        <div className="rounded-xl border border-black-700 bg-black-900/35 p-5">
          <p className="text-xs uppercase tracking-wider text-black-500">
            Evidence confidence
          </p>
          <strong className="mt-2 block text-2xl text-black-100">
            {confidenceLabel(
              assessments.filter((item) => item.includeInCalibration).length,
            )}
          </strong>
          <span className="text-sm text-black-400">
            more diverse reads improve reliability
          </span>
        </div>
        <div className="rounded-xl border border-black-700 bg-black-900/35 p-5">
          <p className="text-xs uppercase tracking-wider text-black-500">
            Active profile
          </p>
          <strong
            className={clsx(
              'mt-2 block text-2xl',
              activeProfile?.enabled ? 'text-emerald-400' : 'text-black-100',
            )}
          >
            {activeProfile?.enabled ? 'Calibrated' : 'Neutral'}
          </strong>
          <span className="break-all text-sm text-black-400">
            {activeProfile?.activeVersionId
              ? `Version ${activeProfile.activeVersionId.slice(0, 12)}…`
              : 'No profile changes future verdicts'}
          </span>
        </div>
      </section>

      <section className="rounded-xl border border-black-700 bg-black-900/30 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-xl font-display text-black-100">
              Evidence split
            </h3>
            <p className="mt-1 text-sm leading-6 text-black-400">
              Training teaches the candidate. Holdout is the sealed test it
              cannot study first. At least four training reads and one holdout
              read are required.
            </p>
          </div>
          <div className="flex gap-3 text-sm tabular-nums">
            <span className="text-black-300">
              {trainingAssessmentIds.length} training
            </span>
            <span className="text-black-500">·</span>
            <span className="text-black-300">
              {holdoutAssessmentIds.length} holdout
            </span>
          </div>
        </div>

        {assessments.length === 0 ? (
          <div className="mt-5 rounded-lg border border-dashed border-black-700 p-6 text-center">
            <p className="text-black-200">No Producer Takes yet.</p>
            <p className="mt-1 text-sm text-black-500">
              Open a sealed screenplay analysis and publish your take first.
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
                    <strong className="truncate text-black-100">
                      {assessment.title}
                    </strong>
                    <span className="rounded border border-[#3157d5]/30 bg-[#3157d5]/10 px-2 py-0.5 text-xs font-semibold text-[#3157d5]">
                      Billy {assessment.producerScore.toFixed(1)}
                    </span>
                    <span className="text-xs text-black-500">
                      AI {assessment.aiFinalScore.toFixed(1)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-black-500">
                    Revision {assessment.revision} · Exact analysis{' '}
                    {assessment.versionId.slice(0, 12)}…
                  </p>
                </div>
                <select
                  aria-label={`Evidence role for ${assessment.title}`}
                  value={
                    assessment.includeInCalibration
                      ? (assignments[assessment.latestAssessmentId] ??
                        'exclude')
                      : 'exclude'
                  }
                  disabled={!assessment.includeInCalibration}
                  onChange={(event) =>
                    setAssignments((current) => ({
                      ...current,
                      [assessment.latestAssessmentId]: event.target
                        .value as EvidenceAssignment,
                    }))
                  }
                  className="input min-w-36 text-sm"
                >
                  <option value="training">Training</option>
                  <option value="holdout">Holdout</option>
                  <option value="exclude">Exclude</option>
                </select>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-black-500">
            Building uses the frontier compiler and one decision replay per
            holdout. It never activates the result automatically.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canBuild || building}
            onClick={handleBuild}
          >
            {building
              ? 'Building and benchmarking…'
              : isLocalPreview
                ? 'Available after deployment'
                : 'Build candidate'}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-black-700 bg-black-900/30 p-5 sm:p-6">
        <h3 className="text-xl font-display text-black-100">
          Candidate history
        </h3>
        <p className="mt-1 text-sm text-black-400">
          Every candidate, benchmark, publication, and rollback keeps its exact
          evidence and model provenance.
        </p>

        {candidates.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-black-700 p-5 text-sm text-black-500">
            No candidate has been built yet.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {candidates.map((candidate) => {
              const isActive =
                activeProfile?.activeVersionId === candidate.candidateId;
              return (
                <article
                  key={candidate.candidateId}
                  className="rounded-lg border border-black-700 bg-black-950/25 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-black-100">
                          {new Date(candidate.createdAt).toLocaleString()}
                        </strong>
                        <span
                          className={clsx(
                            'rounded-full border px-2 py-0.5 text-xs font-semibold',
                            candidate.benchmark.passed
                              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400'
                              : 'border-red-500/35 bg-red-500/10 text-red-400',
                          )}
                        >
                          {candidateStatus(candidate)}
                        </span>
                        {isActive && (
                          <span className="rounded-full border border-[#3157d5]/35 bg-[#3157d5]/10 px-2 py-0.5 text-xs font-semibold text-[#3157d5]">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-black-500">
                        {candidate.sourceAssessmentIds.length} training reads ·{' '}
                        {candidate.benchmark.holdoutAssessmentIds.length}{' '}
                        holdout reads · {candidate.compilerModelId}
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
                            activeProfile?.activeVersionId
                              ? 'rollback'
                              : 'activate',
                          )
                        }
                      >
                        {publishingId === candidate.candidateId
                          ? 'Publishing…'
                          : activeProfile?.activeVersionId
                            ? 'Roll back to this version'
                            : 'Activate for future analyses'}
                      </button>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <span className="text-xs text-black-500">
                        Score error
                      </span>
                      <strong className="block text-black-100">
                        {candidate.benchmark.baselineMeanAbsoluteError.toFixed(
                          2,
                        )}
                        {' → '}
                        {candidate.benchmark.candidateMeanAbsoluteError.toFixed(
                          2,
                        )}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-black-500">
                        Verdict agreement
                      </span>
                      <strong className="block text-black-100">
                        {percent(candidate.benchmark.baselineVerdictAgreement)}
                        {' → '}
                        {percent(candidate.benchmark.candidateVerdictAgreement)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-black-500">
                        False passes
                      </span>
                      <strong className="block text-black-100">
                        {candidate.benchmark.baselineFalsePasses}
                        {' → '}
                        {candidate.benchmark.candidateFalsePasses}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-black-500">
                        False recommendations
                      </span>
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
                        <li key={reason}>• {reason}</li>
                      ))}
                    </ul>
                  )}

                  <details className="mt-4 border-t border-black-700 pt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-black-300">
                      Provenance and policy
                    </summary>
                    <div className="mt-3 space-y-2 text-xs leading-5 text-black-500">
                      <p className="break-all">
                        Candidate: {candidate.candidateId}
                      </p>
                      <p className="break-all">
                        Evidence set: {candidate.sourceAssessmentSetSha256}
                      </p>
                      <p className="break-all">
                        Prompt seal: {candidate.promptSha256}
                      </p>
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
