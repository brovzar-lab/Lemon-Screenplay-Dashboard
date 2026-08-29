const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildShareAuthorityRecord,
  buildSharedViewRecord,
  resolveAuthoritativeShare,
} = require("../lib/shareCore");

const contentHash = "ab".repeat(32);
const manifestHash = "cd".repeat(32);
const analysisHash = "ef".repeat(32);
const versionId = `${contentHash}_1000`;
const readers = ["structure", "character", "craft_scene", "concept", "emotional_resonance"];

function sealedVersion() {
  return {
    project_id: "project-1",
    version_id: versionId,
    source_file: "Guión Ñ.pdf",
    content_hash: contentHash,
    identity_status: "verified",
    analysis_version: "v9_archaeology",
    analysis_model: "claude-sonnet-5",
    trust_manifest_version: "lemon-trust-manifest-v6",
    server_trust_attestation: {
      attestation_version: "lemon-server-trust-attestation-v1",
      writer: "firebase_admin",
      project_id: "project-1",
      version_id: versionId,
      content_sha256: contentHash,
      trust_manifest_integrity_sha256: manifestHash,
      analysis_payload_sha256: analysisHash,
    },
    trust_manifest: {
      manifest_version: "lemon-trust-manifest-v6",
      integrity_sha256: manifestHash,
      analysis_payload_sha256: analysisHash,
      source: {
        content_sha256: contentHash,
        source_file: "Guión Ñ.pdf",
        storage_path: "gs://private-bucket/screenplays/project-1/version.pdf",
      },
      origin: {
        project_id: "project-1",
        version_id: versionId,
        id: "private-queue-job",
      },
      engine: { analysis_version: "v9_archaeology" },
      readers: {
        quality_status: "complete",
        expected_specialist_readers: 5,
        completed_specialist_readers: 5,
        failed_readers: [],
        report_names: readers,
      },
      claim_verification: {
        status: "passed_independent_model_review",
        verification_scope: "semantic_support_against_full_physical_page_source",
        claim_count: 10,
        factual_support_rate: 1,
        response_ids: ["msg_claims"],
        claims_sha256: "12".repeat(32),
      },
      models: {
        calls: [
          { response_id: "msg_genre", stage: "genre_detection" },
          {
            response_id: "msg_reader",
            stage: "reader",
            exact_cost_microusd: 12345,
            unexpected_private_payload: "SYNTHETIC-SECRET-MARKER",
          },
        ],
      },
      usage: {
        failed_calls: [{
          rejected_artifact_path: "/private/tmp/rejected.json",
          unexpected_private_payload: "SYNTHETIC-SECRET-MARKER",
        }],
      },
      score_lineage: { adjusted_score: 7.25, final_verdict: "RECOMMEND" },
    },
    analysis: {
      title: "Guión Ñ",
      weighted_score: 7.5,
      weighted_score_adjusted: 7.25,
      verdict: "RECOMMEND",
      analysis_quality: {
        status: "complete",
        expected_readers: 5,
        completed_readers: 5,
        failed_readers: [],
      },
      reader_reports: Object.fromEntries(readers.map((name) => [name, {
        pillar_score: 7,
        unexpected_private_payload: "SYNTHETIC-SECRET-MARKER",
      }])),
      _claim_verification: {
        claims: [{
          citation_evidence: [{
            excerpt: "SYNTHETIC-SECRET-MARKER exact screenplay dialogue",
          }],
        }],
      },
      unexpected_private_payload: "SYNTHETIC-SECRET-MARKER",
      pillar_scores: Object.fromEntries(readers.map((name) => [name, { score: 7 }])),
    },
  };
}

function versionAuthority(version = sealedVersion()) {
  return {
    authorityVersion: "lemon-analysis-version-authority-v1",
    writer: "firebase_admin",
    projectId: "project-1",
    versionId,
    contentHash: version.content_hash,
    trustManifestIntegritySha256: version.trust_manifest.integrity_sha256,
    analysisPayloadSha256: version.trust_manifest.analysis_payload_sha256,
  };
}

test("trusted shares are server-authored from the exact current immutable version", () => {
  const record = buildSharedViewRecord({
    projectId: "project-1",
    versionId,
    screenplayId: "Guión Ñ.pdf",
    parent: {
      latest_version_id: versionId,
      poster_version_id: versionId,
      poster_url: "https://example.test/poster.jpg",
    },
    version: sealedVersion(),
    versionAuthority: versionAuthority(),
    includeNotes: true,
    notes: [{ content: "Producer note", createdAt: "2026-08-28T12:00:00Z" }],
    now: new Date("2026-08-28T12:00:00Z"),
    token: "share-token",
  });

  assert.equal(record.token, "share-token");
  assert.equal(record.screenplayId, "Guión Ñ.pdf");
  assert.equal(record.posterUrl, "https://example.test/poster.jpg");
  assert.equal(record.analysis, undefined);
  assert.equal(record.sealedVersion.analysis.title, "Guión Ñ");
  assert.equal(record.sealedVersion.analysis.weighted_score_adjusted, 7.25);
  assert.equal(record.sealedVersion.analysis.reader_reports, undefined);
  assert.equal(record.sealedVersion.analysis._claim_verification, undefined);
  assert.equal(record.sealedVersion.analysis.unexpected_private_payload, undefined);
  assert.equal(
    record.sealedVersion.trust_manifest.manifest_version,
    "lemon-public-share-manifest-v1",
  );
  assert.equal(
    record.sealedVersion.trust_manifest.canonical_manifest_integrity_sha256,
    manifestHash,
  );
  assert.equal(
    record.sealedVersion.trust_manifest.canonical_analysis_payload_sha256,
    analysisHash,
  );
  assert.match(
    record.sealedVersion.trust_manifest.analysis_payload_sha256,
    /^[a-f0-9]{64}$/,
  );
  assert.equal(record.sealedVersion.trust_manifest.models.call_count, 2);
  assert.match(record.sealedVersion.trust_manifest.models.provenance_sha256, /^[a-f0-9]{64}$/);
  assert.equal(
    record.sealedVersion.server_trust_attestation.attestation_version,
    "lemon-public-share-attestation-v1",
  );
  const publicPayload = JSON.stringify(record);
  assert.doesNotMatch(publicPayload, /SYNTHETIC-SECRET-MARKER/);
  assert.doesNotMatch(publicPayload, /private-queue-job/);
  assert.doesNotMatch(publicPayload, /private-bucket/);
  assert.doesNotMatch(publicPayload, /rejected\.json/);
  assert.doesNotMatch(publicPayload, /12345/);
  assert.deepEqual(record.notes, [{
    content: "Producer note",
    createdAt: "2026-08-28T12:00:00Z",
  }]);
});

test("trusted shares reject stale or self-declared analysis versions", () => {
  assert.throws(() => buildSharedViewRecord({
    projectId: "project-1",
    versionId,
    screenplayId: "script.pdf",
    parent: { latest_version_id: "older" },
    version: sealedVersion(),
    versionAuthority: versionAuthority(),
    includeNotes: false,
  }), /current immutable/);

  const forged = sealedVersion();
  delete forged.server_trust_attestation;
  assert.throws(() => buildSharedViewRecord({
    projectId: "project-1",
    versionId,
    screenplayId: "script.pdf",
    parent: { latest_version_id: versionId },
    version: forged,
    versionAuthority: versionAuthority(forged),
    includeNotes: false,
  }), /server authority receipt/);

  assert.throws(() => buildSharedViewRecord({
    projectId: "project-1",
    versionId,
    screenplayId: "script.pdf",
    parent: { latest_version_id: versionId },
    version: sealedVersion(),
    versionAuthority: {},
    includeNotes: false,
  }), /server authority receipt/);
});

test("public localization is exact-version and changes the bound public payload hash", () => {
  const version = sealedVersion();
  version.localized_analysis = {
    es: {
      sourceVersionId: versionId,
      generatedAt: "2026-08-28T12:00:00Z",
      model: "claude-sonnet-4-6",
      content: {
        strengths: ["Fortaleza original"],
        readerReports: [{
          reader: "structure",
          oneSentenceVerdict: "SYNTHETIC-SECRET-MARKER",
        }],
        unexpected_private_payload: "SYNTHETIC-SECRET-MARKER",
      },
    },
  };
  const build = (candidate) => buildSharedViewRecord({
    projectId: "project-1",
    versionId,
    screenplayId: "Guión Ñ.pdf",
    parent: { latest_version_id: versionId },
    version: candidate,
    versionAuthority: versionAuthority(candidate),
    includeNotes: false,
  });

  const first = build(version);
  assert.deepEqual(
    first.sealedVersion.localized_analysis.es.content.strengths,
    ["Fortaleza original"],
  );
  assert.doesNotMatch(JSON.stringify(first), /SYNTHETIC-SECRET-MARKER/);
  assert.equal(
    first.sealedVersion.trust_manifest.public_payload_scope,
    "analysis_and_localized_analysis",
  );

  const changed = structuredClone(version);
  changed.localized_analysis.es.content.strengths = ["Fortaleza revisada"];
  const second = build(changed);
  assert.notEqual(
    first.sealedVersion.trust_manifest.analysis_payload_sha256,
    second.sealedVersion.trust_manifest.analysis_payload_sha256,
  );

  const stale = structuredClone(version);
  stale.localized_analysis.es.sourceVersionId = "older-version";
  assert.equal(build(stale).sealedVersion.localized_analysis, undefined);
});

test("public resolution requires the paired server-only authority receipt", () => {
  const version = sealedVersion();
  const parent = { latest_version_id: versionId };
  const record = buildSharedViewRecord({
    projectId: "project-1",
    versionId,
    screenplayId: "Guión Ñ.pdf",
    parent,
    version,
    versionAuthority: versionAuthority(version),
    includeNotes: false,
    now: new Date("2026-08-28T12:00:00Z"),
    token: "share-token",
  });
  const authority = buildShareAuthorityRecord({
    record,
    projectId: "project-1",
    versionId,
    version,
  });

  const resolved = resolveAuthoritativeShare({
    token: "share-token",
    share: record,
    authority,
    parent,
    version,
    versionAuthority: versionAuthority(version),
    now: new Date("2026-08-29T12:00:00Z"),
  });
  assert.equal(resolved.sealedVersion.analysis.title, version.analysis.title);
  assert.equal(resolved.sealedVersion.analysis.reader_reports, undefined);
  assert.equal(resolved.sealedVersion.analysis._claim_verification, undefined);
  assert.equal(resolved.sealedVersion.analysis.unexpected_private_payload, undefined);
  assert.doesNotMatch(JSON.stringify(resolved), /SYNTHETIC-SECRET-MARKER/);

  assert.throws(() => resolveAuthoritativeShare({
    token: "share-token",
    share: record,
    authority: {},
    parent,
    version,
    versionAuthority: versionAuthority(version),
  }), /authority receipt/);

  assert.throws(() => resolveAuthoritativeShare({
    token: "share-token",
    share: record,
    authority: { ...authority, contentHash: "00".repeat(32) },
    parent,
    version,
    versionAuthority: versionAuthority(version),
  }), /authority receipt/);

  assert.throws(() => resolveAuthoritativeShare({
    token: "share-token",
    share: record,
    authority: {
      ...authority,
      publicTrustManifestIntegritySha256: "00".repeat(32),
    },
    parent,
    version,
    versionAuthority: versionAuthority(version),
  }), /authority receipt/);
});
