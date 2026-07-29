const test = require("node:test");
const assert = require("node:assert/strict");

const {
  TRUST_CONTRACT_VERSION,
  buildTrustCapability,
} = require("../lib/llmProxyCapability");

test("the free proxy preflight advertises the immutable response contract", () => {
  assert.deepEqual(buildTrustCapability(), {
    service: "llmProxy",
    trust_contract_version: TRUST_CONTRACT_VERSION,
    response_id_supported: true,
  });
  assert.equal(TRUST_CONTRACT_VERSION, "lemon-trust-manifest-v1");
});
