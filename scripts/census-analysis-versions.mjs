#!/usr/bin/env node
/**
 * census-analysis-versions.mjs — READ-ONLY Firestore census
 *
 * Streams every doc in `uploaded_analyses` and tallies:
 *   1. analysis_version values (including "MISSING" for docs without one)
 *   2. presence of v7_meta vs v9_meta fields
 *   3. soft-deleted (_deleted_at) and quarantined docs per version
 *
 * Prints a summary table only — never document contents, never writes.
 *
 * Usage (from repo root or worktree):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *     node --experimental-vm-modules scripts/census-analysis-versions.mjs
 *
 * firebase-admin is resolved from functions/node_modules if not hoisted:
 *   NODE_PATH=functions/node_modules node scripts/census-analysis-versions.mjs
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadAdmin() {
  const candidates = [
    path.join(__dirname, '..', 'node_modules'),
    path.join(__dirname, '..', 'functions', 'node_modules'),
    // Main checkout fallback when running from a worktree
    '/Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD/functions/node_modules',
  ];
  for (const dir of candidates) {
    try {
      const req = createRequire(path.join(dir, 'noop.js'));
      return {
        app: req('firebase-admin/app'),
        firestore: req('firebase-admin/firestore'),
      };
    } catch {
      /* try next */
    }
  }
  throw new Error('firebase-admin not found in any node_modules candidate');
}

const { app, firestore } = loadAdmin();

const credPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  '/Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD/service-account.json';
process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;

app.initializeApp({ projectId: 'lemon-screenplay-dashboard' });
const db = firestore.getFirestore();

const versionCounts = new Map();
const metaCounts = { v7_meta: 0, v9_meta: 0, both: 0, neither: 0 };
let total = 0;
let deleted = 0;
let quarantined = 0;

// Stream in pages of 300 ordered by document ID — read-only.
let last = null;
for (;;) {
  let q = db.collection('uploaded_analyses').orderBy('__name__').limit(300);
  if (last) q = q.startAfter(last);
  const snap = await q.get();
  if (snap.empty) break;

  for (const doc of snap.docs) {
    total += 1;
    const d = doc.data();
    const v = typeof d.analysis_version === 'string' ? d.analysis_version : 'MISSING';
    versionCounts.set(v, (versionCounts.get(v) ?? 0) + 1);

    const has7 = 'v7_meta' in d;
    const has9 = 'v9_meta' in d;
    if (has7 && has9) metaCounts.both += 1;
    else if (has7) metaCounts.v7_meta += 1;
    else if (has9) metaCounts.v9_meta += 1;
    else metaCounts.neither += 1;

    if (d._deleted_at) deleted += 1;
    if (d._quarantined || d._quarantine_reason) quarantined += 1;
  }

  last = snap.docs[snap.docs.length - 1];
  if (snap.size < 300) break;
}

console.log('── uploaded_analyses census (read-only) ──────────────────');
console.log(`total docs: ${total}  (soft-deleted: ${deleted}, quarantined: ${quarantined})`);
console.log('\nanalysis_version:');
for (const [v, n] of [...versionCounts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${v.padEnd(20)} ${n}`);
}
console.log('\nmeta fields:');
console.log(`  v9_meta only:  ${metaCounts.v9_meta}`);
console.log(`  v7_meta only:  ${metaCounts.v7_meta}`);
console.log(`  both:          ${metaCounts.both}`);
console.log(`  neither:       ${metaCounts.neither}`);
console.log('───────────────────────────────────────────────────────────');
