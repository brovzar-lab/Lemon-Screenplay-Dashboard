import { createHash, randomUUID } from "node:crypto";

import { extractProducerAnalysisSnapshot } from "./calibrationCore";

type UnknownRecord = Record<string, unknown>;

export const SHARE_AUTHORITY_VERSION = "lemon-share-authority-v1";
export const PUBLIC_SHARE_MANIFEST_VERSION = "lemon-public-share-manifest-v1";
const PUBLIC_SHARE_ATTESTATION_VERSION = "lemon-public-share-attestation-v1";

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as UnknownRecord;
    return `{${Object.keys(record).sort().map(
      (key) => `${JSON.stringify(key)}:${stableJson(record[key])}`,
    ).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value), "utf8").digest("hex");
}

const PILLARS = [
  "structure",
  "character",
  "craft_scene",
  "concept",
  "emotional_resonance",
] as const;

const COMMERCIAL_FACTORS = [
  "target_audience",
  "high_concept",
  "cast_attachability",
  "marketing_hook",
  "budget_return_ratio",
  "comparable_success",
] as const;

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function textList(value: unknown, limit = 100): string[] {
  return Array.isArray(value)
    ? value.slice(0, limit).flatMap((item) => {
      const valueText = text(item, 10_000);
      return valueText ? [valueText] : [];
    })
    : [];
}

function publicAnalysisProjection(value: unknown): UnknownRecord {
  const analysis = asRecord(value);
  const pillars = asRecord(analysis.pillar_scores);
  const characters = asRecord(analysis.characters);
  const comparables = asRecord(analysis.comparable_films);
  const commercial = asRecord(asRecord(analysis.lenses).commercial_viability);
  const story = asRecord(analysis.story_vs_situation);
  const falsePositive = asRecord(analysis.false_positive_check);
  const truncation = asRecord(analysis._truncation);
  const context = asRecord(analysis._context_policy);
  const boundary = asRecord(analysis._boundary_reruns);

  const pillarScores = Object.fromEntries(PILLARS.flatMap((name) => {
    const pillar = asRecord(pillars[name]);
    const score = finiteNumber(pillar.score);
    const weight = finiteNumber(pillar.weight);
    return score === undefined ? [] : [[name, {
      score,
      ...(weight !== undefined ? { weight } : {}),
    }]];
  }));
  const commercialViability = Object.fromEntries(COMMERCIAL_FACTORS.flatMap((name) => {
    const factor = asRecord(commercial[name]);
    const score = finiteNumber(factor.score);
    const note = text(factor.note, 10_000);
    return score === undefined && !note ? [] : [[name, {
      ...(score !== undefined ? { score } : {}),
      ...(note ? { note } : {}),
    }]];
  }));
  const comparableFilms = Object.fromEntries(
    ["tone", "structure", "market"].flatMap((name) => {
      const comparable = asRecord(comparables[name]);
      const title = text(comparable.title, 500);
      return title ? [[name, {
        title,
        similarity: text(comparable.similarity, 10_000),
        structural_match: text(comparable.structural_match, 10_000),
        key_divergence: text(comparable.key_divergence, 10_000),
      }]] : [];
    }),
  );
  const boundaryRuns = Array.isArray(boundary.runs)
    ? boundary.runs.slice(0, 10).flatMap((item) => {
      const run = asRecord(item);
      const adjustedScore = finiteNumber(run.adjusted_score);
      const verdict = text(run.verdict, 100);
      return adjustedScore === undefined && !verdict ? [] : [{
        ...(adjustedScore !== undefined ? { adjusted_score: adjustedScore } : {}),
        ...(verdict ? { verdict } : {}),
      }];
    })
    : [];
  const traps = Array.isArray(falsePositive.traps_evaluated)
    ? falsePositive.traps_evaluated.slice(0, 100).map((item) => ({
      triggered: asRecord(item).triggered === true,
    }))
    : [];

  return {
    title: text(analysis.title, 500),
    author: text(analysis.author, 500),
    genre: text(analysis.genre, 500),
    subgenres: textList(analysis.subgenres, 20),
    themes: textList(analysis.themes, 50),
    logline: text(analysis.logline, 10_000),
    tone: text(analysis.tone, 2_000),
    executive_summary: text(analysis.executive_summary, 50_000),
    strengths: textList(analysis.strengths),
    weaknesses: textList(analysis.weaknesses),
    red_flags: textList(analysis.red_flags),
    characters: {
      protagonist: text(characters.protagonist, 1_000),
      antagonist: text(characters.antagonist, 1_000),
      supporting: textList(characters.supporting, 100),
    },
    comparable_films: comparableFilms,
    pillar_scores: pillarScores,
    lenses: { commercial_viability: commercialViability },
    ...(finiteNumber(analysis.weighted_score) !== undefined
      ? { weighted_score: finiteNumber(analysis.weighted_score) }
      : {}),
    ...(finiteNumber(analysis.weighted_score_adjusted) !== undefined
      ? { weighted_score_adjusted: finiteNumber(analysis.weighted_score_adjusted) }
      : {}),
    ...(finiteNumber(analysis.critical_failure_penalty_applied) !== undefined
      ? {
        critical_failure_penalty_applied:
          finiteNumber(analysis.critical_failure_penalty_applied),
      }
      : {}),
    ...(finiteNumber(analysis.critical_failure_total_penalty) !== undefined
      ? {
        critical_failure_total_penalty:
          finiteNumber(analysis.critical_failure_total_penalty),
      }
      : {}),
    verdict: text(analysis.verdict, 100),
    verdict_model: text(analysis.verdict_model, 100),
    verdict_before_adjustments: text(analysis.verdict_before_adjustments, 100),
    verdict_before_gates: text(analysis.verdict_before_gates, 100),
    verdict_adjustments: textList(analysis.verdict_adjustments, 100),
    story_vs_situation: {
      ...(finiteNumber(story.score) !== undefined
        ? { score: finiteNumber(story.score) }
        : {}),
      verdict: text(story.verdict, 100),
      gate_applied: story.gate_applied === true,
    },
    false_positive_check: {
      ...(finiteNumber(falsePositive.weighted_trap_score) !== undefined
        ? { weighted_trap_score: finiteNumber(falsePositive.weighted_trap_score) }
        : {}),
      verdict_adjustment: text(falsePositive.verdict_adjustment, 500) || "none",
      traps_evaluated: traps,
    },
    _truncation: { truncated: truncation.truncated === true },
    _context_policy: { source_truncated: context.source_truncated === true },
    _boundary_reruns: {
      triggered: boundary.triggered === true,
      ...(finiteNumber(boundary.completed_runs) !== undefined
        ? { completed_runs: finiteNumber(boundary.completed_runs) }
        : {}),
      ...(finiteNumber(boundary.score_spread) !== undefined
        ? { score_spread: finiteNumber(boundary.score_spread) }
        : {}),
      runs: boundaryRuns,
      failed_runs: Array.isArray(boundary.failed_runs)
        ? boundary.failed_runs.slice(0, 10).map(() => ({}))
        : [],
    },
    reader_disagreements: Array.isArray(analysis.reader_disagreements)
      ? analysis.reader_disagreements.slice(0, 100).map(() => ({}))
      : [],
  };
}

function publicLocalizedAnalysis(
  value: unknown,
  versionId: string,
): UnknownRecord | undefined {
  const spanish = asRecord(asRecord(value).es);
  const content = asRecord(spanish.content);
  const sourceVersionId = text(spanish.sourceVersionId, 500);
  const generatedAt = text(spanish.generatedAt, 100);
  const model = text(spanish.model, 500);
  if (sourceVersionId !== versionId || !generatedAt || !model) return undefined;

  const dimensionJustifications = asRecord(content.dimensionJustifications);
  const commercialNotes = asRecord(content.commercialViabilityNotes);
  const localizedCharacters = asRecord(content.characters);
  const targetAudience = asRecord(content.targetAudience);
  const publicContent: UnknownRecord = {
    logline: text(content.logline, 10_000),
    tone: text(content.tone, 2_000),
    recommendationRationale: text(content.recommendationRationale, 50_000),
    verdictStatement: text(content.verdictStatement, 50_000),
    budgetJustification: text(content.budgetJustification, 10_000),
    strengths: textList(content.strengths),
    weaknesses: textList(content.weaknesses),
    majorWeaknesses: textList(content.majorWeaknesses),
    developmentNotes: textList(content.developmentNotes),
    dimensionJustifications: Object.fromEntries(
      ["concept", "structure", "protagonist", "supportingCast", "dialogue", "genreExecution", "originality"]
        .flatMap((key) => {
          const valueText = text(dimensionJustifications[key], 10_000);
          return valueText ? [[key, valueText]] : [];
        }),
    ),
    commercialViabilityNotes: Object.fromEntries(
      ["targetAudience", "highConcept", "castAttachability", "marketingHook", "budgetReturnRatio", "comparableSuccess"]
        .flatMap((key) => {
          const valueText = text(commercialNotes[key], 10_000);
          return valueText ? [[key, valueText]] : [];
        }),
    ),
    characters: {
      protagonist: text(localizedCharacters.protagonist, 1_000),
      antagonist: text(localizedCharacters.antagonist, 1_000),
    },
    comparableFilms: Array.isArray(content.comparableFilms)
      ? content.comparableFilms.slice(0, 10).map((item) => {
        const film = asRecord(item);
        return {
          similarity: text(film.similarity, 10_000),
          keyDivergence: text(film.keyDivergence, 10_000),
        };
      })
      : [],
    standoutScenes: Array.isArray(content.standoutScenes)
      ? content.standoutScenes.slice(0, 100).map((item) => {
        const scene = asRecord(item);
        return {
          scene: text(scene.scene, 10_000),
          why: text(scene.why, 10_000),
        };
      })
      : [],
    targetAudience: {
      primaryDemographic: text(targetAudience.primaryDemographic, 2_000),
      interests: textList(targetAudience.interests, 100),
    },
  };
  return { es: { sourceVersionId, generatedAt, model, content: publicContent } };
}

function buildPublicTrustProjection(
  projectId: string,
  versionId: string,
  version: UnknownRecord,
  publicAnalysis: UnknownRecord,
  localizedAnalysis: UnknownRecord | undefined,
): { manifest: UnknownRecord; attestation: UnknownRecord } {
  const canonical = asRecord(version.trust_manifest);
  const source = asRecord(canonical.source);
  const engine = asRecord(canonical.engine);
  const readers = asRecord(canonical.readers);
  const claims = asRecord(canonical.claim_verification);
  const score = asRecord(canonical.score_lineage);
  const calls = asRecord(canonical.models).calls;
  const callList = Array.isArray(calls) ? calls : [];
  const publicPayloadSha256 = sha256({
    analysis: publicAnalysis,
    localized_analysis: localizedAnalysis ?? null,
  });
  const unsigned = {
    manifest_version: PUBLIC_SHARE_MANIFEST_VERSION,
    canonical_manifest_integrity_sha256: canonical.integrity_sha256,
    canonical_analysis_payload_sha256: canonical.analysis_payload_sha256,
    public_payload_scope: "analysis_and_localized_analysis",
    analysis_payload_sha256: publicPayloadSha256,
    source: {
      content_sha256: source.content_sha256,
      source_file: source.source_file,
    },
    origin: { project_id: projectId, version_id: versionId },
    engine: { analysis_version: engine.analysis_version },
    models: {
      call_count: callList.length,
      provenance_sha256: sha256(callList),
    },
    readers: {
      quality_status: readers.quality_status,
      expected_specialist_readers: readers.expected_specialist_readers,
      completed_specialist_readers: readers.completed_specialist_readers,
      failed_reader_count: Array.isArray(readers.failed_readers)
        ? readers.failed_readers.length
        : -1,
    },
    claim_verification: {
      status: claims.status,
      verification_scope: claims.verification_scope,
      claim_count: claims.claim_count,
      factual_support_rate: claims.factual_support_rate,
      claims_sha256: claims.claims_sha256,
    },
    score_lineage: {
      adjusted_score: score.adjusted_score,
      final_verdict: score.final_verdict,
    },
  };
  const manifest = { ...unsigned, integrity_sha256: sha256(unsigned) };
  return {
    manifest,
    attestation: {
      attestation_version: PUBLIC_SHARE_ATTESTATION_VERSION,
      writer: "share_manager",
      project_id: projectId,
      version_id: versionId,
      content_sha256: version.content_hash,
      canonical_trust_manifest_integrity_sha256: canonical.integrity_sha256,
      trust_manifest_integrity_sha256: manifest.integrity_sha256,
      canonical_analysis_payload_sha256: canonical.analysis_payload_sha256,
      analysis_payload_sha256: manifest.analysis_payload_sha256,
      public_payload_scope: manifest.public_payload_scope,
    },
  };
}

function publicMetadata(version: UnknownRecord): UnknownRecord {
  const metadata = asRecord(version.metadata);
  return {
    filename: text(metadata.filename ?? version.source_file, 500),
    ...(typeof metadata.page_count === "number"
      ? { page_count: metadata.page_count }
      : {}),
    ...(typeof metadata.word_count === "number"
      ? { word_count: metadata.word_count }
      : {}),
    ...(typeof metadata.character_count === "number"
      ? { character_count: metadata.character_count }
      : {}),
  };
}

export function buildSharedViewRecord(input: {
  projectId: string;
  versionId: string;
  screenplayId: string;
  parent: unknown;
  version: unknown;
  versionAuthority: unknown;
  includeNotes: boolean;
  notes?: unknown;
  now?: Date;
  token?: string;
}): UnknownRecord {
  const parent = asRecord(input.parent);
  const version = asRecord(input.version);
  extractProducerAnalysisSnapshot(
    input.projectId,
    input.versionId,
    version,
    input.versionAuthority,
  );
  if (parent.latest_version_id !== input.versionId) {
    throw new Error("Only the current immutable analysis version can be shared.");
  }
  const publicAnalysis = publicAnalysisProjection(version.analysis);
  const localizedAnalysis = publicLocalizedAnalysis(
    version.localized_analysis,
    input.versionId,
  );
  const publicTrust = buildPublicTrustProjection(
    input.projectId,
    input.versionId,
    version,
    publicAnalysis,
    localizedAnalysis,
  );

  const now = input.now ?? new Date();
  const expiresAtMillis = now.getTime() + 30 * 24 * 60 * 60 * 1_000;
  const notes = input.includeNotes && Array.isArray(input.notes)
    ? input.notes.slice(0, 100).flatMap((item) => {
      const note = asRecord(item);
      const content = text(note.content, 5_000);
      const createdAt = text(note.createdAt, 100);
      return content && createdAt ? [{ content, createdAt }] : [];
    })
    : [];

  return {
    authorityVersion: SHARE_AUTHORITY_VERSION,
    token: input.token ?? randomUUID(),
    screenplayId: text(input.screenplayId, 500),
    screenplayTitle: text(
      asRecord(version.analysis).title ?? version.source_file,
      500,
    ),
    includeNotes: notes.length > 0,
    createdAt: now.toISOString(),
    expiresAt: new Date(expiresAtMillis).toISOString(),
    expiresAtMillis,
    pdfUrl: null,
    posterUrl: parent.poster_version_id === input.versionId
      ? text(parent.poster_url, 2_000) || null
      : null,
    sealedVersion: {
      project_id: input.projectId,
      version_id: input.versionId,
      latest_version_id: input.versionId,
      source_file: version.source_file,
      latest_source_file: version.source_file,
      content_hash: version.content_hash,
      identity_status: version.identity_status,
      analysis_version: version.analysis_version,
      analysis_model: version.analysis_model,
      trust_manifest_version: PUBLIC_SHARE_MANIFEST_VERSION,
      analysis: publicAnalysis,
      metadata: publicMetadata(version),
      ...(localizedAnalysis
        ? { localized_analysis: localizedAnalysis }
        : {}),
      collection: parent.collection,
      category: parent.category,
      server_trust_attestation: publicTrust.attestation,
      trust_manifest: publicTrust.manifest,
    },
    ...(notes.length > 0 ? { notes } : {}),
  };
}

export function buildShareAuthorityRecord(input: {
  record: UnknownRecord;
  projectId: string;
  versionId: string;
  version: unknown;
}): UnknownRecord {
  const version = asRecord(input.version);
  const canonicalManifest = asRecord(version.trust_manifest);
  const sharedVersion = asRecord(input.record.sealedVersion);
  const publicManifest = asRecord(sharedVersion.trust_manifest);
  return {
    authorityVersion: SHARE_AUTHORITY_VERSION,
    token: input.record.token,
    projectId: input.projectId,
    versionId: input.versionId,
    screenplayId: input.record.screenplayId,
    contentHash: version.content_hash,
    canonicalTrustManifestIntegritySha256: canonicalManifest.integrity_sha256,
    publicTrustManifestIntegritySha256: publicManifest.integrity_sha256,
    publicPayloadSha256: publicManifest.analysis_payload_sha256,
    createdAt: input.record.createdAt,
    expiresAtMillis: input.record.expiresAtMillis,
  };
}

export function resolveAuthoritativeShare(input: {
  token: string;
  share: unknown;
  authority: unknown;
  parent: unknown;
  version: unknown;
  versionAuthority: unknown;
  now?: Date;
}): UnknownRecord {
  const share = asRecord(input.share);
  const authority = asRecord(input.authority);
  const version = asRecord(input.version);
  const canonicalManifest = asRecord(version.trust_manifest);
  const sharedVersion = asRecord(share.sealedVersion);
  const publicManifest = asRecord(sharedVersion.trust_manifest);
  const createdAt = text(authority.createdAt, 100);
  const createdAtMillis = Date.parse(createdAt);
  const expiresAtMillis = authority.expiresAtMillis;

  if (
    share.authorityVersion !== SHARE_AUTHORITY_VERSION
    || authority.authorityVersion !== SHARE_AUTHORITY_VERSION
    || share.token !== input.token
    || authority.token !== input.token
    || authority.screenplayId !== share.screenplayId
    || authority.contentHash !== version.content_hash
    || authority.canonicalTrustManifestIntegritySha256
      !== canonicalManifest.integrity_sha256
    || authority.publicTrustManifestIntegritySha256
      !== publicManifest.integrity_sha256
    || authority.publicPayloadSha256
      !== publicManifest.analysis_payload_sha256
    || !Number.isFinite(createdAtMillis)
    || typeof expiresAtMillis !== "number"
    || expiresAtMillis !== share.expiresAtMillis
    || (input.now ?? new Date()).getTime() >= expiresAtMillis
  ) {
    throw new Error("The share authority receipt is invalid or expired.");
  }

  const projectId = text(authority.projectId, 500);
  const versionId = text(authority.versionId, 500);
  if (!projectId || !versionId) {
    throw new Error("The share authority receipt is incomplete.");
  }
  const rebuilt = buildSharedViewRecord({
    projectId,
    versionId,
    screenplayId: text(share.screenplayId, 500),
    parent: input.parent,
    version,
    versionAuthority: input.versionAuthority,
    includeNotes: share.includeNotes === true,
    notes: share.notes,
    now: new Date(createdAtMillis),
    token: input.token,
  });
  if (rebuilt.expiresAtMillis !== expiresAtMillis) {
    throw new Error("The share authority expiry does not match the canonical record.");
  }
  return rebuilt;
}
