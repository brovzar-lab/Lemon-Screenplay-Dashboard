import { render, screen } from '@testing-library/react';
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
      ]);
      return vi.fn();
    },
  };
});

import { BadFormatModal } from './BadFormatModal';

describe('BadFormatModal', () => {
  it('shows permanently failed uploads with their error and attempt count', () => {
    render(<BadFormatModal open onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Upload resolution center' })).toBeInTheDocument();
    expect(screen.getByText('Broken.pdf')).toBeInTheDocument();
    expect(screen.getByText(/3 attempts/i)).toBeInTheDocument();
    expect(screen.getByText('Anthropic timeout')).toBeInTheDocument();
    expect(screen.getByText('Analysis failed')).toBeInTheDocument();
  });

  it('confirms before queuing a paid retry', async () => {
    const user = userEvent.setup();
    const confirm = vi.fn().mockReturnValue(true);
    Object.defineProperty(window, 'confirm', { value: confirm, configurable: true });
    render(<BadFormatModal open onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Retry Analysis' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('paid analysis'));
    expect(resolveUploadIssues).toHaveBeenCalledWith('retry', ['failed-job'], 'sonnet');
  });
});
