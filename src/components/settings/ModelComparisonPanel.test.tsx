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

    const candidateSection = screen
      .getByRole('heading', { name: 'Current comparison candidates' })
      .closest('section');
    expect(candidateSection).toHaveTextContent('Sonnet 5');
    expect(candidateSection).toHaveTextContent('Opus 5');
    expect(candidateSection).toHaveTextContent('Benchmark pending');
    expect(candidateSection).toHaveTextContent(
      'Availability is separate from approval. Production scoring stays on its benchmark-approved routes.',
    );
    expect(candidateSection).toHaveTextContent(
      'Fable 5 is restricted to Reader Chat and is not a screenplay-scoring candidate.',
    );

    const selectorSection = screen.getByRole('region', { name: 'Approved model selectors' });
    expect(selectorSection).toHaveTextContent('Sonnet 4.6');
    expect(selectorSection).toHaveTextContent('Opus 4.7');
    expect(selectorSection).toHaveTextContent('Opus 5');
    expect(selectorSection).toHaveTextContent('Fable 5');
    expect(selectorSection).toHaveTextContent('30-day retention');

    expect(document.body).toHaveTextContent('Haiku cold read + Sonnet 4.6');
    expect(document.body).toHaveTextContent('~$1.65–$4.75/script');
    expect(document.body).toHaveTextContent('~$1.60–$4.50/script');
    expect(document.body).toHaveTextContent('~$2.70–$7.50/script');
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
