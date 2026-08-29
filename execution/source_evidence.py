"""Source-page, context-window, and citation evidence for permanent analyses.

Q2 treats the extracted screenplay as evidence, not an unstructured text blob.
Every physical PDF page receives a deterministic marker, extraction quality is
measured page by page, and model citations are checked against that page map
before a producer-facing verdict can be saved.
"""

from __future__ import annotations

import hashlib
import itertools
import json
import math
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence


PAGE_EVIDENCE_VERSION = "lemon-page-evidence-v1"
SCENE_COUNT_VERSION = "lemon-scene-heading-count-v1"
CONTEXT_POLICY_VERSION = "lemon-context-policy-v1"
LEGACY_CITATION_EVIDENCE_VERSION = "lemon-citation-evidence-v1"
CITATION_EVIDENCE_VERSION = "lemon-citation-evidence-v2"
CITATION_MATCH_POLICY_VERSION = "lemon-citation-match-revision-safe-v1"
TITLE_PAGE_AUTHOR_EVIDENCE_VERSION = "lemon-title-page-author-v1"
AUTHOR_NOT_FOUND = "Not found on title page"
NATIVE_TEXT_SIMILARITY_MIN = 0.80
NATIVE_EXTRACTION_METHODS = {"pdfplumber", "pymupdf", "PyPDF2"}

PAGE_MARKER_PATTERN = re.compile(r"(?m)^\[PAGE ([1-9][0-9]*)\][ \t]*$")
MIN_PAGE_WORDS = 3
SPARSE_CONTENT_STREAM_MIN_BYTES = 512
SPARSE_CONTENT_STREAM_TO_TEXT_RATIO = 8
MIN_PAGE_COVERAGE_RATIO = 0.80
MIN_EDGE_COVERAGE_RATIO = 0.70
EDGE_WINDOW_PAGES = 10
SCENE_HEADING_PATTERN = re.compile(
    r"^\s*(?:(?P<number>\d+[A-Z]?)\s*[.)-]?\s+)?"
    r"(?:INT(?:ERIOR)?\.?|EXT(?:ERIOR)?\.?|"
    r"INT\.?\s*/\s*EXT\.?|EXT\.?\s*/\s*INT\.?|I\s*/\s*E\.?|E\s*/\s*I\.?)"
    r"\s+\S",
    re.IGNORECASE,
)

_MODEL_CATALOG = json.loads(
    (Path(__file__).resolve().parents[1] / "src" / "config" / "anthropic-model-catalog.json")
    .read_text(encoding="utf-8")
)
MODEL_CONTEXT_TOKENS = {
    model_id: int(profile["contextTokens"])
    for model_id, profile in _MODEL_CATALOG["modelProfiles"].items()
}
MODEL_SAFE_INPUT_TOKENS = {
    model_id: 150_000 if context_tokens == 200_000 else 800_000
    for model_id, context_tokens in MODEL_CONTEXT_TOKENS.items()
}
_DEFAULT_MODEL_IDS = {
    "haiku": _MODEL_CATALOG["analysisRoutes"]["haiku"]["modelId"],
    "sonnet": _MODEL_CATALOG["candidateAnalysisRoutes"]["sonnet"]["modelId"],
    "opus": _MODEL_CATALOG["candidateAnalysisRoutes"]["opus"]["modelId"],
}
CONSERVATIVE_CHARACTERS_PER_TOKEN = 3
MIN_CITATION_EXCERPT_WORDS = 3
AUTHOR_CUE_PATTERN = re.compile(
    r"(?:^|\s)(written(?:\s+and\s+directed)?\s+by|screenplay\s+by|"
    r"script\s+by|gui[oó]n(?:\s+cinematogr[aá]fico)?\s+(?:de|por)|"
    r"escrit[oa]\s+por|autor(?:a)?(?:es)?\s*:)\s*",
    re.IGNORECASE,
)
AUTHOR_STOP_PATTERN = re.compile(
    r"\b(?:based\s+on|contact|e-?mail|phone|tel(?:ephone|éfono)?|draft|"
    r"revision|revised|copyright|all\s+rights\s+reserved)\b|©",
    re.IGNORECASE,
)


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


def build_scene_count_evidence(text: str) -> Dict[str, Any]:
    """Count explicit English/Spanish scene headings without model inference."""
    headings = []
    numbered = 0
    for line_number, line in enumerate(text.splitlines(), 1):
        if PAGE_MARKER_PATTERN.fullmatch(line.strip()):
            continue
        match = SCENE_HEADING_PATTERN.match(line)
        if match is None:
            continue
        headings.append({"line": line_number, "heading": line.strip()})
        if match.group("number"):
            numbered += 1
    evidence = {
        "scene_count_version": SCENE_COUNT_VERSION,
        "scene_heading_count": len(headings),
        "numbered_scene_heading_count": numbered,
        "method": "anchored_scene_heading_regex_en_es",
        "headings_sha256": sha256_json(headings),
    }
    evidence["evidence_sha256"] = sha256_json(evidence)
    return evidence


def validate_scene_count_evidence(value: Any) -> Dict[str, Any]:
    if not isinstance(value, Mapping):
        raise SourceEvidenceError("Scene count evidence is missing")
    evidence = dict(value)
    stored_hash = evidence.pop("evidence_sha256", None)
    if (
        evidence.get("scene_count_version") != SCENE_COUNT_VERSION
        or evidence.get("method") != "anchored_scene_heading_regex_en_es"
        or type(evidence.get("scene_heading_count")) is not int
        or evidence["scene_heading_count"] < 0
        or type(evidence.get("numbered_scene_heading_count")) is not int
        or evidence["numbered_scene_heading_count"] < 0
        or evidence["numbered_scene_heading_count"] > evidence["scene_heading_count"]
        or not re.fullmatch(r"[a-f0-9]{64}", str(evidence.get("headings_sha256", "")))
        or stored_hash != sha256_json(evidence)
    ):
        raise SourceEvidenceError("Scene count evidence is invalid")
    return dict(value)


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


def _clean_author_candidate(raw: str) -> Optional[str]:
    candidate = AUTHOR_STOP_PATTERN.split(raw, maxsplit=1)[0]
    candidate = re.sub(r"^[\s:,&\-–—]+|[\s:,&\-–—]+$", "", candidate)
    candidate = re.sub(r"\s+", " ", candidate).strip()
    words = candidate.split()
    if (
        not candidate
        or len(candidate) > 120
        or len(words) > 12
        or re.search(r"[^\W\d_]{2}", candidate, re.UNICODE) is None
        or re.search(r"@|https?:|www\.|\d{3}", candidate, re.IGNORECASE)
    ):
        return None
    return candidate


def extract_title_page_author(text: str) -> Dict[str, Any]:
    """Conservatively extract only an explicit page-one screenplay byline."""
    _markers, contents = _marked_page_contents(text)
    lines = [line.strip() for line in contents.get(1, "").splitlines() if line.strip()]
    for index, line in enumerate(lines):
        cue_match = AUTHOR_CUE_PATTERN.search(line)
        is_bare_byline = re.fullmatch(r"by\s*:?\s*", line, re.IGNORECASE) is not None
        if cue_match is None and not is_bare_byline:
            continue
        raw_candidate = line[cue_match.end():] if cue_match else ""
        author = _clean_author_candidate(raw_candidate)
        if author is None and index + 1 < len(lines):
            author = _clean_author_candidate(lines[index + 1])
        if author:
            return {
                "title_page_author_evidence_version": (
                    TITLE_PAGE_AUTHOR_EVIDENCE_VERSION
                ),
                "status": "found",
                "author": author,
                "page": 1,
                "cue": cue_match.group(1) if cue_match else "by",
            }
    return {
        "title_page_author_evidence_version": TITLE_PAGE_AUTHOR_EVIDENCE_VERSION,
        "status": "not_found",
        "author": AUTHOR_NOT_FOUND,
        "page": 1,
        "cue": None,
    }


def build_page_evidence(
    text: str,
    expected_page_count: int,
    extraction_method: str,
    page_content_signals: Optional[Sequence[Mapping[str, Any]]] = None,
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
    accounted_pages: List[int] = []
    unreadable_content_pages: List[int] = []
    unverified_empty_pages: List[int] = []
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
        signal = (
            page_content_signals[page_number - 1]
            if isinstance(page_content_signals, Sequence)
            and len(page_content_signals) == expected_page_count
            and isinstance(page_content_signals[page_number - 1], Mapping)
            else None
        )
        if word_count == 0:
            if signal is None:
                status = "empty"
                unverified_empty_pages.append(page_number)
            elif signal.get("content_bearing") is True:
                status = "unreadable_content"
                unreadable_content_pages.append(page_number)
            else:
                status = "verified_blank"
                accounted_pages.append(page_number)
        elif word_count < MIN_PAGE_WORDS:
            stream_bytes = (
                int(signal.get("content_stream_bytes", 0))
                if signal is not None
                else 0
            )
            extracted_bytes = len(content.encode("utf-8"))
            needs_corroboration = signal is not None and (
                int(signal.get("image_count", 0)) > 0
                or (
                    signal.get("content_bearing") is True
                    and stream_bytes >= SPARSE_CONTENT_STREAM_MIN_BYTES
                    and stream_bytes
                    >= max(1, extracted_bytes)
                    * SPARSE_CONTENT_STREAM_TO_TEXT_RATIO
                )
            )
            ocr_corroborated = (
                "ocr" in str(extraction_method).casefold()
                or (
                    signal is not None
                    and signal.get("ocr_corroborated") is True
                )
            )
            if needs_corroboration and not ocr_corroborated:
                status = "unreadable_content"
                unreadable_content_pages.append(page_number)
            else:
                status = "sparse"
                accounted_pages.append(page_number)
        else:
            status = "readable"
            readable_pages.append(page_number)
            accounted_pages.append(page_number)
        diagnostics.append(
            {
                "page": page_number,
                "status": status,
                "characters": len(content),
                "words": word_count,
                "content_signal": (
                    {
                        key: value
                        for key, value in signal.items()
                        if key != "ocr_corroborated"
                    }
                    if signal is not None
                    else None
                ),
            }
        )

    coverage_ratio = len(accounted_pages) / expected_page_count
    edge_size = min(EDGE_WINDOW_PAGES, expected_page_count)
    first_pages = set(range(1, edge_size + 1))
    final_pages = set(range(expected_page_count - edge_size + 1, expected_page_count + 1))
    accounted_set = set(accounted_pages)
    first_coverage = len(first_pages & accounted_set) / edge_size
    final_coverage = len(final_pages & accounted_set) / edge_size

    issues: List[str] = []
    if missing_pages:
        issues.append("missing_page_markers")
    if unexpected_pages:
        issues.append("unexpected_page_markers")
    if duplicate_pages:
        issues.append("duplicate_page_markers")
    if not marker_order_valid:
        issues.append("page_marker_sequence_mismatch")
    if unreadable_content_pages:
        issues.append("unreadable_content_pages")
    if unverified_empty_pages:
        issues.append("unverified_empty_pages")
    if coverage_ratio < MIN_PAGE_COVERAGE_RATIO:
        issues.append("insufficient_overall_page_text")
    if first_coverage < MIN_EDGE_COVERAGE_RATIO:
        issues.append("insufficient_opening_page_text")
    if final_coverage < 1.0:
        issues.append("insufficient_ending_page_text")

    quality = {
        "status": "complete" if not issues else "incomplete",
        "publication_ready": not issues,
        "expected_page_count": expected_page_count,
        "marker_count": len(marker_numbers),
        "readable_page_count": len(readable_pages),
        "accounted_page_count": len(accounted_pages),
        "empty_page_count": sum(
            1 for page in diagnostics if page["status"] == "empty"
        ),
        "sparse_page_count": sum(
            1 for page in diagnostics if page["status"] == "sparse"
        ),
        "verified_blank_page_count": sum(
            1 for page in diagnostics if page["status"] == "verified_blank"
        ),
        "unreadable_content_pages": unreadable_content_pages,
        "unverified_empty_pages": unverified_empty_pages,
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


def validate_native_cross_check(
    raw: Any,
    selected_extraction_method: str,
) -> Dict[str, Any]:
    """Return the schema-closed extractor agreement proof or fail closed."""
    required_fields = {
        "status",
        "methods_compared",
        "word_counts",
        "word_count_agreement_ratio",
        "page_token_similarity_ratio",
        "pairwise_page_token_similarity",
        "minimum_similarity_required",
        "selected_consensus_method",
    }
    if not isinstance(raw, dict) or set(raw) != required_fields:
        raise SourceEvidenceError("Native extractor cross-check schema is invalid")
    status = raw["status"]
    if status not in {
        "corroborated", "divergent", "single_native_method", "ocr_only",
    }:
        raise SourceEvidenceError("Native extractor cross-check status is invalid")
    methods = raw["methods_compared"]
    if (
        not isinstance(methods, list)
        or len(methods) != len(set(methods))
        or any(method not in NATIVE_EXTRACTION_METHODS for method in methods)
    ):
        raise SourceEvidenceError("Native extractor method inventory is invalid")
    word_counts = raw["word_counts"]
    if (
        not isinstance(word_counts, dict)
        or set(word_counts) != set(methods)
        or any(type(count) is not int or count <= 0 for count in word_counts.values())
    ):
        raise SourceEvidenceError("Native extractor word counts are invalid")

    def ratio(value: Any, label: str, *, allow_none: bool = False) -> float | None:
        if allow_none and value is None:
            return None
        if (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(float(value))
            or not 0 <= float(value) <= 1
        ):
            raise SourceEvidenceError(f"Native extractor {label} is invalid")
        return float(value)

    minimum = ratio(raw["minimum_similarity_required"], "minimum similarity")
    if minimum != NATIVE_TEXT_SIMILARITY_MIN:
        raise SourceEvidenceError("Native extractor similarity threshold is invalid")
    word_agreement = ratio(
        raw["word_count_agreement_ratio"],
        "word-count agreement ratio",
        allow_none=True,
    )
    page_similarity = ratio(
        raw["page_token_similarity_ratio"],
        "page-token similarity ratio",
        allow_none=True,
    )
    pairwise = raw["pairwise_page_token_similarity"]
    if not isinstance(pairwise, list):
        raise SourceEvidenceError("Native extractor pairwise evidence is invalid")
    canonical_pairs: List[Dict[str, Any]] = []
    seen_pairs = set()
    for item in pairwise:
        if not isinstance(item, dict) or set(item) != {
            "methods", "page_token_similarity_ratio",
        }:
            raise SourceEvidenceError("Native extractor pairwise evidence is invalid")
        pair_methods = item["methods"]
        if (
            not isinstance(pair_methods, list)
            or len(pair_methods) != 2
            or pair_methods[0] == pair_methods[1]
            or any(method not in methods for method in pair_methods)
        ):
            raise SourceEvidenceError("Native extractor pairwise methods are invalid")
        pair_key = frozenset(pair_methods)
        if pair_key in seen_pairs:
            raise SourceEvidenceError("Native extractor pairwise evidence is duplicated")
        seen_pairs.add(pair_key)
        canonical_pairs.append({
            "methods": list(pair_methods),
            "page_token_similarity_ratio": ratio(
                item["page_token_similarity_ratio"],
                "pairwise page-token similarity ratio",
            ),
        })
    expected_pairs = {
        frozenset(pair)
        for pair in itertools.combinations(methods, 2)
    }
    if seen_pairs != expected_pairs:
        raise SourceEvidenceError("Native extractor pairwise inventory is incomplete")

    selected_method = raw["selected_consensus_method"]
    if (
        not isinstance(selected_method, str)
        or not selected_method
        or selected_method != selected_extraction_method
    ):
        raise SourceEvidenceError("Native extractor selected method is invalid")
    if len(methods) >= 2:
        expected_word_agreement = round(
            min(word_counts.values()) / max(word_counts.values()),
            4,
        )
        expected_similarity = min(
            item["page_token_similarity_ratio"] for item in canonical_pairs
        )
        expected_status = (
            "corroborated"
            if expected_similarity >= NATIVE_TEXT_SIMILARITY_MIN
            else "divergent"
        )
        if (
            word_agreement != expected_word_agreement
            or page_similarity != expected_similarity
            or status != expected_status
            or selected_method not in methods
        ):
            raise SourceEvidenceError("Native extractor agreement semantics are invalid")
    elif len(methods) == 1:
        if (
            status != "single_native_method"
            or word_agreement != 1.0
            or page_similarity != 1.0
            or canonical_pairs
            or selected_method != methods[0]
        ):
            raise SourceEvidenceError("Single native extractor evidence is invalid")
    elif (
        status != "ocr_only"
        or word_agreement is not None
        or page_similarity is not None
        or canonical_pairs
        or not (
            selected_method == "OCR"
            or re.fullmatch(
                r"(?:pdfplumber|pymupdf|PyPDF2)\+OCR_sparse_pages",
                selected_method,
            )
        )
    ):
        raise SourceEvidenceError("OCR-only extractor evidence is invalid")

    return {
        "status": status,
        "methods_compared": list(methods),
        "word_counts": {method: word_counts[method] for method in methods},
        "word_count_agreement_ratio": word_agreement,
        "page_token_similarity_ratio": page_similarity,
        "pairwise_page_token_similarity": canonical_pairs,
        "minimum_similarity_required": minimum,
        "selected_consensus_method": selected_method,
    }


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
    validate_native_cross_check(
        metadata.get("native_cross_check"),
        str(metadata.get("extraction_method") or ""),
    )
    stored = validate_stored_page_evidence(validation_metadata, page_count)
    recomputed = build_page_evidence(
        text,
        page_count,
        str(metadata.get("extraction_method") or "unknown"),
        metadata.get("page_content_signals"),
    )
    if stored != extraction_evidence_from_metadata(recomputed):
        raise SourceEvidenceError("Stored page evidence does not match extracted text")
    stored_scene_count = validate_scene_count_evidence(
        metadata.get("scene_count_evidence")
    )
    recomputed_scene_count = build_scene_count_evidence(text)
    if stored_scene_count != recomputed_scene_count:
        raise SourceEvidenceError("Stored scene count does not match extracted text")
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


def build_context_policy(
    text: str,
    primary_model: str,
    *,
    model_ids: Optional[Mapping[str, str]] = None,
) -> Dict[str, Any]:
    """Choose models without ever slicing the screenplay."""
    return build_context_policy_for_length(
        len(text),
        primary_model,
        model_ids=model_ids,
    )


def build_context_policy_for_length(
    character_count: int,
    primary_model: str,
    *,
    model_ids: Optional[Mapping[str, str]] = None,
) -> Dict[str, Any]:
    if type(character_count) is not int or character_count <= 0:
        raise SourceEvidenceError("Screenplay character count is missing or invalid")
    normalized = str(primary_model or "").lower()
    resolved_ids = dict(_DEFAULT_MODEL_IDS if model_ids is None else model_ids)
    primary_tiers = ["sonnet", "opus"] if normalized == "hybrid" else [normalized]
    primary_models = [resolved_ids.get(tier, "") for tier in primary_tiers]
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
        if estimated_tokens <= MODEL_SAFE_INPUT_TOKENS[resolved_ids["haiku"]]
        else "sonnet"
    )
    genre_model_id = resolved_ids[genre_model]
    if estimated_tokens > MODEL_SAFE_INPUT_TOKENS[genre_model_id]:
        raise SourceEvidenceError(
            "Screenplay exceeds the safe context budget for genre verification"
        )

    return {
        "context_policy_version": CONTEXT_POLICY_VERSION,
        "source_truncated": False,
        "input_characters": character_count,
        "estimated_input_tokens": estimated_tokens,
        "primary_model": normalized,
        "primary_model_ids": primary_models,
        "primary_model_safe_input_tokens": primary_budget,
        "genre_model": genre_model,
        "genre_model_id": genre_model_id,
        "genre_model_safe_input_tokens": MODEL_SAFE_INPUT_TOKENS[genre_model_id],
        "model_context_tokens": {
            model: MODEL_CONTEXT_TOKENS[model]
            for model in sorted(set(primary_models + [genre_model_id]))
        },
    }


def validate_stored_context_policy(
    analysis: Mapping[str, Any],
    character_count: int,
    primary_model: str,
    *,
    model_ids: Optional[Mapping[str, str]] = None,
) -> Dict[str, Any]:
    stored = analysis.get("_context_policy")
    if not isinstance(stored, dict):
        raise SourceEvidenceError("Permanent analysis is missing its context policy")
    expected = build_context_policy_for_length(
        character_count,
        primary_model,
        model_ids=model_ids,
    )
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


def _normalized_evidence_text(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


_TYPOGRAPHIC_QUOTE_TRANSLATION = str.maketrans({
    "\u2018": "'",
    "\u2019": "'",
    "\u201b": "'",
    "\u201c": '"',
    "\u201d": '"',
    "\u201e": '"',
})
_REVISION_MARGIN_MIN_COLUMN = 50


def _has_trailing_revision_margin_mark(line: str) -> bool:
    marker = re.search(r"[ \t]+\*[ \t]*$", line)
    return marker is not None and line.rfind("*") >= _REVISION_MARGIN_MIN_COLUMN


def _revision_safe_evidence_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).translate(
        _TYPOGRAPHIC_QUOTE_TRANSLATION
    )
    lines = normalized.splitlines()
    has_revision_layout = (
        sum(line.strip() == "*" for line in lines) >= 2
        and any(_has_trailing_revision_margin_mark(line) for line in lines)
    )
    if has_revision_layout:
        lines = [
            ""
            if line.strip() == "*"
            else re.sub(r"[ \t]+\*[ \t]*$", "", line)
            if _has_trailing_revision_margin_mark(line)
            else line
            for line in lines
        ]
    return " ".join("\n".join(lines).casefold().split())


def _evidence_words(value: str) -> List[str]:
    return re.findall(r"\w+", _normalized_evidence_text(value), flags=re.UNICODE)


def _contains_normalized_excerpt(
    normalized_page: str,
    normalized_excerpt: str,
) -> bool:
    start = 0
    while (index := normalized_page.find(normalized_excerpt, start)) >= 0:
        end = index + len(normalized_excerpt)
        before = normalized_page[index - 1] if index else ""
        after = normalized_page[end] if end < len(normalized_page) else ""
        if (
            (not before or not (before.isalnum() or before == "_"))
            and (not after or not (after.isalnum() or after == "_"))
        ):
            return True
        start = index + 1
    return False


def _evidence_excerpt_match_kind(
    page_text: str,
    excerpt: str,
) -> Optional[str]:
    if len(_evidence_words(excerpt)) < MIN_CITATION_EXCERPT_WORDS:
        return None
    if _contains_normalized_excerpt(
        _normalized_evidence_text(page_text),
        _normalized_evidence_text(excerpt),
    ):
        return "exact"
    if _contains_normalized_excerpt(
        _revision_safe_evidence_text(page_text),
        _revision_safe_evidence_text(excerpt),
    ):
        return "revision_safe"
    return None


def _contains_evidence_excerpt(page_text: str, excerpt: str) -> bool:
    return _evidence_excerpt_match_kind(page_text, excerpt) is not None


def reconcile_unique_citation_pages(
    analysis: Dict[str, Any],
    source_text: str,
) -> Dict[str, Any]:
    """Move an exact excerpt to its one unambiguous physical page."""
    before_sha256 = sha256_json(analysis)
    page_contents = _marked_page_contents(source_text)[1]
    changes: List[Dict[str, Any]] = []

    def walk(value: Any, path: List[str]) -> None:
        if isinstance(value, dict):
            citations = value.get("page_citations")
            evidence = value.get("citation_evidence")
            if (
                isinstance(citations, list)
                and isinstance(evidence, list)
                and len(citations) == len(evidence)
                and all(type(page) is int for page in citations)
                and all(
                    isinstance(item, dict)
                    and type(item.get("page")) is int
                    and isinstance(item.get("excerpt"), str)
                    for item in evidence
                )
            ):
                original_pages = [item["page"] for item in evidence]
                if (
                    len(set(original_pages)) == len(original_pages)
                    and sorted(citations) == sorted(original_pages)
                ):
                    replacements: Dict[int, int] = {}
                    for index, item in enumerate(evidence):
                        excerpt = item["excerpt"]
                        matching_pages = [
                            page
                            for page, page_text in page_contents.items()
                            if _contains_evidence_excerpt(page_text, excerpt)
                        ]
                        original_page = item["page"]
                        if original_page in matching_pages or len(matching_pages) != 1:
                            continue
                        resolved_page = matching_pages[0]
                        replacements[original_page] = resolved_page
                        item["page"] = resolved_page
                        changes.append({
                            "path": ".".join(path + ["citation_evidence", str(index)]),
                            "original_page": original_page,
                            "resolved_page": resolved_page,
                            "excerpt_sha256": hashlib.sha256(
                                _normalized_evidence_text(excerpt).encode("utf-8")
                            ).hexdigest(),
                        })
                    if replacements:
                        value["page_citations"] = [
                            replacements.get(page, page) for page in citations
                        ]
            for key, nested in value.items():
                if key != "_citation_quality":
                    walk(nested, path + [str(key)])
        elif isinstance(value, list):
            for index, nested in enumerate(value):
                walk(nested, path + [str(index)])

    walk(analysis, [])
    after_sha256 = sha256_json(analysis)
    return {
        "status": (
            "reconciled_unique_exact_matches" if changes else "unchanged"
        ),
        "changed_citation_count": len(changes),
        "changes": changes,
        "before_sha256": before_sha256,
        "after_sha256": after_sha256,
    }


def _citation_seal(path: str, page: int, excerpt: str) -> Dict[str, Any]:
    normalized = _normalized_evidence_text(excerpt)
    return {
        "path": path,
        "page": page,
        "excerpt_sha256": hashlib.sha256(normalized.encode("utf-8")).hexdigest(),
    }


def _declared_citation_seals(
    analysis: Mapping[str, Any],
) -> List[Dict[str, Any]]:
    seals: List[Dict[str, Any]] = []

    def walk(value: Any, path: List[str]) -> None:
        if isinstance(value, Mapping):
            if path and path[-1] == "_citation_quality":
                return
            if "page_citations" in value:
                path_text = ".".join(path)
                citations = value.get("page_citations")
                evidence = value.get("citation_evidence")
                if not isinstance(citations, list) or not isinstance(evidence, list):
                    raise SourceEvidenceError(
                        f"Stored citation declaration is incomplete at {path_text}"
                    )
                evidence_pages: List[int] = []
                for item in evidence:
                    if not isinstance(item, Mapping):
                        raise SourceEvidenceError(
                            f"Stored citation evidence is malformed at {path_text}"
                        )
                    page = item.get("page")
                    excerpt = item.get("excerpt")
                    if (
                        type(page) is not int
                        or not isinstance(excerpt, str)
                        or len(_evidence_words(excerpt))
                        < MIN_CITATION_EXCERPT_WORDS
                    ):
                        raise SourceEvidenceError(
                            f"Stored citation excerpt is malformed at {path_text}"
                        )
                    evidence_pages.append(page)
                    seals.append(_citation_seal(path_text, page, excerpt))
                if sorted(citations) != sorted(evidence_pages):
                    raise SourceEvidenceError(
                        f"Stored citation pages do not match excerpts at {path_text}"
                    )
            for key, nested in value.items():
                if key != "_citation_quality":
                    walk(nested, path + [str(key)])
        elif isinstance(value, list):
            for index, nested in enumerate(value):
                walk(nested, path + [str(index)])

    walk(analysis, [])
    return sorted(
        seals,
        key=lambda item: (item["path"], item["page"], item["excerpt_sha256"]),
    )


def validate_analysis_citations(
    analysis: Mapping[str, Any],
    page_diagnostics: Sequence[Mapping[str, Any]],
    page_count: int,
    source_text: Optional[str] = None,
) -> Dict[str, Any]:
    """Verify every model citation and required high-score citation.

    New analyses must supply the marked screenplay text so every cited page is
    backed by a short verbatim excerpt. The no-text mode exists only to verify
    immutable v1 records created before excerpt evidence was required.
    """
    diagnostic_by_page = {
        item.get("page"): item
        for item in page_diagnostics
        if isinstance(item, Mapping) and type(item.get("page")) is int
    }
    invalid: List[Dict[str, Any]] = []
    unverifiable: List[Dict[str, Any]] = []
    malformed_metrics: List[str] = []
    missing_required: List[str] = []
    unsupported: List[Dict[str, Any]] = []
    verified_evidence: List[Dict[str, Any]] = []
    normalized_matches: List[Dict[str, Any]] = []
    verified_pages: set[int] = set()
    total_citations = 0
    high_score_items = 0
    page_contents = (
        _marked_page_contents(source_text)[1]
        if isinstance(source_text, str)
        else None
    )

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
                    valid_page_citations: List[int] = []
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
                        if citation in valid_page_citations:
                            invalid.append({
                                "path": ".".join(path),
                                "value": citation,
                                "reason": "duplicate_page_citation",
                            })
                            continue
                        valid_page_citations.append(citation)
                        if page_contents is None:
                            verified_pages.add(citation)

                    if page_contents is not None:
                        path_text = ".".join(path)
                        declared = value.get("citation_evidence")
                        evidence_by_page: Dict[int, str] = {}
                        if not isinstance(declared, list):
                            unsupported.append({
                                "path": path_text,
                                "reason": "citation_evidence_not_an_array",
                            })
                            declared = []
                        for item in declared:
                            if not isinstance(item, Mapping):
                                unsupported.append({
                                    "path": path_text,
                                    "reason": "citation_evidence_not_an_object",
                                })
                                continue
                            evidence_page = item.get("page")
                            excerpt = item.get("excerpt")
                            if type(evidence_page) is not int or not isinstance(excerpt, str):
                                unsupported.append({
                                    "path": path_text,
                                    "page": evidence_page,
                                    "reason": "invalid_citation_evidence",
                                })
                                continue
                            if len(_evidence_words(excerpt)) < MIN_CITATION_EXCERPT_WORDS:
                                unsupported.append({
                                    "path": path_text,
                                    "page": evidence_page,
                                    "reason": "evidence_excerpt_too_short",
                                })
                                continue
                            if evidence_page in evidence_by_page:
                                unsupported.append({
                                    "path": path_text,
                                    "page": evidence_page,
                                    "reason": "duplicate_citation_evidence",
                                })
                                continue
                            evidence_by_page[evidence_page] = excerpt

                        for citation in valid_page_citations:
                            excerpt = evidence_by_page.get(citation)
                            if excerpt is None:
                                unsupported.append({
                                    "path": path_text,
                                    "page": citation,
                                    "reason": "missing_evidence_excerpt",
                                })
                                continue
                            match_kind = _evidence_excerpt_match_kind(
                                page_contents.get(citation, ""), excerpt
                            )
                            if match_kind is None:
                                unsupported.append({
                                    "path": path_text,
                                    "page": citation,
                                    "reason": "excerpt_not_found_on_cited_page",
                                })
                                continue
                            verified_pages.add(citation)
                            verified_evidence.append(
                                _citation_seal(path_text, citation, excerpt)
                            )
                            if match_kind == "revision_safe":
                                normalized_matches.append({
                                    **_citation_seal(
                                        path_text,
                                        citation,
                                        excerpt,
                                    ),
                                    "policy": CITATION_MATCH_POLICY_VERSION,
                                })
                        for evidence_page in sorted(evidence_by_page):
                            if evidence_page not in valid_page_citations:
                                unsupported.append({
                                    "path": path_text,
                                    "page": evidence_page,
                                    "reason": "evidence_page_not_cited",
                                })
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
    if unsupported:
        issues.append("unsupported_page_citations")

    evidence_core = {
        "citation_evidence_version": (
            CITATION_EVIDENCE_VERSION
            if page_contents is not None
            else LEGACY_CITATION_EVIDENCE_VERSION
        ),
        "status": "verified" if not issues else "needs_review",
        "verification_scope": (
            "physical_page_and_revision_safe_excerpt_location"
            if normalized_matches
            else "physical_page_and_exact_excerpt_location"
        ),
        "semantic_support_scope": (
            "independent_claim_verification_required_for_benchmark"
        ),
        "page_count": page_count,
        "total_citations": total_citations,
        "valid_citations": (
            len(verified_evidence)
            if page_contents is not None
            else max(0, total_citations - len(invalid) - len(unverifiable))
        ),
        "verified_page_numbers": sorted(verified_pages),
        "high_score_items": high_score_items,
        "citation_match_policy_version": CITATION_MATCH_POLICY_VERSION,
        "normalized_match_count": len(normalized_matches),
        "normalized_matches": sorted(
            normalized_matches,
            key=lambda item: (
                item["path"],
                item["page"],
                item["excerpt_sha256"],
            ),
        ),
        "malformed_reader_metrics": sorted(malformed_metrics),
        "missing_required_citations": sorted(missing_required),
        "invalid_citations": invalid,
        "unverifiable_citations": unverifiable,
        "issues": issues,
    }
    if page_contents is not None:
        evidence_core.update({
            "source_text_sha256": hashlib.sha256(
                source_text.encode("utf-8")
            ).hexdigest(),
            "verified_evidence": sorted(
                verified_evidence,
                key=lambda item: (
                    item["path"],
                    item["page"],
                    item["excerpt_sha256"],
                ),
            ),
            "unsupported_citations": unsupported,
        })
    evidence_core["evidence_sha256"] = sha256_json(evidence_core)
    return evidence_core


def attach_verified_citation_quality(
    analysis: Dict[str, Any],
    metadata: Mapping[str, Any],
    page_count: int,
    source_text: str,
) -> Dict[str, Any]:
    evidence = validate_extraction_metadata(metadata, page_count)
    recomputed = build_page_evidence(
        source_text,
        page_count,
        str(
            metadata.get("extraction_method")
            or evidence["extraction_quality"].get("extraction_method")
            or "unknown"
        ),
        metadata.get("page_content_signals"),
    )
    if extraction_evidence_from_metadata(recomputed) != evidence:
        raise SourceEvidenceError(
            "Citation source text does not match stored page evidence"
        )
    quality = validate_analysis_citations(
        analysis,
        evidence["page_diagnostics"],
        page_count,
        source_text,
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
    if stored.get("citation_evidence_version") == CITATION_EVIDENCE_VERSION:
        evidence_hash = stored.get("evidence_sha256")
        core = {
            key: value
            for key, value in stored.items()
            if key != "evidence_sha256"
        }
        if evidence_hash != sha256_json(core):
            raise SourceEvidenceError("Stored citation evidence integrity check failed")
        if stored.get("status") != "verified" or stored.get("issues") != []:
            raise SourceEvidenceError("Permanent analysis citations need review")
        if stored.get("unsupported_citations") != []:
            raise SourceEvidenceError("Permanent analysis has unsupported citations")
        if stored.get("valid_citations") != stored.get("total_citations"):
            raise SourceEvidenceError("Permanent analysis has unsupported citations")
        structural = validate_analysis_citations(
            analysis,
            evidence["page_diagnostics"],
            page_count,
        )
        if structural.get("status") != "verified":
            raise SourceEvidenceError(
                "Permanent analysis citation evidence needs review"
            )
        for field in (
            "page_count",
            "total_citations",
            "verified_page_numbers",
            "high_score_items",
            "malformed_reader_metrics",
            "missing_required_citations",
            "invalid_citations",
            "unverifiable_citations",
        ):
            if stored.get(field) != structural.get(field):
                raise SourceEvidenceError(
                    "Stored citation evidence does not match analysis"
                )
        if stored.get("verified_evidence") != _declared_citation_seals(analysis):
            raise SourceEvidenceError(
                "Stored citation excerpts do not match analysis"
            )
        if len(stored["verified_evidence"]) != stored.get("total_citations"):
            raise SourceEvidenceError("Permanent analysis has unsupported citations")
        source_hash = stored.get("source_text_sha256")
        if not isinstance(source_hash, str) or not re.fullmatch(r"[a-f0-9]{64}", source_hash):
            raise SourceEvidenceError("Permanent analysis lacks source-text provenance")
        return stored
    if stored.get("citation_evidence_version") != LEGACY_CITATION_EVIDENCE_VERSION:
        raise SourceEvidenceError("Permanent analysis has unknown citation evidence")
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
