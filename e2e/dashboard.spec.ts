import { test, expect } from './fixtures';

test.setTimeout(90_000);

test.describe('Discovery screenplay presentation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/discover?ui=screenplay');
    await expect(page.getByRole('link', { name: 'Discovery home' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Showing \d+ of \d+ screenplays/)).toBeVisible({ timeout: 30_000 });
  });

  test('loads the current slate in the selected theme', async ({ page }, testInfo) => {
    const expectedTheme = testInfo.project.name.endsWith('-dark') ? 'dark' : 'light';
    await expect(page.locator('html')).toHaveAttribute('data-theme', expectedTheme);
    await expect(page.getByRole('searchbox', { name: 'Discovery search' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Continue through the slate' })).toBeVisible();
    await expect(page.getByTestId('screenplay-discovery-grid')).toBeVisible();
    await expect(page.getByTestId('screenplay-discovery-result').first()).toBeVisible();
  });

  test('shows one top result and the next three under the active ranking', async ({ page }) => {
    await expect(page.getByTestId('screenplay-ranking-top')).toHaveCount(1);
    await expect(page.getByTestId('screenplay-ranking-runner')).toHaveCount(3);
    await expect(page.getByRole('heading', { name: 'Top result' })).toBeVisible();
  });

  test('keeps missing non-blocking metadata out of card copy', async ({ page }) => {
    await expect(page.getByTestId('screenplay-discovery-grid')).not.toContainText('SOURCE NOT RECORDED');
  });

  test('opens a screenplay in the complete Screenplay File workspace', async ({ page }) => {
    const firstCard = page.getByTestId('screenplay-discovery-result').first();
    await firstCard.locator('button.screenplay-wall__open').click();

    await expect(page).toHaveURL(/\/projects\/[^/?]+\?workspace=screenplay/);
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Open (source )?screenplay/i }),
    ).toBeVisible();
  });
});
