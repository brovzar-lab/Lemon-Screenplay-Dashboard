/**
 * SharedScoresPanel
 *
 * Displays dimension scores and CVS scores for the shared partner view.
 * Uses ScoreBar from @/components/ui (no store dependencies).
 *
 * BUNDLE ISOLATION: Only imports from @/types (configs) and @/components/ui.
 */

import { ScoreBar } from '@/components/ui/ScoreBar';
import { DIMENSION_CONFIG, CVS_CONFIG } from '@/types';
import { getScoreColorClass } from '@/lib/calculations';
import { toNumber } from '@/lib/utils';
import type { SharedViewDocument } from '@/lib/shareService';

interface SharedScoresPanelProps {
  analysis: SharedViewDocument['analysis'];
}

export function SharedScoresPanel({ analysis }: SharedScoresPanelProps) {
  const weightedScore = toNumber(analysis.weightedScore);
  const cvsTotal = toNumber(analysis.cvsTotal);

  return (
    <div className="space-y-8">
      {/* Overall Weighted Score */}
      <div className="bg-black-800 border border-gold-500/10 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gold-200 uppercase tracking-wider mb-4">
          Overall Score
        </h3>
        <div className="flex items-end gap-3 mb-4">
          <span className={`text-5xl font-bold font-mono ${getScoreColorClass(weightedScore)}`}>
            {weightedScore.toFixed(1)}
          </span>
          <span className="text-black-400 text-lg mb-1">/10</span>
        </div>
        <ScoreBar label="Weighted Score" score={weightedScore} />
      </div>

      {/* Dimension Scores */}
      <div className="bg-black-800 border border-gold-500/10 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gold-200 uppercase tracking-wider mb-4">
          Dimension Scores
        </h3>
        <div className="space-y-4">
          {DIMENSION_CONFIG.map(({ key, label, weight }) => {
            const score = toNumber(
              analysis.dimensionScores[key as keyof typeof analysis.dimensionScores]
            );
            const justification =
              analysis.dimensionJustifications?.[
                key as keyof typeof analysis.dimensionJustifications
              ];
            return (
              <ScoreBar
                key={key}
                label={`${label} (${(weight * 100).toFixed(0)}%)`}
                score={score}
                showJustification={!!justification}
                justification={justification}
              />
            );
          })}
        </div>
      </div>

      {/* CVS Scores */}
      <div className="bg-black-800 border border-gold-500/10 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gold-200 uppercase tracking-wider mb-4">
          Commercial Viability
        </h3>
        <div className="flex items-end gap-3 mb-4">
          <span className={`text-3xl font-bold font-mono ${getScoreColorClass(cvsTotal, 18)}`}>
            {cvsTotal.toFixed(0)}
          </span>
          <span className="text-black-400 text-sm mb-0.5">/18</span>
        </div>
        <div className="space-y-3">
          {CVS_CONFIG.map(({ key, label, maxScore }) => {
            const factor =
              analysis.commercialViability?.[
                key as keyof typeof analysis.commercialViability
              ];
            const score =
              typeof factor === 'object' && factor !== null
                ? toNumber((factor as { score: number }).score)
                : 0;
            return (
              <ScoreBar
                key={key}
                label={label}
                score={score}
                max={maxScore}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
