import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const { resolveUploadIssues } = vi.hoisted(() => ({
  resolveUploadIssues: vi.fn().mockResolvedValue(1),
}));

vi.mock('@/lib/badFormatStore', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/badFormatStore')>();
  return {
    ...original,
    resolveUploadIssues,
    subscribeToUploadIssues: (onChange: (jobs: unknown[]) => void) => {
      onChange([
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
      ]);
      return vi.fn();
    },
  };
});

import { BadFormatModal } from './BadFormatModal';

describe('BadFormatModal', () => {
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
});
