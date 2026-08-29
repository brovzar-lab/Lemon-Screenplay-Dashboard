const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildAnthropicRequest,
  extractAnthropicResponseEvidence,
  parseAnthropicMessage,
} = require('../lib/anthropicProxyCore');

test('shared request construction preserves the existing normal proxy payload', () => {
  const built = buildAnthropicRequest({
    model: 'claude-sonnet-4-6',
    system: [{ type: 'text', text: 'system', cache_control: { type: 'ephemeral', ttl: '1h' } }],
    messages: [{ role: 'user', content: 'hello' }],
    max_tokens: 100,
    temperature: 0.1,
  }, 'service', 24_000, 16_000, 'global');

  assert.deepEqual(built.payload, {
    model: 'claude-sonnet-4-6',
    max_tokens: 100,
    messages: [{ role: 'user', content: 'hello' }],
    inference_geo: 'global',
    service_tier: 'standard_only',
    system: [{ type: 'text', text: 'system', cache_control: { type: 'ephemeral', ttl: '1h' } }],
    temperature: 0.1,
  });
  assert.equal(built.requestOptions.headers['anthropic-beta'], 'extended-cache-ttl-2025-04-11');
});

test('Haiku omits unsupported inference geography but still pins standard service', () => {
  const built = buildAnthropicRequest({
    model: 'claude-haiku-4-5-20251001',
    messages: [{ role: 'user', content: 'hello' }],
  }, 'service', 24_000, 16_000);
  assert.equal('inference_geo' in built.payload, false);
  assert.equal(built.payload.service_tier, 'standard_only');
  assert.equal(built.providerRouting.expected_inference_geo, null);
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
      inference_geo: 'global',
      service_tier: 'standard',
    },
  }, false, 'claude-sonnet-5');
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
  }, false, 'claude-sonnet-4-6'), /output_tokens usage/);
});

test('cached responses require exact cache totals and reconciled TTL detail', () => {
  const base = {
    id: 'msg_cached',
    model: 'claude-sonnet-5',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'done' }],
    usage: {
      input_tokens: 10,
      output_tokens: 4,
      inference_geo: 'global',
      service_tier: 'standard',
    },
  };
  assert.throws(
    () => parseAnthropicMessage(base, true, 'claude-sonnet-5'),
    /cache_creation_input_tokens/,
  );
  assert.throws(
    () => parseAnthropicMessage({
      ...base,
      usage: {
        ...base.usage,
        cache_creation_input_tokens: 2,
        cache_read_input_tokens: 0,
        cache_creation: {
          ephemeral_5m_input_tokens: 1,
          ephemeral_1h_input_tokens: 0,
        },
      },
    }, true, 'claude-sonnet-5'),
    /does not reconcile/,
  );
  assert.throws(
    () => parseAnthropicMessage({
      ...base,
      usage: {
        ...base.usage,
        cache_creation_input_tokens: 2,
        cache_read_input_tokens: 0,
      },
    }, true, 'claude-sonnet-5'),
    /does not reconcile/,
  );
  const valid = parseAnthropicMessage({
    ...base,
    usage: {
      ...base.usage,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 7,
    },
  }, true, 'claude-sonnet-5');
  assert.equal(valid.usage.cache_read_input_tokens, 7);
});

test('null cache totals normalize to zero with explicit transformation telemetry', () => {
  const parsed = parseAnthropicMessage({
    id: 'msg_null_cache',
    model: 'claude-sonnet-5',
    stop_reason: 'end_turn',
    content: [],
    usage: {
      input_tokens: 2,
      output_tokens: 1,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      cache_creation: null,
      inference_geo: 'global',
      service_tier: 'standard',
    },
  }, true, 'claude-sonnet-5');
  assert.equal(parsed.usage.cache_creation_input_tokens, 0);
  assert.equal(parsed.usage.cache_read_input_tokens, 0);
  assert.deepEqual(parsed.usage.normalizations, [
    'normalized_null_cache_creation_input_tokens_to_zero',
    'normalized_null_cache_read_input_tokens_to_zero',
  ]);
});

test('returned inference geography and service tier must match the pinned request', () => {
  const response = {
    id: 'msg_route',
    model: 'claude-sonnet-5',
    stop_reason: 'end_turn',
    content: [],
    usage: {
      input_tokens: 2,
      output_tokens: 1,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      inference_geo: 'us',
      service_tier: 'standard',
    },
  };
  assert.throws(
    () => parseAnthropicMessage(response, false, 'claude-sonnet-5', 'global'),
    /geography/,
  );
  assert.throws(
    () => parseAnthropicMessage({
      ...response,
      usage: { ...response.usage, inference_geo: 'global', service_tier: 'priority' },
    }, false, 'claude-sonnet-5', 'global'),
    /service tier/,
  );
});

test('invalid cached usage still preserves privacy-safe response provenance', () => {
  const evidence = extractAnthropicResponseEvidence({
    id: 'msg_paid_but_invalid',
    model: 'claude-sonnet-5',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'screenplay-derived secret' }],
    usage: { input_tokens: 12, output_tokens: 3 },
  });
  assert.deepEqual(evidence, {
    returned_model: 'claude-sonnet-5',
    response_id: 'msg_paid_but_invalid',
    stop_reason: 'end_turn',
    provider_usage: { input_tokens: 12, output_tokens: 3 },
    provider_usage_validation: 'unverified',
  });
  assert.equal(JSON.stringify(evidence).includes('screenplay-derived secret'), false);
});
