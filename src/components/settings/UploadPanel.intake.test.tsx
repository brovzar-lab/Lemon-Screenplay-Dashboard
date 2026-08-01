import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUploadStore, type UploadJob } from '@/stores/uploadStore';

const mockUpload = vi.fn();

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
  subscribeToIngestJob: vi.fn(),
}));

vi.mock('@/lib/analysisIdentity', () => ({
  computeContentHash: vi.fn().mockResolvedValue('content-hash'),
}));

vi.mock('@/lib/analysisLookup', () => ({
  findAnalysisByContentHash: vi.fn().mockResolvedValue(null),
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
});
