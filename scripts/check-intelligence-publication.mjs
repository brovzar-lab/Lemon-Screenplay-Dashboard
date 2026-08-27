import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const manifestPath = 'src/data/studio-pulse-market-snapshot.manifest.json';
const requiredPaths = [
  'src/data/studio-pulse-market-snapshot.json',
  'public/research/studio-pulse-market-snapshot-2026-08-19.md',
];

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.schemaVersion !== 1 || manifest.algorithm !== 'sha256') {
  throw new Error('Invalid Intelligence Briefing publication manifest');
}
if (
  !Array.isArray(manifest.artifacts) ||
  manifest.artifacts.length !== requiredPaths.length ||
  requiredPaths.some((path) => !manifest.artifacts.some((artifact) => artifact.path === path))
) {
  throw new Error('Incomplete Intelligence Briefing publication manifest');
}

for (const artifact of manifest.artifacts) {
  if (!requiredPaths.includes(artifact.path) || !/^[a-f0-9]{64}$/.test(artifact.sha256)) {
    throw new Error('Invalid Intelligence Briefing publication artifact');
  }
  const actual = createHash('sha256').update(readFileSync(artifact.path)).digest('hex');
  if (actual !== artifact.sha256) {
    throw new Error(`Intelligence Briefing publication hash mismatch: ${artifact.path}`);
  }
}

const snapshot = JSON.parse(readFileSync(requiredPaths[0], 'utf8'));
if (snapshot.schemaVersion !== 2) {
  throw new Error('Unsupported Intelligence Briefing snapshot schema');
}
