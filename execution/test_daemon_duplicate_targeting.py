import os
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

os.environ.setdefault("DAEMON_LOG_DIR", "/tmp/lemon-daemon-test")

import daemon
from execution.ingest_v9 import write_analysis_transaction


CONTENT_HASH = "ef" * 32
QUEUED_AT_MS = 1_784_588_800_123


class FakeSnapshot:
    def __init__(self, data=None):
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return self._data


class FakeReference:
    def __init__(self, data=None):
        self.snapshot = FakeSnapshot(data)

    def get(self, transaction=None):
        return self.snapshot


class FakeTransaction:
    def __init__(self):
        self.operations = []

    def create(self, reference, data):
        self.operations.append(("create", reference, data))

    def set(self, reference, data):
        self.operations.append(("set", reference, data))


class TestDaemonDuplicateAndTargeting(unittest.TestCase):
    def test_target_project_must_exist_before_analysis(self):
        existing_snapshot = SimpleNamespace(exists=True)
        missing_snapshot = SimpleNamespace(exists=False)
        prior_db = daemon._db
        try:
            daemon._db = MagicMock()
            daemon._db.collection.return_value.document.return_value.get.return_value = (
                existing_snapshot
            )
            self.assertEqual(
                daemon.resolve_target_project_id("Original_Draft.pdf"),
                "Original_Draft.pdf",
            )

            daemon._db.collection.return_value.document.return_value.get.return_value = (
                missing_snapshot
            )
            with self.assertRaisesRegex(ValueError, "does not exist"):
                daemon.resolve_target_project_id("Missing_Draft.pdf")
        finally:
            daemon._db = prior_db

    def test_byte_identical_upload_stops_before_budget_or_ai(self):
        heartbeat = MagicMock()
        fake_engine = SimpleNamespace(
            run_v9_stable=MagicMock(),
            run_v9_hybrid=MagicMock(),
        )
        prior_engine = sys.modules.get("ingest_v9")
        sys.modules["ingest_v9"] = fake_engine

        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "Duplicate.pdf"
            pdf_path.write_bytes(b"same bytes")
            prior_work_dir = daemon.WORK_DIR
            prior_bucket = daemon._bucket
            prior_db = daemon._db
            daemon.WORK_DIR = Path(temp_dir) / "work"
            daemon._bucket = object()
            daemon._db = MagicMock()
            try:
                with (
                    patch.object(daemon, "HeartbeatTask", return_value=heartbeat),
                    patch.object(daemon, "download_pdf", return_value=pdf_path),
                    patch.object(daemon, "compute_content_hash", return_value=CONTENT_HASH),
                    patch.object(daemon, "is_already_complete", return_value=True),
                    patch.object(daemon, "mark_skipped") as mark_skipped,
                    patch.object(daemon, "check_and_increment_budget") as budget,
                ):
                    daemon.process_job({
                        "id": "duplicate-job",
                        "filename": "Duplicate.pdf",
                        "collection_id": "LEMON",
                        "storage_path": "gs://bucket/ingest-queue/LEMON/upload/Duplicate.pdf",
                        "queued_at": datetime.fromtimestamp(
                            QUEUED_AT_MS / 1000,
                            tz=timezone.utc,
                        ),
                        "attempt_count": 1,
                    })

                mark_skipped.assert_called_once_with("duplicate-job", "already_complete")
                budget.assert_not_called()
                fake_engine.run_v9_stable.assert_not_called()
                fake_engine.run_v9_hybrid.assert_not_called()
            finally:
                daemon.WORK_DIR = prior_work_dir
                daemon._bucket = prior_bucket
                daemon._db = prior_db
                if prior_engine is None:
                    sys.modules.pop("ingest_v9", None)
                else:
                    sys.modules["ingest_v9"] = prior_engine

    def test_renamed_revision_stays_under_the_target_project(self):
        raw = daemon.build_raw_document(
            filename="Completely Renamed Draft.pdf",
            model_key="sonnet",
            collection_id="LEMON",
            page_count=100,
            word_count=20_000,
            analysis={"title": "Completely Renamed Draft"},
            usage={"input_tokens": 10, "output_tokens": 5},
            job_id="revision-job",
            content_hash=CONTENT_HASH,
            queued_at_ms=QUEUED_AT_MS,
            tmdb_status=None,
            target_project_id="Original_Draft.pdf",
        )

        self.assertEqual(raw["project_id"], "Original_Draft.pdf")

        transaction = FakeTransaction()
        parent_ref = FakeReference({
            "source_file": "Original Draft.pdf",
            "version_count": 1,
        })
        version_ref = FakeReference()
        version_number = write_analysis_transaction(
            transaction,
            parent_ref,
            version_ref,
            raw,
            project_id=raw["project_id"],
            version_id=f"{CONTENT_HASH}_{QUEUED_AT_MS}",
            queued_at_ms=QUEUED_AT_MS,
        )

        self.assertEqual(version_number, 2)
        version_document = transaction.operations[0][2]
        parent_document = transaction.operations[1][2]
        self.assertEqual(version_document["source_file"], "Completely Renamed Draft.pdf")
        self.assertEqual(version_document["project_id"], "Original_Draft.pdf")
        self.assertEqual(parent_document["source_file"], "Original Draft.pdf")
        self.assertEqual(parent_document["latest_source_file"], "Completely Renamed Draft.pdf")
        self.assertEqual(parent_document["project_id"], "Original_Draft.pdf")

    def test_queue_target_reaches_the_versioned_writer_and_completion_record(self):
        heartbeat = MagicMock()
        written = []
        fake_engine = SimpleNamespace(
            init_firebase=MagicMock(),
            parse_pdf=MagicMock(return_value={
                "text": ("INT. HOUSE - DAY\nA scene unfolds.\n" * 30),
                "page_count": 100,
                "word_count": 20_000,
            }),
            run_v9_stable=MagicMock(return_value=(
                {"title": "Completely Renamed Draft", "verdict": "CONSIDER"},
                {"input_tokens": 10, "output_tokens": 5, "finish_reason": "end_turn"},
            )),
            run_v9_hybrid=MagicMock(),
            write_to_firestore=MagicMock(side_effect=lambda raw: written.append(raw) or True),
            to_doc_id=MagicMock(return_value="wrong-new-project"),
            MODEL_IDS={"sonnet": "claude-sonnet-test"},
        )
        prior_engine = sys.modules.get("ingest_v9")
        sys.modules["ingest_v9"] = fake_engine

        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "Completely Renamed Draft.pdf"
            pdf_path.write_bytes(b"changed revision bytes")
            prior_work_dir = daemon.WORK_DIR
            prior_bucket = daemon._bucket
            prior_db = daemon._db
            daemon.WORK_DIR = Path(temp_dir) / "work"
            daemon._bucket = object()
            daemon._db = MagicMock()
            try:
                with (
                    patch.object(daemon, "HeartbeatTask", return_value=heartbeat),
                    patch.object(daemon, "download_pdf", return_value=pdf_path),
                    patch.object(daemon, "compute_content_hash", return_value=CONTENT_HASH),
                    patch.object(daemon, "is_already_complete", return_value=False),
                    patch.object(
                        daemon,
                        "resolve_target_project_id",
                        return_value="Original_Draft.pdf",
                    ) as resolve_target,
                    patch.object(daemon, "check_tmdb_for_job", return_value=(False, "", None)),
                    patch.object(daemon, "check_and_increment_budget"),
                    patch.object(daemon, "mark_complete") as mark_complete,
                    patch.object(daemon, "mark_failed") as mark_failed,
                ):
                    daemon.process_job({
                        "id": "revision-job",
                        "filename": "Completely Renamed Draft.pdf",
                        "collection_id": "LEMON",
                        "storage_path": "gs://bucket/ingest-queue/LEMON/upload/Renamed.pdf",
                        "storage_generation": "1001",
                        "target_project_id": "Original_Draft.pdf",
                        "requested_model": "sonnet",
                        "queued_at": datetime.fromtimestamp(
                            QUEUED_AT_MS / 1000,
                            tz=timezone.utc,
                        ),
                        "attempt_count": 1,
                    })

                resolve_target.assert_called_once_with("Original_Draft.pdf")
                mark_failed.assert_not_called()
                self.assertEqual(len(written), 1)
                self.assertEqual(written[0]["project_id"], "Original_Draft.pdf")
                self.assertEqual(written[0]["source_file"], "Completely Renamed Draft.pdf")
                self.assertEqual(written[0]["storage_generation"], "1001")
                mark_complete.assert_called_once()
                self.assertEqual(mark_complete.call_args.args[1], "Original_Draft.pdf")
                fake_engine.to_doc_id.assert_not_called()
            finally:
                daemon.WORK_DIR = prior_work_dir
                daemon._bucket = prior_bucket
                daemon._db = prior_db
                if prior_engine is None:
                    sys.modules.pop("ingest_v9", None)
                else:
                    sys.modules["ingest_v9"] = prior_engine


if __name__ == "__main__":
    unittest.main()
