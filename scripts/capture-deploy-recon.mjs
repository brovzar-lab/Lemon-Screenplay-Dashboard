/**
 * Capture screenshots of the deployed Lemon Screenplay Dashboard for visual recon.
 * Usage (from repo root): node scripts/capture-deploy-recon.mjs
 *
 * Uses Chromium bundled by Playwright, or falls back to channel: 'chrome' if installed.
 */
import { chromium, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'report', 'visual-recon-deploy');
const BASE_URL =
  process.env.RECON_BASE_URL?.trim() || 'https://lemon-screenplay-dashboard.web.app';

async function launch() {
  try {
    return await chromium.launch({
      channel: 'chrome',
      headless: true,
    });
  } catch {
    return await chromium.launch({ headless: true });
  }
}

async function waitReady(page) {
  await page.goto(`${BASE_URL}/`, {
    waitUntil: 'networkidle',
    timeout: 120_000,
  });
  await page.getByText(/Showing.*of.*screenplays/).waitFor({
    state: 'visible',
    timeout: 90_000,
  });
  await page.getByRole('list').waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByRole('listitem').first().waitFor({ state: 'visible', timeout: 15_000 });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await launch();
  try {
    const desktop = await browser.newContext({
      viewport: { width: 1728, height: 991 },
      deviceScaleFactor: 2,
    });
    const page = await desktop.newPage();

    await waitReady(page);
    await page.screenshot({
      path: path.join(OUT_DIR, '01-dashboard-home-full.png'),
      fullPage: true,
    });
    await page.screenshot({
      path: path.join(OUT_DIR, '02-dashboard-home-viewport.png'),
    });

    const filterNav = page.getByRole('navigation', { name: 'Filter screenplays' });
    await filterNav.getByRole('button', { name: 'Recommend', exact: true }).click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUT_DIR, '03-dashboard-filter-recommend-full.png'),
      fullPage: true,
    });

    await page.getByRole('button', { name: /Clear All/ }).click();
    await page.waitForTimeout(400);

    const search = page.getByTestId('search-input');
    await search.fill('thriller');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUT_DIR, '04-dashboard-search-thriller-full.png'),
      fullPage: true,
    });

    await search.clear();
    await page.waitForTimeout(300);

    const firstCard = page.getByRole('listitem').first();
    await firstCard.click();
    await page.getByTestId('screenplay-modal').waitFor({ state: 'visible', timeout: 10_000 });
    await page.screenshot({
      path: path.join(OUT_DIR, '05-screenplay-modal-viewport.png'),
    });
    await page.getByLabel('Close modal').click();
    await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 5000 });

    await page.goto(`${BASE_URL}/settings`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    });
    await page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => undefined);
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(OUT_DIR, '06-settings-full.png'),
      fullPage: true,
    });

    await page.goto(`${BASE_URL}/share/demo-token-visual-recon`, {
      waitUntil: 'commit',
      timeout: 90_000,
    });
    await page.waitForLoadState('domcontentloaded', { timeout: 30_000 }).catch(() => undefined);
    await page.waitForTimeout(2500);
    await page.screenshot({
      path: path.join(OUT_DIR, '07-share-route-sample-full.png'),
      fullPage: true,
    });

    await waitReady(page);
    await page.getByRole('button', { name: /Toggle Dev Exec chat/i }).click();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(OUT_DIR, '08-dashboard-devexec-panel-viewport.png'),
    });
    await page.getByTitle('Close').first().click().catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(300);

    // Advanced filters panel open
    await page.getByTitle('Advanced Filters').click();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: path.join(OUT_DIR, '10-advanced-filters-panel-viewport.png'),
    });
    await page.getByRole('button', { name: 'Apply Filters' }).click();
    await page.waitForTimeout(300);

    // Share modal open
    await page.getByTitle('Share dashboard').click();
    const shareModal = page.getByTestId('share-modal');
    await shareModal.waitFor({ state: 'visible', timeout: 8_000 });
    await page.screenshot({
      path: path.join(OUT_DIR, '11-share-modal-viewport.png'),
    });
    await shareModal.getByRole('button', { name: 'Close', exact: true }).click();
    await page.waitForTimeout(300);

    // Export modal open
    await page.getByTitle('Export screenplays').click();
    const exportModal = page.getByTestId('export-modal');
    await exportModal.waitFor({ state: 'visible', timeout: 8_000 });
    await page.screenshot({
      path: path.join(OUT_DIR, '12-export-modal-viewport.png'),
    });
    await exportModal.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.waitForTimeout(300);

    // Comparison flow: select 2 cards, open bulk compare, capture comparison modal
    const firstSelect = page.getByLabel('Select screenplay').first();
    const secondSelect = page.getByLabel('Select screenplay').nth(1);
    await firstSelect.click();
    await secondSelect.click();
    await page.waitForTimeout(400);
    await page.locator('.fixed.bottom-0').getByRole('button', { name: 'Compare', exact: true }).click();
    await page.waitForTimeout(700);
    await page.screenshot({
      path: path.join(OUT_DIR, '13-comparison-modal-viewport.png'),
    });
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(300);

    await desktop.close();

    const mobile = await browser.newContext({
      ...devices['iPhone 13'],
      deviceScaleFactor: 2,
    });
    const m = await mobile.newPage();
    await m.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 120_000 });
    await m.getByText(/Showing.*of.*screenplays/).waitFor({
      state: 'visible',
      timeout: 90_000,
    });
    await m.getByRole('list').waitFor({ state: 'visible', timeout: 30_000 });
    await m.screenshot({
      path: path.join(OUT_DIR, '09-dashboard-home-mobile-full.png'),
      fullPage: true,
    });
    await m.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await m.waitForTimeout(1200);
    await m.screenshot({
      path: path.join(OUT_DIR, '14-settings-mobile-full.png'),
      fullPage: true,
    });

    await mobile.close();

    const readme = [
      `Lemon Screenplay Dashboard — deploy visual recon`,
      `Source URL: ${BASE_URL}`,
      `Generated files:`,
      `  01 — Dashboard home (full scroll, desktop @2x)`,
      `  02 — Dashboard home (viewport)`,
      `  03 — Recommend filter active`,
      `  04 — Search “thriller”`,
      `  05 — First screenplay detail modal`,
      `  06 — Settings page`,
      `  07 — Share route (invalid demo token; shows share/expiry UX)`,
      `  08 — Dev Exec chat panel open`,
      `  09 — Mobile home (full scroll)`,
      `  10 — Advanced filters panel`,
      `  11 — Share modal`,
      `  12 — Export modal`,
      `  13 — Comparison modal`,
      `  14 — Mobile settings (full scroll)`,
    ].join('\n');
    fs.writeFileSync(path.join(OUT_DIR, 'README.txt'), readme + '\n');

    console.log(`Screenshots written to ${OUT_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
