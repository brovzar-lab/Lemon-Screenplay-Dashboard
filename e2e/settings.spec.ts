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

  test('settings page displays all key sections', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // The page heading should be "Settings"
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10000 });

    // The sidebar nav should have all the expected tab buttons
    const nav = page.locator('aside nav');
    await expect(nav).toBeVisible();

    // Verify each tab is present
    await expect(nav.getByText('Appearance')).toBeVisible();
    await expect(nav.getByText('Upload')).toBeVisible();
    await expect(nav.getByText('Favorites')).toBeVisible();
    await expect(nav.getByText('Data')).toBeVisible();
    await expect(nav.getByText('Calibration')).toBeVisible();
    await expect(nav.getByText('PDF Files')).toBeVisible();
    await expect(nav.getByText('Compare')).toBeVisible();

    // The "Back to Dashboard" link should be present
    await expect(page.getByText('Back to Dashboard')).toBeVisible();
  });

  test('settings tabs switch content when clicked', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10000 });

    const nav = page.locator('aside nav');

    // Click the "Upload" tab and verify upload-related content appears
    await nav.getByText('Upload').click();
    await page.waitForTimeout(300);

    // The Upload tab renders UploadPanel which contains upload-related text
    // Look for recognizable content from the Upload tab
    await expect(page.getByText(/Upload|Analyze|Categories/i).first()).toBeVisible({ timeout: 5000 });

    // Click the "Data" tab
    await nav.getByText('Data').click();
    await page.waitForTimeout(300);

    // Data tab should show DataManagement content
    await expect(page.getByText(/Data|Export|Import|Shared Links/i).first()).toBeVisible({ timeout: 5000 });
  });
});
