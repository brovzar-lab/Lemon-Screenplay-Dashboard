"""Tests for the daemon's disabled-by-default coverage_v1 route.

Run: python3 -m execution.test_daemon_coverage_route
Offline: Firestore and the engine are always fakes.
"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

os.environ.setdefault("DAEMON_LOG_DIR", tempfile.gettempdir())

sys.path.insert(0, str(Path(__file__).parent))

import daemon  # noqa: E402

# Import both engine modules by the same top-level names the daemon uses, so
# exception classes are the exact objects its handlers catch.
import coverage_v1  # noqa: E402
import coverage_reader  # noqa: E402
import ingest_v9  # noqa: E402


def sealed_report(**overrides):
    report = {
        "analysis_version": "coverage_v1",
        "content_sha256": "ab" * 32,
        "engine_version": coverage_v1.ENGINE_VERSION,
        "status": "sealed",
        "verdict": "RECOMMEND",
        "confidence": "high",
        "film_now_nominated": False,
        "human_review_recommended": False,
        "lens_stack": ["lemon-coverage", "save-the-cat"],
        "cost": {
            "charged_usd": 0.31,
            "settled_usd": 0.31,
            "uncertain_usd": 0.0,
            "call_count": 2,
            "repair_calls_used": 0,
        },
    }
    report.update(overrides)
    return report


def engine_usage():
    return {
        "input_tokens": 80_000,
        "output_tokens": 6_000,
        "call_count": 2,
        "actual_cost_microusd": 310_000,
        "calls": [],
    }


def job_kwargs(job=None):
    return dict(
        job=job or {},
        job_id="job-1",
        title="El Último Portero",
        text="[PAGE 1]\ntexto",
        page_count=6,
        word_count=380,
        content_hash="ab" * 32,
        parser_version="v5-scene-content-evidence",
        screenplay_doc_id="el-ultimo-portero",
        version_id=("ab" * 32) + "_1784588800123",
        model_key="sonnet",
        proxy_url=None,
        attempt_count=1,
        start_time=0.0,
        archive_storage_path="archive/el-ultimo-portero.pdf",
        archive_storage_generation=7,
    )


class CoverageV1RouteTests(unittest.TestCase):
    def setUp(self):
        self.prior_db = daemon._db
        daemon._db = MagicMock()
        self.doc = daemon._db.collection.return_value.document.return_value
        self.doc.get.return_value.exists = False

    def tearDown(self):
        daemon._db = self.prior_db

    def test_previous_coverage_pdf_is_not_rebought_even_when_report_needs_review(self):
        digest = 'ab' * 32
        report = sealed_report(status='needs_review')
        wrapper = { 'project_id': 'prior-project', 'version_id': digest + '_123',
            'content_hash': digest, 'report_json': json.dumps(report),
            'report_sha256': coverage_v1.canonical_json_hash(report), 'status': 'needs_review' }
        snapshot = MagicMock()
        snapshot.to_dict.return_value = wrapper
        daemon._db.collection.return_value.where.return_value.stream.return_value = [snapshot]
        with patch.object(daemon, 'verify_archived_pdf_version') as verify:
            self.assertTrue(daemon.is_coverage_already_reported(digest))
        verify.assert_called_once()

    def test_happy_path_writes_staging_report_and_completes(self):
        self.doc.get.return_value.exists = False
        with patch.object(
            coverage_reader, "run_coverage_v1",
            return_value=(sealed_report(), engine_usage()),
        ) as engine:
            daemon.run_coverage_v1_job(**job_kwargs())

        engine.assert_called_once()
        self.assertEqual(
            engine.call_args.kwargs["content_sha256"], "ab" * 32
        )
        self.doc.create.assert_called_once()
        created = self.doc.create.call_args.args[0]
        self.assertEqual(created["status"], "sealed")
        self.assertEqual(created["verdict"], "RECOMMEND")
        self.assertIn("report_json", created)
        self.assertEqual(created["cost_settled_usd"], 0.31)
        self.assertEqual(created["source_file"], "coverage-v1/El Último Portero")
        self.assertEqual(created["storage_path"], "archive/el-ultimo-portero.pdf")

        completion = self.doc.update.call_args.args[0]
        self.assertEqual(completion["status"], "complete")
        self.assertEqual(completion["analysis_version"], "coverage_v1")
        self.assertEqual(completion["analysis_llm_call_count"], 2)
        self.assertAlmostEqual(completion["analysis_actual_cost_usd"], 0.31)

    def test_existing_report_is_not_overwritten(self):
        report = sealed_report()
        self.doc.get.return_value.exists = True
        self.doc.get.return_value.to_dict.return_value = {
            "report_json": json.dumps(report),
            "report_sha256": coverage_v1.canonical_json_hash(report),
            "project_id": "el-ultimo-portero",
            "version_id": ("ab" * 32) + "_1784588800123",
            "content_hash": "ab" * 32,
        }
        with patch.object(
            coverage_reader, "run_coverage_v1",
        ) as engine:
            daemon.run_coverage_v1_job(**job_kwargs())
        engine.assert_not_called()
        self.doc.create.assert_not_called()
        completion = self.doc.update.call_args.args[0]
        self.assertEqual(completion["status"], "complete")
        self.assertTrue(completion["idempotent_replay"])
        self.assertEqual(completion["analysis_actual_cost_microusd"], 310_000)

    def test_invalid_existing_report_stops_without_spending(self):
        report = sealed_report()
        self.doc.get.return_value.exists = True
        self.doc.get.return_value.to_dict.return_value = {
            "report_json": json.dumps(report),
            "report_sha256": "wrong",
            "project_id": "el-ultimo-portero",
            "version_id": ("ab" * 32) + "_1784588800123",
            "content_hash": "ab" * 32,
        }
        with patch.object(coverage_reader, "run_coverage_v1") as engine:
            daemon.run_coverage_v1_job(**job_kwargs())
        engine.assert_not_called()
        update = self.doc.update.call_args.args[0]
        self.assertEqual(update["status"], "needs_review")
        self.assertEqual(update["failure_kind"], "coverage_v1_existing_report_invalid")

    def test_unsealed_report_is_written_but_job_needs_review(self):
        report = sealed_report(
            status="needs_review",
            review_reasons=["Literal climax order is not verified."],
            human_review_recommended=True,
        )
        with patch.object(
            coverage_reader, "run_coverage_v1",
            return_value=(report, engine_usage()),
        ):
            daemon.run_coverage_v1_job(**job_kwargs())

        created = self.doc.create.call_args.args[0]
        self.assertEqual(created["status"], "needs_review")
        update = self.doc.update.call_args.args[0]
        self.assertEqual(update["status"], "needs_review")
        self.assertEqual(update["failure_kind"], "coverage_v1_unsealed_report")
        self.assertEqual(update["screenplay_doc_id"], "el-ultimo-portero")
        self.assertIn("Literal climax order", update["review_reason"])

    def test_lost_report_write_acknowledgement_does_not_repeat_inference(self):
        report = sealed_report()
        missing = MagicMock(exists=False)
        stored = MagicMock(exists=True)
        stored.to_dict.return_value = {
            "report_json": json.dumps(report),
            "report_sha256": coverage_v1.canonical_json_hash(report),
            "project_id": "el-ultimo-portero",
            "version_id": ("ab" * 32) + "_1784588800123",
            "content_hash": "ab" * 32,
        }
        self.doc.get.side_effect = [missing, stored]
        self.doc.create.side_effect = RuntimeError("lost acknowledgement")

        with (
            patch.object(daemon, "check_daily_budget_available"),
            patch.object(
                coverage_reader,
                "run_coverage_v1",
                return_value=(report, engine_usage()),
            ) as engine,
        ):
            daemon.run_coverage_v1_job(**job_kwargs())

        engine.assert_called_once()
        completion = self.doc.update.call_args.args[0]
        self.assertEqual(completion["status"], "complete")

    def test_unverified_report_write_stops_after_paid_work(self):
        missing = MagicMock(exists=False)
        self.doc.get.side_effect = [missing, missing]
        self.doc.create.side_effect = RuntimeError("write unavailable")

        with (
            patch.object(daemon, "check_daily_budget_available"),
            patch.object(
                coverage_reader,
                "run_coverage_v1",
                return_value=(sealed_report(), engine_usage()),
            ),
        ):
            daemon.run_coverage_v1_job(**job_kwargs())

        update = self.doc.update.call_args.args[0]
        self.assertEqual(update["status"], "needs_review")
        self.assertEqual(update["failure_kind"], "coverage_v1_report_write_unverified")

    def test_contract_failure_goes_to_needs_review_not_retry(self):
        with patch.object(
            coverage_reader, "run_coverage_v1",
            side_effect=coverage_v1.CoverageContractError("invalid coverage"),
        ):
            daemon.run_coverage_v1_job(**job_kwargs())
        update = self.doc.update.call_args.args[0]
        self.assertEqual(update["status"], "needs_review")
        self.assertEqual(
            update["failure_kind"], "coverage_v1_CoverageContractError"
        )
        self.assertFalse(update["retryable"])

    def test_budget_cap_goes_to_needs_review(self):
        with patch.object(
            coverage_reader, "run_coverage_v1",
            side_effect=coverage_v1.CoverageBudgetExceededError("cap"),
        ):
            daemon.run_coverage_v1_job(**job_kwargs())
        update = self.doc.update.call_args.args[0]
        self.assertEqual(update["status"], "needs_review")

    def test_daily_budget_without_paid_work_parks_the_job(self):
        with patch.object(
            coverage_reader, "run_coverage_v1",
            side_effect=ingest_v9.DailyBudgetExceededError("daily cap"),
        ):
            daemon.run_coverage_v1_job(**job_kwargs())
        update = self.doc.update.call_args.args[0]
        self.assertEqual(update["status"], "waiting_for_budget")

    def test_transport_error_without_paid_work_requeues(self):
        with patch.object(
            coverage_reader, "run_coverage_v1",
            side_effect=RuntimeError("proxy unreachable"),
        ):
            daemon.run_coverage_v1_job(**job_kwargs(), )
        update = self.doc.update.call_args.args[0]
        self.assertEqual(update["status"], "pending")

    def test_hybrid_request_runs_as_sonnet(self):
        self.doc.get.return_value.exists = False
        with patch.object(
            coverage_reader, "run_coverage_v1",
            return_value=(sealed_report(), engine_usage()),
        ) as engine:
            kwargs = job_kwargs()
            kwargs["model_key"] = "hybrid"
            daemon.run_coverage_v1_job(**kwargs)
        self.assertEqual(engine.call_args.kwargs["model_key"], "sonnet")

    def test_job_lens_and_format_fields_reach_the_engine(self):
        self.doc.get.return_value.exists = False
        job = {
            "format": "tv_pilot",
            "genre_hint": "comedy",
            "lenses": ["grisanti-pilot", "comedy-contract"],
            "max_cost_usd": 0.75,
        }
        with patch.object(
            coverage_reader, "run_coverage_v1",
            return_value=(sealed_report(), engine_usage()),
        ) as engine:
            daemon.run_coverage_v1_job(**job_kwargs(job))
        kwargs = engine.call_args.kwargs
        self.assertEqual(kwargs["fmt"], "tv_pilot")
        self.assertEqual(kwargs["genre_hint"], "comedy")
        self.assertEqual(kwargs["lenses"], ["grisanti-pilot", "comedy-contract"])
        self.assertEqual(kwargs["max_cost_usd"], 0.75)


if __name__ == "__main__":
    unittest.main(verbosity=1)
