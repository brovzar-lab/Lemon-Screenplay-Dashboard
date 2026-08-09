import { test, expect } from './fixtures';

test.setTimeout(90_000);

test.describe('Project workspace and fallback drawer', () => {
  test('all six Screenplay File tabs remain connected', async ({ page }) => {
    await page.goto('/projects/matadero-5ta-version-24052026?workspace=screenplay');
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible({ timeout: 30_000 });

    for (const tab of ['Scores', 'Reader Room', 'Story X-Ray', 'Producer Take', 'Notes']) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    }
  });

  test('legacy drawer still opens and Escape restores Discovery', async ({ page }) => {
    await page.goto('/discover?ui=screenplay&preview=drawer');
    await expect(page.getByTestId('screenplay-discovery-result').first()).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('screenplay-discovery-result').first().locator('button.screenplay-wall__open').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page).toHaveURL(/\/discover\?ui=screenplay&preview=drawer/);
  });
});
