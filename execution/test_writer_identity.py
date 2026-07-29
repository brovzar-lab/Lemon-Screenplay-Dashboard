import hashlib
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

os.environ.setdefault("DAEMON_LOG_DIR", "/tmp/lemon-daemon-test")

import daemon
from execution import ingest_v9
from execution.content_identity import build_version_id
from execution.v9_test_fixtures import (
    MODEL_ID,
    MODEL_IDS as TEST_MODEL_IDS,
    complete_analysis,
    complete_usage,
)


CONTENT_HASH = "ab" * 32
QUEUED_AT_MS = 1_784_588_800_123
EXPECTED_IDENTITY = {
    "content_hash": CONTENT_HASH,
    "identity_status": "verified",
}


class TestWriterIdentityParity(unittest.TestCase):
    def test_daemon_and_cli_builders_emit_the_same_verified_identity(self):
        daemon_doc = daemon.build_raw_document(
            filename="Renamed Draft.pdf",
            model_key="sonnet",
            collection_id="LEMON",
            page_count=101,
            word_count=22_000,
            analysis=complete_analysis("Renamed Draft"),
            usage=complete_usage(),
            job_id="job-123",
            content_hash=CONTENT_HASH,
            queued_at_ms=QUEUED_AT_MS,
            tmdb_status=None,
            target_project_id="Renamed_Draft.pdf",
            storage_path=(
                "gs://bucket/screenplays/Renamed_Draft.pdf/versions/"
                f"{CONTENT_HASH}_{QUEUED_AT_MS}.pdf"
            ),
            storage_generation="2002",
            text_character_count=123_456,
            parser_metadata={
                "extraction_method": "pdfplumber",
                "parser_version": "v2",
            },
            model_ids=TEST_MODEL_IDS,
            parser_version=ingest_v9.PARSER_VERSION,
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "Renamed Draft.pdf"
            pdf_path.write_bytes(b"writer parity fixture")
            cli_doc = ingest_v9.build_raw_document(
                pdf_path=pdf_path,
                parsed={
                    "text": "A" * 123_456,
                    "page_count": 101,
                    "word_count": 22_000,
                    "metadata": {
                        "extraction_method": "pdfplumber",
                        "parser_version": "v2",
                    },
                },
                analysis=complete_analysis("Renamed Draft"),
                collection="LEMON",
                model_key="sonnet",
                mode="full",
                total_usage=complete_usage(),
                total_duration_ms=1_000,
                content_hash=CONTENT_HASH,
                queued_at_ms=QUEUED_AT_MS,
                storage_path=(
                    "gs://bucket/screenplays/Renamed_Draft.pdf/versions/"
                    f"{CONTENT_HASH}_{QUEUED_AT_MS}.pdf"
                ),
                storage_generation="2002",
            )

        daemon_identity = {key: daemon_doc[key] for key in EXPECTED_IDENTITY}
        cli_identity = {key: cli_doc[key] for key in EXPECTED_IDENTITY}
        self.assertEqual(daemon_identity, EXPECTED_IDENTITY)
        self.assertEqual(cli_identity, EXPECTED_IDENTITY)
        self.assertEqual(daemon_identity, cli_identity)
        self.assertEqual(daemon_doc["queued_at_ms"], QUEUED_AT_MS)
        self.assertEqual(cli_doc["queued_at_ms"], QUEUED_AT_MS)
        self.assertTrue(cli_doc["v9_meta"]["ingested_at"].endswith("Z"))
        self.assertEqual(
            build_version_id(daemon_doc["content_hash"], daemon_doc["queued_at_ms"]),
            build_version_id(cli_doc["content_hash"], cli_doc["queued_at_ms"]),
        )

    def test_both_python_builders_reject_an_invalid_hash(self):
        with self.assertRaises(ValueError):
            daemon.build_raw_document(
                filename="Draft.pdf",
                model_key="sonnet",
                collection_id="LEMON",
                page_count=1,
                word_count=500,
                analysis={},
                usage={},
                job_id="job-123",
                content_hash="not-a-hash",
                queued_at_ms=QUEUED_AT_MS,
                tmdb_status=None,
                target_project_id="Draft.pdf",
                model_ids=TEST_MODEL_IDS,
                parser_version=ingest_v9.PARSER_VERSION,
            )

        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "Draft.pdf"
            pdf_path.write_bytes(b"fixture")
            with self.assertRaises(ValueError):
                ingest_v9.build_raw_document(
                    pdf_path=pdf_path,
                    parsed={},
                    analysis={},
                    collection="LEMON",
                    model_key="sonnet",
                    mode="full",
                    total_usage={},
                    total_duration_ms=1,
                    content_hash="not-a-hash",
                    queued_at_ms=QUEUED_AT_MS,
                    storage_path="gs://bucket/invalid.pdf",
                    storage_generation="1",
                )


class TestCliImmutableArchive(unittest.TestCase):
    def test_cli_persistence_failure_is_reported_and_retains_recovery_copy(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "Draft.pdf"
            recovery_root = Path(temp_dir) / "logs"
            with patch.object(
                ingest_v9,
                "write_to_firestore",
                return_value=False,
            ), patch.object(
                ingest_v9,
                "LOG_DIR",
                recovery_root,
            ):
                persisted = ingest_v9.persist_analysis_or_save_fallback(
                    {"project_id": "Draft.pdf", "analysis": {"verdict": "PASS"}},
                    pdf_path,
                )

            self.assertFalse(persisted)
            recovery_path = recovery_root / "failed_writes" / "Draft.json"
            self.assertTrue(recovery_path.exists())
            self.assertIn('"verdict": "PASS"', recovery_path.read_text())

    def test_cli_archives_source_before_permanent_analysis(self):
        prior_bucket = ingest_v9._bucket
        bucket = MagicMock()
        bucket.name = "lemon-bucket"
        blob = bucket.blob.return_value
        blob.exists.return_value = False
        blob.generation = 4321
        ingest_v9._bucket = bucket
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                pdf_path = Path(temp_dir) / "Draft.pdf"
                pdf_path.write_bytes(b"immutable source")
                archive_hash = ingest_v9.compute_content_hash(pdf_path)
                archive_version = f"{archive_hash}_{QUEUED_AT_MS}"
                storage_path, generation = ingest_v9.archive_cli_pdf_version(
                    pdf_path,
                    project_id="Draft.pdf",
                    version_id=archive_version,
                    content_hash=archive_hash,
                )
        finally:
            ingest_v9._bucket = prior_bucket

        self.assertEqual(
            storage_path,
            (
                "gs://lemon-bucket/screenplays/Draft.pdf/versions/"
                f"{archive_version}.pdf"
            ),
        )
        self.assertEqual(generation, "4321")
        blob.upload_from_string.assert_called_once()
        self.assertEqual(
            blob.upload_from_string.call_args.kwargs["if_generation_match"],
            0,
        )
        self.assertEqual(
            blob.metadata["content_hash"],
            archive_hash,
        )

    def test_cli_refuses_an_archive_collision(self):
        prior_bucket = ingest_v9._bucket
        bucket = MagicMock()
        bucket.name = "lemon-bucket"
        blob = bucket.blob.return_value
        blob.upload_from_string.side_effect = ingest_v9.PreconditionFailed(
            "archive race"
        )
        ingest_v9._bucket = bucket
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                pdf_path = Path(temp_dir) / "Draft.pdf"
                pdf_path.write_bytes(b"immutable source")
                archive_hash = ingest_v9.compute_content_hash(pdf_path)
                archive_version = f"{archive_hash}_{QUEUED_AT_MS}"
                blob.metadata = {
                    "content_hash": "ef" * 32,
                    "project_id": "Draft.pdf",
                    "version_id": archive_version,
                    "writer": "ingest_v9.py",
                }
                blob.generation = 4321
                blob.download_as_bytes.return_value = b"immutable source"
                conflicting_metadata = dict(blob.metadata)
                blob.reload.side_effect = lambda: setattr(
                    blob,
                    "metadata",
                    conflicting_metadata,
                )
                with self.assertRaisesRegex(RuntimeError, "conflicting provenance"):
                    ingest_v9.archive_cli_pdf_version(
                        pdf_path,
                        project_id="Draft.pdf",
                        version_id=archive_version,
                        content_hash=archive_hash,
                    )
        finally:
            ingest_v9._bucket = prior_bucket

    def test_cli_retry_reuses_only_the_same_archived_bytes(self):
        prior_bucket = ingest_v9._bucket
        bucket = MagicMock()
        bucket.name = "lemon-bucket"
        blob = bucket.blob.return_value
        blob.upload_from_string.side_effect = ingest_v9.PreconditionFailed(
            "archive already exists"
        )
        blob.generation = 4321
        archived_bytes = b"immutable source"
        archive_hash = hashlib.sha256(archived_bytes).hexdigest()
        archive_version = f"{archive_hash}_{QUEUED_AT_MS}"
        blob.metadata = {
            "content_hash": archive_hash,
            "project_id": "Draft.pdf",
            "version_id": archive_version,
            "writer": "ingest_v9.py",
        }
        blob.download_as_bytes.return_value = archived_bytes
        ingest_v9._bucket = bucket
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                pdf_path = Path(temp_dir) / "Draft.pdf"
                pdf_path.write_bytes(archived_bytes)
                storage_path, generation = ingest_v9.archive_cli_pdf_version(
                    pdf_path,
                    project_id="Draft.pdf",
                    version_id=archive_version,
                    content_hash=archive_hash,
                )
        finally:
            ingest_v9._bucket = prior_bucket

        self.assertEqual(
            storage_path,
            (
                "gs://lemon-bucket/screenplays/Draft.pdf/versions/"
                f"{archive_version}.pdf"
            ),
        )
        self.assertEqual(generation, "4321")
        blob.download_as_bytes.assert_called_once_with(if_generation_match=4321)

    def test_cli_retry_rejects_existing_archive_with_different_bytes(self):
        prior_bucket = ingest_v9._bucket
        bucket = MagicMock()
        bucket.name = "lemon-bucket"
        blob = bucket.blob.return_value
        blob.upload_from_string.side_effect = ingest_v9.PreconditionFailed(
            "archive already exists"
        )
        blob.generation = 4321
        archived_bytes = b"immutable source"
        archive_hash = hashlib.sha256(archived_bytes).hexdigest()
        archive_version = f"{archive_hash}_{QUEUED_AT_MS}"
        blob.metadata = {
            "content_hash": archive_hash,
            "project_id": "Draft.pdf",
            "version_id": archive_version,
            "writer": "ingest_v9.py",
        }
        blob.download_as_bytes.return_value = b"different archived PDF"
        ingest_v9._bucket = bucket
        try:
            with tempfile.TemporaryDirectory() as temp_dir:
                pdf_path = Path(temp_dir) / "Draft.pdf"
                pdf_path.write_bytes(archived_bytes)
                with self.assertRaisesRegex(RuntimeError, "bytes do not match"):
                    ingest_v9.archive_cli_pdf_version(
                        pdf_path,
                        project_id="Draft.pdf",
                        version_id=archive_version,
                        content_hash=archive_hash,
                    )
        finally:
            ingest_v9._bucket = prior_bucket


if __name__ == "__main__":
    unittest.main()
