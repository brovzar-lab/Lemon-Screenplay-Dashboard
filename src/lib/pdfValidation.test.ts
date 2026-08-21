import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { MAX_PDF_BYTES, getPdfFileError, getScreenplayTextError } from './pdfValidation';

function pdfFile(name = 'script.pdf', size = 1000, type = 'application/pdf'): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('getPdfFileError', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('accepts a normal PDF', () => {
    expect(getPdfFileError(pdfFile())).toBeNull();
  });

  it('accepts a PDF extension when the browser omits the MIME type', () => {
    expect(getPdfFileError(pdfFile('script.PDF', 1000, ''))).toBeNull();
  });

  it('rejects non-PDF, empty, and oversized files', () => {
    expect(getPdfFileError(pdfFile('notes.txt', 1000, 'text/plain'))).toContain('not a PDF');
    expect(getPdfFileError(pdfFile('empty.pdf', 0))).toContain('empty');
    expect(getPdfFileError(pdfFile('huge.pdf', MAX_PDF_BYTES + 1))).toContain('50 MB');
  });

  it('preserves the filename and 50 MB limit in Spanish', async () => {
    await i18n.changeLanguage('es');

    expect(getPdfFileError(pdfFile('notas.txt', 1000, 'text/plain'))).toBe(
      'notas.txt no es un archivo PDF.',
    );
    expect(getPdfFileError(pdfFile('guion.pdf', MAX_PDF_BYTES + 1))).toBe(
      'guion.pdf supera el límite de carga de 50 MB.',
    );
  });
});

describe('getScreenplayTextError', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('accepts readable screenplay text', () => {
    const text = `FADE IN\nINT. KITCHEN - DAY\n${'A line of readable screenplay text. '.repeat(100)}`;
    expect(getScreenplayTextError(text)).toBeNull();
  });

  it('rejects scanned or nearly empty extraction', () => {
    expect(getScreenplayTextError('INT. ROOM - DAY')).toContain('too little readable text');
  });

  it('rejects a long document without screenplay markers', () => {
    const text = 'ordinary prose words without screenplay formatting '.repeat(100);
    expect(getScreenplayTextError(text)).toContain('screenplay formatting');
  });

  it('returns validation guidance in Spanish', async () => {
    await i18n.changeLanguage('es');

    expect(getScreenplayTextError('INT. CUARTO - DÍA')).toContain(
      'Este PDF contiene muy poco texto legible',
    );
  });
});
