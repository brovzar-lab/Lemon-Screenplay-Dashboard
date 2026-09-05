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
from execution import ingest_v9 as actual_ingest_v9
from execution.content_identity import build_separate_project_id
from execution.ingest_v9 import write_analysis_transaction
from execution.v9_test_fixtures import (
    HAIKU_MODEL_ID,
    MODEL_ID,
    complete_analysis,
    complete_usage,
    prepare_q2_analysis,
    q2_parsed_source,
    q2_parser_metadata,
    raw_analysis,
    refresh_claim_verification,
)


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
    def test_separate_project_gets_a_collision_safe_parent_id(self):
        project_id = daemon.choose_output_project_id(
            filename_project_id="Shared_Title.pdf",
            target_project_id=None,
            separate_project=True,
            upload_id="separate-upload",
        )

        self.assertNotEqual(project_id, "Shared_Title.pdf")
        self.assertTrue(project_id.endswith("__separate-upload"))
        self.assertLessEqual(len(project_id), 200)
        self.assertEqual(
            project_id,
            build_separate_project_id("Shared_Title.pdf", "separate-upload"),
        )

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

    def test_sealed_coverage_report_can_be_a_revision_parent(self):
        uploaded = MagicMock()
        uploaded.document.return_value.get.return_value = SimpleNamespace(exists=False)
        coverage = MagicMock()
        coverage.where.return_value.limit.return_value.stream.return_value = [
            SimpleNamespace(to_dict=lambda: {"status": "sealed"})
        ]
        prior_db = daemon._db
        daemon._db = MagicMock()
        daemon._db.collection.side_effect = lambda name: (
            coverage if name == daemon.COVERAGE_V1_REPORTS_COLLECTION else uploaded
        )
        try:
            self.assertEqual(
                daemon.resolve_target_project_id(
                    "Coverage_Project.pdf",
                    allow_coverage_parent=True,
                ),
                "Coverage_Project.pdf",
            )
        finally:
            daemon._db = prior_db

    def test_queue_separate_choice_reaches_project_identity_before_analysis(self):
        heartbeat = MagicMock()
        fake_engine = SimpleNamespace(
            init_firebase=MagicMock(),
            to_doc_id=MagicMock(return_value="Shared_Title.pdf"),
            parse_pdf=MagicMock(return_value=None),
        )
        prior_engine = sys.modules.get("ingest_v9")
        sys.modules["ingest_v9"] = fake_engine

        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "Shared Title.pdf"
            pdf_path.write_bytes(b"different screenplay bytes")
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
                    patch.object(
                        daemon,
                        "is_already_complete",
                        return_value=False,
                    ) as duplicate_check,
                    patch.object(
                        daemon,
                        "choose_output_project_id",
                        wraps=daemon.choose_output_project_id,
                    ) as choose_project,
                    patch.object(daemon, "mark_skipped"),
                    patch.object(daemon, "mark_failed") as mark_failed,
                ):
                    daemon.process_job({
                        "id": "separate-job",
                        "filename": "Shared Title.pdf",
                        "collection_id": "LEMON",
                        "storage_path": (
                            "gs://bucket/ingest-queue/LEMON/"
                            "separate-upload/Shared_Title.pdf"
                        ),
                        "upload_id": "separate-upload",
                        "separate_project": True,
                        "queued_at": datetime.fromtimestamp(
                            QUEUED_AT_MS / 1000,
                            tz=timezone.utc,
                        ),
                        "attempt_count": 1,
                    })

                choose_project.assert_called_once_with(
                    filename_project_id="Shared_Title.pdf",
                    target_project_id=None,
                    separate_project=True,
                    upload_id="separate-upload",
                )
                duplicate_check.assert_not_called()
                mark_failed.assert_not_called()
                fake_engine.parse_pdf.assert_called_once_with(
                    pdf_path,
                    content_hash=CONTENT_HASH,
                )
            finally:
                daemon.WORK_DIR = prior_work_dir
                daemon._bucket = prior_bucket
                daemon._db = prior_db
                if prior_engine is None:
                    sys.modules.pop("ingest_v9", None)
                else:
                    sys.modules["ingest_v9"] = prior_engine

    def test_byte_identical_upload_stops_before_budget_or_ai(self):
        heartbeat = MagicMock()
        fake_engine = SimpleNamespace(
            init_firebase=MagicMock(),
            to_doc_id=MagicMock(return_value="Duplicate.pdf"),
            validate_permanent_analysis=MagicMock(),
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
                    patch.object(daemon, "get_existing_version", return_value=None),
                    patch.object(daemon, "mark_skipped") as mark_skipped,
                    patch.object(daemon, "check_daily_budget_available") as budget,
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

    def test_stale_complete_queue_record_does_not_suppress_analysis(self):
        stale = MagicMock()
        stale.to_dict.return_value = {
            "screenplay_doc_id": "Missing.pdf",
            "version_id": f"{CONTENT_HASH}_{QUEUED_AT_MS}",
        }
        prior_db = daemon._db
        daemon._db = MagicMock()
        daemon._db.collection.return_value.where.return_value.where.return_value.stream.return_value = [stale]
        try:
            with patch.object(daemon, "get_existing_version", return_value=None):
                self.assertFalse(
                    daemon.is_already_complete(CONTENT_HASH, MagicMock())
                )
        finally:
            daemon._db = prior_db

    def test_stale_completion_does_not_hide_a_later_valid_duplicate(self):
        stale = MagicMock()
        stale.to_dict.return_value = {
            "screenplay_doc_id": "Missing.pdf",
            "version_id": f"{CONTENT_HASH}_1",
        }
        valid = MagicMock()
        valid.to_dict.return_value = {
            "screenplay_doc_id": "Valid.pdf",
            "version_id": f"{CONTENT_HASH}_2",
        }
        prior_db = daemon._db
        daemon._db = MagicMock()
        daemon._db.collection.return_value.where.return_value.where.return_value.stream.return_value = [
            stale,
            valid,
        ]
        try:
            with (
                patch.object(
                    daemon,
                    "get_existing_version",
                    side_effect=[None, {
                        "storage_path": (
                            "gs://bucket/screenplays/Valid.pdf/versions/"
                            f"{CONTENT_HASH}_2.pdf"
                        ),
                        "storage_generation": "2002",
                    }],
                ),
                patch.object(daemon, "verify_archived_pdf_version") as verify_archive,
            ):
                self.assertTrue(
                    daemon.is_already_complete(CONTENT_HASH, MagicMock())
                )
                verify_archive.assert_called_once()
        finally:
            daemon._db = prior_db

    def test_renamed_revision_stays_under_the_target_project(self):
        parsed = q2_parsed_source(page_count=100, word_count=20_000)
        parser_metadata = parsed["metadata"]
        analysis = raw_analysis()["analysis"]
        analysis["title"] = "Completely Renamed Draft"
        prepare_q2_analysis(analysis, parser_metadata)
        refresh_claim_verification(analysis)
        actual_ingest_v9.attach_verified_citation_quality(
            analysis,
            parser_metadata,
            parser_metadata["page_count"],
            parsed["text"],
        )
        raw = daemon.build_raw_document(
            filename="Completely Renamed Draft.pdf",
            model_key="sonnet",
            collection_id="LEMON",
            page_count=100,
            word_count=20_000,
            analysis=analysis,
            usage=complete_usage(MODEL_ID),
            job_id="revision-job",
            content_hash=CONTENT_HASH,
            queued_at_ms=QUEUED_AT_MS,
            tmdb_status=None,
            target_project_id="Original_Draft.pdf",
            storage_path=(
                "gs://bucket/screenplays/Original_Draft.pdf/versions/"
                f"{CONTENT_HASH}_{QUEUED_AT_MS}.pdf"
            ),
            storage_generation="2002",
            text_character_count=len(parsed["text"]),
            parser_metadata=parser_metadata,
            model_ids={
                "haiku": HAIKU_MODEL_ID,
                "sonnet": MODEL_ID,
            },
            parser_version="parser-test",
        )

        self.assertEqual(raw["project_id"], "Original_Draft.pdf")

        transaction = FakeTransaction()
        parent_ref = FakeReference({
            "source_file": "Original Draft.pdf",
            "version_count": 1,
        })
        version_ref = FakeReference()
        authority_ref = FakeReference()
        version_number = write_analysis_transaction(
            transaction,
            parent_ref,
            version_ref,
            authority_ref,
            raw,
            project_id=raw["project_id"],
            version_id=f"{CONTENT_HASH}_{QUEUED_AT_MS}",
            queued_at_ms=QUEUED_AT_MS,
        )

        self.assertEqual(version_number, 2)
        version_document = transaction.operations[0][2]
        parent_document = transaction.operations[2][2]
        self.assertEqual(version_document["source_file"], "Completely Renamed Draft.pdf")
        self.assertEqual(version_document["project_id"], "Original_Draft.pdf")
        self.assertEqual(parent_document["source_file"], "Original Draft.pdf")
        self.assertEqual(parent_document["latest_source_file"], "Completely Renamed Draft.pdf")
        self.assertEqual(parent_document["project_id"], "Original_Draft.pdf")

    def test_queue_target_reaches_the_versioned_writer_and_completion_record(self):
        heartbeat = MagicMock()
        written = []
        parsed = q2_parsed_source(page_count=100, word_count=20_000)
        analysis = prepare_q2_analysis(
            complete_analysis("Completely Renamed Draft"),
            {
                **parsed["metadata"],
                "page_count": parsed["page_count"],
                "word_count": parsed["word_count"],
                "character_count": len(parsed["text"]),
            },
        )
        fake_engine = SimpleNamespace(
            init_firebase=MagicMock(),
            parse_pdf=MagicMock(return_value=parsed),
            run_nonbinding_cold_read=MagicMock(return_value=(None, None)),
            run_v9_stable=MagicMock(return_value=(
                analysis,
                complete_usage(MODEL_ID),
            )),
            run_v9_hybrid=MagicMock(),
            run_claim_verification=MagicMock(return_value=(
                {},
                actual_ingest_v9.empty_usage(),
            )),
            merge_usage=actual_ingest_v9.merge_usage,
            empty_usage=actual_ingest_v9.empty_usage,
            write_to_firestore=MagicMock(return_value=True),
            to_doc_id=MagicMock(return_value="wrong-new-project"),
            MODEL_IDS={
                "haiku": HAIKU_MODEL_ID,
                "sonnet": MODEL_ID,
            },
            PARSER_VERSION="parser-test",
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
                    patch.object(
                        daemon,
                        "archive_pdf_version",
                        return_value=(
                            "gs://bucket/screenplays/Original_Draft.pdf/versions/"
                            f"{CONTENT_HASH}_{QUEUED_AT_MS}.pdf",
                            "2002",
                        ),
                    ) as archive_pdf,
                    patch.object(
                        daemon,
                        "load_calibration_profile",
                        return_value={
                            "prompt": "Favor emotional specificity.",
                            "provenance": {
                                "applied": True,
                                "profile_id": "admin",
                                "prompt_sha256": "ab" * 32,
                                "last_calibrated": "2026-07-21T12:00:00Z",
                                "total_reviews": 12,
                            },
                        },
                    ),
                    patch.object(daemon, "check_daily_budget_available"),
                    patch.object(
                        daemon,
                        "build_raw_document",
                        side_effect=lambda **kwargs: (
                            written.append(kwargs)
                            or {
                                "project_id": kwargs["target_project_id"],
                                "source_file": kwargs["filename"],
                                "storage_path": kwargs["storage_path"],
                                "storage_generation": kwargs["storage_generation"],
                                "calibration_profile": kwargs["calibration_provenance"],
                                "prompt_version": "test-prompt-version",
                            }
                        ),
                    ),
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
                self.assertEqual(written[0]["target_project_id"], "Original_Draft.pdf")
                self.assertEqual(written[0]["filename"], "Completely Renamed Draft.pdf")
                self.assertEqual(written[0]["storage_generation"], "2002")
                self.assertIn("/versions/", written[0]["storage_path"])
                self.assertEqual(
                    written[0]["calibration_provenance"]["prompt_sha256"],
                    "ab" * 32,
                )
                self.assertNotIn("prompt", written[0]["calibration_provenance"])
                self.assertEqual(
                    fake_engine.run_v9_stable.call_args.kwargs["calibration_prompt"],
                    "Favor emotional specificity.",
                )
                archive_pdf.assert_called_once_with(
                    storage_path="gs://bucket/ingest-queue/LEMON/upload/Renamed.pdf",
                    storage_generation="1001",
                    project_id="Original_Draft.pdf",
                    version_id=f"{CONTENT_HASH}_{QUEUED_AT_MS}",
                    content_hash=CONTENT_HASH,
                )
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
