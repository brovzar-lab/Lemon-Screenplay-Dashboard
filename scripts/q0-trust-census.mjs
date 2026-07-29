#!/usr/bin/env node
/**
 * Q0 trust census.
 *
 * READ-ONLY: inspects uploaded_analyses and each document's versions
 * subcollection. It prints aggregate counts and schema signatures only.
 * Screenplay titles, filenames, loglines, notes, and reader prose are never
 * printed.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

function loadFirebaseAdmin() {
  const candidates = [
    path.join(scriptDirectory, '..', 'node_modules'),
    path.join(scriptDirectory, '..', 'functions', 'node_modules'),
  ];

  for (const directory of candidates) {
    try {
      const requireFromDirectory = createRequire(path.join(directory, 'noop.js'));
      return {
        app: requireFromDirectory('firebase-admin/app'),
        firestore: requireFromDirectory('firebase-admin/firestore'),
      };
    } catch {
      // Try the next local dependency location.
    }
  }

  throw new Error('firebase-admin is not installed in the app or Functions package.');
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  if (isRecord(value) && typeof value.toDate === 'function') return 'timestamp';
  return typeof value;
}

function schemaSignature(data) {
  return Object.entries(data)
    .map(([key, value]) => `${key}:${valueType(value)}`)
    .sort()
    .join('|');
}

function shapeLabel(index) {
  return `shape-${String(index + 1).padStart(2, '0')}`;
}

function hasString(value) {
  return typeof value === 'string' && value.length > 0;
}

function hasFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function analysisFrom(data) {
  return isRecord(data.analysis) ? data.analysis : {};
}

function newCounters() {
  return {
    total: 0,
    analysisVersions: new Map(),
    topLevelShapes: new Map(),
    analysisShapes: new Map(),
    withAnalysis: 0,
    withContentHash: 0,
    withVerifiedIdentity: 0,
    withStoragePath: 0,
    withPromptVersion: 0,
    withParserVersion: 0,
    withCalibrationProvenance: 0,
    withRawWeightedScore: 0,
    withAdjustedScore: 0,
    adjustedDiffers: 0,
    withCriticalFailurePenalty: 0,
    withVerdictAdjustments: 0,
    withReaderReports: 0,
    readerReportCounts: new Map(),
    qualityComplete: 0,
    qualityPartial: 0,
    qualityMissing: 0,
    boundaryTriggered: 0,
    boundaryMissing: 0,
    boundarySpreads: [],
    truncated: 0,
    truncationMissing: 0,
    failedReaders: 0,
  };
}

function inspectDocument(counters, data) {
  counters.total += 1;
  increment(
    counters.analysisVersions,
    hasString(data.analysis_version) ? data.analysis_version : 'MISSING',
  );
  increment(counters.topLevelShapes, schemaSignature(data));

  const analysis = analysisFrom(data);
  if (Object.keys(analysis).length > 0) {
    counters.withAnalysis += 1;
    increment(counters.analysisShapes, schemaSignature(analysis));
  }

  if (hasString(data.content_hash) && /^[a-f0-9]{64}$/.test(data.content_hash)) {
    counters.withContentHash += 1;
  }
  if (data.identity_status === 'verified') counters.withVerifiedIdentity += 1;
  if (hasString(data.storage_path) || hasString(data._storagePath)) counters.withStoragePath += 1;
  if (hasString(data.prompt_version)) counters.withPromptVersion += 1;
  if (hasString(data.parser_version) || hasString(data.metadata?.parser_version)) {
    counters.withParserVersion += 1;
  }
  if (isRecord(data.calibration_profile) && data.calibration_profile.applied === true) {
    counters.withCalibrationProvenance += 1;
  }

  if (hasFiniteNumber(analysis.weighted_score)) counters.withRawWeightedScore += 1;
  if (hasFiniteNumber(analysis.weighted_score_adjusted)) {
    counters.withAdjustedScore += 1;
    if (
      hasFiniteNumber(analysis.weighted_score) &&
      analysis.weighted_score !== analysis.weighted_score_adjusted
    ) {
      counters.adjustedDiffers += 1;
    }
  }
  if (hasFiniteNumber(analysis.critical_failure_penalty_applied)) {
    counters.withCriticalFailurePenalty += 1;
  }
  if (Array.isArray(analysis.verdict_adjustments) && analysis.verdict_adjustments.length > 0) {
    counters.withVerdictAdjustments += 1;
  }

  if (isRecord(analysis.reader_reports)) {
    counters.withReaderReports += 1;
    increment(counters.readerReportCounts, String(Object.keys(analysis.reader_reports).length));
  }

  const quality = isRecord(analysis.analysis_quality) ? analysis.analysis_quality : null;
  if (quality?.status === 'complete') counters.qualityComplete += 1;
  else if (quality?.status === 'partial') counters.qualityPartial += 1;
  else counters.qualityMissing += 1;

  const failedReaderList = Array.isArray(quality?.failed_readers)
    ? quality.failed_readers
    : Array.isArray(analysis.failed_readers)
      ? analysis.failed_readers
      : [];
  if (failedReaderList.length > 0) counters.failedReaders += 1;

  const boundary = isRecord(analysis._boundary_reruns) ? analysis._boundary_reruns : null;
  if (boundary?.triggered === true) {
    counters.boundaryTriggered += 1;
    if (hasFiniteNumber(boundary.score_spread)) {
      counters.boundarySpreads.push(boundary.score_spread);
    }
  } else {
    counters.boundaryMissing += 1;
  }

  const truncation = isRecord(analysis._truncation) ? analysis._truncation : null;
  if (truncation?.truncated === true) counters.truncated += 1;
  if (!truncation) counters.truncationMissing += 1;
}

function printMap(label, map) {
  console.log(`${label}:`);
  if (map.size === 0) {
    console.log('  none');
    return;
  }
  for (const [key, count] of [...map.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key}: ${count}`);
  }
}

function printShapeSummary(label, map) {
  console.log(`${label}: ${map.size}`);
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([, count], index) => {
      console.log(`  ${shapeLabel(index)}: ${count} document${count === 1 ? '' : 's'}`);
    });
}

function printCounters(label, counters) {
  console.log(`\n── ${label} ──`);
  console.log(`documents: ${counters.total}`);
  printMap('analysis versions', counters.analysisVersions);
  printShapeSummary('distinct top-level shapes', counters.topLevelShapes);
  printShapeSummary('distinct analysis shapes', counters.analysisShapes);
  console.log('provenance:');
  console.log(`  analysis object: ${counters.withAnalysis}/${counters.total}`);
  console.log(`  valid content hash: ${counters.withContentHash}/${counters.total}`);
  console.log(`  verified identity: ${counters.withVerifiedIdentity}/${counters.total}`);
  console.log(`  storage pointer: ${counters.withStoragePath}/${counters.total}`);
  console.log(`  prompt version: ${counters.withPromptVersion}/${counters.total}`);
  console.log(`  parser version: ${counters.withParserVersion}/${counters.total}`);
  console.log(`  calibration provenance: ${counters.withCalibrationProvenance}/${counters.total}`);
  console.log('score lineage:');
  console.log(`  raw weighted score: ${counters.withRawWeightedScore}/${counters.total}`);
  console.log(`  adjusted score: ${counters.withAdjustedScore}/${counters.total}`);
  console.log(`  raw differs from adjusted: ${counters.adjustedDiffers}`);
  console.log(`  critical-failure penalty: ${counters.withCriticalFailurePenalty}/${counters.total}`);
  console.log(`  non-empty verdict adjustments: ${counters.withVerdictAdjustments}/${counters.total}`);
  console.log('reader quality:');
  console.log(`  reader reports: ${counters.withReaderReports}/${counters.total}`);
  printMap('  report counts', counters.readerReportCounts);
  console.log(`  complete: ${counters.qualityComplete}`);
  console.log(`  partial: ${counters.qualityPartial}`);
  console.log(`  missing quality status: ${counters.qualityMissing}`);
  console.log(`  documents with failed readers: ${counters.failedReaders}`);
  console.log('stability and completeness:');
  console.log(`  boundary reruns triggered: ${counters.boundaryTriggered}`);
  console.log(`  no boundary rerun record: ${counters.boundaryMissing}`);
  if (counters.boundarySpreads.length > 0) {
    const minSpread = Math.min(...counters.boundarySpreads);
    const maxSpread = Math.max(...counters.boundarySpreads);
    const averageSpread =
      counters.boundarySpreads.reduce((sum, value) => sum + value, 0) /
      counters.boundarySpreads.length;
    console.log(
      `  boundary score spread min/avg/max: ${minSpread.toFixed(2)} / ` +
        `${averageSpread.toFixed(2)} / ${maxSpread.toFixed(2)}`,
    );
  }
  console.log(`  explicitly truncated: ${counters.truncated}`);
  console.log(`  no truncation record: ${counters.truncationMissing}`);
}

const { app, firestore } = loadFirebaseAdmin();
const credentialPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(scriptDirectory, '..', 'service-account.json');
process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialPath;

app.initializeApp({ projectId: 'lemon-screenplay-dashboard' });
const database = firestore.getFirestore();

const parentCounters = newCounters();
const versionCounters = newCounters();
let projectsWithVersions = 0;
let projectsWithoutVersions = 0;
const immutableVersionCounts = new Map();

const parentSnapshot = await database.collection('uploaded_analyses').get();
for (const parentDocument of parentSnapshot.docs) {
  inspectDocument(parentCounters, parentDocument.data());

  const versionSnapshot = await parentDocument.ref.collection('versions').get();
  increment(immutableVersionCounts, String(versionSnapshot.size));
  if (versionSnapshot.empty) projectsWithoutVersions += 1;
  else projectsWithVersions += 1;

  for (const versionDocument of versionSnapshot.docs) {
    inspectDocument(versionCounters, versionDocument.data());
  }
}

console.log('Q0 TRUST CENSUS');
console.log('READ-ONLY aggregate output. No screenplay content or titles printed.');
console.log(`projects with immutable versions: ${projectsWithVersions}`);
console.log(`projects without immutable versions: ${projectsWithoutVersions}`);
printMap('immutable version count per project', immutableVersionCounts);
printCounters('LATEST PARENT PROJECTIONS', parentCounters);
printCounters('IMMUTABLE VERSION DOCUMENTS', versionCounters);
