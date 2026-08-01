import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
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

    expect(screen.getByRole('alertdialog', { name: 'Send to the reader room?' })).toBeInTheDocument();
    expect(screen.getByText(/Closing this window starts nothing/)).toBeInTheDocument();
    expect(mockUpload).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog', { name: 'Send to the reader room?' })).not.toBeInTheDocument();
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

    expect(screen.getByText(/Estimated batch cost: ~\$0\.44–\$2\.24/)).toBeInTheDocument();
    expect(mockUpload).not.toHaveBeenCalled();
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
});
