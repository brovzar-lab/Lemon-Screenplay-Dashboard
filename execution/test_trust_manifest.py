import copy
import hashlib
import json
import unittest
from unittest.mock import patch

from execution import ingest_v9
from execution import trust_manifest as trust_manifest_module
from execution.v9_test_fixtures import (
    CONTENT_HASH,
    FIXTURE_DECISION_EVIDENCE,
    HAIKU_MODEL_ID,
    MODEL_ID,
    MODEL_IDS as TEST_MODEL_IDS,
    PROJECT_ID,
    QUEUED_AT_MS,
    VERSION_ID,
    complete_analysis,
    complete_usage,
    q2_parsed_source,
    raw_analysis,
    refresh_boundary_evidence,
    refresh_claim_verification,
    trusted_raw,
)
from execution.trust_manifest import (
    CLAIM_VERIFICATION_BATCH_SIZE,
    ANALYSIS_SCHEMA_VERSION,
    LEGACY_ANALYSIS_SCHEMA_VERSION,
    LEGACY_PROMPT_CONTRACT_VERSION,
    LEGACY_TRUST_MANIFEST_VERSION,
    PREVIOUS_PROMPT_CONTRACT_VERSION,
    PREVIOUS_ANALYSIS_SCHEMA_VERSION,
    PROMPT_CONTRACT_VERSION,
    PREVIOUS_SCORING_CODE_VERSION,
    Q2_TRUST_MANIFEST_VERSION,
    Q3_TRUST_MANIFEST_VERSION,
    Q4_TRUST_MANIFEST_VERSION,
    READER_RELIABILITY_CONTRACT_VERSION,
    SCORING_CODE_VERSION,
    TRUST_MANIFEST_VERSION,
    attach_trust_manifest,
    build_benchmark_trust_seal,
    claim_verification_target_fields,
    claim_verification_targets,
    runtime_pricing_sha256,
    validate_permanent_analysis,
    _claim_verification_provenance,
    _evidence_provenance,
)
from execution.source_evidence import (
    attach_verified_citation_quality,
    build_context_policy_for_length,
)
from execution.ingest_v9 import (
    canonical_failed_call,
    _validate_claim_verification,
    _validate_reader_report,
)


def call_provenance(response_id, stage, disposition):
    fingerprint = hashlib.sha256(response_id.encode("utf-8")).hexdigest()
    schema_mode = "schema_free" if stage == "triage" else "compact_strict_tool"
    used = disposition == "used"
    return {
        "request_sha256": fingerprint,
        "prompt_sha256": fingerprint,
        "prompt_contract_version": PROMPT_CONTRACT_VERSION,
        "schema_mode": schema_mode,
        "schema_sha256": None if schema_mode == "schema_free" else fingerprint,
        "transport_schema_sha256": None if schema_mode == "schema_free" else fingerprint,
        "pricing_sha256": runtime_pricing_sha256(),
        "independent_cost_microusd": 0,
        "independent_cost_usd": 0.0,
        "independent_cost_nanousd": 0,
        "independent_estimated_cost_usd": 0.0,
        "exact_cost_variance_nanousd": 0,
        "exact_cost_variance_usd": 0.0,
        "charged_cost_microusd": 0,
        "rounding_variance_nanousd": 0,
        "rounding_variance_usd": 0.0,
        "rounding_reason": None,
        "cost_variance_microusd": 0,
        "cost_variance_reason": None,
        "latency_ms": 1,
        "started_at": "2026-08-27T12:00:00Z",
        "completed_at": "2026-08-27T12:00:01Z",
        "transport_attempt": 1,
        "transport_retry_count": 0,
        "logical_retry": 0,
        "attempt_number": 1,
        "retry_count": 0,
        "total_retry_count": 0,
        "validation_result": "passed" if used else "failed_application_validation",
        "validation_reason": None if used else "Structured output was unusable",
        "transformations": [] if stage == "triage" else ["decoded_compact_json_envelope"],
        "transformation_evidence": [] if stage == "triage" else [{
            "name": "decoded_compact_json_envelope",
            "changed": True,
            "before_sha256": fingerprint,
            "after_sha256": "ab" * 32,
        }],
        "failure_state": None if used else "output_validation_failed",
        "warnings": [],
        "fallback_used": False,
        "truncated": False,
        "downstream_consumption": "consumed" if used else "not_consumed",
    }


def use_legacy_engine_contract(raw):
    raw["analysis_schema_version"] = LEGACY_ANALYSIS_SCHEMA_VERSION
    raw["prompt_version"] = LEGACY_PROMPT_CONTRACT_VERSION
    raw["scoring_code_version"] = PREVIOUS_SCORING_CODE_VERSION
    manifest = raw["trust_manifest"]
    manifest["engine"].update({
        "analysis_schema_version": LEGACY_ANALYSIS_SCHEMA_VERSION,
        "prompt_contract_version": LEGACY_PROMPT_CONTRACT_VERSION,
        "scoring_code_version": PREVIOUS_SCORING_CODE_VERSION,
    })
    for source in (raw["usage"], manifest["models"]):
        for collection in ("calls", "failed_calls"):
            for call in source.get(collection, []):
                call["prompt_contract_version"] = (
                    LEGACY_PROMPT_CONTRACT_VERSION
                )
    return raw


def failed_call_provenance(
    requested_model,
    stage,
    pipeline_pass,
    *,
    reader_name=None,
    attempts=1,
):
    return canonical_failed_call({
        **call_provenance(f"failed-{stage}-{reader_name}", stage, "discarded_unusable"),
        "requested_model": requested_model,
        "stage": stage,
        "pipeline_pass": pipeline_pass,
        "boundary_run": 1,
        "reader_name": reader_name,
        "attempt_history": [{
            "attempt": attempt,
            "outcome": "failed",
            "error_type": "Timeout",
        } for attempt in range(1, attempts + 1)],
        "transport_attempts": attempts,
        "transport_retry_count": attempts - 1,
        "retry_count": attempts - 1,
        "total_retry_count": attempts - 1,
        "validation_result": "failed_transport",
        "validation_reason": "Provider result was unavailable",
        "transformations": [],
        "transformation_evidence": [],
        "failure_state": "Timeout",
        "failure_message": "Provider result was unavailable",
    })

class TrustManifestTests(unittest.TestCase):
    @staticmethod
    def _benchmark_seal_inputs():
        raw = raw_analysis()
        metadata = raw["metadata"]
        analysis = raw["analysis"]
        usage = raw["usage"]
        analysis.pop("_claim_verification", None)
        prior_claim_call_count = sum(
            call.get("stage") == "claim_verification"
            for call in usage["calls"]
        )
        usage["calls"] = [
            call for call in usage["calls"]
            if call.get("stage") != "claim_verification"
        ]
        usage["call_count"] -= prior_claim_call_count
        usage["by_model"][MODEL_ID]["call_count"] -= prior_claim_call_count
        analysis_for_hash = copy.deepcopy(analysis)
        analysis_for_hash.pop("_citation_quality", None)
        targets = claim_verification_targets(analysis)
        locked_targets = [{
            key: target[key]
            for key in claim_verification_target_fields()
        } for target in targets]
        claim_results = [{
            "claim_id": target["claim_id"],
            "claim": target["claim"],
            "claim_type": target["claim_type"],
            "classification": "Supported",
            "story_fact_classification": (
                "Supported"
                if target["story_fact_check_required"]
                else "No concrete story fact"
            ),
            "unsupported_story_facts": [],
            "explanation": "The cited physical page supports the locked claim.",
            "page_citations": [1],
            "citation_evidence": [{
                "page": 1,
                "excerpt": FIXTURE_DECISION_EVIDENCE,
            }],
            "verdict_driving": target["verdict_driving"],
            "story_fact_check_required": target["story_fact_check_required"],
            "evidence_scope": target["evidence_scope"],
        } for target in targets]
        factual_count = sum(
            target["story_fact_check_required"] for target in targets
        )
        batch_count = (
            len(targets) + CLAIM_VERIFICATION_BATCH_SIZE - 1
        ) // CLAIM_VERIFICATION_BATCH_SIZE
        response_ids = [
            f"msg_claim_{index}"
            for index in range(1, batch_count + 1)
        ]
        batch_hashes = [
            ingest_v9._canonical_json_hash([
                target["claim_id"] for target in targets[
                    index:index + CLAIM_VERIFICATION_BATCH_SIZE
                ]
            ])
            for index in range(
                0, len(targets), CLAIM_VERIFICATION_BATCH_SIZE
            )
        ]
        analysis["_claim_verification"] = {
            "status": "passed_independent_model_review",
            "verification_scope": "semantic_support_against_full_physical_page_source",
            "claim_count": len(targets),
            "factual_claim_count": factual_count,
            "factual_supported_or_partial_count": factual_count,
            "factual_support_rate": 1.0,
            "classification_counts": {"Supported": len(targets)},
            "locked_targets_sha256": ingest_v9._canonical_json_hash(
                locked_targets
            ),
            "analysis_sha256": ingest_v9._canonical_json_hash(
                analysis_for_hash
            ),
            "claims": claim_results,
            "response_ids": response_ids,
            "batch_count": batch_count,
            "batch_size_limit": CLAIM_VERIFICATION_BATCH_SIZE,
            "batch_target_sha256": batch_hashes,
        }
        parsed = q2_parsed_source()
        attach_verified_citation_quality(
            analysis,
            metadata,
            metadata["page_count"],
            parsed["text"],
        )
        zero_usage = {
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
        }
        usage["call_count"] += batch_count
        usage["by_model"][MODEL_ID]["call_count"] += batch_count
        usage["calls"].extend({
            "response_id": response_id,
            "requested_model": MODEL_ID,
            "returned_model": MODEL_ID,
            "stop_reason": "tool_use",
            "successful_attempt": 1,
            "retry_history": [{
                "attempt": 1,
                "outcome": "success",
                "response_id": response_id,
            }],
            "stage": "claim_verification",
            "pipeline_pass": "sonnet",
            "boundary_run": 1,
            "reader_name": f"batch_{index:03d}_of_{batch_count:03d}",
            "disposition": "used",
            "usage": copy.deepcopy(zero_usage),
            **call_provenance(response_id, "claim_verification", "used"),
        } for index, response_id in enumerate(response_ids, start=1))
        spent_microusd = 0
        for sequence, call in enumerate(usage["calls"], start=1):
            actual_microusd = call["usage"]["actual_cost_microusd"]
            request_ceiling_microusd = max(1_000, actual_microusd)
            remaining_microusd = 40_000_000 - spent_microusd
            spent_after_microusd = spent_microusd + actual_microusd
            call["budget_check"] = {
                "requested_model": call["requested_model"],
                "stage": call["stage"],
                "logical_retry": call["logical_retry"],
                "decision": "settled",
                "request_content_bytes": 100,
                "request_envelope_overhead_bytes": 20,
                "request_bytes_upper_bound": 120,
                "input_tokens_upper_bound": 4_216,
                "output_tokens_upper_bound": 500,
                "request_ceiling_microusd": request_ceiling_microusd,
                "request_ceiling_usd": request_ceiling_microusd / 1_000_000,
                "sequence": sequence,
                "spent_before_microusd": spent_microusd,
                "spent_before_usd": spent_microusd / 1_000_000,
                "reserved_before_microusd": 0,
                "reserved_before_usd": 0.0,
                "remaining_before_microusd": remaining_microusd,
                "remaining_before_usd": remaining_microusd / 1_000_000,
                "settled_cost_microusd": actual_microusd,
                "settled_cost_usd": actual_microusd / 1_000_000,
                "spent_after_microusd": spent_after_microusd,
                "spent_after_usd": spent_after_microusd / 1_000_000,
                "reserved_after_microusd": 0,
                "reserved_after_usd": 0.0,
                "preflight_ceiling_exceeded": False,
                "platform_recheck": {"sequence": sequence, "status": "passed"},
            }
            spent_microusd = spent_after_microusd
        git_sha = "a" * 40
        candidate_release = {
            "git_sha": git_sha,
            "source_clean": True,
            "catalog_sha256": "b" * 64,
            "pricing_sha256": runtime_pricing_sha256(),
            "build_timestamp": "2026-08-27T12:00:00Z",
            "deployment_config_sha256": "c" * 64,
            "cloud_run_revision": "llmproxycandidate-00001-abc",
        }
        for call in usage["calls"]:
            call["release"] = copy.deepcopy(candidate_release)
            call["expected_release"] = copy.deepcopy(candidate_release)
        return {
            "analysis": analysis,
            "usage": usage,
            "source": {
                "source_sha256": CONTENT_HASH,
                "page_evidence_sha256": metadata["page_evidence_sha256"],
                "filename": raw["source_file"],
                "physical_page_count": metadata["page_count"],
                "word_count": metadata["word_count"],
                "scene_heading_count": metadata[
                    "scene_count_evidence"
                ]["scene_heading_count"],
                "scene_count_evidence": metadata["scene_count_evidence"],
            },
            "parser_metadata": metadata,
            "route": "sonnet",
            "effective_model_tier": "sonnet",
            "model_ids": TEST_MODEL_IDS,
            "contracts": {"prompt_sha256": "d" * 64},
            "release": candidate_release,
            "local_source_proof": {
                phase: {"git_sha": git_sha, "clean": True}
                for phase in ("before", "after")
            },
            "authorized_benchmark_cap_microusd": 40_000_000,
        }

    def test_benchmark_seal_rejects_failed_calls_and_unreconciled_cost(self):
        inputs = self._benchmark_seal_inputs()
        inputs["usage"]["failed_calls"].append({"stage": "reader"})
        with self.assertRaisesRegex(ValueError, "unresolved failed calls"):
            build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        inputs["usage"]["calls"][0]["cost_variance_microusd"] = 1
        inputs["usage"]["calls"][0]["cost_variance_reason"] = "provider mismatch"
        with self.assertRaisesRegex(ValueError, "unresolved cost variance"):
            build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        inputs["usage"]["actual_cost_usd"] = 999.0
        with self.assertRaisesRegex(ValueError, "actual dollar cost"):
            build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        inputs["usage"]["estimated_cost_nanousd"] = str(
            inputs["usage"]["estimated_cost_nanousd"]
        )
        with self.assertRaisesRegex(ValueError, "exact cost evidence"):
            build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        inputs["usage"]["estimated_cost_nanousd"] -= 123
        inputs["usage"]["estimated_cost_usd"] = (
            inputs["usage"]["estimated_cost_nanousd"] / 1_000_000_000
        )
        inputs["usage"]["rounding_variance_nanousd"] += 123
        inputs["usage"]["rounding_variance_usd"] = 123 / 1_000_000_000
        with self.assertRaisesRegex(ValueError, "root exact cost"):
            build_benchmark_trust_seal(**inputs)

        for field in (
            "independent_estimated_cost_usd",
            "exact_cost_variance_usd",
            "rounding_variance_usd",
        ):
            inputs = self._benchmark_seal_inputs()
            inputs["usage"]["calls"][0][field] = float("nan")
            with self.subTest(field=field):
                with self.assertRaisesRegex(ValueError, "exact cost evidence"):
                    build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        inputs["analysis"]["weighted_score"] = float("nan")
        with self.assertRaisesRegex(ValueError, "finite number"):
            build_benchmark_trust_seal(**inputs)

        for invalid_ratio in (float("nan"), float("inf")):
            inputs = self._benchmark_seal_inputs()
            inputs["parser_metadata"]["native_cross_check"][
                "word_count_agreement_ratio"
            ] = invalid_ratio
            with self.subTest(native_ratio=invalid_ratio):
                with self.assertRaisesRegex(ValueError, "agreement ratio"):
                    build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        inputs["parser_metadata"]["native_cross_check"][
            "unexpected_private_payload"
        ] = "SECRET-SENTINEL"
        with self.assertRaisesRegex(ValueError, "schema"):
            build_benchmark_trust_seal(**inputs)

    def test_benchmark_seal_binds_calls_to_release_pricing(self):
        inputs = self._benchmark_seal_inputs()
        seal = build_benchmark_trust_seal(**inputs)
        self.assertEqual(
            seal["engine"]["release"]["pricing_sha256"],
            runtime_pricing_sha256(),
        )

        inputs["release"]["pricing_sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "runtime table"):
            build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        inputs["release"]["cloud_run_revision"] = "local-emulator"
        with self.assertRaisesRegex(ValueError, "deployed Cloud Run"):
            build_benchmark_trust_seal(**inputs)

        for field in ("release", "expected_release"):
            inputs = self._benchmark_seal_inputs()
            inputs["usage"]["calls"][0][field]["git_sha"] = "f" * 40
            with self.subTest(call_release_field=field):
                with self.assertRaisesRegex(
                    ValueError,
                    "exact candidate release",
                ):
                    build_benchmark_trust_seal(**inputs)

    def test_benchmark_seal_requires_exact_successful_call_budget_receipts(self):
        inputs = self._benchmark_seal_inputs()
        inputs["usage"]["calls"][0]["budget_check"][
            "unexpected_private_payload"
        ] = "SYNTHETIC-SECRET-MARKER"
        seal = build_benchmark_trust_seal(**inputs)
        self.assertNotIn("SYNTHETIC-SECRET-MARKER", json.dumps(seal))
        self.assertTrue(all(
            call["budget_check"]["decision"] == "settled"
            for call in seal["models"]["calls"]
        ))

        inputs = self._benchmark_seal_inputs()
        inputs["usage"]["calls"][0].pop("budget_check")
        with self.assertRaisesRegex(ValueError, "complete budget receipt"):
            build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        inputs["usage"]["calls"][0]["budget_check"]["stage"] = "synthesis"
        with self.assertRaisesRegex(ValueError, "budget receipt does not match"):
            build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        inputs["usage"]["calls"][0]["budget_check"][
            "request_bytes_upper_bound"
        ] = 999_999
        with self.assertRaisesRegex(ValueError, "request byte accounting"):
            build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        inputs["usage"]["calls"][0]["budget_check"][
            "settled_cost_microusd"
        ] = 1
        inputs["usage"]["calls"][0]["budget_check"]["settled_cost_usd"] = 0.000001
        inputs["usage"]["calls"][0]["budget_check"]["spent_after_microusd"] = 1
        inputs["usage"]["calls"][0]["budget_check"]["spent_after_usd"] = 0.000001
        with self.assertRaisesRegex(ValueError, "budget settlement does not match"):
            build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        for call in inputs["usage"]["calls"]:
            call["budget_check"]["sequence"] = 1
        with self.assertRaisesRegex(ValueError, "budget ledger continuity"):
            build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        second_call = inputs["usage"]["calls"][1]
        second = second_call["budget_check"]
        second_actual = second_call["usage"]["actual_cost_microusd"]
        second["spent_before_microusd"] = 777
        second["spent_before_usd"] = 0.000777
        second["spent_after_microusd"] = 777 + second_actual
        second["spent_after_usd"] = (777 + second_actual) / 1_000_000
        second["remaining_before_microusd"] = 39_999_223
        second["remaining_before_usd"] = 39.999223
        with self.assertRaisesRegex(ValueError, "budget ledger continuity"):
            build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        inputs["authorized_benchmark_cap_microusd"] = 39_000_000
        with self.assertRaisesRegex(ValueError, "authorized cap"):
            build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        call = inputs["usage"]["calls"][0]
        call.update({
            "logical_retry": 2,
            "attempt_number": 3,
            "total_retry_count": 2,
        })
        call["budget_check"]["logical_retry"] = 2
        with self.assertRaisesRegex(ValueError, "logical retry limit"):
            build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        call = inputs["usage"]["calls"][0]
        call.update({
            "successful_attempt": 3,
            "transport_attempt": 3,
            "transport_retry_count": 2,
            "retry_count": 2,
            "total_retry_count": 2,
            "retry_history": [
                {
                    "attempt": attempt,
                    "outcome": "failed",
                    "error_type": "LlmPreCallRetryableError",
                }
                for attempt in (1, 2)
            ] + [{
                "attempt": 3,
                "outcome": "success",
                "response_id": call["response_id"],
            }],
        })
        with self.assertRaisesRegex(ValueError, "transport retry limit"):
            build_benchmark_trust_seal(**inputs)

    def test_benchmark_seal_rejects_unbound_transformations(self):
        inputs = self._benchmark_seal_inputs()
        transformed_call = next(
            call for call in inputs["usage"]["calls"]
            if call["transformations"]
        )
        transformed_call["transformation_evidence"] = []
        with self.assertRaisesRegex(ValueError, "one-to-one evidence"):
            build_benchmark_trust_seal(**inputs)

    def test_benchmark_seal_rejects_incomplete_structured_provider_stops(self):
        for stop_reason in (
            "end_turn",
            "max_tokens",
            "model_context_window_exceeded",
            "pause_turn",
            "refusal",
            "stop_sequence",
        ):
            inputs = self._benchmark_seal_inputs()
            inputs["usage"]["calls"][0]["stop_reason"] = stop_reason
            inputs["usage"]["calls"][0]["truncated"] = stop_reason in {
                "max_tokens",
                "model_context_window_exceeded",
            }
            with self.subTest(stop_reason=stop_reason):
                with self.assertRaisesRegex(ValueError, "incomplete stop_reason"):
                    build_benchmark_trust_seal(**inputs)

    def test_benchmark_seal_requires_a_hash_bound_supported_claim_ledger(self):
        inputs = self._benchmark_seal_inputs()
        inputs["analysis"].pop("_claim_verification")
        with self.assertRaisesRegex(ValueError, "lacks independent claim"):
            build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        inputs["analysis"]["_claim_verification"]["claims"][0][
            "classification"
        ] = "Contradicted"
        with self.assertRaisesRegex(ValueError, "verdict-driving claim"):
            build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        inputs["analysis"]["_claim_verification"]["analysis_sha256"] = "0" * 64
        with self.assertRaisesRegex(ValueError, "different analysis"):
            build_benchmark_trust_seal(**inputs)

        inputs = self._benchmark_seal_inputs()
        inputs["analysis"]["_claim_verification"]["claims"][0][
            "claim_id"
        ] = "invented.target"
        with self.assertRaisesRegex(ValueError, "target set"):
            build_benchmark_trust_seal(**inputs)

    def test_claim_targets_include_genre_absent_roles_and_character_details(self):
        analysis = complete_analysis()
        analysis["subgenres"] = ["Family Drama"]
        analysis["characters"]["protagonist_lie"] = "Safety is more important than truth."
        analysis["characters"]["protagonist_arc_type"] = "Positive change arc"
        analysis["characters"]["supporting"] = ["Mara"]
        analysis["characters"]["supporting_evidence"] = [{
            "name": "Mara",
            "kind": "person",
            "role": "supporting",
            "role_justification": "Mara forces the final choice.",
            "page_citations": [1],
            "citation_evidence": [{"page": 1, "excerpt": "INT. HOUSE - DAY"}],
        }]
        ids = {
            target["claim_id"]
            for target in claim_verification_targets(analysis)
        }
        self.assertTrue({
            "genre.primary",
            "genre.subgenre.0",
            "character.protagonist",
            "character.antagonist",
            "character.protagonist_lie",
            "character.protagonist_arc_type",
            "character.supporting.0",
        }.issubset(ids))

    def test_nested_reader_story_assertion_cannot_escape_verification(self):
        analysis = complete_analysis()
        invented = "The nonexistent dragon kills the protagonist on page 80."
        analysis["reader_reports"]["concept"]["sub_scores"][
            "genre_execution"
        ]["obligatory_scenes_present"] = [invented]
        targets = claim_verification_targets(analysis)
        target = next(
            item for item in targets
            if item["claim_id"]
            == "reader.concept.genre_execution.obligatory_scenes_present.0"
        )
        self.assertIn(invented, target["claim"])

        raw = {"claims": [{
            "claim_id": item["claim_id"],
            "classification": (
                "Unsupported" if item is target else "Supported"
            ),
            "story_fact_classification": (
                "Unsupported"
                if item is target
                else (
                    "Supported"
                    if item["story_fact_check_required"]
                    else "No concrete story fact"
                )
            ),
            "unsupported_story_facts": [],
            "page_citations": [1],
            "citation_evidence": [{
                "page": 1,
                "excerpt": f"Physical page evidence confirms {item['claim']}",
            }],
        } for item in targets]}
        with self.assertRaisesRegex(ValueError, "factual screenplay claim"):
            _validate_claim_verification(raw, targets)

    def test_compound_story_fact_is_split_and_false_outcome_fails(self):
        analysis = complete_analysis()
        compound = "María rescues her brother but kills him in the finale"
        parts = ingest_v9._atomic_claims(compound)
        self.assertEqual(
            parts,
            ["María rescues her brother", "kills him in the finale"],
        )
        material = next(
            item
            for item in analysis["material_claims"]
            if item["source_field"] == "weakness" and item["source_index"] == 0
        )
        analysis["weaknesses"][0] = compound
        material["claim"] = compound
        material["atomic_claims"] = [{
            "claim": part,
            "page_citations": [1],
            "citation_evidence": [{
                "page": 1,
                "excerpt": "María rescues her brother in the finale.",
            }],
        } for part in parts]
        targets = claim_verification_targets(analysis)
        false_target = next(
            target for target in targets
            if target["claim"] == "kills him in the finale"
        )
        self.assertEqual(false_target["claim_type"], "mixed")
        raw = {"claims": [{
            "claim_id": target["claim_id"],
            "classification": (
                "Unsupported" if target is false_target else "Supported"
            ),
            "story_fact_classification": (
                "Unsupported"
                if target is false_target
                else (
                    "Supported"
                    if target["story_fact_check_required"]
                    else "No concrete story fact"
                )
            ),
            "unsupported_story_facts": [],
            "page_citations": [1],
            "citation_evidence": [{
                "page": 1,
                "excerpt": (
                    "María rescues her brother in the finale."
                    if target is false_target
                    else f"Physical page evidence confirms {target['claim']}"
                ),
            }],
        } for target in targets]}
        with self.assertRaisesRegex(ValueError, "factual screenplay claim"):
            _validate_claim_verification(raw, targets)

    def test_mixed_story_claim_cannot_deny_its_factual_content(self):
        targets = claim_verification_targets(complete_analysis())
        mixed_target = next(
            target for target in targets if target["claim_type"] == "mixed"
        )
        raw = {"claims": [{
            "claim_id": target["claim_id"],
            "classification": (
                "Not objectively verifiable"
                if target is mixed_target
                else "Supported"
            ),
            "story_fact_classification": (
                "No concrete story fact"
                if target is mixed_target
                else (
                    "Supported"
                    if target["story_fact_check_required"]
                    else "No concrete story fact"
                )
            ),
            "unsupported_story_facts": [],
            "page_citations": [1],
            "citation_evidence": [{
                "page": 1,
                "excerpt": f"Physical page evidence confirms {target['claim']}",
            }],
        } for target in targets]}
        with self.assertRaisesRegex(ValueError, "required story-fact check"):
            _validate_claim_verification(raw, targets)

    def test_partial_compound_cannot_hide_fabricated_central_event(self):
        analysis = complete_analysis()
        compound = "Ana loves Carlos and kills him in the finale"
        self.assertEqual(ingest_v9._atomic_claims(compound), [compound])
        material = next(
            item
            for item in analysis["material_claims"]
            if item["source_field"] == "weakness" and item["source_index"] == 0
        )
        analysis["weaknesses"][0] = compound
        material["claim"] = compound
        material["atomic_claims"] = [{
            "claim": compound,
            "page_citations": [1],
            "citation_evidence": [{
                "page": 1,
                "excerpt": "Ana clearly loves Carlos deeply.",
            }],
        }]
        targets = claim_verification_targets(analysis)
        compound_target = next(
            target for target in targets if target["claim"] == compound
        )
        raw = {"claims": [{
            "claim_id": target["claim_id"],
            "classification": (
                "Partially supported" if target is compound_target else "Supported"
            ),
            "story_fact_classification": (
                "Partially supported"
                if target is compound_target
                else (
                    "Supported"
                    if target["story_fact_check_required"]
                    else "No concrete story fact"
                )
            ),
            "unsupported_story_facts": ([{
                "claim": "Ana kills Carlos in the finale",
                "kind": "event",
            }] if target is compound_target else []),
            "page_citations": [1],
            "citation_evidence": [{
                "page": 1,
                "excerpt": (
                    "Ana clearly loves Carlos deeply."
                    if target is compound_target
                    else f"Physical page evidence confirms {target['claim']}"
                ),
            }],
        } for target in targets]}
        with self.assertRaisesRegex(ValueError, "central story fact"):
            _validate_claim_verification(raw, targets)

    def test_reader_specific_story_evidence_is_required(self):
        concept = complete_analysis()["reader_reports"]["concept"]
        self.assertEqual(
            _validate_reader_report("concept", copy.deepcopy(concept))["reader"],
            "concept",
        )
        for metric, field in (
            ("hook_clarity", "one_sentence_pitch"),
            ("genre_execution", "genre"),
            ("genre_execution", "obligatory_scenes_present"),
            ("genre_execution", "obligatory_scenes_missing"),
            ("controlling_idea", "stated_controlling_idea"),
            ("premise_line", "four_clause_premise"),
        ):
            incomplete = copy.deepcopy(concept)
            del incomplete["sub_scores"][metric][field]
            with self.subTest(metric=metric, field=field):
                with self.assertRaisesRegex(ValueError, "missing required field"):
                    _validate_reader_report("concept", incomplete)

    def test_empty_missing_obligations_list_is_a_locked_claim(self):
        targets = claim_verification_targets(complete_analysis())
        target = next(
            item for item in targets
            if item["claim_id"]
            == "reader.concept.genre_execution.obligatory_scenes_missing"
        )
        self.assertIn("no obligatory scenes are missing", target["claim"])
        self.assertEqual(target["evidence_scope"], "evaluative")
        self.assertFalse(target["story_fact_check_required"])

    def test_global_absence_and_evaluative_claims_do_not_fake_lexical_support(self):
        targets = claim_verification_targets(complete_analysis())
        examples = [
            next(item for item in targets if item["claim_id"] == claim_id)
            for claim_id in ("character.protagonist", "theme.0")
        ]
        self.assertEqual(
            [item["evidence_scope"] for item in examples],
            ["global", "evaluative"],
        )
        selected = []
        for index in range(10):
            target = copy.deepcopy(examples[index % 2])
            target["claim_id"] = f"scope.{index}"
            selected.append(target)
        raw = {"claims": [{
            "claim_id": target["claim_id"],
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
                "excerpt": "A family confronts a buried secret together.",
            }],
        } for target in selected]}

        verified = _validate_claim_verification(raw, selected)
        self.assertEqual(verified["factual_claim_count"], 5)
        self.assertEqual(verified["factual_support_rate"], 1.0)

    def test_reader_verdict_cannot_hide_a_fabricated_central_story_fact(self):
        analysis = complete_analysis()
        analysis["reader_reports"]["structure"]["one_sentence_verdict"] = (
            "A dragon murders Lucía in the finale, proving the ending works."
        )
        target = next(
            item for item in claim_verification_targets(analysis)
            if item["claim_id"] == "reader.structure.one_sentence_verdict"
        )
        self.assertEqual(target["claim_type"], "mixed")
        self.assertEqual(target["evidence_scope"], "global")
        self.assertTrue(target["story_fact_check_required"])

        target_set = [target]
        for index in range(9):
            filler = copy.deepcopy(target)
            filler.update({
                "claim_id": f"evaluative.filler.{index}",
                "claim": f"Creative judgment {index}",
                "claim_type": "evaluative",
                "story_fact_check_required": False,
                "evidence_scope": "evaluative",
            })
            target_set.append(filler)
        with self.assertRaisesRegex(ValueError, "denied its factual content"):
            _validate_claim_verification({"claims": [{
                "claim_id": item["claim_id"],
                "classification": "Supported",
                "story_fact_classification": "No concrete story fact",
                "unsupported_story_facts": [],
                "page_citations": [1],
                "citation_evidence": [{
                    "page": 1,
                    "excerpt": "A family confronts a buried secret together.",
                }],
            } for item in target_set]}, target_set)

    def test_fabricated_goosebumps_event_and_invalid_page_cannot_escape(self):
        analysis = complete_analysis()
        emotional = analysis["reader_reports"]["emotional_resonance"]
        emotional["goosebumps_scenes"] = [{
            "page": 999,
            "description": "A nonexistent dragon kills the protagonist.",
            "why_it_works": "The dragon kills the protagonist without warning.",
            "page_citations": [999],
            "citation_evidence": [{
                "page": 999,
                "excerpt": "The dragon kills the protagonist without warning.",
            }],
        }]
        _validate_reader_report("emotional_resonance", emotional)
        citation_quality = ingest_v9.validate_analysis_citations(
            {"reader_reports": {"emotional_resonance": emotional}},
            [{"page": 1, "status": "ok"}],
            1,
            "[PAGE 1]\nA family confronts a buried secret together.",
        )
        self.assertEqual(citation_quality["status"], "needs_review")
        self.assertEqual(
            citation_quality["invalid_citations"][0]["reason"],
            "outside_physical_page_range",
        )

        target = next(
            item for item in claim_verification_targets(analysis)
            if item["claim_id"].endswith("goosebumps_scenes.0.description")
        )
        self.assertIn("nonexistent dragon", target["claim"])
        target_set = [target]
        for index in range(9):
            filler = copy.deepcopy(target)
            filler.update({
                "claim_id": f"evaluative.filler.{index}",
                "claim": f"Creative judgment {index}",
                "claim_type": "evaluative",
                "story_fact_check_required": False,
                "evidence_scope": "evaluative",
            })
            target_set.append(filler)
        with self.assertRaisesRegex(ValueError, "factual screenplay claim"):
            _validate_claim_verification({"claims": [{
                "claim_id": item["claim_id"],
                "classification": (
                    "Contradicted" if item is target else "Supported"
                ),
                "story_fact_classification": (
                    "Contradicted"
                    if item is target
                    else "No concrete story fact"
                ),
                "unsupported_story_facts": [],
                "page_citations": [1],
                "citation_evidence": [{
                    "page": 1,
                    "excerpt": "A family confronts a buried secret together.",
                }],
            } for item in target_set]}, target_set)

    def test_previous_prompt_contract_keeps_its_original_claim_target_shape(self):
        targets = claim_verification_targets(
            complete_analysis(),
            prompt_contract_version=PREVIOUS_PROMPT_CONTRACT_VERSION,
        )
        self.assertNotIn("evidence_scope", targets[0])
        self.assertTrue(any(
            target["claim_id"] == "reader.craft_scene.bmoc_failure_scan.craft_warning"
            for target in targets
        ))

    def test_evidence_scope_contract_survives_a_future_prompt_version_bump(self):
        august_contract = PROMPT_CONTRACT_VERSION
        future_contract = "v9-archaeology-prompts-2026-09-01"
        with patch.object(
            trust_manifest_module,
            "PROMPT_CONTRACT_VERSION",
            future_contract,
        ), patch.object(
            trust_manifest_module,
            "SUPPORTED_PROMPT_CONTRACT_VERSIONS",
            {
                *trust_manifest_module.SUPPORTED_PROMPT_CONTRACT_VERSIONS,
                future_contract,
            },
        ):
            target = claim_verification_targets(
                complete_analysis(),
                prompt_contract_version=august_contract,
            )[0]
            self.assertIn("evidence_scope", target)
            self.assertIn(
                "evidence_scope",
                claim_verification_target_fields(august_contract),
            )
            self.assertIn(
                "evidence_scope",
                claim_verification_target_fields(future_contract),
            )

    def test_internal_reader_schema_state_is_not_a_screenplay_fact_claim(self):
        ids = {
            target["claim_id"]
            for target in claim_verification_targets(complete_analysis())
        }
        self.assertFalse(any(
            claim_id.startswith("reader.craft_scene.bmoc_failure_scan")
            for claim_id in ids
        ))
        self.assertNotIn(
            "reader.character.arc_delivery.arc_type",
            ids,
        )
        self.assertIn(
            "reader.concept.genre_execution.obligatory_scenes_missing",
            ids,
        )

    def test_manifest_is_complete_deterministic_and_valid(self):
        first = trusted_raw()
        second = trusted_raw()

        self.assertEqual(first["trust_manifest"], second["trust_manifest"])
        self.assertEqual(first["trust_manifest_version"], TRUST_MANIFEST_VERSION)
        self.assertEqual(first["analysis_schema_version"], ANALYSIS_SCHEMA_VERSION)
        self.assertEqual(first["prompt_version"], PROMPT_CONTRACT_VERSION)
        self.assertEqual(first["scoring_code_version"], SCORING_CODE_VERSION)
        self.assertEqual(first["analysis_provider"], "anthropic")
        self.assertEqual(first["analysis_model"], MODEL_ID)
        self.assertEqual(
            first["trust_manifest"]["source"]["content_sha256"],
            CONTENT_HASH,
        )
        self.assertEqual(
            first["trust_manifest"]["models"]["response_ids"],
            [
                f"msg_{index}"
                for index in range(
                    1, len(first["usage"]["calls"]) + 1
                )
            ],
        )
        self.assertEqual(
            first["trust_manifest"]["score_lineage"]["final_verdict"],
            "CONSIDER",
        )
        self.assertEqual(
            first["trust_manifest"]["readers"][
                "reliability_contract_version"
            ],
            READER_RELIABILITY_CONTRACT_VERSION,
        )
        self.assertTrue(
            first["trust_manifest"]["readers"]["publication_ready"]
        )
        self.assertEqual(
            first["trust_manifest"]["calibration"]["prompt_sha256"],
            "cd" * 32,
        )
        self.assertNotIn("prompt", first["trust_manifest"]["calibration"])
        validate_permanent_analysis(first)

    def test_previous_prompt_contract_remains_valid_for_its_sealed_calls(self):
        raw = raw_analysis()
        raw["usage"]["failed_calls"] = [failed_call_provenance(
            MODEL_ID,
            "synthesis",
            "sonnet",
        )]
        historical = attach_trust_manifest(
            raw,
            selection_request="sonnet",
            pipeline_model_tier="sonnet",
            effective_model_tier="sonnet",
            model_ids=TEST_MODEL_IDS,
            origin_kind="daemon_queue",
            origin_id="historical-prompt-job",
        )
        historical["prompt_version"] = PREVIOUS_PROMPT_CONTRACT_VERSION
        historical["analysis_schema_version"] = (
            PREVIOUS_ANALYSIS_SCHEMA_VERSION
        )
        manifest = historical["trust_manifest"]
        manifest["engine"]["prompt_contract_version"] = (
            PREVIOUS_PROMPT_CONTRACT_VERSION
        )
        manifest["engine"]["analysis_schema_version"] = (
            PREVIOUS_ANALYSIS_SCHEMA_VERSION
        )
        for call in historical["usage"]["calls"]:
            call["prompt_contract_version"] = PREVIOUS_PROMPT_CONTRACT_VERSION
        for call in historical["usage"]["failed_calls"]:
            call["prompt_contract_version"] = PREVIOUS_PROMPT_CONTRACT_VERSION
        for call in manifest["models"]["calls"]:
            call["prompt_contract_version"] = PREVIOUS_PROMPT_CONTRACT_VERSION
        for call in manifest["models"]["failed_calls"]:
            call["prompt_contract_version"] = PREVIOUS_PROMPT_CONTRACT_VERSION
        analysis = historical["analysis"]
        analysis_for_hash = copy.deepcopy(analysis)
        analysis_for_hash.pop("_citation_quality", None)
        analysis_for_hash.pop("_claim_verification", None)
        targets = claim_verification_targets(
            analysis_for_hash,
            prompt_contract_version=PREVIOUS_PROMPT_CONTRACT_VERSION,
        )
        target_fields = claim_verification_target_fields(
            PREVIOUS_PROMPT_CONTRACT_VERSION
        )
        factual_count = sum(
            target["story_fact_check_required"] for target in targets
        )
        response_ids = [
            call["response_id"]
            for call in historical["usage"]["calls"]
            if call["stage"] == "claim_verification"
        ]
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
            "locked_targets_sha256": ingest_v9._canonical_json_hash([{
                key: target[key] for key in target_fields
            } for target in targets]),
            "analysis_sha256": ingest_v9._canonical_json_hash(
                analysis_for_hash
            ),
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
            "response_ids": response_ids,
            "batch_count": len(response_ids),
            "batch_size_limit": CLAIM_VERIFICATION_BATCH_SIZE,
            "batch_target_sha256": [
                ingest_v9._canonical_json_hash([
                    target["claim_id"] for target in targets[
                        index:index + CLAIM_VERIFICATION_BATCH_SIZE
                    ]
                ])
                for index in range(
                    0, len(targets), CLAIM_VERIFICATION_BATCH_SIZE
                )
            ],
        }
        source = q2_parsed_source()
        attach_verified_citation_quality(
            analysis,
            historical["metadata"],
            source["page_count"],
            source["text"],
        )
        manifest["analysis_payload_sha256"] = hashlib.sha256(json.dumps(
            analysis,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")).hexdigest()
        manifest["claim_verification"] = _claim_verification_provenance(
            analysis=analysis,
            models=manifest["models"],
            effective_model_tier="sonnet",
            prompt_contract_version=PREVIOUS_PROMPT_CONTRACT_VERSION,
        )
        manifest["evidence"] = _evidence_provenance(
            metadata=historical["metadata"],
            analysis=analysis,
            page_count=source["page_count"],
            character_count=historical["metadata"]["character_count"],
            effective_model_tier="sonnet",
            model_ids=TEST_MODEL_IDS,
        )
        manifest.pop("integrity_sha256")
        manifest["integrity_sha256"] = hashlib.sha256(
            json.dumps(
                manifest,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            ).encode("utf-8")
        ).hexdigest()

        validate_permanent_analysis(historical)

    def test_schema_prompt_and_scoring_contract_versions_cannot_be_crossed(self):
        cases = (
            ("analysis_schema_version", PREVIOUS_ANALYSIS_SCHEMA_VERSION),
            ("prompt_version", PREVIOUS_PROMPT_CONTRACT_VERSION),
            ("scoring_code_version", PREVIOUS_SCORING_CODE_VERSION),
        )
        for root_field, stale_version in cases:
            with self.subTest(root_field=root_field):
                raw = trusted_raw()
                raw[root_field] = stale_version
                engine_field = (
                    "analysis_schema_version"
                    if root_field == "analysis_schema_version"
                    else (
                        "prompt_contract_version"
                        if root_field == "prompt_version"
                        else "scoring_code_version"
                    )
                )
                manifest = raw["trust_manifest"]
                manifest["engine"][engine_field] = stale_version
                manifest.pop("integrity_sha256")
                manifest["integrity_sha256"] = hashlib.sha256(
                    json.dumps(
                        manifest,
                        ensure_ascii=False,
                        separators=(",", ":"),
                        sort_keys=True,
                    ).encode("utf-8")
                ).hexdigest()

                with self.assertRaisesRegex(
                    ValueError,
                    "manifest and engine contract versions are incompatible",
                ):
                    validate_permanent_analysis(raw)

    def test_current_contract_cannot_downgrade_to_skip_claim_verification(self):
        raw = trusted_raw()
        raw["analysis"]["themes"][0] = (
            "Lucía murders a nonexistent dragon in the finale."
        )
        manifest = raw["trust_manifest"]
        manifest["analysis_payload_sha256"] = hashlib.sha256(
            json.dumps(
                raw["analysis"],
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            ).encode("utf-8")
        ).hexdigest()
        manifest["manifest_version"] = Q4_TRUST_MANIFEST_VERSION
        manifest.pop("claim_verification")
        manifest["evidence"].pop("scene_count")
        raw["trust_manifest_version"] = Q4_TRUST_MANIFEST_VERSION
        manifest.pop("integrity_sha256")
        manifest["integrity_sha256"] = hashlib.sha256(
            json.dumps(
                manifest,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            ).encode("utf-8")
        ).hexdigest()

        with self.assertRaisesRegex(
            ValueError,
            "manifest and engine contract versions are incompatible",
        ):
            validate_permanent_analysis(raw)

    def test_current_manifest_rejects_missing_call_specific_provenance(self):
        raw = raw_analysis()
        del raw["usage"]["calls"][0]["prompt_sha256"]

        with self.assertRaisesRegex(ValueError, "prompt_sha256"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_q1_manifest_remains_readable_after_q2_upgrade(self):
        legacy = use_legacy_engine_contract(trusted_raw())
        manifest = legacy["trust_manifest"]
        manifest.pop("evidence")
        manifest["readers"].pop("reliability_contract_version")
        manifest["readers"].pop("publication_ready")
        manifest["manifest_version"] = LEGACY_TRUST_MANIFEST_VERSION
        manifest.pop("integrity_sha256")
        manifest["integrity_sha256"] = hashlib.sha256(
            json.dumps(
                manifest,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            ).encode("utf-8")
        ).hexdigest()
        legacy["trust_manifest_version"] = LEGACY_TRUST_MANIFEST_VERSION

        validate_permanent_analysis(legacy)

    def test_q2_manifest_remains_readable_after_q3_upgrade(self):
        prior = use_legacy_engine_contract(trusted_raw())
        manifest = prior["trust_manifest"]
        manifest["readers"].pop("reliability_contract_version")
        manifest["readers"].pop("publication_ready")
        manifest["manifest_version"] = Q2_TRUST_MANIFEST_VERSION
        manifest["evidence"].pop("scene_count")
        manifest.pop("integrity_sha256")
        manifest["integrity_sha256"] = hashlib.sha256(
            json.dumps(
                manifest,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            ).encode("utf-8")
        ).hexdigest()
        prior["trust_manifest_version"] = Q2_TRUST_MANIFEST_VERSION

        validate_permanent_analysis(prior)

    def test_q3_manifest_remains_readable_after_q5_upgrade(self):
        prior = use_legacy_engine_contract(trusted_raw())
        manifest = prior["trust_manifest"]
        manifest["manifest_version"] = Q3_TRUST_MANIFEST_VERSION
        manifest["evidence"].pop("scene_count")
        manifest.pop("integrity_sha256")
        manifest["integrity_sha256"] = hashlib.sha256(
            json.dumps(
                manifest,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            ).encode("utf-8")
        ).hexdigest()
        prior["trust_manifest_version"] = Q3_TRUST_MANIFEST_VERSION

        validate_permanent_analysis(prior)

    def test_q4_manifest_without_per_call_usage_remains_readable(self):
        prior = use_legacy_engine_contract(trusted_raw())
        for call in prior["usage"]["calls"]:
            call.pop("usage")
        manifest = prior["trust_manifest"]
        for call in manifest["models"]["calls"]:
            call.pop("usage")
        manifest["manifest_version"] = Q4_TRUST_MANIFEST_VERSION
        manifest["evidence"].pop("scene_count")
        manifest.pop("integrity_sha256")
        manifest["integrity_sha256"] = hashlib.sha256(
            json.dumps(
                manifest,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            ).encode("utf-8")
        ).hexdigest()
        prior["trust_manifest_version"] = Q4_TRUST_MANIFEST_VERSION

        validate_permanent_analysis(prior)

    def test_q4_manifest_keeps_its_historical_pre_adjustment_verdict(self):
        prior = use_legacy_engine_contract(trusted_raw())
        prior["analysis"]["verdict_before_adjustments"] = "FILM_NOW"
        for run in prior["analysis"]["_boundary_reruns"]["runs"]:
            run["analysis_evidence"]["verdict_before_adjustments"] = "FILM_NOW"

        manifest = prior["trust_manifest"]
        manifest["manifest_version"] = Q4_TRUST_MANIFEST_VERSION
        manifest["evidence"].pop("scene_count")
        manifest["score_lineage"]["verdict_before_adjustments"] = "FILM_NOW"
        for sealed_run, raw_run in zip(
            manifest["score_lineage"]["boundary_reruns"]["runs"],
            prior["analysis"]["_boundary_reruns"]["runs"],
        ):
            sealed_run["analysis_evidence_sha256"] = hashlib.sha256(
                json.dumps(
                    raw_run["analysis_evidence"],
                    ensure_ascii=False,
                    separators=(",", ":"),
                    sort_keys=True,
                ).encode("utf-8")
            ).hexdigest()
        manifest["analysis_payload_sha256"] = hashlib.sha256(
            json.dumps(
                prior["analysis"],
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            ).encode("utf-8")
        ).hexdigest()
        manifest.pop("integrity_sha256")
        manifest["integrity_sha256"] = hashlib.sha256(
            json.dumps(
                manifest,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            ).encode("utf-8")
        ).hexdigest()
        prior["trust_manifest_version"] = Q4_TRUST_MANIFEST_VERSION

        validate_permanent_analysis(prior)

    def test_q5_manifest_seals_exact_calibration_profile_version(self):
        raw = raw_analysis()
        raw["calibration_profile"].update({
            "profile_version_id": "candidate-1",
            "source_assessment_set_sha256": "ef" * 32,
            "compiler_model_id": "claude-opus-4-7",
        })

        trusted = attach_trust_manifest(
            raw,
            selection_request="sonnet",
            pipeline_model_tier="sonnet",
            effective_model_tier="sonnet",
            model_ids=TEST_MODEL_IDS,
            origin_kind="daemon_queue",
            origin_id="queue-job-q5",
        )

        calibration = trusted["trust_manifest"]["calibration"]
        self.assertEqual(calibration["profile_version_id"], "candidate-1")
        self.assertEqual(
            calibration["source_assessment_set_sha256"],
            "ef" * 32,
        )
        self.assertEqual(
            calibration["compiler_model_id"],
            "claude-opus-4-7",
        )
        validate_permanent_analysis(trusted)

    def test_page_evidence_tampering_is_rejected(self):
        raw = trusted_raw()
        raw["metadata"]["page_diagnostics"][0]["words"] += 1

        with self.assertRaisesRegex(ValueError, "word count|integrity"):
            validate_permanent_analysis(raw)

    def test_invalid_reader_citation_cannot_receive_a_manifest(self):
        raw = raw_analysis()
        metric = raw["analysis"]["reader_reports"]["structure"]["sub_scores"]["first_ten_pages"]
        metric["page_citations"] = [999]

        with self.assertRaisesRegex(ValueError, "citation evidence"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_changed_excerpt_cannot_reuse_sealed_citation_evidence(self):
        raw = raw_analysis()
        metric = raw["analysis"]["reader_reports"]["structure"]["sub_scores"]["first_ten_pages"]
        metric["citation_evidence"][0]["excerpt"] = "A fabricated event appears here"

        with self.assertRaisesRegex(ValueError, "citation excerpts"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_auto_selection_is_preserved_separately_from_effective_model(self):
        raw = attach_trust_manifest(
            raw_analysis(),
            selection_request="auto",
            pipeline_model_tier="sonnet",
            effective_model_tier="sonnet",
            model_ids=TEST_MODEL_IDS,
            origin_kind="daemon_queue",
            origin_id="queue-job-1",
        )

        models = raw["trust_manifest"]["models"]
        self.assertEqual(models["selection_request"], "auto")
        self.assertEqual(models["pipeline_model_tier"], "sonnet")
        self.assertEqual(models["effective_model_id"], MODEL_ID)

    def test_requested_model_ids_come_from_every_actual_call(self):
        raw = raw_analysis()
        extra_model = "claude-opus-4-7"
        usage = complete_usage()
        usage["failed_calls"].append(failed_call_provenance(
            extra_model, "synthesis", "opus",
        ))
        raw["usage"] = usage
        trusted = attach_trust_manifest(
            raw,
            selection_request="sonnet",
            pipeline_model_tier="sonnet",
            effective_model_tier="sonnet",
            model_ids={**TEST_MODEL_IDS, "opus": extra_model},
            origin_kind="daemon_queue",
            origin_id="queue-job-1",
        )

        self.assertEqual(
            trusted["trust_manifest"]["models"]["requested_model_ids"],
            sorted(["claude-haiku-4-5-20251001", extra_model, MODEL_ID]),
        )

    def test_long_source_genre_detection_is_sealed_to_sonnet(self):
        raw = raw_analysis()
        candidate_ids = {**TEST_MODEL_IDS, "sonnet": "claude-sonnet-5"}
        raw["analysis_model"] = "claude-sonnet-5"
        raw["metadata"]["character_count"] = 500_000
        raw["analysis"]["_context_policy"] = build_context_policy_for_length(
            500_000,
            "sonnet",
            model_ids=candidate_ids,
        )
        refresh_claim_verification(raw["analysis"])
        for call in raw["usage"]["calls"]:
            call["requested_model"] = "claude-sonnet-5"
            call["returned_model"] = "claude-sonnet-5"
        raw["usage"]["by_model"]["claude-sonnet-5"] = raw["usage"][
            "by_model"
        ].pop(MODEL_ID)
        raw["usage"]["by_model"]["claude-sonnet-5"]["call_count"] = len(
            raw["usage"]["calls"]
        )
        raw["usage"]["by_model"].pop("claude-haiku-4-5-20251001")

        trusted = attach_trust_manifest(
            raw,
            selection_request="sonnet",
            pipeline_model_tier="sonnet",
            effective_model_tier="sonnet",
            model_ids=candidate_ids,
            origin_kind="daemon_queue",
            origin_id="queue-job-1",
        )

        self.assertEqual(
            trusted["trust_manifest"]["evidence"]["context"]["genre_model"],
            "sonnet",
        )

    def test_paid_but_unusable_synthesis_response_is_sealed_not_selected(self):
        raw = raw_analysis()
        raw["usage"]["call_count"] += 1
        raw["usage"]["by_model"][MODEL_ID]["call_count"] += 1
        raw["usage"]["calls"].append({
            "response_id": "msg_discarded_synthesis",
            "requested_model": MODEL_ID,
            "returned_model": MODEL_ID,
            "stop_reason": "end_turn",
            "successful_attempt": 1,
            "retry_history": [{
                "attempt": 1,
                "outcome": "success",
                "response_id": "msg_discarded_synthesis",
            }],
            "stage": "synthesis",
            "pipeline_pass": "sonnet",
            "boundary_run": 1,
            "reader_name": None,
            "disposition": "discarded_unusable",
            **call_provenance(
                "msg_discarded_synthesis",
                "synthesis",
                "discarded_unusable",
            ),
            "usage": {
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
            },
        })

        trusted = attach_trust_manifest(
            raw,
            selection_request="sonnet",
            pipeline_model_tier="sonnet",
            effective_model_tier="sonnet",
            model_ids=TEST_MODEL_IDS,
            origin_kind="daemon_queue",
            origin_id="queue-job-1",
        )

        discarded = trusted["trust_manifest"]["models"]["calls"][-1]
        self.assertEqual(discarded["disposition"], "discarded_unusable")
        self.assertNotIn(
            discarded["response_id"],
            trusted["trust_manifest"]["score_lineage"]["boundary_reruns"][
                "runs"
            ][0]["response_ids"],
        )

    def test_reader_or_synthesis_returned_model_must_match_its_exact_pass(self):
        raw = raw_analysis()
        raw["usage"]["calls"][1]["returned_model"] = (
            "claude-haiku-4-5-20251001"
        )

        with self.assertRaisesRegex(ValueError, "wrong exact model"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_source_identity_tampering_is_rejected(self):
        raw = trusted_raw()
        raw["content_hash"] = "ef" * 32

        with self.assertRaisesRegex(ValueError, "content hash"):
            validate_permanent_analysis(raw)

    def test_parser_output_tampering_is_rejected(self):
        raw = trusted_raw()
        raw["metadata"]["word_count"] = 1

        with self.assertRaisesRegex(ValueError, "source provenance"):
            validate_permanent_analysis(raw)

    def test_score_lineage_tampering_is_rejected(self):
        raw = trusted_raw()
        raw["analysis"]["weighted_score_adjusted"] = 9.9

        with self.assertRaisesRegex(ValueError, "analysis payload"):
            validate_permanent_analysis(raw)

    def test_raw_score_verdict_must_be_code_derived_before_sealing(self):
        raw = raw_analysis()
        raw["analysis"]["verdict_before_adjustments"] = "PASS"

        with self.assertRaisesRegex(ValueError, "raw-score verdict"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_producer_facing_prose_tampering_is_rejected(self):
        for mutation in ("executive_summary", "strengths", "reader_strengths"):
            with self.subTest(mutation=mutation):
                raw = trusted_raw()
                if mutation == "executive_summary":
                    raw["analysis"]["executive_summary"] = "Altered summary"
                elif mutation == "strengths":
                    raw["analysis"]["strengths"] = ["Altered strength"]
                else:
                    raw["analysis"]["reader_reports"]["structure"][
                        "strengths"
                    ] = ["Altered reader prose"]

                with self.assertRaisesRegex(ValueError, "analysis payload"):
                    validate_permanent_analysis(raw)

    def test_gate_input_tampering_is_rejected(self):
        raw = trusted_raw()
        raw["analysis"]["false_positive_check"]["weighted_trap_score"] = 3.0

        with self.assertRaisesRegex(ValueError, "analysis payload"):
            validate_permanent_analysis(raw)

    def test_missing_boundary_history_is_rejected(self):
        raw = raw_analysis()
        raw["analysis"].pop("_boundary_reruns")

        with self.assertRaisesRegex(ValueError, "boundary"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_reader_completion_tampering_is_rejected(self):
        raw = trusted_raw()
        del raw["analysis"]["reader_reports"]["structure"]

        with self.assertRaisesRegex(ValueError, "analysis payload"):
            validate_permanent_analysis(raw)

    def test_q3_rejects_a_partial_reader_panel_before_sealing(self):
        raw = raw_analysis()
        analysis = raw["analysis"]
        analysis["reader_reports"].pop("emotional_resonance")
        analysis["pillar_scores"].pop("emotional_resonance")
        analysis["analysis_quality"] = {
            "status": "partial",
            "completed_readers": 4,
            "expected_readers": 5,
            "failed_readers": ["emotional_resonance"],
        }
        analysis["failed_reader_errors"] = {
            "emotional_resonance": "model call exhausted retries",
        }
        removed_call = next(
            call for call in raw["usage"]["calls"]
            if call["response_id"] == "msg_6"
        )
        raw["usage"]["calls"] = [
            call
            for call in raw["usage"]["calls"]
            if call["response_id"] != "msg_6"
        ]
        for field in (
            "input_tokens", "output_tokens", "cache_creation_input_tokens",
            "cache_read_input_tokens", "call_count", "actual_cost_microusd",
        ):
            raw["usage"][field] -= removed_call["usage"][field]
            raw["usage"]["by_model"][MODEL_ID][field] -= removed_call["usage"][field]
        for field in (
            "estimated_cost_nanousd", "rounding_variance_nanousd",
        ):
            raw["usage"][field] -= removed_call["usage"][field]
        raw["usage"]["actual_cost_usd"] = (
            raw["usage"]["actual_cost_microusd"] / 1_000_000
        )
        raw["usage"]["estimated_cost_usd"] = (
            raw["usage"]["estimated_cost_nanousd"] / 1_000_000_000
        )
        raw["usage"]["rounding_variance_usd"] = (
            raw["usage"]["rounding_variance_nanousd"] / 1_000_000_000
        )
        raw["actual_cost_microusd"] = raw["usage"]["actual_cost_microusd"]
        raw["actual_cost_usd"] = raw["usage"]["actual_cost_usd"]
        raw["usage"]["failed_calls"] = [failed_call_provenance(
            MODEL_ID,
            "reader",
            "sonnet",
            reader_name="emotional_resonance",
            attempts=2,
        )]
        analysis["_boundary_reruns"]["runs"][0]["response_ids"].remove("msg_6")
        refresh_boundary_evidence(analysis)
        attach_verified_citation_quality(
            analysis,
            raw["metadata"],
            raw["metadata"]["page_count"],
            q2_parsed_source()["text"],
        )

        with self.assertRaisesRegex(
            ValueError,
            "all five specialist readers",
        ):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_missing_reader_failure_detail_is_rejected(self):
        raw = raw_analysis()
        raw["analysis"]["analysis_quality"]["status"] = "partial"
        raw["analysis"]["analysis_quality"]["completed_readers"] = 4
        raw["analysis"]["analysis_quality"]["failed_readers"] = [
            "emotional_resonance"
        ]
        raw["analysis"]["reader_reports"].pop("emotional_resonance")
        raw["analysis"]["pillar_scores"].pop("emotional_resonance")

        with self.assertRaisesRegex(ValueError, "errors"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_weighted_score_must_match_reader_arithmetic(self):
        raw = raw_analysis()
        raw["analysis"]["weighted_score"] = 7.3

        with self.assertRaisesRegex(ValueError, "weighted score"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_boundary_math_is_recomputed_before_sealing(self):
        raw = raw_analysis()
        raw["analysis"]["_boundary_reruns"]["score_spread"] = 0.4

        with self.assertRaisesRegex(ValueError, "spread"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_boundary_run_evidence_is_recomputed_before_sealing(self):
        raw = raw_analysis()
        evidence = raw["analysis"]["_boundary_reruns"]["runs"][0][
            "analysis_evidence"
        ]
        evidence["weighted_score_adjusted"] = 9.0

        with self.assertRaisesRegex(ValueError, "adjusted score"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_manifest_hashes_boundary_evidence_instead_of_copying_reader_prose(self):
        raw = raw_analysis()
        marker = "PROSE-MUST-NOT-BE-DUPLICATED-" * 2_000
        raw["analysis"]["_boundary_reruns"]["runs"][0][
            "analysis_evidence"
        ]["reader_reports"]["structure"]["strengths"] = [marker]
        refresh_claim_verification(raw["analysis"])

        trusted = attach_trust_manifest(
            raw,
            selection_request="sonnet",
            pipeline_model_tier="sonnet",
            effective_model_tier="sonnet",
            model_ids=TEST_MODEL_IDS,
            origin_kind="daemon_queue",
            origin_id="queue-job-1",
        )

        manifest_json = json.dumps(trusted["trust_manifest"])
        self.assertNotIn(marker, manifest_json)
        run = trusted["trust_manifest"]["score_lineage"]["boundary_reruns"][
            "runs"
        ][0]
        self.assertRegex(run["analysis_evidence_sha256"], r"^[a-f0-9]{64}$")
        self.assertNotIn("analysis_evidence", run)

    def test_boundary_responses_must_match_their_run(self):
        raw = raw_analysis()
        raw["usage"]["calls"][0]["boundary_run"] = 2

        with self.assertRaisesRegex(ValueError, "wrong run"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_failed_attempts_are_bounded_and_sealed(self):
        raw = raw_analysis()
        raw["usage"]["failed_calls"] = [failed_call_provenance(
            MODEL_ID, "synthesis", "sonnet", attempts=2,
        )]

        trusted = attach_trust_manifest(
            raw,
            selection_request="sonnet",
            pipeline_model_tier="sonnet",
            effective_model_tier="sonnet",
            model_ids=TEST_MODEL_IDS,
            origin_kind="daemon_queue",
            origin_id="queue-job-1",
        )

        self.assertEqual(
            len(
                trusted["trust_manifest"]["models"]["failed_calls"][0][
                    "attempt_history"
                ]
            ),
            2,
        )

        excessive_transport = raw_analysis()
        excessive_transport["usage"]["failed_calls"] = [
            failed_call_provenance(
                MODEL_ID,
                "synthesis",
                "sonnet",
                attempts=3,
            )
        ]
        with self.assertRaisesRegex(ValueError, "permitted retry limit"):
            attach_trust_manifest(
                excessive_transport,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-excessive-transport-retry",
            )

        excessive_logical = raw_analysis()
        failed = failed_call_provenance(
            MODEL_ID,
            "synthesis",
            "sonnet",
        )
        failed.update({
            "logical_retry": 2,
            "attempt_number": 3,
            "total_retry_count": 2,
        })
        excessive_logical["usage"]["failed_calls"] = [failed]
        with self.assertRaisesRegex(ValueError, "permitted retry limit"):
            attach_trust_manifest(
                excessive_logical,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-excessive-logical-retry",
            )

        sparse = raw_analysis()
        sparse["usage"]["failed_calls"] = [{
            "requested_model": MODEL_ID,
            "stage": "synthesis",
            "pipeline_pass": "sonnet",
            "boundary_run": 1,
            "reader_name": None,
            "attempt_history": [{
                "attempt": 1,
                "outcome": "failed",
                "error_type": "Timeout",
            }],
        }]
        with self.assertRaisesRegex(ValueError, "lacks canonical provenance"):
            attach_trust_manifest(
                sparse,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_retry_histories_require_failure_identity_and_consistent_outcomes(self):
        raw = raw_analysis()
        call = raw["usage"]["calls"][0]
        call["successful_attempt"] = 2
        call["transport_attempt"] = 2
        call["transport_retry_count"] = 1
        call["retry_count"] = 1
        call["total_retry_count"] = 1
        call["retry_history"] = [
            {"attempt": 1, "outcome": "failed"},
            {
                "attempt": 2,
                "outcome": "success",
                "response_id": call["response_id"],
            },
        ]
        with self.assertRaisesRegex(ValueError, "failed attempt lacks error_type"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

        call["retry_history"][0]["error_type"] = "LlmPreCallRetryableError"
        call["retry_history"][1]["failure_state"] = "timeout"
        with self.assertRaisesRegex(ValueError, "success has failure-only fields"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

        raw = raw_analysis()
        failed = failed_call_provenance(MODEL_ID, "synthesis", "sonnet")
        failed["attempt_history"][0].pop("error_type")
        raw["usage"]["failed_calls"] = [failed]
        with self.assertRaisesRegex(ValueError, "failed attempt lacks error_type"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_discarded_sonnet_cold_read_without_evidence_is_sealed(self):
        raw = raw_analysis()
        usage = raw["usage"]
        usage["input_tokens"] += 1
        usage["output_tokens"] += 1
        usage["call_count"] += 1
        usage["by_model"][MODEL_ID]["input_tokens"] += 1
        usage["by_model"][MODEL_ID]["output_tokens"] += 1
        usage["by_model"][MODEL_ID]["call_count"] += 1
        usage["calls"].append({
            "response_id": "msg_discarded_sonnet_cold_read",
            "requested_model": MODEL_ID,
            "returned_model": MODEL_ID,
            "stop_reason": "end_turn",
            "successful_attempt": 1,
            "retry_history": [{
                "attempt": 1,
                "outcome": "success",
                "response_id": "msg_discarded_sonnet_cold_read",
            }],
            "stage": "triage",
            "pipeline_pass": "triage",
            "boundary_run": 1,
            "reader_name": None,
            "disposition": "discarded_unusable",
            **call_provenance(
                "msg_discarded_sonnet_cold_read",
                "triage",
                "discarded_unusable",
            ),
            "usage": {
                "input_tokens": 1,
                "output_tokens": 1,
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
            },
        })

        trusted = attach_trust_manifest(
            raw,
            selection_request="sonnet",
            pipeline_model_tier="sonnet",
            effective_model_tier="sonnet",
            model_ids=TEST_MODEL_IDS,
            origin_kind="daemon_queue",
            origin_id="queue-job-1",
        )

        self.assertIsNone(trusted["trust_manifest"]["cold_read"])
        self.assertEqual(
            trusted["trust_manifest"]["models"]["calls"][-1]["disposition"],
            "discarded_unusable",
        )

    def test_failed_sonnet_cold_read_without_evidence_is_sealed(self):
        raw = raw_analysis()
        raw["usage"]["failed_calls"].append(failed_call_provenance(
            MODEL_ID, "triage", "triage",
        ))

        trusted = attach_trust_manifest(
            raw,
            selection_request="sonnet",
            pipeline_model_tier="sonnet",
            effective_model_tier="sonnet",
            model_ids=TEST_MODEL_IDS,
            origin_kind="daemon_queue",
            origin_id="queue-job-1",
        )

        self.assertIsNone(trusted["trust_manifest"]["cold_read"])
        self.assertEqual(
            trusted["trust_manifest"]["models"]["failed_calls"][-1]["requested_model"],
            MODEL_ID,
        )

    def test_recovered_reader_failure_is_sealed_with_completed_evidence(self):
        raw = raw_analysis()
        raw["usage"]["failed_calls"] = [failed_call_provenance(
            MODEL_ID, "reader", "sonnet", reader_name="structure",
        )]

        trusted = attach_trust_manifest(
            raw,
            selection_request="sonnet",
            pipeline_model_tier="sonnet",
            effective_model_tier="sonnet",
            model_ids=TEST_MODEL_IDS,
            origin_kind="daemon_queue",
            origin_id="queue-job-1",
        )

        self.assertEqual(
            trusted["trust_manifest"]["models"]["failed_calls"][0][
                "reader_name"
            ],
            "structure",
        )
        self.assertEqual(
            trusted["trust_manifest"]["readers"]["quality_status"],
            "complete",
        )

    def test_manifest_telemetry_is_schema_closed(self):
        raw = raw_analysis()
        marker = "SYNTHETIC-SECRET-MARKER"
        usage = raw["usage"]
        first_model = next(iter(usage["by_model"]))
        usage["by_model"][first_model]["unexpected_private_payload"] = marker
        usage["calls"][0]["retry_history"][0][
            "unexpected_private_payload"
        ] = marker
        transformed = next(
            call for call in usage["calls"]
            if call["transformation_evidence"]
        )
        transformed["transformation_evidence"][0][
            "unexpected_private_payload"
        ] = marker
        transformed["transformation_evidence"][0]["before"] = {
            "private": marker,
        }

        failed = failed_call_provenance(
            MODEL_ID,
            "reader",
            "sonnet",
            reader_name="structure",
        )
        failed["unexpected_private_payload"] = marker
        failed["attempt_history"][0]["unexpected_private_payload"] = marker
        failed["usage"]["unexpected_private_payload"] = marker
        failed["transformations"] = ["synthetic_normalization"]
        failed["transformation_evidence"] = [{
            "name": "synthetic_normalization",
            "changed": True,
            "before": {"private": marker},
            "after": {"private": "removed"},
            "unexpected_private_payload": marker,
        }]
        release = {
            "git_sha": "a" * 40,
            "source_clean": True,
            "catalog_sha256": "b" * 64,
            "pricing_sha256": runtime_pricing_sha256(),
            "build_timestamp": "2026-08-27T12:00:00Z",
            "deployment_config_sha256": "c" * 64,
            "cloud_run_revision": "llmproxycandidate-00001-abc",
            "inference_geo": "global",
        }
        failed["release"] = {**release, "unexpected_private_payload": marker}
        failed["expected_release"] = {
            **release,
            "unexpected_private_payload": marker,
        }
        failed["budget_check"] = {
            "requested_model": MODEL_ID,
            "stage": "reader",
            "logical_retry": 0,
            "decision": "settled_failure",
            "request_content_bytes": 100,
            "request_envelope_overhead_bytes": 20,
            "request_bytes_upper_bound": 120,
            "input_tokens_upper_bound": 4_216,
            "output_tokens_upper_bound": 500,
            "request_ceiling_microusd": 1_000,
            "request_ceiling_usd": 0.001,
            "spent_before_microusd": 0,
            "spent_before_usd": 0.0,
            "reserved_before_microusd": 0,
            "reserved_before_usd": 0.0,
            "settled_cost_microusd": 0,
            "settled_cost_usd": 0.0,
            "spent_after_microusd": 0,
            "spent_after_usd": 0.0,
            "reserved_after_microusd": 0,
            "reserved_after_usd": 0.0,
            "platform_recheck": {"private": marker},
            "unexpected_private_payload": marker,
        }
        usage["failed_calls"] = [failed]

        failed["warnings"] = [{"unexpected_private_payload": marker}]
        with self.assertRaisesRegex(ValueError, "warnings"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["warnings"] = []
        failed["transformations"] = [{"unexpected_private_payload": marker}]
        with self.assertRaisesRegex(ValueError, "transformations"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["transformations"] = ["synthetic_normalization"]
        usage["finish_reason"] = {"unexpected_private_payload": marker}
        with self.assertRaisesRegex(ValueError, "finish_reason"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        usage["finish_reason"] = "end_turn"
        usage["calls"][0]["stop_reason"] = marker
        with self.assertRaisesRegex(ValueError, "stop_reason"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        usage["calls"][0]["stop_reason"] = "tool_use"
        usage["calls"][0]["retry_history"][0]["error_type"] = {
            "unexpected_private_payload": marker,
        }
        with self.assertRaisesRegex(ValueError, "error_type"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        usage["calls"][0]["retry_history"][0].pop("error_type")
        failed["attempt_history"][0]["error_type"] = {
            "unexpected_private_payload": marker,
        }
        with self.assertRaisesRegex(ValueError, "error_type"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["attempt_history"][0]["error_type"] = "Timeout"
        failed["transformation_evidence"][0]["changed"] = {
            "unexpected_private_payload": marker,
        }
        with self.assertRaisesRegex(ValueError, "transformation_evidence"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["transformation_evidence"][0]["changed"] = True
        failed["transformation_evidence"][0]["changed"] = False
        with self.assertRaisesRegex(ValueError, "changed flag contradicts"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["transformation_evidence"][0]["changed"] = True
        failed["budget_check"]["request_ceiling_usd"] = 99.0
        with self.assertRaisesRegex(ValueError, "cost mirrors"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["budget_check"]["request_ceiling_usd"] = 0.001
        failed["budget_check"]["requested_model"] = HAIKU_MODEL_ID
        with self.assertRaisesRegex(ValueError, "budget receipt does not match"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["budget_check"]["requested_model"] = MODEL_ID
        for field, value in (("stage", "synthesis"), ("logical_retry", 1)):
            original = failed["budget_check"][field]
            failed["budget_check"][field] = value
            with self.subTest(budget_lineage_field=field):
                with self.assertRaisesRegex(ValueError, "budget receipt does not match"):
                    attach_trust_manifest(
                        raw,
                        selection_request="sonnet",
                        pipeline_model_tier="sonnet",
                        effective_model_tier="sonnet",
                        model_ids=TEST_MODEL_IDS,
                        origin_kind="daemon_queue",
                        origin_id="queue-job-1",
                    )
            failed["budget_check"][field] = original
        failed["budget_check"]["request_bytes_upper_bound"] = 121
        with self.assertRaisesRegex(ValueError, "request byte accounting"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["budget_check"]["request_bytes_upper_bound"] = 120
        failed["budget_check"]["spent_after_microusd"] = 1
        failed["budget_check"]["spent_after_usd"] = 0.000001
        with self.assertRaisesRegex(ValueError, "spend transition"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["budget_check"]["spent_after_microusd"] = 0
        failed["budget_check"]["spent_after_usd"] = 0.0
        failed["budget_check"]["decision"] = (
            "settled_failure_exceeds_preflight_ceiling"
        )
        failed["budget_check"]["preflight_ceiling_exceeded"] = False
        with self.assertRaisesRegex(ValueError, "settlement decision contradicts"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["budget_check"]["decision"] = "settled_failure"
        failed["budget_check"].pop("preflight_ceiling_exceeded")
        failed["started_at"] = "2026-08-27T12:00:02Z"
        with self.assertRaisesRegex(ValueError, "completed before it started"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["started_at"] = "2026-08-27T12:00:00Z"
        failed["stop_reason"] = "max_tokens"
        with self.assertRaisesRegex(ValueError, "truncation contradicts"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["stop_reason"] = None
        failed["response_id"] = "msg_unlinked"
        with self.assertRaisesRegex(ValueError, "response_id does not match"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["response_id"] = None
        failed["attempt_history"][-1]["response_id"] = "msg_terminal"
        with self.assertRaisesRegex(ValueError, "response_id does not match"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["attempt_history"][-1].pop("response_id")
        failed["returned_model"] = HAIKU_MODEL_ID
        with self.assertRaisesRegex(ValueError, "returned model and failure state"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["returned_model"] = MODEL_ID
        failed["failure_state"] = "model_provenance_mismatch"
        with self.assertRaisesRegex(ValueError, "returned model and failure state"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["returned_model"] = None
        failed["failure_state"] = "Timeout"
        failed["usage"]["actual_cost_microusd"] = 1
        with self.assertRaisesRegex(ValueError, "cost evidence does not reconcile"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["usage"]["actual_cost_microusd"] = 0
        failed["independent_cost_microusd"] = 0
        failed["independent_cost_usd"] = 0.0
        failed["cost_variance_microusd"] = 1
        with self.assertRaisesRegex(ValueError, "cost variance does not reconcile"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["independent_cost_microusd"] = None
        failed["independent_cost_usd"] = None
        failed["cost_variance_microusd"] = None
        failed["usage"]["actual_cost_microusd"] = 1
        failed["charged_cost_microusd"] = 1
        failed["charged_cost_usd"] = 0.000001
        failed["cap_cost_microusd"] = 1
        failed["cap_cost_usd"] = 0.000001
        failed["budget_check"]["settled_cost_microusd"] = 1
        failed["budget_check"]["settled_cost_usd"] = 0.000001
        failed["budget_check"]["spent_after_microusd"] = 1
        failed["budget_check"]["spent_after_usd"] = 0.000001
        with self.assertRaisesRegex(ValueError, "failed per-call totals"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["usage"]["actual_cost_microusd"] = 0
        failed["charged_cost_microusd"] = 0
        failed["charged_cost_usd"] = 0.0
        failed["cap_cost_microusd"] = 0
        failed["cap_cost_usd"] = 0.0
        failed["budget_check"]["settled_cost_microusd"] = 0
        failed["budget_check"]["settled_cost_usd"] = 0.0
        failed["budget_check"]["spent_after_microusd"] = 0
        failed["budget_check"]["spent_after_usd"] = 0.0
        failed["transport_attempts"] = 3
        failed["transport_retry_count"] = 2
        failed["retry_count"] = 2
        failed["total_retry_count"] = 2
        with self.assertRaisesRegex(ValueError, "attempt history is incomplete"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )
        failed["transport_attempts"] = 1
        failed["transport_retry_count"] = 0
        failed["retry_count"] = 0
        failed["total_retry_count"] = 0

        trusted = attach_trust_manifest(
            raw,
            selection_request="sonnet",
            pipeline_model_tier="sonnet",
            effective_model_tier="sonnet",
            model_ids=TEST_MODEL_IDS,
            origin_kind="daemon_queue",
            origin_id="queue-job-1",
        )
        manifest = trusted["trust_manifest"]

        self.assertNotIn(marker, json.dumps(manifest, ensure_ascii=False))
        self.assertNotIn("failed_calls", manifest["usage"])
        self.assertNotIn(
            "unexpected_private_payload",
            manifest["usage"]["by_model"][first_model],
        )
        self.assertEqual(
            set(manifest["models"]["calls"][0]["retry_history"][0]),
            {"attempt", "outcome", "response_id"},
        )
        self.assertEqual(
            set(manifest["models"]["failed_calls"][0]["attempt_history"][0]),
            {"attempt", "outcome", "error_type"},
        )
        failed_manifest = manifest["models"]["failed_calls"][0]
        self.assertEqual(set(failed_manifest["release"]), set(release))
        self.assertEqual(set(failed_manifest["expected_release"]), set(release))
        self.assertEqual(
            set(failed_manifest["budget_check"]),
            {
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
                "spent_before_microusd",
                "spent_before_usd",
                "reserved_before_microusd",
                "reserved_before_usd",
                "settled_cost_microusd",
                "settled_cost_usd",
                "spent_after_microusd",
                "spent_after_usd",
                "reserved_after_microusd",
                "reserved_after_usd",
                "platform_recheck_sha256",
            },
        )
        for evidence in (
            manifest["models"]["calls"][0]["transformation_evidence"]
            + manifest["models"]["failed_calls"][0]["transformation_evidence"]
        ):
            self.assertEqual(
                set(evidence),
                {"name", "changed", "before_sha256", "after_sha256"},
            )

    def test_unpromoted_hybrid_decision_is_sealed_and_validated(self):
        raw = raw_analysis()
        usage = raw["usage"]
        usage["input_tokens"] += 1
        usage["output_tokens"] += 1
        usage["call_count"] += 1
        usage["by_model"]["claude-haiku-4-5-20251001"]["input_tokens"] += 1
        usage["by_model"]["claude-haiku-4-5-20251001"]["output_tokens"] += 1
        usage["by_model"]["claude-haiku-4-5-20251001"]["call_count"] += 1
        usage["calls"].append({
            "response_id": "msg_pre_triage",
            "requested_model": "claude-haiku-4-5-20251001",
            "returned_model": "claude-haiku-4-5-20251001",
            "stop_reason": "end_turn",
            "successful_attempt": 1,
            "retry_history": [{
                "attempt": 1,
                "outcome": "success",
                "response_id": "msg_pre_triage",
            }],
            "stage": "triage",
            "pipeline_pass": "triage",
            "boundary_run": 1,
            "reader_name": None,
            "disposition": "used",
            **call_provenance("msg_pre_triage", "triage", "used"),
            "usage": {
                "input_tokens": 1,
                "output_tokens": 1,
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
            },
        })
        raw["analysis"]["_cold_read"] = {
            "used_in_synthesis": True,
            "evidence": {
                "triage_score": 6.1,
                "verdict": "consider",
                "genre": "horror",
                "logline": "A test cold read.",
                "model_route": "haiku",
            },
            "response_ids": ["msg_pre_triage"],
        }
        raw["analysis"]["_hybrid_mode"] = {
            "promoted_to_opus": False,
            "sonnet_verdict": "CONSIDER",
            "final_model": "sonnet",
            "sonnet_analysis_evidence": copy.deepcopy(raw["analysis"]),
        }
        refresh_claim_verification(raw["analysis"])
        verification = raw["analysis"]["_claim_verification"]
        claim_calls = [
            call for call in usage["calls"]
            if call["stage"] == "claim_verification"
        ]
        if len(claim_calls) < verification["batch_count"]:
            for index, call in enumerate(claim_calls, start=1):
                call["reader_name"] = (
                    f"batch_{index:03d}_of_"
                    f"{verification['batch_count']:03d}"
                )
            response_id = verification["response_ids"][-1]
            extra_call = copy.deepcopy(claim_calls[-1])
            extra_call.update({
                "response_id": response_id,
                "reader_name": (
                    f"batch_{verification['batch_count']:03d}_of_"
                    f"{verification['batch_count']:03d}"
                ),
                "retry_history": [{
                    "attempt": 1,
                    "outcome": "success",
                    "response_id": response_id,
                }],
                **call_provenance(
                    response_id,
                    "claim_verification",
                    "used",
                ),
            })
            usage["calls"].append(extra_call)
            usage["call_count"] += 1
            usage["by_model"][MODEL_ID]["call_count"] += 1
        attach_verified_citation_quality(
            raw["analysis"],
            raw["metadata"],
            raw["metadata"]["page_count"],
            q2_parsed_source()["text"],
        )

        trusted = attach_trust_manifest(
            raw,
            selection_request="hybrid",
            pipeline_model_tier="hybrid",
            effective_model_tier="sonnet",
            model_ids=TEST_MODEL_IDS,
            origin_kind="daemon_queue",
            origin_id="queue-job-1",
        )

        self.assertFalse(
            trusted["trust_manifest"]["hybrid"]["promoted_to_opus"]
        )

        sonnet_raw = copy.deepcopy(raw)
        sonnet_usage = sonnet_raw["usage"]
        haiku_usage = sonnet_usage["by_model"][HAIKU_MODEL_ID]
        haiku_usage["input_tokens"] -= 1
        haiku_usage["output_tokens"] -= 1
        haiku_usage["call_count"] -= 1
        sonnet_model_usage = sonnet_usage["by_model"][MODEL_ID]
        sonnet_model_usage["input_tokens"] += 1
        sonnet_model_usage["output_tokens"] += 1
        sonnet_model_usage["call_count"] += 1
        triage_call = next(
            call for call in sonnet_usage["calls"]
            if call["response_id"] == "msg_pre_triage"
        )
        triage_call["requested_model"] = MODEL_ID
        triage_call["returned_model"] = MODEL_ID
        sonnet_raw["analysis"]["_cold_read"]["evidence"][
            "model_route"
        ] = "sonnet"
        sonnet_raw["analysis"]["_hybrid_mode"][
            "sonnet_analysis_evidence"
        ]["_cold_read"]["evidence"]["model_route"] = "sonnet"
        refresh_claim_verification(sonnet_raw["analysis"])
        attach_verified_citation_quality(
            sonnet_raw["analysis"],
            sonnet_raw["metadata"],
            sonnet_raw["metadata"]["page_count"],
            q2_parsed_source()["text"],
        )
        sonnet_trusted = attach_trust_manifest(
            sonnet_raw,
            selection_request="hybrid",
            pipeline_model_tier="hybrid",
            effective_model_tier="sonnet",
            model_ids=TEST_MODEL_IDS,
            origin_kind="daemon_queue",
            origin_id="queue-job-1",
        )
        self.assertEqual(
            sonnet_trusted["trust_manifest"]["cold_read"]["evidence"][
                "model_route"
            ],
            "sonnet",
        )

        trusted["analysis"]["_hybrid_mode"]["promoted_to_opus"] = True
        with self.assertRaisesRegex(ValueError, "analysis payload"):
            validate_permanent_analysis(trusted)

    def test_top_level_cost_mirror_must_match_sealed_usage(self):
        raw = raw_analysis()
        raw["actual_cost_microusd"] = 1

        with self.assertRaisesRegex(ValueError, "cost mirror"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_write_target_must_match_the_manifest(self):
        raw = trusted_raw()

        with self.assertRaisesRegex(ValueError, "project_id"):
            from execution.ingest_v9 import build_version_document

            build_version_document(
                raw,
                project_id="Different_Project.pdf",
                version_id=VERSION_ID,
                version_number=1,
                queued_at_ms=QUEUED_AT_MS,
            )

    def test_exact_response_identity_is_required(self):
        raw = raw_analysis()
        raw["usage"]["calls"][0]["response_id"] = ""

        with self.assertRaisesRegex(ValueError, "response_id"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_parser_provenance_is_required(self):
        raw = raw_analysis()
        raw["parser_version"] = None

        with self.assertRaisesRegex(ValueError, "parser"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_daemon_source_archive_is_required(self):
        raw = raw_analysis()
        raw.pop("storage_path")
        raw.pop("storage_generation")

        with self.assertRaisesRegex(ValueError, "archive"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_source_archive_must_match_the_exact_project_version_path(self):
        raw = raw_analysis()
        raw["storage_path"] = (
            f"gs://test-bucket/screenplays/Other_Project/versions/{VERSION_ID}.pdf"
        )

        with self.assertRaisesRegex(ValueError, "does not match"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_source_archive_requires_a_numeric_generation(self):
        raw = raw_analysis()
        raw["storage_generation"] = "latest"

        with self.assertRaisesRegex(ValueError, "positive integer"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_boundary_window_must_match_the_scoring_contract(self):
        raw = raw_analysis()
        raw["analysis"]["_boundary_reruns"]["boundary_window"] = 0.75

        with self.assertRaisesRegex(ValueError, "window"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_boundary_reason_must_match_the_actual_score_and_outcome(self):
        raw = raw_analysis()
        raw["analysis"]["_boundary_reruns"]["reason"] = "near_boundary"

        with self.assertRaisesRegex(ValueError, "reason"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_near_boundary_result_cannot_disable_required_stability_runs(self):
        raw = raw_analysis()
        analysis = raw["analysis"]
        analysis["critical_failures"] = []
        analysis["critical_failure_penalty_applied"] = 0.0
        analysis["critical_failure_total_penalty"] = 0.0
        analysis["weighted_score_adjusted"] = analysis["weighted_score"]
        analysis["verdict_adjustments"] = []
        boundary = analysis["_boundary_reruns"]
        boundary["reason"] = "disabled_by_environment"
        boundary["runs"][0]["adjusted_score"] = analysis["weighted_score"]
        boundary["median_adjusted_score"] = analysis["weighted_score"]
        refresh_boundary_evidence(analysis)

        with self.assertRaisesRegex(ValueError, "stability runs disabled"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
            )

    def test_integrity_seal_tampering_is_rejected(self):
        raw = trusted_raw()
        raw["trust_manifest"]["models"]["effective_model_id"] = "claude-opus-4-7"

        with self.assertRaisesRegex(ValueError, "integrity"):
            validate_permanent_analysis(raw)

    def test_resealed_wrong_engine_contract_is_rejected(self):
        raw = trusted_raw()
        manifest = raw["trust_manifest"]
        manifest["engine"]["prompt_contract_version"] = "obsolete-prompts"
        manifest.pop("integrity_sha256")
        manifest["integrity_sha256"] = hashlib.sha256(
            json.dumps(
                manifest,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            ).encode("utf-8")
        ).hexdigest()

        with self.assertRaisesRegex(ValueError, "engine contract"):
            validate_permanent_analysis(raw)

    def test_missing_manifest_is_rejected_before_permanent_write(self):
        with self.assertRaisesRegex(ValueError, "trust manifest"):
            validate_permanent_analysis(raw_analysis())

    def test_identical_raw_evidence_rebuilds_the_same_seal(self):
        first = trusted_raw()
        retry_source = copy.deepcopy(first)
        retry_source.pop("trust_manifest")
        retry_source.pop("trust_manifest_version")
        retry_source.pop("analysis_schema_version")
        retry_source.pop("prompt_version")
        retry_source.pop("scoring_code_version")
        retry_source.pop("analysis_provider")

        retry = attach_trust_manifest(
            retry_source,
            selection_request="sonnet",
            pipeline_model_tier="sonnet",
            effective_model_tier="sonnet",
            model_ids=TEST_MODEL_IDS,
            origin_kind="daemon_queue",
            origin_id="queue-job-1",
        )

        self.assertEqual(first["trust_manifest"], retry["trust_manifest"])


if __name__ == "__main__":
    unittest.main()
