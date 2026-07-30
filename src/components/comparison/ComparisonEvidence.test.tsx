import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ComparisonRadar } from '@/components/comparison/ComparisonRadar';
import { ComparisonSideBySide } from '@/components/comparison/ComparisonSideBySide';
import { createTestScreenplay } from '@/test/factories';

function mixedGenerationScreenplays() {
  return [
    createTestScreenplay({
      id: 'v9',
      title: 'Current Analysis',
      analysisVersion: 'v9_archaeology',
      pillarScores: [
        { name: 'structure', score: 7.2, weight: 0.3 },
        { name: 'character', score: 7.1, weight: 0.3 },
        { name: 'craft_scene', score: 6.8, weight: 0.15 },
        { name: 'concept', score: 7.6, weight: 0.15 },
        { name: 'emotional_resonance', score: 7.4, weight: 0.1 },
      ],
    }),
    createTestScreenplay({
      id: 'legacy',
      title: 'Legacy Analysis',
      analysisVersion: 'v6',
    }),
  ];
}

describe('mixed-generation comparison evidence', () => {
  it('keeps five-pillar and legacy dimensions in separate side-by-side sections', () => {
    render(
      <ComparisonSideBySide
        screenplays={mixedGenerationScreenplays()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText('Five-Pillar Reader Evidence')).toBeInTheDocument();
    expect(screen.getByText('Legacy Dimension Scores')).toBeInTheDocument();
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
  });

  it('refuses to overlay unlike evidence systems on one radar', () => {
    render(
      <ComparisonRadar
        screenplays={mixedGenerationScreenplays()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Mixed analysis generations',
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'will not overlay them on one radar',
    );
  });
});
