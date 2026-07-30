import { useQuery } from '@tanstack/react-query';

import type { Screenplay } from '@/types';
import { fetchReaderReports } from '@/lib/readerReportService';
import { SectionHeader } from '@/components/screenplay/modal/SectionHeader';

export function ReaderEvidencePanel({ screenplay }: { screenplay: Screenplay }) {
  const reportsQuery = useQuery({
    queryKey: [
      'reader-evidence',
      screenplay.projectId ?? screenplay.sourceFile,
      screenplay.latestVersionId ?? 'latest-parent',
    ],
    queryFn: () => fetchReaderReports(screenplay),
    staleTime: Number.POSITIVE_INFINITY,
  });

  return (
    <section data-testid="reader-evidence-panel">
      <SectionHeader icon="🔎">Specialist Reader Evidence</SectionHeader>
      {reportsQuery.isPending && (
        <div className="rounded-xl border border-black-700 bg-black-900/30 p-4">
          <p className="text-sm text-black-400">Loading the sealed reader reports…</p>
        </div>
      )}
      {reportsQuery.isError && (
        <div
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4"
          role="alert"
        >
          <p className="text-sm font-semibold text-red-300">
            Reader evidence could not be loaded.
          </p>
          <button
            type="button"
            onClick={() => void reportsQuery.refetch()}
            className="mt-2 text-xs font-bold uppercase tracking-wide text-red-200 underline"
          >
            Try again
          </button>
        </div>
      )}
      {reportsQuery.isSuccess && reportsQuery.data.length === 0 && (
        <div className="rounded-xl border border-black-700 border-dashed bg-black-900/30 p-4">
          <p className="text-sm leading-6 text-black-400">
            Sealed specialist reports are not available for this older analysis.
          </p>
        </div>
      )}
      {reportsQuery.isSuccess && reportsQuery.data.length > 0 && (
        <div className="space-y-3">
          {reportsQuery.data.map((report, index) => (
            <details
              key={report.reader}
              open={index === 0}
              className="rounded-xl border border-black-700 bg-black-900/30"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold text-black-100">
                    {report.label} Reader
                  </span>
                  {report.oneSentenceVerdict && (
                    <span className="mt-0.5 block text-xs leading-5 text-black-400">
                      {report.oneSentenceVerdict}
                    </span>
                  )}
                </span>
                <strong className="font-mono text-lg text-gold-200">
                  {report.pillarScore.toFixed(1)}
                </strong>
              </summary>
              <div className="border-t border-black-700 px-4 py-3">
                <div className="space-y-3">
                  {report.subScores.map((subScore) => (
                    <div key={subScore.key} className="grid gap-1 sm:grid-cols-[minmax(10rem,0.35fr)_minmax(0,1fr)]">
                      <div className="flex items-baseline justify-between gap-3 sm:block">
                        <span className="text-xs font-semibold text-black-200">
                          {subScore.label}
                        </span>
                        <strong className="font-mono text-sm text-black-100 sm:ml-2">
                          {subScore.score.toFixed(1)}
                        </strong>
                      </div>
                      <p className="text-xs leading-5 text-black-400">
                        {subScore.justification || 'No written evidence was preserved.'}
                        {subScore.pageCitations.length > 0 && (
                          <span className="ml-1 text-black-500">
                            Pages {subScore.pageCitations.join(', ')}
                          </span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
                {report.redFlags.length > 0 && (
                  <div className="mt-4 border-t border-black-700 pt-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-300">
                      Reader flags
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-black-300">
                      {report.redFlags.map((flag) => <li key={flag}>{flag}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      )}

      {screenplay.readerDisagreements && screenplay.readerDisagreements.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-300">
            Roundtable disagreements
          </p>
          <div className="mt-3 space-y-3">
            {screenplay.readerDisagreements.map((disagreement, index) => (
              <div key={`${disagreement.topic}-${index}`}>
                <p className="text-sm font-semibold text-black-100">{disagreement.topic}</p>
                {disagreement.resolution && (
                  <p className="mt-1 text-xs leading-5 text-black-300">
                    Resolution: {disagreement.resolution}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
