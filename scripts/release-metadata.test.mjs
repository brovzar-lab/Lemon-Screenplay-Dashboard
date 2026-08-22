import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { cacheBustedReleaseUrl, validateReleaseMetadata } from './release-metadata.mjs';

test('release verification is cache-busted by the full Git SHA', () => {
  const sha = 'a'.repeat(40);
  assert.equal(
    cacheBustedReleaseUrl('https://lemon-screenplay-dashboard.web.app', sha),
    `https://lemon-screenplay-dashboard.web.app/release.json?verification=${sha}`,
  );
});

test('Firebase serves release.json with no-store', () => {
  const firebase = JSON.parse(fs.readFileSync(new URL('../firebase.json', import.meta.url)));
  const release = firebase.hosting.headers.find((entry) => entry.source === '/release.json');
  assert.ok(release);
  assert.ok(release.headers.some(
    (header) => header.key === 'Cache-Control' && header.value === 'no-store',
  ));
});

test('release identity requires exact hashes and a build timestamp', () => {
  assert.doesNotThrow(() => validateReleaseMetadata({
    git_sha: 'a'.repeat(40),
    source_clean: true,
    catalog_sha256: 'b'.repeat(64),
    hosting_config_sha256: 'c'.repeat(64),
    build_timestamp: '2026-08-21T12:00:00Z',
  }));
});

test('staging candidate workflow is WIF-only and deploys only the candidate', () => {
  const workflow = fs.readFileSync(
    new URL('../.github/workflows/deploy-candidate-staging.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /environment: staging/);
  assert.match(workflow, /ref: \$\{\{ inputs\.approved_source_sha \}\}/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /lemon-screenplay-staging\|lemon-sp-dashboard-stg-493694/);
  assert.match(workflow, /Refusing unapproved staging project/);
  assert.match(workflow, /DEPLOYER_SERVICE_ACCOUNT.*STAGING_PROJECT_ID.*iam\\\.gserviceaccount/s);
  assert.match(
    workflow,
    /google-github-actions\/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093/,
  );
  assert.match(workflow, /NODE_VERSION: '22\.22\.3'/);
  assert.match(workflow, /NPM_VERSION: '10\.9\.8'/);
  assert.match(workflow, /PYTHON_VERSION: '3\.13\.13'/);
  assert.match(workflow, /JAVA_VERSION: '21\.0\.12'/);
  assert.match(workflow, /FIREBASE_TOOLS_VERSION: '15\.14\.0'/);
  assert.match(workflow, /GCLOUD_VERSION: '574\.0\.0'/);
  assert.match(workflow, /--only="functions:llmProxyCandidate"/);
  assert.doesNotMatch(workflow, /FIREBASE_TOKEN|SERVICE_ACCOUNT_JSON|credentials_json/);
});
