import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

test.setTimeout(90_000);

async function setSyntheticRole(page: Page, role: 'reader' | 'outsider' | 'signed_out') {
  await page.goto('/');
  await page.evaluate((nextRole) => localStorage.setItem('lemon-e2e-role', nextRole), role);
  await page.reload();
}

test.describe('Intelligence Briefing contract', () => {
  test('keeps public, outsider, and team authorization boundaries distinct', async ({ page }) => {
    await setSyntheticRole(page, 'signed_out');
    await expect(page.getByRole('heading', { name: 'Screenplay Dashboard' })).toBeVisible();
    await expect(page.getByText('Synthetic Romance')).toHaveCount(0);

    await setSyntheticRole(page, 'outsider');
    await expect(page.getByRole('heading', { name: 'Lemon team access required' })).toBeVisible();
    await expect(page.getByText('Synthetic Romance')).toHaveCount(0);

    await setSyntheticRole(page, 'reader');
    await expect(page.getByRole('heading', { name: 'Intelligence Briefing' })).toBeVisible();
    await page.locator('summary', { hasText: 'View authorized portfolio map' }).click();
    await expect(page.getByRole('table', { name: 'Authorized portfolio opportunity table' })).toContainText('Synthetic Romance');
  });

  test('keeps the public share route out of the private portfolio join', async ({ page }) => {
    let requestedPortfolio = false;
    page.on('request', (request) => {
      if (request.postData()?.includes('uploaded_analyses')) requestedPortfolio = true;
    });

    await page.goto('/share/synthetic-missing-token');

    await expect(page.locator('body')).not.toContainText('Synthetic Romance');
    await expect(page.locator('body')).not.toContainText('8.4');
    expect(requestedPortfolio).toBe(false);
  });

  test('is accessible, keyboard operable, and evidence complete without the chart', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Intelligence Briefing' })).toBeVisible();

    const chart = page.getByTestId('portfolio-chart');
    await expect(chart).toHaveAttribute('aria-hidden', 'true');
    await page.locator('summary', { hasText: 'View authorized portfolio map' }).click();
    const table = page.getByRole('table', { name: 'Authorized portfolio opportunity table' });
    await expect(table).toBeVisible();
    for (const header of [
      'Project',
      'Verified creative score',
      'Market timing',
      'Market action',
      'Market claim',
      'Match status',
      'Next action',
    ]) {
      await expect(table.getByRole('columnheader', { name: new RegExp(header) })).toBeVisible();
    }

    const projectSort = table.getByRole('button', { name: /Project/ });
    await projectSort.focus();
    const focusStyle = await projectSort.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(focusStyle).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(
      table.getByRole('rowgroup', { name: 'Unmatched projects' }).getByRole('row').nth(1).getByRole('rowheader'),
    ).toHaveText('Synthetic Alpha');

    await page.locator('summary', { hasText: /reviewed themes · View evidence$/ }).click();
    const disclosure = page.locator('summary', { hasText: 'Source receipts and methodology' });
    await disclosure.focus();
    await page.keyboard.press('Enter');
    await expect(disclosure.locator('..')).toHaveAttribute('open', '');
    await expect(page.getByRole('link', { name: /Variety: Netflix Commits/ })).toHaveAttribute('rel', 'noopener noreferrer');

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('keeps ranked moves before the dense portfolio on desktop and mobile', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1440, height: 1000 });
    expect((await page.locator('.studio-pulse__moves').boundingBox())!.y).toBeLessThan(
      (await page.locator('.studio-pulse__portfolio').boundingBox())!.y,
    );
    await page.locator('summary', { hasText: 'View authorized portfolio map' }).click();
    await expect(page.getByTestId('portfolio-chart')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    expect((await page.locator('.studio-pulse__moves').boundingBox())!.y).toBeLessThan(
      (await page.locator('.studio-pulse__situation').boundingBox())!.y,
    );
    expect((await page.locator('.studio-pulse__moves').boundingBox())!.y).toBeLessThan(
      (await page.locator('.studio-pulse__portfolio').boundingBox())!.y,
    );
    await expect(page.getByTestId('portfolio-chart')).toBeHidden();
    await expect(page.getByRole('table', { name: 'Authorized portfolio opportunity table' })).toBeVisible();
  });

  test('switches English and Spanish at mobile width without console or AI activity', async ({ page }) => {
    const consoleErrors: string[] = [];
    const aiRequests: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('request', (request) => {
      if (/\/api\/llm(?:[/?]|$)|\/llmProxy(?:[/?]|$)|api\.anthropic\.com|generativelanguage\.googleapis\.com/i.test(request.url())) {
        aiRequests.push(request.url());
      }
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Intelligence Briefing' })).toBeVisible();
    await page.getByRole('button', { name: 'Open navigation and preferences' }).click();
    await page.getByRole('button', { name: 'Spanish' }).click();
    await expect(page.getByRole('heading', { name: 'Briefing de Inteligencia' })).toBeVisible();
    await expect(
      page.locator('.studio-pulse__lead-story').getByRole('heading', {
        name: 'Investigar la vía de romance local',
      }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No hay historial suficiente' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByRole('button', { name: 'Inglés' }).click();
    await expect(page.getByRole('heading', { name: 'Intelligence Briefing' })).toBeVisible();
    expect(consoleErrors).toEqual([]);
    expect(aiRequests).toEqual([]);
  });
});
