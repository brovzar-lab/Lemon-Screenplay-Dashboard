import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUploadStore, type UploadJob } from '@/stores/uploadStore';

const mockUpload = vi.fn();
const mockReceipt = vi.fn();
const mockComputeHash = vi.fn();
const mockFindByHash = vi.fn();
const mockSubscribe = vi.fn((..._args: unknown[]) => vi.fn());

vi.mock('@/lib/firebase', () => ({
  uploadPdfToIngestQueue: (...args: unknown[]) => mockUpload(...args),
  getIngestUploadGeneration: (...args: unknown[]) => mockReceipt(...args),
}));

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: [] }),
  SCREENPLAYS_QUERY_KEY: ['screenplays'],
}));

vi.mock('@/hooks/useCategories', () => ({
  default: () => ({ categoryIds: ['LEMON', 'SUBMISSION'], addCategory: vi.fn() }),
}));

vi.mock('@/lib/ingestQueueClient', () => ({
  subscribeToIngestQueue: (...args: unknown[]) => mockSubscribe(...args),
}));

vi.mock('@/lib/analysisIdentity', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/analysisIdentity')>(),
  computeContentHash: (...args: unknown[]) => mockComputeHash(...args),
}));

vi.mock('@/lib/analysisLookup', () => ({
  findAnalysisByContentHash: (...args: unknown[]) => mockFindByHash(...args),
}));

vi.mock('@/components/badFormat/BadFormatModal', () => ({
  BadFormatModal: ({ open }: { open: boolean }) => open ? <div>Upload Resolution Center</div> : null,
}));

import { UploadPanel } from '@/components/settings/UploadPanel';

function renderPanel(props: React.ComponentProps<typeof UploadPanel> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <div className="discovery-root">
        <UploadPanel presentation="intake" initialModel="hybrid" {...props} />
      </div>
    </QueryClientProvider>,
  );
}

describe('Intake upload presentation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUpload.mockReset().mockImplementation((file: File) => Promise.resolve({
      storagePath: `gs://bucket/ingest-queue/LEMON/upload/${file.name}`,
      objectName: `ingest-queue/LEMON/upload/${file.name}`,
      uploadId: 'upload-id',
    }));
    mockComputeHash.mockReset().mockResolvedValue('content-hash');
    mockFindByHash.mockReset().mockResolvedValue(null);
    mockSubscribe.mockClear();
    mockReceipt.mockReset().mockResolvedValue(null);
    useUploadStore.setState({ jobs: [], isProcessing: false, dismissedQueueJobs: {} });
  });

  it('shows an honest empty ledger and defaults to Coverage V1.2', () => {
    renderPanel();

    expect(screen.getByText('The desk is clear')).toBeInTheDocument();
    expect(screen.getByText('Coverage · unscored by design')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hybrid/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Choose screenplay PDFs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose folder' })).toBeInTheDocument();
  });

  it.each([false, true])('does not overwrite queue completion after a late upload acknowledgment (rejected=%s)', async (reject) => {
    const user = userEvent.setup();
    const file = new File(['screenplay'], 'Race.pdf', { type: 'application/pdf' });
    const id = useUploadStore.getState().addJob(file.name, 'LEMON', file);
    useUploadStore.getState().updateJob(id, { identityCheckComplete: true });
    mockUpload.mockImplementation(async (_file: File, _category: string, options: { onPrepared: (path: string) => void }) => {
      const path = 'gs://bucket/ingest-queue/LEMON/race.pdf';
      options.onPrepared(path);
      useUploadStore.getState().reconcileQueue([{ jobId: 'server-race', status: 'complete',
        storagePath: path, storageGeneration: '1', filename: file.name, category: 'LEMON', queuedAt: '' }]);
      if (reject) throw new Error('lost acknowledgment');
      return { storagePath: path, storageGeneration: '1' };
    });
    renderPanel({ presentation: 'settings' });
    await user.click(screen.getByRole('button', { name: /Start Analysis/ }));
    await waitFor(() => expect(useUploadStore.getState().isProcessing).toBe(false));
    expect(useUploadStore.getState().jobs.find((job) => job.id === id)?.status).toBe('complete');
  });

  it.each([null, '1'])('checks uncertain receipt before retry and does not start a paid call (generation=%s)', async (generation) => {
    const user = userEvent.setup();
    useUploadStore.setState({ jobs: [{ id: 'uncertain', filename: 'Maybe.pdf', category: 'LEMON', status: 'error',
      progress: 0, createdAt: '', ingestQueueStoragePath: 'gs://bucket/ingest-queue/LEMON/maybe.pdf' }] });
    mockReceipt.mockResolvedValue(generation);
    renderPanel();
    await user.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(useUploadStore.getState().jobs[0].status).toBe(generation ? 'uploaded' : 'pending'));
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('does not regress queue completion while receipt recovery is awaiting Storage', async () => {
    const user = userEvent.setup();
    const path = 'gs://bucket/ingest-queue/LEMON/maybe.pdf';
    useUploadStore.setState({ jobs: [{ id: 'uncertain', filename: 'Maybe.pdf', category: 'LEMON', status: 'error',
      progress: 0, createdAt: '', ingestQueueStoragePath: path }] });
    mockReceipt.mockImplementation(async () => {
      useUploadStore.getState().reconcileQueue([{ jobId: 'accepted', status: 'complete', storagePath: path,
        storageGeneration: '1', filename: 'Maybe.pdf', category: 'LEMON', queuedAt: '' }]);
      return '1';
    });
    renderPanel();
    await user.click(screen.getByRole('button', { name: /Retry/ }));
    expect(useUploadStore.getState().jobs[0].status).toBe('complete');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('returns a failed replacement to its original resolution route instead of restarting generic Intake', async () => {
    const user = userEvent.setup();
    useUploadStore.setState({ jobs: [{ id: 'replacement', filename: 'Replacement.pdf', category: 'LEMON',
      status: 'error', replacesQueueJobId: 'original-issue', progress: 0, createdAt: '', identityCheckComplete: false }] });
    renderPanel();
    await user.click(screen.getByRole('button', { name: /Retry/ }));
    expect(screen.getByText('Upload Resolution Center')).toBeInTheDocument();
    expect(useUploadStore.getState().jobs[0].status).toBe('error');
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockReceipt).not.toHaveBeenCalled();
  });

  it('opens a completed analysis from the authoritative project id', async () => {
    const user = userEvent.setup();
    const onOpenAnalysis = vi.fn();
    const completeJob: UploadJob = {
      id: 'complete-job',
      filename: 'Finished.pdf',
      category: 'LEMON',
      status: 'complete',
      progress: 100,
      createdAt: new Date().toISOString(),
      result: {
        title: 'Finished',
        author: 'See analysis',
        analysisPath: 'firestore',
        projectId: 'stable-project-id',
      },
    };
    useUploadStore.setState({ jobs: [completeJob], isProcessing: false });
    renderPanel({ onOpenAnalysis });

    await user.click(screen.getByRole('button', { name: 'Open analysis' }));

    expect(onOpenAnalysis).toHaveBeenCalledWith('stable-project-id');
  });

  it('requires a final confirmation before any paid analysis can begin', async () => {
    const user = userEvent.setup();
    const file = new File(['screenplay'], 'New_Script.pdf', { type: 'application/pdf' });
    const jobId = useUploadStore.getState().addJob('New_Script.pdf', 'LEMON', file);
    useUploadStore.getState().updateJob(jobId, { identityCheckComplete: true });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /Review and start analysis/ }));

    const dialog = screen.getByRole('alertdialog', { name: 'Authorize paid analysis?' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('New_Script.pdf')).toBeInTheDocument();
    expect(within(dialog).getByText(/No analysis starts unless you authorize it below/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Authorize paid analysis for 1 screenplay' })).toBeDisabled();
    expect(mockUpload).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog', { name: 'Authorize paid analysis?' })).not.toBeInTheDocument();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('blocks exact duplicates selected together before analysis', async () => {
    const user = userEvent.setup();
    const first = new File(['same bytes'], 'First.pdf', { type: 'application/pdf' });
    const second = new File(['same bytes'], 'Second.pdf', { type: 'application/pdf' });
    mockComputeHash.mockResolvedValue('same-content-hash');
    renderPanel();

    await user.upload(screen.getByLabelText('Choose screenplay PDFs'), [first, second]);

    expect(await screen.findByText(/1 exact duplicate/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review and start analysis \(1 file\)/ })).toBeInTheDocument();
  });

  it('requires an explicit choice for same-title projects selected together', async () => {
    const user = userEvent.setup();
    const first = new File(['first draft'], 'Shared_Title.pdf', { type: 'application/pdf' });
    const second = new File(['second draft'], 'Shared_Title.pdf', { type: 'application/pdf' });
    mockComputeHash.mockResolvedValueOnce('first-hash').mockResolvedValueOnce('second-hash');
    renderPanel();

    await user.upload(screen.getByLabelText('Choose screenplay PDFs'), [first, second]);

    expect(await screen.findByText(/1 possible match/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review and start analysis \(1 file\)/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Separate project' }));
    expect(screen.getByRole('button', { name: /Review and start analysis \(2 files\)/ })).toBeInTheDocument();
  });

  it('shows the hard Coverage ceiling in the final confirmation', async () => {
    const user = userEvent.setup();
    const first = new File(['first'], 'First.pdf', { type: 'application/pdf' });
    const second = new File(['second'], 'Second.pdf', { type: 'application/pdf' });
    mockComputeHash.mockResolvedValueOnce('first-hash').mockResolvedValueOnce('second-hash');
    renderPanel();

    await user.upload(screen.getByLabelText('Choose screenplay PDFs'), [first, second]);
    await user.click(await screen.findByRole('button', { name: /Review and start analysis \(2 files\)/ }));

    const dialog = screen.getByRole('alertdialog', { name: 'Authorize paid analysis?' });
    expect(within(dialog).getByText('Estimated batch cost')).toBeInTheDocument();
    expect(within(dialog).getByText('≤$2.00')).toBeInTheDocument();
    expect(within(dialog).getByText('First.pdf')).toBeInTheDocument();
    expect(within(dialog).getByText('Second.pdf')).toBeInTheDocument();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('requires explicit paid-analysis authorization before the final action', async () => {
    const user = userEvent.setup();
    const file = new File(['screenplay'], 'Greenlight.pdf', { type: 'application/pdf' });
    const jobId = useUploadStore.getState().addJob('Greenlight.pdf', 'LEMON', file);
    useUploadStore.getState().updateJob(jobId, { identityCheckComplete: true });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /Review and start analysis/ }));
    const authorize = screen.getByRole('button', { name: 'Authorize paid analysis for 1 screenplay' });
    expect(authorize).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /I understand that this starts paid AI analysis now/ }));
    expect(authorize).toBeEnabled();
    expect(mockUpload).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: /Review and start analysis/ }));
    expect(screen.getByRole('button', { name: 'Authorize paid analysis for 1 screenplay' })).toBeDisabled();
  });

  it('uploads the accepted batch as Coverage V1.2 without waiting for analysis', async () => {
    const user = userEvent.setup();
    const first = new File(['first'], 'First.pdf', { type: 'application/pdf' });
    const second = new File(['second'], 'Second.pdf', { type: 'application/pdf' });
    mockComputeHash.mockResolvedValueOnce('first-hash').mockResolvedValueOnce('second-hash');
    renderPanel();

    await user.upload(screen.getByLabelText('Choose screenplay PDFs'), [first, second]);
    await user.click(await screen.findByRole('button', { name: /Review and start analysis \(2 files\)/ }));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Authorize paid analysis for 2 screenplays' }));

    await waitFor(() => expect(mockUpload).toHaveBeenCalledTimes(2));
    expect(mockUpload.mock.calls[0][2]).toEqual(expect.objectContaining({
      engine: 'coverage_v1',
      requestedModel: 'sonnet',
    }));
    expect(useUploadStore.getState().jobs.every((job) => job.status === 'uploaded')).toBe(true);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it('reconnects an accepted queue job and preserves its authoritative project route', async () => {
    const onOpenAnalysis = vi.fn();
    const acceptedJob: UploadJob = {
      id: 'accepted-job',
      filename: 'Reloaded.pdf',
      category: 'LEMON',
      status: 'analyzing',
      progress: 20,
      createdAt: new Date().toISOString(),
      ingestQueueStoragePath: 'ingest-queue/LEMON/upload/Reloaded.pdf',
    };
    useUploadStore.setState({ jobs: [acceptedJob], isProcessing: false });
    renderPanel({ onOpenAnalysis });

    expect(mockSubscribe).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
    );
    const onUpdate = mockSubscribe.mock.calls[0][0] as (update: import('@/lib/ingestQueueClient').IngestQueueJob[]) => void;
    act(() => onUpdate([{ status: 'complete', jobId: 'queue-reloaded', storagePath: acceptedJob.ingestQueueStoragePath!, filename: acceptedJob.filename, category: 'LEMON', queuedAt: acceptedJob.createdAt, screenplayDocId: 'reloaded-project' }]));

    expect(await screen.findByRole('button', { name: 'Open analysis' })).toBeInTheDocument();
    expect(useUploadStore.getState().jobs[0].result?.projectId).toBe('reloaded-project');
  });

  it('reconciles a persisted review job when the queue later completes', async () => {
    const acceptedJob: UploadJob = {
      id: 'review-job',
      filename: 'Cosquillitas_Draft_9.pdf',
      category: 'LEMON',
      status: 'needs_review',
      progress: 60,
      error: 'Synthesis failed after 3 attempts',
      createdAt: new Date().toISOString(),
      ingestQueueStoragePath: 'ingest-queue/LEMON/upload/Cosquillitas_Draft_9.pdf',
    };
    useUploadStore.setState({ jobs: [acceptedJob], isProcessing: false });
    renderPanel();

    expect(mockSubscribe).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
    );
    const onUpdate = mockSubscribe.mock.calls[0][0] as (update: import('@/lib/ingestQueueClient').IngestQueueJob[]) => void;
    act(() => onUpdate([{ status: 'complete', jobId: 'queue-review', storagePath: acceptedJob.ingestQueueStoragePath!, filename: acceptedJob.filename, category: 'LEMON', queuedAt: acceptedJob.createdAt, screenplayDocId: 'Cosquillitas_Draft_9.pdf' }]));

    expect(useUploadStore.getState().jobs[0]).toMatchObject({
      status: 'complete',
      error: undefined,
      result: { projectId: 'Cosquillitas_Draft_9.pdf' },
    });
  });

  it('keeps one global subscription even when local jobs have settled', () => {
    const completeJob: UploadJob = {
      id: 'settled-job',
      filename: 'Finished.pdf',
      category: 'LEMON',
      status: 'complete',
      progress: 100,
      createdAt: new Date().toISOString(),
      ingestQueueStoragePath: 'ingest-queue/LEMON/upload/Finished.pdf',
    };
    useUploadStore.setState({ jobs: [completeJob], isProcessing: false });

    renderPanel();

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });
});
