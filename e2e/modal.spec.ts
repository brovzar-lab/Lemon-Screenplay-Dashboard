import { test, expect } from '@playwright/test';

// Extend timeout for tests that need to load all screenplay data
test.setTimeout(90000);

test.describe('Screenplay Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Showing.*of.*screenplays/)).toBeVisible({ timeout: 60000 });
  });

  test('clicking a screenplay card opens the modal', async ({ page }) => {
    // Click the first visible screenplay card article element
    const firstCard = page.locator('[data-testid^="screenplay-card-"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    await firstCard.click();

    // Modal wrapper should appear
    await expect(page.getByTestId('screenplay-modal')).toBeVisible({ timeout: 5000 });
    // The dialog role should also be present
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('modal displays screenplay dimension scores section', async ({ page }) => {
    const firstCard = page.locator('[data-testid^="screenplay-card-"]').first();
    await firstCard.click();

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Dimension Scores')).toBeVisible();
  });

  test('modal can be closed with the close button', async ({ page }) => {
    const firstCard = page.locator('[data-testid^="screenplay-card-"]').first();
    await firstCard.click();

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.getByLabel('Close modal').click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
  });

  test('modal can be closed with the Escape key', async ({ page }) => {
    const firstCard = page.locator('[data-testid^="screenplay-card-"]').first();
    await firstCard.click();

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3000 });
  });

  test('screenplay grid container is present', async ({ page }) => {
    await expect(page.getByTestId('screenplay-grid')).toBeVisible({ timeout: 10000 });
  });
});
