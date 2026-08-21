"""Immutable provenance contract for every future permanent V9 analysis.

The manifest records what source was read, which code and prompt contract ran,
which exact model responses were used, and how the saved score/verdict were
derived. A SHA-256 integrity seal makes silent edits detectable before write.
"""

from __future__ import annotations

import copy
import hashlib
import json
import re
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Mapping, Optional

try:
    from .verdict_contract import (
        BOUNDARY_WINDOW,
        READER_WEIGHTS,
        derive_verdict,
        near_verdict_boundary,
    )
except ImportError:
    from verdict_contract import (
        BOUNDARY_WINDOW,
        READER_WEIGHTS,
        derive_verdict,
        near_verdict_boundary,
    )

try:
    from .source_evidence import (
        validate_stored_citation_quality,
        validate_stored_context_policy,
        validate_stored_page_evidence,
    )
except ImportError:
    from source_evidence import (
        validate_stored_citation_quality,
        validate_stored_context_policy,
        validate_stored_page_evidence,
    )

LEGACY_TRUST_MANIFEST_VERSION = "lemon-trust-manifest-v1"
Q2_TRUST_MANIFEST_VERSION = "lemon-trust-manifest-v2"
Q3_TRUST_MANIFEST_VERSION = "lemon-trust-manifest-v3"
TRUST_MANIFEST_VERSION = "lemon-trust-manifest-v4"
SUPPORTED_TRUST_MANIFEST_VERSIONS = {
    LEGACY_TRUST_MANIFEST_VERSION,
    Q2_TRUST_MANIFEST_VERSION,
    Q3_TRUST_MANIFEST_VERSION,
    TRUST_MANIFEST_VERSION,
}
READER_RELIABILITY_CONTRACT_VERSION = "lemon-five-reader-panel-v1"
ANALYSIS_SCHEMA_VERSION = "v9-archaeology-schema-2026-07-29"
TRIAGE_SCHEMA_VERSION = "v9-triage-schema-2026-07-29"
PROMPT_CONTRACT_VERSION = "v9-archaeology-prompts-2026-07-29"
SCORING_CODE_VERSION = "v9-verdict-2026-07-29"
ANALYSIS_PROVIDER = "anthropic"
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

_SHA256_PATTERN = re.compile(r"^[a-f0-9]{64}$")
_ROOT = Path(__file__).resolve().parent


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
    manifest_path = Path(__file__).resolve()

    engine_hash = _sha256_file(engine_path)
    story_grid_source_hash = _sha256_file(story_grid_source_path)
    story_grid_hash = _sha256_file(story_grid_path)
    verdict_contract_hash = _sha256_file(verdict_contract_path)
    source_evidence_hash = _sha256_file(source_evidence_path)
    return {
        "engine_source_sha256": engine_hash,
        "parser_source_sha256": _sha256_file(parser_path),
        "story_grid_source_sha256": story_grid_source_hash,
        "story_grid_sha256": story_grid_hash,
        "verdict_contract_sha256": verdict_contract_hash,
        "source_evidence_sha256": source_evidence_hash,
        "manifest_builder_sha256": _sha256_file(manifest_path),
        # Conservative by design: any engine or Story Grid change invalidates
        # this bundle even if the edit was outside a prompt literal.
        "prompt_bundle_sha256": _sha256_bytes(
            (
                f"{engine_hash}:{story_grid_source_hash}:{story_grid_hash}:"
                f"{verdict_contract_hash}:{source_evidence_hash}"
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
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be numeric")
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


def _model_lineage(
    *,
    usage: Any,
    selection_request: str,
    pipeline_model_tier: str,
    effective_model_tier: str,
    model_ids: Mapping[str, str],
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
        stop_reason = _require_nonempty_string(
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
        if stage not in {"genre_detection", "reader", "synthesis", "triage"}:
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
        if stage == "reader" and reader_name not in CANONICAL_READER_NAMES:
            raise ValueError(
                f"usage.calls[{index}] has an invalid specialist reader"
            )
        if stage != "reader" and reader_name is not None:
            raise ValueError(
                f"usage.calls[{index}] has a reader outside the reader stage"
            )
        disposition = _require_nonempty_string(
            raw_call.get("disposition"),
            f"usage.calls[{index}].disposition",
        )
        if disposition not in {"used", "discarded_unusable"}:
            raise ValueError(
                f"usage.calls[{index}] has an unresolved disposition"
            )
        if stage == "genre_detection":
            expected_models = {
                model_ids_by_tier[tier]
                for tier in ("haiku", "sonnet")
                if tier in model_ids_by_tier
            }
        else:
            expected_tier = "haiku" if stage == "triage" else pipeline_pass
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
        call_records.append({
            "response_id": response_id,
            "requested_model": requested_model,
            "returned_model": returned_model,
            "stop_reason": stop_reason,
            "successful_attempt": successful_attempt,
            "retry_history": copy.deepcopy(retry_history),
            "stage": stage,
            "pipeline_pass": pipeline_pass,
            "boundary_run": boundary_run,
            "reader_name": reader_name,
            "disposition": disposition,
        })

    if len(set(response_ids)) != len(response_ids):
        raise ValueError("usage.calls contains duplicate response_id values")

    usage_totals = {}
    for field in USAGE_COUNTER_FIELDS:
        value = usage.get(field)
        if type(value) is not int or value < 0:
            raise ValueError(f"usage.{field} must be a non-negative integer")
        usage_totals[field] = value

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
    if by_model_totals != usage_totals:
        raise ValueError("usage.by_model totals do not match aggregate usage")

    failed_call_records = []
    failed_calls = usage.get("failed_calls", [])
    if not isinstance(failed_calls, list):
        raise ValueError("usage.failed_calls must be a list")
    for index, raw_call in enumerate(failed_calls):
        if not isinstance(raw_call, dict):
            raise ValueError(f"usage.failed_calls[{index}] must be an object")
        requested_model = _require_nonempty_string(
            raw_call.get("requested_model"),
            f"usage.failed_calls[{index}].requested_model",
        )
        stage = _require_nonempty_string(
            raw_call.get("stage"),
            f"usage.failed_calls[{index}].stage",
        )
        if stage not in {"genre_detection", "reader", "synthesis", "triage"}:
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
        if stage == "reader" and reader_name not in CANONICAL_READER_NAMES:
            raise ValueError(
                f"usage.failed_calls[{index}] has an invalid specialist reader"
            )
        if stage != "reader" and reader_name is not None:
            raise ValueError(
                f"usage.failed_calls[{index}] has a reader outside the reader stage"
            )
        if stage == "genre_detection":
            expected_models = {
                model_ids_by_tier[tier]
                for tier in ("haiku", "sonnet")
                if tier in model_ids_by_tier
            }
        else:
            expected_tier = "haiku" if stage == "triage" else pipeline_pass
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
        requested_model_ids.add(requested_model)
        failed_call_records.append({
            "requested_model": requested_model,
            "stage": stage,
            "pipeline_pass": pipeline_pass,
            "boundary_run": boundary_run,
            "reader_name": reader_name,
            "attempt_history": copy.deepcopy(attempt_history),
        })

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


def _boundary_provenance(analysis: Dict[str, Any]) -> Dict[str, Any]:
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
        "reruns_failed",
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
        evidence_core = _recompute_full_analysis_core(evidence)
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
    if selected_run_number != expected_selected_run:
        raise ValueError("boundary-run selected result is not the median-score run")
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

    verdict_counts: Dict[str, int] = {}
    for verdict in verdicts:
        verdict_counts[verdict] = verdict_counts.get(verdict, 0) + 1
    majority_verdict, majority_count = max(
        verdict_counts.items(),
        key=lambda item: item[1],
    )
    selected_verdict = next(
        str(run["verdict"])
        for run in runs
        if run["run_number"] == selected_run_number
    )
    expected_final_verdict = (
        majority_verdict if majority_count >= 2 else selected_verdict
    )
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
        if reason not in {"near_boundary", "reruns_failed"}:
            raise ValueError("triggered boundary provenance has the wrong reason")
        if not near_verdict_boundary(initial_score, boundary_window):
            raise ValueError("boundary re-runs require an initial near-boundary score")
        expected_reason = "near_boundary" if completed > 1 else "reruns_failed"
        if reason != expected_reason:
            raise ValueError("boundary-run outcome reason is inconsistent")
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


def _recompute_full_analysis_core(analysis: Dict[str, Any]) -> Dict[str, Any]:
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
    }


def _score_lineage(analysis: Any, analysis_version: str) -> Dict[str, Any]:
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

    core = _recompute_full_analysis_core(analysis)
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

    boundary = _boundary_provenance(analysis)
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
    selected_core = _recompute_full_analysis_core(selected_evidence)
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
        "verdict_before_adjustments": _require_nonempty_string(
            analysis.get("verdict_before_adjustments"),
            "analysis verdict before adjustments",
        ),
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
    return {
        "input_tokens": int(usage.get("input_tokens", 0)),
        "output_tokens": int(usage.get("output_tokens", 0)),
        "cache_creation_input_tokens": int(
            usage.get("cache_creation_input_tokens", 0)
        ),
        "cache_read_input_tokens": int(usage.get("cache_read_input_tokens", 0)),
        "call_count": int(usage.get("call_count", 0)),
        "actual_cost_microusd": int(usage.get("actual_cost_microusd", 0)),
        "finish_reason": str(usage.get("finish_reason", "")),
        "by_model": copy.deepcopy(usage.get("by_model", {})),
        "failed_calls": copy.deepcopy(usage.get("failed_calls", [])),
    }


def _evidence_provenance(
    *,
    metadata: Mapping[str, Any],
    analysis: Mapping[str, Any],
    page_count: int,
    character_count: int,
    effective_model_tier: str,
) -> Dict[str, Any]:
    page_evidence = validate_stored_page_evidence(metadata, page_count)
    context_policy = validate_stored_context_policy(
        analysis,
        character_count,
        effective_model_tier,
    )
    citation_quality = validate_stored_citation_quality(
        analysis,
        metadata,
        page_count,
    )
    extraction_quality = page_evidence["extraction_quality"]
    return {
        "page_extraction": {
            "version": page_evidence["page_evidence_version"],
            "evidence_sha256": metadata.get("page_evidence_sha256"),
            "status": extraction_quality["status"],
            "publication_ready": extraction_quality["publication_ready"],
            "readable_page_count": extraction_quality["readable_page_count"],
            "coverage_ratio": extraction_quality["coverage_ratio"],
            "opening_coverage_ratio": extraction_quality["opening_coverage_ratio"],
            "ending_coverage_ratio": extraction_quality["ending_coverage_ratio"],
            "native_cross_check": copy.deepcopy(
                metadata.get("native_cross_check")
            ),
        },
        "context": copy.deepcopy(context_policy),
        "citations": copy.deepcopy(citation_quality),
    }


def _validate_cost_mirrors(raw: Dict[str, Any], usage: Dict[str, Any]) -> None:
    canonical_cost_microusd = usage.get("actual_cost_microusd")
    if (
        type(raw.get("actual_cost_microusd")) is not int
        or raw.get("actual_cost_microusd") != canonical_cost_microusd
    ):
        raise ValueError("Permanent analysis cost mirror does not match usage")
    expected_cost_usd = canonical_cost_microusd / 1_000_000
    raw_cost_usd = raw.get("actual_cost_usd")
    if (
        isinstance(raw_cost_usd, bool)
        or not isinstance(raw_cost_usd, (int, float))
        or abs(float(raw_cost_usd) - expected_cost_usd) > 1e-12
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
) -> Optional[Dict[str, Any]]:
    root_response_ids = _boundary_response_ids(score_lineage)
    cold_read_response_ids = (
        set(cold_read["response_ids"])
        if isinstance(cold_read, dict)
        else set()
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
        if used_response_ids != root_response_ids | cold_read_response_ids:
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
        root_response_ids | sonnet_response_ids | cold_read_response_ids
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
    if analysis_version not in {"v9_archaeology", "v9_triage"}:
        raise ValueError("Only V9 analyses can receive this trust manifest")
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
    manifest["hybrid"] = _hybrid_provenance(
        analysis=trusted["analysis"],
        pipeline_model_tier=pipeline_model_tier,
        effective_model_tier=effective_model_tier,
        models=manifest["models"],
        readers=manifest["readers"],
        score_lineage=manifest["score_lineage"],
        cold_read=manifest["cold_read"],
        manifest_version=TRUST_MANIFEST_VERSION,
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
        "analysis_schema_version": _schema_version(analysis_version),
        "prompt_version": PROMPT_CONTRACT_VERSION,
        "scoring_code_version": SCORING_CODE_VERSION,
        "analysis_provider": ANALYSIS_PROVIDER,
    }
    for key, expected in expected_versions.items():
        if raw.get(key) != expected:
            raise ValueError(f"Permanent analysis has an invalid {key}")
    if engine.get("analysis_version") != raw.get("analysis_version"):
        raise ValueError("Trust manifest analysis version does not match analysis")
    expected_engine_versions = {
        "analysis_schema_version": _schema_version(analysis_version),
        "prompt_contract_version": PROMPT_CONTRACT_VERSION,
        "scoring_code_version": SCORING_CODE_VERSION,
    }
    for key, expected in expected_engine_versions.items():
        if engine.get(key) != expected:
            raise ValueError(
                f"Trust manifest engine contract has an invalid {key}"
            )
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

    current_score_lineage = _score_lineage(raw.get("analysis"), analysis_version)
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
    current_hybrid = _hybrid_provenance(
        analysis=raw.get("analysis"),
        pipeline_model_tier=str(models.get("pipeline_model_tier", "")),
        effective_model_tier=str(models.get("effective_model_tier", "")),
        models=current_models,
        readers=current_reader_lineage,
        score_lineage=current_score_lineage,
        cold_read=current_cold_read,
        manifest_version=str(manifest_version),
    )
    if manifest.get("hybrid") != current_hybrid:
        raise ValueError("Trust manifest hybrid provenance does not match analysis")
    if manifest.get("usage") != _usage_summary(usage):
        raise ValueError("Trust manifest usage does not match analysis usage")
    if manifest_version in {
        Q2_TRUST_MANIFEST_VERSION,
        Q3_TRUST_MANIFEST_VERSION,
        TRUST_MANIFEST_VERSION,
    }:
        current_evidence = _evidence_provenance(
            metadata=metadata,
            analysis=raw["analysis"],
            page_count=metadata.get("page_count"),
            character_count=metadata.get("character_count"),
            effective_model_tier=str(models.get("effective_model_tier", "")),
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
