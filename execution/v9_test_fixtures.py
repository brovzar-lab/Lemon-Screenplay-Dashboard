"""Shared valid V9 fixtures for permanent-write tests."""

import copy

from execution.trust_manifest import attach_trust_manifest
from execution.source_evidence import (
    attach_verified_citation_quality,
    build_context_policy_for_length,
    build_page_evidence,
    join_marked_pages,
)


CONTENT_HASH = "ab" * 32
QUEUED_AT_MS = 1_784_588_800_123
PROJECT_ID = "Trustworthy_Draft.pdf"
VERSION_ID = f"{CONTENT_HASH}_{QUEUED_AT_MS}"
MODEL_ID = "claude-sonnet-4-6"
HAIKU_MODEL_ID = "claude-haiku-4-5-20251001"
OPUS_MODEL_ID = "claude-opus-4-7"
MODEL_IDS = {
    "haiku": HAIKU_MODEL_ID,
    "sonnet": MODEL_ID,
    "opus": OPUS_MODEL_ID,
}
PAGE_COUNT = 101
WORD_COUNT = 22_000
CHARACTER_COUNT = 123_456
READER_NAMES = (
    "structure",
    "character",
    "craft_scene",
    "concept",
    "emotional_resonance",
)
RUN_EVIDENCE_KEYS = (
    "analysis_version",
    "weighted_score",
    "weighted_score_adjusted",
    "critical_failure_penalty_applied",
    "verdict_model",
    "verdict_before_adjustments",
    "verdict_before_gates",
    "verdict_adjustments",
    "verdict",
    "critical_failures",
    "story_vs_situation",
    "false_positive_check",
    "_truncation",
    "reader_reports",
    "pillar_scores",
    "analysis_quality",
    "failed_reader_errors",
)


def refresh_boundary_evidence(analysis):
    analysis["_boundary_reruns"]["runs"][0]["analysis_evidence"] = {
        key: copy.deepcopy(analysis[key])
        for key in RUN_EVIDENCE_KEYS
    }


def _q2_page_texts(page_count, word_count):
    if word_count < page_count * 3:
        raise ValueError("Q2 fixture needs at least three words per page")
    base_words, remainder = divmod(word_count, page_count)
    page_texts = [
        ["word"] * (base_words + (1 if index < remainder else 0))
        for index in range(page_count)
    ]
    page_texts[0][:4] = ["INT.", "HOUSE", "-", "DAY"]
    return [" ".join(words) for words in page_texts]


def q2_parser_metadata(
    *,
    page_count=PAGE_COUNT,
    word_count=WORD_COUNT,
    character_count=CHARACTER_COUNT,
    extraction_method="pdfplumber",
):
    page_texts = _q2_page_texts(page_count, word_count)
    page_evidence = build_page_evidence(
        join_marked_pages(page_texts),
        page_count,
        extraction_method,
    )
    return {
        "page_count": page_count,
        "word_count": word_count,
        "character_count": character_count,
        "extraction_method": extraction_method,
        "parser_version": "v4-page-evidence",
        "parser_extractor_version": "v4-page-evidence",
        "page_evidence_version": page_evidence["page_evidence_version"],
        "extraction_quality": page_evidence["extraction_quality"],
        "page_diagnostics": page_evidence["page_diagnostics"],
        "page_evidence_sha256": page_evidence["evidence_sha256"],
        "native_cross_check": {
            "status": "corroborated",
            "methods_compared": ["pdfplumber", "pymupdf"],
            "word_counts": {
                "pdfplumber": word_count,
                "pymupdf": word_count,
            },
            "word_count_agreement_ratio": 1.0,
        },
    }


def q2_parsed_source(
    *,
    page_count=PAGE_COUNT,
    word_count=WORD_COUNT,
    extraction_method="pdfplumber",
):
    page_texts = _q2_page_texts(page_count, word_count)
    text = join_marked_pages(page_texts)
    return {
        "text": text,
        "page_count": page_count,
        "word_count": word_count,
        "metadata": q2_parser_metadata(
            page_count=page_count,
            word_count=word_count,
            character_count=len(text),
            extraction_method=extraction_method,
        ),
    }


def prepare_q2_analysis(analysis, metadata, model_tier="sonnet"):
    analysis["_context_policy"] = build_context_policy_for_length(
        metadata["character_count"],
        model_tier,
    )
    attach_verified_citation_quality(
        analysis,
        metadata,
        metadata["page_count"],
    )
    return analysis


def complete_analysis(title="Trustworthy Draft"):
    reader_reports = {
        name: {
            "reader": name,
            "pillar_score": 7.2,
            "sub_scores": {
                "one": {
                    "score": 7,
                    "justification": "Evidence on page one.",
                    "page_citations": [1],
                },
                "two": {
                    "score": 7,
                    "justification": "Evidence on page one.",
                    "page_citations": [1],
                },
                "three": {
                    "score": 7,
                    "justification": "Evidence on page one.",
                    "page_citations": [1],
                },
                "four": {
                    "score": 7,
                    "justification": "Evidence on page one.",
                    "page_citations": [1],
                },
                "five": {
                    "score": 8,
                    "justification": "Evidence on page one.",
                    "page_citations": [1],
                },
            },
        }
        for name in READER_NAMES
    }
    analysis = {
        "title": title,
        "analysis_version": "v9_archaeology",
        "weighted_score": 7.2,
        "weighted_score_adjusted": 6.9,
        "critical_failure_penalty_applied": 0.3,
        "verdict_model": "RECOMMEND",
        "verdict_before_adjustments": "RECOMMEND",
        "verdict_before_gates": "CONSIDER",
        "verdict_adjustments": [
            "critical_failure_penalty: -0.3 (7.2 → 6.9)",
        ],
        "verdict": "CONSIDER",
        "critical_failures": [{"severity": "minor", "issue": "repairable"}],
        "story_vs_situation": {
            "score": 4,
            "verdict": "story",
            "gate_applied": False,
        },
        "false_positive_check": {
            "weighted_trap_score": 0.0,
            "traps_evaluated": [],
            "verdict_adjustment": "none",
        },
        "_truncation": {
            "truncated": False,
            "chars_lost": 0,
            "approx_pages_lost": 0,
        },
        "_context_policy": build_context_policy_for_length(
            CHARACTER_COUNT,
            "sonnet",
        ),
        "reader_reports": reader_reports,
        "pillar_scores": {
            name: {"score": 7.2}
            for name in READER_NAMES
        },
        "analysis_quality": {
            "status": "complete",
            "completed_readers": 5,
            "expected_readers": 5,
            "failed_readers": [],
        },
        "failed_reader_errors": {},
        "_boundary_reruns": {
            "triggered": False,
            "reason": "outside_boundary_window",
            "boundary_window": 0.5,
            "attempted_runs": 1,
            "completed_runs": 1,
            "failed_runs": [],
            "runs": [
                {
                    "run_number": 1,
                    "adjusted_score": 6.9,
                    "verdict": "CONSIDER",
                    "verdict_model": "RECOMMEND",
                    "response_ids": [
                        f"msg_{index}" for index in range(1, 8)
                    ],
                },
            ],
            "selected_run_number": 1,
            "median_adjusted_score": 6.9,
            "score_spread": 0.0,
            "final_verdict": "CONSIDER",
        },
    }
    refresh_boundary_evidence(analysis)
    return analysis


def complete_usage(model_id=MODEL_ID):
    return {
        "input_tokens": 1_000,
        "output_tokens": 500,
        "cache_creation_input_tokens": 100,
        "cache_read_input_tokens": 200,
        "call_count": 7,
        "actual_cost_microusd": 12_345,
        "actual_cost_usd": 0.012345,
        "finish_reason": "end_turn",
        "by_model": {
            model_id: {
                "input_tokens": 1_000,
                "output_tokens": 500,
                "cache_creation_input_tokens": 100,
                "cache_read_input_tokens": 200,
                "call_count": 6,
                "actual_cost_microusd": 12_345,
            },
            HAIKU_MODEL_ID: {
                "input_tokens": 0,
                "output_tokens": 0,
                "cache_creation_input_tokens": 0,
                "cache_read_input_tokens": 0,
                "call_count": 1,
                "actual_cost_microusd": 0,
            },
        },
        "calls": [
            {
                "response_id": f"msg_{index}",
                "requested_model": (
                    HAIKU_MODEL_ID if index == 1 else model_id
                ),
                "returned_model": (
                    HAIKU_MODEL_ID if index == 1 else model_id
                ),
                "stop_reason": "end_turn",
                "successful_attempt": 1,
                "retry_history": [
                    {
                        "attempt": 1,
                        "outcome": "success",
                        "response_id": f"msg_{index}",
                    },
                ],
                "stage": (
                    "genre_detection"
                    if index == 1
                    else "synthesis"
                    if index == 7
                    else "reader"
                ),
                "pipeline_pass": "sonnet",
                "boundary_run": 1,
                "reader_name": (
                    READER_NAMES[index - 2]
                    if 2 <= index <= 6
                    else None
                ),
                "disposition": "used",
            }
            for index in range(1, 8)
        ],
        "failed_calls": [],
    }


def raw_analysis():
    metadata = {
        "filename": "Trustworthy Draft.pdf",
        **q2_parser_metadata(),
    }
    analysis = prepare_q2_analysis(complete_analysis(), metadata)
    return {
        "source_file": "Trustworthy Draft.pdf",
        "project_id": PROJECT_ID,
        "version_id": VERSION_ID,
        "analysis_model": MODEL_ID,
        "analysis_version": "v9_archaeology",
        "parser_version": "v4-page-evidence",
        "collection": "LEMON",
        "metadata": metadata,
        "analysis": analysis,
        "usage": complete_usage(),
        "actual_cost_microusd": 12_345,
        "actual_cost_usd": 0.012345,
        "content_hash": CONTENT_HASH,
        "identity_status": "verified",
        "queued_at_ms": QUEUED_AT_MS,
        "storage_path": (
            "gs://lemon-screenplay-dashboard.firebasestorage.app/"
            f"screenplays/{PROJECT_ID}/versions/{VERSION_ID}.pdf"
        ),
        "storage_generation": "2002",
        "calibration_profile": {
            "applied": True,
            "profile_id": "admin",
            "prompt_sha256": "cd" * 32,
            "last_calibrated": "2026-07-21T12:00:00Z",
            "total_reviews": 12,
        },
    }


def trusted_raw():
    return attach_trust_manifest(
        raw_analysis(),
        selection_request="sonnet",
        pipeline_model_tier="sonnet",
        effective_model_tier="sonnet",
        model_ids=MODEL_IDS,
        origin_kind="daemon_queue",
        origin_id="queue-job-1",
    )
