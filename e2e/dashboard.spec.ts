import { test, expect } from './fixtures';

test.setTimeout(90_000);

test.describe('Discovery screenplay presentation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Lemon Screenplay Dashboard home' })).toBeVisible({ timeout: 30_000 });
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

  test('redirects the old dashboard route to the current bilingual home', async ({ page }) => {
    await page.goto('/dashboard-classic');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Continue through the slate' })).toBeVisible();
  });

  test('shows one explainable Featured project and returns every runner to the grid', async ({
    page,
  }) => {
    const featured = page.getByTestId('screenplay-featured-project');
    await expect(featured).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Featured project' })).toBeVisible();
    await expect(featured).toContainText(/AI verdict/i);
    await expect(featured).toContainText('Why featured');
    await expect(page.getByTestId('screenplay-ranking-runner')).toHaveCount(0);
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
