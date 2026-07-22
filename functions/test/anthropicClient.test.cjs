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

  await assert.rejects(
    finalMessageWithUncertainSpendProtection(
      async () => {
        partialOutput = 'partial model output';
        throw new Error('stream disconnected');
      },
      async (reason) => {
        accountedReason = reason;
      },
    ),
    /stream disconnected/,
  );

  assert.equal(partialOutput, 'partial model output');
  assert.equal(accountedReason, 'stream disconnected');
});
