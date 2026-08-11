import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, runTest, testInfo) => {
    const dark = testInfo.project.name.endsWith('-dark');
    await page.addInitScript((isDark) => {
      const theme = isDark ? 'dark' : 'light';
      localStorage.setItem(
        'lemon-theme',
        JSON.stringify({
          state: {
            theme,
            designSystem: 'instrument',
            resolvedTheme: theme,
            isDark,
          },
          version: 0,
        }),
      );
    }, dark);
    await runTest(page);
  },
});

export { expect };
