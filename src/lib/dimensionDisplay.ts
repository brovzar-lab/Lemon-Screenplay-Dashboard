/**
 * Dimension Display Adapter
 * Returns version-appropriate dimension labels and scores.
 *
 * V5 screenplays have 7 flat dimensions.
 * V6 screenplays have 4 weighted pillars (Execution Craft, Character System,
 * Conceptual Strength, Voice & Tone) that are semantically different from V5.
 * V9 screenplays have 5 weighted pillars from the Archaeology Engine (Structure,
 * Character, Craft & Scene, Concept, Emotional Resonance).
 *
 * Without this adapter, V6/V9 screenplays show mislabeled V5 labels.
 */

import type { Screenplay } from '@/types';
import { DIMENSION_CONFIG } from '@/types/screenplay';
import type { V7PillarScore } from '@/lib/normalize';

export interface DimensionDisplayItem {
  key: string;
  label: string;
  score: number;
  weight: number;
  justification: string;
}

/** Archaeology Engine pillar display config */
const V7_PILLAR_DISPLAY: Record<string, { label: string; emoji: string }> = {
  structure: { label: 'Structure', emoji: '🏗️' },
  character: { label: 'Character', emoji: '🎭' },
  craft_scene: { label: 'Craft & Scene', emoji: '✍️' },
  concept: { label: 'Concept', emoji: '💡' },
  emotional_resonance: { label: 'Emotion', emoji: '❤️' },
};

/**
 * Check if a screenplay has Archaeology Engine pillar data.
 */
function hasV7PillarScores(screenplay: Screenplay): screenplay is Screenplay & { v7PillarScores: V7PillarScore[] } {
  return 'v7PillarScores' in screenplay
    && Array.isArray(screenplay.v7PillarScores)
    && screenplay.v7PillarScores.length > 0;
}

/**
 * Returns version-appropriate dimension display data.
 *
 * V9: 5 pillars from the Archaeology Engine with methodology-specific names
 * V5: 7 dimensions from DIMENSION_CONFIG (legacy fallback)
 */
export function getDimensionDisplay(screenplay: Screenplay): DimensionDisplayItem[] {
  // V9: 5 Archaeology Engine pillars
  if (hasV7PillarScores(screenplay)) {
    return screenplay.v7PillarScores.map((pillar) => {
      const display = V7_PILLAR_DISPLAY[pillar.name] || { label: pillar.name, emoji: '📊' };
      return {
        key: pillar.name,
        label: display.label,
        score: pillar.score,
        weight: pillar.weight,
        justification: `See ${display.label} Reader report`,
      };
    });
  }

  // V5: standard 7-dimension display
  return DIMENSION_CONFIG.map(({ key, label, weight }) => ({
    key,
    label,
    score: screenplay.dimensionScores[key as keyof typeof screenplay.dimensionScores] as number,
    weight,
    justification: screenplay.dimensionJustifications[key as keyof typeof screenplay.dimensionJustifications] || '',
  }));
}

/**
 * Returns a flat label for the analysis version type shown in the UI.
 */
export function getAnalysisVersionLabel(screenplay: Screenplay): string {
  if (hasV7PillarScores(screenplay)) return 'V9 (5-Reader Archaeology)';
  return 'V5 (7-Dimension)';
}

