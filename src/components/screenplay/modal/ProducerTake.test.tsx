import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCoverageTestScreenplay, createTestScreenplay } from '@/test/factories';
import type { LocalProducerTakeDraft } from '@/lib/producerCalibration';
import type { ProducerAssessment } from '@/types';
import { ProducerTake } from './ProducerTake';

const mocks = vi.hoisted(() => ({
  loadProducerAssessment: vi.fn(),
  submitProducerAssessment: vi.fn(),
  isLocalCalibrationPreviewMode: vi.fn(() => false),
  loadLocalProducerTakeDraft: vi.fn(),
  saveLocalProducerTakeDraft: vi.fn(),
  loadLocalProducerWorkingDraft: vi.fn(),
  saveLocalProducerWorkingDraft: vi.fn(),
  clearLocalProducerWorkingDraft: vi.fn(),
}));

vi.mock('@/lib/producerCalibration', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/producerCalibration')>();
  return {
    ...original,
    loadProducerAssessment: mocks.loadProducerAssessment,
    submitProducerAssessment: mocks.submitProducerAssessment,
    isLocalCalibrationPreviewMode: mocks.isLocalCalibrationPreviewMode,
    loadLocalProducerTakeDraft: mocks.loadLocalProducerTakeDraft,
    saveLocalProducerTakeDraft: mocks.saveLocalProducerTakeDraft,
    loadLocalProducerWorkingDraft: mocks.loadLocalProducerWorkingDraft,
    saveLocalProducerWorkingDraft: mocks.saveLocalProducerWorkingDraft,
    clearLocalProducerWorkingDraft: mocks.clearLocalProducerWorkingDraft,
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
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

function localDraft(): LocalProducerTakeDraft {
  const saved = assessment();
  return {
    schemaVersion: 'lemon-local-producer-take-v1',
    projectId: saved.analysis.projectId,
    versionId: saved.analysis.versionId,
    title: saved.analysis.title,
    aiFinalScore: saved.analysis.aiFinalScore,
    aiVerdict: saved.analysis.aiVerdict,
    judgment: saved.judgment,
    revision: saved.revision,
    savedAt: saved.publishedAt,
  };
}

describe('ProducerTake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isLocalCalibrationPreviewMode.mockReturnValue(false);
    mocks.loadLocalProducerTakeDraft.mockReturnValue(null);
    mocks.loadLocalProducerWorkingDraft.mockReturnValue(null);
  });

  it('shows and saves a Coverage take without turning the normalized zero into an AI score', async () => {
    const user = userEvent.setup();
    mocks.saveLocalProducerTakeDraft.mockImplementation((input) => ({
      schemaVersion: 'lemon-local-producer-take-v1',
      ...input,
      revision: 1,
      savedAt: '2026-09-01T00:00:00.000Z',
    }));
    render(<ProducerTake screenplay={createCoverageTestScreenplay()} />, { wrapper });

    expect(await screen.findByText('Coverage · unscored by design')).toBeInTheDocument();
    expect(screen.getAllByText('Recommend')).not.toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'Coverage Producer Take' })).toBeInTheDocument();
    expect(screen.getByText('Producer verdict · no personal score')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Legacy Producer Draft' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Your score')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /calibration evidence/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Not verified / not rankable')).not.toBeInTheDocument();
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
    expect(screen.queryByText('5.0')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('What did the AI miss?'), 'The atmosphere plays strongly.');
    await user.click(screen.getByRole('button', { name: 'Save local take' }));
    expect(mocks.saveLocalProducerTakeDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        judgment: expect.not.objectContaining({ producerScore: expect.any(Number) }),
      }),
    );
    expect(mocks.saveLocalProducerTakeDraft).toHaveBeenCalledWith(
      expect.not.objectContaining({ aiFinalScore: expect.any(Number) }),
    );
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
    expect(
      screen.getByText('It undervalued how funny and playable the script is.'),
    ).toBeInTheDocument();
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
    await user.type(screen.getByLabelText('What did the AI miss?'), 'It undervalued the comedy.');
    await user.click(screen.getByRole('button', { name: 'Publish Producer Take' }));

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
    mocks.isLocalCalibrationPreviewMode.mockReturnValue(true);
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

    expect(await screen.findByRole('button', { name: 'Save local preview' })).toBeInTheDocument();
    expect(screen.getByText('Local review mode')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('saves a local preview without calling the undeployed server', async () => {
    const user = userEvent.setup();
    mocks.isLocalCalibrationPreviewMode.mockReturnValue(true);
    mocks.loadProducerAssessment.mockResolvedValue(null);
    mocks.saveLocalProducerTakeDraft.mockReturnValue(localDraft());
    const screenplay = createTestScreenplay({
      id: 'will-2010',
      projectId: 'will-2010',
      latestVersionId: 'version-sealed-1',
      title: 'Will 2010',
      weightedScore: 5.1,
      recommendation: 'pass',
    });

    render(<ProducerTake screenplay={screenplay} />, { wrapper });
    await screen.findByText('Local review mode');
    await user.type(screen.getByLabelText('What did the AI miss?'), 'It undervalued the comedy.');
    await user.click(screen.getByRole('button', { name: 'Save local preview' }));

    expect(mocks.saveLocalProducerTakeDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'will-2010',
        versionId: 'version-sealed-1',
        title: 'Will 2010',
      }),
    );
    expect(mocks.submitProducerAssessment).not.toHaveBeenCalled();
    expect(await screen.findByText(/Local preview · Revision 1/)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Producer Take saved' })).toHaveTextContent(
      'Saved on this Mac',
    );
    expect(screen.getByText('Calibration evidence')).toBeInTheDocument();
    expect(screen.getByText('Candidate test')).toBeInTheDocument();
    expect(screen.getByText('Future analyses')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View in Calibration' })).toHaveAttribute(
      'href',
      '/settings?tab=calibration',
    );
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
    expect(screen.getByRole('button', { name: 'Publish new revision' })).toBeInTheDocument();
  });

  it('allows a legacy project to save a local Producer Draft without calibration eligibility', async () => {
    const user = userEvent.setup();
    mocks.isLocalCalibrationPreviewMode.mockReturnValue(true);
    mocks.loadProducerAssessment.mockResolvedValue(null);
    mocks.saveLocalProducerTakeDraft.mockImplementation((input) => ({
      schemaVersion: 'lemon-local-producer-take-v1',
      ...input,
      revision: 1,
      savedAt: '2026-08-06T12:00:00.000Z',
    }));
    const screenplay = createTestScreenplay({
      id: 'legacy-project',
      projectId: 'legacy-project',
      latestVersionId: undefined,
      analysisVersion: 'v8_archaeology',
      weightedScore: 6.1,
      recommendation: 'consider',
    });

    render(<ProducerTake screenplay={screenplay} />, { wrapper });

    expect(await screen.findByRole('heading', { name: 'Legacy Producer Draft' })).toBeInTheDocument();
    expect(screen.getByText(/never enters calibration/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText('What did the AI miss?'), 'The tone works better than the score suggests.');
    await user.click(screen.getByRole('button', { name: 'Save Producer Draft' }));

    expect(mocks.saveLocalProducerTakeDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'legacy-project',
        versionId: 'legacy-unverified',
        judgment: expect.objectContaining({ includeInCalibration: false }),
      }),
    );
    expect(mocks.submitProducerAssessment).not.toHaveBeenCalled();
  });

  it('makes confidence explicit and keeps tentative takes out of calibration', async () => {
    const user = userEvent.setup();
    mocks.isLocalCalibrationPreviewMode.mockReturnValue(true);
    mocks.loadProducerAssessment.mockResolvedValue(null);
    const screenplay = createTestScreenplay({ latestVersionId: 'version-sealed-1' });

    render(<ProducerTake screenplay={screenplay} />, { wrapper });
    await screen.findByText('Local review mode');

    await user.click(screen.getByRole('button', { name: 'Tentative' }));
    expect(screen.getByRole('button', { name: 'Tentative' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('checkbox', { name: /Use this as calibration evidence/i })).toBeDisabled();
    expect(screen.getByText(/Tentative takes are always held out/i)).toBeInTheDocument();
  });

  it('restores an unfinished working draft after navigating away', async () => {
    mocks.isLocalCalibrationPreviewMode.mockReturnValue(true);
    mocks.loadProducerAssessment.mockResolvedValue(null);
    mocks.loadLocalProducerWorkingDraft.mockReturnValue({
      schemaVersion: 'lemon-local-producer-working-draft-v1',
      projectId: 'will-2010',
      versionId: 'version-sealed-1',
      judgment: {
        ...assessment().judgment,
        aiMissed: 'Restored unfinished thought.',
      },
      savedAt: '2026-08-06T12:00:00.000Z',
    });

    render(
      <ProducerTake
        screenplay={createTestScreenplay({
          id: 'will-2010',
          projectId: 'will-2010',
          latestVersionId: 'version-sealed-1',
        })}
      />,
      { wrapper },
    );

    expect(await screen.findByDisplayValue('Restored unfinished thought.')).toBeInTheDocument();
    expect(screen.getByText(/Unpublished draft restored/i)).toBeInTheDocument();
  });
});
