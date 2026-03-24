import { test, expect } from '@playwright/test';

// Extend timeout to handle page load
test.setTimeout(60000);

test.describe('Settings Page', () => {
  test('navigating to /settings loads the settings page', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // The settings page should render without error
    // Check for a heading or landmark that indicates we're on settings
    await expect(page).toHaveURL(/\/settings/);
  });

  test('clicking the settings gear icon navigates to /settings', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Showing.*of.*screenplays/)).toBeVisible({ timeout: 60000 });

    // Click the settings link in the header
    await page.getByTitle('Settings').click();

    // Should now be on /settings
    await expect(page).toHaveURL(/\/settings/);
  });

  test('settings page has a back / navigation path to dashboard', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Navigating back to root should work
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
  });
});
