import { test, expect } from './fixtures';

test.setTimeout(90_000);

test.describe('Discovery find tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/discover?ui=screenplay');
    await expect(page.getByText(/Showing \d+ of \d+ screenplays/)).toBeVisible({ timeout: 30_000 });
  });

  test('search narrows the slate and slash focuses search', async ({ page }) => {
    const search = page.getByRole('searchbox', { name: 'Discovery search' });
    await page.keyboard.press('/');
    await expect(search).toBeFocused();
    await search.fill('Matadero');
    await expect(page.getByTestId('screenplay-ranking-top')).toContainText('Matadero');
    await expect(page.getByText(/Showing 1 of 27 screenplays/)).toBeVisible();
  });

  test('sort updates the top result and complete slate consistently', async ({ page }) => {
    const sort = page.getByRole('combobox', { name: 'Sort results' });
    await sort.selectOption('title');
    await expect(sort).toHaveValue('title');
    await expect(page.getByTestId('screenplay-discovery-ranking')).toHaveCount(0);
    await expect(page.getByTestId('screenplay-discovery-result').first()).toContainText(
      'A Killing on Carnival Row',
    );
  });

  test('verdict filter can be applied and cleared', async ({ page }) => {
    await page.getByRole('button', { name: /^Filters/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Discovery filters' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Recommend' }).click();
    await dialog.getByRole('button', { name: 'View results' }).click();
    await expect(page.getByLabel('Active filters')).toContainText(/Recommend/i);
    await page.getByRole('button', { name: /Remove Recommend filter/i }).click();
    await expect(page.getByLabel('Active filters')).not.toContainText(/Recommend/i);
  });
});
