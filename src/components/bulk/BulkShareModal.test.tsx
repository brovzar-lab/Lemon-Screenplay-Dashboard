import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// vi.mock calls at module scope (Vitest hoisting)
vi.mock('@/lib/shareService', () => ({
  getExistingShareToken: vi.fn(),
  createShareToken: vi.fn(),
}));
vi.mock('@/stores/shareStore', () => ({
  useShareStore: { getState: () => ({ tokens: {}, setToken: vi.fn() }) },
}));

import { BulkShareModal } from './BulkShareModal';
import { getExistingShareToken, createShareToken } from '@/lib/shareService';

const sp1 = { id: 'sp1', title: 'The Great Heist', hasPdf: false };
const sp2 = { id: 'sp2', title: 'Ocean of Stars', hasPdf: false };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BulkShareModal — BULK-01', () => {
  it('renders pending rows for all selected screenplays', () => {
    render(
      <BulkShareModal
        screenplays={[sp1, sp2] as any[]}
        isOpen
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(sp1.title)).toBeInTheDocument();
    expect(screen.getByText(sp2.title)).toBeInTheDocument();
  });

  it('reuses existing token from shareStore cache without calling createShareToken', () => {
    vi.mock('@/stores/shareStore', () => ({
      useShareStore: {
        getState: () => ({
          tokens: { sp1: { token: 'cached-tok', url: 'https://example.com/share/cached-tok' } },
          setToken: vi.fn(),
        }),
      },
    }));

    render(
      <BulkShareModal
        screenplays={[sp1] as any[]}
        isOpen
        onClose={vi.fn()}
      />
    );

    expect(createShareToken).not.toHaveBeenCalled();
    expect(screen.getByText('https://example.com/share/cached-tok')).toBeInTheDocument();
  });

  it('calls getExistingShareToken then createShareToken when cache miss returns null', async () => {
    (getExistingShareToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (createShareToken as ReturnType<typeof vi.fn>).mockResolvedValue({
      token: 'tok123',
      url: 'https://example.com/share/tok123',
    });

    render(
      <BulkShareModal
        screenplays={[sp1] as any[]}
        isOpen
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('https://example.com/share/tok123')).toBeInTheDocument();
    });
  });

  it('Copy All produces newline-separated URLs with no titles', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    (getExistingShareToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (createShareToken as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ token: 'tok-a', url: 'https://example.com/share/tok-a' })
      .mockResolvedValueOnce({ token: 'tok-b', url: 'https://example.com/share/tok-b' });

    render(
      <BulkShareModal
        screenplays={[sp1, sp2] as any[]}
        isOpen
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('https://example.com/share/tok-a')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /copy all/i }));

    expect(writeText).toHaveBeenCalledWith(
      'https://example.com/share/tok-a\nhttps://example.com/share/tok-b'
    );
  });

  it('failed row shows red Retry button', async () => {
    (getExistingShareToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (createShareToken as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    render(
      <BulkShareModal
        screenplays={[sp1] as any[]}
        isOpen
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });
});
