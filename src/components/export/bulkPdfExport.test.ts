/**
 * bulkPdfExport tests
 * Mocks pdf().toBlob(), JSZip, and DOM operations to verify:
 * - PDF generation per screenplay
 * - Progress callback invocation
 * - Zip file creation with correct filenames
 * - Download trigger
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Screenplay } from '@/types';

// Mock @react-pdf/renderer
const mockToBlob = vi.fn().mockResolvedValue(new Blob(['pdf-content']));
vi.mock('@react-pdf/renderer', () => ({
  pdf: vi.fn(() => ({ toBlob: mockToBlob })),
}));

// Mock PdfDocument (JSX component)
vi.mock('./PdfDocument', () => ({
  PdfDocument: vi.fn(() => null),
}));

// Mock JSZip -- use a class so `new JSZip()` works with dynamic import
const mockFile = vi.fn();
const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(['zip-content']));

class MockJSZip {
  file = mockFile;
  generateAsync = mockGenerateAsync;
}

vi.mock('jszip', () => ({
  default: MockJSZip,
}));

/** Minimal mock screenplay factory */
function mockScreenplay(id: string, title: string): Screenplay {
  return { id, title, sourceFile: `${id}.json` } as Screenplay;
}

describe('bulkExportPdfs', () => {
  let mockClick: ReturnType<typeof vi.fn>;
  let mockAppendChild: ReturnType<typeof vi.spyOn>;
  let mockRemoveChild: ReturnType<typeof vi.spyOn>;
  let mockCreateElement: ReturnType<typeof vi.spyOn>;
  let linkElement: { href: string; download: string; click: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    mockClick = vi.fn();
    linkElement = { href: '', download: '', click: mockClick };

    mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.body);
    mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.body);
    mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue(
      linkElement as unknown as HTMLAnchorElement,
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('generates a PDF for each screenplay', async () => {
    const { pdf } = await import('@react-pdf/renderer');
    const { bulkExportPdfs } = await import('./bulkPdfExport');

    const screenplays = [
      mockScreenplay('1', 'Title One'),
      mockScreenplay('2', 'Title Two'),
      mockScreenplay('3', 'Title Three'),
    ];

    await bulkExportPdfs(screenplays);

    expect(pdf).toHaveBeenCalledTimes(3);
  });

  it('calls onProgress with current/total for each screenplay', async () => {
    const { bulkExportPdfs } = await import('./bulkPdfExport');
    const onProgress = vi.fn();

    const screenplays = [
      mockScreenplay('1', 'Alpha'),
      mockScreenplay('2', 'Beta'),
      mockScreenplay('3', 'Gamma'),
    ];

    await bulkExportPdfs(screenplays, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenNthCalledWith(1, { current: 1, total: 3 });
    expect(onProgress).toHaveBeenNthCalledWith(2, { current: 2, total: 3 });
    expect(onProgress).toHaveBeenNthCalledWith(3, { current: 3, total: 3 });
  });

  it('adds each PDF to zip with sanitized filename', async () => {
    const { bulkExportPdfs } = await import('./bulkPdfExport');

    const screenplays = [
      mockScreenplay('1', 'Title One'),
      mockScreenplay('2', 'Title Two'),
    ];

    await bulkExportPdfs(screenplays);

    expect(mockFile).toHaveBeenCalledTimes(2);
    expect(mockFile).toHaveBeenCalledWith('Title-One-PitchDeck.pdf', expect.any(Blob));
    expect(mockFile).toHaveBeenCalledWith('Title-Two-PitchDeck.pdf', expect.any(Blob));
  });

  it('generates zip and triggers download', async () => {
    const { bulkExportPdfs } = await import('./bulkPdfExport');

    await bulkExportPdfs([mockScreenplay('1', 'Test')]);

    expect(mockGenerateAsync).toHaveBeenCalledWith({ type: 'blob' });
    expect(mockCreateElement).toHaveBeenCalledWith('a');
    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('download filename includes date', async () => {
    const { bulkExportPdfs } = await import('./bulkPdfExport');

    await bulkExportPdfs([mockScreenplay('1', 'Test')]);

    const today = new Date().toISOString().split('T')[0];
    expect(linkElement.download).toBe(`screenplays-export-${today}.zip`);
  });

  it('works without onProgress callback', async () => {
    const { bulkExportPdfs } = await import('./bulkPdfExport');

    await expect(
      bulkExportPdfs([mockScreenplay('1', 'Test')], undefined),
    ).resolves.toBeUndefined();
  });

  it('sanitizes special characters in filenames', async () => {
    const { bulkExportPdfs } = await import('./bulkPdfExport');

    await bulkExportPdfs([mockScreenplay('1', 'The Script (v2) #1!')]);

    expect(mockFile).toHaveBeenCalledWith('The-Script-v2-1-PitchDeck.pdf', expect.any(Blob));
  });
});
