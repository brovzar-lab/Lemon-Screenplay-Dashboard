/**
 * Dimension Display Adapter
 * Returns version-appropriate dimension labels and scores.
 *
 * V9 screenplays have 5 weighted pillars from the Archaeology Engine (Structure,
 * Character, Craft & Scene, Concept, Emotional Resonance). Documents without
 * pillar scores (e.g. triage-only stubs) fall back to the flat 7-dimension
 * display defined in DIMENSION_CONFIG.
 */

import type { Screenplay } from '@/types';
import { DIMENSION_CONFIG } from '@/types/screenplay';
import type { PillarScore } from '@/lib/normalize';

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
function hasPillarScores(screenplay: Screenplay): screenplay is Screenplay & { pillarScores: PillarScore[] } {
  return 'pillarScores' in screenplay
    && Array.isArray(screenplay.pillarScores)
    && screenplay.pillarScores.length > 0;
}

/**
 * Returns version-appropriate dimension display data.
 *
 * V9: 5 pillars from the Archaeology Engine with methodology-specific names
 * V5: 7 dimensions from DIMENSION_CONFIG (legacy fallback)
 */
export function getDimensionDisplay(screenplay: Screenplay): DimensionDisplayItem[] {
  // V9: 5 Archaeology Engine pillars
  if (hasPillarScores(screenplay)) {
    return screenplay.pillarScores.map((pillar) => {
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
  if (hasPillarScores(screenplay)) return 'V9 (5-Reader Archaeology)';
  return 'Legacy (no pillar scores)';
}

