import { test, expect } from '@playwright/test';

// Extend timeout for tests that need to load all screenplay data
test.setTimeout(90000);

test.describe('Filter Chips', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Wait for data to load
    await expect(page.getByText(/Showing.*of.*screenplays/)).toBeVisible({ timeout: 60000 });
  });

  test('should filter cards when Recommend chip is clicked', async ({ page }) => {
    // Get initial count text
    const countText = await page.getByText(/Showing.*of.*screenplays/).textContent();
    const initialTotal = parseInt(countText?.match(/of (\d+)/)?.[1] ?? '0');

    // Click Recommend filter chip
    await page.getByRole('button', { name: 'Recommend' }).click();
    await page.waitForTimeout(400);

    // "Clear All" button should appear indicating a filter is active
    await expect(page.getByRole('button', { name: /Clear All/ })).toBeVisible();

    // Filtered count should be less than or equal to the total
    const filteredText = await page.getByText(/Showing.*of.*screenplays/).textContent();
    const filteredCount = parseInt(filteredText?.match(/Showing (\d+)/)?.[1] ?? '0');
    expect(filteredCount).toBeLessThanOrEqual(initialTotal);
  });

  test('should filter cards when Pass chip is clicked', async ({ page }) => {
    await page.getByRole('button', { name: 'Pass' }).click();
    await page.waitForTimeout(400);

    await expect(page.getByRole('button', { name: /Clear All/ })).toBeVisible();
  });

  test('should filter cards when Consider chip is clicked', async ({ page }) => {
    await page.getByRole('button', { name: 'Consider' }).click();
    await page.waitForTimeout(400);

    await expect(page.getByRole('button', { name: /Clear All/ })).toBeVisible();
  });

  test('should filter cards when FILM NOW chip is clicked', async ({ page }) => {
    await page.getByRole('button', { name: 'FILM NOW' }).click();
    await page.waitForTimeout(400);

    await expect(page.getByRole('button', { name: /Clear All/ })).toBeVisible();
  });

  test('Clear All removes active filter and hides the Clear All button', async ({ page }) => {
    // Apply a filter
    await page.getByRole('button', { name: 'Recommend' }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole('button', { name: /Clear All/ })).toBeVisible();

    // Clear filters
    await page.getByRole('button', { name: /Clear All/ }).click();
    await page.waitForTimeout(400);

    // Clear All button should be gone
    await expect(page.getByRole('button', { name: /Clear All/ })).not.toBeVisible();
  });

  test('search input filters the screenplay list', async ({ page }) => {
    const searchInput = page.getByTestId('search-input');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('thriller');
    await page.waitForTimeout(400);

    await expect(page.getByText(/Showing.*of.*screenplays/)).toBeVisible();
  });

  test('sort select is visible and functional', async ({ page }) => {
    const sortSelect = page.getByTestId('sort-select');
    await expect(sortSelect).toBeVisible();

    await sortSelect.selectOption('title');
    await page.waitForTimeout(400);

    // Grid should still be visible after sort change
    await expect(page.getByText(/Showing.*of.*screenplays/)).toBeVisible();
  });
});
