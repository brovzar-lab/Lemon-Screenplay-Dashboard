const assert = require('node:assert/strict');
const test = require('node:test');

const {
  postCallAccountingUncertainResponse,
  preCallAccountingUnavailableResponse,
  upstreamInvalidRequestResponse,
} = require('../lib/llmProxyErrors');

test('pre-call and post-call accounting failures have distinct retry contracts', () => {
  const preCall = preCallAccountingUnavailableResponse();
  const postCall = postCallAccountingUncertainResponse();

  assert.equal(preCall.code, 'PRE_CALL_ACCOUNTING_UNAVAILABLE');
  assert.equal(preCall.isRetryable, true);
  assert.equal(postCall.code, 'POST_CALL_ACCOUNTING_UNCERTAIN');
  assert.equal(postCall.isRetryable, false);
  assert.equal(postCall.manualReviewRequired, true);
  assert.notEqual(preCall.code, postCall.code);
});

test('a definite upstream invalid request is non-retryable and not an accounting error', () => {
  const response = upstreamInvalidRequestResponse();

  assert.equal(response.code, 'UPSTREAM_INVALID_REQUEST');
  assert.equal(response.isRetryable, false);
  assert.match(response.error, /before model generation/);
  assert.equal(response.manualReviewRequired, undefined);
});
