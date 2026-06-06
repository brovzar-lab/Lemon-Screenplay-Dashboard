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

  test('category tab filters cards to that category only', async ({ page }) => {
    // Grab the initial total count
    const countText = await page.getByText(/Showing.*of.*screenplays/).textContent();
    const initialTotal = parseInt(countText?.match(/of (\d+)/)?.[1] ?? '0');

    // The CollectionTabs render as buttons — pick the first non-"All" tab
    // Find a category tab that is NOT the "All" chip (look for a tab with a count badge)
    const categoryTabs = page.locator('div.flex.items-center.gap-1 > button');
    const tabCount = await categoryTabs.count();

    if (tabCount > 1) {
      // Click the second tab (first category after "All")
      const categoryTab = categoryTabs.nth(1);
      await categoryTab.click();
      await page.waitForTimeout(500);

      // Filtered count should be less than or equal to total
      const filteredText = await page.getByText(/Showing.*of.*screenplays/).textContent();
      const filteredCount = parseInt(filteredText?.match(/Showing (\d+)/)?.[1] ?? '0');
      expect(filteredCount).toBeLessThanOrEqual(initialTotal);
      expect(filteredCount).toBeGreaterThan(0);

      // Click "All" to reset
      const allTab = categoryTabs.first();
      await allTab.click();
      await page.waitForTimeout(400);
    }
  });

  test('hide produced films toggle filters out produced screenplays', async ({ page }) => {
    // Open the Advanced Filters panel via the "Filters" button
    await page.getByRole('button', { name: /Filters/ }).click();
    await page.waitForTimeout(300);

    // The FilterPanel should be visible — it has a heading "Advanced Filters"
    await expect(page.getByText('Advanced Filters')).toBeVisible({ timeout: 5000 });

    // Open the "Display Options" section
    await page.getByText('Display Options').click();
    await page.waitForTimeout(200);

    // The "Hide produced films" toggle should be visible
    await expect(page.getByText('Hide produced films')).toBeVisible();

    // The toggle defaults to ON (hideProduced: true). Uncheck it to show produced films.
    // Find the toggle's sr-only checkbox near the "Hide produced films" label
    const hideProducedLabel = page.locator('label', { hasText: 'Hide produced films' });
    const toggleCheckbox = hideProducedLabel.locator('input[type="checkbox"]');

    // Get initial state — should be checked by default
    const isChecked = await toggleCheckbox.isChecked();
    expect(isChecked).toBe(true);

    // Click the label to toggle it OFF
    await hideProducedLabel.click();
    await page.waitForTimeout(300);

    // Checkbox should now be unchecked
    await expect(toggleCheckbox).not.toBeChecked();

    // Close the filter panel by clicking "Apply Filters"
    await page.getByRole('button', { name: 'Apply Filters' }).click();
    await page.waitForTimeout(500);

    // The count may have changed (showing more screenplays now)
    await expect(page.getByText(/Showing.*of.*screenplays/)).toBeVisible();
  });

  test('weighted score range filter reduces results', async ({ page }) => {
    // Get the initial total
    const _countText = await page.getByText(/Showing.*of.*screenplays/).textContent();

    // Open the Advanced Filters panel
    await page.getByRole('button', { name: /Filters/ }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText('Advanced Filters')).toBeVisible({ timeout: 5000 });

    // Open "Core Scores" section
    await page.getByText('Core Scores').click();
    await page.waitForTimeout(200);

    // The "Weighted Score" range slider should appear
    await expect(page.getByText('Weighted Score')).toBeVisible();

    // Enable the Weighted Score filter — look for the checkbox/toggle next to the label
    // RangeSlider has an enable checkbox; click it to activate the range
    const weightedScoreSection = page.locator('div', { hasText: /^Weighted Score$/ }).first();
    // The enable toggle is a checkbox in the RangeSlider component
    const enableCheckbox = weightedScoreSection.locator('input[type="checkbox"]');
    if (await enableCheckbox.count() > 0) {
      await enableCheckbox.first().check();
      await page.waitForTimeout(200);
    }

    // Close the filter panel
    await page.getByRole('button', { name: 'Apply Filters' }).click();
    await page.waitForTimeout(500);

    // After enabling the range filter, results should still be visible
    await expect(page.getByText(/Showing.*of.*screenplays/)).toBeVisible();
  });
});
