import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

os.environ.setdefault("DAEMON_LOG_DIR", tempfile.gettempdir())

import daemon
from execution import ingest_v9 as actual_ingest_v9


CONTENT_HASH = "cd" * 32
QUEUED_AT_MS = 1_784_588_800_123


class ProxyTrustCapabilityTests(unittest.TestCase):
    def test_supported_proxy_contract_passes_without_a_paid_call(self):
        response = MagicMock()
        response.json.return_value = {
            "service": "llmProxy",
            "trust_contract_version": daemon.LLM_PROXY_TRUST_CONTRACT_VERSION,
            "response_id_supported": True,
        }

        with patch.object(daemon.requests, "get", return_value=response) as get:
            capability = daemon.verify_proxy_trust_capability(
                "https://proxy.example/llm",
                "test-service-key",
            )

        get.assert_called_once_with(
            "https://proxy.example/llm",
            headers={"X-Lemon-Service-Key": "test-service-key"},
            timeout=15,
        )
        response.raise_for_status.assert_called_once_with()
        self.assertTrue(capability["response_id_supported"])

    def test_older_proxy_contract_stops_before_queue_consumption(self):
        response = MagicMock()
        response.json.return_value = {
            "service": "llmProxy",
            "response_id_supported": False,
        }

        with (
            patch.object(daemon.requests, "get", return_value=response),
            self.assertRaisesRegex(RuntimeError, "no queued work was claimed"),
        ):
            daemon.verify_proxy_trust_capability(
                "https://old-proxy.example/llm",
                "test-service-key",
            )

    def test_missing_service_key_stops_before_network_or_queue_consumption(self):
        with (
            patch.dict(os.environ, {}, clear=True),
            patch.object(daemon.requests, "get") as get,
            self.assertRaisesRegex(RuntimeError, "PROXY_SERVICE_KEY"),
        ):
            daemon.verify_proxy_trust_capability("https://proxy.example/llm")

        get.assert_not_called()


class NeedsReviewStateTests(unittest.TestCase):
    def test_incomplete_evidence_has_a_terminal_review_state(self):
        previous_db = daemon._db
        daemon._db = MagicMock()
        try:
            daemon.mark_needs_review(
                "review-job",
                "ending pages are missing",
                evidence={"extraction_quality": {"publication_ready": False}},
            )
            update = (
                daemon._db.collection.return_value.document.return_value.update
                .call_args.args[0]
            )
        finally:
            daemon._db = previous_db

        self.assertEqual(update["status"], "needs_review")
        self.assertFalse(update["retryable"])
        self.assertEqual(update["failure_kind"], "evidence_review")
        self.assertIn("ending pages", update["review_reason"])

    def test_reader_panel_failure_routes_to_needs_review_with_attempt_evidence(self):
        review_error = RuntimeError("reader panel incomplete")
        review_error.review_required = True
        review_error.review_kind = "reader_panel_review"
        review_error.review_evidence = {
            "completed_readers": 4,
            "expected_readers": 5,
            "failed_readers": ["emotional_resonance"],
            "max_attempts_per_reader": 3,
        }

        with patch.object(daemon, "mark_needs_review") as mark_needs_review:
            handled = daemon.route_analysis_review_error(
                "reader-review-job",
                review_error,
            )

        self.assertTrue(handled)
        mark_needs_review.assert_called_once_with(
            "reader-review-job",
            "reader panel incomplete",
            evidence=review_error.review_evidence,
            failure_kind="reader_panel_review",
        )

    def test_unclassified_engine_failure_remains_retryable(self):
        with patch.object(daemon, "mark_needs_review") as mark_needs_review:
            handled = daemon.route_analysis_review_error(
                "retryable-job",
                RuntimeError("temporary network failure"),
            )

        self.assertFalse(handled)
        mark_needs_review.assert_not_called()

    def test_quality_failure_persists_exact_paid_usage(self):
        review_error = RuntimeError("genre detection failed")
        review_error.review_required = True
        review_error.review_kind = "genre_detection_review"
        review_error.review_evidence = {"error_type": "ValueError"}
        review_error.usage = {
            "input_tokens": 100,
            "output_tokens": 20,
            "call_count": 1,
            "actual_cost_microusd": 725,
            "calls": [{"response_id": "msg_genre", "returned_model": "exact-model"}],
            "failed_calls": [],
        }

        with patch.object(daemon, "mark_needs_review") as mark_needs_review:
            self.assertTrue(daemon.route_analysis_review_error("genre-job", review_error))

        evidence = mark_needs_review.call_args.kwargs["evidence"]
        self.assertEqual(evidence["usage"]["actual_cost_microusd"], 725)
        self.assertEqual(evidence["usage"]["calls"][0]["returned_model"], "exact-model")

    def test_post_model_failure_can_never_be_reset_to_pending(self):
        error = RuntimeError("schema validation failed after synthesis")
        usage = {
            "input_tokens": 100,
            "output_tokens": 20,
            "call_count": 1,
            "actual_cost_microusd": 725,
            "calls": [{"response_id": "msg_paid"}],
            "failed_calls": [],
        }
        with (
            patch.object(daemon, "mark_needs_review") as mark_needs_review,
            patch.object(daemon, "mark_failed") as mark_failed,
        ):
            self.assertTrue(daemon.stop_if_paid_failure("paid-job", error, usage))

        mark_failed.assert_not_called()
        mark_needs_review.assert_called_once()
        self.assertEqual(
            mark_needs_review.call_args.kwargs["failure_kind"],
            "post_model_application_failure",
        )


class CompletedVersionPreflightTests(unittest.TestCase):
    def test_existing_version_completes_without_repeating_paid_work(self):
        heartbeat = MagicMock()
        fake_engine = SimpleNamespace(
            init_firebase=MagicMock(),
            to_doc_id=MagicMock(return_value="Original_Draft.pdf"),
            parse_pdf=MagicMock(),
            run_v9_stable=MagicMock(),
            run_v9_hybrid=MagicMock(),
            write_to_firestore=MagicMock(),
            validate_permanent_analysis=MagicMock(),
            MODEL_IDS={"sonnet": "claude-sonnet-4-6"},
        )
        prior_engine = sys.modules.get("ingest_v9")
        sys.modules["ingest_v9"] = fake_engine
        prior_work_dir = daemon.WORK_DIR
        prior_db = daemon._db

        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "Draft.pdf"
            pdf_path.write_bytes(b"same version bytes")
            daemon.WORK_DIR = Path(temp_dir) / "work"
            daemon._db = MagicMock()
            try:
                existing_version = {
                    "analysis_version": "v9_archaeology",
                    "analysis_model": "claude-sonnet-4-6",
                    "usage": {
                        "input_tokens": 100,
                        "output_tokens": 50,
                        "call_count": 7,
                    },
                    "storage_path": (
                        "gs://bucket/screenplays/Original_Draft.pdf/versions/"
                        f"{CONTENT_HASH}_{QUEUED_AT_MS}.pdf"
                    ),
                    "storage_generation": "2002",
                }
                with (
                    patch.object(daemon, "HeartbeatTask", return_value=heartbeat),
                    patch.object(daemon, "download_pdf", return_value=pdf_path),
                    patch.object(daemon, "compute_content_hash", return_value=CONTENT_HASH),
                    patch.object(daemon, "is_already_complete", return_value=False),
                    patch.object(
                        daemon,
                        "resolve_target_project_id",
                        return_value="Original_Draft.pdf",
                    ),
                    patch.object(
                        daemon,
                        "get_existing_version",
                        return_value=existing_version,
                    ) as version_lookup,
                    patch.object(
                        daemon,
                        "verify_archived_pdf_version",
                    ) as verify_archive,
                    patch.object(daemon, "archive_pdf_version") as archive_pdf,
                    patch.object(daemon, "check_daily_budget_available") as budget,
                    patch.object(daemon, "load_calibration_profile") as calibration,
                    patch.object(daemon, "mark_complete") as mark_complete,
                ):
                    daemon.process_job({
                        "id": "lost-ack-job",
                        "filename": "Draft.pdf",
                        "collection_id": "LEMON",
                        "storage_path": "gs://bucket/ingest-queue/LEMON/upload/Draft.pdf",
                        "storage_generation": "1001",
                        "target_project_id": "Original_Draft.pdf",
                        "requested_model": "sonnet",
                        "queued_at": datetime.fromtimestamp(
                            QUEUED_AT_MS / 1000,
                            tz=timezone.utc,
                        ),
                        "attempt_count": 2,
                        "bypass_duplicate": True,
                    })

                version_lookup.assert_called_once_with(
                    "Original_Draft.pdf",
                    f"{CONTENT_HASH}_{QUEUED_AT_MS}",
                )
                mark_complete.assert_called_once()
                self.assertEqual(mark_complete.call_args.args[1], "Original_Draft.pdf")
                self.assertTrue(mark_complete.call_args.args[2]["idempotent_replay"])
                fake_engine.parse_pdf.assert_not_called()
                archive_pdf.assert_not_called()
                budget.assert_not_called()
                calibration.assert_not_called()
                fake_engine.run_v9_stable.assert_not_called()
                fake_engine.run_v9_hybrid.assert_not_called()
                fake_engine.write_to_firestore.assert_not_called()
                fake_engine.validate_permanent_analysis.assert_called_once_with(
                    existing_version
                )
                verify_archive.assert_called_once_with(
                    storage_path=existing_version["storage_path"],
                    storage_generation=existing_version["storage_generation"],
                    project_id="Original_Draft.pdf",
                    version_id=f"{CONTENT_HASH}_{QUEUED_AT_MS}",
                    content_hash=CONTENT_HASH,
                )
            finally:
                daemon.WORK_DIR = prior_work_dir
                daemon._db = prior_db
                if prior_engine is None:
                    sys.modules.pop("ingest_v9", None)
                else:
                    sys.modules["ingest_v9"] = prior_engine


class BudgetWaitingStateTests(unittest.TestCase):
    def test_budget_pause_does_not_consume_an_attempt_or_return_to_pending(self):
        job_ref = MagicMock()
        prior_db = daemon._db
        daemon._db = MagicMock()
        daemon._db.collection.return_value.document.return_value = job_ref
        now = datetime(2026, 7, 21, 23, 30, tzinfo=timezone.utc)
        try:
            daemon.mark_waiting_for_budget(
                "budget-job",
                daemon.BudgetExceededError("Daily dollar limit reached"),
                attempt_count=2,
                now=now,
            )
        finally:
            daemon._db = prior_db

        update = job_ref.update.call_args.args[0]
        self.assertEqual(update["status"], "waiting_for_budget")
        self.assertEqual(update["attempt_count"], 1)
        self.assertEqual(
            update["budget_resume_at"],
            datetime(2026, 7, 22, 0, 0, tzinfo=timezone.utc),
        )
        self.assertIsNone(update["worker_id"])
        self.assertIsNone(update["processing_started_at"])

    def test_budget_exhaustion_pauses_before_archive_calibration_or_ai(self):
        heartbeat = MagicMock()
        fake_engine = SimpleNamespace(
            init_firebase=MagicMock(),
            to_doc_id=MagicMock(return_value="Budget_Draft.pdf"),
            validate_permanent_analysis=MagicMock(),
            parse_pdf=MagicMock(return_value={
                "text": ("INT. HOUSE - DAY\nA scene unfolds.\n" * 30),
                "page_count": 100,
                "word_count": 20_000,
            }),
            run_v9_stable=MagicMock(),
            run_v9_hybrid=MagicMock(),
        )
        prior_engine = sys.modules.get("ingest_v9")
        sys.modules["ingest_v9"] = fake_engine
        prior_work_dir = daemon.WORK_DIR
        prior_db = daemon._db

        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "Budget Draft.pdf"
            pdf_path.write_bytes(b"new screenplay bytes")
            daemon.WORK_DIR = Path(temp_dir) / "work"
            daemon._db = MagicMock()
            try:
                budget_error = daemon.BudgetExceededError("Daily dollar limit reached")
                with (
                    patch.object(daemon, "HeartbeatTask", return_value=heartbeat),
                    patch.object(daemon, "download_pdf", return_value=pdf_path),
                    patch.object(daemon, "compute_content_hash", return_value=CONTENT_HASH),
                    patch.object(daemon, "is_already_complete", return_value=False),
                    patch.object(daemon, "get_existing_version", return_value=None),
                    patch.object(daemon, "validate_parsed_source"),
                    patch.object(daemon, "check_tmdb_for_job", return_value=(False, "", None)),
                    patch.object(
                        daemon,
                        "check_daily_budget_available",
                        side_effect=budget_error,
                    ),
                    patch.object(daemon, "mark_waiting_for_budget") as mark_waiting,
                    patch.object(daemon, "archive_pdf_version") as archive_pdf,
                    patch.object(daemon, "load_calibration_profile") as calibration,
                ):
                    daemon.process_job({
                        "id": "budget-paused-job",
                        "filename": "Budget Draft.pdf",
                        "collection_id": "LEMON",
                        "storage_path": (
                            "gs://bucket/ingest-queue/LEMON/upload/Budget_Draft.pdf"
                        ),
                        "storage_generation": "1001",
                        "requested_model": "sonnet",
                        "queued_at": datetime.fromtimestamp(
                            QUEUED_AT_MS / 1000,
                            tz=timezone.utc,
                        ),
                        "attempt_count": 2,
                    })

                mark_waiting.assert_called_once_with(
                    "budget-paused-job",
                    budget_error,
                    2,
                )
                archive_pdf.assert_not_called()
                calibration.assert_not_called()
                fake_engine.run_v9_stable.assert_not_called()
                fake_engine.run_v9_hybrid.assert_not_called()
            finally:
                daemon.WORK_DIR = prior_work_dir
                daemon._db = prior_db
                if prior_engine is None:
                    sys.modules.pop("ingest_v9", None)
                else:
                    sys.modules["ingest_v9"] = prior_engine


class DownloadIdentityTests(unittest.TestCase):
    def test_download_uses_the_path_bucket_and_exact_generation(self):
        bucket = MagicMock()
        bucket.name = "upload-bucket"
        blob = MagicMock()
        bucket.blob.return_value = blob

        with tempfile.TemporaryDirectory() as temp_dir:
            workdir = Path(temp_dir)
            local_path = workdir / "Draft.pdf"
            blob.download_to_filename.side_effect = (
                lambda filename, **_kwargs: Path(filename).write_bytes(b"pdf bytes")
            )

            with patch.object(daemon, "storage_bucket_for_path", return_value=bucket):
                result = daemon.download_pdf(
                    "gs://upload-bucket/ingest-queue/LEMON/upload/Draft.pdf",
                    workdir,
                    "12345",
                )

        self.assertEqual(result, local_path)
        bucket.blob.assert_called_once_with(
            "ingest-queue/LEMON/upload/Draft.pdf",
            generation=12345,
        )
        blob.download_to_filename.assert_called_once_with(
            str(local_path),
            if_generation_match=12345,
        )

    def test_download_rejects_a_job_without_a_generation(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            with self.assertRaisesRegex(daemon.TerminalJobError, "storage_generation"):
                daemon.download_pdf(
                    "gs://upload-bucket/ingest-queue/LEMON/upload/Draft.pdf",
                    Path(temp_dir),
                    None,
                )


class InMemoryQueueQuery:
    def __init__(self, documents):
        self.documents = documents
        self.filters = []

    def where(self, field, operator, value):
        self.filters.append((field, operator, value))
        return self

    def limit(self, _count):
        return self

    def stream(self):
        return [
            SimpleNamespace(to_dict=lambda data=data: data)
            for data in self.documents
            if all(operator == "==" and data.get(field) == value
                   for field, operator, value in self.filters)
        ]


class DuplicateLookupTests(unittest.TestCase):
    def test_real_duplicate_query_only_matches_completed_identical_content(self):
        prior_db = daemon._db
        try:
            complete_query = InMemoryQueueQuery([
                {"content_hash": CONTENT_HASH, "status": "pending"},
                {"content_hash": "00" * 32, "status": "complete"},
                {
                    "content_hash": CONTENT_HASH,
                    "status": "complete",
                    "screenplay_doc_id": "Draft.pdf",
                    "version_id": f"{CONTENT_HASH}_{QUEUED_AT_MS}",
                },
            ])
            daemon._db = MagicMock()
            daemon._db.collection.return_value = complete_query
            with (
                patch.object(daemon, "get_existing_version", return_value={
                    "storage_path": (
                        "gs://bucket/screenplays/Draft.pdf/versions/"
                        f"{CONTENT_HASH}_{QUEUED_AT_MS}.pdf"
                    ),
                    "storage_generation": "2002",
                }),
                patch.object(daemon, "verify_archived_pdf_version"),
            ):
                self.assertTrue(
                    daemon.is_already_complete(CONTENT_HASH, MagicMock())
                )

            pending_query = InMemoryQueueQuery([
                {"content_hash": CONTENT_HASH, "status": "pending"},
            ])
            daemon._db.collection.return_value = pending_query
            self.assertFalse(
                daemon.is_already_complete(CONTENT_HASH, MagicMock())
            )
        finally:
            daemon._db = prior_db


class TerminalFailureTests(unittest.TestCase):
    def test_missing_revision_target_fails_once_before_budget_or_ai(self):
        heartbeat = MagicMock()
        prior_work_dir = daemon.WORK_DIR
        prior_db = daemon._db
        daemon._db = MagicMock()

        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "Revision.pdf"
            pdf_path.write_bytes(b"revision bytes")
            daemon.WORK_DIR = Path(temp_dir) / "work"
            try:
                with (
                    patch.object(daemon, "HeartbeatTask", return_value=heartbeat),
                    patch.object(daemon, "download_pdf", return_value=pdf_path),
                    patch.object(daemon, "compute_content_hash", return_value=CONTENT_HASH),
                    patch.object(daemon, "is_already_complete", return_value=False),
                    patch.object(
                        daemon,
                        "resolve_target_project_id",
                        side_effect=daemon.TerminalJobError(
                            "target_project_id does not exist: missing-project"
                        ),
                    ),
                    patch.object(daemon, "mark_terminal_failed") as terminal_failed,
                    patch.object(daemon, "mark_failed") as retryable_failed,
                    patch.object(daemon, "check_daily_budget_available") as budget,
                ):
                    daemon.process_job({
                        "id": "missing-target-job",
                        "filename": "Revision.pdf",
                        "collection_id": "LEMON",
                        "storage_path": (
                            "gs://upload-bucket/ingest-queue/LEMON/upload/Revision.pdf"
                        ),
                        "storage_generation": "12345",
                        "target_project_id": "missing-project",
                        "queued_at": datetime.now(timezone.utc),
                        "attempt_count": 1,
                    })

                terminal_failed.assert_called_once()
                self.assertEqual(terminal_failed.call_args.args[0], "missing-target-job")
                self.assertIn("does not exist", str(terminal_failed.call_args.args[1]))
                retryable_failed.assert_not_called()
                budget.assert_not_called()
            finally:
                daemon.WORK_DIR = prior_work_dir
                daemon._db = prior_db


class FakeSnapshot:
    def __init__(self, data):
        self.exists = data is not None
        self._data = data

    def to_dict(self):
        return self._data


class FakeReference:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self.snapshot = FakeSnapshot(data)

    def get(self, transaction=None):
        return self.snapshot


class OrphanLeaseTests(unittest.TestCase):
    def test_stale_pre_call_job_can_be_requeued(self):
        cutoff = datetime.now(timezone.utc)
        reference = FakeReference(
            "free-orphan",
            {
                "status": "processing",
                "worker_id": "dead-worker",
                "last_heartbeat_at": cutoff - timedelta(minutes=10),
                "attempt_count": 1,
                "llm_call_count": 0,
                "actual_cost_microusd": 0,
            },
        )
        transaction = MagicMock()
        prior_db = daemon._db
        daemon._db = MagicMock()
        daemon._db.transaction.return_value = transaction
        try:
            with patch.object(daemon.fb_firestore, "transactional", side_effect=lambda f: f):
                result = daemon.recover_orphaned_job(reference, cutoff)
        finally:
            daemon._db = prior_db

        self.assertEqual(result, "pending")
        self.assertEqual(transaction.update.call_args.args[1]["status"], "pending")

    def test_stale_paid_job_requires_review_instead_of_requeue(self):
        cutoff = datetime.now(timezone.utc)
        reference = FakeReference(
            "paid-orphan",
            {
                "status": "processing",
                "worker_id": "dead-worker",
                "last_heartbeat_at": cutoff - timedelta(minutes=10),
                "attempt_count": 1,
                "llm_call_count": 1,
                "actual_cost_microusd": 725,
                "last_llm_call_at": cutoff - timedelta(minutes=11),
            },
        )
        transaction = MagicMock()
        prior_db = daemon._db
        daemon._db = MagicMock()
        daemon._db.transaction.return_value = transaction
        try:
            with patch.object(daemon.fb_firestore, "transactional", side_effect=lambda f: f):
                result = daemon.recover_orphaned_job(reference, cutoff)
        finally:
            daemon._db = prior_db

        self.assertEqual(result, "needs_review")
        update = transaction.update.call_args.args[1]
        self.assertEqual(update["status"], "needs_review")
        self.assertFalse(update["retryable"])
        self.assertEqual(update["review_evidence"]["actual_cost_microusd"], 725)

    def test_stale_job_with_an_inflight_reservation_cannot_be_requeued(self):
        cutoff = datetime.now(timezone.utc)
        reference = FakeReference(
            "inflight-orphan",
            {
                "status": "processing",
                "worker_id": "dead-worker",
                "last_heartbeat_at": cutoff - timedelta(minutes=10),
                "attempt_count": 1,
                "llm_call_count": 0,
                "actual_cost_microusd": 0,
                "llm_active_reservation_count": 1,
                "llm_active_reservations": {
                    "reservation-1": {
                        "state": "reserved_before_provider_dispatch",
                    },
                },
            },
        )
        transaction = MagicMock()
        prior_db = daemon._db
        daemon._db = MagicMock()
        daemon._db.transaction.return_value = transaction
        try:
            with patch.object(daemon.fb_firestore, "transactional", side_effect=lambda f: f):
                result = daemon.recover_orphaned_job(reference, cutoff)
        finally:
            daemon._db = prior_db

        self.assertEqual(result, "needs_review")
        update = transaction.update.call_args.args[1]
        self.assertEqual(update["failure_kind"], "orphaned_after_model_activity")
        self.assertEqual(
            update["review_evidence"]["active_reservation_ids"],
            ["reservation-1"],
        )

    def test_live_local_job_is_not_reclaimed_even_with_a_stale_heartbeat(self):
        cutoff = datetime.now(timezone.utc)
        reference = FakeReference(
            "live-job",
            {
                "status": "processing",
                "worker_id": daemon.WORKER_ID,
                "last_heartbeat_at": cutoff - timedelta(minutes=10),
                "attempt_count": 1,
            },
        )
        transaction = MagicMock()
        prior_db = daemon._db
        daemon._db = MagicMock()
        daemon._db.transaction.return_value = transaction
        daemon.register_active_job("live-job")
        try:
            with patch.object(daemon.fb_firestore, "transactional", side_effect=lambda f: f):
                result = daemon.recover_orphaned_job(reference, cutoff)
        finally:
            daemon.unregister_active_job("live-job")
            daemon._db = prior_db

        self.assertEqual(result, "active")
        transaction.update.assert_not_called()

    def test_fresh_heartbeat_wins_over_a_stale_query_snapshot(self):
        cutoff = datetime.now(timezone.utc)
        reference = FakeReference(
            "fresh-job",
            {
                "status": "processing",
                "worker_id": "another-worker",
                "last_heartbeat_at": cutoff + timedelta(seconds=1),
                "attempt_count": 1,
            },
        )
        transaction = MagicMock()
        prior_db = daemon._db
        daemon._db = MagicMock()
        daemon._db.transaction.return_value = transaction
        try:
            with patch.object(daemon.fb_firestore, "transactional", side_effect=lambda f: f):
                result = daemon.recover_orphaned_job(reference, cutoff)
        finally:
            daemon._db = prior_db

        self.assertEqual(result, "unchanged")
        transaction.update.assert_not_called()


class QuarantineIdempotencyTests(unittest.TestCase):
    def test_skip_status_is_durable_before_the_blob_is_moved(self):
        job_ref = MagicMock()
        job_ref.update.side_effect = [None, RuntimeError("lost commit acknowledgement")]
        prior_db = daemon._db
        daemon._db = MagicMock()
        daemon._db.collection.return_value.document.return_value = job_ref
        try:
            with patch.object(
                daemon,
                "move_blob_to_bad_format",
                return_value="gs://upload-bucket/bad-formats/LEMON/job-1/Draft.pdf",
            ) as move_blob:
                daemon.mark_skipped(
                    "job-1",
                    "pdf_parse_failed",
                    storage_path=(
                        "gs://upload-bucket/ingest-queue/LEMON/upload/Draft.pdf"
                    ),
                    storage_generation="12345",
                    collection_id="LEMON",
                    filename="Draft.pdf",
                )
        finally:
            daemon._db = prior_db

        first_update = job_ref.update.call_args_list[0].args[0]
        self.assertEqual(first_update["status"], "skipped")
        self.assertEqual(first_update["quarantine_status"], "pending")
        move_blob.assert_called_once_with(
            "gs://upload-bucket/ingest-queue/LEMON/upload/Draft.pdf",
            "LEMON",
            "Draft.pdf",
            "pdf_parse_failed",
            quarantine_id="job-1",
            storage_generation="12345",
        )

    def test_existing_destination_completes_an_interrupted_move(self):
        bucket = MagicMock()
        bucket.name = "upload-bucket"
        source = MagicMock()
        source.exists.return_value = False
        destination = MagicMock()
        destination.exists.return_value = True
        destination.generation = 67890

        def blob(name, generation=None):
            if name == "ingest-queue/LEMON/upload/Draft.pdf":
                return source
            if name == "bad-formats/LEMON/job-1/Draft.pdf":
                return destination
            raise AssertionError(f"Unexpected blob {name}")

        bucket.blob.side_effect = blob
        with patch.object(daemon, "storage_bucket_for_path", return_value=bucket):
            result = daemon.move_blob_to_bad_format(
                "gs://upload-bucket/ingest-queue/LEMON/upload/Draft.pdf",
                "LEMON",
                "Draft.pdf",
                "pdf_parse_failed",
                quarantine_id="job-1",
                storage_generation="12345",
            )

        self.assertEqual(
            result,
            "gs://upload-bucket/bad-formats/LEMON/job-1/Draft.pdf",
        )
        bucket.copy_blob.assert_not_called()


class OptionalColdReadTests(unittest.TestCase):
    def test_budget_exhaustion_after_a_settled_call_never_auto_requeues(self):
        paid_usage = actual_ingest_v9.empty_usage()
        paid_usage.update({
            "input_tokens": 30,
            "output_tokens": 10,
            "call_count": 1,
            "actual_cost_microusd": 500,
            "actual_cost_usd": 0.0005,
            "calls": [{
                "call_id": "9" * 64,
                "response_id": "msg_paid_before_budget_stop",
            }],
        })
        budget_error = actual_ingest_v9.DailyBudgetExceededError(
            "Daily dollar limit reached"
        )
        budget_error.usage = paid_usage
        fake_engine = SimpleNamespace(
            init_firebase=MagicMock(),
            to_doc_id=MagicMock(return_value="Budget_Stop_Draft.pdf"),
            parse_pdf=MagicMock(return_value={
                "text": "INT. HOUSE - DAY\nA family confronts a secret.",
                "page_count": 1,
                "word_count": 8,
                "metadata": {},
            }),
            run_nonbinding_cold_read=MagicMock(side_effect=budget_error),
            run_v9_stable=MagicMock(),
            run_v9_hybrid=MagicMock(),
            validate_permanent_analysis=MagicMock(),
            merge_usage=actual_ingest_v9.merge_usage,
            empty_usage=actual_ingest_v9.empty_usage,
            V9RunError=actual_ingest_v9.V9RunError,
            LlmCallFailedError=actual_ingest_v9.LlmCallFailedError,
            DailyBudgetExceededError=actual_ingest_v9.DailyBudgetExceededError,
            BenchmarkCapExceededError=actual_ingest_v9.BenchmarkCapExceededError,
            LlmAccountingError=actual_ingest_v9.LlmAccountingError,
            LlmProvenanceError=actual_ingest_v9.LlmProvenanceError,
            LlmRequestRejectedError=actual_ingest_v9.LlmRequestRejectedError,
            MODEL_IDS=actual_ingest_v9.MODEL_IDS,
            PARSER_VERSION=actual_ingest_v9.PARSER_VERSION,
        )
        prior_engine = sys.modules.get("ingest_v9")
        prior_work_dir = daemon.WORK_DIR
        prior_db = daemon._db
        sys.modules["ingest_v9"] = fake_engine

        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "Budget Stop Draft.pdf"
            pdf_path.write_bytes(b"screenplay bytes")
            daemon.WORK_DIR = Path(temp_dir) / "work"
            daemon._db = MagicMock()
            try:
                with (
                    patch.object(daemon, "HeartbeatTask", return_value=MagicMock()),
                    patch.object(daemon, "download_pdf", return_value=pdf_path),
                    patch.object(daemon, "compute_content_hash", return_value=CONTENT_HASH),
                    patch.object(daemon, "is_already_complete", return_value=False),
                    patch.object(daemon, "resolve_target_project_id", return_value=None),
                    patch.object(daemon, "get_existing_version", return_value=None),
                    patch.object(daemon, "validate_screenplay_text", return_value=(True, "")),
                    patch.object(daemon, "validate_parsed_source"),
                    patch.object(daemon, "check_tmdb_for_job", return_value=(False, "", None)),
                    patch.object(daemon, "check_daily_budget_available"),
                    patch.object(daemon, "load_calibration_profile", return_value=None),
                    patch.object(
                        daemon,
                        "archive_pdf_version",
                        return_value=("gs://bucket/archive.pdf", "2002"),
                    ),
                    patch.object(daemon, "mark_waiting_for_budget") as mark_waiting,
                    patch.object(daemon, "mark_needs_review") as mark_review,
                ):
                    daemon.process_job({
                        "id": "budget-stop-job",
                        "filename": "Budget Stop Draft.pdf",
                        "collection_id": "LEMON",
                        "storage_path": "gs://bucket/ingest-queue/LEMON/Budget_Stop.pdf",
                        "storage_generation": "1001",
                        "requested_model": "sonnet",
                        "queued_at": datetime.now(timezone.utc),
                        "attempt_count": 1,
                    })
            finally:
                daemon.WORK_DIR = prior_work_dir
                daemon._db = prior_db
                if prior_engine is None:
                    sys.modules.pop("ingest_v9", None)
                else:
                    sys.modules["ingest_v9"] = prior_engine

        mark_waiting.assert_not_called()
        mark_review.assert_called_once()
        self.assertEqual(
            mark_review.call_args.kwargs["failure_kind"],
            "post_model_application_failure",
        )
        self.assertEqual(
            mark_review.call_args.kwargs["evidence"]["usage"]["actual_cost_microusd"],
            500,
        )
        fake_engine.run_v9_stable.assert_not_called()

    def test_ambiguous_optional_cold_read_stops_before_full_analysis(self):
        cold_failure = actual_ingest_v9.LlmCallFailedError(
            "cold read transport failed",
            attempt_history=[{
                "attempt": 1,
                "outcome": "transport_error",
                "error_type": "ConnectionError",
            }],
            requested_model=actual_ingest_v9.MODEL_IDS["haiku"],
            stage="genre_detection",
            pipeline_pass="cold_read",
            boundary_run=0,
            reader_name=None,
        )
        stable_usage = actual_ingest_v9.empty_usage()
        stable_usage.update({
            "input_tokens": 30,
            "output_tokens": 10,
            "call_count": 1,
            "actual_cost_microusd": 500,
            "actual_cost_usd": 0.0005,
        })
        fake_engine = SimpleNamespace(
            init_firebase=MagicMock(),
            to_doc_id=MagicMock(return_value="Cold_Read_Draft.pdf"),
            parse_pdf=MagicMock(return_value={
                "text": "INT. HOUSE - DAY\nA family confronts a secret.",
                "page_count": 1,
                "word_count": 8,
                "metadata": {},
            }),
            run_nonbinding_cold_read=MagicMock(side_effect=cold_failure),
            run_v9_stable=MagicMock(return_value=(
                {"analysis_version": "v9_archaeology"},
                stable_usage,
            )),
            run_v9_hybrid=MagicMock(),
            write_to_firestore=MagicMock(return_value=True),
            validate_permanent_analysis=MagicMock(),
            failed_usage=actual_ingest_v9.failed_usage,
            merge_usage=actual_ingest_v9.merge_usage,
            empty_usage=actual_ingest_v9.empty_usage,
            V9RunError=actual_ingest_v9.V9RunError,
            LlmCallFailedError=actual_ingest_v9.LlmCallFailedError,
            DailyBudgetExceededError=actual_ingest_v9.DailyBudgetExceededError,
            BenchmarkCapExceededError=actual_ingest_v9.BenchmarkCapExceededError,
            LlmAccountingError=actual_ingest_v9.LlmAccountingError,
            LlmProvenanceError=actual_ingest_v9.LlmProvenanceError,
            LlmRequestRejectedError=actual_ingest_v9.LlmRequestRejectedError,
            MODEL_IDS=actual_ingest_v9.MODEL_IDS,
            PARSER_VERSION=actual_ingest_v9.PARSER_VERSION,
        )
        prior_engine = sys.modules.get("ingest_v9")
        prior_work_dir = daemon.WORK_DIR
        prior_db = daemon._db
        sys.modules["ingest_v9"] = fake_engine

        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "Cold Read Draft.pdf"
            pdf_path.write_bytes(b"screenplay bytes")
            daemon.WORK_DIR = Path(temp_dir) / "work"
            daemon._db = MagicMock()
            try:
                with (
                    patch.object(daemon, "HeartbeatTask", return_value=MagicMock()),
                    patch.object(daemon, "download_pdf", return_value=pdf_path),
                    patch.object(daemon, "compute_content_hash", return_value=CONTENT_HASH),
                    patch.object(daemon, "is_already_complete", return_value=False),
                    patch.object(daemon, "resolve_target_project_id", return_value=None),
                    patch.object(daemon, "get_existing_version", return_value=None),
                    patch.object(daemon, "validate_screenplay_text", return_value=(True, "")),
                    patch.object(daemon, "validate_parsed_source"),
                    patch.object(daemon, "check_tmdb_for_job", return_value=(False, "", None)),
                    patch.object(daemon, "check_daily_budget_available"),
                    patch.object(daemon, "load_calibration_profile", return_value=None),
                    patch.object(
                        daemon,
                        "archive_pdf_version",
                        return_value=("gs://bucket/archive.pdf", "2002"),
                    ),
                    patch.object(daemon, "attach_verified_citation_quality"),
                    patch.object(
                        daemon,
                        "build_raw_document",
                        return_value={"prompt_version": "test-prompt"},
                    ) as build_raw,
                    patch.object(daemon, "mark_complete") as mark_complete,
                    patch.object(daemon, "mark_failed") as mark_failed,
                    patch.object(daemon, "mark_terminal_failed") as mark_terminal,
                    patch.object(daemon, "mark_needs_review") as mark_review,
                ):
                    daemon.process_job({
                        "id": "cold-read-job",
                        "filename": "Cold Read Draft.pdf",
                        "collection_id": "LEMON",
                        "storage_path": "gs://bucket/ingest-queue/Cold_Read_Draft.pdf",
                        "storage_generation": "1001",
                        "requested_model": "sonnet",
                        "queued_at": datetime.now(timezone.utc),
                        "attempt_count": 1,
                    })
            finally:
                daemon.WORK_DIR = prior_work_dir
                daemon._db = prior_db
                if prior_engine is None:
                    sys.modules.pop("ingest_v9", None)
                else:
                    sys.modules["ingest_v9"] = prior_engine

        fake_engine.run_v9_stable.assert_not_called()
        build_raw.assert_not_called()
        mark_complete.assert_not_called()
        mark_failed.assert_not_called()
        mark_terminal.assert_not_called()
        mark_review.assert_called_once()
        self.assertEqual(
            mark_review.call_args.kwargs["failure_kind"],
            "ambiguous_paid_call",
        )


class ModelRouteTests(unittest.TestCase):
    def test_invalid_model_route_is_terminal_instead_of_falling_back(self):
        self.assertEqual(daemon.resolve_model_route("auto"), "sonnet")
        self.assertEqual(daemon.resolve_model_route("haiku"), "sonnet")
        for invalid_route in ("claude-mystery", [], {}):
            with self.subTest(invalid_route=invalid_route), self.assertRaisesRegex(
                daemon.TerminalJobError,
                "refusing silent fallback",
            ):
                daemon.resolve_model_route(invalid_route)

    def test_invalid_model_route_fails_before_download_or_archive_mutation(self):
        heartbeat = MagicMock()
        prior_work_dir = daemon.WORK_DIR
        with tempfile.TemporaryDirectory() as temp_dir:
            daemon.WORK_DIR = Path(temp_dir)
            try:
                with (
                    patch.object(daemon, "HeartbeatTask", return_value=heartbeat),
                    patch.object(daemon, "download_pdf") as download_pdf,
                    patch.object(daemon, "archive_pdf_version") as archive_pdf,
                    patch.object(daemon, "mark_terminal_failed") as mark_terminal,
                ):
                    daemon.process_job({
                        "id": "invalid-route-job",
                        "filename": "Draft.pdf",
                        "requested_model": "claude-mystery",
                    })
            finally:
                daemon.WORK_DIR = prior_work_dir

        download_pdf.assert_not_called()
        archive_pdf.assert_not_called()
        mark_terminal.assert_called_once()


if __name__ == "__main__":
    unittest.main()
