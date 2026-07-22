import os
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
        daemon._db.collection.return_value.document.return_value.get.return_value = (
            SimpleNamespace(
                exists=True,
                to_dict=lambda: {
                    "enabled": True,
                    "calibrationPrompt": "Favor emotional specificity over tidy structure.",
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

    def test_enabled_profile_with_invalid_prompt_fails_before_paid_work(self):
        daemon._db.collection.return_value.document.return_value.get.return_value = (
            SimpleNamespace(
                exists=True,
                to_dict=lambda: {"enabled": True, "calibrationPrompt": ""},
            )
        )
        with self.assertRaisesRegex(ValueError, "calibrationPrompt"):
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


if __name__ == "__main__":
    unittest.main()
