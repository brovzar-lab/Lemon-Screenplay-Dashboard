import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TasteMatch } from './TasteMatch';
import { loadAllBrainVerdicts } from '@/lib/feedbackStore';

vi.mock('@/lib/feedbackStore', () => ({
  loadAllBrainVerdicts: vi.fn(),
}));

const mockLoad = vi.mocked(loadAllBrainVerdicts);

describe('TasteMatch', () => {
  beforeEach(() => mockLoad.mockReset());

  it('shows agreement, bias direction, genres, and disagreements', async () => {
    mockLoad.mockResolvedValue([
      {
        screenplayId: '1', screenplayTitle: 'Match', billyVerdict: 'consider', aiVerdict: 'consider',
        note: '', genre: 'Drama', subgenres: [], weightedScore: 6, source: 'screenplay-dashboard',
      },
      {
        screenplayId: '2', screenplayTitle: 'Too Generous', billyVerdict: 'pass', aiVerdict: 'recommend',
        note: '', genre: 'Drama', subgenres: [], weightedScore: 8, source: 'screenplay-dashboard',
      },
    ]);

    render(<TasteMatch />);

    await waitFor(() => expect(screen.getAllByText('50%')).toHaveLength(2));
    expect(screen.getByText('AI too generous')).toBeInTheDocument();
    expect(screen.getByText('Too Generous')).toBeInTheDocument();
    expect(screen.getByLabelText('Drama agreement')).toHaveValue(50);
  });

  it('explains how to create the first taste signal', async () => {
    mockLoad.mockResolvedValue([]);
    render(<TasteMatch />);

    expect(await screen.findByText(/Record Billy's Take/)).toBeInTheDocument();
  });
});
