import { beforeEach, describe, expect, it } from 'vitest';
import i18n, { setLanguageUser } from '@/i18n';

describe('language preference', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    setLanguageUser(null);
    await i18n.changeLanguage('en');
  });

  it('keeps a separate saved choice for each user', async () => {
    setLanguageUser('billy');
    await i18n.changeLanguage('es');
    expect(window.localStorage.getItem('lemon-ui-language:billy')).toBe('es');

    setLanguageUser('reader');
    expect(i18n.language).toBe('en');
    setLanguageUser('billy');
    expect(i18n.language).toBe('es');
  });

  it('translates Coverage V1 grades and qualitative-only states', async () => {
    await i18n.changeLanguage('es');

    expect(i18n.t('strong')).toBe('fuerte');
    expect(i18n.t('solid')).toBe('sólido');
    expect(i18n.t('weak')).toBe('débil');
    expect(i18n.t('Reader-stated uncertainties')).toBe(
      'Incertidumbres señaladas por el lector',
    );
    expect(i18n.t('Coverage reports are unscored by design')).toBe(
      'Los reportes de cobertura no tienen puntaje por diseño',
    );
  });
});
