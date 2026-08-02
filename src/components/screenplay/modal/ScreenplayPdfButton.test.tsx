import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestScreenplay } from '@/test/factories';

const pdfMocks = vi.hoisted(() => ({
  getDownloadURL: vi.fn(),
  ref: vi.fn((_storage: unknown, path: string) => ({ path })),
  addToast: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  getDownloadURL: pdfMocks.getDownloadURL,
  ref: pdfMocks.ref,
}));

vi.mock('@/lib/firebase', () => ({
  storage: { name: 'test-storage' },
  uploadScreenplayPdf: vi.fn(),
}));

vi.mock('@/stores/authStore', () => ({
  useIsAdmin: () => true,
}));

vi.mock('@/stores/toastStore', () => ({
  useToastStore: {
    getState: () => ({ addToast: pdfMocks.addToast }),
  },
}));

import { ScreenplayPdfButton } from '@/components/screenplay/modal/ScreenplayPdfButton';

describe('ScreenplayPdfButton workspace presentation', () => {
  beforeEach(() => {
    pdfMocks.getDownloadURL.mockReset();
    pdfMocks.ref.mockClear();
    pdfMocks.addToast.mockClear();
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  it('opens the immutable source PDF before trying legacy paths', async () => {
    const user = userEvent.setup();
    pdfMocks.getDownloadURL.mockResolvedValue('https://example.test/source.pdf');
    const screenplay = createTestScreenplay({
      title: 'Atlas Fall',
      storagePath: 'screenplays/projects/atlas/versions/v2/source.pdf',
    });

    render(
      <ScreenplayPdfButton
        screenplay={screenplay}
        presentation="workspace"
        allowReupload={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Open source screenplay for Atlas Fall' }));

    await waitFor(() => {
      expect(pdfMocks.ref).toHaveBeenCalledWith(
        expect.anything(),
        'screenplays/projects/atlas/versions/v2/source.pdf',
      );
      expect(window.open).toHaveBeenCalledWith('https://example.test/source.pdf', '_blank');
    });
    expect(pdfMocks.getDownloadURL).toHaveBeenCalledOnce();
  });

  it('shows an honest unavailable state when no archived or legacy PDF exists', async () => {
    const user = userEvent.setup();
    pdfMocks.getDownloadURL.mockRejectedValue(new Error('missing'));
    const screenplay = createTestScreenplay({
      title: 'Atlas Fall',
      category: 'LEMON',
      storagePath: undefined,
    });

    render(
      <ScreenplayPdfButton
        screenplay={screenplay}
        presentation="workspace"
        allowReupload={false}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Open source screenplay for Atlas Fall' }));

    const unavailable = await screen.findByRole('button', {
      name: 'Source screenplay unavailable for Atlas Fall',
    });
    expect(unavailable).toBeDisabled();
    expect(pdfMocks.ref).toHaveBeenNthCalledWith(1, expect.anything(), 'screenplays/LEMON/Atlas_Fall.pdf');
    expect(pdfMocks.ref).toHaveBeenNthCalledWith(2, expect.anything(), 'screenplays/Atlas_Fall.pdf');
    expect(pdfMocks.addToast).toHaveBeenCalledWith(
      'The source screenplay PDF is not available.',
      'warning',
    );
  });
});
