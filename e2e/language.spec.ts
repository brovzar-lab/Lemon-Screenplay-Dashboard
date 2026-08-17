import { test, expect } from './fixtures';

test.setTimeout(90_000);

test('defaults to English and saves Spanish across pages and reloads', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('lemon-ui-language'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('link', { name: 'Discovery', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Spanish' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('link', { name: 'Descubrimiento', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Continúa con la selección' })).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Estado del análisis', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Recepción/ }).click();
  await expect(page.getByRole('heading', { name: 'Recepción', exact: true })).toBeVisible();
});

test('keeps the language control usable on a phone-sized screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('lemon-ui-language'));
  await page.reload();

  await expect(page.getByRole('button', { name: 'English' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Spanish' })).toBeVisible();
  await page.getByRole('button', { name: 'Spanish' }).click();
  await expect(page.getByRole('searchbox', { name: 'Búsqueda de descubrimiento' })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
