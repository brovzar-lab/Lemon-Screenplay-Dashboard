import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { UploadJob } from '@/stores/uploadStore';
import { JobItem } from './JobItem';

const duplicateJob: UploadJob = {
  id: 'duplicate-job',
  filename: 'Revised_Draft.pdf',
  category: 'LEMON',
  status: 'pending',
  progress: 0,
  createdAt: '2026-07-21T00:00:00.000Z',
  isDuplicate: true,
  existingTitle: 'Revised Draft',
};

describe('JobItem duplicate safety', () => {
  it('blocks unsafe reanalysis and allows the upload to be skipped', () => {
    const onSkip = vi.fn();

    render(
      <JobItem
        job={duplicateJob}
        onRemove={vi.fn()}
        onRetry={vi.fn()}
        onSkip={onSkip}
      />,
    );

    expect(screen.getByText(/revision uploads are temporarily paused/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /re-analyze anyway/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /skip upload/i }));
    expect(onSkip).toHaveBeenCalledWith(duplicateJob.id);
  });
});
