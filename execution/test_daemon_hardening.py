import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

os.environ.setdefault("DAEMON_LOG_DIR", tempfile.gettempdir())

import daemon


CONTENT_HASH = "cd" * 32


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
                {"content_hash": CONTENT_HASH, "status": "complete"},
            ])
            daemon._db = MagicMock()
            daemon._db.collection.return_value = complete_query
            self.assertTrue(daemon.is_already_complete(CONTENT_HASH))

            pending_query = InMemoryQueueQuery([
                {"content_hash": CONTENT_HASH, "status": "pending"},
            ])
            daemon._db.collection.return_value = pending_query
            self.assertFalse(daemon.is_already_complete(CONTENT_HASH))
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
                    patch.object(daemon, "check_and_increment_budget") as budget,
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


if __name__ == "__main__":
    unittest.main()
