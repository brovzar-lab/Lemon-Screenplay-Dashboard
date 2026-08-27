const assert = require('node:assert/strict');
const test = require('node:test');

const { buildAnthropicRequest, parseAnthropicMessage } = require('../lib/anthropicProxyCore');

test('shared request construction preserves the existing normal proxy payload', () => {
  const built = buildAnthropicRequest({
    model: 'claude-sonnet-4-6',
    system: [{ type: 'text', text: 'system', cache_control: { type: 'ephemeral', ttl: '1h' } }],
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 100,
    temperature: 0.1,
  }, 'service', 24_000, 16_000);

  assert.deepEqual(built.payload, {
    model: 'claude-sonnet-4-6',
    max_tokens: 100,
    messages: [{ role: 'user', content: 'hello' }],
    system: [{ type: 'text', text: 'system', cache_control: { type: 'ephemeral', ttl: '1h' } }],
    temperature: 0.1,
  });
  assert.equal(built.requestOptions.headers['anthropic-beta'], 'extended-cache-ttl-2025-04-11');
});

test('shared construction preserves browser behavior by ignoring service-only job IDs', () => {
  const built = buildAnthropicRequest({
    model: 'claude-sonnet-4-6',
    messages: [{ role: 'user', content: 'hello' }],
    job_id: 'browser-value-is-ignored',
  }, 'user', 24_000, 16_000);
  assert.equal(built.jobId, undefined);
  assert.equal('job_id' in built.payload, false);
});

test('shared response parsing keeps exact model, response, cache, and stop provenance', () => {
  const parsed = parseAnthropicMessage({
    id: 'msg_123',
    model: 'claude-sonnet-5',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'done' }],
    usage: {
      input_tokens: 10,
      output_tokens: 4,
      cache_creation_input_tokens: 2,
      cache_read_input_tokens: 3,
      cache_creation: {
        ephemeral_5m_input_tokens: 0,
        ephemeral_1h_input_tokens: 2,
      },
    },
  });
  assert.equal(parsed.responseId, 'msg_123');
  assert.equal(parsed.model, 'claude-sonnet-5');
  assert.equal(parsed.stopReason, 'end_turn');
  assert.equal(parsed.usage.cache_creation.ephemeral_1h_input_tokens, 2);
});

test('shared response parsing rejects missing required token usage', () => {
  assert.throws(() => parseAnthropicMessage({
    id: 'msg_missing_usage',
    model: 'claude-sonnet-4-6',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'done' }],
    usage: { input_tokens: 10 },
  }), /output_tokens usage/);
});
