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
      { target: { value: 'training' } },
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Build candidate' }),
      ).toBeDisabled(),
    );
  });
});
