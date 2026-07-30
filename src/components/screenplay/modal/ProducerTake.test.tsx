import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestScreenplay } from '@/test/factories';
import type { ProducerAssessment } from '@/types';
import { ProducerTake } from './ProducerTake';

const mocks = vi.hoisted(() => ({
  loadProducerAssessment: vi.fn(),
  submitProducerAssessment: vi.fn(),
}));

vi.mock('@/lib/producerCalibration', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/lib/producerCalibration')>();
  return {
    ...original,
    loadProducerAssessment: mocks.loadProducerAssessment,
    submitProducerAssessment: mocks.submitProducerAssessment,
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function assessment(): ProducerAssessment {
  return {
    schemaVersion: 'lemon-producer-assessment-v1',
    assessmentId: 'assessment-1',
    producerUid: 'billy-uid',
    producerEmail: 'billy@lemonfilms.com',
    producerDisplayName: 'Billy Rovzar',
    revision: 1,
    supersedesAssessmentId: null,
    publishedAt: '2026-07-30T00:00:00.000Z',
    analysis: {
      projectId: 'will-2010',
      versionId: 'version-sealed-1',
      contentHash: 'a'.repeat(64),
      trustManifestVersion: 'lemon-analysis-trust-v4',
      trustManifestIntegritySha256: 'b'.repeat(64),
      title: 'Will 2010',
      genre: 'Comedy',
      aiFinalScore: 5.1,
      aiRawScore: 5.1,
      aiVerdict: 'pass',
      pillarScores: [],
      calibrationProfileVersionId: null,
    },
    judgment: {
      producerScore: 8.7,
      producerVerdict: 'recommend',
      pursuit: 'yes',
      fixability: 'high',
      confidence: 'high',
      tasteSignals: ['comedy', 'reading_pleasure'],
      aiMissed: 'It undervalued how funny and playable the script is.',
      aiGotRight: 'The lead can become more active at the end.',
      pillarOverrides: {},
      includeInCalibration: true,
    },
  };
}

describe('ProducerTake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the producer judgment beside the unchanged AI final', async () => {
    mocks.loadProducerAssessment.mockResolvedValue(assessment());
    const screenplay = createTestScreenplay({
      id: 'will-2010',
      projectId: 'will-2010',
      latestVersionId: 'version-sealed-1',
      weightedScore: 5.1,
      recommendation: 'pass',
    });

    render(<ProducerTake screenplay={screenplay} />, { wrapper });

    expect(await screen.findByText('Producer Take')).toBeInTheDocument();
    expect(screen.getByText('5.1')).toBeInTheDocument();
    expect(screen.getByText('8.7')).toBeInTheDocument();
    expect(screen.getByText('It undervalued how funny and playable the script is.')).toBeInTheDocument();
    expect(screenplay.weightedScore).toBe(5.1);
  });

  it('publishes an exact-version Producer Take without rewriting the AI score', async () => {
    const user = userEvent.setup();
    mocks.loadProducerAssessment.mockResolvedValue(null);
    mocks.submitProducerAssessment.mockImplementation(
      async ({ judgment }: { judgment: ProducerAssessment['judgment'] }) => ({
        ...assessment(),
        judgment,
      }),
    );
    const screenplay = createTestScreenplay({
      id: 'will-2010',
      projectId: 'will-2010',
      latestVersionId: 'version-sealed-1',
      weightedScore: 5.1,
      recommendation: 'pass',
    });

    render(<ProducerTake screenplay={screenplay} />, { wrapper });
    await screen.findByText('Producer Take');

    fireEvent.change(screen.getByLabelText('Your score'), {
      target: { value: '8.8' },
    });
    await user.click(screen.getByRole('button', { name: 'Recommend' }));
    await user.type(
      screen.getByLabelText('What did the AI miss?'),
      'It undervalued the comedy.',
    );
    await user.click(
      screen.getByRole('button', { name: 'Publish Producer Take' }),
    );

    await waitFor(() =>
      expect(mocks.submitProducerAssessment).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'will-2010',
          versionId: 'version-sealed-1',
          judgment: expect.objectContaining({
            producerScore: 8.8,
            producerVerdict: 'recommend',
          }),
        }),
      ),
    );
    expect(screenplay.weightedScore).toBe(5.1);
  });

  it('shows a clean local first-take form before Q5 security rules are deployed', async () => {
    mocks.loadProducerAssessment.mockRejectedValue({
      code: 'permission-denied',
    });
    const screenplay = createTestScreenplay({
      id: 'will-2010',
      projectId: 'will-2010',
      latestVersionId: 'version-sealed-1',
      weightedScore: 5.1,
      recommendation: 'pass',
    });

    render(<ProducerTake screenplay={screenplay} />, { wrapper });

    expect(
      await screen.findByRole('button', { name: 'Publish Producer Take' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('requires a new take when the screenplay analysis version has changed', async () => {
    mocks.loadProducerAssessment.mockResolvedValue(assessment());
    const screenplay = createTestScreenplay({
      id: 'will-2010',
      projectId: 'will-2010',
      latestVersionId: 'version-sealed-2',
      weightedScore: 6.2,
      recommendation: 'consider',
    });

    render(<ProducerTake screenplay={screenplay} />, { wrapper });

    expect(
      await screen.findByText(
        'Your saved take belongs to an earlier analysis version. Saving now creates a new version-specific assessment.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Your score')).toHaveValue('6.2');
    expect(
      screen.getByRole('button', { name: 'Publish new revision' }),
    ).toBeInTheDocument();
  });
});
