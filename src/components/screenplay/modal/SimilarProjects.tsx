import { useMemo } from 'react';
import type { Screenplay } from '@/types';
import { findSimilarScreenplays } from '@/lib/screenplaySimilarity';
import { SectionHeader } from './SectionHeader';

interface SimilarProjectsProps {
  screenplay: Screenplay;
  allScreenplays: Screenplay[];
  onSelect: (screenplay: Screenplay) => void;
}

export function SimilarProjects({ screenplay, allScreenplays, onSelect }: SimilarProjectsProps) {
  const matches = useMemo(
    () => findSimilarScreenplays(screenplay, allScreenplays),
    [allScreenplays, screenplay],
  );

  if (matches.length === 0) return null;

  return (
    <section aria-labelledby="similar-projects-title">
      <SectionHeader icon="⇄">
        <span id="similar-projects-title">Similar Projects</span>
      </SectionHeader>
      <div className="divide-y divide-black-700 border-y border-black-700">
        {matches.map((match) => (
          <button
            key={match.screenplay.id}
            onClick={() => onSelect(match.screenplay)}
            className="w-full grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-2 py-3 text-left hover:bg-black-900/60"
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-black-100">
                {match.screenplay.title}
              </span>
              <span className="block mt-1 text-xs text-black-400">
                {match.reasons.join(' · ')}
              </span>
            </span>
            <span className="text-sm font-semibold text-gold-400 tabular-nums">
              {Math.round(match.similarity * 100)}%
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
