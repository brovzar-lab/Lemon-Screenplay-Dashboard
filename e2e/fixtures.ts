import { test as base, expect } from '@playwright/test';

function createAnalysisFixture(
  projectId: string,
  title: string,
  score: number,
  verdict: string,
  genre = 'Drama',
) {
  const sourceFile = `${title}.pdf`;
  const versionId = `${projectId}-version-1`;
  const contentHash = 'a'.repeat(64);
  const integrityHash = 'b'.repeat(64);
  const analysisHash = 'c'.repeat(64);
  const pillar = { score, weight: 0.2, evidence: `${title} synthetic E2E evidence.` };
  return {
    project_id: projectId,
    source_file: sourceFile,
    latest_source_file: sourceFile,
    latest_version_id: versionId,
    version_id: versionId,
    content_hash: contentHash,
    identity_status: 'verified',
    _trust_authority: 'immutable_server',
    analysis_model: 'claude-sonnet-4-6',
    analysis_version: 'v9_archaeology',
    trust_manifest_version: 'lemon-trust-manifest-v6',
    trust_manifest: {
      manifest_version: 'lemon-trust-manifest-v6',
      integrity_sha256: integrityHash,
      analysis_payload_sha256: analysisHash,
      source: { content_sha256: contentHash, source_file: sourceFile },
      origin: { project_id: projectId, version_id: versionId },
      engine: { analysis_version: 'v9_archaeology' },
      models: {
        calls: [{
          response_id: `e2e-${projectId}`,
          requested_model: 'claude-sonnet-4-6',
          returned_model: 'claude-sonnet-4-6',
        }],
      },
    },
    server_trust_attestation: {
      attestation_version: 'lemon-server-trust-attestation-v1',
      writer: 'firebase_admin',
      project_id: projectId,
      version_id: versionId,
      content_sha256: contentHash,
      trust_manifest_integrity_sha256: integrityHash,
      analysis_payload_sha256: analysisHash,
    },
    collection: 'LEMON',
    metadata: { filename: sourceFile, page_count: 110, word_count: 20_000 },
    analysis: {
      title,
      author: 'E2E Writer',
      genre,
      subgenres: ['Mystery'],
      themes: ['Identity'],
      logline: `${title} is a synthetic screenplay used only by Playwright.`,
      tone: 'Tense',
      verdict,
      weighted_score: score,
      weighted_score_adjusted: score,
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
  createAnalysisFixture('synthetic-romance', 'Synthetic Romance', 8.4, 'RECOMMEND', 'Romance'),
  createAnalysisFixture('synthetic-pass', 'Synthetic Pass', 4.2, 'PASS'),
  createAnalysisFixture('synthetic-alpha', 'Synthetic Alpha', 7.8, 'RECOMMEND'),
  createAnalysisFixture('synthetic-cobalt', 'Synthetic Cobalt', 7.1, 'CONSIDER'),
  createAnalysisFixture('synthetic-delta', 'Synthetic Delta', 6.5, 'CONSIDER'),
  createAnalysisFixture('synthetic-echo', 'Synthetic Echo', 5.9, 'CONSIDER'),
];

export const test = base.extend({
  page: async ({ page }, runTest, testInfo) => {
    const dark = testInfo.project.name.endsWith('-dark');
    await page.route('**/*', (route) => {
      const host = new URL(route.request().url()).hostname;
      if (host === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '/* Offline test: use system fonts. */' });
      return ['localhost', '127.0.0.1'].includes(host) ? route.continue() : route.abort();
    });
    await page.addInitScript(({ isDark, testAnalyses }) => {
      const theme = isDark ? 'dark' : 'light';
      if (!localStorage.getItem('lemon-e2e-role')) {
        localStorage.setItem('lemon-e2e-role', 'admin');
      }
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
