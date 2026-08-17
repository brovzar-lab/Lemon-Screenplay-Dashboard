import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUploadStore, type UploadJob } from '@/stores/uploadStore';

const mockUpload = vi.fn();
const mockComputeHash = vi.fn();
const mockFindByHash = vi.fn();
const mockSubscribe = vi.fn((..._args: unknown[]) => vi.fn());

vi.mock('@/lib/firebase', () => ({
  uploadPdfToIngestQueue: (...args: unknown[]) => mockUpload(...args),
}));

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: [] }),
  SCREENPLAYS_QUERY_KEY: ['screenplays'],
}));

vi.mock('@/hooks/useCategories', () => ({
  default: () => ({ categoryIds: ['LEMON', 'SUBMISSION'], addCategory: vi.fn() }),
}));

vi.mock('@/stores/apiConfigStore', () => ({
  useApiConfigStore: () => ({ canMakeRequest: () => true }),
}));

vi.mock('@/lib/ingestQueueClient', () => ({
  subscribeToIngestJob: (...args: unknown[]) => mockSubscribe(...args),
}));

vi.mock('@/lib/analysisIdentity', () => ({
  computeContentHash: (...args: unknown[]) => mockComputeHash(...args),
}));

vi.mock('@/lib/analysisLookup', () => ({
  findAnalysisByContentHash: (...args: unknown[]) => mockFindByHash(...args),
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
    mockUpload.mockReset();
    mockComputeHash.mockReset().mockResolvedValue('content-hash');
    mockFindByHash.mockReset().mockResolvedValue(null);
    mockSubscribe.mockClear();
    useUploadStore.setState({ jobs: [], isProcessing: false });
  });

  it('shows an honest empty ledger and defaults to the funnel-friendly Hybrid route', () => {
    renderPanel();

    expect(screen.getByText('The desk is clear')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hybrid/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Choose screenplay PDFs')).toBeInTheDocument();
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

  it('shows the full Hybrid cost range in the final confirmation', async () => {
    const user = userEvent.setup();
    const first = new File(['first'], 'First.pdf', { type: 'application/pdf' });
    const second = new File(['second'], 'Second.pdf', { type: 'application/pdf' });
    mockComputeHash.mockResolvedValueOnce('first-hash').mockResolvedValueOnce('second-hash');
    renderPanel();

    await user.upload(screen.getByLabelText('Choose screenplay PDFs'), [first, second]);
    await user.click(await screen.findByRole('button', { name: /Review and start analysis \(2 files\)/ }));

    const dialog = screen.getByRole('alertdialog', { name: 'Authorize paid analysis?' });
    expect(within(dialog).getByText('Estimated batch cost')).toBeInTheDocument();
    expect(within(dialog).getByText('~$0.44–$1.04')).toBeInTheDocument();
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
      acceptedJob.ingestQueueStoragePath,
      expect.any(Function),
      expect.any(Function),
    );
    const onUpdate = mockSubscribe.mock.calls[0][1] as (update: {
      status: 'complete';
      screenplayDocId: string;
    }) => void;
    act(() => onUpdate({ status: 'complete', screenplayDocId: 'reloaded-project' }));

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
      acceptedJob.ingestQueueStoragePath,
      expect.any(Function),
      expect.any(Function),
    );
    const onUpdate = mockSubscribe.mock.calls[0][1] as (update: {
      status: 'complete';
      screenplayDocId: string;
    }) => void;
    act(() => onUpdate({ status: 'complete', screenplayDocId: 'Cosquillitas_Draft_9.pdf' }));

    expect(useUploadStore.getState().jobs[0]).toMatchObject({
      status: 'complete',
      error: undefined,
      result: { projectId: 'Cosquillitas_Draft_9.pdf' },
    });
  });
});
