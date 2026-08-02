import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReaderRoom } from '@/components/project/ReaderRoom';
import { createTestScreenplay } from '@/test/factories';

vi.mock('@/lib/readerReportService', () => ({
  fetchReaderReports: vi.fn(async () => [
    {
      reader: 'structure',
      label: 'Structure',
      pillarScore: 7.8,
      oneSentenceVerdict: 'The midpoint turns the movie, but the ending arrives late.',
      redFlags: ['Act three compresses the final choice.'],
      subScores: [{
        key: 'turns',
        label: 'Turns',
        score: 8.1,
        justification: 'The midpoint reverses the protagonist’s plan.',
        pageCitations: [48, 51],
      }],
    },
    {
      reader: 'character',
      label: 'Character',
      pillarScore: 6.9,
      oneSentenceVerdict: 'The lead is funny, though too passive in the final movement.',
      redFlags: [],
      subScores: [{
        key: 'agency',
        label: 'Agency',
        score: 6.4,
        justification: 'The lead reacts instead of choosing.',
        pageCitations: [82],
      }],
    },
  ]),
}));

function renderRoom() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ReaderRoom screenplay={createTestScreenplay({ projectId: 'atlas' })} />
    </QueryClientProvider>,
  );
}

describe('ReaderRoom', () => {
  it('uses five clearly-labelled AI personas while grounding the selected reader in stored evidence', async () => {
    const user = userEvent.setup();
    renderRoom();

    expect(await screen.findByRole('heading', { name: 'The Readers Room' })).toBeInTheDocument();
    expect(screen.getAllByText('AI persona')).toHaveLength(5);
    expect(await screen.findByText('Pages 48, 51')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Character Reader/i }));
    expect(screen.getByText('The lead is funny, though too passive in the final movement.')).toBeInTheDocument();
    expect(screen.getByText('Pages 82')).toBeInTheDocument();
  });

  it('opens an honest no-cost talk preview without making a model call', async () => {
    const user = userEvent.setup();
    renderRoom();

    await screen.findByText('Pages 48, 51');
    await user.click(screen.getByRole('button', { name: /Talk with Lena/i }));

    expect(screen.getByRole('dialog', { name: 'Conversation preview' })).toBeInTheDocument();
    expect(screen.getByText(/Gemini Live remains off/i)).toBeInTheDocument();
    expect(screen.getByText(/No model call has been made/i)).toBeInTheDocument();
  });
});
