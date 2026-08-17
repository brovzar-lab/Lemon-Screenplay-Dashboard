import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

import type { Screenplay } from '@/types';
import { fetchReaderReports } from '@/lib/readerReportService';
import { SectionHeader } from '@/components/screenplay/modal/SectionHeader';

export function ReaderEvidencePanel({
  screenplay,
  presentation = 'default',
}: {
  screenplay: Screenplay;
  presentation?: 'default' | 'workspace';
}) {
  const { t } = useTranslation();
  const isWorkspace = presentation === 'workspace';
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
      <SectionHeader icon={isWorkspace ? undefined : '🔎'}>
        {t(isWorkspace ? 'Specialist evidence' : 'Specialist Reader Evidence')}
      </SectionHeader>
      {reportsQuery.isPending && (
        <div className="rounded-xl border border-black-700 bg-black-900/30 p-4">
          <p className="text-sm text-black-400">{t('Loading the sealed reader reports…')}</p>
        </div>
      )}
      {reportsQuery.isError && (
        <div
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4"
          role="alert"
        >
          <p className="text-sm font-semibold text-red-300">
            {t('Reader evidence could not be loaded.')}
          </p>
          <button
            type="button"
            onClick={() => void reportsQuery.refetch()}
            className="mt-2 text-xs font-bold uppercase tracking-wide text-red-200 underline"
          >
            {t('Try again')}
          </button>
        </div>
      )}
      {reportsQuery.isSuccess && reportsQuery.data.length === 0 && (
        <div className="rounded-xl border border-black-700 border-dashed bg-black-900/30 p-4">
          <p className="text-sm leading-6 text-black-400">
            {t('Sealed specialist reports are not available for this older analysis.')}
          </p>
        </div>
      )}
      {reportsQuery.isSuccess && reportsQuery.data.length > 0 && (
        <div className={isWorkspace ? 'border-y border-black-700' : 'space-y-3'}>
          {reportsQuery.data.map((report, index) => (
            <details
              key={report.reader}
              open={index === 0}
              className={clsx(
                'border-black-700',
                isWorkspace
                  ? 'border-b bg-transparent last:border-b-0'
                  : 'rounded-xl border bg-black-900/30',
              )}
            >
              <summary className={clsx(
                'flex cursor-pointer list-none items-center justify-between gap-4',
                isWorkspace ? 'px-2 py-5 sm:px-4' : 'px-4 py-3',
              )}>
                <span>
                    <span className={clsx('block font-semibold text-black-100', isWorkspace ? 'text-base' : 'text-sm')}>
                    {report.label} {t('Reader')}
                  </span>
                  {report.oneSentenceVerdict && (
                    <span className="mt-0.5 block text-xs leading-5 text-black-400">
                      {report.oneSentenceVerdict}
                    </span>
                  )}
                </span>
                <strong className={clsx('font-mono text-gold-200', isWorkspace ? 'text-3xl' : 'text-lg')}>
                  {report.pillarScore.toFixed(1)}
                </strong>
              </summary>
              <div className={clsx('border-t border-black-700', isWorkspace ? 'px-2 py-5 sm:px-4' : 'px-4 py-3')}>
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
                        {subScore.justification || t('No written evidence was preserved.')}
                        {subScore.pageCitations.length > 0 && (
                          <span className="ml-1 text-black-500">
                            {t('Pages {{pages}}', { pages: subScore.pageCitations.join(', ') })}
                          </span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
                {report.redFlags.length > 0 && (
                  <div className="mt-4 border-t border-black-700 pt-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-300">
                      {t('Reader flags')}
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
        <div className={clsx(
          'mt-4 border border-amber-500/30 bg-amber-500/10 p-4',
          isWorkspace ? 'rounded-sm border-l-4' : 'rounded-xl',
        )}>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-300">
            {t('Roundtable disagreements')}
          </p>
          <div className="mt-3 space-y-3">
            {screenplay.readerDisagreements.map((disagreement, index) => (
              <div key={`${disagreement.topic}-${index}`}>
                <p className="text-sm font-semibold text-black-100">{disagreement.topic}</p>
                {disagreement.resolution && (
                  <p className="mt-1 text-xs leading-5 text-black-300">
                    {t('Resolution:')} {disagreement.resolution}
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
