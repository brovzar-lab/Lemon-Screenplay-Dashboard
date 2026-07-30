import os
import hashlib
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

os.environ.setdefault("DAEMON_LOG_DIR", tempfile.gettempdir())

import daemon
from execution import ingest_v9


class CalibrationProfileTests(unittest.TestCase):
    def setUp(self):
        self.previous_db = daemon._db
        daemon._db = MagicMock()

    def tearDown(self):
        daemon._db = self.previous_db

    def test_enabled_profile_is_loaded_with_a_non_secret_fingerprint(self):
        prompt = "Favor emotional specificity over tidy structure."
        daemon._db.collection.return_value.document.return_value.get.return_value = (
            SimpleNamespace(
                exists=True,
                to_dict=lambda: {
                    "enabled": True,
                    "calibrationPrompt": prompt,
                    "activeVersionId": "candidate-1",
                    "promptSha256": hashlib.sha256(prompt.encode()).hexdigest(),
                    "sourceAssessmentSetSha256": "ab" * 32,
                    "compilerModelId": "claude-opus-4-7",
                    "lastCalibrated": "2026-07-21T12:00:00Z",
                    "totalReviews": 12,
                },
            )
        )

        profile = daemon.load_calibration_profile()

        self.assertEqual(
            profile["prompt"],
            "Favor emotional specificity over tidy structure.",
        )
        self.assertEqual(profile["profile_id"], "admin")
        self.assertEqual(profile["total_reviews"], 12)
        self.assertRegex(profile["prompt_sha256"], r"^[a-f0-9]{64}$")
        self.assertNotIn("prompt", profile["provenance"])
        self.assertEqual(
            profile["provenance"]["profile_version_id"],
            "candidate-1",
        )
        self.assertEqual(
            profile["provenance"]["source_assessment_set_sha256"],
            "ab" * 32,
        )
        self.assertEqual(
            profile["provenance"]["compiler_model_id"],
            "claude-opus-4-7",
        )

    def test_versioned_profile_with_mismatched_prompt_hash_falls_back(self):
        daemon._db.collection.return_value.document.return_value.get.return_value = (
            SimpleNamespace(
                exists=True,
                to_dict=lambda: {
                    "enabled": True,
                    "calibrationPrompt": "Published prompt",
                    "activeVersionId": "candidate-1",
                    "promptSha256": "00" * 32,
                    "sourceAssessmentSetSha256": "ab" * 32,
                    "compilerModelId": "claude-opus-4-7",
                    "totalReviews": 5,
                },
            )
        )

        profile = daemon.load_calibration_profile()

        self.assertIsNone(profile["prompt"])
        self.assertEqual(
            profile["provenance"]["fallback_reason"],
            "invalid_profile",
        )
        self.assertIn(
            "prompt hash",
            profile["provenance"]["validation_error"],
        )

    def test_disabled_or_missing_profile_does_not_change_analysis(self):
        daemon._db.collection.return_value.document.return_value.get.return_value = (
            SimpleNamespace(
                exists=True,
                to_dict=lambda: {
                    "enabled": False,
                    "calibrationPrompt": "Do not apply this.",
                },
            )
        )
        self.assertIsNone(daemon.load_calibration_profile())

    def test_enabled_profile_with_invalid_prompt_falls_back_uncalibrated(self):
        daemon._db.collection.return_value.document.return_value.get.return_value = (
            SimpleNamespace(
                exists=True,
                to_dict=lambda: {"enabled": True, "calibrationPrompt": ""},
            )
        )
        profile = daemon.load_calibration_profile()

        self.assertIsNone(profile["prompt"])
        self.assertEqual(profile["provenance"], {
            "applied": False,
            "profile_id": "admin",
            "fallback_reason": "invalid_profile",
            "validation_error": "Enabled calibration profile requires calibrationPrompt",
        })

    def test_profile_read_failure_remains_retryable(self):
        daemon._db.collection.return_value.document.return_value.get.side_effect = (
            RuntimeError("Firestore unavailable")
        )

        with self.assertRaisesRegex(RuntimeError, "Firestore unavailable"):
            daemon.load_calibration_profile()


class CalibrationPromptTests(unittest.TestCase):
    def test_synthesis_receives_the_saved_producer_calibration(self):
        blocks = ingest_v9._synthesis_user_blocks(
            "Draft",
            {"structure": {"pillar_score": 7}},
            calibration_prompt="Favor emotional specificity over tidy structure.",
        )

        prompt = blocks[0]["text"]
        self.assertIn("PRODUCER CALIBRATION", prompt)
        self.assertIn("Favor emotional specificity over tidy structure.", prompt)
        self.assertIn("Apply these biases to the synthesis", prompt)

    def test_boundary_reruns_keep_the_same_calibration(self):
        first = {"weighted_score_adjusted": 7.5, "verdict": "RECOMMEND"}
        second = {"weighted_score_adjusted": 7.6, "verdict": "RECOMMEND"}
        usage = {"input_tokens": 1, "output_tokens": 1}
        with (
            patch.object(ingest_v9, "_near_boundary", return_value=True),
            patch.object(
                ingest_v9,
                "run_v9_full",
                side_effect=[(first, usage), (second, usage), (second, usage)],
            ) as run_full,
        ):
            ingest_v9.run_v9_stable(
                text="INT. HOUSE - DAY",
                title="Draft",
                page_count=100,
                word_count=20_000,
                model_key="sonnet",
                proxy_url=None,
                calibration_prompt="Lemon profile",
            )

        self.assertEqual(run_full.call_count, 3)
        for call in run_full.call_args_list:
            self.assertEqual(call.kwargs["calibration_prompt"], "Lemon profile")

    def test_boundary_rerun_failure_is_preserved_in_provenance(self):
        first = {
            "weighted_score_adjusted": 7.5,
            "verdict": "RECOMMEND",
            "verdict_model": "RECOMMEND",
        }
        usage = {"input_tokens": 1, "output_tokens": 1}
        with (
            patch.object(ingest_v9, "_near_boundary", return_value=True),
            patch.object(
                ingest_v9,
                "run_v9_full",
                side_effect=[
                    (first, usage),
                    RuntimeError("reader timeout"),
                    RuntimeError("proxy unavailable"),
                ],
            ),
        ):
            analysis, _usage = ingest_v9.run_v9_stable(
                text="INT. HOUSE - DAY",
                title="Draft",
                page_count=100,
                word_count=20_000,
                model_key="sonnet",
                proxy_url=None,
            )

        provenance = analysis["_boundary_reruns"]
        self.assertTrue(provenance["triggered"])
        self.assertEqual(provenance["reason"], "reruns_failed")
        self.assertEqual(provenance["attempted_runs"], 3)
        self.assertEqual(provenance["completed_runs"], 1)
        self.assertEqual(
            [failure["error_type"] for failure in provenance["failed_runs"]],
            ["RuntimeError", "RuntimeError"],
        )

    def test_boundary_reader_quality_failure_blocks_the_entire_verdict(self):
        first = {
            "weighted_score_adjusted": 7.5,
            "verdict": "RECOMMEND",
            "verdict_model": "RECOMMEND",
        }
        usage = {"input_tokens": 1, "output_tokens": 1}
        quality_failure = ingest_v9.ReaderPanelIncompleteError(
            "reader panel incomplete after recovery",
            ingest_v9.empty_usage(),
            review_evidence={
                "completed_readers": 4,
                "expected_readers": 5,
                "failed_readers": ["emotional_resonance"],
            },
        )
        with (
            patch.object(ingest_v9, "_near_boundary", return_value=True),
            patch.object(
                ingest_v9,
                "run_v9_full",
                side_effect=[(first, usage), quality_failure],
            ) as run_full,
        ):
            with self.assertRaises(ingest_v9.ReaderPanelIncompleteError):
                ingest_v9.run_v9_stable(
                    text="INT. HOUSE - DAY",
                    title="Draft",
                    page_count=100,
                    word_count=20_000,
                    model_key="sonnet",
                    proxy_url=None,
                )

        self.assertEqual(run_full.call_count, 2)

    def test_boundary_postprocessing_failure_keeps_accrued_usage(self):
        first = {
            "weighted_score_adjusted": 7.5,
            "verdict": "RECOMMEND",
            "verdict_model": "RECOMMEND",
        }
        third = {
            "weighted_score_adjusted": 7.7,
            "verdict": "RECOMMEND",
            "verdict_model": "RECOMMEND",
        }
        successful_usage = {"input_tokens": 1, "output_tokens": 1}
        call_number = 0

        def run_full(**kwargs):
            nonlocal call_number
            call_number += 1
            if call_number == 1:
                return first, successful_usage
            if call_number == 2:
                sink = kwargs["usage_sink"]
                sink["input_tokens"] = 50
                raise ValueError("pillar post-processing failed")
            return third, successful_usage

        with (
            patch.object(ingest_v9, "_near_boundary", return_value=True),
            patch.object(ingest_v9, "run_v9_full", side_effect=run_full),
        ):
            analysis, usage = ingest_v9.run_v9_stable(
                text="INT. HOUSE - DAY",
                title="Draft",
                page_count=100,
                word_count=20_000,
                model_key="sonnet",
                proxy_url=None,
            )

        self.assertEqual(usage["input_tokens"], 52)
        self.assertEqual(
            analysis["_boundary_reruns"]["failed_runs"][0]["error_type"],
            "ValueError",
        )


if __name__ == "__main__":
    unittest.main()
