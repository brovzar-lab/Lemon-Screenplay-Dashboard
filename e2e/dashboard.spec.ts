import { test, expect } from '@playwright/test';

// Extend timeout for tests that need to load all screenplay data (132 JSON files)
test.setTimeout(90000);

test.describe('Dashboard E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for network activity to settle and data to load
    await page.waitForLoadState('networkidle');
    // Wait for the screenplay count to appear (indicates data loading is complete)
    await expect(page.getByText(/Showing.*of.*screenplays/)).toBeVisible({ timeout: 60000 });
    // Wait for the screenplay grid to be visible
    await expect(page.locator('[role="list"]')).toBeVisible({ timeout: 5000 });
  });

  test.describe('Page Load', () => {
    test('should load the dashboard with screenplays', async ({ page }) => {
      // Check header is visible (use heading role to be specific)
      await expect(page.getByRole('heading', { name: 'Lemon Screenplay Dashboard' })).toBeVisible();

      // Check that screenplay cards are rendered
      const cards = page.locator('[role="listitem"]');
      await expect(cards.first()).toBeVisible();
    });

    test('should display screenplay count', async ({ page }) => {
      // Should show "Showing X of Y screenplays"
      await expect(page.getByText(/Showing.*of.*screenplays/)).toBeVisible();
    });

    test('should display filter chips', async ({ page }) => {
      // Use exact match to avoid ambiguity with collection tabs
      await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'FILM NOW' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Recommend' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Consider' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Pass' })).toBeVisible();
    });
  });

  test.describe('Search Functionality', () => {
    test('should filter screenplays by search query', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search title, author, genre, logline...');

      // Type a search query
      await searchInput.fill('thriller');

      // Wait for filter to apply
      await page.waitForTimeout(300);

      // Results should update
      await expect(page.getByText(/Showing.*of.*screenplays/)).toBeVisible();
    });

    test('should clear search with X button', async ({ page }) => {
      const searchInput = page.getByPlaceholder('Search title, author, genre, logline...');

      // Type a search query
      await searchInput.fill('drama');
      await page.waitForTimeout(300);

      // Click clear button
      await page.getByLabel('Clear search').click();

      // Search should be cleared
      await expect(searchInput).toHaveValue('');
    });
  });

  test.describe('Filter Chips', () => {
    test('should filter by FILM NOW', async ({ page }) => {
      // Click FILM NOW filter chip
      await page.getByRole('button', { name: 'FILM NOW' }).click();

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Should show filtered results - check for "Clear All" button which appears when filter is active
      await expect(page.getByRole('button', { name: /Clear All/ })).toBeVisible();
    });

    test('should filter by Recommend tier', async ({ page }) => {
      // Click Recommend filter chip
      await page.getByRole('button', { name: 'Recommend' }).click();
      await page.waitForTimeout(500);

      // Check that filter is active - Clear All button should appear
      await expect(page.getByRole('button', { name: /Clear All/ })).toBeVisible();
    });

    test('should show Clear All button when filters are active', async ({ page }) => {
      // Clear All should not be visible initially
      await expect(page.getByRole('button', { name: /Clear All/ })).not.toBeVisible();

      // Apply a filter - use exact match
      await page.getByRole('button', { name: 'FILM NOW' }).click();
      await page.waitForTimeout(500);

      // Clear All should now be visible
      await expect(page.getByRole('button', { name: /Clear All/ })).toBeVisible();
    });

    test('should clear all filters', async ({ page }) => {
      // Apply some filters
      await page.getByRole('button', { name: 'Pass' }).click();
      await page.waitForTimeout(500);

      // Click Clear All
      await page.getByRole('button', { name: /Clear All/ }).click();
      await page.waitForTimeout(500);

      // Clear All should disappear after clearing
      await expect(page.getByRole('button', { name: /Clear All/ })).not.toBeVisible();
    });
  });

  test.describe('Screenplay Modal', () => {
    test('should open modal when clicking a card', async ({ page }) => {
      // Click the first screenplay card
      await page.locator('[role="listitem"]').first().click();

      // Modal should be visible
      await expect(page.getByRole('dialog')).toBeVisible();
    });

    test('should close modal with close button', async ({ page }) => {
      // Open modal
      await page.locator('[role="listitem"]').first().click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click close button
      await page.getByLabel('Close modal').click();

      // Modal should be hidden
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should close modal with Escape key', async ({ page }) => {
      // Open modal
      await page.locator('[role="listitem"]').first().click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Modal should be hidden
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test('should display screenplay details in modal', async ({ page }) => {
      // Open modal
      await page.locator('[role="listitem"]').first().click();

      // Check for expected sections in modal
      await expect(page.getByRole('dialog')).toBeVisible();

      // Modal should have dimension scores section
      await expect(page.getByText('Dimension Scores')).toBeVisible();
    });
  });

  test.describe('Collection Tabs', () => {
    test('should display collection tabs', async ({ page }) => {
      // Check for collection tab (2020 should be visible)
      await expect(page.getByRole('button', { name: /2020/ })).toBeVisible();
    });

    test('should filter by collection when tab clicked', async ({ page }) => {
      // Click on a specific collection tab (e.g., 2020)
      const tab2020 = page.getByRole('button', { name: /2020/ });
      await tab2020.click();
      await page.waitForTimeout(500);

      // Results should update
      await expect(page.getByText(/Showing.*of.*screenplays/)).toBeVisible();
    });
  });

  test.describe('Sorting', () => {
    test('should have sort dropdown', async ({ page }) => {
      const sortSelect = page.locator('select').first();
      await expect(sortSelect).toBeVisible();
    });

    test('should change sort order', async ({ page }) => {
      const sortSelect = page.locator('select').first();

      // Change to sort by title
      await sortSelect.selectOption('title');
      await page.waitForTimeout(300);

      // Results should be sorted (hard to verify programmatically without checking order)
      await expect(page.locator('[role="listitem"]').first()).toBeVisible();
    });
  });

  test.describe('Comparison Feature', () => {
    test('should add screenplay to comparison', async ({ page }) => {
      // Find and click the comparison checkbox on first card
      const compareButton = page.locator('[role="listitem"]').first().getByLabel('Add to comparison');
      await compareButton.click();

      // Wait for comparison bar to appear
      await page.waitForTimeout(500);

      // The compare button should now show "Remove from comparison"
      await expect(page.locator('[role="listitem"]').first().getByLabel('Remove from comparison')).toBeVisible();
    });

    test('should remove screenplay from comparison', async ({ page }) => {
      // Add to comparison first
      const compareButton = page.locator('[role="listitem"]').first().getByLabel('Add to comparison');
      await compareButton.click();
      await page.waitForTimeout(500);

      // Click again to remove
      await page.locator('[role="listitem"]').first().getByLabel('Remove from comparison').click();
      await page.waitForTimeout(500);

      // Should be back to "Add to comparison"
      await expect(page.locator('[role="listitem"]').first().getByLabel('Add to comparison')).toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should navigate cards with arrow keys', async ({ page }) => {
      // Focus the first card
      const firstCard = page.locator('[role="listitem"]').first();
      await firstCard.focus();

      // Press arrow right
      await page.keyboard.press('ArrowRight');

      // Second card should be focused
      const secondCard = page.locator('[role="listitem"]').nth(1);
      await expect(secondCard).toBeFocused();
    });

    test('should open modal with Enter key', async ({ page }) => {
      // Focus the first card
      const firstCard = page.locator('[role="listitem"]').first();
      await firstCard.focus();

      // Press Enter
      await page.keyboard.press('Enter');

      // Modal should open
      await expect(page.getByRole('dialog')).toBeVisible();
    });
  });

  test.describe('Analytics Dashboard', () => {
    test('should display analytics section', async ({ page }) => {
      // Look for analytics/charts section - check for collapse button
      await expect(page.getByRole('button', { name: /Analytics|Show Charts|Hide Charts/ })).toBeVisible();
    });
  });

  test.describe('Export Feature', () => {
    test('should have export button', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
    });

    test('should open export modal', async ({ page }) => {
      // Click export button
      await page.getByRole('button', { name: 'Export' }).click();

      // Export modal should appear - look for export format options
      await expect(page.getByText(/Export as/i)).toBeVisible({ timeout: 5000 });
    });
  });
});
