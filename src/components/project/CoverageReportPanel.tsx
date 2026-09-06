/**
 * Full Coverage V1 report view — the coverage-native replacement for the
 * V9-shaped tabs (readers, dimension scores). Renders everything the engine
 * sealed: verdict, story spine, lens grades, strengths/concerns, development
 * priorities, continuity flags, uncertainties, the champion/pass cases, and
 * the audit trail. Coverage documents are unscored BY DESIGN.
 */

import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import type { Screenplay } from '@/types';
import { useTranslation } from 'react-i18next';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function SpineRow({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 border-b border-slate-100 py-2 text-sm">
      <span className="font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}

const GRADE_STYLES: Record<string, string> = {
  strong: 'bg-emerald-100 text-emerald-800',
  solid: 'bg-sky-100 text-sky-800',
  weak: 'bg-amber-100 text-amber-800',
  not_applicable: 'bg-slate-100 text-slate-500',
};

export function CoverageReportPanel({ screenplay }: { screenplay: Screenplay }) {
  const { t } = useTranslation();
  const detail = screenplay.coverage;
  if (!detail) return null;

  const citationsLine =
    detail.citationsTotal !== undefined && detail.citationsVerified !== undefined
      ? `${detail.citationsVerified}/${detail.citationsTotal}`
      : undefined;

  return (
    <div className="coverage-report mx-auto max-w-4xl px-1 pb-10 text-slate-900">
      <header className="mb-8 flex flex-wrap items-center gap-4 border-b border-slate-200 pb-5">
        {detail.status === 'needs_review' && <strong className="text-sm text-amber-800">{t('Needs Review · provisional coverage')}</strong>}
        <RecommendationBadge tier={screenplay.recommendation} />
        <div className="text-sm text-slate-600">
          <div>
            <strong className="text-slate-900">{detail.verdict}</strong>
            {' · '}
            {t('confidence')}: <strong>{detail.confidence}</strong>
            {' · '}
            {detail.engineVersion}
          </div>
          {citationsLine && (
            <div>
              {t('Citations verified')}: <strong>{citationsLine}</strong>
              {detail.supportRate !== undefined && (
                <>
                  {' · '}
                  {t('Fact-audit support')}: <strong>{Math.round(detail.supportRate * 100)}%</strong>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {screenplay.humanReviewRecommended && screenplay.reviewReasons?.length ? (
        <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong className="mb-1 block">{t('Human review recommended')}</strong>
          <ul className="list-disc pl-5">
            {screenplay.reviewReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {detail.reviewSummary && (
        <Section title={t('Independent review')}>
          <p className="mb-3 text-sm leading-6">{detail.reviewSummary}</p>
          {detail.reviewIssues?.map((issue, index) => (
            <div key={`${issue.field}-${index}`} className="mb-3 rounded border border-slate-200 p-3 text-sm">
              <strong>{issue.field}</strong>{' · '}
              <span>{t(issue.category === 'interpretation' ? 'Human taste' : issue.category === 'uncertain' ? 'Uncertain fact' : 'Factual correction')}</span>
              {issue.page && <span>{' · '}{t('Page')} {issue.page}</span>}
              <p className="mt-1 leading-6">{issue.note}</p>
            </div>
          ))}
        </Section>
      )}

      {detail.synopsis.trim() && (
        <Section title={t('Synopsis')}>
          <p className="whitespace-pre-line text-sm leading-6 text-slate-800">{detail.synopsis}</p>
        </Section>
      )}

      <Section title={t('Story spine')}>
        <SpineRow label={t('Protagonist')} value={screenplay.characters.protagonist} />
        <SpineRow label={t('Want')} value={detail.want} />
        <SpineRow label={t('Need')} value={detail.need} />
        <SpineRow label={t('Opposition')} value={screenplay.characters.antagonist} />
        <SpineRow label={t('Stakes')} value={detail.stakes} />
        <SpineRow label={t('Climax')} value={detail.climax} />
        <SpineRow label={t('Ending')} value={detail.ending} />
        {detail.majorTurns.length > 0 && (
          <ol className="mt-4 space-y-2">
            {detail.majorTurns.map((item, index) => (
              <li key={index} className="flex gap-3 text-sm">
                <span className="shrink-0 font-semibold text-slate-400">
                  {item.page !== undefined ? `p.${item.page}` : `#${index + 1}`}
                </span>
                <span className="text-slate-800">{item.turn}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {screenplay.lensGrades?.length ? (
        <Section title={t('Methodology lenses')}>
          <div className="space-y-4">
            {screenplay.lensGrades.map((lens) => (
              <article key={lens.lens} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-2 flex items-center gap-3">
                  <strong className="text-sm">{lens.lens}</strong>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${GRADE_STYLES[lens.grade] ?? 'bg-slate-100 text-slate-600'}`}
                  >
                    {t(lens.grade)}
                  </span>
                </div>
                <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{lens.note}</p>
              </article>
            ))}
          </div>
        </Section>
      ) : null}

      <div className="grid gap-8 md:grid-cols-2">
        {screenplay.strengths.length > 0 && (
          <Section title={t('Strengths')}>
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-800">
              {screenplay.strengths.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Section>
        )}
        {screenplay.weaknesses.length > 0 && (
          <Section title={t('Concerns')}>
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-800">
              {screenplay.weaknesses.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Section>
        )}
      </div>

      {screenplay.developmentNotes.length > 0 && (
        <Section title={t('Development priorities')}>
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-6 text-slate-800">
            {screenplay.developmentNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ol>
        </Section>
      )}

      {screenplay.continuityFlags?.length ? (
        <Section title={t('Continuity flags')}>
          <ul className="space-y-3">
            {screenplay.continuityFlags.map((flag) => (
              <li
                key={flag}
                className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-900"
              >
                {flag}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <div className="grid gap-8 md:grid-cols-2">
        {detail.championReason.trim() && (
          <Section title={t('The case for')}>
            <p className="whitespace-pre-line text-sm leading-6 text-slate-800">
              {detail.championReason}
            </p>
          </Section>
        )}
        {detail.passReason.trim() && (
          <Section title={t('The case against')}>
            <p className="whitespace-pre-line text-sm leading-6 text-slate-800">
              {detail.passReason}
            </p>
          </Section>
        )}
      </div>

      {screenplay.uncertainties?.length ? (
        <Section title={t('Reader-stated uncertainties')}>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            {screenplay.uncertainties.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {detail.commercialHypothesis.trim() && (
        <Section title={t('Commercial hypothesis')}>
          <p className="whitespace-pre-line text-sm leading-6 text-slate-800">
            {detail.commercialHypothesis}
          </p>
        </Section>
      )}

      {detail.pageConvention && (
        <p className="mt-6 text-xs text-slate-400">{detail.pageConvention}</p>
      )}
    </div>
  );
}
