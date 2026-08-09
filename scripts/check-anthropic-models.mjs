import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const catalogUrl = new URL('../src/config/anthropic-model-catalog.json', import.meta.url);
const catalog = JSON.parse(await readFile(fileURLToPath(catalogUrl), 'utf8'));
const offline = process.argv.includes('--offline');

const requiredRoutes = [
  ...Object.values(catalog.analysisRoutes),
  ...Object.values(catalog.interactiveRoutes),
];

if (catalog.schemaVersion !== 1 || !catalog.verifiedAt || !catalog.source) {
  throw new Error('Anthropic model catalog is missing its version, verification date, or source.');
}

for (const route of requiredRoutes) {
  if (!route.modelId || !route.displayName) {
    throw new Error('Anthropic model catalog contains an incomplete approved route.');
  }
}

if (offline) {
  console.log(`Catalog verified: ${catalog.verifiedAt}`);
  console.log(`Approved analysis routes: ${Object.values(catalog.analysisRoutes).map((route) => route.modelId).join(', ')}`);
  console.log(`Approved Reader Chat routes: ${Object.values(catalog.interactiveRoutes).map((route) => route.modelId).join(', ')}`);
  process.exit(0);
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new Error('ANTHROPIC_API_KEY is required for the live model-catalog check.');
}

const response = await fetch('https://api.anthropic.com/v1/models?limit=100', {
  headers: {
    'anthropic-version': '2023-06-01',
    'x-api-key': apiKey,
  },
});

if (!response.ok) {
  throw new Error(`Anthropic Models API returned ${response.status}.`);
}

const payload = await response.json();
const modelIds = payload.data.map((model) => model.id);
const modelSet = new Set(modelIds);
let needsReview = false;

for (const route of requiredRoutes) {
  if (!modelSet.has(route.modelId)) {
    console.error(`::error title=Approved Anthropic route unavailable::${route.modelId} is not present in the Models API response.`);
    needsReview = true;
  }
}

for (const [family, observedId] of Object.entries(catalog.latestObserved)) {
  const newestId = modelIds.find((modelId) => modelId.startsWith(`claude-${family}`));
  if (!newestId) {
    console.warn(`::warning title=Anthropic family not returned::No ${family} model was returned by the Models API.`);
    needsReview = true;
  } else if (newestId !== observedId) {
    console.warn(`::warning title=Anthropic model catalog review::${family} changed from ${observedId} to ${newestId}. Benchmark before changing any production route.`);
    needsReview = true;
  }
}

if (needsReview) process.exit(1);
console.log(`Anthropic model catalog is current as of ${new Date().toISOString()}.`);
