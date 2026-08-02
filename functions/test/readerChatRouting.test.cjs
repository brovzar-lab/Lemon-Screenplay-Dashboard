const assert = require('node:assert/strict');
const test = require('node:test');

const {
  READER_CHAT_DEFAULT_CHOICE,
  READER_CHAT_EFFORT,
  READER_CHAT_MODEL,
  READER_CHAT_MODELS,
} = require('../lib/modelRegistry');
const {
  initialReaderChatRoute,
  executeReaderChatRoute,
  objectiveFallbackRoute,
  parseReaderChatModelChoice,
  ReaderChatAttemptFailure,
  ReaderChatRoutingFailure,
} = require('../lib/readerChatRouting');

test('Reader Chat defaults to Opus 5 at explicit high effort', () => {
  assert.equal(READER_CHAT_DEFAULT_CHOICE, 'auto');
  assert.equal(READER_CHAT_MODEL, 'claude-opus-5');
  assert.equal(READER_CHAT_EFFORT, 'high');
  assert.deepEqual(initialReaderChatRoute(parseReaderChatModelChoice(undefined)), {
    requestedChoice: 'auto',
    modelId: 'claude-opus-5',
    effort: 'high',
    reason: 'auto_default_opus',
  });
});

test('producer selections are exact and a deep review always uses Fable', () => {
  assert.equal(initialReaderChatRoute('opus').modelId, READER_CHAT_MODELS.opus);
  assert.equal(initialReaderChatRoute('fable').modelId, READER_CHAT_MODELS.fable);
  assert.equal(initialReaderChatRoute('auto', true).reason, 'producer_deep_review');
  assert.equal(initialReaderChatRoute('auto', true).modelId, READER_CHAT_MODELS.fable);
  assert.throws(() => parseReaderChatModelChoice('cheapest'), /not recognized/);
});

test('Auto falls back only for objective safe failures', () => {
  assert.equal(objectiveFallbackRoute('auto', 'refusal').modelId, READER_CHAT_MODELS.fable);
  assert.equal(
    objectiveFallbackRoute('auto', 'invalid_grounded_answer').reason,
    'objective_fallback_invalid_grounded_answer',
  );
  assert.equal(objectiveFallbackRoute('opus', 'refusal'), null);
  assert.equal(objectiveFallbackRoute('auto', 'budget_exceeded'), null);
  assert.equal(objectiveFallbackRoute('auto', 'accounting_uncertain'), null);
  assert.equal(objectiveFallbackRoute('auto', 'invalid_request'), null);
  assert.equal(objectiveFallbackRoute('auto', 'unknown'), null);
});

test('Auto retries exactly once after refusal and preserves both paid attempts', async () => {
  const calls = [];
  const result = await executeReaderChatRoute({
    choice: 'auto',
    attempt: async (route) => {
      calls.push(route.modelId);
      if (calls.length === 1) {
        throw new ReaderChatAttemptFailure(
          'Opus declined.',
          'refusal',
          {
            modelId: route.modelId,
            outcome: 'failed',
            failureReason: 'refusal',
            responseId: 'opus-response',
            usage: { actual_cost_usd: 0.21 },
          },
          422,
        );
      }
      return {
        value: 'grounded answer',
        attempt: {
          modelId: route.modelId,
          outcome: 'success',
          responseId: 'fable-response',
          usage: { actual_cost_usd: 0.44 },
        },
      };
    },
  });

  assert.deepEqual(calls, [READER_CHAT_MODELS.opus, READER_CHAT_MODELS.fable]);
  assert.equal(result.route.reason, 'objective_fallback_refusal');
  assert.equal(result.attempts.length, 2);
  assert.equal(
    result.attempts.reduce((sum, attempt) => sum + (attempt.usage?.actual_cost_usd ?? 0), 0),
    0.65,
  );
});

test('uncertain accounting never retries and returns its append-only audit payload', async () => {
  let callCount = 0;
  await assert.rejects(
    executeReaderChatRoute({
      choice: 'auto',
      attempt: async (route) => {
        callCount += 1;
        throw new ReaderChatAttemptFailure(
          'Accounting is uncertain.',
          'accounting_uncertain',
          {
            modelId: route.modelId,
            outcome: 'failed',
            failureReason: 'accounting_uncertain',
          },
          503,
        );
      },
    }),
    (error) => {
      assert.ok(error instanceof ReaderChatRoutingFailure);
      assert.equal(error.attempts.length, 1);
      assert.equal(error.failureReason, 'accounting_uncertain');
      return true;
    },
  );
  assert.equal(callCount, 1);
});

test('a failed Fable fallback returns both attempts for durable auditing', async () => {
  let callCount = 0;
  await assert.rejects(
    executeReaderChatRoute({
      choice: 'auto',
      attempt: async (route) => {
        callCount += 1;
        throw new ReaderChatAttemptFailure(
          callCount === 1 ? 'Invalid grounded answer.' : 'Fable also failed.',
          callCount === 1 ? 'invalid_grounded_answer' : 'accounting_uncertain',
          {
            modelId: route.modelId,
            outcome: 'failed',
            failureReason: callCount === 1 ? 'invalid_grounded_answer' : 'accounting_uncertain',
            responseId: callCount === 1 ? 'opus-response' : undefined,
            usage: callCount === 1 ? { actual_cost_usd: 0.18 } : undefined,
          },
          callCount === 1 ? 422 : 503,
        );
      },
    }),
    (error) => {
      assert.ok(error instanceof ReaderChatRoutingFailure);
      assert.equal(error.attempts.length, 2);
      assert.equal(error.route.modelId, READER_CHAT_MODELS.fable);
      return true;
    },
  );
  assert.equal(callCount, 2);
});
