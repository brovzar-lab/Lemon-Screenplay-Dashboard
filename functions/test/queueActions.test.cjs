const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canDismissQueueJob,
  canRetryQueueJob,
} = require("../lib/queueActions.js");

test("temporary analysis failures remain retryable", () => {
  assert.equal(canRetryQueueJob({ status: "failed" }), true);
});

test("terminal queue failures cannot be retried", () => {
  assert.equal(
    canRetryQueueJob({ status: "failed", retryable: false }),
    false,
  );
});

test("evidence review jobs can be dismissed but not retried", () => {
  const job = { status: "needs_review", retryable: false };
  assert.equal(canRetryQueueJob(job), false);
  assert.equal(canDismissQueueJob(job), true);
});
