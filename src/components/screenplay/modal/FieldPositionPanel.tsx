import type { PercentileRank } from '@/lib/percentileRanking';

interface FieldPositionPanelProps {
  rank?: PercentileRank;
}

export function FieldPositionPanel({ rank }: FieldPositionPanelProps) {
  if (!rank) return null;

  return (
    <section aria-labelledby="field-position-title" className="border-y border-gold-500/15 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h3 id="field-position-title" className="text-lg font-display text-gold-200">
            Field Position
          </h3>
          <p className="text-xs text-black-400 mt-1">Ranked against the complete screenplay slate</p>
        </div>
        <span className="text-sm font-semibold text-gold-300">{rank.label} overall</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        <div className="flex items-baseline justify-between gap-4 border-b border-black-700/60 pb-3">
          <span className="text-sm text-black-300">Overall slate</span>
          <span className="text-xl font-semibold text-gold-200 tabular-nums">
            #{rank.overallPosition} <span className="text-sm text-black-400">of {rank.corpusSize}</span>
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b border-black-700/60 pb-3">
          <span className="text-sm text-black-300 truncate">{rank.genre}</span>
          <span className="text-xl font-semibold text-gold-200 tabular-nums">
            #{rank.genrePosition} <span className="text-sm text-black-400">of {rank.genreSize}</span>
          </span>
        </div>
      </div>
    </section>
  );
}
