import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUploadStore } from '@/stores/uploadStore';

const { resolveUploadIssues, mockUpload, mockGeneration } = vi.hoisted(() => ({
  resolveUploadIssues: vi.fn().mockResolvedValue(1),
  mockUpload: vi.fn(),
  mockGeneration: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({ uploadPdfToIngestQueue: mockUpload, getIngestUploadGeneration: mockGeneration }));
vi.mock('@/lib/analysisIdentity', () => ({ computeContentHash: vi.fn().mockResolvedValue('a'.repeat(64)) }));

vi.mock('@/lib/badFormatStore', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/badFormatStore')>();
  return {
    ...original,
    resolveUploadIssues,
    subscribeToUploadIssues: (onChange: (jobs: unknown[]) => void) => {
      onChange([
        { id: 'replacement-job', filename: 'Scanned.pdf', collection_id: 'LEMON',
          status: 'skipped', skip_reason: 'insufficient_text_extracted', engine: 'coverage_v1',
          target_project_id: 'parent-project', depends_on_upload_id: 'parent-upload-id' },
        {
          id: 'failed-job',
          filename: 'Broken.pdf',
          collection_id: 'LEMON',
          storage_path: 'ingest-queue/LEMON/Broken.pdf',
          skip_reason: '',
          status: 'failed',
          last_error: 'Anthropic timeout',
          attempt_count: 3,
        },
        {
          id: 'terminal-job',
          filename: 'Missing revision.pdf',
          collection_id: 'LEMON',
          storage_path: 'ingest-queue/LEMON/Missing-revision.pdf',
          skip_reason: '',
          status: 'failed',
          last_error: 'target_project_id does not exist: missing-project',
          attempt_count: 1,
          retryable: false,
          failure_kind: 'terminal',
        },
        {
          id: 'review-job',
          filename: 'Missing ending.pdf',
          collection_id: 'LEMON',
          storage_path: 'ingest-queue/LEMON/Missing-ending.pdf',
          skip_reason: '',
          status: 'needs_review',
          last_error: 'insufficient_ending_page_text',
          retryable: false,
          failure_kind: 'evidence_review',
        },
      ]);
      return vi.fn();
    },
  };
});

import { BadFormatModal } from './BadFormatModal';

describe('BadFormatModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveUploadIssues.mockResolvedValue(1);
    mockGeneration.mockResolvedValue(null);
    useUploadStore.setState({ jobs: [], dismissedQueueJobs: {} });
    mockUpload.mockImplementation(async (_file: File, _category: string, options: { onPrepared?: (path: string) => void }) => {
      options.onPrepared?.('gs://test/ingest-queue/LEMON/replacement/Scanned.pdf');
      return { storageGeneration: '1' };
    });
  });

  it('reuses an accepted replacement after dismissal fails, preserving its engine and parent', async () => {
    resolveUploadIssues.mockRejectedValueOnce(new Error('dismissal unavailable'));
    const user = userEvent.setup();
    render(<BadFormatModal open onClose={vi.fn()} />);
    const file = new File(['synthetic PDF'], 'Readable.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Replace PDF'), file);
    await waitFor(() => expect(resolveUploadIssues).toHaveBeenCalledOnce());
    await user.upload(screen.getByLabelText('Replace PDF'), file);
    await waitFor(() => expect(resolveUploadIssues).toHaveBeenCalledTimes(2));
    expect(mockUpload).toHaveBeenCalledOnce();
    expect(mockUpload).toHaveBeenCalledWith(file, 'LEMON', expect.objectContaining({
      engine: 'coverage_v1', requestedModel: 'sonnet', targetProjectId: 'parent-project', dependsOnUploadId: 'parent-upload-id',
    }));
  });
  it('shows permanently failed uploads with their error and attempt count', () => {
    render(<BadFormatModal open onClose={vi.fn()} />);

    const failedRow = screen.getByText('Broken.pdf').closest('li');
    expect(failedRow).not.toBeNull();
    expect(screen.getByRole('dialog', { name: 'Upload resolution center' })).toBeInTheDocument();
    expect(within(failedRow!).getByText(/3 attempts/i)).toBeInTheDocument();
    expect(within(failedRow!).getByText('Anthropic timeout')).toBeInTheDocument();
    expect(within(failedRow!).getByText('Analysis failed')).toBeInTheDocument();
  });

  it('confirms before queuing a paid retry', async () => {
    const user = userEvent.setup();
    const confirm = vi.fn().mockReturnValue(true);
    Object.defineProperty(window, 'confirm', { value: confirm, configurable: true });
    render(<BadFormatModal open onClose={vi.fn()} />);

    const failedRow = screen.getByText('Broken.pdf').closest('li');
    expect(failedRow).not.toBeNull();
    await user.click(within(failedRow!).getByRole('button', { name: 'Retry Analysis' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('paid analysis'));
    expect(resolveUploadIssues).toHaveBeenCalledWith('retry', ['failed-job'], 'sonnet');
  });

  it('does not offer a paid retry for a terminal queue failure', () => {
    render(<BadFormatModal open onClose={vi.fn()} />);

    const terminalRow = screen.getByText('Missing revision.pdf').closest('li');
    expect(terminalRow).not.toBeNull();
    expect(within(terminalRow!).queryByRole('button', { name: 'Retry Analysis' })).not.toBeInTheDocument();
    expect(within(terminalRow!).getByText(/cannot be retried/i)).toBeInTheDocument();
  });

  it('shows evidence-review jobs without offering an unsafe retry', () => {
    render(<BadFormatModal open onClose={vi.fn()} />);

    const reviewRow = screen.getByText('Missing ending.pdf').closest('li');
    expect(reviewRow).not.toBeNull();
    expect(within(reviewRow!).getByText('Needs evidence review')).toBeInTheDocument();
    expect(within(reviewRow!).getByText('insufficient_ending_page_text')).toBeInTheDocument();
    expect(within(reviewRow!).queryByRole('button', { name: 'Retry Analysis' })).not.toBeInTheDocument();
  });
});
