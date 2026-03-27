/**
 * Dimension Display Adapter
 * Returns version-appropriate dimension labels and scores.
 *
 * V5 screenplays have 7 flat dimensions.
 * V6 screenplays have 4 weighted pillars (Execution Craft, Character System,
 * Conceptual Strength, Voice & Tone) that are semantically different from V5.
 * V7 screenplays have 5 weighted pillars from the Archaeology Engine (Structure,
 * Character, Craft & Scene, Concept, Emotional Resonance).
 *
 * Without this adapter, V6/V7 screenplays show mislabeled V5 labels.
 */

import type { Screenplay } from '@/types';
import { DIMENSION_CONFIG } from '@/types/screenplay';
import type { V6CoreQuality } from '@/types/screenplay-v6';
import type { V7PillarScore } from '@/lib/normalize';

export interface DimensionDisplayItem {
  key: string;
  label: string;
  score: number;
  weight: number;
  justification: string;
}

/** V7 pillar display config */
const V7_PILLAR_DISPLAY: Record<string, { label: string; emoji: string }> = {
  structure: { label: 'Structure', emoji: '🏗️' },
  character: { label: 'Character', emoji: '🎭' },
  craft_scene: { label: 'Craft & Scene', emoji: '✍️' },
  concept: { label: 'Concept', emoji: '💡' },
  emotional_resonance: { label: 'Emotion', emoji: '❤️' },
};

/**
 * Check if a screenplay has V7 pillar data.
 */
function hasV7PillarScores(screenplay: Screenplay): screenplay is Screenplay & { v7PillarScores: V7PillarScore[] } {
  return 'v7PillarScores' in screenplay
    && Array.isArray(screenplay.v7PillarScores)
    && screenplay.v7PillarScores.length > 0;
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
 * V7: 5 pillars from the Archaeology Engine with methodology-specific names
 * V6: 4 pillars with their actual names and weights
 * V5: 7 dimensions from DIMENSION_CONFIG
 */
export function getDimensionDisplay(screenplay: Screenplay): DimensionDisplayItem[] {
  // V7: 5 Archaeology Engine pillars
  if (hasV7PillarScores(screenplay)) {
    return screenplay.v7PillarScores.map((pillar) => {
      const display = V7_PILLAR_DISPLAY[pillar.name] || { label: pillar.name, emoji: '📊' };
      return {
        key: pillar.name,
        label: display.label,
        score: pillar.score,
        weight: pillar.weight,
        justification: `See V7 ${display.label} Reader report`,
      };
    });
  }

  // V6: 4 pillars
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
  if (hasV7PillarScores(screenplay)) return 'V7 (5-Reader Archaeology)';
  if (hasV6CoreQuality(screenplay)) return 'V6 (4-Pillar)';
  return 'V5 (7-Dimension)';
}

