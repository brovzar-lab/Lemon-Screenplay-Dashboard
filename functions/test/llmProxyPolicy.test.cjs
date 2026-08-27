const assert = require('node:assert/strict');
const test = require('node:test');

const {
  approvedMaxOutputTokens,
  approvedOutputConfig,
  isApprovedProxyModel,
  validateModelRequest,
} = require('../lib/llmProxyPolicy');

test('Reader Chat models are service-only while existing proxy models remain available', () => {
  assert.equal(isApprovedProxyModel('claude-opus-5', 'service'), true);
  assert.equal(isApprovedProxyModel('claude-fable-5', 'service'), true);
  assert.equal(isApprovedProxyModel('claude-sonnet-5', 'service'), true);
  assert.equal(isApprovedProxyModel('claude-opus-5', 'user'), false);
  assert.equal(isApprovedProxyModel('claude-sonnet-5', 'user'), false);
  assert.equal(isApprovedProxyModel('claude-fable-5', 'user'), false);
  assert.equal(isApprovedProxyModel('claude-opus-4-7', 'user'), true);
  assert.equal(isApprovedProxyModel('not-a-model', 'service'), false);
});

test('Sonnet 5 and Opus 5 accept adaptive thinking and effort but reject sampling', () => {
  for (const model of ['claude-sonnet-5', 'claude-opus-5']) {
    assert.deepEqual(validateModelRequest(model, 'service', {
      thinking: { type: 'adaptive' },
      tool_choice: { type: 'auto' },
      output_config: { effort: 'high' },
    }), { effort: 'high' });
    assert.throws(
      () => validateModelRequest(model, 'service', {
        thinking: { type: 'enabled', budget_tokens: 8_000 },
      }),
      /enabled thinking is not supported/,
    );
    for (const field of ['temperature', 'top_p', 'top_k']) {
      assert.throws(
        () => validateModelRequest(model, 'service', { [field]: 1 }),
        /Sampling parameters must be omitted/,
      );
    }
  }
});

test('Haiku keeps manual thinking and rejects adaptive thinking and effort', () => {
  assert.equal(validateModelRequest('claude-haiku-4-5-20251001', 'user', {
    thinking: { type: 'enabled', budget_tokens: 8_000 },
    temperature: 1,
    tool_choice: { type: 'auto' },
  }), undefined);
  assert.throws(
    () => validateModelRequest('claude-haiku-4-5-20251001', 'user', {
      thinking: { type: 'adaptive' },
    }),
    /adaptive thinking is not supported/,
  );
  assert.throws(
    () => validateModelRequest('claude-haiku-4-5-20251001', 'user', {
      output_config: { effort: 'high' },
    }),
    /Effort is not supported/,
  );
});

test('Fable uses always-on thinking and cannot be forced to a tool', () => {
  assert.deepEqual(validateModelRequest('claude-fable-5', 'service', {
    output_config: { effort: 'high' },
    tool_choice: { type: 'auto' },
  }), { effort: 'high' });
  assert.throws(
    () => validateModelRequest('claude-fable-5', 'service', {
      thinking: { type: 'adaptive' },
    }),
    /always-on thinking|adaptive thinking is not supported/,
  );
  assert.throws(
    () => validateModelRequest('claude-fable-5', 'service', {
      tool_choice: { type: 'tool', name: 'reader_private_reply' },
    }),
    /cannot force tool choice/,
  );
});

test('model output limits remain behind the conservative proxy cap', () => {
  assert.equal(approvedMaxOutputTokens('claude-haiku-4-5-20251001', 24_000), 24_000);
  assert.equal(approvedMaxOutputTokens('claude-sonnet-5', 200_000), 128_000);
  assert.throws(() => approvedMaxOutputTokens('not-a-model', 24_000), /not configured/);
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
