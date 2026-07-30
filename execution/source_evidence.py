"""Source-page, context-window, and citation evidence for permanent analyses.

Q2 treats the extracted screenplay as evidence, not an unstructured text blob.
Every physical PDF page receives a deterministic marker, extraction quality is
measured page by page, and model citations are checked against that page map
before a producer-facing verdict can be saved.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from typing import Any, Dict, Iterable, List, Mapping, Sequence


PAGE_EVIDENCE_VERSION = "lemon-page-evidence-v1"
CONTEXT_POLICY_VERSION = "lemon-context-policy-v1"
CITATION_EVIDENCE_VERSION = "lemon-citation-evidence-v1"

PAGE_MARKER_PATTERN = re.compile(r"(?m)^\[PAGE ([1-9][0-9]*)\][ \t]*$")
MIN_PAGE_WORDS = 3
MIN_PAGE_COVERAGE_RATIO = 0.80
MIN_EDGE_COVERAGE_RATIO = 0.70
EDGE_WINDOW_PAGES = 10

# Anthropic documents a 200k-token context window for Haiku 4.5 and 1M for
# Sonnet 4.6 / Opus 4.7. These input budgets intentionally reserve substantial
# room for system prompts, tools, thinking, and output.
MODEL_CONTEXT_TOKENS = {
    "haiku": 200_000,
    "sonnet": 1_000_000,
    "opus": 1_000_000,
}
MODEL_SAFE_INPUT_TOKENS = {
    "haiku": 150_000,
    "sonnet": 800_000,
    "opus": 800_000,
}
CONSERVATIVE_CHARACTERS_PER_TOKEN = 3


class SourceEvidenceError(ValueError):
    """The source cannot support a trustworthy permanent verdict."""


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def sha256_json(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def page_marker(page_number: int) -> str:
    if type(page_number) is not int or page_number <= 0:
        raise ValueError("page_number must be a positive integer")
    return f"[PAGE {page_number}]"


def join_marked_pages(page_texts: Sequence[str]) -> str:
    """Join physical pages without discarding blank pages or their identity."""
    blocks = []
    for page_number, raw_text in enumerate(page_texts, 1):
        normalized = str(raw_text or "").replace("\r\n", "\n").replace("\r", "\n")
        blocks.append(f"{page_marker(page_number)}\n{normalized.strip()}")
    return "\n\n".join(blocks)


def _marked_page_contents(text: str) -> tuple[List[int], Dict[int, str]]:
    matches = list(PAGE_MARKER_PATTERN.finditer(text))
    marker_numbers = [int(match.group(1)) for match in matches]
    contents: Dict[int, str] = {}
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        page_number = int(match.group(1))
        if page_number not in contents:
            contents[page_number] = text[start:end].strip()
    return marker_numbers, contents


def build_page_evidence(
    text: str,
    expected_page_count: int,
    extraction_method: str,
) -> Dict[str, Any]:
    """Measure whether marked text represents the complete physical PDF."""
    if type(expected_page_count) is not int or expected_page_count <= 0:
        raise SourceEvidenceError("The PDF page count is missing or invalid")

    marker_numbers, contents = _marked_page_contents(text)
    expected_numbers = list(range(1, expected_page_count + 1))
    unique_markers = set(marker_numbers)
    missing_pages = [page for page in expected_numbers if page not in unique_markers]
    unexpected_pages = sorted(
        page for page in unique_markers if page < 1 or page > expected_page_count
    )
    duplicate_pages = sorted(
        page for page in unique_markers if marker_numbers.count(page) > 1
    )
    marker_order_valid = marker_numbers == expected_numbers

    diagnostics: List[Dict[str, Any]] = []
    readable_pages: List[int] = []
    for page_number in expected_numbers:
        if page_number not in contents:
            diagnostics.append(
                {
                    "page": page_number,
                    "status": "missing",
                    "characters": 0,
                    "words": 0,
                }
            )
            continue
        content = contents[page_number]
        word_count = len(content.split())
        if word_count == 0:
            status = "empty"
        elif word_count < MIN_PAGE_WORDS:
            status = "sparse"
        else:
            status = "readable"
            readable_pages.append(page_number)
        diagnostics.append(
            {
                "page": page_number,
                "status": status,
                "characters": len(content),
                "words": word_count,
            }
        )

    coverage_ratio = len(readable_pages) / expected_page_count
    edge_size = min(EDGE_WINDOW_PAGES, expected_page_count)
    first_pages = set(range(1, edge_size + 1))
    final_pages = set(range(expected_page_count - edge_size + 1, expected_page_count + 1))
    readable_set = set(readable_pages)
    first_coverage = len(first_pages & readable_set) / edge_size
    final_coverage = len(final_pages & readable_set) / edge_size

    issues: List[str] = []
    if missing_pages:
        issues.append("missing_page_markers")
    if unexpected_pages:
        issues.append("unexpected_page_markers")
    if duplicate_pages:
        issues.append("duplicate_page_markers")
    if not marker_order_valid:
        issues.append("page_marker_sequence_mismatch")
    if coverage_ratio < MIN_PAGE_COVERAGE_RATIO:
        issues.append("insufficient_overall_page_text")
    if first_coverage < MIN_EDGE_COVERAGE_RATIO:
        issues.append("insufficient_opening_page_text")
    if final_coverage < MIN_EDGE_COVERAGE_RATIO:
        issues.append("insufficient_ending_page_text")

    quality = {
        "status": "complete" if not issues else "incomplete",
        "publication_ready": not issues,
        "expected_page_count": expected_page_count,
        "marker_count": len(marker_numbers),
        "readable_page_count": len(readable_pages),
        "empty_page_count": sum(
            1 for page in diagnostics if page["status"] == "empty"
        ),
        "sparse_page_count": sum(
            1 for page in diagnostics if page["status"] == "sparse"
        ),
        "coverage_ratio": round(coverage_ratio, 4),
        "opening_coverage_ratio": round(first_coverage, 4),
        "ending_coverage_ratio": round(final_coverage, 4),
        "missing_pages": missing_pages,
        "unexpected_pages": unexpected_pages,
        "duplicate_pages": duplicate_pages,
        "marker_order_valid": marker_order_valid,
        "issues": issues,
        "extraction_method": str(extraction_method or "unknown"),
    }
    evidence = {
        "page_evidence_version": PAGE_EVIDENCE_VERSION,
        "extraction_quality": quality,
        "page_diagnostics": diagnostics,
    }
    evidence["evidence_sha256"] = sha256_json(evidence)
    return evidence


def extraction_evidence_from_metadata(metadata: Mapping[str, Any]) -> Dict[str, Any]:
    return {
        "page_evidence_version": metadata.get("page_evidence_version"),
        "extraction_quality": metadata.get("extraction_quality"),
        "page_diagnostics": metadata.get("page_diagnostics"),
    }


def validate_extraction_metadata(
    metadata: Mapping[str, Any],
    expected_page_count: int,
) -> Dict[str, Any]:
    """Validate stored extraction evidence without requiring screenplay text."""
    evidence = extraction_evidence_from_metadata(metadata)
    if evidence["page_evidence_version"] != PAGE_EVIDENCE_VERSION:
        raise SourceEvidenceError("The parser did not provide Q2 page evidence")
    quality = evidence["extraction_quality"]
    diagnostics = evidence["page_diagnostics"]
    if not isinstance(quality, dict) or not isinstance(diagnostics, list):
        raise SourceEvidenceError("Page evidence is incomplete")
    if len(diagnostics) != expected_page_count:
        raise SourceEvidenceError("Page diagnostics do not match the PDF page count")
    expected_pages = list(range(1, expected_page_count + 1))
    if [item.get("page") for item in diagnostics if isinstance(item, dict)] != expected_pages:
        raise SourceEvidenceError("Page diagnostics are missing or out of order")
    if quality.get("expected_page_count") != expected_page_count:
        raise SourceEvidenceError("Extraction summary page count is inconsistent")
    if quality.get("marker_count") != expected_page_count:
        raise SourceEvidenceError("Not every physical page has an evidence marker")
    stored_word_count = metadata.get("word_count")
    if stored_word_count is not None:
        diagnostic_word_count = sum(
            item.get("words", 0)
            for item in diagnostics
            if isinstance(item, dict)
        )
        if (
            type(stored_word_count) is not int
            or stored_word_count != diagnostic_word_count
        ):
            raise SourceEvidenceError(
                "Stored screenplay word count does not match page evidence"
            )
    if quality.get("publication_ready") is not True or quality.get("status") != "complete":
        issues = quality.get("issues")
        detail = ", ".join(str(issue) for issue in issues) if isinstance(issues, list) else ""
        raise SourceEvidenceError(
            f"Screenplay extraction needs review{': ' + detail if detail else ''}"
        )
    return evidence


def validate_parsed_source(parsed: Mapping[str, Any]) -> Dict[str, Any]:
    """Recompute page evidence from parser text before any paid model call."""
    text = parsed.get("text")
    page_count = parsed.get("page_count")
    metadata = parsed.get("metadata")
    if not isinstance(text, str) or not isinstance(metadata, dict):
        raise SourceEvidenceError("Parsed screenplay source is incomplete")
    validation_metadata = {
        **metadata,
        "word_count": parsed.get("word_count"),
    }
    stored = validate_stored_page_evidence(validation_metadata, page_count)
    recomputed = build_page_evidence(
        text,
        page_count,
        str(metadata.get("extraction_method") or "unknown"),
    )
    if stored != extraction_evidence_from_metadata(recomputed):
        raise SourceEvidenceError("Stored page evidence does not match extracted text")
    return stored


def validate_stored_page_evidence(
    metadata: Mapping[str, Any],
    expected_page_count: int,
) -> Dict[str, Any]:
    evidence = validate_extraction_metadata(metadata, expected_page_count)
    if metadata.get("page_evidence_sha256") != sha256_json(evidence):
        raise SourceEvidenceError("Page evidence integrity check failed")
    return evidence


def estimate_input_tokens(text: str) -> int:
    return max(1, math.ceil(len(text) / CONSERVATIVE_CHARACTERS_PER_TOKEN))


def build_context_policy(text: str, primary_model: str) -> Dict[str, Any]:
    """Choose models without ever slicing the screenplay."""
    return build_context_policy_for_length(len(text), primary_model)


def build_context_policy_for_length(
    character_count: int,
    primary_model: str,
) -> Dict[str, Any]:
    if type(character_count) is not int or character_count <= 0:
        raise SourceEvidenceError("Screenplay character count is missing or invalid")
    normalized = str(primary_model or "").lower()
    primary_models = ["sonnet", "opus"] if normalized == "hybrid" else [normalized]
    if not primary_models or any(model not in MODEL_SAFE_INPUT_TOKENS for model in primary_models):
        raise SourceEvidenceError(f"Unsupported screenplay model: {primary_model}")

    estimated_tokens = max(
        1,
        math.ceil(character_count / CONSERVATIVE_CHARACTERS_PER_TOKEN),
    )
    primary_budget = min(MODEL_SAFE_INPUT_TOKENS[model] for model in primary_models)
    if estimated_tokens > primary_budget:
        raise SourceEvidenceError(
            f"Screenplay requires about {estimated_tokens:,} input tokens, above the "
            f"{primary_budget:,}-token safe budget for {normalized}"
        )

    genre_model = (
        "haiku"
        if estimated_tokens <= MODEL_SAFE_INPUT_TOKENS["haiku"]
        else "sonnet"
    )
    if estimated_tokens > MODEL_SAFE_INPUT_TOKENS[genre_model]:
        raise SourceEvidenceError(
            "Screenplay exceeds the safe context budget for genre verification"
        )

    return {
        "context_policy_version": CONTEXT_POLICY_VERSION,
        "source_truncated": False,
        "input_characters": character_count,
        "estimated_input_tokens": estimated_tokens,
        "primary_model": normalized,
        "primary_model_safe_input_tokens": primary_budget,
        "genre_model": genre_model,
        "genre_model_safe_input_tokens": MODEL_SAFE_INPUT_TOKENS[genre_model],
        "model_context_tokens": {
            model: MODEL_CONTEXT_TOKENS[model]
            for model in sorted(set(primary_models + [genre_model]))
        },
    }


def validate_stored_context_policy(
    analysis: Mapping[str, Any],
    character_count: int,
    primary_model: str,
) -> Dict[str, Any]:
    stored = analysis.get("_context_policy")
    if not isinstance(stored, dict):
        raise SourceEvidenceError("Permanent analysis is missing its context policy")
    expected = build_context_policy_for_length(character_count, primary_model)
    if stored != expected:
        raise SourceEvidenceError(
            "Stored context policy does not match the analyzed screenplay"
        )
    if stored.get("source_truncated") is not False:
        raise SourceEvidenceError("A truncated screenplay cannot receive a final verdict")
    return stored


def _reader_metric_path(path: Sequence[str]) -> bool:
    return any(
        segment == "reader_reports"
        and index + 2 < len(path)
        and path[index + 2] == "sub_scores"
        and len(path) == index + 4
        for index, segment in enumerate(path)
    )


def validate_analysis_citations(
    analysis: Mapping[str, Any],
    page_diagnostics: Sequence[Mapping[str, Any]],
    page_count: int,
) -> Dict[str, Any]:
    """Verify every model citation and required high-score citation."""
    diagnostic_by_page = {
        item.get("page"): item
        for item in page_diagnostics
        if isinstance(item, Mapping) and type(item.get("page")) is int
    }
    invalid: List[Dict[str, Any]] = []
    unverifiable: List[Dict[str, Any]] = []
    malformed_metrics: List[str] = []
    missing_required: List[str] = []
    verified_pages: set[int] = set()
    total_citations = 0
    high_score_items = 0

    def walk(value: Any, path: List[str]) -> None:
        nonlocal total_citations, high_score_items
        if isinstance(value, Mapping):
            if path and path[-1] == "_citation_quality":
                return
            metric = _reader_metric_path(path)
            score = value.get("score")
            numeric_score = (
                isinstance(score, (int, float))
                and not isinstance(score, bool)
            )
            citations = value.get("page_citations")
            if metric:
                justification = value.get("justification")
                if (
                    not numeric_score
                    or not isinstance(justification, str)
                    or not justification.strip()
                ):
                    malformed_metrics.append(".".join(path))
                if numeric_score and float(score) >= 7:
                    high_score_items += 1
                    if not isinstance(citations, list) or len(citations) == 0:
                        missing_required.append(".".join(path))
            if "page_citations" in value:
                if not isinstance(citations, list):
                    invalid.append(
                        {
                            "path": ".".join(path),
                            "value": str(citations),
                            "reason": "not_an_array",
                        }
                    )
                else:
                    for citation in citations:
                        total_citations += 1
                        if (
                            type(citation) is not int
                            or citation < 1
                            or citation > page_count
                        ):
                            invalid.append(
                                {
                                    "path": ".".join(path),
                                    "value": citation,
                                    "reason": "outside_physical_page_range",
                                }
                            )
                            continue
                        diagnostic = diagnostic_by_page.get(citation)
                        if not diagnostic or diagnostic.get("status") in {"missing", "empty"}:
                            unverifiable.append(
                                {
                                    "path": ".".join(path),
                                    "page": citation,
                                    "reason": "page_has_no_extracted_evidence",
                                }
                            )
                            continue
                        verified_pages.add(citation)
            for key, nested in value.items():
                if key == "_citation_quality":
                    continue
                walk(nested, path + [str(key)])
        elif isinstance(value, list):
            for index, nested in enumerate(value):
                walk(nested, path + [str(index)])

    walk(analysis, [])
    issues: List[str] = []
    if invalid:
        issues.append("invalid_page_citations")
    if unverifiable:
        issues.append("unverifiable_page_citations")
    if malformed_metrics:
        issues.append("malformed_reader_metrics")
    if missing_required:
        issues.append("high_scores_missing_page_citations")

    evidence_core = {
        "citation_evidence_version": CITATION_EVIDENCE_VERSION,
        "status": "verified" if not issues else "needs_review",
        "page_count": page_count,
        "total_citations": total_citations,
        "valid_citations": max(
            0,
            total_citations - len(invalid) - len(unverifiable),
        ),
        "verified_page_numbers": sorted(verified_pages),
        "high_score_items": high_score_items,
        "malformed_reader_metrics": sorted(malformed_metrics),
        "missing_required_citations": sorted(missing_required),
        "invalid_citations": invalid,
        "unverifiable_citations": unverifiable,
        "issues": issues,
    }
    evidence_core["evidence_sha256"] = sha256_json(evidence_core)
    return evidence_core


def attach_verified_citation_quality(
    analysis: Dict[str, Any],
    metadata: Mapping[str, Any],
    page_count: int,
) -> Dict[str, Any]:
    evidence = validate_extraction_metadata(metadata, page_count)
    quality = validate_analysis_citations(
        analysis,
        evidence["page_diagnostics"],
        page_count,
    )
    analysis["_citation_quality"] = quality
    if quality["status"] != "verified":
        raise SourceEvidenceError(
            "Analysis citations need review: " + ", ".join(quality["issues"])
        )
    return quality


def validate_stored_citation_quality(
    analysis: Mapping[str, Any],
    metadata: Mapping[str, Any],
    page_count: int,
) -> Dict[str, Any]:
    stored = analysis.get("_citation_quality")
    if not isinstance(stored, dict):
        raise SourceEvidenceError("Permanent analysis is missing citation evidence")
    evidence = validate_extraction_metadata(metadata, page_count)
    recomputed = validate_analysis_citations(
        analysis,
        evidence["page_diagnostics"],
        page_count,
    )
    if stored != recomputed:
        raise SourceEvidenceError("Stored citation evidence does not match analysis")
    if stored.get("status") != "verified":
        raise SourceEvidenceError("Permanent analysis citations need review")
    return stored
