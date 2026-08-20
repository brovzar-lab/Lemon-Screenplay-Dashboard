import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: [] }),
}));

vi.mock('@/lib/analysisService', () => ({
  analyzeScreenplay: vi.fn(),
}));

import { ModelComparisonPanel } from './ModelComparisonPanel';

describe('ModelComparisonPanel model catalog', () => {
  it('separates current comparison candidates from approved scoring routes', () => {
    render(<ModelComparisonPanel />);

    expect(screen.getByRole('heading', { name: 'Current comparison candidates' })).toBeInTheDocument();
    expect(screen.getByText('Sonnet 5')).toBeInTheDocument();
    expect(screen.getByText('Opus 5')).toBeInTheDocument();
    expect(screen.getByText('Fable 5')).toBeInTheDocument();
    expect(screen.getAllByText('Current candidate')).toHaveLength(2);
    expect(screen.getByText('Optional premium')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Availability is separate from approval. Production scoring stays on its benchmark-approved routes.',
      ),
    ).toBeInTheDocument();

    expect(screen.getByText('Haiku 4.5')).toBeInTheDocument();
    expect(screen.getByText('Sonnet 4.6')).toBeInTheDocument();
    expect(screen.getByText('Opus 4.7')).toBeInTheDocument();
    expect(screen.getByText(/~\$0\.50–\$1\.50\/script/)).toBeInTheDocument();
    expect(screen.getByText(/~\$1\.60–\$4\.50\/script/)).toBeInTheDocument();
    expect(screen.getByText(/~\$2\.70–\$7\.50\/script/)).toBeInTheDocument();
    expect(screen.queryByText('Sonnet 4.5')).not.toBeInTheDocument();
    expect(screen.queryByText('Opus 4.6')).not.toBeInTheDocument();
    expect(screen.queryByText('Opus 4')).not.toBeInTheDocument();
    expect(screen.queryByText('~$3.00')).not.toBeInTheDocument();
  });

  it('explains the full V9 reader and synthesis process', () => {
    render(<ModelComparisonPanel />);

    expect(
      screen.getByText(
        'Five specialist readers examine structure, character, craft, concept, and emotion. A final synthesis checks their evidence and produces the Lemon score and verdict.',
      ),
    ).toBeInTheDocument();
  });
});
