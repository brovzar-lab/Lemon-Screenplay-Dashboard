const assert = require('node:assert/strict');
const test = require('node:test');
const Anthropic = require('@anthropic-ai/sdk');

const {
  createAnthropicClient,
  finalMessageWithUncertainSpendProtection,
} = require('../lib/anthropicClient');

test('Anthropic SDK retries are disabled so one reservation means one attempt', () => {
  const client = createAnthropicClient('test-api-key');

  assert.equal(client.maxRetries, 0);
});

test('a partial stream failure invokes conservative accounting before it escapes', async () => {
  let partialOutput = '';
  let accountedReason = '';
  let releasedReason = '';

  await assert.rejects(
    finalMessageWithUncertainSpendProtection(
      async () => {
        partialOutput = 'partial model output';
        throw new Error('stream disconnected');
      },
      async (reason) => {
        accountedReason = reason;
      },
      async (reason) => {
        releasedReason = reason;
      },
    ),
    /stream disconnected/,
  );

  assert.equal(partialOutput, 'partial model output');
  assert.equal(accountedReason, 'stream disconnected');
  assert.equal(releasedReason, '');
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
