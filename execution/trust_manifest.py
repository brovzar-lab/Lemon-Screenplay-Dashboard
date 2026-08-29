"""Immutable provenance contract for every future permanent V9 analysis.

The manifest records what source was read, which code and prompt contract ran,
which exact model responses were used, and how the saved score/verdict were
derived. A SHA-256 integrity seal makes silent edits detectable before write.
"""

from __future__ import annotations

import copy
import hashlib
import json
import math
import re
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional

try:
    from .verdict_contract import (
        BOUNDARY_WINDOW,
        FAILURE_PENALTIES,
        READER_WEIGHTS,
        derive_failure_severity,
        derive_verdict,
        near_verdict_boundary,
        select_boundary_run_index,
    )
except ImportError:
    from verdict_contract import (
        BOUNDARY_WINDOW,
        FAILURE_PENALTIES,
        READER_WEIGHTS,
        derive_failure_severity,
        derive_verdict,
        near_verdict_boundary,
        select_boundary_run_index,
    )

try:
    from .source_evidence import (
        CITATION_MATCH_POLICY_VERSION,
        validate_stored_citation_quality,
        validate_stored_context_policy,
        validate_stored_page_evidence,
        validate_native_cross_check,
        validate_scene_count_evidence,
    )
except ImportError:
    from source_evidence import (
        CITATION_MATCH_POLICY_VERSION,
        validate_stored_citation_quality,
        validate_stored_context_policy,
        validate_stored_page_evidence,
        validate_native_cross_check,
        validate_scene_count_evidence,
    )

LEGACY_TRUST_MANIFEST_VERSION = "lemon-trust-manifest-v1"
Q2_TRUST_MANIFEST_VERSION = "lemon-trust-manifest-v2"
Q3_TRUST_MANIFEST_VERSION = "lemon-trust-manifest-v3"
Q4_TRUST_MANIFEST_VERSION = "lemon-trust-manifest-v4"
Q5_TRUST_MANIFEST_VERSION = "lemon-trust-manifest-v5"
TRUST_MANIFEST_VERSION = "lemon-trust-manifest-v6"
SUPPORTED_TRUST_MANIFEST_VERSIONS = {
    LEGACY_TRUST_MANIFEST_VERSION,
    Q2_TRUST_MANIFEST_VERSION,
    Q3_TRUST_MANIFEST_VERSION,
    Q4_TRUST_MANIFEST_VERSION,
    Q5_TRUST_MANIFEST_VERSION,
    TRUST_MANIFEST_VERSION,
}
READER_RELIABILITY_CONTRACT_VERSION = "lemon-five-reader-panel-v1"
LEGACY_ANALYSIS_SCHEMA_VERSION = "v9-archaeology-schema-2026-07-29"
PREVIOUS_ANALYSIS_SCHEMA_VERSION = "v9-archaeology-schema-2026-08-27"
ANALYSIS_SCHEMA_VERSION = "v9-archaeology-schema-2026-08-29"
SUPPORTED_ANALYSIS_SCHEMA_VERSIONS = {
    LEGACY_ANALYSIS_SCHEMA_VERSION,
    PREVIOUS_ANALYSIS_SCHEMA_VERSION,
    ANALYSIS_SCHEMA_VERSION,
}
TRIAGE_SCHEMA_VERSION = "v9-triage-schema-2026-07-29"
LEGACY_PROMPT_CONTRACT_VERSION = "v9-archaeology-prompts-2026-07-29"
PREVIOUS_PROMPT_CONTRACT_VERSION = "v9-archaeology-prompts-2026-08-27"
PRE_CITATION_PROMPT_CONTRACT_VERSION = "v9-archaeology-prompts-2026-08-29"
PRE_FULL_CORRECTION_PROMPT_CONTRACT_VERSION = (
    "v9-archaeology-prompts-2026-08-29-citation-v2"
)
PRE_SOURCE_RECONCILIATION_PROMPT_CONTRACT_VERSION = (
    "v9-archaeology-prompts-2026-08-29-citation-v3"
)
PRE_TARGETED_CORRECTION_PROMPT_CONTRACT_VERSION = (
    "v9-archaeology-prompts-2026-08-29-citation-v4"
)
PRE_VERIFIED_CITATION_SUBSET_PROMPT_CONTRACT_VERSION = (
    "v9-archaeology-prompts-2026-08-29-citation-v5"
)
PRE_DIRECT_CORRECTION_PROMPT_CONTRACT_VERSION = (
    "v9-archaeology-prompts-2026-08-29-citation-v6"
)
PROMPT_CONTRACT_VERSION = "v9-archaeology-prompts-2026-08-29-citation-v7"
SUPPORTED_PROMPT_CONTRACT_VERSIONS = {
    LEGACY_PROMPT_CONTRACT_VERSION,
    PREVIOUS_PROMPT_CONTRACT_VERSION,
    PRE_CITATION_PROMPT_CONTRACT_VERSION,
    PRE_FULL_CORRECTION_PROMPT_CONTRACT_VERSION,
    PRE_SOURCE_RECONCILIATION_PROMPT_CONTRACT_VERSION,
    PRE_TARGETED_CORRECTION_PROMPT_CONTRACT_VERSION,
    PRE_VERIFIED_CITATION_SUBSET_PROMPT_CONTRACT_VERSION,
    PRE_DIRECT_CORRECTION_PROMPT_CONTRACT_VERSION,
    PROMPT_CONTRACT_VERSION,
}
TARGETED_CORRECTION_PROMPT_CONTRACT_VERSIONS = {
    PRE_VERIFIED_CITATION_SUBSET_PROMPT_CONTRACT_VERSION,
    PRE_DIRECT_CORRECTION_PROMPT_CONTRACT_VERSION,
    PROMPT_CONTRACT_VERSION,
}
LEGACY_CLAIM_TARGET_PROMPT_CONTRACT_VERSIONS = {
    LEGACY_PROMPT_CONTRACT_VERSION,
    PREVIOUS_PROMPT_CONTRACT_VERSION,
}
PREVIOUS_SCORING_CODE_VERSION = "v9-verdict-2026-07-29"
SCORING_CODE_VERSION = "v9-verdict-2026-08-27"
SUPPORTED_SCORING_CODE_VERSIONS = {
    PREVIOUS_SCORING_CODE_VERSION,
    SCORING_CODE_VERSION,
}
SUPPORTED_ANALYSIS_CONTRACTS = {
    *{
        (
            manifest_version,
            LEGACY_ANALYSIS_SCHEMA_VERSION,
            LEGACY_PROMPT_CONTRACT_VERSION,
            PREVIOUS_SCORING_CODE_VERSION,
        )
        for manifest_version in {
            LEGACY_TRUST_MANIFEST_VERSION,
            Q2_TRUST_MANIFEST_VERSION,
            Q3_TRUST_MANIFEST_VERSION,
            Q4_TRUST_MANIFEST_VERSION,
        }
    },
    (
        Q5_TRUST_MANIFEST_VERSION,
        PREVIOUS_ANALYSIS_SCHEMA_VERSION,
        PREVIOUS_PROMPT_CONTRACT_VERSION,
        SCORING_CODE_VERSION,
    ),
    (
        TRUST_MANIFEST_VERSION,
        PREVIOUS_ANALYSIS_SCHEMA_VERSION,
        PREVIOUS_PROMPT_CONTRACT_VERSION,
        SCORING_CODE_VERSION,
    ),
    (
        TRUST_MANIFEST_VERSION,
        ANALYSIS_SCHEMA_VERSION,
        PRE_CITATION_PROMPT_CONTRACT_VERSION,
        SCORING_CODE_VERSION,
    ),
    (
        TRUST_MANIFEST_VERSION,
        ANALYSIS_SCHEMA_VERSION,
        PRE_FULL_CORRECTION_PROMPT_CONTRACT_VERSION,
        SCORING_CODE_VERSION,
    ),
    (
        TRUST_MANIFEST_VERSION,
        ANALYSIS_SCHEMA_VERSION,
        PRE_SOURCE_RECONCILIATION_PROMPT_CONTRACT_VERSION,
        SCORING_CODE_VERSION,
    ),
    (
        TRUST_MANIFEST_VERSION,
        ANALYSIS_SCHEMA_VERSION,
        PRE_TARGETED_CORRECTION_PROMPT_CONTRACT_VERSION,
        SCORING_CODE_VERSION,
    ),
    (
        TRUST_MANIFEST_VERSION,
        ANALYSIS_SCHEMA_VERSION,
        PRE_VERIFIED_CITATION_SUBSET_PROMPT_CONTRACT_VERSION,
        SCORING_CODE_VERSION,
    ),
    (
        TRUST_MANIFEST_VERSION,
        ANALYSIS_SCHEMA_VERSION,
        PRE_DIRECT_CORRECTION_PROMPT_CONTRACT_VERSION,
        SCORING_CODE_VERSION,
    ),
    (
        TRUST_MANIFEST_VERSION,
        ANALYSIS_SCHEMA_VERSION,
        PROMPT_CONTRACT_VERSION,
        SCORING_CODE_VERSION,
    ),
}
TRAP_CONTRACT_VERSION = json.loads(
    (Path(__file__).resolve().parent / "v9_trap_contract.json").read_text(
        encoding="utf-8"
    )
)["version"]
ANALYSIS_PROVIDER = "anthropic"
BENCHMARK_TRUST_SEAL_VERSION = "lemon-benchmark-trust-seal-v1"
CANONICAL_READER_NAMES = {
    "structure",
    "character",
    "craft_scene",
    "concept",
    "emotional_resonance",
}
USAGE_COUNTER_FIELDS = (
    "input_tokens",
    "output_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
    "call_count",
    "actual_cost_microusd",
)

_PROVIDER_STOP_REASONS = {
    "end_turn",
    "max_tokens",
    "model_context_window_exceeded",
    "pause_turn",
    "refusal",
    "stop_sequence",
    "tool_use",
}
_RELEASE_PROVENANCE_FIELDS = (
    "git_sha",
    "source_clean",
    "catalog_sha256",
    "pricing_sha256",
    "build_timestamp",
    "deployment_config_sha256",
    "cloud_run_revision",
    "inference_geo",
)
_BUDGET_INTEGER_FIELDS = (
    "logical_retry",
    "request_content_bytes",
    "request_envelope_overhead_bytes",
    "request_bytes_upper_bound",
    "input_tokens_upper_bound",
    "output_tokens_upper_bound",
    "request_ceiling_microusd",
    "sequence",
    "spent_before_microusd",
    "reserved_before_microusd",
    "remaining_before_microusd",
    "settled_cost_microusd",
    "spent_after_microusd",
    "reserved_after_microusd",
)
_BUDGET_USD_FIELDS = (
    "request_ceiling_usd",
    "spent_before_usd",
    "reserved_before_usd",
    "remaining_before_usd",
    "settled_cost_usd",
    "spent_after_usd",
    "reserved_after_usd",
)
_BUDGET_MONEY_PREFIXES = (
    "request_ceiling",
    "spent_before",
    "reserved_before",
    "remaining_before",
    "settled_cost",
    "spent_after",
    "reserved_after",
)
_BUDGET_DECISIONS = {
    "charged_conservative_invalid_settlement",
    "charged_conservative_uncertain_ceiling",
    "proven_zero_spend_failure",
    "rejected_before_dispatch",
    "rejected_platform_drift_before_dispatch",
    "reserved_before_dispatch",
    "settled",
    "settled_exceeds_preflight_ceiling",
    "settled_failure",
    "settled_failure_exceeds_preflight_ceiling",
}

_SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
_CLAIM_BATCH_PATTERN = re.compile(r"^batch_([0-9]{3})_of_([0-9]{3})$")
_ROOT = Path(__file__).resolve().parent
_MODEL_PRICING_PATH = _ROOT.parent / "functions" / "src" / "anthropicPricing.json"
CLAIM_VERIFICATION_BATCH_SIZE = 25


def _valid_stage_reader_name(stage: str, reader_name: Any) -> bool:
    if stage == "reader":
        return reader_name in CANONICAL_READER_NAMES
    if stage != "claim_verification":
        return reader_name is None
    if not isinstance(reader_name, str):
        return False
    match = _CLAIM_BATCH_PATTERN.fullmatch(reader_name)
    if match is None:
        return False
    index, total = map(int, match.groups())
    return 1 <= index <= total


@lru_cache(maxsize=1)
def runtime_pricing_sha256() -> str:
    """Fingerprint the exact catalog pricing table used for cost checks."""
    table = json.loads(_MODEL_PRICING_PATH.read_text(encoding="utf-8"))
    return hashlib.sha256(_canonical_json(table).encode("utf-8")).hexdigest()


def claim_verification_target_fields(
    prompt_contract_version: str = PROMPT_CONTRACT_VERSION,
) -> tuple[str, ...]:
    """Return the fields locked by the prompt contract that produced a result."""
    if prompt_contract_version not in SUPPORTED_PROMPT_CONTRACT_VERSIONS:
        raise ValueError("Unsupported prompt contract version")
    fields = (
        "claim_id",
        "claim",
        "claim_type",
        "verdict_driving",
        "story_fact_check_required",
    )
    if prompt_contract_version not in LEGACY_CLAIM_TARGET_PROMPT_CONTRACT_VERSIONS:
        fields = (*fields, "evidence_scope")
    if prompt_contract_version not in {
        LEGACY_PROMPT_CONTRACT_VERSION,
        PREVIOUS_PROMPT_CONTRACT_VERSION,
        PRE_CITATION_PROMPT_CONTRACT_VERSION,
    }:
        fields = (*fields, "score_alignment_required")
    return fields


def claim_verification_targets(
    analysis: Mapping[str, Any],
    *,
    prompt_contract_version: str = PROMPT_CONTRACT_VERSION,
) -> List[Dict[str, Any]]:
    """Return the complete, deterministic set independently checked before lock."""
    if prompt_contract_version not in SUPPORTED_PROMPT_CONTRACT_VERSIONS:
        raise ValueError("Unsupported prompt contract version")
    current_contract = (
        prompt_contract_version not in LEGACY_CLAIM_TARGET_PROMPT_CONTRACT_VERSIONS
    )
    score_bound_contract = (
        current_contract
        and prompt_contract_version != PRE_CITATION_PROMPT_CONTRACT_VERSION
    )
    targets: List[Dict[str, Any]] = []
    nested_metadata = {
        "score",
        "page_citations",
        "citation_evidence",
        "justification",
    }
    nested_story_fields = {
        "identified_lie",
        "want",
        "need",
        "identified_blind_spot",
        "one_sentence_pitch",
        "obligatory_scenes_present",
        "obligatory_scenes_missing",
        "stated_controlling_idea",
        "four_clause_premise",
        "moments",
    }

    def add(
        claim_id: str,
        claim: Any,
        claim_type: str,
        verdict_driving: bool,
        evidence: Any = None,
        evidence_scope: Optional[str] = None,
        score_alignment_required: bool = False,
    ) -> None:
        if not isinstance(claim, str) or not claim.strip():
            return
        evidence = evidence if isinstance(evidence, Mapping) else {}
        target = {
            "claim_id": claim_id,
            "claim": claim,
            "claim_type": claim_type,
            "verdict_driving": verdict_driving,
            "story_fact_check_required": claim_type in {"factual", "mixed"},
            "provided_page_citations": copy.deepcopy(
                evidence.get("page_citations", [])
            ),
            "provided_citation_evidence": copy.deepcopy(
                evidence.get("citation_evidence", [])
            ),
        }
        if current_contract:
            scope = evidence_scope or (
                "evaluative" if claim_type == "evaluative" else "local"
            )
            if scope not in {"local", "global", "evaluative"}:
                raise ValueError("claim evidence scope is invalid")
            target["evidence_scope"] = scope
            target["story_fact_check_required"] = scope != "evaluative"
        if score_bound_contract:
            target["score_alignment_required"] = score_alignment_required
        targets.append(target)

    def add_nested_assertions(
        claim_id: str,
        label: str,
        value: Any,
        evidence: Any,
        story_field: Optional[str] = None,
    ) -> None:
        if isinstance(value, Mapping):
            inherited_evidence = (
                value
                if "page_citations" in value or "citation_evidence" in value
                else evidence
            )
            for key in sorted(value, key=str):
                if key in nested_metadata or (
                    current_contract and key not in nested_story_fields
                ):
                    continue
                add_nested_assertions(
                    f"{claim_id}.{key}",
                    f"{label}.{key}",
                    value[key],
                    inherited_evidence,
                    key,
                )
            return
        if isinstance(value, list):
            if not value:
                absence = (
                    "no obligatory scenes are missing"
                    if label.endswith(".obligatory_scenes_missing")
                    else "none"
                )
                add(
                    claim_id,
                    f"{label}: {absence}",
                    "mixed",
                    True,
                    evidence,
                    (
                        "evaluative"
                        if story_field == "obligatory_scenes_missing"
                        else "global"
                    ),
                )
                return
            for index, item in enumerate(value):
                add_nested_assertions(
                    f"{claim_id}.{index}",
                    f"{label}.{index}",
                    item,
                    evidence,
                    story_field,
                )
            return
        if isinstance(value, str):
            add(
                claim_id,
                f"{label}: {value}",
                "mixed",
                True,
                evidence,
                (
                    "evaluative"
                    if story_field in {
                        "obligatory_scenes_missing",
                        "stated_controlling_idea",
                    }
                    else "local"
                ),
            )
        elif type(value) is bool:
            add(
                claim_id,
                f"{label}: {str(value).lower()}",
                "mixed",
                True,
                evidence,
                "local",
            )

    add("genre.primary", analysis.get("genre"), "evaluative", True)
    subgenres = analysis.get("subgenres")
    if isinstance(subgenres, list):
        for index, subgenre in enumerate(subgenres):
            add(f"genre.subgenre.{index}", subgenre, "evaluative", True)
    genre_detection = analysis.get("genre_detection")
    if isinstance(genre_detection, Mapping):
        add(
            "genre.rationale",
            genre_detection.get("one_line_why"),
            "mixed",
            True,
            evidence_scope="global",
        )

    themes = analysis.get("themes")
    if isinstance(themes, list):
        for index, theme in enumerate(themes):
            add(
                f"theme.{index}",
                theme,
                "evaluative" if current_contract else "mixed",
                True,
            )
    add(
        "tone",
        analysis.get("tone"),
        "evaluative" if current_contract else "mixed",
        True,
    )

    comparables = analysis.get("comparable_films")
    if isinstance(comparables, Mapping):
        for kind in sorted(comparables, key=str):
            comparable = comparables[kind]
            if not isinstance(comparable, Mapping):
                continue
            for field in ("similarity", "divergence"):
                add(
                    f"comparable.{kind}.{field}",
                    comparable.get(field),
                    "evaluative" if current_contract else "mixed",
                    True,
                )

    disagreements = analysis.get("reader_disagreements")
    if isinstance(disagreements, list):
        for index, disagreement in enumerate(disagreements):
            if not isinstance(disagreement, Mapping):
                continue
            for field in (
                "reader_a_position",
                "reader_b_position",
                "resolution",
            ):
                add(
                    f"disagreement.{index}.{field}",
                    disagreement.get(field),
                    "evaluative" if current_contract else "mixed",
                    True,
                )

    cold_read = analysis.get("_cold_read")
    cold_evidence = cold_read.get("evidence") if isinstance(cold_read, Mapping) else None
    if isinstance(cold_evidence, Mapping):
        add(
            "cold_read.logline",
            cold_evidence.get("logline"),
            "factual",
            True,
            evidence_scope="global",
        )
        add(
            "cold_read.genre",
            cold_evidence.get("genre"),
            "evaluative",
            False,
        )

    material_claims = analysis.get("material_claims")
    if isinstance(material_claims, list):
        for material_index, material in enumerate(material_claims):
            if not isinstance(material, Mapping):
                continue
            claim_type = (
                "factual"
                if material.get("source_field") in {"logline", "executive_summary"}
                else "mixed"
            )
            atomic_claims = material.get("atomic_claims")
            if not isinstance(atomic_claims, list):
                continue
            for atomic_index, atomic in enumerate(atomic_claims):
                add(
                    f"material.{material_index}.{atomic_index}",
                    atomic.get("claim") if isinstance(atomic, Mapping) else None,
                    claim_type,
                    True,
                    atomic,
                )

    characters = analysis.get("characters")
    if isinstance(characters, Mapping):
        for role in ("protagonist", "antagonist"):
            name = characters.get(role)
            evidence = characters.get(f"{role}_evidence")
            justification = (
                evidence.get("role_justification", "")
                if isinstance(evidence, Mapping)
                else ""
            )
            kind = evidence.get("kind") if isinstance(evidence, Mapping) else None
            claim = (
                f"No {role} is identified: {justification}"
                if kind == "not_identified"
                else f"{name} functions as the {role}: {justification}"
            )
            add(
                f"character.{role}",
                claim,
                "factual",
                True,
                evidence,
                "global" if current_contract and kind == "not_identified" else None,
            )
        add(
            "character.protagonist_lie",
            characters.get("protagonist_lie"),
            "mixed",
            True,
            characters.get("protagonist_evidence"),
        )
        add(
            "character.protagonist_arc_type",
            characters.get("protagonist_arc_type"),
            "evaluative" if current_contract else "mixed",
            True,
            characters.get("protagonist_evidence"),
        )
        supporting = characters.get("supporting")
        supporting_evidence = characters.get("supporting_evidence")
        if isinstance(supporting, list):
            for index, name in enumerate(supporting):
                evidence = (
                    supporting_evidence[index]
                    if isinstance(supporting_evidence, list)
                    and index < len(supporting_evidence)
                    else {}
                )
                justification = (
                    evidence.get("role_justification", "")
                    if isinstance(evidence, Mapping)
                    else ""
                )
                add(
                    f"character.supporting.{index}",
                    f"{name} functions as a supporting character: {justification}",
                    "factual",
                    True,
                    evidence,
                )

    reader_reports = analysis.get("reader_reports")
    reader_reports = reader_reports if isinstance(reader_reports, Mapping) else {}
    critical_failures = analysis.get("critical_failures")
    if isinstance(critical_failures, list):
        for index, failure in enumerate(critical_failures):
            if not isinstance(failure, Mapping):
                continue
            reader = reader_reports.get(failure.get("reader"), {})
            sub_scores = reader.get("sub_scores", {}) if isinstance(reader, Mapping) else {}
            metric = sub_scores.get(failure.get("metric"), {}) if isinstance(sub_scores, Mapping) else {}
            add(
                f"critical_failure.{index}",
                failure.get("description"),
                "mixed",
                True,
                metric,
            )

    for reader_name in READER_WEIGHTS:
        reader = reader_reports.get(reader_name)
        sub_scores = reader.get("sub_scores") if isinstance(reader, Mapping) else None
        if not isinstance(sub_scores, Mapping):
            continue
        for metric_name in sorted(sub_scores):
            metric = sub_scores[metric_name]
            justification = (
                metric.get("justification") if isinstance(metric, Mapping) else None
            )
            score = metric.get("score") if isinstance(metric, Mapping) else None
            claim = justification
            if (
                score_bound_contract
                and not isinstance(score, bool)
                and isinstance(score, (int, float))
            ):
                claim = (
                    f"Reader {reader_name} scored criterion {metric_name} "
                    f"{score}/10. Justification: {justification}"
                )
            add(
                f"reader.{reader_name}.{metric_name}",
                claim,
                "mixed",
                True,
                metric,
                score_alignment_required=True,
            )
            if isinstance(metric, Mapping):
                add_nested_assertions(
                    f"reader.{reader_name}.{metric_name}",
                    f"{reader_name}.{metric_name}",
                    metric,
                    metric,
                )
        if current_contract and isinstance(reader, Mapping):
            add(
                f"reader.{reader_name}.one_sentence_verdict",
                reader.get("one_sentence_verdict"),
                "mixed",
                True,
                evidence_scope="global",
            )
            red_flags = reader.get("red_flags")
            if isinstance(red_flags, list):
                for index, red_flag in enumerate(red_flags):
                    add(
                        f"reader.{reader_name}.red_flags.{index}",
                        red_flag,
                        "mixed",
                        True,
                        evidence_scope="global",
                    )
            if reader_name == "emotional_resonance":
                goosebumps = reader.get("goosebumps_scenes")
                if isinstance(goosebumps, list):
                    for index, scene in enumerate(goosebumps):
                        if not isinstance(scene, Mapping):
                            continue
                        add(
                            f"reader.{reader_name}.goosebumps_scenes.{index}.description",
                            scene.get("description"),
                            "factual",
                            True,
                            scene,
                        )
                        add(
                            f"reader.{reader_name}.goosebumps_scenes.{index}.why_it_works",
                            scene.get("why_it_works"),
                            "mixed",
                            True,
                            scene,
                        )
        elif not current_contract and isinstance(reader, Mapping):
            for field in sorted(reader):
                if field in {
                    "reader", "pillar_score", "sub_scores", "story_vs_situation",
                }:
                    continue
                add_nested_assertions(
                    f"reader.{reader_name}.{field}",
                    f"{reader_name}.{field}",
                    reader[field],
                    reader,
                )
    character_reader = reader_reports.get("character")
    story_gate = (
        character_reader.get("story_vs_situation")
        if isinstance(character_reader, Mapping)
        else None
    )
    story_evidence = story_gate.get("evidence") if isinstance(story_gate, Mapping) else None
    for field in (
        "human_condition",
        "tests_character",
        "twists_reveal_character",
        "emotional_shift",
        "moral_component_driven",
    ):
        if isinstance(story_gate, Mapping) and type(story_gate.get(field)) is bool:
            add(
                f"story_gate.{field}",
                f"The screenplay satisfies the story gate '{field}': {story_gate[field]}.",
                "evaluative",
                True,
                story_evidence.get(field) if isinstance(story_evidence, Mapping) else None,
            )

    if len(targets) < 10:
        raise ValueError("claim verification requires at least ten material claims")
    return targets


def _schema_version(analysis_version: str) -> str:
    if analysis_version == "v9_archaeology":
        return ANALYSIS_SCHEMA_VERSION
    if analysis_version == "v9_triage":
        return TRIAGE_SCHEMA_VERSION
    raise ValueError("Only V9 analyses can receive this trust manifest")


def _canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def _transport_canonical_json(value: Any) -> str:
    """Match the provider/candidate JSON fingerprint across Python and JS."""
    def normalize(item: Any) -> Any:
        if isinstance(item, float) and item.is_integer():
            return int(item)
        if isinstance(item, list):
            return [normalize(child) for child in item]
        if isinstance(item, dict):
            return {key: normalize(child) for key, child in item.items()}
        return item

    return _canonical_json(normalize(value))


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _analysis_payload_sha256(analysis: Any) -> str:
    if not isinstance(analysis, dict):
        raise ValueError("analysis must be an object")
    return _sha256_bytes(_canonical_json(analysis).encode("utf-8"))


def _sha256_file(path: Path) -> str:
    try:
        return _sha256_bytes(path.read_bytes())
    except OSError as error:
        raise ValueError(f"Trust source file is unavailable: {path.name}") from error


@lru_cache(maxsize=1)
def _code_fingerprints() -> Dict[str, str]:
    engine_path = _ROOT / "ingest_v9.py"
    parser_path = _ROOT / "parse_screenplay_pdf_v2.py"
    story_grid_source_path = _ROOT / "story_grid.py"
    story_grid_path = _ROOT / "story_grid.json"
    verdict_contract_path = _ROOT / "verdict_contract.py"
    source_evidence_path = _ROOT / "source_evidence.py"
    trap_contract_path = _ROOT / "v9_trap_contract.json"
    manifest_path = Path(__file__).resolve()

    engine_hash = _sha256_file(engine_path)
    story_grid_source_hash = _sha256_file(story_grid_source_path)
    story_grid_hash = _sha256_file(story_grid_path)
    verdict_contract_hash = _sha256_file(verdict_contract_path)
    source_evidence_hash = _sha256_file(source_evidence_path)
    trap_contract_hash = _sha256_file(trap_contract_path)
    return {
        "engine_source_sha256": engine_hash,
        "parser_source_sha256": _sha256_file(parser_path),
        "story_grid_source_sha256": story_grid_source_hash,
        "story_grid_sha256": story_grid_hash,
        "verdict_contract_sha256": verdict_contract_hash,
        "source_evidence_sha256": source_evidence_hash,
        "trap_contract_sha256": trap_contract_hash,
        "manifest_builder_sha256": _sha256_file(manifest_path),
        # Conservative by design: any engine or Story Grid change invalidates
        # this bundle even if the edit was outside a prompt literal.
        "prompt_bundle_sha256": _sha256_bytes(
            (
                f"{engine_hash}:{story_grid_source_hash}:{story_grid_hash}:"
                f"{verdict_contract_hash}:{source_evidence_hash}:"
                f"{trap_contract_hash}"
            ).encode("utf-8")
        ),
    }


def benchmark_contract_fingerprints() -> Dict[str, str]:
    """Expose the sealed engine fingerprints without copying prompt logic."""
    return {
        **_code_fingerprints(),
        "analysis_schema_version": ANALYSIS_SCHEMA_VERSION,
        "triage_schema_version": TRIAGE_SCHEMA_VERSION,
        "prompt_contract_version": PROMPT_CONTRACT_VERSION,
        "scoring_code_version": SCORING_CODE_VERSION,
        "trap_contract_version": TRAP_CONTRACT_VERSION,
        "trust_manifest_version": TRUST_MANIFEST_VERSION,
    }


def _require_sha256(value: Any, label: str) -> str:
    normalized = str(value or "").lower()
    if not _SHA256_PATTERN.fullmatch(normalized):
        raise ValueError(f"{label} must be a lowercase SHA-256 hash")
    return normalized


def _require_nonempty_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} must be a non-empty string")
    return value.strip()


def _canonical_correction_source(value: Any, label: str) -> Dict[str, Any]:
    required = {
        "source_response_id",
        "source_request_sha256",
        "source_attempt_number",
        "rejected_output_sha256",
        "rejected_artifact_sha256",
        "replay_report_sha256",
    }
    if not isinstance(value, dict) or set(value) != required:
        raise ValueError(f"{label} must be an exact correction source object")
    source_attempt = value["source_attempt_number"]
    if type(source_attempt) is not int or source_attempt < 1:
        raise ValueError(f"{label}.source_attempt_number is invalid")
    artifact_sha256 = value["rejected_artifact_sha256"]
    if artifact_sha256 is not None:
        artifact_sha256 = _require_sha256(
            artifact_sha256,
            f"{label}.rejected_artifact_sha256",
        )
    return {
        "source_response_id": _require_nonempty_string(
            value["source_response_id"],
            f"{label}.source_response_id",
        ),
        "source_request_sha256": _require_sha256(
            value["source_request_sha256"],
            f"{label}.source_request_sha256",
        ),
        "source_attempt_number": source_attempt,
        "rejected_output_sha256": _require_sha256(
            value["rejected_output_sha256"],
            f"{label}.rejected_output_sha256",
        ),
        "rejected_artifact_sha256": artifact_sha256,
        "replay_report_sha256": _require_sha256(
            value["replay_report_sha256"],
            f"{label}.replay_report_sha256",
        ),
    }


def _canonical_correction_replay(value: Any, label: str) -> Dict[str, Any]:
    required = {
        "delivery_state",
        "target_call_id",
        "target_response_id",
        "target_response_id_status",
        "target_request_sha256",
        "target_prompt_sha256",
        "target_attempt_number",
        "replay_report_sha256",
    }
    if not isinstance(value, dict) or set(value) != required:
        raise ValueError(f"{label} must be an exact correction replay object")
    target_attempt = value["target_attempt_number"]
    if type(target_attempt) is not int or target_attempt < 2:
        raise ValueError(f"{label}.target_attempt_number is invalid")
    delivery_state = value["delivery_state"]
    if delivery_state not in {
        "settled_after_dispatch",
        "uncertain_after_dispatch",
    }:
        raise ValueError(f"{label}.delivery_state is invalid")
    target_call_id = value["target_call_id"]
    if target_call_id is not None:
        target_call_id = _require_sha256(
            target_call_id,
            f"{label}.target_call_id",
        )
    target_response_id = value["target_response_id"]
    response_id_status = value["target_response_id_status"]
    if target_response_id is None:
        if response_id_status != "unavailable":
            raise ValueError(f"{label}.target_response_id_status is inconsistent")
    else:
        target_response_id = _require_nonempty_string(
            target_response_id,
            f"{label}.target_response_id",
        )
        if response_id_status != "available":
            raise ValueError(f"{label}.target_response_id_status is inconsistent")
    return {
        "delivery_state": delivery_state,
        "target_call_id": target_call_id,
        "target_response_id": target_response_id,
        "target_response_id_status": response_id_status,
        "target_request_sha256": _require_sha256(
            value["target_request_sha256"],
            f"{label}.target_request_sha256",
        ),
        "target_prompt_sha256": _require_sha256(
            value["target_prompt_sha256"],
            f"{label}.target_prompt_sha256",
        ),
        "target_attempt_number": target_attempt,
        "replay_report_sha256": _require_sha256(
            value["replay_report_sha256"],
            f"{label}.replay_report_sha256",
        ),
    }


_CORRECTION_PREDISPATCH_FAILURE_STATES = {
    "LlmPreCallRetryableError",
    "benchmark_cap_exceeded",
    "candidate_contract_rejected_before_dispatch",
    "candidate_provider_configuration_unavailable",
    "duplicate_call_blocked",
    "pre_call_accounting_unavailable",
}
_CORRECTION_SETTLED_FAILURE_STATES = {
    "candidate_call_id_mismatch",
    "candidate_release_mismatch",
    "cost_reconciliation_mismatch",
    "missing_stop_reason",
    "model_provenance_mismatch",
    "provider_rejected_before_generation",
}


def correction_delivery_state_for_call(
    call: Mapping[str, Any],
    *,
    successful: bool,
) -> Optional[str]:
    """Derive correction delivery from evidence, never from its claimed label."""
    if successful:
        return "settled_after_dispatch"
    if (
        call.get("uncertainty_status") == "proven_zero_spend_pre_generation"
        or call.get("failure_state") in _CORRECTION_PREDISPATCH_FAILURE_STATES
    ):
        return None
    if (
        isinstance(call.get("response_id"), str)
        and bool(call["response_id"].strip())
    ) or (
        call.get("rejected_output_status") == "available"
        or call.get("uncertainty_status") == "settled_after_ambiguous_ack"
        or call.get("failure_state") in _CORRECTION_SETTLED_FAILURE_STATES
    ):
        return "settled_after_dispatch"
    return "uncertain_after_dispatch"


def correction_release_lineage_matches(
    source: Mapping[str, Any],
    target: Mapping[str, Any],
    *,
    successful: bool,
) -> bool:
    """Allow an uncertain failed target to lack a returned release, never an expected one."""
    source_release = source.get("release")
    source_expected_release = source.get("expected_release")
    target_expected_release = target.get("expected_release")
    if source_expected_release is None and target_expected_release is not None:
        source_expected_release = source_release
    if source_expected_release != target_expected_release:
        return False
    if (
        source_expected_release is not None
        and source_release != source_expected_release
    ):
        return False
    if target.get("failure_state") == "candidate_release_mismatch":
        return True
    target_release = target.get("release")
    return (
        not successful and target_release is None
    ) or source_release == target_release


def correction_call_lineage_matches(
    source: Mapping[str, Any],
    target: Mapping[str, Any],
) -> bool:
    """Keep correction routing fixed while requiring its call-specific schema."""
    if any(
        source.get(field) != target.get(field)
        for field in (
            "stage",
            "pipeline_pass",
            "boundary_run",
            "reader_name",
            "requested_model",
            "prompt_contract_version",
        )
    ):
        return False

    if source.get("prompt_contract_version") not in (
        TARGETED_CORRECTION_PROMPT_CONTRACT_VERSIONS
    ):
        return all(
            source.get(field) == target.get(field)
            for field in (
                "schema_mode",
                "schema_sha256",
                "transport_schema_sha256",
            )
        )

    source_schema = source.get("schema_sha256")
    target_schema = target.get("schema_sha256")
    return (
        source.get("schema_mode") == "compact_strict_tool"
        and target.get("schema_mode") == "strict_tool"
        and isinstance(source_schema, str)
        and isinstance(target_schema, str)
        and source_schema != target_schema
        and target.get("transport_schema_sha256") == target_schema
        and source.get("prompt_sha256") != target.get("prompt_sha256")
    )


def uses_targeted_correction_schema(call: Mapping[str, Any]) -> bool:
    """Identify current reader/synthesis correction calls before lineage binding."""
    return (
        call.get("prompt_contract_version")
        in TARGETED_CORRECTION_PROMPT_CONTRACT_VERSIONS
        and call.get("stage") in {"reader", "synthesis"}
        and call.get("logical_retry") == 1
    )


def validate_correction_chronology(
    source: Mapping[str, Any],
    target: Mapping[str, Any],
) -> None:
    """Reject correction links that run backward in time or paid-ledger order."""
    try:
        source_completed = datetime.fromisoformat(
            str(source["completed_at"]).replace("Z", "+00:00")
        )
        target_started = datetime.fromisoformat(
            str(target["started_at"]).replace("Z", "+00:00")
        )
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError("correction replay timestamps are incomplete") from error
    if (
        source_completed.tzinfo is None
        or target_started.tzinfo is None
        or source_completed > target_started
    ):
        raise ValueError("correction replay chronology is inconsistent")
    source_budget = source.get("budget_check")
    target_budget = target.get("budget_check")
    if isinstance(source_budget, dict) and isinstance(target_budget, dict):
        source_sequence = source_budget.get("sequence")
        target_sequence = target_budget.get("sequence")
        if (
            type(source_sequence) is int
            and type(target_sequence) is int
            and source_sequence >= target_sequence
        ):
            raise ValueError("correction replay budget sequence is inconsistent")


def _validated_archive_pointer(
    storage_path: Any,
    storage_generation: Any,
    *,
    project_id: str,
    version_id: str,
) -> tuple[str, str]:
    path = _require_nonempty_string(
        storage_path,
        "immutable source archive path",
    )
    if "/" in project_id or "/" in version_id:
        raise ValueError("Archive project and version IDs must be safe path components")
    if not path.startswith("gs://"):
        raise ValueError("Immutable source archive must use an explicit gs:// path")
    bucket_name, separator, object_name = path[5:].partition("/")
    expected_object = f"screenplays/{project_id}/versions/{version_id}.pdf"
    if not separator or not bucket_name or object_name != expected_object:
        raise ValueError(
            "Immutable source archive path does not match the project version"
        )

    generation = _require_nonempty_string(
        str(storage_generation or ""),
        "immutable source archive generation",
    )
    if not generation.isdigit() or int(generation) <= 0:
        raise ValueError(
            "Immutable source archive generation must be a positive integer"
        )
    return path, generation


def _analyzed_source_file(raw: Dict[str, Any]) -> str:
    """Return the analyzed filename for a version or validated parent projection."""
    source_file = _require_nonempty_string(raw.get("source_file"), "source_file")
    latest_source_file = raw.get("latest_source_file")
    if latest_source_file is None:
        return source_file

    analyzed_file = _require_nonempty_string(
        latest_source_file,
        "latest_source_file",
    )
    project_id = _require_nonempty_string(raw.get("project_id"), "project_id")
    version_id = _require_nonempty_string(raw.get("version_id"), "version_id")
    if raw.get("latest_version_id") != version_id:
        raise ValueError("Parent projection latest version does not match analysis")
    if raw.get("_docId") != project_id:
        raise ValueError("Parent projection document ID does not match analysis")
    version_count = raw.get("version_count")
    if type(version_count) is not int or version_count <= 0:
        raise ValueError("Parent projection version count is invalid")
    _require_nonempty_string(raw.get("_savedAt"), "parent projection saved time")
    return analyzed_file


def _require_number(value: Any, label: str) -> float:
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(float(value))
    ):
        raise ValueError(f"{label} must be a finite number")
    return float(value)


def _queued_iso(queued_at_ms: int) -> str:
    if type(queued_at_ms) is not int or queued_at_ms < 0:
        raise ValueError("queued_at_ms must be a non-negative integer")
    return (
        datetime.fromtimestamp(queued_at_ms / 1000, tz=timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _sanitized_calibration(raw: Any) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        return {"applied": False}
    if "prompt" in raw:
        raise ValueError("Calibration prompt text must never be stored in the trust manifest")

    applied = raw.get("applied") is True
    result: Dict[str, Any] = {"applied": applied}
    for key in (
        "profile_id",
        "profile_version_id",
        "last_calibrated",
        "total_reviews",
        "compiler_model_id",
        "fallback_reason",
        "validation_error",
    ):
        if key in raw and raw[key] is not None:
            result[key] = raw[key]
    if applied:
        result["prompt_sha256"] = _require_sha256(
            raw.get("prompt_sha256"),
            "calibration prompt_sha256",
        )
        if raw.get("profile_version_id") is not None:
            result["source_assessment_set_sha256"] = _require_sha256(
                raw.get("source_assessment_set_sha256"),
                "calibration source_assessment_set_sha256",
            )
    return result


def _canonical_attempt_history(raw_attempts: Any) -> List[Dict[str, Any]]:
    """Keep only bounded transport identifiers in sealed retry telemetry."""
    if not isinstance(raw_attempts, list):
        raise ValueError("attempt history must be a list")
    result: List[Dict[str, Any]] = []
    identifier_patterns = {
        "response_id": r"[A-Za-z0-9._:-]+",
        "error_type": r"[A-Za-z][A-Za-z0-9_.]*",
        "failure_state": r"[A-Za-z][A-Za-z0-9_]*",
        "call_id": r"[A-Za-z0-9._:/-]+",
        "uncertainty_status": r"[a-z][a-z0-9_]*",
    }
    for index, raw_attempt in enumerate(raw_attempts):
        if not isinstance(raw_attempt, dict):
            raise ValueError(f"attempt history[{index}] must be an object")
        attempt_number = raw_attempt.get("attempt")
        if type(attempt_number) is not int or attempt_number <= 0:
            raise ValueError(f"attempt history[{index}].attempt must be positive")
        outcome = raw_attempt.get("outcome")
        if outcome not in {"failed", "success"}:
            raise ValueError(f"attempt history[{index}].outcome is invalid")
        record: Dict[str, Any] = {
            "attempt": attempt_number,
            "outcome": outcome,
        }
        for field, pattern in identifier_patterns.items():
            if field not in raw_attempt:
                continue
            value = _canonical_optional_identifier(
                raw_attempt[field],
                f"attempt history[{index}].{field}",
            )
            if value is None or re.fullmatch(pattern, value) is None:
                raise ValueError(f"attempt history[{index}].{field} is invalid")
            record[field] = value
        if "http_status" in raw_attempt:
            status = raw_attempt["http_status"]
            if status is not None and (
                type(status) is not int or not 100 <= status <= 599
            ):
                raise ValueError(f"attempt history[{index}].http_status is invalid")
            record["http_status"] = status
        if outcome == "failed" and "error_type" not in record:
            raise ValueError(
                f"attempt history[{index}] failed attempt lacks error_type"
            )
        if outcome == "success":
            if "response_id" not in record:
                raise ValueError(
                    f"attempt history[{index}] success lacks response_id"
                )
            failure_only_fields = {
                "error_type", "failure_state", "http_status", "uncertainty_status",
            }
            contradictory = failure_only_fields.intersection(raw_attempt)
            if contradictory:
                raise ValueError(
                    f"attempt history[{index}] success has failure-only fields"
                )
        result.append(record)
    return result


def _canonical_transformation_evidence(raw_evidence: Any) -> List[Dict[str, Any]]:
    """Seal transformation identity and hashes, never raw before/after payloads."""
    if not isinstance(raw_evidence, list):
        raise ValueError("transformation evidence must be a list")
    result: List[Dict[str, Any]] = []
    for evidence in raw_evidence:
        if not isinstance(evidence, dict):
            raise ValueError("transformation evidence entries must be objects")
        before_sha256 = evidence.get("before_sha256")
        after_sha256 = evidence.get("after_sha256")
        if before_sha256 is None or after_sha256 is None:
            before_sha256 = _sha256_bytes(
                _canonical_json(evidence.get("before")).encode("utf-8")
            )
            after_sha256 = _sha256_bytes(
                _canonical_json(evidence.get("after")).encode("utf-8")
            )
        changed = evidence.get("changed")
        if type(changed) is not bool:
            raise ValueError("transformation evidence changed flag must be boolean")
        before_sha256 = _require_sha256(
            before_sha256,
            "transformation before hash",
        )
        after_sha256 = _require_sha256(
            after_sha256,
            "transformation after hash",
        )
        if changed != (before_sha256 != after_sha256):
            raise ValueError("transformation evidence changed flag contradicts its hashes")
        name = _require_nonempty_string(
            evidence.get("name"),
            "transformation evidence name",
        )
        record = {
            "name": name,
            "changed": changed,
            "before_sha256": before_sha256,
            "after_sha256": after_sha256,
        }
        if name == "accepted_revision_safe_citation_equivalence":
            match_count = evidence.get("match_count")
            if (
                evidence.get("policy") != CITATION_MATCH_POLICY_VERSION
                or type(match_count) is not int
                or match_count < 1
            ):
                raise ValueError(
                    "revision-safe citation transformation evidence is invalid"
                )
            record.update({
                "policy": CITATION_MATCH_POLICY_VERSION,
                "match_count": match_count,
            })
        elif "policy" in evidence or "match_count" in evidence:
            raise ValueError("unexpected transformation policy evidence")
        result.append(record)
    return result


def _canonical_bounded_strings(
    raw_values: Any,
    label: str,
    *,
    max_length: int,
) -> List[str]:
    if not isinstance(raw_values, list):
        raise ValueError(f"{label} must be a list")
    result: List[str] = []
    for index, value in enumerate(raw_values):
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{label}[{index}] must be a non-empty string")
        normalized = value.strip()
        if len(normalized) > max_length or "\x00" in normalized:
            raise ValueError(f"{label}[{index}] exceeds its safe telemetry bound")
        result.append(normalized)
    return result


def _canonical_optional_identifier(value: Any, label: str) -> Optional[str]:
    if value is None:
        return None
    normalized = _require_nonempty_string(value, label)
    if len(normalized) > 256 or "\x00" in normalized:
        raise ValueError(f"{label} exceeds its safe telemetry bound")
    return normalized


def _canonical_stop_reason(value: Any, label: str, *, allow_empty: bool = False) -> str:
    if allow_empty and value in (None, ""):
        return ""
    normalized = _require_nonempty_string(value, label)
    if normalized not in _PROVIDER_STOP_REASONS:
        raise ValueError(f"{label} is not a recognized provider stop reason")
    return normalized


def _canonical_release_provenance(raw_release: Any, label: str) -> Optional[Dict[str, Any]]:
    if raw_release is None:
        return None
    if not isinstance(raw_release, dict):
        raise ValueError(f"{label} must be an object or null")
    result: Dict[str, Any] = {}
    if "git_sha" in raw_release:
        git_sha = _require_nonempty_string(raw_release["git_sha"], f"{label}.git_sha")
        if re.fullmatch(r"[a-f0-9]{40}", git_sha) is None:
            raise ValueError(f"{label}.git_sha is invalid")
        result["git_sha"] = git_sha
    if "source_clean" in raw_release:
        if type(raw_release["source_clean"]) is not bool:
            raise ValueError(f"{label}.source_clean must be boolean")
        result["source_clean"] = raw_release["source_clean"]
    for field in ("catalog_sha256", "pricing_sha256", "deployment_config_sha256"):
        if field in raw_release:
            result[field] = _require_sha256(raw_release[field], f"{label}.{field}")
    if "build_timestamp" in raw_release:
        build_timestamp = _require_nonempty_string(
            raw_release["build_timestamp"],
            f"{label}.build_timestamp",
        )
        try:
            parsed = datetime.fromisoformat(build_timestamp.replace("Z", "+00:00"))
        except ValueError as error:
            raise ValueError(f"{label}.build_timestamp is invalid") from error
        if parsed.tzinfo is None:
            raise ValueError(f"{label}.build_timestamp is invalid")
        result["build_timestamp"] = build_timestamp
    if "cloud_run_revision" in raw_release:
        revision = _require_nonempty_string(
            raw_release["cloud_run_revision"],
            f"{label}.cloud_run_revision",
        )
        if re.fullmatch(r"llmproxycandidate-[0-9]{5}-[a-z0-9]{3}", revision) is None:
            raise ValueError(f"{label}.cloud_run_revision is invalid")
        result["cloud_run_revision"] = revision
    if "inference_geo" in raw_release:
        inference_geo = raw_release["inference_geo"]
        if inference_geo not in {"global", "us"}:
            raise ValueError(f"{label}.inference_geo is invalid")
        result["inference_geo"] = inference_geo
    if raw_release and not result:
        raise ValueError(f"{label} contains no recognized release provenance")
    return {
        field: result[field]
        for field in _RELEASE_PROVENANCE_FIELDS
        if field in result
    }


def _canonical_budget_check(raw_check: Any, label: str) -> Optional[Dict[str, Any]]:
    if raw_check is None:
        return None
    if not isinstance(raw_check, dict):
        raise ValueError(f"{label} must be an object or null")
    result: Dict[str, Any] = {}
    for field in ("requested_model", "stage"):
        if field in raw_check:
            result[field] = _canonical_optional_identifier(
                raw_check[field],
                f"{label}.{field}",
            )
    if "decision" in raw_check:
        decision = raw_check["decision"]
        if decision not in _BUDGET_DECISIONS:
            raise ValueError(f"{label}.decision is invalid")
        result["decision"] = decision
    for field in _BUDGET_INTEGER_FIELDS:
        if field not in raw_check:
            continue
        value = raw_check[field]
        if type(value) is not int or value < 0:
            raise ValueError(f"{label}.{field} must be non-negative")
        result[field] = value
    for field in _BUDGET_USD_FIELDS:
        if field not in raw_check:
            continue
        value = raw_check[field]
        if (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(float(value))
            or float(value) < 0
        ):
            raise ValueError(f"{label}.{field} must be a non-negative finite number")
        result[field] = float(value)
    for prefix in _BUDGET_MONEY_PREFIXES:
        micros_field = f"{prefix}_microusd"
        usd_field = f"{prefix}_usd"
        if (micros_field in raw_check) != (usd_field in raw_check):
            raise ValueError(f"{label}.{prefix} cost mirrors must both be present")
        if micros_field in raw_check and abs(
            result[usd_field] - result[micros_field] / 1_000_000
        ) > 1e-12:
            raise ValueError(f"{label}.{prefix} cost mirrors are inconsistent")
    byte_fields = (
        "request_content_bytes",
        "request_envelope_overhead_bytes",
        "request_bytes_upper_bound",
    )
    if any(field in result for field in byte_fields):
        if not all(field in result for field in byte_fields):
            raise ValueError(f"{label} request byte accounting is incomplete")
        if (
            result["request_content_bytes"]
            + result["request_envelope_overhead_bytes"]
            != result["request_bytes_upper_bound"]
        ):
            raise ValueError(f"{label} request byte accounting is inconsistent")
        if (
            "input_tokens_upper_bound" in result
            and result["input_tokens_upper_bound"]
            != result["request_bytes_upper_bound"] + 4_096
        ):
            raise ValueError(f"{label} input token ceiling is inconsistent")
    if "spent_after_microusd" in result or "settled_cost_microusd" in result:
        if not all(
            field in result
            for field in (
                "spent_before_microusd",
                "settled_cost_microusd",
                "spent_after_microusd",
            )
        ):
            raise ValueError(f"{label} spend transition is incomplete")
        if (
            result["spent_before_microusd"]
            + result["settled_cost_microusd"]
            != result["spent_after_microusd"]
        ):
            raise ValueError(f"{label} spend transition is inconsistent")
    if "reserved_after_microusd" in result:
        if "reserved_before_microusd" not in result:
            raise ValueError(f"{label} reservation transition is incomplete")
        if result["reserved_after_microusd"] != result["reserved_before_microusd"]:
            raise ValueError(f"{label} reservation transition is inconsistent")
    if "preflight_ceiling_exceeded" in raw_check:
        if type(raw_check["preflight_ceiling_exceeded"]) is not bool:
            raise ValueError(f"{label}.preflight_ceiling_exceeded must be boolean")
        result["preflight_ceiling_exceeded"] = raw_check[
            "preflight_ceiling_exceeded"
        ]
    settlement_decisions = {
        "charged_conservative_invalid_settlement",
        "charged_conservative_uncertain_ceiling",
        "proven_zero_spend_failure",
        "settled",
        "settled_exceeds_preflight_ceiling",
        "settled_failure",
        "settled_failure_exceeds_preflight_ceiling",
    }
    decision = result.get("decision")
    if decision in settlement_decisions:
        if not all(
            field in result
            for field in ("settled_cost_microusd", "request_ceiling_microusd")
        ):
            raise ValueError(f"{label} settlement decision lacks exact costs")
        settled_exceeded = (
            result["settled_cost_microusd"]
            > result["request_ceiling_microusd"]
        )
        decision_reports_exceeded = decision in {
            "settled_exceeds_preflight_ceiling",
            "settled_failure_exceeds_preflight_ceiling",
        }
        if settled_exceeded != decision_reports_exceeded:
            raise ValueError(f"{label} settlement decision contradicts its costs")
        if (
            "preflight_ceiling_exceeded" in result
            and result["preflight_ceiling_exceeded"] != settled_exceeded
        ):
            raise ValueError(f"{label} preflight ceiling flag contradicts its costs")
        if decision in {
            "charged_conservative_invalid_settlement",
            "charged_conservative_uncertain_ceiling",
        } and result["settled_cost_microusd"] != result["request_ceiling_microusd"]:
            raise ValueError(f"{label} conservative charge does not equal its ceiling")
        if (
            decision == "proven_zero_spend_failure"
            and result["settled_cost_microusd"] != 0
        ):
            raise ValueError(f"{label} zero-spend decision has a nonzero settlement")
    if "platform_recheck" in raw_check:
        result["platform_recheck_sha256"] = _sha256_bytes(
            _canonical_json(raw_check["platform_recheck"]).encode("utf-8")
        )
    platform_failure = raw_check.get("platform_failure")
    if platform_failure is not None:
        if not isinstance(platform_failure, dict):
            raise ValueError(f"{label}.platform_failure must be an object")
        failure_type = _canonical_optional_identifier(
            platform_failure.get("type"),
            f"{label}.platform_failure.type",
        )
        if failure_type is None or re.fullmatch(r"[A-Za-z][A-Za-z0-9_.]*", failure_type) is None:
            raise ValueError(f"{label}.platform_failure.type is invalid")
        result["platform_failure_type"] = failure_type
    return result


def _canonical_usage_by_model(raw_by_model: Any) -> Dict[str, Dict[str, int]]:
    if not isinstance(raw_by_model, dict):
        raise ValueError("usage.by_model must be an object")
    return {
        str(model): {
            field: int(totals[field])
            for field in USAGE_COUNTER_FIELDS
        }
        for model, totals in raw_by_model.items()
        if isinstance(totals, dict)
    }


def _model_lineage(
    *,
    usage: Any,
    selection_request: str,
    pipeline_model_tier: str,
    effective_model_tier: str,
    model_ids: Mapping[str, str],
    cold_read_model_route: Optional[str] = None,
    manifest_version: str = TRUST_MANIFEST_VERSION,
    prompt_contract_version: str = PROMPT_CONTRACT_VERSION,
) -> Dict[str, Any]:
    if not isinstance(usage, dict):
        raise ValueError("usage must be an object")

    selection = _require_nonempty_string(
        selection_request,
        "selection_request",
    )
    pipeline_tier = _require_nonempty_string(
        pipeline_model_tier,
        "pipeline_model_tier",
    )
    effective_tier = _require_nonempty_string(
        effective_model_tier,
        "effective_model_tier",
    )
    if effective_tier not in model_ids:
        raise ValueError("effective_model_tier has no exact model ID")
    effective_model_id = _require_nonempty_string(
        model_ids[effective_tier],
        "effective model ID",
    )
    model_ids_by_tier = {
        _require_nonempty_string(tier, "model tier"): _require_nonempty_string(
            model_id,
            f"model ID for {tier}",
        )
        for tier, model_id in model_ids.items()
    }
    if "haiku" not in model_ids_by_tier:
        raise ValueError("model ID map must include Haiku for routing verification")
    if cold_read_model_route not in {None, "haiku", "sonnet"}:
        raise ValueError("cold-read model route must be haiku or sonnet")
    expected_prompt_contract_version = _require_nonempty_string(
        prompt_contract_version,
        "prompt contract version",
    )
    if expected_prompt_contract_version not in SUPPORTED_PROMPT_CONTRACT_VERSIONS:
        raise ValueError("Unsupported prompt contract version")

    if pipeline_tier == "hybrid":
        planned_tiers = [tier for tier in ("sonnet", "opus") if tier in model_ids]
    else:
        planned_tiers = [pipeline_tier]
    try:
        planned_model_ids = [
            _require_nonempty_string(model_ids[tier], f"model ID for {tier}")
            for tier in planned_tiers
        ]
    except KeyError as error:
        raise ValueError(f"pipeline model tier has no exact model ID: {error.args[0]}") from error

    by_model = usage.get("by_model")
    if not isinstance(by_model, dict) or not by_model:
        raise ValueError("usage.by_model must contain exact returned model IDs")
    returned_model_ids = sorted(
        _require_nonempty_string(model, "returned model ID")
        for model in by_model
    )
    if effective_model_id not in returned_model_ids:
        raise ValueError("effective model ID is absent from usage.by_model")

    call_count = usage.get("call_count")
    if type(call_count) is not int or call_count <= 0:
        raise ValueError("usage.call_count must be a positive integer")
    calls = usage.get("calls")
    if not isinstance(calls, list) or len(calls) != call_count:
        raise ValueError("usage.calls must identify every successful model call")

    call_records = []
    response_ids = []
    requested_model_ids = set()
    for index, raw_call in enumerate(calls):
        if not isinstance(raw_call, dict):
            raise ValueError(f"usage.calls[{index}] must be an object")
        response_id = _require_nonempty_string(
            raw_call.get("response_id"),
            f"usage.calls[{index}].response_id",
        )
        requested_model = _require_nonempty_string(
            raw_call.get("requested_model"),
            f"usage.calls[{index}].requested_model",
        )
        returned_model = _require_nonempty_string(
            raw_call.get("returned_model"),
            f"usage.calls[{index}].returned_model",
        )
        if returned_model not in returned_model_ids:
            raise ValueError(
                f"usage.calls[{index}].returned_model is absent from usage.by_model"
            )
        stop_reason = _canonical_stop_reason(
            raw_call.get("stop_reason"),
            f"usage.calls[{index}].stop_reason",
        )
        successful_attempt = raw_call.get("successful_attempt")
        if type(successful_attempt) is not int or successful_attempt <= 0:
            raise ValueError(
                f"usage.calls[{index}].successful_attempt must be a positive integer"
            )
        retry_history = raw_call.get("retry_history")
        if not isinstance(retry_history, list) or len(retry_history) != successful_attempt:
            raise ValueError(
                f"usage.calls[{index}].retry_history must identify every attempt"
            )
        for retry_index, raw_attempt in enumerate(retry_history, start=1):
            if not isinstance(raw_attempt, dict):
                raise ValueError(
                    f"usage.calls[{index}].retry_history[{retry_index - 1}] "
                    "must be an object"
                )
            if raw_attempt.get("attempt") != retry_index:
                raise ValueError(
                    f"usage.calls[{index}].retry_history attempts must be sequential"
                )
            expected_outcome = (
                "success" if retry_index == successful_attempt else "failed"
            )
            if raw_attempt.get("outcome") != expected_outcome:
                raise ValueError(
                    f"usage.calls[{index}].retry_history has an invalid outcome"
                )
        if retry_history[-1].get("response_id") != response_id:
            raise ValueError(
                f"usage.calls[{index}].retry_history success lacks its response_id"
            )
        stage = _require_nonempty_string(
            raw_call.get("stage"),
            f"usage.calls[{index}].stage",
        )
        if stage not in {
            "claim_verification", "genre_detection", "reader", "synthesis", "triage",
        }:
            raise ValueError(f"usage.calls[{index}] has an invalid stage")
        pipeline_pass = _require_nonempty_string(
            raw_call.get("pipeline_pass"),
            f"usage.calls[{index}].pipeline_pass",
        )
        boundary_run = raw_call.get("boundary_run")
        if type(boundary_run) is not int or boundary_run < 1:
            raise ValueError(
                f"usage.calls[{index}].boundary_run must be a positive integer"
            )
        reader_name = raw_call.get("reader_name")
        if reader_name is not None and (
            not isinstance(reader_name, str) or not reader_name
        ):
            raise ValueError(
                f"usage.calls[{index}].reader_name must be null or a name"
            )
        if not _valid_stage_reader_name(stage, reader_name):
            raise ValueError(
                f"usage.calls[{index}] has invalid stage-specific call lineage"
            )
        disposition = _require_nonempty_string(
            raw_call.get("disposition"),
            f"usage.calls[{index}].disposition",
        )
        if disposition not in {"used", "discarded_unusable"}:
            raise ValueError(
                f"usage.calls[{index}] has an unresolved disposition"
            )
        call_provenance = None
        correction_source = None
        correction_replay = None
        correction_delivery_state = None
        rejected_output_sha256 = None
        rejected_artifact_sha256 = None
        if (
            manifest_version == TRUST_MANIFEST_VERSION
            or raw_call.get("request_sha256") is not None
        ):
            schema_mode = _require_nonempty_string(
                raw_call.get("schema_mode"),
                f"usage.calls[{index}].schema_mode",
            )
            if schema_mode not in {
                "schema_free",
                "strict_tool",
                "compact_strict_tool",
            }:
                raise ValueError(
                    f"usage.calls[{index}].schema_mode is invalid"
                )
            schema_sha256 = raw_call.get("schema_sha256")
            transport_schema_sha256 = raw_call.get("transport_schema_sha256")
            if schema_mode == "schema_free":
                if schema_sha256 is not None or transport_schema_sha256 is not None:
                    raise ValueError(
                        f"usage.calls[{index}] schema-free call has a schema hash"
                    )
            else:
                schema_sha256 = _require_sha256(
                    schema_sha256,
                    f"usage.calls[{index}].schema_sha256",
                )
                transport_schema_sha256 = _require_sha256(
                    transport_schema_sha256,
                    f"usage.calls[{index}].transport_schema_sha256",
                )
            if stage == "triage" and schema_mode != "schema_free":
                raise ValueError(f"usage.calls[{index}] triage must be schema-free")
            if stage == "genre_detection" and schema_mode != "strict_tool":
                raise ValueError(
                    f"usage.calls[{index}] genre detection must use a strict tool"
                )
            expected_scored_schema_mode = (
                "strict_tool"
                if uses_targeted_correction_schema(raw_call)
                else "compact_strict_tool"
            )
            if stage in {
                "claim_verification", "reader", "synthesis",
            } and schema_mode != expected_scored_schema_mode:
                raise ValueError(
                    f"usage.calls[{index}] scored stages must use compact strict tools"
                )

            validation_result = _require_nonempty_string(
                raw_call.get("validation_result"),
                f"usage.calls[{index}].validation_result",
            )
            if disposition == "used" and validation_result != "passed":
                raise ValueError(
                    f"usage.calls[{index}] used output did not pass validation"
                )
            if disposition == "discarded_unusable" and not validation_result.startswith("failed_"):
                raise ValueError(
                    f"usage.calls[{index}] discarded output lacks a failed validation"
                )
            validation_reason = raw_call.get("validation_reason")
            if disposition == "discarded_unusable":
                validation_reason = _require_nonempty_string(
                    validation_reason,
                    f"usage.calls[{index}].validation_reason",
                )
            elif validation_reason is not None:
                raise ValueError(
                    f"usage.calls[{index}] used output cannot carry a validation reason"
                )
            transformations = raw_call.get("transformations")
            transformation_evidence = raw_call.get("transformation_evidence")
            warnings = raw_call.get("warnings")
            if not isinstance(transformations, list) or not all(
                isinstance(value, str) and value for value in transformations
            ):
                raise ValueError(
                    f"usage.calls[{index}].transformations must be a string list"
                )
            if not isinstance(transformation_evidence, list):
                raise ValueError(
                    f"usage.calls[{index}].transformation_evidence must be a list"
                )
            evidence_names = [
                evidence.get("name") if isinstance(evidence, dict) else None
                for evidence in transformation_evidence
            ]
            if (
                len(evidence_names) != len(set(evidence_names))
                or set(evidence_names) != set(transformations)
            ):
                raise ValueError(
                    f"usage.calls[{index}] transformations lack one-to-one evidence"
                )
            for evidence_index, evidence in enumerate(transformation_evidence):
                if (
                    not isinstance(evidence, dict)
                    or evidence.get("name") not in transformations
                    or type(evidence.get("changed")) is not bool
                    or not (
                        {"before", "after"}.issubset(evidence)
                        or {"before_sha256", "after_sha256"}.issubset(evidence)
                    )
                ):
                    raise ValueError(
                        f"usage.calls[{index}].transformation_evidence[{evidence_index}] "
                        "is invalid"
                    )
                if "before_sha256" in evidence:
                    _require_sha256(
                        evidence.get("before_sha256"),
                        "transformation before hash",
                    )
                    _require_sha256(
                        evidence.get("after_sha256"),
                        "transformation after hash",
                    )
            canonical_transformation_evidence = (
                _canonical_transformation_evidence(transformation_evidence)
            )
            if not isinstance(warnings, list) or not all(
                isinstance(value, str) and value for value in warnings
            ):
                raise ValueError(
                    f"usage.calls[{index}].warnings must be a string list"
                )
            downstream = _require_nonempty_string(
                raw_call.get("downstream_consumption"),
                f"usage.calls[{index}].downstream_consumption",
            )
            expected_downstream = (
                {"consumed"}
                if disposition == "used"
                else {
                    "not_consumed",
                    "correction_attempted",
                    "correction_only",
                }
            )
            if downstream not in expected_downstream:
                raise ValueError(
                    f"usage.calls[{index}] downstream state contradicts disposition"
                )
            if raw_call.get("correction_source") is not None:
                correction_source = _canonical_correction_source(
                    raw_call["correction_source"],
                    f"usage.calls[{index}].correction_source",
                )
                correction_delivery_state = raw_call.get(
                    "correction_delivery_state"
                )
                if correction_delivery_state != "settled_after_dispatch":
                    raise ValueError(
                        f"usage.calls[{index}] correction delivery state is invalid"
                    )
            elif raw_call.get("correction_delivery_state") is not None:
                raise ValueError(
                    f"usage.calls[{index}] correction delivery lacks a source"
                )
            if raw_call.get("correction_replay") is not None:
                correction_replay = _canonical_correction_replay(
                    raw_call["correction_replay"],
                    f"usage.calls[{index}].correction_replay",
                )
            if downstream in {
                "correction_attempted",
                "correction_only",
            } and correction_replay is None:
                raise ValueError(
                    f"usage.calls[{index}] correction-only consumption lacks replay lineage"
                )
            if downstream == "not_consumed" and correction_replay is not None:
                raise ValueError(
                    f"usage.calls[{index}] has replay lineage without correction-only consumption"
                )
            if correction_replay is not None and downstream != (
                "correction_only"
                if correction_replay["delivery_state"] == "settled_after_dispatch"
                else "correction_attempted"
            ):
                raise ValueError(
                    f"usage.calls[{index}] correction delivery contradicts downstream state"
                )
            if correction_source is not None and stage not in {"reader", "synthesis"}:
                raise ValueError(
                    f"usage.calls[{index}] correction source is invalid for its stage"
                )
            if uses_targeted_correction_schema(raw_call) and correction_source is None:
                raise ValueError(
                    f"usage.calls[{index}] targeted correction lacks its source"
                )
            targeted_correction_evidence = next(
                (
                    evidence
                    for evidence in canonical_transformation_evidence
                    if evidence["name"] == "merged_targeted_correction"
                ),
                None,
            )
            if uses_targeted_correction_schema(raw_call):
                if disposition == "used" and targeted_correction_evidence is None:
                    raise ValueError(
                        f"usage.calls[{index}] used targeted correction lacks merge evidence"
                    )
                if targeted_correction_evidence is not None and (
                    targeted_correction_evidence["changed"] is not True
                    or targeted_correction_evidence["before_sha256"]
                    != correction_source["replay_report_sha256"]
                ):
                    raise ValueError(
                        f"usage.calls[{index}] targeted correction merge evidence is invalid"
                    )
            elif targeted_correction_evidence is not None:
                raise ValueError(
                    f"usage.calls[{index}] non-targeted call carries targeted correction evidence"
                )
            if correction_replay is not None:
                rejected_output_sha256 = _require_sha256(
                    raw_call.get("rejected_output_sha256"),
                    f"usage.calls[{index}].rejected_output_sha256",
                )
                raw_artifact_sha256 = raw_call.get("rejected_artifact_sha256")
                if raw_artifact_sha256 is not None:
                    rejected_artifact_sha256 = _require_sha256(
                        raw_artifact_sha256,
                        f"usage.calls[{index}].rejected_artifact_sha256",
                    )
                if (
                    isinstance(raw_call.get("call_id"), str)
                    and rejected_artifact_sha256 is None
                ):
                    raise ValueError(
                        f"usage.calls[{index}] benchmark correction lacks its local artifact hash"
                    )
            failure_state = raw_call.get("failure_state")
            if disposition == "used" and failure_state is not None:
                raise ValueError(f"usage.calls[{index}] used output has a failure state")
            if disposition == "discarded_unusable" and not isinstance(failure_state, str):
                raise ValueError(
                    f"usage.calls[{index}] discarded output lacks a failure state"
                )
            if disposition == "used" and stop_reason != (
                "end_turn" if stage == "triage" else "tool_use"
            ):
                raise ValueError(
                    f"usage.calls[{index}] used output has an incomplete stop_reason"
                )
            if raw_call.get("fallback_used") is not False:
                raise ValueError(f"usage.calls[{index}] used a model fallback")
            if not isinstance(raw_call.get("truncated"), bool):
                raise ValueError(f"usage.calls[{index}].truncated must be boolean")
            expected_truncated = stop_reason in {
                "max_tokens",
                "model_context_window_exceeded",
            }
            if raw_call["truncated"] != expected_truncated:
                raise ValueError(
                    f"usage.calls[{index}].truncated contradicts stop_reason"
                )
            latency_ms = raw_call.get("latency_ms")
            logical_retry = raw_call.get("logical_retry")
            attempt_number = raw_call.get("attempt_number")
            transport_attempt = raw_call.get("transport_attempt")
            transport_retry_count = raw_call.get("transport_retry_count")
            retry_count = raw_call.get("retry_count")
            total_retry_count = raw_call.get("total_retry_count")
            if type(latency_ms) is not int or latency_ms < 0:
                raise ValueError(f"usage.calls[{index}].latency_ms must be non-negative")
            started_at = _require_nonempty_string(
                raw_call.get("started_at"),
                f"usage.calls[{index}].started_at",
            )
            completed_at = _require_nonempty_string(
                raw_call.get("completed_at"),
                f"usage.calls[{index}].completed_at",
            )
            try:
                started_time = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                completed_time = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
            except ValueError as error:
                raise ValueError(
                    f"usage.calls[{index}] timestamps are invalid"
                ) from error
            if started_time.tzinfo is None or completed_time.tzinfo is None:
                raise ValueError(f"usage.calls[{index}] timestamps are invalid")
            if completed_time < started_time:
                raise ValueError(
                    f"usage.calls[{index}] completed before it started"
                )
            if type(logical_retry) is not int or logical_retry < 0:
                raise ValueError(f"usage.calls[{index}].logical_retry must be non-negative")
            if (
                manifest_version == TRUST_MANIFEST_VERSION
                and logical_retry > 1
            ):
                raise ValueError(
                    f"usage.calls[{index}] exceeds the permitted logical retry limit"
                )
            if attempt_number != logical_retry + 1:
                raise ValueError(f"usage.calls[{index}].attempt_number is inconsistent")
            if correction_source is not None and (
                logical_retry < 1
                or correction_source["source_attempt_number"] + 1
                != attempt_number
            ):
                raise ValueError(
                    f"usage.calls[{index}] correction source attempt is inconsistent"
                )
            if correction_replay is not None and (
                disposition != "discarded_unusable"
                or correction_replay["target_attempt_number"]
                != attempt_number + 1
            ):
                raise ValueError(
                    f"usage.calls[{index}] correction replay attempt is inconsistent"
                )
            if transport_attempt != successful_attempt:
                raise ValueError(f"usage.calls[{index}].transport_attempt is inconsistent")
            if transport_retry_count != successful_attempt - 1 or retry_count != transport_retry_count:
                raise ValueError(f"usage.calls[{index}].retry_count is inconsistent")
            if (
                manifest_version == TRUST_MANIFEST_VERSION
                and transport_retry_count > 1
            ):
                raise ValueError(
                    f"usage.calls[{index}] exceeds the permitted transport retry limit"
                )
            if total_retry_count != transport_retry_count + logical_retry:
                raise ValueError(f"usage.calls[{index}].total_retry_count is inconsistent")
            independent_cost_microusd = raw_call.get("independent_cost_microusd")
            independent_cost_usd = raw_call.get("independent_cost_usd")
            independent_cost_nanousd = raw_call.get("independent_cost_nanousd")
            independent_estimated_cost_usd = raw_call.get(
                "independent_estimated_cost_usd"
            )
            exact_variance_nanousd = raw_call.get("exact_cost_variance_nanousd")
            exact_variance_usd = raw_call.get("exact_cost_variance_usd")
            charged_cost_microusd = raw_call.get("charged_cost_microusd")
            rounding_variance_nanousd = raw_call.get(
                "rounding_variance_nanousd"
            )
            rounding_variance_usd = raw_call.get("rounding_variance_usd")
            rounding_reason = raw_call.get("rounding_reason")
            variance = raw_call.get("cost_variance_microusd")
            variance_reason = raw_call.get("cost_variance_reason")
            if type(independent_cost_microusd) is not int or independent_cost_microusd < 0:
                raise ValueError(
                    f"usage.calls[{index}].independent_cost_microusd is invalid"
                )
            if (
                isinstance(independent_cost_usd, bool)
                or not isinstance(independent_cost_usd, (int, float))
                or float(independent_cost_usd) != independent_cost_microusd / 1_000_000
            ):
                raise ValueError(
                    f"usage.calls[{index}] independent cost mirrors are inconsistent"
                )
            if type(variance) is not int:
                raise ValueError(f"usage.calls[{index}].cost_variance_microusd is invalid")
            if (
                type(independent_cost_nanousd) is not int
                or independent_cost_nanousd < 0
                or isinstance(independent_estimated_cost_usd, bool)
                or not isinstance(independent_estimated_cost_usd, (int, float))
                or not math.isfinite(float(independent_estimated_cost_usd))
                or abs(
                    float(independent_estimated_cost_usd)
                    - independent_cost_nanousd / 1_000_000_000
                ) > 1e-15
                or type(exact_variance_nanousd) is not int
                or isinstance(exact_variance_usd, bool)
                or not isinstance(exact_variance_usd, (int, float))
                or not math.isfinite(float(exact_variance_usd))
                or abs(
                    float(exact_variance_usd)
                    - exact_variance_nanousd / 1_000_000_000
                ) > 1e-15
                or type(charged_cost_microusd) is not int
                or charged_cost_microusd < 0
                or type(rounding_variance_nanousd) is not int
                or rounding_variance_nanousd < 0
                or isinstance(rounding_variance_usd, bool)
                or not isinstance(rounding_variance_usd, (int, float))
                or not math.isfinite(float(rounding_variance_usd))
                or abs(
                    float(rounding_variance_usd)
                    - rounding_variance_nanousd / 1_000_000_000
                ) > 1e-15
                or rounding_reason
                != (
                    None
                    if rounding_variance_nanousd == 0
                    else "ceil_to_microusd_for_atomic_budget"
                )
            ):
                raise ValueError(
                    f"usage.calls[{index}] exact cost evidence is invalid"
                )
            if exact_variance_nanousd != 0:
                raise ValueError(
                    f"usage.calls[{index}] has an unresolved exact cost variance"
                )
            if variance == 0 and variance_reason is not None:
                raise ValueError(f"usage.calls[{index}] zero cost variance has a reason")
            if variance != 0 and not isinstance(variance_reason, str):
                raise ValueError(f"usage.calls[{index}] cost variance lacks a reason")
            if manifest_version == TRUST_MANIFEST_VERSION and variance != 0:
                raise ValueError(
                    f"usage.calls[{index}] has an unresolved cost variance"
                )
            pricing_sha256 = _require_sha256(
                raw_call.get("pricing_sha256"),
                f"usage.calls[{index}].pricing_sha256",
            )
            if (
                manifest_version == TRUST_MANIFEST_VERSION
                and pricing_sha256 != runtime_pricing_sha256()
            ):
                raise ValueError(
                    f"usage.calls[{index}] pricing fingerprint is not the runtime table"
                )
            canonical_release = _canonical_release_provenance(
                raw_call.get("release"),
                f"usage.calls[{index}].release",
            )
            canonical_expected_release = _canonical_release_provenance(
                raw_call.get("expected_release"),
                f"usage.calls[{index}].expected_release",
            )
            call_provenance = {
                "request_sha256": _require_sha256(
                    raw_call.get("request_sha256"),
                    f"usage.calls[{index}].request_sha256",
                ),
                "prompt_sha256": _require_sha256(
                    raw_call.get("prompt_sha256"),
                    f"usage.calls[{index}].prompt_sha256",
                ),
                "prompt_contract_version": _require_nonempty_string(
                    raw_call.get("prompt_contract_version"),
                    f"usage.calls[{index}].prompt_contract_version",
                ),
                "schema_mode": schema_mode,
                "schema_sha256": schema_sha256,
                "transport_schema_sha256": transport_schema_sha256,
                "pricing_sha256": pricing_sha256,
                "independent_cost_microusd": independent_cost_microusd,
                "independent_cost_usd": float(independent_cost_usd),
                "independent_cost_nanousd": independent_cost_nanousd,
                "independent_estimated_cost_usd": float(
                    independent_estimated_cost_usd
                ),
                "exact_cost_variance_nanousd": exact_variance_nanousd,
                "exact_cost_variance_usd": float(exact_variance_usd),
                "charged_cost_microusd": charged_cost_microusd,
                "rounding_variance_nanousd": rounding_variance_nanousd,
                "rounding_variance_usd": float(rounding_variance_usd),
                "rounding_reason": rounding_reason,
                "cost_variance_microusd": variance,
                "cost_variance_reason": variance_reason,
                "latency_ms": latency_ms,
                "started_at": started_at,
                "completed_at": completed_at,
                "transport_attempt": transport_attempt,
                "transport_retry_count": transport_retry_count,
                "logical_retry": logical_retry,
                "attempt_number": attempt_number,
                "retry_count": retry_count,
                "total_retry_count": total_retry_count,
                "validation_result": validation_result,
                "validation_reason": validation_reason,
                "transformations": copy.deepcopy(transformations),
                "transformation_evidence": canonical_transformation_evidence,
                "failure_state": failure_state,
                "warnings": copy.deepcopy(warnings),
                "fallback_used": False,
                "truncated": raw_call["truncated"],
                "downstream_consumption": downstream,
                "release": canonical_release,
                "expected_release": canonical_expected_release,
            }
            raw_call_id = raw_call.get("call_id")
            if raw_call_id is not None:
                call_provenance["call_id"] = _require_sha256(
                    raw_call_id,
                    f"usage.calls[{index}].call_id",
                )
            if correction_source is not None:
                call_provenance["correction_source"] = correction_source
                call_provenance[
                    "correction_delivery_state"
                ] = correction_delivery_state
            if correction_replay is not None:
                call_provenance.update({
                    "correction_replay": correction_replay,
                    "rejected_output_sha256": rejected_output_sha256,
                    "rejected_artifact_sha256": rejected_artifact_sha256,
                })
        call_usage = None
        canonical_budget_check = None
        raw_call_usage = raw_call.get("usage")
        if manifest_version == TRUST_MANIFEST_VERSION or raw_call_usage is not None:
            if not isinstance(raw_call_usage, dict):
                raise ValueError(f"usage.calls[{index}].usage must be an object")
            call_usage = {}
            for field in USAGE_COUNTER_FIELDS:
                value = raw_call_usage.get(field)
                if type(value) is not int or value < 0:
                    raise ValueError(
                        f"usage.calls[{index}].usage.{field} must be non-negative"
                    )
                call_usage[field] = value
            if call_usage["call_count"] != 1:
                raise ValueError(f"usage.calls[{index}].usage.call_count must equal one")
            actual_cost_usd = raw_call_usage.get("actual_cost_usd")
            if (
                isinstance(actual_cost_usd, bool)
                or not isinstance(actual_cost_usd, (int, float))
                or not math.isfinite(float(actual_cost_usd))
                or float(actual_cost_usd)
                != call_usage["actual_cost_microusd"] / 1_000_000
            ):
                raise ValueError(
                    f"usage.calls[{index}].usage actual cost mirrors are inconsistent"
                )
            call_usage["actual_cost_usd"] = float(actual_cost_usd)
            for exact_field in (
                "charged_cost_microusd",
                "estimated_cost_nanousd",
                "rounding_variance_nanousd",
            ):
                value = raw_call_usage.get(exact_field)
                if type(value) is not int or value < 0:
                    raise ValueError(
                        f"usage.calls[{index}].usage.{exact_field} is invalid"
                    )
                call_usage[exact_field] = value
            for exact_field in ("estimated_cost_usd", "rounding_variance_usd"):
                value = raw_call_usage.get(exact_field)
                if (
                    isinstance(value, bool)
                    or not isinstance(value, (int, float))
                    or not math.isfinite(float(value))
                ):
                    raise ValueError(
                        f"usage.calls[{index}].usage.{exact_field} is invalid"
                    )
                call_usage[exact_field] = float(value)
            call_usage["rounding_reason"] = raw_call_usage.get("rounding_reason")
            if call_provenance is not None:
                if (
                    call_provenance["prompt_contract_version"]
                    != expected_prompt_contract_version
                ):
                    raise ValueError(
                        f"usage.calls[{index}] prompt contract version is stale"
                    )
                if (
                    call_provenance["cost_variance_microusd"]
                    != call_usage["actual_cost_microusd"]
                    - call_provenance["independent_cost_microusd"]
                ):
                    raise ValueError(
                        f"usage.calls[{index}] cost variance is inconsistent"
                    )
                if (
                    call_usage["charged_cost_microusd"]
                    != call_usage["actual_cost_microusd"]
                    or call_usage["estimated_cost_nanousd"]
                    != call_provenance["independent_cost_nanousd"]
                    or call_usage["estimated_cost_usd"]
                    != call_usage["estimated_cost_nanousd"] / 1_000_000_000
                    or call_usage["rounding_variance_nanousd"]
                    != call_usage["charged_cost_microusd"] * 1_000
                    - call_usage["estimated_cost_nanousd"]
                    or call_usage["rounding_variance_usd"]
                    != call_usage["rounding_variance_nanousd"] / 1_000_000_000
                    or call_usage["rounding_reason"]
                    != call_provenance["rounding_reason"]
                    or call_provenance["charged_cost_microusd"]
                    != call_usage["charged_cost_microusd"]
                    or call_provenance["rounding_variance_nanousd"]
                    != call_usage["rounding_variance_nanousd"]
                ):
                    raise ValueError(
                        f"usage.calls[{index}] exact cost evidence is inconsistent"
                    )
            canonical_budget_check = _canonical_budget_check(
                raw_call.get("budget_check"),
                f"usage.calls[{index}].budget_check",
            )
            if canonical_budget_check is not None:
                expected_budget_lineage = {
                    "requested_model": requested_model,
                    "stage": stage,
                    "logical_retry": logical_retry,
                }
                if any(
                    canonical_budget_check.get(field) != expected
                    for field, expected in expected_budget_lineage.items()
                ):
                    raise ValueError(
                        f"usage.calls[{index}] budget receipt does not match its call"
                    )
                if canonical_budget_check.get("decision") not in {
                    "settled",
                    "settled_exceeds_preflight_ceiling",
                }:
                    raise ValueError(
                        f"usage.calls[{index}] successful call lacks a settled budget decision"
                    )
                if (
                    canonical_budget_check.get("settled_cost_microusd")
                    != call_usage["actual_cost_microusd"]
                ):
                    raise ValueError(
                        f"usage.calls[{index}] budget settlement does not match its cost"
                    )
        if stage == "genre_detection":
            expected_models = {
                model_ids_by_tier[tier]
                for tier in ("haiku", "sonnet")
                if tier in model_ids_by_tier
            }
        elif stage == "triage" and cold_read_model_route is None:
            expected_models = {
                model_ids_by_tier[tier]
                for tier in ("haiku", "sonnet")
                if tier in model_ids_by_tier
            }
        else:
            expected_tier = (
                cold_read_model_route or "haiku"
                if stage == "triage"
                else pipeline_pass
            )
            expected_model = model_ids_by_tier.get(expected_tier)
            if expected_model is None:
                raise ValueError(
                    f"usage.calls[{index}] has an unknown model tier {expected_tier}"
                )
            expected_models = {expected_model}
        if (
            requested_model not in expected_models
            or returned_model != requested_model
        ):
            raise ValueError(
                f"usage.calls[{index}] requested or returned the wrong exact model"
            )

        response_ids.append(response_id)
        requested_model_ids.add(requested_model)
        call_record = {
            "response_id": response_id,
            "requested_model": requested_model,
            "returned_model": returned_model,
            "stop_reason": stop_reason,
            "successful_attempt": successful_attempt,
            "retry_history": _canonical_attempt_history(retry_history),
            "stage": stage,
            "pipeline_pass": pipeline_pass,
            "boundary_run": boundary_run,
            "reader_name": reader_name,
            "disposition": disposition,
        }
        if call_usage is not None:
            call_record["usage"] = call_usage
        if canonical_budget_check is not None:
            call_record["budget_check"] = canonical_budget_check
        if call_provenance is not None:
            call_record.update(call_provenance)
        call_records.append(call_record)

    if len(set(response_ids)) != len(response_ids):
        raise ValueError("usage.calls contains duplicate response_id values")
    calls_by_response = {call["response_id"]: call for call in call_records}
    replayed_source_ids = set()

    def validate_correction_target(
        target: Dict[str, Any],
        *,
        failed: bool,
    ) -> None:
        source_link = target.get("correction_source")
        if source_link is None:
            return
        source_id = source_link["source_response_id"]
        source = calls_by_response.get(source_id)
        replay = source.get("correction_replay") if isinstance(source, dict) else None
        target_response_id = target.get("response_id")
        target_response_id_status = (
            "available" if target_response_id is not None else "unavailable"
        )
        delivery_state = target.get("correction_delivery_state")
        expected_delivery_state = correction_delivery_state_for_call(
            target,
            successful=not failed,
        )
        if (
            not isinstance(source, dict)
            or source_id in replayed_source_ids
            or source.get("disposition") != "discarded_unusable"
            or source.get("request_sha256")
            != source_link["source_request_sha256"]
            or source.get("attempt_number")
            != source_link["source_attempt_number"]
            or source.get("rejected_output_sha256")
            != source_link["rejected_output_sha256"]
            or source.get("rejected_artifact_sha256")
            != source_link["rejected_artifact_sha256"]
            or not correction_call_lineage_matches(source, target)
            or not correction_release_lineage_matches(
                source,
                target,
                successful=not failed,
            )
            or not isinstance(replay, dict)
            or source.get("downstream_consumption") != (
                "correction_only"
                if replay.get("delivery_state") == "settled_after_dispatch"
                else "correction_attempted"
            )
            or delivery_state != replay.get("delivery_state")
            or delivery_state != expected_delivery_state
            or replay.get("target_call_id") != target.get("call_id")
            or replay.get("target_response_id") != target_response_id
            or replay.get("target_response_id_status")
            != target_response_id_status
            or replay.get("target_request_sha256")
            != target.get("request_sha256")
            or replay.get("target_prompt_sha256")
            != target.get("prompt_sha256")
            or replay.get("target_attempt_number")
            != target.get("attempt_number")
            or replay.get("replay_report_sha256")
            != source_link["replay_report_sha256"]
        ):
            raise ValueError("usage correction replay lineage is inconsistent")
        if failed:
            if (
                target.get("disposition") != "discarded_unusable"
                or target.get("downstream_consumption") != "not_consumed"
            ):
                raise ValueError(
                    "usage.failed_calls correction delivery state is inconsistent"
                )
        validate_correction_chronology(source, target)
        replayed_source_ids.add(source_id)

    for target in call_records:
        validate_correction_target(target, failed=False)
    usage_totals = {}
    for field in USAGE_COUNTER_FIELDS:
        value = usage.get(field)
        if type(value) is not int or value < 0:
            raise ValueError(f"usage.{field} must be a non-negative integer")
        usage_totals[field] = value

    failed_calls = usage.get("failed_calls", [])
    if not isinstance(failed_calls, list):
        raise ValueError("usage.failed_calls must be a list")
    has_per_call_usage = all("usage" in call for call in call_records)
    if has_per_call_usage and not failed_calls:
        call_usage_totals = {
            field: sum(call["usage"][field] for call in call_records)
            for field in USAGE_COUNTER_FIELDS
        }
        if call_usage_totals != usage_totals:
            raise ValueError("usage.calls per-call totals do not match aggregate usage")

    by_model_totals = {field: 0 for field in USAGE_COUNTER_FIELDS}
    returned_call_counts: Dict[str, int] = {}
    for call in call_records:
        returned_model = call["returned_model"]
        returned_call_counts[returned_model] = (
            returned_call_counts.get(returned_model, 0) + 1
        )
    for model, totals in by_model.items():
        if not isinstance(totals, dict):
            raise ValueError(f"usage.by_model[{model}] must be an object")
        for field in USAGE_COUNTER_FIELDS:
            value = totals.get(field)
            if type(value) is not int or value < 0:
                raise ValueError(
                    f"usage.by_model[{model}].{field} must be non-negative"
                )
            by_model_totals[field] += value
        if totals["call_count"] <= 0:
            raise ValueError(f"usage.by_model[{model}].call_count must be positive")
        if totals["call_count"] != returned_call_counts.get(model, 0):
            raise ValueError(
                f"usage.by_model[{model}] call count does not match call records"
            )
        if has_per_call_usage:
            per_call_model_totals = {
                field: sum(
                    call["usage"][field]
                    for call in call_records
                    if call["returned_model"] == model
                )
                for field in USAGE_COUNTER_FIELDS
            }
            if per_call_model_totals != {
                field: totals[field] for field in USAGE_COUNTER_FIELDS
            }:
                raise ValueError(
                    f"usage.by_model[{model}] totals do not match per-call usage"
                )
    if by_model_totals != usage_totals:
        raise ValueError("usage.by_model totals do not match aggregate usage")

    failed_call_records = []
    for index, raw_call in enumerate(failed_calls):
        if not isinstance(raw_call, dict):
            raise ValueError(f"usage.failed_calls[{index}] must be an object")
        failed_correction_source = None
        failed_correction_delivery_state = None
        requested_model = _require_nonempty_string(
            raw_call.get("requested_model"),
            f"usage.failed_calls[{index}].requested_model",
        )
        stage = _require_nonempty_string(
            raw_call.get("stage"),
            f"usage.failed_calls[{index}].stage",
        )
        if stage not in {
            "claim_verification", "genre_detection", "reader", "synthesis", "triage",
        }:
            raise ValueError(f"usage.failed_calls[{index}] has an invalid stage")
        pipeline_pass = _require_nonempty_string(
            raw_call.get("pipeline_pass"),
            f"usage.failed_calls[{index}].pipeline_pass",
        )
        boundary_run = raw_call.get("boundary_run")
        if type(boundary_run) is not int or boundary_run < 1:
            raise ValueError(
                f"usage.failed_calls[{index}].boundary_run must be positive"
            )
        reader_name = raw_call.get("reader_name")
        if not _valid_stage_reader_name(stage, reader_name):
            raise ValueError(
                f"usage.failed_calls[{index}] has invalid stage-specific call lineage"
            )
        if stage == "genre_detection":
            expected_models = {
                model_ids_by_tier[tier]
                for tier in ("haiku", "sonnet")
                if tier in model_ids_by_tier
            }
        elif stage == "triage" and cold_read_model_route is None:
            expected_models = {
                model_ids_by_tier[tier]
                for tier in ("haiku", "sonnet")
                if tier in model_ids_by_tier
            }
        else:
            expected_tier = (
                cold_read_model_route or "haiku"
                if stage == "triage"
                else pipeline_pass
            )
            expected_model = model_ids_by_tier.get(expected_tier)
            expected_models = {expected_model} if expected_model else set()
        if requested_model not in expected_models:
            raise ValueError(
                f"usage.failed_calls[{index}] requested the wrong exact model"
            )
        attempt_history = raw_call.get("attempt_history")
        if not isinstance(attempt_history, list) or not attempt_history:
            raise ValueError(
                f"usage.failed_calls[{index}] must retain every failed attempt"
            )
        for attempt_number, attempt in enumerate(attempt_history, start=1):
            if not isinstance(attempt, dict):
                raise ValueError(
                    f"usage.failed_calls[{index}] attempt must be an object"
                )
            if attempt.get("attempt") != attempt_number:
                raise ValueError(
                    f"usage.failed_calls[{index}] attempts must be sequential"
                )
            if attempt.get("outcome") != "failed":
                raise ValueError(
                    f"usage.failed_calls[{index}] cannot contain a success"
                )
        canonical_failed_attempt_history = _canonical_attempt_history(attempt_history)
        if manifest_version == TRUST_MANIFEST_VERSION:
            required_failure_fields = {
                "call_id", "returned_model", "response_id", "stop_reason",
                "request_sha256", "prompt_sha256", "prompt_contract_version",
                "schema_mode", "schema_sha256", "transport_schema_sha256",
                "pricing_sha256", "latency_ms", "started_at", "completed_at",
                "transport_attempts", "transport_retry_count", "logical_retry",
                "attempt_number", "retry_count", "total_retry_count",
                "validation_result", "validation_reason", "transformations",
                "transformation_evidence", "failure_state", "failure_message",
                "warnings", "fallback_used", "truncated",
                "downstream_consumption", "disposition", "release",
                "expected_release", "usage", "independent_cost_status",
                "independent_cost_microusd", "independent_cost_usd",
                "cost_variance_microusd", "uncertainty_status",
                "charged_cost_microusd", "charged_cost_usd",
                "reserved_cost_microusd", "reserved_cost_usd",
                "cap_cost_microusd", "cap_cost_usd", "budget_check",
            }
            missing = sorted(required_failure_fields - set(raw_call))
            if missing:
                raise ValueError(
                    f"usage.failed_calls[{index}] lacks canonical provenance: "
                    + ", ".join(missing)
                )
            for field in ("request_sha256", "prompt_sha256", "pricing_sha256"):
                _require_sha256(
                    raw_call.get(field),
                    f"usage.failed_calls[{index}].{field}",
                )
            if (
                raw_call.get("prompt_contract_version")
                != expected_prompt_contract_version
            ):
                raise ValueError(
                    f"usage.failed_calls[{index}] prompt contract is stale"
                )
            schema_mode = raw_call.get("schema_mode")
            if schema_mode not in {
                "schema_free", "strict_tool", "compact_strict_tool",
            }:
                raise ValueError(f"usage.failed_calls[{index}] schema mode is invalid")
            if schema_mode == "schema_free":
                if (
                    raw_call.get("schema_sha256") is not None
                    or raw_call.get("transport_schema_sha256") is not None
                ):
                    raise ValueError(
                        f"usage.failed_calls[{index}] schema-free call has a schema hash"
                    )
            else:
                _require_sha256(
                    raw_call.get("schema_sha256"),
                    f"usage.failed_calls[{index}].schema_sha256",
                )
                _require_sha256(
                    raw_call.get("transport_schema_sha256"),
                    f"usage.failed_calls[{index}].transport_schema_sha256",
                )
            if stage == "triage" and schema_mode != "schema_free":
                raise ValueError(f"usage.failed_calls[{index}] triage schema is invalid")
            if stage == "genre_detection" and schema_mode != "strict_tool":
                raise ValueError(f"usage.failed_calls[{index}] genre schema is invalid")
            expected_scored_schema_mode = (
                "strict_tool"
                if uses_targeted_correction_schema(raw_call)
                else "compact_strict_tool"
            )
            if stage in {
                "claim_verification", "reader", "synthesis",
            } and schema_mode != expected_scored_schema_mode:
                raise ValueError(f"usage.failed_calls[{index}] scored schema is invalid")
            if raw_call.get("pricing_sha256") != runtime_pricing_sha256():
                raise ValueError(
                    f"usage.failed_calls[{index}] pricing fingerprint is stale"
                )
            canonical_optional_fields = {
                field: _canonical_optional_identifier(
                    raw_call.get(field),
                    f"usage.failed_calls[{index}].{field}",
                )
                for field in ("call_id", "returned_model", "response_id")
            }
            canonical_stop_reason = (
                None
                if raw_call.get("stop_reason") is None
                else _canonical_stop_reason(
                    raw_call.get("stop_reason"),
                    f"usage.failed_calls[{index}].stop_reason",
                )
            )
            if (
                canonical_failed_attempt_history[-1].get("response_id")
                != canonical_optional_fields["response_id"]
            ):
                raise ValueError(
                    f"usage.failed_calls[{index}] response_id does not match its terminal attempt"
                )
            for field in (
                "latency_ms", "transport_attempts", "transport_retry_count",
                "logical_retry", "attempt_number", "retry_count",
                "total_retry_count", "charged_cost_microusd",
                "reserved_cost_microusd", "cap_cost_microusd",
            ):
                value = raw_call.get(field)
                if type(value) is not int or value < 0:
                    raise ValueError(
                        f"usage.failed_calls[{index}].{field} must be non-negative"
                    )
            if len(attempt_history) != raw_call["transport_attempts"]:
                raise ValueError(
                    f"usage.failed_calls[{index}] attempt history is incomplete"
                )
            if (
                raw_call["logical_retry"] > 1
                or raw_call["transport_retry_count"] > 1
            ):
                raise ValueError(
                    f"usage.failed_calls[{index}] exceeds the permitted retry limit"
                )
            if raw_call["attempt_number"] != raw_call["logical_retry"] + 1:
                raise ValueError(
                    f"usage.failed_calls[{index}] logical attempt is inconsistent"
                )
            if raw_call["transport_retry_count"] != max(
                0, raw_call["transport_attempts"] - 1
            ):
                raise ValueError(
                    f"usage.failed_calls[{index}] transport retries are inconsistent"
                )
            if raw_call["retry_count"] != raw_call["transport_retry_count"]:
                raise ValueError(
                    f"usage.failed_calls[{index}] retry count is inconsistent"
                )
            if raw_call["total_retry_count"] != (
                raw_call["retry_count"] + raw_call["logical_retry"]
            ):
                raise ValueError(
                    f"usage.failed_calls[{index}] total retry count is inconsistent"
                )
            started_at = _require_nonempty_string(
                raw_call.get("started_at"),
                f"usage.failed_calls[{index}].started_at",
            )
            completed_at = _require_nonempty_string(
                raw_call.get("completed_at"),
                f"usage.failed_calls[{index}].completed_at",
            )
            try:
                started_time = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                completed_time = datetime.fromisoformat(completed_at.replace("Z", "+00:00"))
            except ValueError as error:
                raise ValueError(
                    f"usage.failed_calls[{index}] timestamp is invalid"
                ) from error
            if started_time.tzinfo is None or completed_time.tzinfo is None:
                raise ValueError(
                    f"usage.failed_calls[{index}] timestamp is invalid"
                )
            if completed_time < started_time:
                raise ValueError(
                    f"usage.failed_calls[{index}] completed before it started"
                )
            for field in (
                "validation_result", "validation_reason", "failure_state",
                "failure_message", "independent_cost_status", "uncertainty_status",
            ):
                _require_nonempty_string(
                    raw_call.get(field),
                    f"usage.failed_calls[{index}].{field}",
                )
            returned_model_mismatch = (
                canonical_optional_fields["returned_model"] is not None
                and canonical_optional_fields["returned_model"] != requested_model
            )
            if returned_model_mismatch != (
                raw_call["failure_state"] == "model_provenance_mismatch"
            ):
                raise ValueError(
                    f"usage.failed_calls[{index}] returned model and failure state disagree"
                )
            if not raw_call["validation_result"].startswith("failed_"):
                raise ValueError(
                    f"usage.failed_calls[{index}] validation did not fail"
                )
            transformations = _canonical_bounded_strings(
                raw_call.get("transformations"),
                f"usage.failed_calls[{index}].transformations",
                max_length=128,
            )
            if any(
                re.fullmatch(r"[a-z][a-z0-9_]*", value) is None
                for value in transformations
            ) or len(transformations) != len(set(transformations)):
                raise ValueError(
                    f"usage.failed_calls[{index}].transformations are invalid"
                )
            transformation_evidence = raw_call.get("transformation_evidence")
            if not isinstance(transformation_evidence, list):
                raise ValueError(
                    f"usage.failed_calls[{index}].transformation_evidence is invalid"
                )
            evidence_names = [
                evidence.get("name") if isinstance(evidence, dict) else None
                for evidence in transformation_evidence
            ]
            if (
                len(evidence_names) != len(set(evidence_names))
                or evidence_names != transformations
            ):
                raise ValueError(
                    f"usage.failed_calls[{index}] transformations lack one-to-one evidence"
                )
            for evidence_index, evidence in enumerate(transformation_evidence):
                if (
                    not isinstance(evidence, dict)
                    or type(evidence.get("changed")) is not bool
                    or not (
                        {"before", "after"}.issubset(evidence)
                        or {"before_sha256", "after_sha256"}.issubset(evidence)
                    )
                ):
                    raise ValueError(
                        f"usage.failed_calls[{index}].transformation_evidence"
                        f"[{evidence_index}] is invalid"
                    )
            canonical_transformation_evidence = _canonical_transformation_evidence(
                transformation_evidence
            )
            warnings = _canonical_bounded_strings(
                raw_call.get("warnings"),
                f"usage.failed_calls[{index}].warnings",
                max_length=2_048,
            )
            canonical_release = _canonical_release_provenance(
                raw_call.get("release"),
                f"usage.failed_calls[{index}].release",
            )
            canonical_expected_release = _canonical_release_provenance(
                raw_call.get("expected_release"),
                f"usage.failed_calls[{index}].expected_release",
            )
            canonical_budget_check = _canonical_budget_check(
                raw_call.get("budget_check"),
                f"usage.failed_calls[{index}].budget_check",
            )
            if canonical_budget_check is not None:
                expected_budget_lineage = {
                    "requested_model": requested_model,
                    "stage": stage,
                    "logical_retry": raw_call["logical_retry"],
                }
                if any(
                    canonical_budget_check.get(field) != expected
                    for field, expected in expected_budget_lineage.items()
                ):
                    raise ValueError(
                        f"usage.failed_calls[{index}] budget receipt does not match its call"
                    )
            if raw_call.get("fallback_used") is not False:
                raise ValueError(f"usage.failed_calls[{index}] used a fallback")
            if type(raw_call.get("truncated")) is not bool:
                raise ValueError(f"usage.failed_calls[{index}] truncation is unknown")
            expected_truncated = canonical_stop_reason in {
                "max_tokens",
                "model_context_window_exceeded",
            }
            if raw_call["truncated"] != expected_truncated:
                raise ValueError(
                    f"usage.failed_calls[{index}] truncation contradicts stop_reason"
                )
            if (
                raw_call.get("downstream_consumption") != "not_consumed"
                or raw_call.get("disposition") != "discarded_unusable"
            ):
                raise ValueError(
                    f"usage.failed_calls[{index}] was consumed downstream"
                )
            if raw_call.get("correction_source") is not None:
                failed_correction_source = _canonical_correction_source(
                    raw_call["correction_source"],
                    f"usage.failed_calls[{index}].correction_source",
                )
                failed_correction_delivery_state = raw_call.get(
                    "correction_delivery_state"
                )
                if failed_correction_delivery_state not in {
                    "settled_after_dispatch",
                    "uncertain_after_dispatch",
                }:
                    raise ValueError(
                        f"usage.failed_calls[{index}] correction delivery state is invalid"
                    )
                if (
                    stage not in {"reader", "synthesis"}
                    or raw_call["logical_retry"] < 1
                    or failed_correction_source["source_attempt_number"] + 1
                    != raw_call["attempt_number"]
                ):
                    raise ValueError(
                        f"usage.failed_calls[{index}] correction source attempt is inconsistent"
                    )
            elif raw_call.get("correction_delivery_state") is not None:
                raise ValueError(
                    f"usage.failed_calls[{index}] correction delivery lacks a source"
                )
            if (
                uses_targeted_correction_schema(raw_call)
                and failed_correction_source is None
                and correction_delivery_state_for_call(
                    raw_call,
                    successful=False,
                ) is not None
            ):
                raise ValueError(
                    f"usage.failed_calls[{index}] targeted correction lacks its source"
                )
            call_usage = raw_call.get("usage")
            if not isinstance(call_usage, dict):
                raise ValueError(f"usage.failed_calls[{index}] usage is invalid")
            for field in USAGE_COUNTER_FIELDS:
                value = call_usage.get(field)
                if type(value) is not int or value < 0:
                    raise ValueError(
                        f"usage.failed_calls[{index}].usage.{field} is invalid"
                    )
            for micros, usd in (
                ("charged_cost_microusd", "charged_cost_usd"),
                ("reserved_cost_microusd", "reserved_cost_usd"),
                ("cap_cost_microusd", "cap_cost_usd"),
            ):
                usd_value = raw_call.get(usd)
                if (
                    isinstance(usd_value, bool)
                    or not isinstance(usd_value, (int, float))
                    or not math.isfinite(float(usd_value))
                    or abs(float(usd_value) - raw_call[micros] / 1_000_000)
                    > 1e-12
                ):
                    raise ValueError(
                        f"usage.failed_calls[{index}] cost mirrors are inconsistent"
                    )
            independent_cost_microusd = raw_call.get("independent_cost_microusd")
            independent_cost_usd = raw_call.get("independent_cost_usd")
            if independent_cost_microusd is None:
                if independent_cost_usd is not None:
                    raise ValueError(
                        f"usage.failed_calls[{index}] independent cost is inconsistent"
                    )
            elif (
                type(independent_cost_microusd) is not int
                or independent_cost_microusd < 0
                or isinstance(independent_cost_usd, bool)
                or not isinstance(independent_cost_usd, (int, float))
                or float(independent_cost_usd)
                != independent_cost_microusd / 1_000_000
            ):
                raise ValueError(
                    f"usage.failed_calls[{index}] independent cost is invalid"
                )
            cost_variance_microusd = raw_call.get("cost_variance_microusd")
            if cost_variance_microusd is not None and type(
                cost_variance_microusd
            ) is not int:
                raise ValueError(
                    f"usage.failed_calls[{index}] cost variance is invalid"
                )
            actual_cost_microusd = call_usage["actual_cost_microusd"]
            charged_cost_microusd = raw_call["charged_cost_microusd"]
            reserved_cost_microusd = raw_call["reserved_cost_microusd"]
            cap_cost_microusd = raw_call["cap_cost_microusd"]
            if (
                actual_cost_microusd != cap_cost_microusd
                or charged_cost_microusd + reserved_cost_microusd
                != cap_cost_microusd
            ):
                raise ValueError(
                    f"usage.failed_calls[{index}] cost evidence does not reconcile"
                )
            if independent_cost_microusd is None:
                if cost_variance_microusd is not None:
                    raise ValueError(
                        f"usage.failed_calls[{index}] cost variance lacks an independent cost"
                    )
            elif cost_variance_microusd != (
                cap_cost_microusd - independent_cost_microusd
            ):
                raise ValueError(
                    f"usage.failed_calls[{index}] cost variance does not reconcile"
                )
            if (
                canonical_budget_check is not None
                and "settled_cost_microusd" in canonical_budget_check
                and canonical_budget_check["settled_cost_microusd"]
                != cap_cost_microusd
            ):
                raise ValueError(
                    f"usage.failed_calls[{index}] budget settlement does not match its cost"
                )
        requested_model_ids.add(requested_model)
        failed_record = {
            "requested_model": requested_model,
            "stage": stage,
            "pipeline_pass": pipeline_pass,
            "boundary_run": boundary_run,
            "reader_name": reader_name,
            "attempt_history": canonical_failed_attempt_history,
        }
        for field in (
            "call_id",
            "returned_model",
            "response_id",
            "stop_reason",
            "request_sha256",
            "prompt_sha256",
            "prompt_contract_version",
            "schema_mode",
            "schema_sha256",
            "transport_schema_sha256",
            "pricing_sha256",
            "latency_ms",
            "started_at",
            "completed_at",
            "transport_attempts",
            "transport_retry_count",
            "logical_retry",
            "attempt_number",
            "retry_count",
            "total_retry_count",
            "validation_result",
            "validation_reason",
            "transformations",
            "transformation_evidence",
            "failure_state",
            "failure_message",
            "warnings",
            "fallback_used",
            "truncated",
            "downstream_consumption",
            "disposition",
            "release",
            "expected_release",
            "usage",
            "independent_cost_status",
            "independent_cost_microusd",
            "independent_cost_usd",
            "cost_variance_microusd",
            "uncertainty_status",
            "charged_cost_microusd",
            "charged_cost_usd",
            "reserved_cost_microusd",
            "reserved_cost_usd",
            "cap_cost_microusd",
            "cap_cost_usd",
            "budget_check",
            "correction_source",
            "correction_delivery_state",
        ):
            if field in raw_call:
                if (
                    manifest_version == TRUST_MANIFEST_VERSION
                    and field in canonical_optional_fields
                ):
                    failed_record[field] = canonical_optional_fields[field]
                elif manifest_version == TRUST_MANIFEST_VERSION and field == "stop_reason":
                    failed_record[field] = canonical_stop_reason
                elif manifest_version == TRUST_MANIFEST_VERSION and field == "transformations":
                    failed_record[field] = transformations
                elif (
                    manifest_version == TRUST_MANIFEST_VERSION
                    and field == "transformation_evidence"
                ):
                    failed_record[field] = canonical_transformation_evidence
                elif manifest_version == TRUST_MANIFEST_VERSION and field == "warnings":
                    failed_record[field] = warnings
                elif manifest_version == TRUST_MANIFEST_VERSION and field == "release":
                    failed_record[field] = canonical_release
                elif (
                    manifest_version == TRUST_MANIFEST_VERSION
                    and field == "expected_release"
                ):
                    failed_record[field] = canonical_expected_release
                elif manifest_version == TRUST_MANIFEST_VERSION and field == "budget_check":
                    failed_record[field] = canonical_budget_check
                elif (
                    manifest_version == TRUST_MANIFEST_VERSION
                    and field == "correction_source"
                ):
                    failed_record[field] = failed_correction_source
                elif (
                    manifest_version == TRUST_MANIFEST_VERSION
                    and field == "correction_delivery_state"
                ):
                    failed_record[field] = failed_correction_delivery_state
                elif field == "usage":
                    failed_record[field] = {
                        counter: raw_call[field][counter]
                        for counter in USAGE_COUNTER_FIELDS
                    }
                else:
                    failed_record[field] = copy.deepcopy(raw_call[field])
        failed_call_records.append(failed_record)

    for target in failed_call_records:
        validate_correction_target(target, failed=True)
    correction_replay_source_ids = {
        call["response_id"]
        for call in call_records
        if call.get("correction_replay") is not None
    }
    if replayed_source_ids != correction_replay_source_ids:
        raise ValueError("usage correction replay lacks one exact target call")

    if manifest_version == TRUST_MANIFEST_VERSION and has_per_call_usage:
        combined_usage_totals = {
            field: sum(
                call["usage"][field]
                for call in [*call_records, *failed_call_records]
            )
            for field in USAGE_COUNTER_FIELDS
        }
        if combined_usage_totals != usage_totals:
            raise ValueError(
                "usage successful and failed per-call totals do not match aggregate usage"
            )

    triage_models = {
        call["requested_model"]
        for call in [*call_records, *failed_call_records]
        if call["stage"] == "triage"
    }
    if len(triage_models) > 1:
        raise ValueError("usage triage attempts changed model route")

    return {
        "provider": ANALYSIS_PROVIDER,
        "selection_request": selection,
        "pipeline_model_tier": pipeline_tier,
        "planned_model_ids": planned_model_ids,
        "model_ids_by_tier": model_ids_by_tier,
        "requested_model_ids": sorted(requested_model_ids),
        "effective_model_tier": effective_tier,
        "effective_model_id": effective_model_id,
        "returned_model_ids": returned_model_ids,
        "call_count": call_count,
        "response_ids": response_ids,
        "calls": call_records,
        "failed_calls": failed_call_records,
    }


def _reader_lineage(analysis: Any, analysis_version: str) -> Dict[str, Any]:
    if not isinstance(analysis, dict):
        raise ValueError("analysis must be an object")
    if analysis_version == "v9_triage":
        return {
            "evaluation_stage": "triage",
            "expected_specialist_readers": 0,
            "completed_specialist_readers": 0,
            "failed_readers": [],
            "report_names": [],
        }

    reports = analysis.get("reader_reports")
    quality = analysis.get("analysis_quality")
    if not isinstance(reports, dict):
        raise ValueError("analysis.reader_reports must be an object")
    if not isinstance(quality, dict):
        raise ValueError("analysis.analysis_quality must be an object")

    expected = quality.get("expected_readers")
    completed = quality.get("completed_readers")
    failed = quality.get("failed_readers")
    failed_errors = analysis.get("failed_reader_errors", {})
    if type(expected) is not int or expected <= 0:
        raise ValueError("analysis quality expected reader count is invalid")
    if type(completed) is not int or completed < 0:
        raise ValueError("analysis quality completed reader count is invalid")
    if not isinstance(failed, list) or not all(isinstance(name, str) for name in failed):
        raise ValueError("analysis quality failed reader list is invalid")
    if not isinstance(failed_errors, dict) or not all(
        isinstance(name, str) and isinstance(message, str) and message
        for name, message in failed_errors.items()
    ):
        raise ValueError("analysis failed reader errors are invalid")
    if completed != len(reports):
        raise ValueError("analysis quality reader count does not match reader reports")
    if completed + len(failed) != expected:
        raise ValueError("completed and failed readers do not match expected readers")
    report_names = set(str(name) for name in reports)
    failed_names = set(failed)
    if expected != len(CANONICAL_READER_NAMES):
        raise ValueError("analysis must declare the canonical five readers")
    if report_names & failed_names:
        raise ValueError("a reader cannot be both completed and failed")
    if report_names | failed_names != CANONICAL_READER_NAMES:
        raise ValueError("analysis reader identities do not match the V9 contract")
    if set(failed_errors) != failed_names:
        raise ValueError("failed reader errors do not match failed readers")
    expected_status = "partial" if failed else "complete"
    if quality.get("status") != expected_status:
        raise ValueError("analysis quality status does not match reader completion")

    return {
        "evaluation_stage": "full",
        "quality_status": quality.get("status"),
        "expected_specialist_readers": expected,
        "completed_specialist_readers": completed,
        "failed_readers": list(failed),
        "failed_reader_errors": copy.deepcopy(failed_errors),
        "report_names": sorted(report_names),
    }


def _manifest_reader_lineage(
    analysis: Any,
    analysis_version: str,
    manifest_version: str,
) -> Dict[str, Any]:
    """Apply the reader publication rule for the requested manifest version."""
    lineage = _reader_lineage(analysis, analysis_version)
    if (
        analysis_version == "v9_archaeology"
        and manifest_version in {
            Q3_TRUST_MANIFEST_VERSION,
            Q4_TRUST_MANIFEST_VERSION,
            Q5_TRUST_MANIFEST_VERSION,
            TRUST_MANIFEST_VERSION,
        }
    ):
        if (
            lineage.get("quality_status") != "complete"
            or lineage.get("expected_specialist_readers")
            != len(CANONICAL_READER_NAMES)
            or lineage.get("completed_specialist_readers")
            != len(CANONICAL_READER_NAMES)
            or lineage.get("failed_readers")
            or set(lineage.get("report_names", []))
            != CANONICAL_READER_NAMES
        ):
            raise ValueError(
                "Q3 permanent analysis requires all five specialist readers"
            )
        return {
            **lineage,
            "reliability_contract_version": (
                READER_RELIABILITY_CONTRACT_VERSION
            ),
            "publication_ready": True,
        }
    return lineage


def _boundary_provenance(
    analysis: Dict[str, Any],
    *,
    enforce_raw_score_verdict: bool = True,
) -> Dict[str, Any]:
    boundary = analysis.get("_boundary_reruns")
    if not isinstance(boundary, dict):
        raise ValueError("analysis must explicitly record boundary-run provenance")
    if type(boundary.get("triggered")) is not bool:
        raise ValueError("boundary-run triggered must be a boolean")
    reason = _require_nonempty_string(
        boundary.get("reason"),
        "boundary-run reason",
    )
    if reason not in {
        "disabled_by_environment",
        "outside_boundary_window",
        "near_boundary",
    }:
        raise ValueError("boundary-run reason is invalid")
    boundary_window = _require_number(
        boundary.get("boundary_window"),
        "boundary-run window",
    )
    if boundary_window != BOUNDARY_WINDOW:
        raise ValueError("boundary-run window does not match the V9 contract")
    attempted = boundary.get("attempted_runs")
    completed = boundary.get("completed_runs")
    runs = boundary.get("runs")
    failed_runs = boundary.get("failed_runs")
    if type(attempted) is not int or attempted <= 0:
        raise ValueError("boundary-run attempted count is invalid")
    if type(completed) is not int or completed <= 0:
        raise ValueError("boundary-run completed count is invalid")
    if not isinstance(runs, list) or len(runs) != completed:
        raise ValueError("boundary-run completed history is invalid")
    if not isinstance(failed_runs, list):
        raise ValueError("boundary-run failure history is invalid")
    if attempted != completed + len(failed_runs):
        raise ValueError("boundary-run attempt history is incomplete")
    successful_numbers = []
    run_scores = []
    verdicts = []
    sealed_runs = []
    for index, run in enumerate(runs):
        if not isinstance(run, dict):
            raise ValueError("boundary-run completed entry must be an object")
        run_number = run.get("run_number")
        if type(run_number) is not int or run_number < 1:
            raise ValueError("boundary-run number must be a positive integer")
        successful_numbers.append(run_number)
        run_scores.append(
            _require_number(
                run.get("adjusted_score"),
                f"boundary-run {run_number} adjusted score",
            )
        )
        verdicts.append(
            _require_nonempty_string(
                run.get("verdict"),
                f"boundary-run {run_number} verdict",
            )
        )
        _require_nonempty_string(
            run.get("verdict_model"),
            f"boundary-run {run_number} model verdict",
        )
        response_ids = run.get("response_ids")
        if not isinstance(response_ids, list) or not response_ids or not all(
            isinstance(response_id, str) and response_id
            for response_id in response_ids
        ):
            raise ValueError(
                f"boundary-run {run_number} must identify its model responses"
            )
        evidence = run.get("analysis_evidence")
        if not isinstance(evidence, dict):
            raise ValueError(
                f"boundary-run {run_number} must retain score and reader evidence"
            )
        if evidence.get("analysis_version") != "v9_archaeology":
            raise ValueError(f"boundary-run {run_number} has invalid analysis evidence")
        _reader_lineage(evidence, "v9_archaeology")
        evidence_core = _recompute_full_analysis_core(
            evidence,
            enforce_raw_score_verdict=enforce_raw_score_verdict,
        )
        evidence_verdict = _require_nonempty_string(
            evidence.get("verdict"),
            f"boundary-run {run_number} evidence verdict",
        )
        if evidence_verdict != evidence_core["derived"]["verdict"]:
            raise ValueError(
                f"boundary-run {run_number} verdict is inconsistent with its gates"
            )
        if evidence_core["adjustments"] != evidence_core["derived"]["adjustments"]:
            raise ValueError(
                f"boundary-run {run_number} adjustment trail is inconsistent"
            )
        if float(run["adjusted_score"]) != evidence_core["stored_adjusted"]:
            raise ValueError(
                f"boundary-run {run_number} score does not match its evidence"
            )
        if run["verdict"] != evidence_verdict:
            raise ValueError(
                f"boundary-run {run_number} verdict does not match its evidence"
            )
        if run["verdict_model"] != evidence.get("verdict_model"):
            raise ValueError(
                f"boundary-run {run_number} model verdict does not match its evidence"
            )
        sealed_runs.append({
            "run_number": run_number,
            "adjusted_score": float(run["adjusted_score"]),
            "verdict": run["verdict"],
            "verdict_model": run["verdict_model"],
            "response_ids": list(response_ids),
            "analysis_evidence_sha256": _sha256_bytes(
                _canonical_json(evidence).encode("utf-8")
            ),
        })

    failed_numbers = []
    sealed_failed_runs = []
    for failed in failed_runs:
        if not isinstance(failed, dict):
            raise ValueError("boundary-run failure entry must be an object")
        run_number = failed.get("run_number")
        if type(run_number) is not int or run_number < 1:
            raise ValueError("boundary-run failure number is invalid")
        failed_numbers.append(run_number)
        _require_nonempty_string(
            failed.get("error_type"),
            f"boundary-run {run_number} failure type",
        )
        _require_nonempty_string(
            failed.get("error_message"),
            f"boundary-run {run_number} failure message",
        )
        if not isinstance(failed.get("response_ids"), list):
            raise ValueError("boundary-run failure response history is invalid")
        if not isinstance(failed.get("failed_calls"), list):
            raise ValueError("boundary-run failed-call history is invalid")
        sealed_failed_runs.append({
            "run_number": run_number,
            "error_type": failed["error_type"],
            "error_message": failed["error_message"],
            "response_ids": copy.deepcopy(failed["response_ids"]),
            "failed_calls_sha256": _sha256_bytes(
                _canonical_json(failed["failed_calls"]).encode("utf-8")
            ),
        })

    all_numbers = successful_numbers + failed_numbers
    if sorted(all_numbers) != list(range(1, attempted + 1)):
        raise ValueError("boundary-run numbers must cover every attempt exactly once")
    if len(set(all_numbers)) != len(all_numbers):
        raise ValueError("boundary-run numbers must be unique")

    selected_run_number = boundary.get("selected_run_number")
    if selected_run_number not in successful_numbers:
        raise ValueError("boundary-run selected result is not a completed run")
    ordered_runs = sorted(
        (
            float(run["adjusted_score"]),
            int(run["run_number"]),
        )
        for run in runs
    )
    expected_median_score, expected_selected_run = ordered_runs[
        len(ordered_runs) // 2
    ]
    median = _require_number(
        boundary.get("median_adjusted_score"),
        "boundary-run median adjusted score",
    )
    if median != expected_median_score:
        raise ValueError("boundary-run median score was not recomputed correctly")
    spread = _require_number(
        boundary.get("score_spread"),
        "boundary-run score spread",
    )
    expected_spread = round(max(run_scores) - min(run_scores), 2)
    if spread != expected_spread:
        raise ValueError("boundary-run score spread was not recomputed correctly")

    expected_selected_index = select_boundary_run_index(run_scores, verdicts)
    expected_selected_run = runs[expected_selected_index]["run_number"]
    if selected_run_number != expected_selected_run:
        raise ValueError(
            "boundary-run selected result does not match the stability contract"
        )
    selected_verdict = next(
        str(run["verdict"])
        for run in runs
        if run["run_number"] == selected_run_number
    )
    expected_final_verdict = selected_verdict
    if boundary.get("final_verdict") != expected_final_verdict:
        raise ValueError("boundary-run final verdict was not recomputed correctly")
    if boundary.get("final_verdict") != analysis.get("verdict"):
        raise ValueError("boundary-run final verdict does not match analysis")
    if boundary.get("triggered") is False and (
        attempted != 1 or completed != 1 or failed_runs
    ):
        raise ValueError("an untriggered boundary run must be a single clean pass")
    initial_score = next(
        float(run["adjusted_score"])
        for run in runs
        if run["run_number"] == 1
    )
    triggered = boundary["triggered"]
    if triggered:
        if reason != "near_boundary":
            raise ValueError("triggered boundary provenance has the wrong reason")
        if not near_verdict_boundary(initial_score, boundary_window):
            raise ValueError("boundary re-runs require an initial near-boundary score")
        if completed != attempted or failed_runs:
            raise ValueError("boundary-run failures cannot produce a trusted verdict")
    else:
        if reason not in {
            "disabled_by_environment",
            "outside_boundary_window",
        }:
            raise ValueError("untriggered boundary provenance has the wrong reason")
        if (
            reason == "outside_boundary_window"
            and near_verdict_boundary(initial_score, boundary_window)
        ):
            raise ValueError("near-boundary score cannot be marked outside the window")
        if (
            reason == "disabled_by_environment"
            and near_verdict_boundary(initial_score, boundary_window)
        ):
            raise ValueError(
                "near-boundary score cannot be trusted with stability runs disabled"
            )
    return {
        "triggered": triggered,
        "reason": reason,
        "boundary_window": boundary_window,
        "attempted_runs": attempted,
        "completed_runs": completed,
        "failed_runs": sealed_failed_runs,
        "runs": sealed_runs,
        "selected_run_number": selected_run_number,
        "median_adjusted_score": median,
        "score_spread": spread,
        "final_verdict": boundary["final_verdict"],
    }


def _recompute_full_analysis_core(
    analysis: Dict[str, Any],
    *,
    enforce_raw_score_verdict: bool = True,
) -> Dict[str, Any]:
    adjustments = analysis.get("verdict_adjustments")
    if not isinstance(adjustments, list) or not all(
        isinstance(adjustment, str) for adjustment in adjustments
    ):
        raise ValueError("analysis verdict adjustments must be a string list")
    critical_failures = analysis.get("critical_failures")
    story_vs_situation = analysis.get("story_vs_situation")
    false_positive_check = analysis.get("false_positive_check")
    truncation = analysis.get("_truncation")
    if not isinstance(critical_failures, list):
        raise ValueError("analysis critical failures must be a list")
    if not isinstance(story_vs_situation, dict):
        raise ValueError("analysis story-vs-situation gate must be an object")
    if not isinstance(false_positive_check, dict):
        raise ValueError("analysis false-positive gate must be an object")
    if not isinstance(truncation, dict):
        raise ValueError("analysis truncation gate must be an object")
    reports = analysis.get("reader_reports")
    pillar_scores = analysis.get("pillar_scores")
    if not isinstance(reports, dict) or not isinstance(pillar_scores, dict):
        raise ValueError("analysis must retain reports and pillar scores")

    for index, failure in enumerate(critical_failures):
        if not isinstance(failure, dict):
            raise ValueError(f"analysis critical failure {index} is invalid")
        reader = reports.get(failure.get("reader"))
        sub_scores = reader.get("sub_scores") if isinstance(reader, dict) else None
        metric = (
            sub_scores.get(failure.get("metric"))
            if isinstance(sub_scores, dict)
            else None
        )
        if not isinstance(metric, dict):
            raise ValueError(
                f"analysis critical failure {index} has no canonical metric"
            )
        severity = derive_failure_severity(metric.get("score"))
        if severity is None:
            raise ValueError(
                f"analysis critical failure {index} metric score is above 4"
            )
        if (
            failure.get("severity") != severity
            or failure.get("penalty") != FAILURE_PENALTIES[severity]
        ):
            raise ValueError(
                f"analysis critical failure {index} severity is not code-derived"
            )

    weighted_total = 0.0
    completed_weight = 0.0
    for reader_name, report in reports.items():
        if reader_name not in READER_WEIGHTS or not isinstance(report, dict):
            raise ValueError("analysis has an invalid reader score source")
        sub_scores = report.get("sub_scores")
        if not isinstance(sub_scores, dict) or not sub_scores:
            raise ValueError(f"{reader_name} report has no score evidence")
        values = [
            raw_sub_score["score"]
            for raw_sub_score in sub_scores.values()
            if isinstance(raw_sub_score, dict)
            and isinstance(raw_sub_score.get("score"), (int, float))
            and not isinstance(raw_sub_score.get("score"), bool)
        ]
        if len(values) != len(sub_scores):
            raise ValueError(f"{reader_name} report has invalid sub-scores")
        computed_pillar = round(sum(values) / len(values), 2)
        if _require_number(
            report.get("pillar_score"),
            f"{reader_name} report pillar score",
        ) != computed_pillar:
            raise ValueError(f"{reader_name} pillar score was not recomputed correctly")
        synthesis_pillar = pillar_scores.get(reader_name)
        if not isinstance(synthesis_pillar, dict):
            raise ValueError(f"{reader_name} synthesis pillar is missing")
        if _require_number(
            synthesis_pillar.get("score"),
            f"{reader_name} synthesis pillar score",
        ) != computed_pillar:
            raise ValueError(f"{reader_name} synthesis pillar does not match its report")
        weighted_total += computed_pillar * READER_WEIGHTS[reader_name]
        completed_weight += READER_WEIGHTS[reader_name]
    raw_score = _require_number(
        analysis.get("weighted_score"),
        "analysis weighted score",
    )
    recomputed_raw_score = round(weighted_total / completed_weight, 2)
    if raw_score != recomputed_raw_score:
        raise ValueError("analysis weighted score was not recomputed correctly")
    stored_before_adjustments = _require_nonempty_string(
        analysis.get("verdict_before_adjustments"),
        "analysis verdict before adjustments",
    )
    raw_score_verdict = derive_verdict(weighted_score=raw_score)["verdict"]
    if enforce_raw_score_verdict and stored_before_adjustments != raw_score_verdict:
        raise ValueError("analysis raw-score verdict is inconsistent")

    situation_verdict = _require_nonempty_string(
        story_vs_situation.get("verdict"),
        "story-vs-situation verdict",
    )
    trap_score = _require_number(
        false_positive_check.get("weighted_trap_score"),
        "false-positive weighted trap score",
    )
    truncated = truncation.get("truncated")
    if type(truncated) is not bool:
        raise ValueError("analysis truncation flag must be a boolean")
    derived = derive_verdict(
        weighted_score=raw_score,
        critical_failures=critical_failures,
        situation_verdict=situation_verdict,
        weighted_trap_score=trap_score,
        truncated=truncated,
    )
    stored_penalty = _require_number(
        analysis.get("critical_failure_penalty_applied"),
        "analysis critical failure penalty",
    )
    stored_adjusted = _require_number(
        analysis.get("weighted_score_adjusted"),
        "analysis adjusted score",
    )
    stored_before_gates = _require_nonempty_string(
        analysis.get("verdict_before_gates"),
        "analysis verdict before gates",
    )
    if stored_penalty != derived["penalty"]:
        raise ValueError("analysis critical-failure penalty is inconsistent")
    if stored_adjusted != derived["adjusted_score"]:
        raise ValueError("analysis adjusted score is inconsistent")
    if stored_before_gates != derived["verdict_before_gates"]:
        raise ValueError("analysis pre-gate verdict is inconsistent")

    return {
        "raw_score": raw_score,
        "adjustments": adjustments,
        "critical_failures": critical_failures,
        "story_vs_situation": story_vs_situation,
        "false_positive_check": false_positive_check,
        "truncation": truncation,
        "derived": derived,
        "stored_penalty": stored_penalty,
        "stored_adjusted": stored_adjusted,
        "stored_before_gates": stored_before_gates,
        "stored_before_adjustments": stored_before_adjustments,
    }


def _score_lineage(
    analysis: Any,
    analysis_version: str,
    *,
    scoring_code_version: str = SCORING_CODE_VERSION,
) -> Dict[str, Any]:
    if not isinstance(analysis, dict):
        raise ValueError("analysis must be an object")
    raw_score = _require_number(analysis.get("weighted_score"), "analysis weighted score")
    final_verdict = _require_nonempty_string(
        analysis.get("verdict"),
        "analysis final verdict",
    )

    if analysis_version == "v9_triage":
        return {
            "raw_weighted_score": raw_score,
            "critical_failure_penalty": 0.0,
            "adjusted_score": raw_score,
            "model_verdict": final_verdict,
            "verdict_before_adjustments": final_verdict,
            "verdict_before_gates": final_verdict,
            "verdict_adjustments": [],
            "final_verdict": final_verdict,
            "boundary_reruns": None,
            "gate_inputs": {
                "critical_failures": copy.deepcopy(
                    analysis.get("critical_failures", [])
                ),
                "story_vs_situation": None,
                "false_positive_check": None,
                "truncation": None,
            },
        }

    enforce_raw_score_verdict = scoring_code_version == SCORING_CODE_VERSION
    core = _recompute_full_analysis_core(
        analysis,
        enforce_raw_score_verdict=enforce_raw_score_verdict,
    )
    raw_score = core["raw_score"]
    adjustments = core["adjustments"]
    critical_failures = core["critical_failures"]
    story_vs_situation = core["story_vs_situation"]
    false_positive_check = core["false_positive_check"]
    truncation = core["truncation"]
    derived = core["derived"]
    stored_penalty = core["stored_penalty"]
    stored_adjusted = core["stored_adjusted"]
    stored_before_gates = core["stored_before_gates"]
    stored_before_adjustments = core["stored_before_adjustments"]

    boundary = _boundary_provenance(
        analysis,
        enforce_raw_score_verdict=enforce_raw_score_verdict,
    )
    selected_run_number = boundary["selected_run_number"]
    selected_run_verdict = next(
        run["verdict"]
        for run in boundary["runs"]
        if run["run_number"] == selected_run_number
    )
    if selected_run_verdict != derived["verdict"]:
        raise ValueError("selected boundary run verdict is inconsistent with its gates")
    selected_evidence = next(
        run["analysis_evidence"]
        for run in analysis["_boundary_reruns"]["runs"]
        if run["run_number"] == selected_run_number
    )
    selected_core = _recompute_full_analysis_core(
        selected_evidence,
        enforce_raw_score_verdict=enforce_raw_score_verdict,
    )
    for key in (
        "raw_score",
        "critical_failures",
        "story_vs_situation",
        "false_positive_check",
        "truncation",
        "derived",
        "stored_penalty",
        "stored_adjusted",
        "stored_before_gates",
        "stored_before_adjustments",
    ):
        if selected_core[key] != core[key]:
            raise ValueError(
                "selected boundary evidence does not match the saved analysis"
            )
    if _reader_lineage(
        selected_evidence,
        "v9_archaeology",
    ) != _reader_lineage(analysis, "v9_archaeology"):
        raise ValueError(
            "selected boundary reader evidence does not match the saved analysis"
        )
    expected_adjustments = list(derived["adjustments"])
    if final_verdict != derived["verdict"]:
        if len(adjustments) != len(expected_adjustments) + 1:
            raise ValueError("boundary verdict adjustment history is incomplete")
        boundary_adjustment = adjustments[-1]
        if not boundary_adjustment.startswith(
            f"boundary re-run majority: {derived['verdict']} → {final_verdict} "
        ):
            raise ValueError("boundary verdict adjustment history is invalid")
        expected_adjustments.append(boundary_adjustment)
    if adjustments != expected_adjustments:
        raise ValueError("analysis verdict adjustment trail is inconsistent")

    return {
        "raw_weighted_score": raw_score,
        "critical_failure_penalty": stored_penalty,
        "adjusted_score": stored_adjusted,
        "model_verdict": _require_nonempty_string(
            analysis.get("verdict_model"),
            "analysis model verdict",
        ),
        "verdict_before_adjustments": stored_before_adjustments,
        "verdict_before_gates": stored_before_gates,
        "verdict_adjustments": list(adjustments),
        "final_verdict": final_verdict,
        "boundary_reruns": boundary,
        "gate_inputs": {
            "critical_failures": copy.deepcopy(critical_failures),
            "story_vs_situation": copy.deepcopy(story_vs_situation),
            "false_positive_check": copy.deepcopy(false_positive_check),
            "truncation": copy.deepcopy(truncation),
        },
    }


def _usage_summary(usage: Any) -> Dict[str, Any]:
    if not isinstance(usage, dict):
        raise ValueError("usage must be an object")
    finish_reason = _canonical_stop_reason(
        usage.get("finish_reason"),
        "usage.finish_reason",
        allow_empty=True,
    )
    return {
        "input_tokens": int(usage.get("input_tokens", 0)),
        "output_tokens": int(usage.get("output_tokens", 0)),
        "cache_creation_input_tokens": int(
            usage.get("cache_creation_input_tokens", 0)
        ),
        "cache_read_input_tokens": int(usage.get("cache_read_input_tokens", 0)),
        "call_count": int(usage.get("call_count", 0)),
        "actual_cost_microusd": int(usage.get("actual_cost_microusd", 0)),
        "estimated_cost_nanousd": int(
            usage.get("estimated_cost_nanousd", 0)
        ),
        "estimated_cost_usd": float(usage.get("estimated_cost_usd", 0.0)),
        "rounding_variance_nanousd": int(
            usage.get("rounding_variance_nanousd", 0)
        ),
        "rounding_variance_usd": float(
            usage.get("rounding_variance_usd", 0.0)
        ),
        "finish_reason": finish_reason,
        "by_model": _canonical_usage_by_model(usage.get("by_model", {})),
    }


def _evidence_provenance(
    *,
    metadata: Mapping[str, Any],
    analysis: Mapping[str, Any],
    page_count: int,
    character_count: int,
    effective_model_tier: str,
    model_ids: Mapping[str, str],
    require_scene_count: bool = True,
) -> Dict[str, Any]:
    page_evidence = validate_stored_page_evidence(metadata, page_count)
    context_policy = validate_stored_context_policy(
        analysis,
        character_count,
        effective_model_tier,
        model_ids=model_ids,
    )
    citation_quality = validate_stored_citation_quality(
        analysis,
        metadata,
        page_count,
    )
    extraction_quality = page_evidence["extraction_quality"]
    result = {
        "page_extraction": {
            "version": page_evidence["page_evidence_version"],
            "evidence_sha256": metadata.get("page_evidence_sha256"),
            "status": extraction_quality["status"],
            "publication_ready": extraction_quality["publication_ready"],
            "readable_page_count": extraction_quality["readable_page_count"],
            "coverage_ratio": extraction_quality["coverage_ratio"],
            "opening_coverage_ratio": extraction_quality["opening_coverage_ratio"],
            "ending_coverage_ratio": extraction_quality["ending_coverage_ratio"],
            "native_cross_check": validate_native_cross_check(
                metadata.get("native_cross_check"),
                str(metadata.get("extraction_method") or ""),
            ),
        },
        "context": copy.deepcopy(context_policy),
        "citations": copy.deepcopy(citation_quality),
    }
    if require_scene_count:
        result["scene_count"] = copy.deepcopy(validate_scene_count_evidence(
            metadata.get("scene_count_evidence")
        ))
    return result


def _validate_usage_cost_mirrors(usage: Dict[str, Any]) -> None:
    canonical_cost_microusd = usage.get("actual_cost_microusd")
    if (
        type(canonical_cost_microusd) is not int
        or canonical_cost_microusd < 0
    ):
        raise ValueError("Usage actual cost must be a non-negative integer")
    expected_cost_usd = canonical_cost_microusd / 1_000_000
    raw_cost_usd = usage.get("actual_cost_usd")
    if (
        isinstance(raw_cost_usd, bool)
        or not isinstance(raw_cost_usd, (int, float))
        or not math.isfinite(float(raw_cost_usd))
        or abs(float(raw_cost_usd) - expected_cost_usd) > 1e-12
    ):
        raise ValueError("Usage actual dollar cost does not match microusd")
    estimated_nanousd = usage.get("estimated_cost_nanousd")
    estimated_usd = usage.get("estimated_cost_usd")
    rounding_nanousd = usage.get("rounding_variance_nanousd")
    rounding_usd = usage.get("rounding_variance_usd")
    if (
        type(estimated_nanousd) is not int
        or estimated_nanousd < 0
        or isinstance(estimated_usd, bool)
        or not isinstance(estimated_usd, (int, float))
        or not math.isfinite(float(estimated_usd))
        or float(estimated_usd) != estimated_nanousd / 1_000_000_000
        or type(rounding_nanousd) is not int
        or rounding_nanousd < 0
        or rounding_nanousd
        != canonical_cost_microusd * 1_000 - estimated_nanousd
        or isinstance(rounding_usd, bool)
        or not isinstance(rounding_usd, (int, float))
        or not math.isfinite(float(rounding_usd))
        or float(rounding_usd) != rounding_nanousd / 1_000_000_000
    ):
        raise ValueError("Usage exact cost evidence is inconsistent")


def _validate_cost_mirrors(raw: Dict[str, Any], usage: Dict[str, Any]) -> None:
    _validate_usage_cost_mirrors(usage)
    canonical_cost_microusd = usage["actual_cost_microusd"]
    if (
        type(raw.get("actual_cost_microusd")) is not int
        or raw.get("actual_cost_microusd") != canonical_cost_microusd
    ):
        raise ValueError("Permanent analysis cost mirror does not match usage")
    raw_cost_usd = raw.get("actual_cost_usd")
    if (
        isinstance(raw_cost_usd, bool)
        or not isinstance(raw_cost_usd, (int, float))
        or not math.isfinite(float(raw_cost_usd))
        or abs(float(raw_cost_usd) - canonical_cost_microusd / 1_000_000) > 1e-12
    ):
        raise ValueError("Permanent analysis dollar cost does not match usage")


def _validate_response_links(
    models: Dict[str, Any],
    readers: Dict[str, Any],
    score_lineage: Dict[str, Any],
    analysis: Dict[str, Any],
    manifest_version: str,
) -> None:
    context_policy = analysis.get("_context_policy")
    if isinstance(context_policy, dict):
        genre_tier = context_policy.get("genre_model")
        expected_genre_model = models["model_ids_by_tier"].get(genre_tier)
        if not expected_genre_model:
            raise ValueError("Context policy genre model has no exact model ID")
        genre_calls = [
            call
            for call in models["calls"] + models["failed_calls"]
            if call["stage"] == "genre_detection"
        ]
        if any(
            call["requested_model"] != expected_genre_model
            for call in genre_calls
        ):
            raise ValueError(
                "Genre detection call does not match the sealed context policy"
            )

    boundary = score_lineage.get("boundary_reruns")
    if boundary is None:
        return
    raw_boundary = analysis.get("_boundary_reruns")
    if not isinstance(raw_boundary, dict):
        raise ValueError("analysis is missing raw boundary evidence")
    raw_runs = {
        run.get("run_number"): run
        for run in raw_boundary.get("runs", [])
        if isinstance(run, dict)
    }
    raw_failed_runs = {
        run.get("run_number"): run
        for run in raw_boundary.get("failed_runs", [])
        if isinstance(run, dict)
    }
    calls_by_id = {
        call["response_id"]: call
        for call in models["calls"]
    }
    seen_response_ids = set()
    selected_run_number = boundary["selected_run_number"]
    for run in boundary["runs"]:
        response_ids = run["response_ids"]
        if seen_response_ids.intersection(response_ids):
            raise ValueError("a model response cannot belong to multiple boundary runs")
        seen_response_ids.update(response_ids)
        try:
            run_calls = [calls_by_id[response_id] for response_id in response_ids]
        except KeyError as error:
            raise ValueError(
                "boundary history references an unknown model response"
            ) from error
        if any(call["boundary_run"] != run["run_number"] for call in run_calls):
            raise ValueError("boundary response is assigned to the wrong run")
        if any(call["disposition"] != "used" for call in run_calls):
            raise ValueError("boundary history can only reference used responses")
        pipeline_passes = {call["pipeline_pass"] for call in run_calls}
        if len(pipeline_passes) != 1:
            raise ValueError("a boundary run cannot mix pipeline passes")
        synthesis_calls = [
            call for call in run_calls if call["stage"] == "synthesis"
        ]
        if len(synthesis_calls) != 1:
            raise ValueError("each completed boundary run requires one synthesis")
        used_reader_calls = [
            call
            for call in run_calls
            if call["stage"] == "reader"
        ]
        run_readers = {
            call["reader_name"]
            for call in used_reader_calls
        }
        raw_run = raw_runs.get(run["run_number"])
        if not isinstance(raw_run, dict):
            raise ValueError("boundary run is missing its raw evidence")
        evidence_readers = _manifest_reader_lineage(
            raw_run["analysis_evidence"],
            "v9_archaeology",
            manifest_version,
        )
        if run_readers != set(evidence_readers["report_names"]):
            raise ValueError(
                "boundary responses do not match completed readers"
            )
        if (
            manifest_version in {
                Q3_TRUST_MANIFEST_VERSION,
                Q4_TRUST_MANIFEST_VERSION,
                Q5_TRUST_MANIFEST_VERSION,
                TRUST_MANIFEST_VERSION,
            }
            and len(used_reader_calls) != len(CANONICAL_READER_NAMES)
        ):
            raise ValueError(
                "Q3 boundary run requires exactly one used response "
                "from each specialist reader"
            )
        if (
            run["run_number"] == selected_run_number
            and evidence_readers != readers
        ):
            raise ValueError(
                "selected boundary readers do not match the saved analysis"
            )
        pipeline_pass = next(iter(pipeline_passes))
        discarded_reader_names = {
            call["reader_name"]
            for call in models["calls"]
            if call["pipeline_pass"] == pipeline_pass
            and call["boundary_run"] == run["run_number"]
            and call["stage"] == "reader"
            and call["disposition"] == "discarded_unusable"
        }
        exhausted_reader_names = {
            call["reader_name"]
            for call in models["failed_calls"]
            if call["pipeline_pass"] == pipeline_pass
            and call["boundary_run"] == run["run_number"]
            and call["stage"] == "reader"
        }
        attempted_failure_names = (
            discarded_reader_names | exhausted_reader_names
        )
        declared_failed_names = set(evidence_readers["failed_readers"])
        if manifest_version in {
            Q3_TRUST_MANIFEST_VERSION,
            Q4_TRUST_MANIFEST_VERSION,
            Q5_TRUST_MANIFEST_VERSION,
            TRUST_MANIFEST_VERSION,
        }:
            if declared_failed_names:
                raise ValueError(
                    "Q3 completed run cannot declare failed readers"
                )
            if not attempted_failure_names.issubset(run_readers):
                raise ValueError(
                    "Q3 discarded reader attempt lacks a recovered used report"
                )
        elif attempted_failure_names != declared_failed_names:
            raise ValueError(
                "reader call failures do not match declared failed readers"
            )

    failed_call_records = models["failed_calls"]
    for failed_run in boundary["failed_runs"]:
        raw_failed_run = raw_failed_runs.get(failed_run["run_number"])
        if not isinstance(raw_failed_run, dict):
            raise ValueError("failed boundary run is missing raw evidence")
        for response_id in failed_run["response_ids"]:
            call = calls_by_id.get(response_id)
            if (
                call is None
                or call["boundary_run"] != failed_run["run_number"]
                or call["disposition"] != "used"
            ):
                raise ValueError("failed boundary run has invalid response history")
        for failed_call in raw_failed_run["failed_calls"]:
            if failed_call not in failed_call_records:
                raise ValueError("failed boundary run has unknown failed-call history")
            if failed_call["boundary_run"] != failed_run["run_number"]:
                raise ValueError("failed-call history is assigned to the wrong run")


def _boundary_response_ids(score_lineage: Dict[str, Any]) -> set[str]:
    boundary = score_lineage.get("boundary_reruns")
    if not isinstance(boundary, dict):
        return set()
    return {
        response_id
        for run in boundary["runs"]
        for response_id in run["response_ids"]
    } | {
        response_id
        for run in boundary["failed_runs"]
        for response_id in run["response_ids"]
    }


def _cold_read_model_route(analysis: Any) -> Optional[str]:
    if not isinstance(analysis, dict):
        return None
    cold_read = analysis.get("_cold_read")
    evidence = cold_read.get("evidence") if isinstance(cold_read, dict) else None
    route = evidence.get("model_route") if isinstance(evidence, dict) else None
    if route not in {None, "haiku", "sonnet"}:
        raise ValueError("cold-read model route is invalid")
    return route


def _cold_read_provenance(
    *,
    analysis: Dict[str, Any],
    analysis_version: str,
    models: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    triage_calls = [
        call
        for call in models["calls"]
        if call["stage"] == "triage" and call["disposition"] == "used"
    ]
    response_ids = sorted(call["response_id"] for call in triage_calls)

    if analysis_version == "v9_triage":
        if len(triage_calls) != 1:
            raise ValueError("triage analysis requires one used Haiku response")
        if (
            triage_calls[0]["requested_model"]
            != models["model_ids_by_tier"]["haiku"]
        ):
            raise ValueError("triage analysis requires one used Haiku response")
        if analysis.get("_cold_read") is not None:
            raise ValueError("triage analysis cannot contain a nested cold read")
        return {
            "kind": "primary_triage",
            "used_in_synthesis": False,
            "evidence": {
                "triage_score": _require_number(
                    analysis.get("weighted_score"),
                    "triage score",
                ),
                "verdict": _require_nonempty_string(
                    analysis.get("verdict"),
                    "triage verdict",
                ),
                "genre": str(analysis.get("genre", "")),
                "logline": str(analysis.get("logline", "")),
            },
            "response_ids": response_ids,
        }

    cold_read = analysis.get("_cold_read")
    if cold_read is None:
        if triage_calls:
            raise ValueError("CLI cold-read responses lack sealed synthesis evidence")
        return None
    if not isinstance(cold_read, dict):
        raise ValueError("analysis cold-read provenance must be an object")
    if cold_read.get("used_in_synthesis") is not True:
        raise ValueError("retained cold-read evidence must be used in synthesis")
    evidence = cold_read.get("evidence")
    if not isinstance(evidence, dict):
        raise ValueError("analysis cold read must retain its normalized evidence")
    expected_evidence = {
        "triage_score": _require_number(
            evidence.get("triage_score"),
            "cold-read triage score",
        ),
        "verdict": _require_nonempty_string(
            evidence.get("verdict"),
            "cold-read verdict",
        ),
        "genre": str(evidence.get("genre", "")),
        "logline": str(evidence.get("logline", "")),
    }
    model_route = evidence.get("model_route")
    if model_route is not None:
        if model_route not in {"haiku", "sonnet"}:
            raise ValueError("cold-read model route is invalid")
        expected_model = models["model_ids_by_tier"].get(model_route)
        if expected_model is None or any(
            call["requested_model"] != expected_model
            or call["returned_model"] != expected_model
            for call in triage_calls
        ):
            raise ValueError("cold-read model route does not match its response")
        expected_evidence["model_route"] = model_route
    stored_response_ids = cold_read.get("response_ids")
    if (
        not isinstance(stored_response_ids, list)
        or sorted(stored_response_ids) != response_ids
        or not response_ids
    ):
        raise ValueError("cold-read evidence is not linked to its model response")
    return {
        "kind": "synthesis_cold_read",
        "used_in_synthesis": True,
        "evidence": expected_evidence,
        "response_ids": response_ids,
    }


def _claim_verification_provenance(
    *,
    analysis: Dict[str, Any],
    models: Dict[str, Any],
    effective_model_tier: str,
    prompt_contract_version: str = PROMPT_CONTRACT_VERSION,
) -> Dict[str, Any]:
    raw = analysis.get("_claim_verification")
    if not isinstance(raw, dict):
        raise ValueError("benchmark analysis lacks independent claim verification")
    if raw.get("status") != "passed_independent_model_review":
        raise ValueError("independent claim verification did not pass")
    if raw.get("verification_scope") != (
        "semantic_support_against_full_physical_page_source"
    ):
        raise ValueError("independent claim verification scope is invalid")
    claims = raw.get("claims")
    claim_count = raw.get("claim_count")
    analysis_without_verification = copy.deepcopy(analysis)
    analysis_without_verification.pop("_claim_verification", None)
    expected_targets = claim_verification_targets(
        analysis_without_verification,
        prompt_contract_version=prompt_contract_version,
    )
    target_fields = claim_verification_target_fields(prompt_contract_version)
    score_alignment_contract = "score_alignment_required" in target_fields
    expected_locked_targets = [
        {
            key: target[key]
            for key in target_fields
        }
        for target in expected_targets
    ]
    if (
        not isinstance(claims, list)
        or type(claim_count) is not int
        or claim_count < 10
        or len(claims) != claim_count
        or claim_count != len(expected_locked_targets)
    ):
        raise ValueError("independent claim verification is incomplete")
    claim_ids = set()
    factual_total = 0
    factual_supported = 0
    counts: Dict[str, int] = {}
    allowed = {
        "Supported", "Partially supported", "Unsupported", "Contradicted",
        "Not objectively verifiable",
    }
    for claim in claims:
        if not isinstance(claim, dict):
            raise ValueError("independent claim verification contains an invalid claim")
        claim_id = _require_nonempty_string(
            claim.get("claim_id"),
            "independent claim verification ID",
        )
        if claim_id in claim_ids:
            raise ValueError("independent claim verification has duplicate claims")
        claim_ids.add(claim_id)
        _require_nonempty_string(
            claim.get("claim"),
            "independent claim verification text",
        )
        claim_type = claim.get("claim_type")
        if claim_type not in {"factual", "evaluative", "mixed"}:
            raise ValueError("independent claim verification type is invalid")
        classification = claim.get("classification")
        if classification not in allowed:
            raise ValueError("independent claim classification is invalid")
        if type(claim.get("verdict_driving")) is not bool:
            raise ValueError("independent claim verdict lineage is missing")
        if type(claim.get("story_fact_check_required")) is not bool:
            raise ValueError("independent claim story-fact lineage is missing")
        if (
            score_alignment_contract
            and type(claim.get("score_alignment_required")) is not bool
        ):
            raise ValueError("independent claim score-alignment lineage is missing")
        if prompt_contract_version not in LEGACY_CLAIM_TARGET_PROMPT_CONTRACT_VERSIONS:
            evidence_scope = claim.get("evidence_scope")
            if evidence_scope not in {"local", "global", "evaluative"}:
                raise ValueError("independent claim evidence scope is invalid")
            if claim["story_fact_check_required"] != (
                evidence_scope != "evaluative"
            ):
                raise ValueError("independent claim evidence scope is inconsistent")
        if claim["verdict_driving"] and classification in {
            "Unsupported", "Contradicted",
        }:
            raise ValueError("a verdict-driving claim failed independent verification")
        if (
            score_alignment_contract
            and claim["score_alignment_required"]
            and classification not in {"Supported", "Partially supported"}
        ):
            raise ValueError("a reader score alignment was not independently supported")
        story_fact_classification = claim.get("story_fact_classification")
        if story_fact_classification not in {
            "Supported",
            "Partially supported",
            "Unsupported",
            "Contradicted",
            "No concrete story fact",
        }:
            raise ValueError("independent story-fact classification is invalid")
        unsupported_story_facts = claim.get("unsupported_story_facts")
        if not isinstance(unsupported_story_facts, list) or any(
            not isinstance(fact, dict)
            or not isinstance(fact.get("claim"), str)
            or not fact["claim"].strip()
            or fact.get("kind") not in {
                "character",
                "relationship",
                "event",
                "quotation",
                "outcome",
                "citation",
                "minor_detail",
            }
            for fact in unsupported_story_facts
        ):
            raise ValueError("independent unsupported story-fact detail is invalid")
        if (
            story_fact_classification == "Partially supported"
            and not unsupported_story_facts
        ):
            raise ValueError("partial story-fact support lacks unsupported detail")
        if (
            story_fact_classification != "Partially supported"
            and unsupported_story_facts
        ):
            raise ValueError("unsupported story facts contradict their classification")
        if any(
            fact["kind"] != "minor_detail"
            for fact in unsupported_story_facts
        ):
            raise ValueError("a central story fact failed independent verification")
        if (
            claim["story_fact_check_required"]
            and story_fact_classification == "No concrete story fact"
        ):
            raise ValueError("a required story-fact check denied its factual content")
        if (
            claim["story_fact_check_required"]
            and story_fact_classification in {"Unsupported", "Contradicted"}
        ):
            raise ValueError("a factual claim failed independent verification")
        if (
            prompt_contract_version not in LEGACY_CLAIM_TARGET_PROMPT_CONTRACT_VERSIONS
            and not claim["story_fact_check_required"]
            and story_fact_classification != "No concrete story fact"
        ):
            raise ValueError("an evaluative claim invented a story-fact check")
        if (
            claim_type == "factual"
            and classification == "Not objectively verifiable"
        ):
            raise ValueError("a factual claim was not objectively adjudicated")
        if claim["story_fact_check_required"]:
            factual_total += 1
            if story_fact_classification in {"Supported", "Partially supported"}:
                factual_supported += 1
        counts[classification] = counts.get(classification, 0) + 1
        citations = claim.get("page_citations")
        evidence = claim.get("citation_evidence")
        if (
            not isinstance(citations, list)
            or not citations
            or not isinstance(evidence, list)
            or not evidence
        ):
            raise ValueError("independent claim lacks physical-page evidence")
    if factual_total == 0:
        raise ValueError("independent claim verification lacks factual claims")
    support_rate = factual_supported / factual_total
    if support_rate < 0.95:
        raise ValueError("independent factual claim support is below 95 percent")
    expected_summaries = {
        "factual_claim_count": factual_total,
        "factual_supported_or_partial_count": factual_supported,
        "factual_support_rate": round(support_rate, 4),
        "classification_counts": counts,
    }
    if any(raw.get(key) != value for key, value in expected_summaries.items()):
        raise ValueError("independent claim verification summary is inconsistent")
    locked_targets_sha256 = _require_sha256(
        raw.get("locked_targets_sha256"),
        "independent claim target fingerprint",
    )
    if locked_targets_sha256 != _sha256_bytes(
        _canonical_json(expected_locked_targets).encode("utf-8")
    ):
        raise ValueError("independent claim target fingerprint is inconsistent")
    observed_locked_targets = [
        {
            key: claim[key]
            for key in target_fields
        }
        for claim in claims
    ]
    if observed_locked_targets != expected_locked_targets:
        raise ValueError("independent claim verification changed the target set")
    analysis_for_hash = copy.deepcopy(analysis)
    analysis_for_hash.pop("_citation_quality", None)
    analysis_for_hash.pop("_claim_verification", None)
    analysis_sha256 = _require_sha256(
        raw.get("analysis_sha256"),
        "independent claim analysis fingerprint",
    )
    if analysis_sha256 != _sha256_bytes(
        _transport_canonical_json(analysis_for_hash).encode("utf-8")
    ):
        raise ValueError("independent claim verification targets a different analysis")
    verification_calls = [
        call
        for call in models["calls"]
        if call["stage"] == "claim_verification"
        and call["disposition"] == "used"
    ]
    response_ids = raw.get("response_ids")
    expected_response_ids = [call["response_id"] for call in verification_calls]
    expected_batch_count = math.ceil(
        claim_count / CLAIM_VERIFICATION_BATCH_SIZE
    )
    expected_batch_names = [
        f"batch_{index:03d}_of_{expected_batch_count:03d}"
        for index in range(1, expected_batch_count + 1)
    ]
    expected_batch_hashes = [
        _sha256_bytes(_canonical_json([
            target["claim_id"]
            for target in expected_targets[
                index:index + CLAIM_VERIFICATION_BATCH_SIZE
            ]
        ]).encode("utf-8"))
        for index in range(0, claim_count, CLAIM_VERIFICATION_BATCH_SIZE)
    ]
    if (
        response_ids != expected_response_ids
        or len(response_ids) != expected_batch_count
        or [call.get("reader_name") for call in verification_calls]
        != expected_batch_names
        or raw.get("batch_count") != expected_batch_count
        or raw.get("batch_size_limit") != CLAIM_VERIFICATION_BATCH_SIZE
        or raw.get("batch_target_sha256") != expected_batch_hashes
    ):
        raise ValueError(
            "independent claim verification batch lineage is invalid"
        )
    if any(
        call["pipeline_pass"] != effective_model_tier
        for call in verification_calls
    ):
        raise ValueError("independent claim verification used the wrong model tier")
    return {
        **expected_summaries,
        "status": raw["status"],
        "verification_scope": raw["verification_scope"],
        "claim_count": claim_count,
        "locked_targets_sha256": raw["locked_targets_sha256"],
        "analysis_sha256": analysis_sha256,
        "response_ids": list(response_ids),
        "batch_count": expected_batch_count,
        "batch_size_limit": CLAIM_VERIFICATION_BATCH_SIZE,
        "batch_target_sha256": expected_batch_hashes,
        "claims_sha256": _sha256_bytes(_canonical_json(claims).encode("utf-8")),
    }


def _hybrid_provenance(
    *,
    analysis: Dict[str, Any],
    pipeline_model_tier: str,
    effective_model_tier: str,
    models: Dict[str, Any],
    readers: Dict[str, Any],
    score_lineage: Dict[str, Any],
    cold_read: Optional[Dict[str, Any]],
    manifest_version: str,
    scoring_code_version: str,
    claim_verification: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    root_response_ids = _boundary_response_ids(score_lineage)
    cold_read_response_ids = (
        set(cold_read["response_ids"])
        if isinstance(cold_read, dict)
        else set()
    )
    claim_response_ids = (
        set(claim_verification["response_ids"])
        if isinstance(claim_verification, dict)
        else {
            call["response_id"]
            for call in models["calls"]
            if manifest_version != TRUST_MANIFEST_VERSION
            and call["stage"] == "claim_verification"
            and call["disposition"] == "used"
        }
    )
    calls_by_id = {
        call["response_id"]: call
        for call in models["calls"]
    }
    if any(
        calls_by_id[response_id]["pipeline_pass"] != effective_model_tier
        for response_id in root_response_ids
    ):
        raise ValueError("final analysis responses do not match the effective model tier")

    hybrid = analysis.get("_hybrid_mode")
    if pipeline_model_tier != "hybrid":
        if hybrid is not None:
            raise ValueError("non-hybrid analysis cannot carry hybrid provenance")
        used_response_ids = {
            call["response_id"]
            for call in models["calls"]
            if call["disposition"] == "used"
        }
        if used_response_ids != (
            root_response_ids | cold_read_response_ids | claim_response_ids
        ):
            raise ValueError("model calls are not linked to analysis evidence")
        return None

    if not isinstance(hybrid, dict):
        raise ValueError("hybrid analysis must retain its promotion provenance")
    promoted = hybrid.get("promoted_to_opus")
    if type(promoted) is not bool:
        raise ValueError("hybrid promotion decision must be a boolean")
    final_model = _require_nonempty_string(
        hybrid.get("final_model"),
        "hybrid final model",
    )
    if final_model != effective_model_tier:
        raise ValueError("hybrid final model does not match effective model")

    sonnet_evidence = hybrid.get("sonnet_analysis_evidence")
    if not isinstance(sonnet_evidence, dict):
        raise ValueError("hybrid analysis must retain Sonnet decision evidence")
    sonnet_readers = _manifest_reader_lineage(
        sonnet_evidence,
        "v9_archaeology",
        manifest_version,
    )
    sonnet_score_lineage = _score_lineage(
        sonnet_evidence,
        "v9_archaeology",
        scoring_code_version=scoring_code_version,
    )
    _validate_response_links(
        models,
        sonnet_readers,
        sonnet_score_lineage,
        sonnet_evidence,
        manifest_version,
    )
    sonnet_verdict = _require_nonempty_string(
        hybrid.get("sonnet_verdict"),
        "hybrid Sonnet verdict",
    )
    if sonnet_verdict != sonnet_score_lineage["final_verdict"]:
        raise ValueError("hybrid Sonnet verdict does not match its evidence")

    should_promote = sonnet_verdict in {"RECOMMEND", "FILM_NOW"}
    if promoted != should_promote:
        raise ValueError("hybrid promotion decision does not match Sonnet verdict")
    sonnet_response_ids = _boundary_response_ids(sonnet_score_lineage)
    if any(
        calls_by_id[response_id]["pipeline_pass"] != "sonnet"
        for response_id in sonnet_response_ids
    ):
        raise ValueError("hybrid Sonnet evidence is linked to the wrong pass")

    if promoted:
        if effective_model_tier != "opus":
            raise ValueError("promoted hybrid analysis must be produced by Opus")
        if _require_number(
            hybrid.get("sonnet_score"),
            "hybrid Sonnet score",
        ) != sonnet_score_lineage["raw_weighted_score"]:
            raise ValueError("hybrid Sonnet score does not match its evidence")
        if hybrid.get("opus_verdict") != score_lineage["final_verdict"]:
            raise ValueError("hybrid Opus verdict does not match final analysis")
        if _require_number(
            hybrid.get("opus_score"),
            "hybrid Opus score",
        ) != score_lineage["raw_weighted_score"]:
            raise ValueError("hybrid Opus score does not match final analysis")
    else:
        if effective_model_tier != "sonnet":
            raise ValueError("unpromoted hybrid analysis must remain on Sonnet")
        if sonnet_score_lineage != score_lineage or sonnet_readers != readers:
            raise ValueError("unpromoted Sonnet evidence must match final analysis")

    accounted_response_ids = (
        root_response_ids
        | sonnet_response_ids
        | cold_read_response_ids
        | claim_response_ids
    )
    used_response_ids = {
        call["response_id"]
        for call in models["calls"]
        if call["disposition"] == "used"
    }
    if used_response_ids != accounted_response_ids:
        raise ValueError("hybrid model calls are not linked to decision evidence")

    return {
        "promoted_to_opus": promoted,
        "sonnet_verdict": sonnet_verdict,
        "final_model": final_model,
        "sonnet_readers": sonnet_readers,
        "sonnet_score_lineage": sonnet_score_lineage,
        "sonnet_response_ids": sorted(sonnet_response_ids),
        "final_response_ids": sorted(root_response_ids),
    }


def build_benchmark_trust_seal(
    *,
    analysis: Dict[str, Any],
    usage: Dict[str, Any],
    source: Mapping[str, Any],
    parser_metadata: Mapping[str, Any],
    route: str,
    effective_model_tier: str,
    model_ids: Mapping[str, str],
    contracts: Mapping[str, str],
    release: Mapping[str, Any],
    local_source_proof: Mapping[str, Any],
    authorized_benchmark_cap_microusd: int,
) -> Dict[str, Any]:
    """Build and validate a persistence-free seal for one paid benchmark result."""
    if usage.get("failed_calls"):
        raise ValueError("Paid benchmark cannot lock with unresolved failed calls")
    if (
        type(authorized_benchmark_cap_microusd) is not int
        or authorized_benchmark_cap_microusd <= 0
    ):
        raise ValueError("Paid benchmark requires its positive authorized cap")
    release_git_sha = _require_nonempty_string(
        release.get("git_sha"),
        "benchmark release Git SHA",
    )
    if re.fullmatch(r"[a-f0-9]{40}", release_git_sha) is None:
        raise ValueError("benchmark release Git SHA is invalid")
    _require_sha256(
        release.get("catalog_sha256"),
        "benchmark release catalog SHA-256",
    )
    _require_sha256(
        release.get("deployment_config_sha256"),
        "benchmark release deployment configuration SHA-256",
    )
    release_pricing_sha256 = _require_sha256(
        release.get("pricing_sha256"),
        "benchmark release pricing SHA-256",
    )
    if release_pricing_sha256 != runtime_pricing_sha256():
        raise ValueError("benchmark release pricing fingerprint is not the runtime table")
    cloud_run_revision = _require_nonempty_string(
        release.get("cloud_run_revision"),
        "benchmark Cloud Run revision",
    )
    if re.fullmatch(r"llmproxycandidate-[0-9]{5}-[a-z0-9]{3}", cloud_run_revision) is None:
        raise ValueError("Paid benchmark requires a deployed Cloud Run revision")
    build_timestamp = _require_nonempty_string(
        release.get("build_timestamp"),
        "benchmark release build timestamp",
    )
    try:
        parsed_build_timestamp = datetime.fromisoformat(
            build_timestamp.replace("Z", "+00:00")
        )
    except ValueError as error:
        raise ValueError("benchmark release build timestamp is invalid") from error
    if parsed_build_timestamp.tzinfo is None:
        raise ValueError("benchmark release build timestamp is invalid")
    analysis_version = _require_nonempty_string(
        analysis.get("analysis_version"),
        "benchmark analysis version",
    )
    if analysis_version != "v9_archaeology":
        raise ValueError("Paid V9 benchmark requires a complete archaeology analysis")
    effective_tier = _require_nonempty_string(
        effective_model_tier,
        "benchmark effective model tier",
    )
    models = _model_lineage(
        usage=usage,
        selection_request=route,
        pipeline_model_tier=route,
        effective_model_tier=effective_tier,
        model_ids=model_ids,
        cold_read_model_route=_cold_read_model_route(analysis),
    )
    _validate_usage_cost_mirrors(usage)
    if (
        usage["estimated_cost_nanousd"]
        != sum(call["usage"]["estimated_cost_nanousd"] for call in models["calls"])
        or usage["rounding_variance_nanousd"]
        != sum(
            call["usage"]["rounding_variance_nanousd"]
            for call in models["calls"]
        )
    ):
        raise ValueError("Paid benchmark root exact cost does not match call ledger")
    required_budget_fields = {
        "requested_model",
        "stage",
        "logical_retry",
        "decision",
        "request_content_bytes",
        "request_envelope_overhead_bytes",
        "request_bytes_upper_bound",
        "input_tokens_upper_bound",
        "output_tokens_upper_bound",
        "request_ceiling_microusd",
        "request_ceiling_usd",
        "sequence",
        "spent_before_microusd",
        "spent_before_usd",
        "reserved_before_microusd",
        "reserved_before_usd",
        "remaining_before_microusd",
        "remaining_before_usd",
        "settled_cost_microusd",
        "settled_cost_usd",
        "spent_after_microusd",
        "spent_after_usd",
        "reserved_after_microusd",
        "reserved_after_usd",
        "preflight_ceiling_exceeded",
        "platform_recheck_sha256",
    }
    previous_budget_check = None
    for index, call in enumerate(models["calls"]):
        budget_check = call.get("budget_check")
        if (
            not isinstance(budget_check, dict)
            or not required_budget_fields.issubset(budget_check)
        ):
            raise ValueError(
                f"paid benchmark call {index} lacks its complete budget receipt"
            )
        if (
            budget_check["decision"] != "settled"
            or budget_check["preflight_ceiling_exceeded"] is not False
            or budget_check["request_ceiling_microusd"]
            > budget_check["remaining_before_microusd"]
        ):
            raise ValueError(
                f"paid benchmark call {index} did not settle inside its admitted ceiling"
            )
        inferred_cap = (
            budget_check["spent_before_microusd"]
            + budget_check["reserved_before_microusd"]
            + budget_check["remaining_before_microusd"]
        )
        if inferred_cap != authorized_benchmark_cap_microusd:
            raise ValueError(
                f"paid benchmark call {index} does not bind the authorized cap"
            )
        if previous_budget_check is None:
            if budget_check["sequence"] <= 0:
                raise ValueError("paid benchmark budget sequence must be positive")
        elif (
            budget_check["sequence"] != previous_budget_check["sequence"] + 1
            or budget_check["spent_before_microusd"]
            != previous_budget_check["spent_after_microusd"]
            or budget_check["reserved_before_microusd"]
            != previous_budget_check["reserved_after_microusd"]
        ):
            raise ValueError(
                f"paid benchmark call {index} breaks budget ledger continuity"
            )
        previous_budget_check = budget_check
    readers = _manifest_reader_lineage(
        analysis,
        analysis_version,
        TRUST_MANIFEST_VERSION,
    )
    score_lineage = _score_lineage(analysis, analysis_version)
    _validate_response_links(
        models,
        readers,
        score_lineage,
        analysis,
        TRUST_MANIFEST_VERSION,
    )
    cold_read = _cold_read_provenance(
        analysis=analysis,
        analysis_version=analysis_version,
        models=models,
    )
    claim_verification = _claim_verification_provenance(
        analysis=analysis,
        models=models,
        effective_model_tier=effective_tier,
    )
    hybrid = _hybrid_provenance(
        analysis=analysis,
        pipeline_model_tier=route,
        effective_model_tier=effective_tier,
        models=models,
        readers=readers,
        score_lineage=score_lineage,
        cold_read=cold_read,
        claim_verification=claim_verification,
        manifest_version=TRUST_MANIFEST_VERSION,
        scoring_code_version=SCORING_CODE_VERSION,
    )
    page_count = source.get("physical_page_count")
    word_count = source.get("word_count")
    if type(page_count) is not int or page_count <= 0:
        raise ValueError("benchmark source page count must be positive")
    if type(word_count) is not int or word_count <= 0:
        raise ValueError("benchmark source word count must be positive")
    content_sha256 = _require_sha256(
        source.get("source_sha256"),
        "benchmark source SHA-256",
    )
    page_evidence_sha256 = _require_sha256(
        source.get("page_evidence_sha256"),
        "benchmark page-evidence SHA-256",
    )
    scene_count = validate_scene_count_evidence(
        source.get("scene_count_evidence")
    )
    if source.get("scene_heading_count") != scene_count["scene_heading_count"]:
        raise ValueError("benchmark source scene count is inconsistent")
    for phase in ("before", "after"):
        proof = local_source_proof.get(phase)
        if not isinstance(proof, Mapping) or proof.get("clean") is not True:
            raise ValueError(f"benchmark local source proof {phase} must be clean")
        local_git_sha = _require_nonempty_string(
            proof.get("git_sha"),
            f"benchmark local Git SHA {phase}",
        )
        if local_git_sha != release.get("git_sha"):
            raise ValueError("benchmark local and deployed Git revisions differ")
    if release.get("source_clean") is not True:
        raise ValueError("benchmark release source was not clean")
    if any(
        call.get("pricing_sha256") != release_pricing_sha256
        for call in models["calls"]
    ):
        raise ValueError("benchmark calls and release pricing fingerprints differ")
    canonical_candidate_release = _canonical_release_provenance(
        release,
        "benchmark candidate release",
    )
    if canonical_candidate_release is None or any(
        call.get(field) != canonical_candidate_release
        for call in models["calls"]
        for field in ("release", "expected_release")
    ):
        raise ValueError(
            "benchmark calls are not bound to the exact candidate release"
        )

    seal: Dict[str, Any] = {
        "seal_version": BENCHMARK_TRUST_SEAL_VERSION,
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "analysis_payload_sha256": _analysis_payload_sha256(analysis),
        "usage_sha256": _sha256_bytes(_canonical_json(usage).encode("utf-8")),
        "budget": {
            "authorized_cap_microusd": authorized_benchmark_cap_microusd,
            "authorized_cap_usd": authorized_benchmark_cap_microusd / 1_000_000,
            "first_sequence": models["calls"][0]["budget_check"]["sequence"],
            "last_sequence": models["calls"][-1]["budget_check"]["sequence"],
            "spent_before_microusd": models["calls"][0]["budget_check"][
                "spent_before_microusd"
            ],
            "spent_after_microusd": models["calls"][-1]["budget_check"][
                "spent_after_microusd"
            ],
        },
        "source": {
            "content_sha256": content_sha256,
            "source_file": _require_nonempty_string(
                source.get("filename"),
                "benchmark source filename",
            ),
            "page_count": page_count,
            "word_count": word_count,
            "page_evidence_sha256": page_evidence_sha256,
            "scene_heading_count": scene_count["scene_heading_count"],
            "scene_count_evidence_sha256": scene_count["evidence_sha256"],
        },
        "engine": {
            "analysis_version": analysis_version,
            **_code_fingerprints(),
            "contracts": copy.deepcopy(dict(contracts)),
            "local_source_proof": copy.deepcopy(dict(local_source_proof)),
            "release": copy.deepcopy(dict(release)),
        },
        "models": models,
        "readers": readers,
        "score_lineage": score_lineage,
        "cold_read": cold_read,
        "claim_verification": claim_verification,
        "hybrid": hybrid,
        "usage": _usage_summary(usage),
        "evidence": _evidence_provenance(
            metadata=dict(parser_metadata),
            analysis=analysis,
            page_count=page_count,
            character_count=parser_metadata.get("character_count"),
            effective_model_tier=effective_tier,
            model_ids=models["model_ids_by_tier"],
        ),
    }
    seal["integrity_sha256"] = _sha256_bytes(
        _canonical_json(seal).encode("utf-8")
    )
    return seal


def validate_benchmark_trust_seal(
    seal: Dict[str, Any],
    **inputs: Any,
) -> None:
    """Reject an altered or incomplete local benchmark seal."""
    expected = build_benchmark_trust_seal(**inputs)
    expected["created_at"] = seal.get("created_at")
    unsigned = copy.deepcopy(expected)
    unsigned.pop("integrity_sha256", None)
    expected["integrity_sha256"] = _sha256_bytes(
        _canonical_json(unsigned).encode("utf-8")
    )
    if seal != expected:
        raise ValueError("Benchmark trust seal does not match its analysis evidence")


def attach_trust_manifest(
    raw: Dict[str, Any],
    *,
    selection_request: str,
    pipeline_model_tier: str,
    effective_model_tier: str,
    model_ids: Mapping[str, str],
    origin_kind: str,
    origin_id: Optional[str],
) -> Dict[str, Any]:
    """Return a future-write document carrying a sealed trust manifest."""
    if not isinstance(raw, dict):
        raise ValueError("raw analysis must be an object")

    trusted = copy.deepcopy(raw)
    content_hash = _require_sha256(trusted.get("content_hash"), "content hash")
    if trusted.get("identity_status") != "verified":
        raise ValueError("Permanent V9 coverage requires verified identity")
    source_file = _analyzed_source_file(trusted)
    project_id = _require_nonempty_string(trusted.get("project_id"), "project_id")
    version_id = _require_nonempty_string(trusted.get("version_id"), "version_id")
    queued_at_ms = trusted.get("queued_at_ms")
    queued_iso = _queued_iso(queued_at_ms)
    expected_version_id = f"{content_hash}_{queued_at_ms}"
    if version_id != expected_version_id:
        raise ValueError("version_id does not match content hash and queue time")

    analysis_version = _require_nonempty_string(
        trusted.get("analysis_version"),
        "analysis_version",
    )
    if analysis_version != "v9_archaeology":
        raise ValueError("Only complete V9 archaeology can receive a trust manifest")
    schema_version = _schema_version(analysis_version)
    metadata = trusted.get("metadata")
    if not isinstance(metadata, dict):
        raise ValueError("metadata must be an object")
    parser_version = _require_nonempty_string(
        trusted.get("parser_version"),
        "parser orchestrator version",
    )
    parser_extractor_version = _require_nonempty_string(
        metadata.get("parser_extractor_version"),
        "parser extractor version",
    )
    extraction_method = _require_nonempty_string(
        metadata.get("extraction_method"),
        "parser extraction method",
    )
    page_count = metadata.get("page_count")
    word_count = metadata.get("word_count")
    character_count = metadata.get("character_count")
    if type(page_count) is not int or page_count <= 0:
        raise ValueError("metadata.page_count must be a positive integer")
    if type(word_count) is not int or word_count <= 0:
        raise ValueError("metadata.word_count must be a positive integer")
    if type(character_count) is not int or character_count <= 0:
        raise ValueError("metadata.character_count must be a positive integer")

    models = _model_lineage(
        usage=trusted.get("usage"),
        selection_request=selection_request,
        pipeline_model_tier=pipeline_model_tier,
        effective_model_tier=effective_model_tier,
        model_ids=model_ids,
        cold_read_model_route=_cold_read_model_route(trusted.get("analysis")),
    )
    _validate_cost_mirrors(trusted, trusted["usage"])
    if trusted.get("analysis_model") != models["effective_model_id"]:
        raise ValueError("analysis_model must be the exact effective model ID")

    origin = _require_nonempty_string(origin_kind, "origin_kind")
    if origin not in {"daemon_queue", "cli"}:
        raise ValueError("origin_kind must be daemon_queue or cli")
    if origin == "daemon_queue":
        _require_nonempty_string(origin_id, "daemon queue origin ID")
    storage_path, storage_generation = _validated_archive_pointer(
        trusted.get("storage_path"),
        trusted.get("storage_generation"),
        project_id=project_id,
        version_id=version_id,
    )

    manifest: Dict[str, Any] = {
        "manifest_version": TRUST_MANIFEST_VERSION,
        "created_at": queued_iso,
        "analysis_payload_sha256": _analysis_payload_sha256(
            trusted.get("analysis")
        ),
        "source": {
            "content_sha256": content_hash,
            "source_file": source_file,
            "page_count": page_count,
            "word_count": word_count,
            "character_count": character_count,
            "storage_path": storage_path,
            "storage_generation": storage_generation,
            "archive_status": "archived",
        },
        "origin": {
            "kind": origin,
            "id": origin_id,
            "project_id": project_id,
            "version_id": version_id,
            "queued_at_ms": queued_at_ms,
        },
        "engine": {
            "analysis_version": analysis_version,
            "analysis_schema_version": schema_version,
            "prompt_contract_version": PROMPT_CONTRACT_VERSION,
            "scoring_code_version": SCORING_CODE_VERSION,
            "trap_contract_version": TRAP_CONTRACT_VERSION,
            "parser_orchestrator_version": parser_version,
            "parser_extractor_version": parser_extractor_version,
            "extraction_method": extraction_method,
            **_code_fingerprints(),
        },
        "models": models,
        "readers": _manifest_reader_lineage(
            trusted.get("analysis"),
            analysis_version,
            TRUST_MANIFEST_VERSION,
        ),
        "score_lineage": _score_lineage(
            trusted.get("analysis"),
            analysis_version,
        ),
        "calibration": _sanitized_calibration(
            trusted.get("calibration_profile")
        ),
        "usage": _usage_summary(trusted.get("usage")),
        "evidence": _evidence_provenance(
            metadata=metadata,
            analysis=trusted["analysis"],
            page_count=page_count,
            character_count=character_count,
            effective_model_tier=effective_model_tier,
            model_ids=models["model_ids_by_tier"],
        ),
    }
    _validate_response_links(
        manifest["models"],
        manifest["readers"],
        manifest["score_lineage"],
        trusted["analysis"],
        TRUST_MANIFEST_VERSION,
    )
    manifest["cold_read"] = _cold_read_provenance(
        analysis=trusted["analysis"],
        analysis_version=analysis_version,
        models=manifest["models"],
    )
    manifest["claim_verification"] = _claim_verification_provenance(
        analysis=trusted["analysis"],
        models=manifest["models"],
        effective_model_tier=effective_model_tier,
    )
    manifest["hybrid"] = _hybrid_provenance(
        analysis=trusted["analysis"],
        pipeline_model_tier=pipeline_model_tier,
        effective_model_tier=effective_model_tier,
        models=manifest["models"],
        readers=manifest["readers"],
        score_lineage=manifest["score_lineage"],
        cold_read=manifest["cold_read"],
        claim_verification=manifest["claim_verification"],
        manifest_version=TRUST_MANIFEST_VERSION,
        scoring_code_version=SCORING_CODE_VERSION,
    )
    manifest["integrity_sha256"] = _sha256_bytes(
        _canonical_json(manifest).encode("utf-8")
    )

    trusted["trust_manifest"] = manifest
    trusted["trust_manifest_version"] = TRUST_MANIFEST_VERSION
    trusted["analysis_schema_version"] = schema_version
    trusted["prompt_version"] = PROMPT_CONTRACT_VERSION
    trusted["parser_version"] = trusted.get("parser_version")
    trusted["scoring_code_version"] = SCORING_CODE_VERSION
    trusted["analysis_provider"] = ANALYSIS_PROVIDER
    return trusted


def validate_permanent_analysis(raw: Dict[str, Any]) -> None:
    """Reject an incomplete or altered future analysis before Firestore."""
    if not isinstance(raw, dict):
        raise ValueError("Permanent analysis must be an object")
    manifest = raw.get("trust_manifest")
    if not isinstance(manifest, dict):
        raise ValueError("Permanent analysis requires a trust manifest")
    manifest_version = manifest.get("manifest_version")
    if manifest_version not in SUPPORTED_TRUST_MANIFEST_VERSIONS:
        raise ValueError("Unsupported trust manifest version")

    sealed = copy.deepcopy(manifest)
    stored_integrity = sealed.pop("integrity_sha256", None)
    expected_integrity = _sha256_bytes(
        _canonical_json(sealed).encode("utf-8")
    )
    if stored_integrity != expected_integrity:
        raise ValueError("Trust manifest integrity check failed")
    if manifest.get("analysis_payload_sha256") != _analysis_payload_sha256(
        raw.get("analysis")
    ):
        raise ValueError("Producer-facing analysis payload does not match its trust seal")

    source = manifest.get("source")
    origin = manifest.get("origin")
    engine = manifest.get("engine")
    models = manifest.get("models")
    if not all(isinstance(block, dict) for block in (source, origin, engine, models)):
        raise ValueError("Trust manifest is missing required blocks")

    content_hash = _require_sha256(raw.get("content_hash"), "content hash")
    if source.get("content_sha256") != content_hash:
        raise ValueError("Trust manifest content hash does not match analysis")
    if raw.get("identity_status") != "verified":
        raise ValueError("Permanent V9 coverage requires verified identity")
    if origin.get("project_id") != raw.get("project_id"):
        raise ValueError("Trust manifest project identity does not match analysis")
    if origin.get("version_id") != raw.get("version_id"):
        raise ValueError("Trust manifest version identity does not match analysis")
    if origin.get("queued_at_ms") != raw.get("queued_at_ms"):
        raise ValueError("Trust manifest queue time does not match analysis")

    metadata = raw.get("metadata")
    if not isinstance(metadata, dict):
        raise ValueError("Permanent analysis metadata must be an object")
    storage_path, storage_generation = _validated_archive_pointer(
        raw.get("storage_path"),
        raw.get("storage_generation"),
        project_id=_require_nonempty_string(
            raw.get("project_id"),
            "project_id",
        ),
        version_id=_require_nonempty_string(
            raw.get("version_id"),
            "version_id",
        ),
    )
    expected_source = {
        "content_sha256": content_hash,
        "source_file": _analyzed_source_file(raw),
        "page_count": metadata.get("page_count"),
        "word_count": metadata.get("word_count"),
        "character_count": metadata.get("character_count"),
        "storage_path": storage_path,
        "storage_generation": storage_generation,
        "archive_status": "archived",
    }
    if source != expected_source:
        raise ValueError("Trust manifest source provenance does not match analysis")

    analysis_version = str(raw.get("analysis_version", ""))
    expected_versions = {
        "trust_manifest_version": manifest_version,
        "analysis_provider": ANALYSIS_PROVIDER,
    }
    for key, expected in expected_versions.items():
        if raw.get(key) != expected:
            raise ValueError(f"Permanent analysis has an invalid {key}")
    scoring_code_version = raw.get("scoring_code_version")
    if scoring_code_version not in SUPPORTED_SCORING_CODE_VERSIONS:
        raise ValueError("Permanent analysis has an invalid scoring_code_version")
    schema_version = raw.get("analysis_schema_version")
    if analysis_version == "v9_archaeology":
        if schema_version not in SUPPORTED_ANALYSIS_SCHEMA_VERSIONS:
            raise ValueError("Permanent analysis has an invalid analysis_schema_version")
    elif schema_version != TRIAGE_SCHEMA_VERSION:
        raise ValueError("Permanent analysis has an invalid analysis_schema_version")
    prompt_version = raw.get("prompt_version")
    if prompt_version not in SUPPORTED_PROMPT_CONTRACT_VERSIONS:
        raise ValueError("Permanent analysis has an invalid prompt_version")
    if (
        analysis_version == "v9_archaeology"
        and (
            manifest_version,
            schema_version,
            prompt_version,
            scoring_code_version,
        ) not in SUPPORTED_ANALYSIS_CONTRACTS
    ):
        raise ValueError(
            "Permanent analysis manifest and engine contract versions are incompatible"
        )
    if engine.get("analysis_version") != raw.get("analysis_version"):
        raise ValueError("Trust manifest analysis version does not match analysis")
    expected_engine_versions = {
        "analysis_schema_version": raw.get("analysis_schema_version"),
        "prompt_contract_version": raw.get("prompt_version"),
        "scoring_code_version": scoring_code_version,
    }
    for key, expected in expected_engine_versions.items():
        if engine.get(key) != expected:
            raise ValueError(
                f"Trust manifest engine contract has an invalid {key}"
            )
    if scoring_code_version == SCORING_CODE_VERSION:
        false_positive = raw.get("analysis", {}).get("false_positive_check", {})
        if false_positive.get("trap_contract_version") != TRAP_CONTRACT_VERSION:
            raise ValueError("Permanent analysis has an invalid trap contract version")
        if engine.get("trap_contract_version") != TRAP_CONTRACT_VERSION:
            raise ValueError("Trust manifest engine has an invalid trap contract version")
    expected_parser = {
        "parser_orchestrator_version": raw.get("parser_version"),
        "parser_extractor_version": metadata.get("parser_extractor_version"),
        "extraction_method": metadata.get("extraction_method"),
    }
    for key, expected in expected_parser.items():
        if engine.get(key) != expected:
            raise ValueError("Trust manifest parser provenance does not match analysis")
    if models.get("effective_model_id") != raw.get("analysis_model"):
        raise ValueError("Trust manifest model identity does not match analysis")

    current_score_lineage = _score_lineage(
        raw.get("analysis"),
        analysis_version,
        scoring_code_version=str(scoring_code_version),
    )
    if manifest.get("score_lineage") != current_score_lineage:
        raise ValueError("Trust manifest score lineage does not match analysis")
    current_reader_lineage = _manifest_reader_lineage(
        raw.get("analysis"),
        analysis_version,
        str(manifest_version),
    )
    if manifest.get("readers") != current_reader_lineage:
        raise ValueError("Trust manifest reader lineage does not match analysis")

    usage = raw.get("usage")
    current_models = _model_lineage(
        usage=usage,
        selection_request=str(models.get("selection_request", "")),
        pipeline_model_tier=str(models.get("pipeline_model_tier", "")),
        effective_model_tier=str(models.get("effective_model_tier", "")),
        model_ids=models.get("model_ids_by_tier", {}),
        cold_read_model_route=_cold_read_model_route(raw.get("analysis")),
        manifest_version=str(manifest_version),
        prompt_contract_version=str(engine.get("prompt_contract_version", "")),
    )
    if models != current_models:
        raise ValueError("Trust manifest model lineage does not match usage")
    _validate_response_links(
        current_models,
        current_reader_lineage,
        current_score_lineage,
        raw["analysis"],
        str(manifest_version),
    )
    current_cold_read = _cold_read_provenance(
        analysis=raw["analysis"],
        analysis_version=analysis_version,
        models=current_models,
    )
    if manifest.get("cold_read") != current_cold_read:
        raise ValueError("Trust manifest cold-read provenance does not match analysis")
    current_claim_verification = (
        _claim_verification_provenance(
            analysis=raw["analysis"],
            models=current_models,
            effective_model_tier=str(models.get("effective_model_tier", "")),
            prompt_contract_version=str(
                engine.get("prompt_contract_version", "")
            ),
        )
        if manifest_version == TRUST_MANIFEST_VERSION
        else None
    )
    if manifest_version == TRUST_MANIFEST_VERSION and (
        manifest.get("claim_verification") != current_claim_verification
    ):
        raise ValueError(
            "Trust manifest claim verification does not match analysis"
        )
    current_hybrid = _hybrid_provenance(
        analysis=raw.get("analysis"),
        pipeline_model_tier=str(models.get("pipeline_model_tier", "")),
        effective_model_tier=str(models.get("effective_model_tier", "")),
        models=current_models,
        readers=current_reader_lineage,
        score_lineage=current_score_lineage,
        cold_read=current_cold_read,
        claim_verification=current_claim_verification,
        manifest_version=str(manifest_version),
        scoring_code_version=str(scoring_code_version),
    )
    if manifest.get("hybrid") != current_hybrid:
        raise ValueError("Trust manifest hybrid provenance does not match analysis")
    if manifest.get("usage") != _usage_summary(usage):
        raise ValueError("Trust manifest usage does not match analysis usage")
    if manifest_version in {
        Q2_TRUST_MANIFEST_VERSION,
        Q3_TRUST_MANIFEST_VERSION,
        Q4_TRUST_MANIFEST_VERSION,
        Q5_TRUST_MANIFEST_VERSION,
        TRUST_MANIFEST_VERSION,
    }:
        current_evidence = _evidence_provenance(
            metadata=metadata,
            analysis=raw["analysis"],
            page_count=metadata.get("page_count"),
            character_count=metadata.get("character_count"),
            effective_model_tier=str(models.get("effective_model_tier", "")),
            model_ids=models.get("model_ids_by_tier", {}),
            require_scene_count=manifest_version == TRUST_MANIFEST_VERSION,
        )
        if manifest.get("evidence") != current_evidence:
            raise ValueError(
                "Trust manifest source evidence does not match analysis"
            )
    elif "evidence" in manifest:
        raise ValueError("Q1 trust manifest cannot contain Q2 evidence")
    _validate_cost_mirrors(raw, usage)
    if manifest.get("calibration") != _sanitized_calibration(
        raw.get("calibration_profile")
    ):
        raise ValueError("Trust manifest calibration does not match analysis")
