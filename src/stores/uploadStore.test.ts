import { beforeEach, describe, expect, it } from 'vitest';
import { isUploadJobReady, useUploadStore, type UploadJob } from './uploadStore';

const possibleMatch: UploadJob = {
  id: 'possible-match',
  filename: 'Shared Title.pdf',
  category: 'LEMON',
  status: 'pending',
  progress: 0,
  createdAt: '2026-07-21T00:00:00.000Z',
  existingTitle: 'Shared Title',
  possibleMatchProjectId: 'original-project',
};

describe('revision-aware upload decisions', () => {
  beforeEach(() => {
    useUploadStore.setState({ jobs: [], isProcessing: false });
  });

  it('blocks an unresolved title suggestion from the analysis queue', () => {
    expect(isUploadJobReady(possibleMatch)).toBe(false);
    expect(isUploadJobReady({ ...possibleMatch, isDuplicate: true })).toBe(false);
    expect(
      isUploadJobReady({
        ...possibleMatch,
        matchResolution: 'separate',
        separateProject: true,
      }),
    ).toBe(true);
    expect(
      isUploadJobReady({
        ...possibleMatch,
        matchResolution: 'revision',
      }),
    ).toBe(false);
  });

  it('does not queue a file until exact-byte detection finishes', () => {
    expect(
      isUploadJobReady({
        ...possibleMatch,
        possibleMatchProjectId: undefined,
        identityCheckComplete: false,
      }),
    ).toBe(false);
  });

  it('gives each queued file a stable upload identity before checking it', () => {
    const id = useUploadStore
      .getState()
      .addJob(
        'Shared Title.pdf',
        'LEMON',
        new File(['screenplay'], 'Shared Title.pdf', { type: 'application/pdf' }),
      );
    const job = useUploadStore.getState().jobs.find((candidate) => candidate.id === id);

    expect(job?.uploadId).toMatch(/^[a-zA-Z0-9_-]{8,128}$/);
    expect(job?.identityCheckComplete).toBe(false);
    expect(job && isUploadJobReady(job)).toBe(false);
  });

  it('sets a target only when the user chooses revision', () => {
    useUploadStore.setState({ jobs: [possibleMatch] });

    useUploadStore.getState().chooseRevision(possibleMatch.id);
    expect(useUploadStore.getState().jobs[0]).toEqual(
      expect.objectContaining({
        matchResolution: 'revision',
        targetProjectId: 'original-project',
        separateProject: false,
      }),
    );

    useUploadStore.getState().chooseSeparateProject(possibleMatch.id);
    expect(useUploadStore.getState().jobs[0]).toEqual(
      expect.objectContaining({
        matchResolution: 'separate',
        targetProjectId: undefined,
        separateProject: true,
      }),
    );
  });

  it('clears every terminal upload state, including Needs Review', () => {
    useUploadStore.setState({
      jobs: [
        { ...possibleMatch, id: 'complete', status: 'complete' },
        { ...possibleMatch, id: 'error', status: 'error' },
        { ...possibleMatch, id: 'skipped', status: 'skipped' },
        { ...possibleMatch, id: 'review', status: 'needs_review' },
        { ...possibleMatch, id: 'pending', status: 'pending' },
      ],
    });

    useUploadStore.getState().clearCompleted();

    expect(useUploadStore.getState().jobs.map((job) => job.id)).toEqual(['pending']);
  });
});
