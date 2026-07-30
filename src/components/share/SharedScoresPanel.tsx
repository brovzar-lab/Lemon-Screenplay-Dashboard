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
  const pillars = analysis.pillarScores ?? [];
  const projection = analysis.producerProjection;
  const pillarLabels: Record<string, string> = {
    structure: 'Structure',
    character: 'Character',
    craft_scene: 'Craft & Scene',
    concept: 'Concept',
    emotional_resonance: 'Emotion',
  };

  return (
    <div className="space-y-8">
      {/* Overall final score */}
      <div className="bg-black-800 border border-gold-500/10 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gold-200 uppercase tracking-wider mb-4">
          Overall Score
        </h3>
        <div className="flex items-end gap-3 mb-4">
          <span className={`text-5xl font-bold ${getScoreColorClass(weightedScore)}`}>
            {weightedScore.toFixed(1)}
          </span>
          <span className="text-black-400 text-lg mb-1">/10</span>
        </div>
        <ScoreBar
          label={projection ? 'Final score' : 'Legacy stored score'}
          score={weightedScore}
        />
        {projection && (
          <div className="mt-4 grid gap-2 border-t border-black-700 pt-4 text-sm">
            <div className="flex justify-between gap-4 text-black-300">
              <span>
                {projection.scoreSource === 'triage'
                  ? 'Raw triage score'
                  : 'Raw five-pillar score'}
              </span>
              <strong>{projection.rawScore.toFixed(2)}</strong>
            </div>
            <div className="flex justify-between gap-4 text-black-300">
              <span>Critical-failure deduction applied</span>
              <strong>
                {projection.penaltyApplied > 0
                  ? `−${projection.penaltyApplied.toFixed(2)}`
                  : '0.00'}
              </strong>
            </div>
            {Math.abs(
              projection.reportedPenalty - projection.penaltyApplied,
            ) > 0.005 && (
              <div className="flex justify-between gap-4 text-black-300">
                <span>Critical-failure issues reported</span>
                <strong>{projection.reportedPenalty.toFixed(2)}</strong>
              </div>
            )}
          </div>
        )}
        {!projection && (
          <p className="mt-4 border-t border-black-700 pt-4 text-sm leading-6 text-black-400">
            This older shared snapshot does not preserve adjusted-score lineage,
            so the stored score cannot be verified as a final adjusted score.
          </p>
        )}
      </div>

      {/* Analysis pillars or honest legacy fallback */}
      <div className="bg-black-800 border border-gold-500/10 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-gold-200 uppercase tracking-wider mb-4">
          {pillars.length > 0 ? 'Five-Pillar Reader Evidence' : 'Legacy Dimension Scores'}
        </h3>
        <div className="space-y-4">
          {pillars.length > 0
            ? pillars.map((pillar) => (
                <ScoreBar
                  key={pillar.name}
                  label={`${pillarLabels[pillar.name] ?? pillar.name} (${(pillar.weight * 100).toFixed(0)}%)`}
                  score={pillar.score}
                />
              ))
            : DIMENSION_CONFIG.map(({ key, label, weight }) => {
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
          <span className={`text-3xl font-bold ${getScoreColorClass(cvsTotal, 18)}`}>
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
