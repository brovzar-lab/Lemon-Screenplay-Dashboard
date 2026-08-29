import type { Firestore } from "firebase-admin/firestore";

type UnknownRecord = Record<string, unknown>;

export const ANALYSIS_VERSION_AUTHORITY_VERSION =
  "lemon-analysis-version-authority-v1";
const SERVER_TRUST_ATTESTATION_VERSION =
  "lemon-server-trust-attestation-v1";

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function validDocumentId(value: string, label: string): string {
  if (!value || value.includes("/") || value.length > 500) {
    throw new Error(`${label} is not a valid document ID.`);
  }
  return value;
}

export function validateAnalysisVersionAuthority(
  projectIdValue: string,
  versionIdValue: string,
  rawVersion: unknown,
  rawAuthority: unknown,
): void {
  const projectId = validDocumentId(projectIdValue, "Project");
  const versionId = validDocumentId(versionIdValue, "Analysis version");
  const version = asRecord(rawVersion);
  const authority = asRecord(rawAuthority);
  const manifest = asRecord(version.trust_manifest);
  const attestation = asRecord(version.server_trust_attestation);
  if (
    version.project_id !== projectId
    || version.version_id !== versionId
    || !/^[a-f0-9]{64}$/.test(String(version.content_hash ?? ""))
    || !/^[a-f0-9]{64}$/.test(String(manifest.integrity_sha256 ?? ""))
    || !/^[a-f0-9]{64}$/.test(String(manifest.analysis_payload_sha256 ?? ""))
    || authority.authorityVersion !== ANALYSIS_VERSION_AUTHORITY_VERSION
    || authority.writer !== "firebase_admin"
    || authority.projectId !== projectId
    || authority.versionId !== versionId
    || authority.contentHash !== version.content_hash
    || authority.trustManifestIntegritySha256 !== manifest.integrity_sha256
    || authority.analysisPayloadSha256 !== manifest.analysis_payload_sha256
    || attestation.attestation_version !== SERVER_TRUST_ATTESTATION_VERSION
    || attestation.writer !== "firebase_admin"
    || attestation.project_id !== projectId
    || attestation.version_id !== versionId
    || attestation.content_sha256 !== authority.contentHash
    || attestation.trust_manifest_integrity_sha256
      !== authority.trustManifestIntegritySha256
    || attestation.analysis_payload_sha256 !== authority.analysisPayloadSha256
  ) {
    throw new Error("The immutable analysis version has no valid server authority receipt.");
  }
}

export async function loadAuthorizedAnalysisVersion(
  db: Firestore,
  projectId: string,
  versionId: string,
): Promise<{ version: UnknownRecord; authority: UnknownRecord }> {
  validDocumentId(projectId, "Project");
  validDocumentId(versionId, "Analysis version");
  const parentRef = db.collection("uploaded_analyses").doc(projectId);
  const [versionSnapshot, authoritySnapshot] = await Promise.all([
    parentRef.collection("versions").doc(versionId).get(),
    parentRef.collection("version_authorities").doc(versionId).get(),
  ]);
  if (!versionSnapshot.exists || !authoritySnapshot.exists) {
    throw new Error("The exact server-authorized analysis version does not exist.");
  }
  const version = versionSnapshot.data() as UnknownRecord;
  const authority = authoritySnapshot.data() as UnknownRecord;
  validateAnalysisVersionAuthority(projectId, versionId, version, authority);
  return { version, authority };
}
