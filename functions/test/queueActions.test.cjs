const test = require("node:test");
const assert = require("node:assert/strict");

const { canRetryQueueJob } = require("../lib/queueActions.js");

test("temporary analysis failures remain retryable", () => {
  assert.equal(canRetryQueueJob({ status: "failed" }), true);
});

test("terminal queue failures cannot be retried", () => {
  assert.equal(
    canRetryQueueJob({ status: "failed", retryable: false }),
    false,
  );
});
