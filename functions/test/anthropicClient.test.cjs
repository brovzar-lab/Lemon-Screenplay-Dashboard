const assert = require('node:assert/strict');
const test = require('node:test');

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
  const rejection = Object.assign(
    new Error('The compiled grammar is too large'),
    {
      status: 400,
      type: 'invalid_request_error',
    },
  );

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
  assert.equal(releasedReason, 'The compiled grammar is too large');
});
