import { test, expect } from './fixtures';

test.setTimeout(90_000);

const sections = [
  'Screenplay Upload System',
  'Analysis Health',
  'Model Comparison',
  'Screenplays',
  'Data & Sharing',
  'System Status',
  'Calibration',
] as const;

test.describe('Settings administration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings?tab=intake');
    await expect(
      page.getByRole('heading', { name: 'Screenplay Upload System', exact: true }),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('groups every live administrative section and keeps screenplay upload canonical', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Settings sections' });
    for (const section of sections) await expect(nav.getByRole('button', { name: section })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Workflow' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'System', exact: true })).toBeVisible();
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
    await expect(
      page.getByRole('heading', { name: 'Screenplay Upload System', exact: true }),
    ).toBeVisible();
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

  test('mobile settings uses one contained section picker', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const picker = page.getByRole('combobox', { name: 'Settings section' });
    await expect(picker).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Settings sections' })).toBeHidden();
    await picker.selectOption('analysis');
    await expect(page.getByRole('heading', { name: 'Analysis Health', exact: true })).toBeVisible();
    await expect(picker).toHaveValue('analysis');

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});
