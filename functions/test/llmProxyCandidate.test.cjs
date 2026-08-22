const assert = require('node:assert/strict');
const test = require('node:test');

const { isPermissionDenied } = require('../lib/llmProxyCandidate');

test('online isolation probes recognize Firestore and Storage IAM denial codes', () => {
  assert.equal(isPermissionDenied({ code: 7 }), true);
  assert.equal(isPermissionDenied({ code: 403 }), true);
  assert.equal(isPermissionDenied({ code: 'permission-denied' }), true);
  assert.equal(isPermissionDenied({ code: 500 }), false);
});
