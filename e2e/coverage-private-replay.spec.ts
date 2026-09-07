import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';

// Opt-in local cache replay, NOT a production import or a new engine reading.
// Never attach private content to screenshots, traces or assertion output.
test.use({ trace: 'off', screenshot: 'off', video: 'off', serviceWorkers: 'block' });
test('twenty private historical reports render provisionally and survive cache reload', async ({ page }, testInfo) => {
  test.skip(process.env.LEMON_PRIVATE_AUDIT_REPLAY !== '1', 'Private local fixtures are opt-in.');
  test.setTimeout(180_000);
  // Suppress Playwright's automatic private DOM snapshot on failure too.
  await testInfo.attach('error-context', { body: 'Private replay: DOM capture intentionally omitted.', contentType: 'text/plain' });
  const root = resolve('benchmark-artifacts/coverage-v1-audit-packages');
  const folders = readdirSync(root).filter((name) => /^(0[1-9]|1[0-9]|20)-/.test(name)).sort();
  expect(folders.length).toBe(20);
  const paths = folders.flatMap((folder) => [
    'SCREENPLAY.pdf', 'COVERAGE-V1.json', 'DROP-BILLY-APPROVED-AUDIT-HERE/Billy_Audit.md',
  ].map((file) => resolve(root, folder, file)));
  const ledger = resolve(root, '00-CALIBRATION-SYNTHESIS/Coverage-V1.1-Human-Audit-Ledger.json');
  paths.push(ledger);
  const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
  const before = paths.map(hash);
  expect(hash(ledger)).toBe('1e4cdb8e37b8a0ab02c51f3f2d5a0d2a016283461cc65c45d95a0b041b96f04d');
  const reports = folders.map((folder, index) => {
    const parsed: unknown = JSON.parse(readFileSync(resolve(root, folder, 'COVERAGE-V1.json'), 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid private report');
    const report = parsed as Record<string, unknown>;
    expect(report.analysis_version === 'coverage_v1' && report.engine_version === 'coverage-v1.1').toBe(true);
    const coverage = report.coverage;
    if (!coverage || typeof coverage !== 'object' || Array.isArray(coverage)) throw new Error('Missing private coverage');
    const synopsis = (coverage as Record<string, unknown>).synopsis;
    if (typeof synopsis !== 'string' || !synopsis.trim()) throw new Error('Missing private synopsis');
    return {
      synopsis,
      record: {
        ...report, project_id: `private-replay-${index}`, source_file: `${folder}.pdf`, collection: 'LEMON',
        // Only disposable display copies change. Keep historical provenance and prose intact.
        automated_status: report.status, status: 'needs_review', human_review_recommended: true,
        publication_policy: 'human_review_required',
        review_reasons: ['Historical V1.1 report: consult the Billy-approved audit; not a new V1.2 evaluation.'],
      },
    };
  });
  await page.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    return ['localhost', '127.0.0.1'].includes(host) ? route.continue() : route.abort();
  });
  await page.addInitScript((dark) => {
    localStorage.setItem('lemon-e2e-role', 'admin');
    const theme = dark ? 'dark' : 'light';
    localStorage.setItem('lemon-theme', JSON.stringify({ state: { theme, designSystem: 'instrument', resolvedTheme: theme, isDark: dark }, version: 0 }));
  }, testInfo.project.name.endsWith('-dark'));
  await page.goto('/');
  // Seed ONCE, not on every navigation/reload. Use an isolated browser context.
  await page.evaluate((records) => localStorage.setItem('lemon-local-analyses', JSON.stringify(records)), reports.map(({ record }) => record));
  try {
    for (const [index, report] of reports.entries()) {
      await page.goto(`/projects/private-replay-${index}/coverage`);
      for (let pass = 0; pass < 2; pass++) {
        await expect(page.getByText('Needs Review · provisional coverage')).toBeVisible();
        for (const heading of ['Synopsis', 'Story spine', 'Methodology lenses', 'Strengths', 'Concerns', 'Development priorities']) {
          await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
        }
        // Boolean assertions keep private prose out of failure messages.
        expect(await page.locator('.coverage-report').evaluate((node, synopsis) => node.textContent?.includes(synopsis) === true, report.synopsis)).toBe(true);
        await expect(page.getByRole('button', { name: 'Favorite', exact: true })).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Download coverage PDF' })).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Pitch-deck PDF' })).toBeDisabled();
        await expect(page.getByText('Not verified', { exact: true })).toHaveCount(0);
        if (pass === 0) await page.reload();
      }
    }
  } finally {
    expect(paths.map(hash)).toEqual(before);
  }
});
