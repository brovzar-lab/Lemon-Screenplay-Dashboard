import { test, expect } from './fixtures';

test.setTimeout(90_000);

test.describe('Screenplay poster policy', () => {
  test('Discovery keeps the screenplay cover and Pass shows the free archive poster inside the project', async ({ page }) => {
    await page.goto('/discover');
    const search = page.getByRole('searchbox', { name: 'Discovery search' });
    await expect(search).toBeVisible({ timeout: 30_000 });
    await search.fill('Synthetic Pass');

    const open = page.getByRole('button', { name: 'Open Synthetic Pass screenplay file' });
    await expect(open).toBeVisible();
    await expect(open.locator('.screenplay-object')).toBeVisible();
    await expect(open.locator('.screenplay-object img')).toHaveCount(0);
    await open.click();

    await expect(page.getByText('Poster withheld for a Pass verdict')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Poster' }).click();
    await expect(page.getByText('Poster withheld for a Pass verdict')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Poster model' })).toHaveCount(0);
  });

  test('an eligible project offers the three approved retry models on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/discover');
    const search = page.getByRole('searchbox', { name: 'Discovery search' });
    await expect(search).toBeVisible({ timeout: 30_000 });
    await search.fill('Synthetic Romance');
    const open = page.getByRole('button', { name: 'Open Synthetic Romance screenplay file' });
    await expect(open.locator('.screenplay-object')).toBeVisible();
    await expect(open.locator('.screenplay-object img')).toHaveCount(0);
    await open.click();
    await page.getByRole('tab', { name: 'Poster' }).click();

    const model = page.getByRole('combobox', { name: 'Poster model' });
    await expect(model).toBeVisible({ timeout: 30_000 });
    await expect(model.locator('option')).toHaveCount(3);
    await expect(
      page.getByRole('button', { name: /Generate poster|Regenerate poster/ }),
    ).toBeVisible();
  });
});
