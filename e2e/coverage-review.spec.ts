import { test, expect } from '@playwright/test';

// Only invented report data. Every non-loopback request is blocked.
test('saved Coverage review survives reload and cannot drive a favorite or decision PDF', async ({ page }, testInfo) => {
  await page.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '/* Offline test: use system fonts. */' });
    return ['localhost', '127.0.0.1'].includes(host) ? route.continue() : route.abort();
  });
  await page.addInitScript((dark) => {
    localStorage.setItem('lemon-e2e-role', 'admin');
    const theme = dark ? 'dark' : 'light';
    localStorage.setItem('lemon-theme', JSON.stringify({ state: { theme, designSystem: 'instrument', resolvedTheme: theme, isDark: dark }, version: 0 }));
    localStorage.setItem('lemon-local-analyses', JSON.stringify([{
      project_id: 'synthetic-review', source_file: 'Synthetic Review.pdf', collection: 'LEMON',
      analysis_version: 'coverage_v1', status: 'needs_review',
      title: 'Synthetic Review', verdict: 'CONSIDER', confidence: 'medium',
      engine_version: 'coverage-v1.2-bounded-1', human_review_recommended: true,
      review_reasons: ['Check the ending before making a decision.'],
      coverage: {
        language: 'en', synopsis: 'A completely invented screenplay for a local browser check.',
        logline: 'A synthetic protagonist faces a synthetic choice.',
        story_spine: { protagonist: 'Synthetic protagonist', climax: 'Two distinct actions.', ending: 'An unresolved question.', major_turns: [] },
        strengths: [], concerns: [], development_priorities: [], lens_notes: [], uncertainties: [],
      },
      independent_review: { summary: 'A useful draft with one factual question.', issues: [
        { field: 'story_spine.ending', category: 'factual', severity: 'major', note: 'Check the literal order of the two actions.', page: 4 },
        { field: 'pacing', category: 'interpretation', severity: 'minor', note: 'Slower pacing is a matter of taste.', page: 0 },
      ] },
    }]));
  }, testInfo.project.name.endsWith('-dark'));
  await page.goto('/projects/synthetic-review/coverage');
  await expect(page.getByText('Needs Review · provisional coverage')).toBeVisible();
  await expect(page.getByText('Check the literal order of the two actions.')).toBeVisible();
  await expect(page.getByText('Human taste', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Favorite', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Download coverage PDF' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Pitch-deck PDF' })).toBeDisabled();
  await expect(page.getByText('Not verified', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('A useful draft with one factual question.')).toBeVisible();
  await page.screenshot({ path: `test-results/coverage-review-${testInfo.project.name}.png`, fullPage: true });
  await page.goto('/intake');
  await expect(page.getByLabel('Choose screenplay PDFs')).toBeAttached();
  await expect(page.getByRole('button', { name: 'Choose PDF files' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose folder' })).toBeVisible();
  await page.screenshot({ path: `test-results/intake-${testInfo.project.name}.png`, fullPage: true });
});
