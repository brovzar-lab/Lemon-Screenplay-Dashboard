import type { ProducerAssessmentHead } from '@/types';

export function ProducerScoreBadge({
  assessment,
  compact = false,
}: {
  assessment?: ProducerAssessmentHead;
  compact?: boolean;
}) {
  if (!assessment) return null;

  return (
    <span
      className={
        compact
          ? 'inline-flex items-center gap-1 rounded border border-[#3157d5]/35 bg-[#3157d5]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#3157d5]'
          : 'inline-flex items-center gap-1.5 rounded-md border border-[#3157d5]/35 bg-[#3157d5]/10 px-2 py-1 text-xs font-semibold text-[#3157d5]'
      }
      title={`Billy ${assessment.producerScore.toFixed(1)} · AI ${assessment.aiFinalScore.toFixed(1)}`}
    >
      <span>Billy</span>
      <strong className="tabular-nums">{assessment.producerScore.toFixed(1)}</strong>
    </span>
  );
}
