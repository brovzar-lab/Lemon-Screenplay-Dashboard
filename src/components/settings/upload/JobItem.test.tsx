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
  it('explains exact-byte deduplication and allows the upload to be skipped', () => {
    const onSkip = vi.fn();

    render(
      <JobItem
        job={duplicateJob}
        onRemove={vi.fn()}
        onRetry={vi.fn()}
        onSkip={onSkip}
        onChooseRevision={vi.fn()}
        onChooseSeparate={vi.fn()}
      />,
    );

    expect(screen.getByText(/exactly the same bytes/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /re-analyze anyway/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new revision of/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /separate project/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /skip upload/i }));
    expect(onSkip).toHaveBeenCalledWith(duplicateJob.id);
  });

  it('asks the user to classify a title match instead of deciding automatically', () => {
    const onChooseRevision = vi.fn();
    const onChooseSeparate = vi.fn();
    const possibleMatch: UploadJob = {
      ...duplicateJob,
      id: 'possible-match',
      isDuplicate: false,
      possibleMatchProjectId: 'existing-project',
      existingTitle: 'Revised Draft',
    };

    render(
      <JobItem
        job={possibleMatch}
        onRemove={vi.fn()}
        onRetry={vi.fn()}
        onSkip={vi.fn()}
        onChooseRevision={onChooseRevision}
        onChooseSeparate={onChooseSeparate}
      />,
    );

    expect(screen.getByText(/possible match/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /new revision of revised draft/i }));
    expect(onChooseRevision).toHaveBeenCalledWith(possibleMatch.id);

    fireEvent.click(screen.getByRole('button', { name: /separate project/i }));
    expect(onChooseSeparate).toHaveBeenCalledWith(possibleMatch.id);
  });
});
