import { test, expect } from './fixtures';

test.setTimeout(90_000);

test('defaults to English and saves Spanish across pages and reloads', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('lemon-ui-language')).forEach((key) => localStorage.removeItem(key)));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('link', { name: 'Screenplays', exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: 'Spanish' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('link', { name: 'Guiones', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Informe del mercado' })).toBeVisible();
  await page.getByRole('link', { name: 'Guiones', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Continúa con la selección' })).toBeVisible();

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Estado del análisis', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Sistema de carga de guiones/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Sistema de carga de guiones', exact: true }),
  ).toBeVisible();
});

test('keeps the language control usable on a phone-sized screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/discover');
  await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('lemon-ui-language')).forEach((key) => localStorage.removeItem(key)));
  await page.reload();

  await page.getByRole('button', { name: 'Open navigation and preferences' }).click();
  await expect(page.getByRole('button', { name: 'English' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Spanish' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Continue through the slate' })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Discovery search' })).toBeVisible();
  await page.getByRole('button', { name: 'Spanish' }).click();
  await expect(page.getByRole('searchbox', { name: 'Búsqueda de descubrimiento' })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
