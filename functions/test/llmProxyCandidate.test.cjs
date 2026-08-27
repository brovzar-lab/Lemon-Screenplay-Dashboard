const assert = require('node:assert/strict');
const test = require('node:test');

const { isolationApp, isPermissionDenied } = require('../lib/llmProxyCandidate');

test('online isolation probes recognize Firestore and Storage IAM denial codes', () => {
  assert.equal(isPermissionDenied({ code: 7 }), true);
  assert.equal(isPermissionDenied({ code: 403 }), true);
  assert.equal(isPermissionDenied({ code: 'permission-denied' }), true);
  assert.equal(isPermissionDenied({ code: 500 }), false);
});

test('staging and production probes use distinct explicit Admin SDK apps', () => {
  const staging = isolationApp('lemon-screenplay-staging');
  const production = isolationApp('lemon-screenplay-dashboard');

  assert.notEqual(staging.name, production.name);
  assert.equal(staging.options.projectId, 'lemon-screenplay-staging');
  assert.equal(production.options.projectId, 'lemon-screenplay-dashboard');
});
