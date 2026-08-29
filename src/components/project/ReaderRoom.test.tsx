import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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
      subScores: [
        {
          key: 'turns',
          label: 'Turns',
          score: 8.1,
          justification: 'The midpoint reverses the protagonist’s plan.',
          pageCitations: [48, 51],
        },
      ],
    },
    {
      reader: 'character',
      label: 'Character',
      pillarScore: 6.9,
      oneSentenceVerdict: 'The lead is funny, though too passive in the final movement.',
      redFlags: [],
      subScores: [
        {
          key: 'agency',
          label: 'Agency',
          score: 6.4,
          justification: 'The lead reacts instead of choosing.',
          pageCitations: [82],
        },
      ],
    },
  ]),
}));

function renderRoom(overrides = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ReaderRoom screenplay={createTestScreenplay({
        projectId: 'atlas',
        latestVersionId: 'v9-sealed',
        hasPdf: true,
        storagePath: 'screenplays/atlas.pdf',
        ...overrides,
      })} />
    </QueryClientProvider>,
  );
}

describe('ReaderRoom', () => {
  it('presents five specialist readers without AI persona labels and grounds each in sealed evidence', async () => {
    const user = userEvent.setup();
    renderRoom();

    expect(await screen.findByRole('heading', { name: 'The Readers Room' })).toBeInTheDocument();
    expect(screen.queryByText(/AI persona/i)).not.toBeInTheDocument();
    expect(await screen.findByText('Pages 48, 51')).toBeInTheDocument();

    const characterReader = screen.getByRole('button', { name: /Character Reader/i });
    await user.click(characterReader);
    expect(
      screen.getByRole('dialog', { name: /Private conversation with Marcus/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /View Marcus’s sealed report/i }));
    await waitFor(() => expect(characterReader).toHaveFocus());
    expect(
      screen.getByText('The lead is funny, though too passive in the final movement.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Pages 82')).toBeInTheDocument();
  });

  it('opens the no-cost private conversation and saves a cited local exchange', async () => {
    const user = userEvent.setup();
    renderRoom();

    await screen.findByText('Pages 48, 51');
    await user.click(screen.getByRole('button', { name: /Structure Reader/i }));

    expect(
      screen.getByRole('dialog', { name: /Private conversation with Lena/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/No model call or charge occurs/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Ask Lena anything/i), 'Why did the ending feel late?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Why did the ending feel late?')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /Show full response/i }));
    expect(screen.getByText(/My sealed position remains/i)).toBeInTheDocument();
    expect(screen.getByText('p. 48')).toBeInTheDocument();
  });

  it('explains exactly why a legacy project is not ready for private chat', async () => {
    renderRoom({ latestVersionId: undefined, hasPdf: false, storagePath: undefined });

    expect(await screen.findByText(/Current sealed analysis required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reanalyze to create a citable analysis version/i })).toBeDisabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not treat a claimed version id as sealed without verified decision lineage', async () => {
    renderRoom({ producerProjection: undefined });

    expect(await screen.findByText(/Current sealed analysis required/i)).toBeInTheDocument();
    expect(screen.getByText(/Legacy reader evidence/i)).toBeInTheDocument();
    expect(screen.queryByText('Pages 48, 51')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows both reader positions before the roundtable resolution', async () => {
    renderRoom({
      readerDisagreements: [
        {
          topic: 'comic engine versus character agency',
          readerA: 'Character Reader',
          readerAPosition: 'The lead is too passive in the final movement.',
          readerB: 'Emotion Reader',
          readerBPosition: 'The passivity creates comic tension and audience sympathy.',
          resolution: 'Preserve the comic engine while giving the lead one decisive final choice.',
        },
      ],
    });

    expect((await screen.findAllByText('Character Reader')).length).toBeGreaterThan(1);
    expect(screen.getByText('The lead is too passive in the final movement.')).toBeInTheDocument();
    expect(screen.getAllByText('Emotion Reader').length).toBeGreaterThan(1);
    expect(screen.getByText('The passivity creates comic tension and audience sympathy.')).toBeInTheDocument();
    expect(screen.getByText(/Preserve the comic engine/i)).toBeInTheDocument();
  });
});
