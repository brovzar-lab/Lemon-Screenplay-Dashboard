import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: [] }),
}));

vi.mock('@/lib/analysisService', () => ({
  analyzeScreenplay: vi.fn(),
}));

import { analyzeScreenplay } from '@/lib/analysisService';
import { ModelComparisonPanel } from './ModelComparisonPanel';

const analyzeScreenplayMock = vi.mocked(analyzeScreenplay);

describe('ModelComparisonPanel model catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
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

  it('shows the exact aggregate cost for the Haiku composite route', async () => {
    analyzeScreenplayMock.mockResolvedValue({
      raw: {
        analysis: {
          core_quality: { weighted_score: 7.2, verdict: 'consider' },
        },
        model_provenance: [
          { returnedModel: 'claude-haiku-4-5-20251001' },
          { returnedModel: 'claude-sonnet-4-6' },
        ],
      },
      parsed: {} as never,
      usage: {
        input_tokens: 10_000,
        output_tokens: 2_000,
        actual_cost_microusd: 1_230_000,
        actual_cost_usd: 1.23,
      },
    });
    const { container } = render(<ModelComparisonPanel />);

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['screenplay'], 'draft.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: /Haiku cold read \+ Sonnet 4\.6/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sonnet 4\.6.*RECOMMENDED/i }));
    fireEvent.click(screen.getByRole('button', { name: /Run Comparison/i }));

    await waitFor(() => expect(screen.getByText('$1.23')).toBeInTheDocument());
    expect(analyzeScreenplayMock).toHaveBeenCalledWith(
      expect.any(File),
      'Comparison Lab',
      expect.objectContaining({ model: 'haiku' }),
      expect.any(Function),
    );
  });

  it('retains paid failure cost and exact model provenance', async () => {
    const paidFailure = Object.assign(new Error('Synthesis failed after a paid response.'), {
      usage: {
        input_tokens: 3_000,
        output_tokens: 400,
        actual_cost_microusd: 420_000,
        actual_cost_usd: 0.42,
      },
      provenance: [{
        returnedModel: 'claude-sonnet-4-6',
        responseId: 'msg_failed_synthesis',
      }],
    });
    analyzeScreenplayMock.mockRejectedValue(paidFailure);
    const { container } = render(<ModelComparisonPanel />);

    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [new File(['screenplay'], 'draft.pdf', { type: 'application/pdf' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: /Run Comparison/i }));

    await waitFor(() => {
      expect(screen.getByText(/Synthesis failed after a paid response/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Recorded cost: \$0\.42/)).toBeInTheDocument();
    expect(screen.getByText(/claude-sonnet-4-6/)).toBeInTheDocument();
  });
});
