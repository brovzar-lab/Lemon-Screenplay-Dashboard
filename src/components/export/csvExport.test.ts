import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import i18n from '@/i18n';

const unparse = vi.hoisted(() => vi.fn(() => 'csv'));

vi.mock('papaparse', () => ({ default: { unparse } }));

import { exportToCSV } from './csvExport';

describe('exportToCSV language policy', () => {
  beforeEach(async () => {
    unparse.mockClear();
    await i18n.changeLanguage('es');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('keeps neutral facts but omits untranslated English analysis in Spanish', () => {
    exportToCSV([
      createTestScreenplay({
        latestVersionId: 'version-1',
        analysisVersion: 'v9_archaeology',
        logline: 'Original English logline.',
        verdictStatement: 'Original English verdict.',
      }),
    ]);

    const [rows] = unparse.mock.calls[0];
    const row = rows[0] as Record<string, unknown>;
    expect(row.Título).toBe('Test Screenplay');
    expect(row.Género).toBe('Drama');
    expect(row['Calificación final']).toBe('7.50');
    expect(row.Logline).toBe('');
    expect(row['Explicación del veredicto']).toBe('');
    expect(row['Idioma del análisis']).toBe('Inglés');
  });
});
