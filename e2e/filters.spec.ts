import { test, expect } from './fixtures';

test.setTimeout(90_000);

test.describe('Discovery find tools', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/discover?ui=screenplay');
    await expect(page.getByText(/Showing \d+ of \d+ screenplays/)).toBeVisible({ timeout: 30_000 });
  });

  test('search narrows the slate and slash focuses search', async ({ page }) => {
    const featured = page.getByTestId('screenplay-featured-project');
    const featuredId = await featured.getAttribute('data-screenplay-id');
    const search = page.getByRole('searchbox', { name: 'Discovery search' });
    await page.keyboard.press('/');
    await expect(search).toBeFocused();
    await search.fill('Synthetic Romance');
    await expect(featured).toHaveAttribute('data-screenplay-id', featuredId ?? '');
    await expect(page.getByText('Synthetic Romance', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Showing 1 of \d+ screenplays/)).toBeVisible();
  });

  test('sort updates the complete slate without changing the daily Featured project', async ({
    page,
  }) => {
    const featured = page.getByTestId('screenplay-featured-project');
    const featuredId = await featured.getAttribute('data-screenplay-id');
    const sort = page.getByRole('combobox', { name: 'Sort results' });
    await sort.selectOption('title');
    await expect(sort).toHaveValue('title');
    await expect(page.getByTestId('screenplay-discovery-ranking')).toHaveCount(1);
    await expect(featured).toHaveAttribute('data-screenplay-id', featuredId ?? '');
    const titles = await page
      .getByTestId('screenplay-discovery-result')
      .locator('.screenplay-wall__title > strong')
      .allTextContents();
    expect(titles.length).toBeGreaterThan(1);
    expect(titles).toEqual([...titles].sort((left, right) => left.localeCompare(right)));
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

  test('mobile filter sheet consolidates the secondary slate tools', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /^Filters/ }).click();

    const dialog = page.getByRole('dialog', { name: 'Discovery filters' });
    await expect(dialog).toBeVisible();
    const savedViews = dialog.getByRole('button', { name: 'Saved Views' });
    const favorites = dialog.getByRole('button', { name: 'Favorites' });
    await expect(savedViews).toBeVisible();
    await expect(favorites).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Sort screenplays' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Select projects' })).toBeVisible();

    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);

    await savedViews.click();
    const lenses = page.getByRole('dialog', { name: 'Lenses' });
    await expect(lenses).toBeVisible();
    const lensBounds = await lenses.boundingBox();
    expect(lensBounds).not.toBeNull();
    expect(lensBounds!.y).toBeGreaterThanOrEqual(0);
    expect(lensBounds!.y + lensBounds!.height).toBeLessThanOrEqual(844);
    await page.keyboard.press('Escape');
    await expect(lenses).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(savedViews).toBeFocused();

    await favorites.click();
    const savedSlate = page.getByRole('dialog', { name: 'Favorites' });
    await expect(savedSlate).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(savedSlate).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect(favorites).toBeFocused();
  });
});
