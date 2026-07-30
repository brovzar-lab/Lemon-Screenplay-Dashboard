import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProducerAssessmentHead } from '@/types';
import { CalibrationPanel } from './CalibrationPanel';

const mocks = vi.hoisted(() => ({
  loadProducerAssessmentHeads: vi.fn(),
  loadCalibrationCandidates: vi.fn(),
  loadActiveCalibrationProfile: vi.fn(),
  buildCalibrationCandidate: vi.fn(),
  activateCalibrationCandidate: vi.fn(),
  rollbackCalibrationProfile: vi.fn(),
  isExpectedLocalCalibrationPredeployError: vi.fn(() => false),
  isLocalCalibrationPreviewMode: vi.fn(() => false),
  loadLocalProducerAssessmentHeads: vi.fn(),
}));

vi.mock('@/lib/producerCalibration', () => mocks);

function head(index: number): ProducerAssessmentHead {
  return {
    producerUid: 'billy-uid',
    projectId: `project-${index}`,
    latestAssessmentId: `assessment-${index}`,
    revision: 1,
    versionId: `sealed-version-${index}`,
    title: `Script ${index}`,
    aiFinalScore: 5 + index / 10,
    aiVerdict: 'pass',
    producerScore: 8 + index / 10,
    producerVerdict: 'recommend',
    pursuit: 'yes',
    includeInCalibration: true,
    updatedAt: `2026-07-${20 + index}T00:00:00.000Z`,
  };
}

describe('CalibrationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadProducerAssessmentHeads.mockResolvedValue(
      Array.from({ length: 5 }, (_, index) => head(index + 1)),
    );
    mocks.loadCalibrationCandidates.mockResolvedValue([]);
    mocks.loadActiveCalibrationProfile.mockResolvedValue(null);
    mocks.buildCalibrationCandidate.mockResolvedValue({});
    mocks.isExpectedLocalCalibrationPredeployError.mockReturnValue(false);
    mocks.isLocalCalibrationPreviewMode.mockReturnValue(false);
    mocks.loadLocalProducerAssessmentHeads.mockReturnValue([]);
    Object.defineProperty(window, 'confirm', {
      configurable: true,
      value: vi.fn(() => false),
    });
  });

  it('creates a disjoint four-training and one-holdout evidence split', async () => {
    render(<CalibrationPanel />);

    expect(await screen.findByText('Evidence split')).toBeInTheDocument();
    expect(screen.getByText('4 training')).toBeInTheDocument();
    expect(screen.getByText('1 holdout')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Build candidate' }),
    ).toBeEnabled();
  });

  it('warns about paid calls and never builds without explicit confirmation', async () => {
    const user = userEvent.setup();
    render(<CalibrationPanel />);
    await screen.findByText('Evidence split');

    await user.click(screen.getByRole('button', { name: 'Build candidate' }));

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('paid frontier-model calls'),
    );
    expect(mocks.buildCalibrationCandidate).not.toHaveBeenCalled();
  });

  it('blocks building when the holdout is removed', async () => {
    render(<CalibrationPanel />);
    await screen.findByText('Evidence split');

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Evidence role for Script 1' }),
      {
        target: { value: 'training' },
      },
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Build candidate' }),
      ).toBeDisabled(),
    );
  });

  it('shows Mac-only evidence while paid calibration remains disabled locally', async () => {
    mocks.isLocalCalibrationPreviewMode.mockReturnValue(true);
    mocks.isExpectedLocalCalibrationPredeployError.mockReturnValue(true);
    mocks.loadProducerAssessmentHeads.mockRejectedValue({
      code: 'permission-denied',
    });
    mocks.loadLocalProducerAssessmentHeads.mockReturnValue([head(1)]);

    render(<CalibrationPanel />);

    expect(await screen.findByText('Local review mode')).toBeInTheDocument();
    expect(screen.getByText('Script 1')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Available after deployment' }),
    ).toBeDisabled();
    expect(mocks.buildCalibrationCandidate).not.toHaveBeenCalled();
  });
});
