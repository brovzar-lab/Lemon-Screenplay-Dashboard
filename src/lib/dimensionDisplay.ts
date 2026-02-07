/**
 * Dimension Display Adapter
 * Returns version-appropriate dimension labels and scores.
 *
 * V5 screenplays have 7 flat dimensions.
 * V6 screenplays have 4 weighted pillars (Execution Craft, Character System,
 * Conceptual Strength, Voice & Tone) that are semantically different from V5.
 *
 * Without this adapter, V6 screenplays show mislabeled V5 labels:
 *   "Genre Execution" is actually Voice & Tone
 *   "Originality" is actually Theme (under Conceptual Strength)
 */

import type { Screenplay } from '@/types';
import { DIMENSION_CONFIG } from '@/types/screenplay';
import type { V6CoreQuality } from '@/types/screenplay-v6';

export interface DimensionDisplayItem {
  key: string;
  label: string;
  score: number;
  weight: number;
  justification: string;
}

/**
 * Check if a screenplay has V6 core quality data.
 * Works at runtime regardless of static type.
 */
function hasV6CoreQuality(screenplay: Screenplay): screenplay is Screenplay & { v6CoreQuality: V6CoreQuality } {
  return 'v6CoreQuality' in screenplay
    && screenplay.v6CoreQuality != null
    && typeof screenplay.v6CoreQuality === 'object';
}

/**
 * Returns version-appropriate dimension display data.
 *
 * V6: 4 pillars with their actual names and weights
 * V5: 7 dimensions from DIMENSION_CONFIG
 */
export function getDimensionDisplay(screenplay: Screenplay): DimensionDisplayItem[] {
  if (hasV6CoreQuality(screenplay)) {
    const cq = screenplay.v6CoreQuality;
    return [
      {
        key: 'executionCraft',
        label: 'Execution Craft',
        score: cq.execution_craft?.score || 0,
        weight: 0.40,
        justification: [
          cq.execution_craft?.structure?.justification,
          cq.execution_craft?.scene_writing?.justification,
          cq.execution_craft?.dialogue?.justification,
        ].filter(Boolean).join(' '),
      },
      {
        key: 'characterSystem',
        label: 'Character System',
        score: cq.character_system?.score || 0,
        weight: 0.30,
        justification: [
          cq.character_system?.protagonist?.justification,
          cq.character_system?.supporting_cast?.justification,
          cq.character_system?.relationships?.justification,
        ].filter(Boolean).join(' '),
      },
      {
        key: 'conceptualStrength',
        label: 'Conceptual Strength',
        score: cq.conceptual_strength?.score || 0,
        weight: 0.20,
        justification: [
          cq.conceptual_strength?.premise?.justification,
          cq.conceptual_strength?.theme?.justification,
        ].filter(Boolean).join(' '),
      },
      {
        key: 'voiceAndTone',
        label: 'Voice & Tone',
        score: cq.voice_and_tone?.score || 0,
        weight: 0.10,
        justification: cq.voice_and_tone?.justification || '',
      },
    ];
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
  if (hasV6CoreQuality(screenplay)) return 'V6 (4-Pillar)';
  return 'V5 (7-Dimension)';
}
