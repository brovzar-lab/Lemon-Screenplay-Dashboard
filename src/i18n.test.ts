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
});
