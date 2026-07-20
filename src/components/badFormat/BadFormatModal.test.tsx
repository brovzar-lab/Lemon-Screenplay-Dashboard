import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/badFormatStore', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/badFormatStore')>();
  return {
    ...original,
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

    expect(screen.getByRole('dialog', { name: 'Upload issues' })).toBeInTheDocument();
    expect(screen.getByText('Broken.pdf')).toBeInTheDocument();
    expect(screen.getByText(/3 attempts/i)).toBeInTheDocument();
    expect(screen.getByText('Anthropic timeout')).toBeInTheDocument();
    expect(screen.getByText('Analysis failed')).toBeInTheDocument();
  });
});
