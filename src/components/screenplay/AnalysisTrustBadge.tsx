import type { Screenplay } from '@/types';

export function AnalysisTrustBadge({ screenplay }: { screenplay: Screenplay }) {
  const warnings = screenplay.producerProjection?.warnings ?? [];
  const blocking = warnings.filter((warning) => warning.severity === 'blocking');
  const review = warnings.filter((warning) => warning.severity === 'warning');

  if (blocking.length > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-red-300"
        title={blocking.map((warning) => warning.title).join('. ')}
        aria-label={`Decision blocked: ${blocking.map((warning) => warning.title).join(', ')}`}
      >
        <span aria-hidden="true">!</span>
        Not rankable
      </span>
    );
  }

  if (review.length > 0) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-amber-300"
        title={review.map((warning) => warning.title).join('. ')}
        aria-label={`Review required: ${review.map((warning) => warning.title).join(', ')}`}
      >
        <span aria-hidden="true">!</span>
        Review
      </span>
    );
  }

  return null;
}
