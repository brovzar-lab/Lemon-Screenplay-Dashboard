import { test, expect } from './fixtures';

test.setTimeout(90_000);

test.describe('Screenplay poster policy', () => {
  test('Pass uses the free archive placeholder and offers no paid retry', async ({ page }) => {
    await page.goto('/');
    const search = page.getByRole('searchbox', { name: 'Discovery search' });
    await expect(search).toBeVisible({ timeout: 30_000 });
    await search.fill('Will');

    const open = page.getByRole('button', { name: 'Open Will screenplay file' });
    await expect(open).toBeVisible();
    await expect(
      open.getByRole('img', { name: 'Poster withheld for a Pass verdict' }),
    ).toBeVisible();
    await open.click();

    await expect(page.getByText('Poster withheld for a Pass verdict')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Poster model' })).toHaveCount(0);
  });

  test('an eligible project offers the three approved retry models on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const search = page.getByRole('searchbox', { name: 'Discovery search' });
    await expect(search).toBeVisible({ timeout: 30_000 });
    await search.fill('Matadero');
    await page.getByRole('button', { name: 'Open Matadero screenplay file' }).click();

    const model = page.getByRole('combobox', { name: 'Poster model' });
    await expect(model).toBeVisible({ timeout: 30_000 });
    await expect(model.locator('option')).toHaveCount(3);
    await expect(
      page.getByRole('button', { name: /Generate poster|Regenerate poster/ }),
    ).toBeVisible();
  });
});
