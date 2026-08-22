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
