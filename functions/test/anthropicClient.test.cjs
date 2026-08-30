const assert = require('node:assert/strict');
const test = require('node:test');
const Anthropic = require('@anthropic-ai/sdk');

const {
  createAnthropicClient,
  finalMessageWithUncertainSpendProtection,
  safeAnthropicFailureMetadata,
} = require('../lib/anthropicClient');

test('Anthropic SDK retries are disabled so one reservation means one attempt', () => {
  const client = createAnthropicClient('test-api-key');

  assert.equal(client.maxRetries, 0);
});

test('a partial stream failure invokes conservative accounting before it escapes', async () => {
  let partialOutput = '';
  let accountedReason = '';
  let accountedError;
  let releasedReason = '';

  await assert.rejects(
    finalMessageWithUncertainSpendProtection(
      async () => {
        partialOutput = 'partial model output';
        throw new Error('stream disconnected');
      },
      async (reason, error) => {
        accountedReason = reason;
        accountedError = error;
      },
      async (reason) => {
        releasedReason = reason;
      },
    ),
    /stream disconnected/,
  );

  assert.equal(partialOutput, 'partial model output');
  assert.equal(accountedReason, 'stream disconnected');
  assert.equal(accountedError.message, 'stream disconnected');
  assert.equal(releasedReason, '');
});

test('typed provider failures become finite credential-safe diagnostics', () => {
  const timeout = new Anthropic.APIConnectionTimeoutError({
    message: 'PRIVATE_SCREENPLAY_SENTINEL sk-ant-secret',
  });
  assert.deepEqual(safeAnthropicFailureMetadata(timeout), {
    provider_error_class: 'APIConnectionTimeoutError',
    provider_http_status: null,
    provider_error_type: 'connection_timeout',
    provider_request_id: null,
    provider_transport_detail: 'request_timeout',
    provider_failure_summary: (
      'Anthropic provider failure: class=APIConnectionTimeoutError; '
      + 'status=none; type=connection_timeout; detail=request_timeout; '
      + 'request_id=unavailable.'
    ),
  });
  assert.equal(
    JSON.stringify(safeAnthropicFailureMetadata(timeout))
      .includes('PRIVATE_SCREENPLAY_SENTINEL'),
    false,
  );
  assert.equal(
    safeAnthropicFailureMetadata(timeout, 'req_011CeYStreamProof123')
      .provider_request_id,
    'req_011CeYStreamProof123',
  );
});

test('provider HTTP failures retain status, type, and request ID without raw text', () => {
  const body = {
    type: 'error',
    error: { type: 'overloaded_error', message: 'PRIVATE_PROVIDER_TEXT' },
    request_id: 'req_011CeYProviderProof123',
  };
  const failure = Anthropic.APIError.generate(
    529,
    body,
    body.error.message,
    new Headers({ 'request-id': body.request_id }),
  );
  const metadata = safeAnthropicFailureMetadata(failure);
  assert.equal(metadata.provider_error_class, 'InternalServerError');
  assert.equal(metadata.provider_http_status, 529);
  assert.equal(metadata.provider_error_type, 'overloaded_error');
  assert.equal(metadata.provider_request_id, body.request_id);
  assert.equal(metadata.provider_transport_detail, 'provider_http_error');
  assert.equal(JSON.stringify(metadata).includes('PRIVATE_PROVIDER_TEXT'), false);

  const tooLarge = Anthropic.APIError.generate(
    413,
    { error: { type: 'request_too_large', message: 'PRIVATE_PROVIDER_TEXT' } },
    'PRIVATE_PROVIDER_TEXT',
    new Headers({ 'request-id': 'req_011CeYTooLargeProof123' }),
  );
  assert.equal(
    safeAnthropicFailureMetadata(tooLarge).provider_error_type,
    'request_too_large',
  );
});

test('untyped errors cannot forge provider HTTP provenance', () => {
  const error = Object.assign(new Error('PRIVATE_PROVIDER_TEXT'), {
    status: 529,
    error: { error: { type: 'overloaded_error' } },
    requestID: 'req_011CeYForgedProof123',
  });
  const metadata = safeAnthropicFailureMetadata(error);
  assert.equal(metadata.provider_error_class, 'Error');
  assert.equal(metadata.provider_http_status, null);
  assert.equal(metadata.provider_error_type, 'unknown_provider_error');
  assert.equal(metadata.provider_request_id, null);
  assert.equal(metadata.provider_transport_detail, 'unknown_transport_error');
  assert.equal(JSON.stringify(metadata).includes('PRIVATE_PROVIDER_TEXT'), false);
});

test('a timeout after dispatch is uncertain and never releases the reservation', async () => {
  let accounted = 0;
  let released = 0;
  const timeout = Object.assign(new Error('socket timed out'), { code: 'ETIMEDOUT' });
  await assert.rejects(
    finalMessageWithUncertainSpendProtection(
      async () => { throw timeout; },
      async () => { accounted += 1; },
      async () => { released += 1; },
    ),
    /timed out/,
  );
  assert.equal(accounted, 1);
  assert.equal(released, 0);
});

test('a definite Anthropic invalid request releases the reservation without charging', async () => {
  let accountedReason = '';
  let releasedReason = '';
  const responseBody = {
    type: 'error',
    error: {
      type: 'invalid_request_error',
      message: 'The compiled grammar is too large',
    },
  };
  const rejection = Anthropic.APIError.generate(
    400,
    responseBody,
    responseBody.error.message,
    new Headers({ 'request-id': 'req_invalid_schema' }),
  );

  assert.equal(rejection.type, undefined);
  assert.equal(rejection.error.error.type, 'invalid_request_error');

  await assert.rejects(
    finalMessageWithUncertainSpendProtection(
      async () => {
        throw rejection;
      },
      async (reason) => {
        accountedReason = reason;
      },
      async (reason) => {
        releasedReason = reason;
      },
    ),
    /compiled grammar is too large/,
  );

  assert.equal(accountedReason, '');
  assert.match(releasedReason, /The compiled grammar is too large/);
});
