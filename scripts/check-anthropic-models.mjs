import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const catalogUrl = new URL('../src/config/anthropic-model-catalog.json', import.meta.url);
const families = ['haiku', 'sonnet', 'opus', 'fable'];

export function selectNewestFamilyModel(models, family) {
  return (
    models
      .filter(
        (model) =>
          typeof model?.id === 'string' &&
          model.id.startsWith(`claude-${family}`) &&
          typeof model.created_at === 'string',
      )
      .sort((left, right) => {
        const createdDifference = Date.parse(right.created_at) - Date.parse(left.created_at);
        return createdDifference || right.id.localeCompare(left.id);
      })[0] ?? null
  );
}

export function buildCatalogUpdate(catalog, models, verifiedAt) {
  const latestObserved = { ...catalog.latestObserved };
  const changes = [];
  const missingFamilies = [];

  for (const family of families) {
    const newest = selectNewestFamilyModel(models, family);
    if (!newest) {
      missingFamilies.push(family);
      continue;
    }
    if (latestObserved[family] !== newest.id) {
      changes.push({ family, previous: latestObserved[family], current: newest.id });
      latestObserved[family] = newest.id;
    }
  }

  return {
    catalog: changes.length ? { ...catalog, verifiedAt, latestObserved } : catalog,
    changes,
    missingFamilies,
  };
}

function validateCatalog(catalog) {
  if (
    catalog.schemaVersion !== 2
    || !catalog.verifiedAt
    || !Array.isArray(catalog.sources)
    || catalog.sources.length < 3
  ) {
    throw new Error('Anthropic model catalog is missing its version, verification date, or sources.');
  }

  const requiredRoutes = [
    ...Object.values(catalog.analysisRoutes),
    ...Object.values(catalog.interactiveRoutes),
  ];
  for (const route of requiredRoutes) {
    if (!route.modelId || !route.displayName || !route.status) {
      throw new Error('Anthropic model catalog contains an incomplete approved route.');
    }
  }
  for (const family of ['sonnet', 'opus']) {
    const route = catalog.candidateAnalysisRoutes?.[family];
    if (!route?.modelId || route.status !== 'awaiting_benchmark') {
      throw new Error(`Anthropic model catalog contains an incomplete ${family} candidate route.`);
    }
  }
  for (const route of Object.values(catalog.historicalModels ?? {})) {
    if (!route.modelId || route.status !== 'historical_read_only') {
      throw new Error('Anthropic model catalog contains an invalid historical model.');
    }
  }
  for (const [modelId, profile] of Object.entries(catalog.modelProfiles ?? {})) {
    if (
      !modelId.startsWith('claude-')
      || !profile.alias
      || !Number.isInteger(profile.contextTokens)
      || !Number.isInteger(profile.maxOutputTokens)
      || typeof profile.inputUsdPerMillion !== 'number'
      || typeof profile.outputUsdPerMillion !== 'number'
    ) {
      throw new Error(`Anthropic model catalog contains an incomplete profile for ${modelId}.`);
    }
  }
  return requiredRoutes;
}

async function main() {
  const catalog = JSON.parse(await readFile(fileURLToPath(catalogUrl), 'utf8'));
  const requiredRoutes = validateCatalog(catalog);

  if (process.argv.includes('--offline')) {
    console.log(`Catalog verified: ${catalog.verifiedAt}`);
    console.log(
      `Approved analysis routes: ${Object.values(catalog.analysisRoutes)
        .map((route) => route.modelId)
        .join(', ')}`,
    );
    console.log(
      `Approved Reader Chat routes: ${Object.values(catalog.interactiveRoutes)
        .map((route) => route.modelId)
        .join(', ')}`,
    );
    console.log(
      `Benchmark-pending candidates: ${Object.values(catalog.candidateAnalysisRoutes)
        .flatMap((route) => [route.modelId, route.sonnetModelId, route.opusModelId])
        .filter(Boolean)
        .filter((modelId, index, values) => values.indexOf(modelId) === index)
        .join(', ')}`,
    );
    console.log(
      `Historical read-only models: ${Object.values(catalog.historicalModels ?? {})
        .map((route) => route.modelId)
        .join(', ') || 'none'}`,
    );
    return;
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
  if (!response.ok) throw new Error(`Anthropic Models API returned ${response.status}.`);

  const payload = await response.json();
  if (!Array.isArray(payload.data)) throw new Error('Anthropic Models API returned invalid data.');

  const modelIds = new Set(payload.data.map((model) => model.id));
  const unavailableRoutes = requiredRoutes.filter((route) => !modelIds.has(route.modelId));
  for (const route of unavailableRoutes) {
    console.error(
      `::error title=Approved Anthropic route unavailable::${route.modelId} is not present in the Models API response.`,
    );
  }

  const verifiedAt = new Date().toISOString().slice(0, 10);
  const update = buildCatalogUpdate(catalog, payload.data, verifiedAt);
  for (const family of update.missingFamilies) {
    console.error(
      `::error title=Anthropic family not returned::No ${family} model with created_at was returned by the Models API.`,
    );
  }

  if (unavailableRoutes.length || update.missingFamilies.length) {
    process.exitCode = 1;
    return;
  }

  if (!update.changes.length) {
    console.log(`Anthropic model catalog is current as of ${new Date().toISOString()}.`);
    return;
  }

  for (const change of update.changes) {
    console.log(`${change.family}: ${change.previous} -> ${change.current}`);
  }

  if (!process.argv.includes('--write-observed')) {
    console.warn(
      '::warning title=Anthropic model catalog review::Newer models are available. Run with --write-observed to prepare a reviewable catalog update.',
    );
    process.exitCode = 1;
    return;
  }

  await writeFile(fileURLToPath(catalogUrl), `${JSON.stringify(update.catalog, null, 2)}\n`);
  console.log('Updated latestObserved only. Approved production routes are unchanged.');
}

const isDirectRun = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
