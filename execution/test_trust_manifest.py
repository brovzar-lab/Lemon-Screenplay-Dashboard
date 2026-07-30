import copy
import hashlib
import json
import unittest

from execution.v9_test_fixtures import (
    CONTENT_HASH,
    MODEL_ID,
    MODEL_IDS as TEST_MODEL_IDS,
    PROJECT_ID,
    QUEUED_AT_MS,
    VERSION_ID,
    complete_usage,
    raw_analysis,
    refresh_boundary_evidence,
    trusted_raw,
)
from execution.trust_manifest import (
    ANALYSIS_SCHEMA_VERSION,
    LEGACY_TRUST_MANIFEST_VERSION,
    PROMPT_CONTRACT_VERSION,
    SCORING_CODE_VERSION,
    TRUST_MANIFEST_VERSION,
    attach_trust_manifest,
    validate_permanent_analysis,
)
from execution.source_evidence import (
    attach_verified_citation_quality,
    build_context_policy_for_length,
)

class TrustManifestTests(unittest.TestCase):
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
            [f"msg_{index}" for index in range(1, 8)],
        )
        self.assertEqual(
            first["trust_manifest"]["score_lineage"]["final_verdict"],
            "CONSIDER",
        )
        self.assertEqual(
            first["trust_manifest"]["calibration"]["prompt_sha256"],
            "cd" * 32,
        )
        self.assertNotIn("prompt", first["trust_manifest"]["calibration"])
        validate_permanent_analysis(first)

    def test_q1_manifest_remains_readable_after_q2_upgrade(self):
        legacy = trusted_raw()
        manifest = legacy["trust_manifest"]
        manifest.pop("evidence")
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

    def test_page_evidence_tampering_is_rejected(self):
        raw = trusted_raw()
        raw["metadata"]["page_diagnostics"][0]["words"] += 1

        with self.assertRaisesRegex(ValueError, "word count|integrity"):
            validate_permanent_analysis(raw)

    def test_invalid_reader_citation_cannot_receive_a_manifest(self):
        raw = raw_analysis()
        metric = raw["analysis"]["reader_reports"]["structure"]["sub_scores"]["one"]
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
        usage["failed_calls"].append({
            "requested_model": extra_model,
            "stage": "synthesis",
            "pipeline_pass": "opus",
            "boundary_run": 1,
            "reader_name": None,
            "attempt_history": [{
                "attempt": 1,
                "outcome": "failed",
                "error_type": "UpstreamTimeout",
            }],
        })
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
        raw["metadata"]["character_count"] = 500_000
        raw["analysis"]["_context_policy"] = build_context_policy_for_length(
            500_000,
            "sonnet",
        )
        genre_call = raw["usage"]["calls"][0]
        genre_call["requested_model"] = MODEL_ID
        genre_call["returned_model"] = MODEL_ID
        raw["usage"]["by_model"][MODEL_ID]["call_count"] = 7
        raw["usage"]["by_model"].pop("claude-haiku-4-5-20251001")

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

    def test_reader_failure_details_are_sealed(self):
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
        raw["usage"]["calls"] = [
            call
            for call in raw["usage"]["calls"]
            if call["response_id"] != "msg_6"
        ]
        raw["usage"]["call_count"] = 6
        raw["usage"]["by_model"][MODEL_ID]["call_count"] = 5
        raw["usage"]["failed_calls"] = [{
            "requested_model": MODEL_ID,
            "stage": "reader",
            "pipeline_pass": "sonnet",
            "boundary_run": 1,
            "reader_name": "emotional_resonance",
            "attempt_history": [
                {
                    "attempt": attempt,
                    "outcome": "failed",
                    "error_type": "Timeout",
                }
                for attempt in range(1, 4)
            ],
        }]
        analysis["_boundary_reruns"]["runs"][0]["response_ids"].remove("msg_6")
        refresh_boundary_evidence(analysis)
        attach_verified_citation_quality(
            analysis,
            raw["metadata"],
            raw["metadata"]["page_count"],
        )

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
            trusted["trust_manifest"]["readers"]["failed_reader_errors"],
            {"emotional_resonance": "model call exhausted retries"},
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

    def test_all_failed_attempts_are_sealed(self):
        raw = raw_analysis()
        raw["usage"]["failed_calls"] = [{
            "requested_model": MODEL_ID,
            "stage": "synthesis",
            "pipeline_pass": "sonnet",
            "boundary_run": 1,
            "reader_name": None,
            "attempt_history": [
                {
                    "attempt": attempt,
                    "outcome": "failed",
                    "error_type": "Timeout",
                }
                for attempt in range(1, 4)
            ],
        }]

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
            3,
        )

    def test_failed_reader_call_cannot_contradict_completed_reader_evidence(self):
        raw = raw_analysis()
        raw["usage"]["failed_calls"] = [{
            "requested_model": MODEL_ID,
            "stage": "reader",
            "pipeline_pass": "sonnet",
            "boundary_run": 1,
            "reader_name": "structure",
            "attempt_history": [{
                "attempt": 1,
                "outcome": "failed",
                "error_type": "Timeout",
            }],
        }]

        with self.assertRaisesRegex(ValueError, "declared failed readers"):
            attach_trust_manifest(
                raw,
                selection_request="sonnet",
                pipeline_model_tier="sonnet",
                effective_model_tier="sonnet",
                model_ids=TEST_MODEL_IDS,
                origin_kind="daemon_queue",
                origin_id="queue-job-1",
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
        })
        raw["analysis"]["_cold_read"] = {
            "used_in_synthesis": True,
            "evidence": {
                "triage_score": 6.1,
                "verdict": "consider",
                "genre": "horror",
                "logline": "A test cold read.",
            },
            "response_ids": ["msg_pre_triage"],
        }
        raw["analysis"]["_hybrid_mode"] = {
            "promoted_to_opus": False,
            "sonnet_verdict": "CONSIDER",
            "final_model": "sonnet",
            "sonnet_analysis_evidence": copy.deepcopy(raw["analysis"]),
        }
        attach_verified_citation_quality(
            raw["analysis"],
            raw["metadata"],
            raw["metadata"]["page_count"],
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
