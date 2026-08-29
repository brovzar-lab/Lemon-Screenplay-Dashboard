const test = require("node:test");
const assert = require("node:assert/strict");

const {
  validateAnalysisVersionAuthority,
} = require("../lib/analysisVersionAuthority");

const projectId = "project-1";
const versionId = "ab".repeat(32) + "_1000";

function version() {
  return {
    project_id: projectId,
    version_id: versionId,
    content_hash: "ab".repeat(32),
    trust_manifest: {
      integrity_sha256: "cd".repeat(32),
      analysis_payload_sha256: "ef".repeat(32),
    },
    server_trust_attestation: {
      attestation_version: "lemon-server-trust-attestation-v1",
      writer: "firebase_admin",
      project_id: projectId,
      version_id: versionId,
      content_sha256: "ab".repeat(32),
      trust_manifest_integrity_sha256: "cd".repeat(32),
      analysis_payload_sha256: "ef".repeat(32),
    },
  };
}

function authority() {
  return {
    authorityVersion: "lemon-analysis-version-authority-v1",
    writer: "firebase_admin",
    projectId,
    versionId,
    contentHash: "ab".repeat(32),
    trustManifestIntegritySha256: "cd".repeat(32),
    analysisPayloadSha256: "ef".repeat(32),
  };
}

test("only a separate matching server receipt authorizes an immutable version", () => {
  assert.doesNotThrow(() => validateAnalysisVersionAuthority(
    projectId,
    versionId,
    version(),
    authority(),
  ));
  assert.throws(() => validateAnalysisVersionAuthority(
    projectId,
    versionId,
    version(),
    {},
  ), /server authority receipt/);
  assert.throws(() => validateAnalysisVersionAuthority(
    projectId,
    versionId,
    version(),
    { ...authority(), analysisPayloadSha256: "00".repeat(32) },
  ), /server authority receipt/);
  assert.throws(() => validateAnalysisVersionAuthority(
    projectId,
    versionId,
    {
      ...version(),
      server_trust_attestation: {
        ...version().server_trust_attestation,
        writer: "browser_client",
      },
    },
    authority(),
  ), /server authority receipt/);
});
