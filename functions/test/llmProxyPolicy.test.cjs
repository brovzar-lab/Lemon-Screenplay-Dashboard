const assert = require('node:assert/strict');
const test = require('node:test');

const {
  approvedOutputConfig,
  isApprovedProxyModel,
} = require('../lib/llmProxyPolicy');

test('Reader Chat models are service-only while existing proxy models remain available', () => {
  assert.equal(isApprovedProxyModel('claude-opus-5', 'service'), true);
  assert.equal(isApprovedProxyModel('claude-fable-5', 'service'), true);
  assert.equal(isApprovedProxyModel('claude-opus-5', 'user'), false);
  assert.equal(isApprovedProxyModel('claude-fable-5', 'user'), false);
  assert.equal(isApprovedProxyModel('claude-opus-4-7', 'user'), true);
  assert.equal(isApprovedProxyModel('not-a-model', 'service'), false);
});

test('output_config forwards only one approved effort field', () => {
  assert.deepEqual(approvedOutputConfig({ effort: 'high' }), { effort: 'high' });
  assert.throws(
    () => approvedOutputConfig({ effort: 'high', hidden_override: true }),
    /unsupported fields/,
  );
  assert.throws(() => approvedOutputConfig(null), /must be an object/);
  assert.throws(() => approvedOutputConfig({ effort: 'turbo' }), /Unsupported effort/);
});
