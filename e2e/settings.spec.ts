import { test, expect } from './fixtures';

test.setTimeout(90_000);

const sections = [
  'Intake',
  'Analysis Health',
  'Model Comparison',
  'PDF Files',
  'Data & Sharing',
  'System Status',
  'Calibration',
] as const;

test.describe('Settings administration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings?tab=intake');
    await expect(page.getByRole('heading', { name: 'Intake', exact: true })).toBeVisible({ timeout: 30_000 });
  });

  test('groups every live administrative section and keeps Intake canonical', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Settings sections' });
    for (const section of sections) await expect(nav.getByRole('button', { name: section })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Workflow' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'System' })).toBeVisible();
    await expect(page.getByTestId('intake-workbench')).toBeVisible();
  });

  test('all settings sections switch without losing the administrative frame', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Settings sections' });
    const primaryNav = page.getByRole('navigation', { name: 'Primary navigation' });
    for (const section of sections.slice(1)) {
      await nav.getByRole('button', { name: section }).click();
      await expect(page.getByRole('heading', { name: section, exact: true })).toBeVisible();
      await expect(primaryNav.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
      await expect(primaryNav.getByRole('link', { name: 'Screenplays' })).toHaveAttribute('href', '/discover');
      await expect(primaryNav.getByRole('link', { name: 'Settings' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    }
  });

  test('legacy Intake and Settings aliases remain compatible', async ({ page }) => {
    await page.goto('/intake');
    await expect(page).toHaveURL(/\/settings\?tab=intake/);
    await page.goto('/settings?tab=upload');
    await expect(page.getByRole('heading', { name: 'Intake', exact: true })).toBeVisible();
    await page.goto('/settings?tab=taste-calibration');
    await expect(page.getByRole('heading', { name: 'Calibration', exact: true })).toBeVisible();
  });

  test('theme control is explicit and matches the active browser theme', async ({ page }, testInfo) => {
    const expected = testInfo.project.name.endsWith('-dark') ? 'Dark' : 'Light';
    await expect(page.getByRole('button', { name: expected, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
