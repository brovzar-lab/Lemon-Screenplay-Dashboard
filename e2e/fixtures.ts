import { test as base, expect } from '@playwright/test';

function createAnalysisFixture(projectId: string, title: string, score: number, verdict: string) {
  const pillar = { score, weight: 0.2, evidence: `${title} synthetic E2E evidence.` };
  return {
    project_id: projectId,
    source_file: `${title}.pdf`,
    analysis_model: 'claude-sonnet-4-6',
    analysis_version: 'v9_archaeology',
    collection: 'LEMON',
    metadata: { filename: `${title}.pdf`, page_count: 110, word_count: 20_000 },
    analysis: {
      title,
      author: 'E2E Writer',
      genre: 'Drama',
      subgenres: ['Mystery'],
      themes: ['Identity'],
      logline: `${title} is a synthetic screenplay used only by Playwright.`,
      tone: 'Tense',
      verdict,
      weighted_score: score,
      adjusted_score: score,
      executive_summary: `${title} has a clear synthetic E2E verdict.`,
      analysis_quality: {
        status: 'complete',
        completed_readers: 5,
        expected_readers: 5,
        failed_readers: [],
      },
      pillar_scores: {
        structure: pillar,
        character: pillar,
        craft_scene: pillar,
        concept: pillar,
        emotional_resonance: pillar,
      },
      strengths: ['Distinct synthetic voice'],
      weaknesses: [],
      development_notes: [],
      critical_failures: [],
      red_flags: [],
    },
  };
}

const analyses = [
  createAnalysisFixture('matadero-5ta-version-24052026', 'Matadero', 8.4, 'RECOMMEND'),
  createAnalysisFixture('will', 'Will', 4.2, 'PASS'),
  createAnalysisFixture('alpha-ridge', 'Alpha Ridge', 7.8, 'RECOMMEND'),
  createAnalysisFixture('cobalt-moon', 'Cobalt Moon', 7.1, 'CONSIDER'),
  createAnalysisFixture('delta-house', 'Delta House', 6.5, 'CONSIDER'),
  createAnalysisFixture('echo-lake', 'Echo Lake', 5.9, 'CONSIDER'),
];

export const test = base.extend({
  page: async ({ page }, runTest, testInfo) => {
    const dark = testInfo.project.name.endsWith('-dark');
    await page.route('https://firestore.googleapis.com/**', (route) => route.abort());
    await page.route('https://firebasestorage.googleapis.com/**', (route) => route.abort());
    await page.route('https://storage.googleapis.com/**', (route) => route.abort());
    await page.addInitScript(({ isDark, testAnalyses }) => {
      const theme = isDark ? 'dark' : 'light';
      localStorage.setItem(
        'lemon-theme',
        JSON.stringify({
          state: {
            theme,
            designSystem: 'instrument',
            resolvedTheme: theme,
            isDark,
          },
          version: 0,
        }),
      );
      localStorage.setItem('lemon-local-analyses', JSON.stringify(testAnalyses));
    }, { isDark: dark, testAnalyses: analyses });
    await runTest(page);
  },
});

export { expect };
