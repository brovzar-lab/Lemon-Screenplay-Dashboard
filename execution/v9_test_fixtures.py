"""Shared valid V9 fixtures for permanent-write tests."""

import copy
import hashlib
import json
from pathlib import Path

from execution.trust_manifest import (
    CLAIM_VERIFICATION_BATCH_SIZE,
    PROMPT_CONTRACT_VERSION,
    attach_trust_manifest,
    claim_verification_targets,
    runtime_pricing_sha256,
    _transport_canonical_json,
)
from execution.source_evidence import (
    attach_verified_citation_quality,
    build_context_policy_for_length,
    build_page_evidence,
    build_scene_count_evidence,
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
FIXTURE_DECISION_EVIDENCE = (
    "A family confronts a buried secret. A complete decision summary. "
    "Specific protagonist goal. Clear dramatic escalation. "
    "Distinct central relationship. Earned final choice. "
    "A repairable structural break. The midpoint turn arrives late. "
    "The third act resolves through coincidence."
)
READER_NAMES = (
    "structure",
    "character",
    "craft_scene",
    "concept",
    "emotional_resonance",
)
_TRAP_CONTRACT = json.loads(
    Path(__file__).with_name("v9_trap_contract.json").read_text(
        encoding="utf-8"
    )
)
FALSE_POSITIVE_TRAPS = tuple(
    (trap["name"], trap["tier"], float(trap["weight"]))
    for trap in _TRAP_CONTRACT["traps"]
)
READER_METRICS = {
    "structure": (
        "first_ten_pages", "beginning_hook", "middle_build",
        "ending_payoff", "inciting_incident", "progressive_complications",
        "crisis_quality", "climax_delivery", "beat_timing",
        "first_plot_point", "midpoint", "third_act_turning_point",
        "scene_necessity",
    ),
    "character": (
        "ghost", "lie", "want_vs_need", "arc_delivery",
        "moral_blind_spot", "immoral_effect", "active_vs_passive",
        "opponent_design", "enneagram_consistency",
        "supporting_cast_function", "star_role_potential",
    ),
    "craft_scene": (
        "beat_question_clarity", "bmoc_architecture", "power_shifts",
        "suspense_tools", "dialogue_tactic_changes",
        "dialogue_voice_distinction", "dialogue_subtext",
        "visual_storytelling", "exposition_handling",
    ),
    "concept": (
        "hook_clarity", "narrative_engine", "freshness",
        "genre_execution", "genre_promise_delivery", "controlling_idea",
        "thematic_resonance", "premise_line",
    ),
    "emotional_resonance": (
        "emotional_clarity", "empathy_investment", "emotional_escalation",
        "catharsis_quality", "truth", "goosebumps_moments",
        "value_turn_range",
    ),
}
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


def refresh_claim_verification(analysis):
    verification = analysis["_claim_verification"]
    analysis_for_hash = copy.deepcopy(analysis)
    analysis_for_hash.pop("_citation_quality", None)
    analysis_for_hash.pop("_claim_verification", None)
    targets = claim_verification_targets(analysis_for_hash)
    verification["analysis_sha256"] = hashlib.sha256(
        _transport_canonical_json(analysis_for_hash).encode("utf-8")
    ).hexdigest()
    verification["locked_targets_sha256"] = hashlib.sha256(
        _transport_canonical_json([{
            key: target[key]
            for key in (
                "claim_id",
                "claim",
                "claim_type",
                "verdict_driving",
                "story_fact_check_required",
            )
        } for target in targets]).encode("utf-8")
    ).hexdigest()
    factual_count = sum(
        target["story_fact_check_required"] for target in targets
    )
    verification.update({
        "claim_count": len(targets),
        "factual_claim_count": factual_count,
        "factual_supported_or_partial_count": factual_count,
        "factual_support_rate": 1.0,
        "classification_counts": {"Supported": len(targets)},
        "claims": [{
            **target,
            "classification": "Supported",
            "story_fact_classification": (
                "Supported"
                if target["story_fact_check_required"]
                else "No concrete story fact"
            ),
            "unsupported_story_facts": [],
            "page_citations": [1],
            "citation_evidence": [{
                "page": 1,
                "excerpt": FIXTURE_DECISION_EVIDENCE,
            }],
        } for target in targets],
        "response_ids": [
            f"msg_{8 + index}"
            for index in range(
                (len(targets) + CLAIM_VERIFICATION_BATCH_SIZE - 1)
                // CLAIM_VERIFICATION_BATCH_SIZE
            )
        ],
        "batch_count": (
            len(targets) + CLAIM_VERIFICATION_BATCH_SIZE - 1
        ) // CLAIM_VERIFICATION_BATCH_SIZE,
        "batch_size_limit": CLAIM_VERIFICATION_BATCH_SIZE,
        "batch_target_sha256": [
            hashlib.sha256(_transport_canonical_json([
                target["claim_id"] for target in targets[
                    index:index + CLAIM_VERIFICATION_BATCH_SIZE
                ]
            ]).encode("utf-8")).hexdigest()
            for index in range(
                0, len(targets), CLAIM_VERIFICATION_BATCH_SIZE
            )
        ],
    })


def attach_supported_claim_verification(analysis):
    analysis["_claim_verification"] = {
        "status": "passed_independent_model_review",
        "verification_scope": (
            "semantic_support_against_full_physical_page_source"
        ),
    }
    refresh_claim_verification(analysis)
    return analysis


def _q2_page_texts(page_count, word_count):
    if word_count < page_count * 3:
        raise ValueError("Q2 fixture needs at least three words per page")
    base_words, remainder = divmod(word_count, page_count)
    page_texts = [
        ["word"] * (base_words + (1 if index < remainder else 0))
        for index in range(page_count)
    ]
    evidence_words = f"INT. HOUSE - DAY {FIXTURE_DECISION_EVIDENCE}".split()
    page_texts[0][:len(evidence_words)] = evidence_words
    return [" ".join(words) for words in page_texts]


def material_claim_record(source_field, source_index, claim):
    return {
        "source_field": source_field,
        "source_index": source_index,
        "claim": claim,
        "atomic_claims": [{
            "claim": claim,
            "page_citations": [1],
            "citation_evidence": [{
                "page": 1,
                "excerpt": FIXTURE_DECISION_EVIDENCE,
            }],
        }],
    }


def q2_parser_metadata(
    *,
    page_count=PAGE_COUNT,
    word_count=WORD_COUNT,
    character_count=CHARACTER_COUNT,
    extraction_method="pdfplumber",
):
    page_texts = _q2_page_texts(page_count, word_count)
    text = join_marked_pages(page_texts)
    page_content_signals = [
        {
            "page": page,
            "content_bearing": True,
            "image_count": 0,
            "content_stream_bytes": 100,
        }
        for page in range(1, page_count + 1)
    ]
    page_evidence = build_page_evidence(
        text,
        page_count,
        extraction_method,
        page_content_signals,
    )
    scene_count_evidence = build_scene_count_evidence(text)
    return {
        "page_count": page_count,
        "word_count": word_count,
        "character_count": character_count,
        "extraction_method": extraction_method,
        "parser_version": "v5-scene-content-evidence",
        "parser_extractor_version": "v5-scene-content-evidence",
        "source_content_sha256": CONTENT_HASH,
        "page_evidence_version": page_evidence["page_evidence_version"],
        "extraction_quality": page_evidence["extraction_quality"],
        "page_diagnostics": page_evidence["page_diagnostics"],
        "page_evidence_sha256": page_evidence["evidence_sha256"],
        "page_content_signals": page_content_signals,
        "scene_count_evidence": scene_count_evidence,
        "native_cross_check": {
            "status": "corroborated",
            "methods_compared": ["pdfplumber", "pymupdf"],
            "word_counts": {
                "pdfplumber": word_count,
                "pymupdf": word_count,
            },
            "word_count_agreement_ratio": 1.0,
            "page_token_similarity_ratio": 1.0,
            "pairwise_page_token_similarity": [{
                "methods": ["pdfplumber", "pymupdf"],
                "page_token_similarity_ratio": 1.0,
            }],
            "minimum_similarity_required": 0.8,
            "selected_consensus_method": extraction_method,
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
        "scene_count": build_scene_count_evidence(text)["scene_heading_count"],
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
        model_ids=MODEL_IDS,
    )
    attach_supported_claim_verification(analysis)
    attach_verified_citation_quality(
        analysis,
        metadata,
        metadata["page_count"],
        join_marked_pages(_q2_page_texts(
            metadata["page_count"],
            metadata["word_count"],
        )),
    )
    return analysis


def complete_analysis(title="Trustworthy Draft"):
    claims = {
        "logline": ["A family confronts a buried secret."],
        "executive_summary": ["A complete decision summary."],
        "strength": [
            "Specific protagonist goal.",
            "Clear dramatic escalation.",
            "Distinct central relationship.",
            "Earned final choice.",
        ],
        "weakness": [
            "A repairable structural break.",
            "The midpoint turn arrives late.",
        ],
    }
    reader_reports = {
        name: {
            "reader": name,
            "pillar_score": round(
                (7 * len(READER_METRICS[name]) + 2)
                / len(READER_METRICS[name]),
                2,
            ),
            "sub_scores": {
                metric_name: {
                    "score": 8 if metric_index < 2 else 7,
                    "justification": "A family confronts a buried secret.",
                    "page_citations": [1],
                    "citation_evidence": [{
                        "page": 1,
                        "excerpt": FIXTURE_DECISION_EVIDENCE,
                    }],
                }
                for metric_index, metric_name in enumerate(READER_METRICS[name])
            },
            **({
                "story_vs_situation": {
                    "human_condition": True,
                    "tests_character": True,
                    "twists_reveal_character": True,
                    "emotional_shift": True,
                    "moral_component_driven": True,
                    "evidence": {
                        field: {
                            "page_citations": [1],
                            "citation_evidence": [{
                                "page": 1,
                                "excerpt": "INT. HOUSE - DAY",
                            }],
                        }
                        for field in (
                            "human_condition",
                            "tests_character",
                            "twists_reveal_character",
                            "emotional_shift",
                            "moral_component_driven",
                        )
                    },
                    "total": 5,
                    "verdict": "story",
                },
            } if name == "character" else {}),
        }
        for name in READER_NAMES
    }
    for report in reader_reports.values():
        report.update({
            "red_flags": [],
            "one_sentence_verdict": "The evidence supports this reader score.",
        })
    reader_reports["character"]["sub_scores"]["lie"].update({
        "identified_lie": "Safety is more important than truth.",
    })
    reader_reports["character"]["sub_scores"]["want_vs_need"].update({
        "want": "Keep the family together.",
        "need": "Tell the truth.",
    })
    reader_reports["character"]["sub_scores"]["arc_delivery"].update({
        "arc_type": "positive",
    })
    reader_reports["character"]["sub_scores"]["moral_blind_spot"].update({
        "identified_blind_spot": "Secrecy protects the family.",
    })
    reader_reports["character"]["sub_scores"]["active_vs_passive"].update({
        "verdict": "active",
    })
    reader_reports["character"]["sub_scores"]["enneagram_consistency"].update({
        "likely_type": "Six",
        "confidence": "medium",
    })
    reader_reports["character"]["sub_scores"]["supporting_cast_function"].update({
        "reflection_characters_count": 1,
    })
    reader_reports["craft_scene"]["bmoc_failure_scan"] = {
        "scenes_sampled": 5,
        "failure_modes_triggered": [],
        "total_failure_modes_active": 0,
        "craft_warning": False,
    }
    reader_reports["concept"]["sub_scores"]["hook_clarity"].update({
        "one_sentence_pitch": "A family must expose a secret to stay together.",
    })
    reader_reports["concept"]["sub_scores"]["genre_execution"].update({
        "genre": "Society",
        "obligatory_scenes_present": ["The family confronts the secret."],
        "obligatory_scenes_missing": [],
    })
    reader_reports["concept"]["sub_scores"]["controlling_idea"].update({
        "stated_controlling_idea": "Truth restores trust when secrecy fails.",
    })
    reader_reports["concept"]["sub_scores"]["premise_line"].update({
        "four_clause_premise": "A fearful parent must reveal a secret before it destroys the family.",
    })
    reader_reports["emotional_resonance"]["sub_scores"][
        "goosebumps_moments"
    ].update({
        "moments": ["The family chooses truth over safety."],
    })
    reader_reports["emotional_resonance"]["sub_scores"][
        "value_turn_range"
    ].update({
        "value_spectrum": "Alienation to earned trust.",
    })
    reader_reports["emotional_resonance"]["goosebumps_scenes"] = []
    reader_reports["structure"]["sub_scores"]["beat_timing"]["score"] = 4
    reader_reports["structure"]["pillar_score"] = 6.92
    analysis = {
        "title": title,
        "author": "Fixture Writer",
        "genre": "Society",
        "subgenres": [],
        "themes": ["Trust", "Family"],
        "tone": "Grounded",
        "logline": "A family confronts a buried secret.",
        "analysis_version": "v9_archaeology",
        "weighted_score": 7.13,
        "weighted_score_adjusted": 6.83,
        "critical_failure_penalty_applied": 0.3,
        "verdict_model": "CONSIDER",
        "verdict_before_adjustments": "CONSIDER",
        "verdict_before_gates": "CONSIDER",
        "verdict_adjustments": [
            "critical_failure_penalty: -0.3 (7.13 → 6.83)",
        ],
        "verdict": "CONSIDER",
        "critical_failures": [{
            "weakness_index": 0,
            "reader": "structure",
            "metric": "beat_timing",
            "description": "A repairable structural break.",
            "severity": "minor",
            "penalty": 0.3,
        }],
        "critical_failure_total_penalty": 0.3,
        "story_vs_situation": {
            "score": 4,
            "verdict": "story",
            "gate_applied": False,
            "evidence": reader_reports["character"]["story_vs_situation"]["evidence"],
        },
        "false_positive_check": {
            "trap_contract_version": _TRAP_CONTRACT["version"],
            "weighted_trap_score": 0.0,
            "traps_evaluated": [
                {
                    "name": name,
                    "triggered": False,
                    "tier": tier,
                    "weight": weight,
                    "evidence": f"{name} was checked against the reader reports.",
                }
                for name, tier, weight in FALSE_POSITIVE_TRAPS
            ],
            "verdict_adjustment": "none",
        },
        "strengths": [
            "Specific protagonist goal.",
            "Clear dramatic escalation.",
            "Distinct central relationship.",
            "Earned final choice.",
        ],
        "weaknesses": [
            "A repairable structural break.",
            "The midpoint turn arrives late.",
        ],
        "executive_summary": "A complete decision summary.",
        "material_claims": [
            material_claim_record(source_field, index, claim)
            for source_field, values in claims.items()
            for index, claim in enumerate(values)
        ],
        "comparable_films": {
            "tone": {"title": "Film A", "similarity": "Grounded tone."},
            "structure": {"title": "Film B", "similarity": "Parallel build."},
            "market": {"title": "Film C", "similarity": "Similar audience."},
        },
        "characters": {
            "protagonist": "Not identified",
            "protagonist_evidence": {
                "kind": "not_identified",
                "role": "protagonist",
                "role_justification": "No protagonist is identified in the fixture.",
                "page_citations": [],
                "citation_evidence": [],
            },
            "antagonist": "Not identified",
            "antagonist_evidence": {
                "kind": "not_identified",
                "role": "antagonist",
                "role_justification": "No antagonist is identified in the fixture.",
                "page_citations": [],
                "citation_evidence": [],
            },
            "supporting": [],
            "supporting_evidence": [],
        },
        "reader_disagreements": [],
        "_truncation": {
            "truncated": False,
            "chars_lost": 0,
            "approx_pages_lost": 0,
        },
        "_context_policy": build_context_policy_for_length(
            CHARACTER_COUNT,
            "sonnet",
            model_ids=MODEL_IDS,
        ),
        "reader_reports": reader_reports,
        "pillar_scores": {
            name: {
                "score": reader_reports[name]["pillar_score"],
                "weight": {
                    "structure": 0.30,
                    "character": 0.30,
                    "craft_scene": 0.15,
                    "concept": 0.15,
                    "emotional_resonance": 0.10,
                }[name],
            }
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
                    "adjusted_score": 6.83,
                    "verdict": "CONSIDER",
                    "verdict_model": "CONSIDER",
                    "response_ids": [
                        f"msg_{index}" for index in range(1, 8)
                    ],
                },
            ],
            "selected_run_number": 1,
            "median_adjusted_score": 6.83,
            "score_spread": 0.0,
            "final_verdict": "CONSIDER",
        },
    }
    refresh_boundary_evidence(analysis)
    return analysis


def complete_usage(model_id=MODEL_ID):
    claim_batch_count = (
        len(claim_verification_targets(complete_analysis()))
        + CLAIM_VERIFICATION_BATCH_SIZE - 1
    ) // CLAIM_VERIFICATION_BATCH_SIZE

    def split(total):
        base, remainder = divmod(total, 6)
        return [base + (1 if index < remainder else 0) for index in range(6)]

    per_call = [{
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 0,
        "call_count": 1,
        "actual_cost_microusd": 0,
        "actual_cost_usd": 0.0,
        "charged_cost_microusd": 0,
        "estimated_cost_nanousd": 0,
        "estimated_cost_usd": 0.0,
        "rounding_variance_nanousd": 0,
        "rounding_variance_usd": 0.0,
        "rounding_reason": None,
    }]
    split_fields = {
        "input_tokens": split(1_000),
        "output_tokens": split(500),
        "cache_creation_input_tokens": split(100),
        "cache_read_input_tokens": split(200),
        "actual_cost_microusd": split(12_345),
    }
    for index in range(6):
        microusd = split_fields["actual_cost_microusd"][index]
        per_call.append({
            **{field: values[index] for field, values in split_fields.items()},
            "call_count": 1,
            "actual_cost_usd": microusd / 1_000_000,
            "charged_cost_microusd": microusd,
            "estimated_cost_nanousd": microusd * 1_000,
            "estimated_cost_usd": microusd / 1_000_000,
            "rounding_variance_nanousd": 0,
            "rounding_variance_usd": 0.0,
            "rounding_reason": None,
        })
    per_call.extend(
        copy.deepcopy(per_call[0]) for _ in range(claim_batch_count)
    )

    def call_provenance(index, stage, call_usage):
        schema_mode = (
            "strict_tool" if stage == "genre_detection" else "compact_strict_tool"
        )
        actual = call_usage["actual_cost_microusd"]
        return {
            "request_sha256": f"{index:02x}" * 32,
            "prompt_sha256": f"{index + 16:02x}" * 32,
            "prompt_contract_version": PROMPT_CONTRACT_VERSION,
            "schema_mode": schema_mode,
            "schema_sha256": f"{index + 32:02x}" * 32,
            "transport_schema_sha256": f"{index + 48:02x}" * 32,
            "pricing_sha256": runtime_pricing_sha256(),
            "independent_cost_microusd": actual,
            "independent_cost_usd": actual / 1_000_000,
            "independent_cost_nanousd": actual * 1_000,
            "independent_estimated_cost_usd": actual / 1_000_000,
            "exact_cost_variance_nanousd": 0,
            "exact_cost_variance_usd": 0.0,
            "charged_cost_microusd": actual,
            "rounding_variance_nanousd": 0,
            "rounding_variance_usd": 0.0,
            "rounding_reason": None,
            "cost_variance_microusd": 0,
            "cost_variance_reason": None,
            "latency_ms": index,
            "started_at": "2026-08-27T12:00:00Z",
            "completed_at": "2026-08-27T12:00:01Z",
            "transport_attempt": 1,
            "transport_retry_count": 0,
            "logical_retry": 0,
            "attempt_number": 1,
            "retry_count": 0,
            "total_retry_count": 0,
            "validation_result": "passed",
            "transformations": (
                ["derived_is_comedy_from_external_genre"]
                if stage == "genre_detection"
                else ["decoded_compact_json_envelope"]
            ),
            "transformation_evidence": ([{
                "name": "derived_is_comedy_from_external_genre",
                "changed": True,
                "before": {"external_genre": "Society"},
                "after": {"external_genre": "Society", "is_comedy": False},
            }] if stage == "genre_detection" else [{
                "name": "decoded_compact_json_envelope",
                "changed": True,
                "before_sha256": f"{index + 64:02x}" * 32,
                "after_sha256": f"{index + 80:02x}" * 32,
            }]),
            "failure_state": None,
            "warnings": [],
            "fallback_used": False,
            "truncated": False,
            "downstream_consumption": "consumed",
        }
    return {
        "input_tokens": 1_000,
        "output_tokens": 500,
        "cache_creation_input_tokens": 100,
        "cache_read_input_tokens": 200,
        "call_count": 7 + claim_batch_count,
        "actual_cost_microusd": 12_345,
        "actual_cost_usd": 0.012345,
        "estimated_cost_nanousd": 12_345_000,
        "estimated_cost_usd": 0.012345,
        "rounding_variance_nanousd": 0,
        "rounding_variance_usd": 0.0,
        "finish_reason": "end_turn",
        "by_model": {
            model_id: {
                "input_tokens": 1_000,
                "output_tokens": 500,
                "cache_creation_input_tokens": 100,
                "cache_read_input_tokens": 200,
                "call_count": 6 + claim_batch_count,
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
                "stop_reason": "tool_use",
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
                    else "claim_verification"
                    if index >= 8
                    else "synthesis"
                    if index == 7
                    else "reader"
                ),
                "pipeline_pass": "sonnet",
                "boundary_run": 1,
                "reader_name": (
                    READER_NAMES[index - 2]
                    if 2 <= index <= 6
                    else (
                        f"batch_{index - 7:03d}_of_{claim_batch_count:03d}"
                    )
                    if index >= 8
                    else None
                ),
                "disposition": "used",
                "usage": per_call[index - 1],
                **call_provenance(
                    index,
                    "genre_detection"
                    if index == 1
                    else "synthesis"
                    if index == 7
                    else "claim_verification"
                    if index >= 8
                    else "reader",
                    per_call[index - 1],
                ),
            }
            for index in range(1, 8 + claim_batch_count)
        ],
        "failed_calls": [],
    }


def raw_analysis():
    metadata = {
        "filename": "Trustworthy Draft.pdf",
        **q2_parser_metadata(),
    }
    analysis = prepare_q2_analysis(complete_analysis(), metadata)
    analysis_for_hash = copy.deepcopy(analysis)
    analysis_for_hash.pop("_citation_quality", None)
    analysis_for_hash.pop("_claim_verification", None)
    targets = claim_verification_targets(analysis_for_hash)
    locked_targets = [{
        key: target[key]
        for key in (
            "claim_id",
            "claim",
            "claim_type",
            "verdict_driving",
            "story_fact_check_required",
        )
    } for target in targets]
    factual_count = sum(
        target["story_fact_check_required"] for target in targets
    )
    analysis["_claim_verification"] = {
        "status": "passed_independent_model_review",
        "verification_scope": (
            "semantic_support_against_full_physical_page_source"
        ),
        "claim_count": len(targets),
        "factual_claim_count": factual_count,
        "factual_supported_or_partial_count": factual_count,
        "factual_support_rate": 1.0,
        "classification_counts": {"Supported": len(targets)},
        "locked_targets_sha256": hashlib.sha256(json.dumps(
            locked_targets,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")).hexdigest(),
        "analysis_sha256": hashlib.sha256(
            _transport_canonical_json(analysis_for_hash).encode("utf-8")
        ).hexdigest(),
        "claims": [{
            **target,
            "classification": "Supported",
            "story_fact_classification": (
                "Supported"
                if target["story_fact_check_required"]
                else "No concrete story fact"
            ),
            "unsupported_story_facts": [],
            "page_citations": [1],
            "citation_evidence": [{
                "page": 1,
                "excerpt": FIXTURE_DECISION_EVIDENCE,
            }],
        } for target in targets],
        "response_ids": [
            f"msg_{8 + index}"
            for index in range(
                (len(targets) + CLAIM_VERIFICATION_BATCH_SIZE - 1)
                // CLAIM_VERIFICATION_BATCH_SIZE
            )
        ],
        "batch_count": (
            len(targets) + CLAIM_VERIFICATION_BATCH_SIZE - 1
        ) // CLAIM_VERIFICATION_BATCH_SIZE,
        "batch_size_limit": CLAIM_VERIFICATION_BATCH_SIZE,
        "batch_target_sha256": [
            hashlib.sha256(_transport_canonical_json([
                target["claim_id"] for target in targets[
                    index:index + CLAIM_VERIFICATION_BATCH_SIZE
                ]
            ]).encode("utf-8")).hexdigest()
            for index in range(
                0, len(targets), CLAIM_VERIFICATION_BATCH_SIZE
            )
        ],
    }
    attach_verified_citation_quality(
        analysis,
        metadata,
        metadata["page_count"],
        q2_parsed_source()["text"],
    )
    return {
        "source_file": "Trustworthy Draft.pdf",
        "project_id": PROJECT_ID,
        "version_id": VERSION_ID,
        "analysis_model": MODEL_ID,
        "analysis_version": "v9_archaeology",
        "parser_version": "v5-scene-content-evidence",
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
