import hashlib
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

os.environ.setdefault("DAEMON_LOG_DIR", tempfile.gettempdir())

import daemon
from execution import ingest_v9
from execution.v9_test_fixtures import (
    MODEL_ID,
    MODEL_IDS as TEST_MODEL_IDS,
    complete_analysis,
    complete_usage,
)


class ArchivePdfTests(unittest.TestCase):
    def setUp(self):
        self.bucket = MagicMock()
        self.bucket.name = "source-bucket"
        self.source = MagicMock()
        self.source.name = "ingest-queue/LEMON/upload-id/Draft.pdf"
        self.destination = MagicMock()
        self.destination.name = (
            "screenplays/Original_Draft.pdf/versions/" + "ab" * 32 + "_1000.pdf"
        )
        self.destination.exists.return_value = False
        self.archived = MagicMock()
        self.archived.name = self.destination.name
        self.archived.generation = 4321
        self.archived.metadata = {}
        self.bucket.copy_blob.return_value = self.archived

        def blob(name, generation=None):
            if name == self.source.name:
                self.source.generation = generation
                return self.source
            if name == self.destination.name:
                return self.destination
            raise AssertionError(f"Unexpected blob: {name}")

        self.bucket.blob.side_effect = blob

    def test_archives_to_the_immutable_project_version_path(self):
        with patch.object(daemon, "storage_bucket_for_path", return_value=self.bucket):
            path, generation = daemon.archive_pdf_version(
                storage_path=f"gs://source-bucket/{self.source.name}",
                storage_generation="998877",
                project_id="Original_Draft.pdf",
                version_id=f"{'ab' * 32}_1000",
                content_hash="ab" * 32,
            )

        self.assertEqual(
            path,
            f"gs://source-bucket/{self.destination.name}",
        )
        self.assertEqual(generation, "4321")
        self.assertEqual(self.source.generation, 998877)
        self.bucket.copy_blob.assert_called_once()

    def test_retry_reuses_an_existing_matching_archive(self):
        archived_bytes = b"already archived exact PDF"
        content_hash = hashlib.sha256(archived_bytes).hexdigest()
        version_id = f"{content_hash}_1000"
        self.destination.name = (
            f"screenplays/Original_Draft.pdf/versions/{version_id}.pdf"
        )
        self.destination.exists.return_value = True
        self.destination.generation = 4321
        self.destination.download_as_bytes.return_value = archived_bytes
        self.destination.metadata = {
            "content_hash": content_hash,
            "project_id": "Original_Draft.pdf",
            "version_id": version_id,
            "source_path": self.source.name,
            "source_generation": "998877",
        }
        with patch.object(daemon, "storage_bucket_for_path", return_value=self.bucket):
            path, generation = daemon.archive_pdf_version(
                storage_path=f"gs://source-bucket/{self.source.name}",
                storage_generation="998877",
                project_id="Original_Draft.pdf",
                version_id=version_id,
                content_hash=content_hash,
            )

        self.assertEqual(path, f"gs://source-bucket/{self.destination.name}")
        self.assertEqual(generation, "4321")
        self.destination.download_as_bytes.assert_called_once_with(
            if_generation_match=4321
        )
        self.bucket.copy_blob.assert_not_called()

    def test_retry_rejects_existing_archive_with_different_bytes(self):
        expected_bytes = b"expected exact PDF"
        content_hash = hashlib.sha256(expected_bytes).hexdigest()
        version_id = f"{content_hash}_1000"
        self.destination.name = (
            f"screenplays/Original_Draft.pdf/versions/{version_id}.pdf"
        )
        self.destination.exists.return_value = True
        self.destination.generation = 4321
        self.destination.download_as_bytes.return_value = b"different PDF"
        self.destination.metadata = {"content_hash": content_hash}

        with patch.object(daemon, "storage_bucket_for_path", return_value=self.bucket):
            with self.assertRaisesRegex(RuntimeError, "bytes do not match"):
                daemon.archive_pdf_version(
                    storage_path=f"gs://source-bucket/{self.source.name}",
                    storage_generation="998877",
                    project_id="Original_Draft.pdf",
                    version_id=version_id,
                    content_hash=content_hash,
                )

    def test_existing_firestore_version_rehashes_the_exact_archived_generation(self):
        archived_bytes = b"committed immutable PDF"
        content_hash = hashlib.sha256(archived_bytes).hexdigest()
        version_id = f"{content_hash}_1000"
        object_name = (
            f"screenplays/Original_Draft.pdf/versions/{version_id}.pdf"
        )
        archived = MagicMock()
        archived.download_as_bytes.return_value = archived_bytes
        self.bucket.blob.side_effect = None
        self.bucket.blob.return_value = archived

        with patch.object(daemon, "storage_bucket_for_path", return_value=self.bucket):
            daemon.verify_archived_pdf_version(
                storage_path=f"gs://source-bucket/{object_name}",
                storage_generation="4321",
                project_id="Original_Draft.pdf",
                version_id=version_id,
                content_hash=content_hash,
            )

        self.bucket.blob.assert_called_once_with(object_name, generation=4321)
        archived.download_as_bytes.assert_called_once_with(
            if_generation_match=4321
        )

    def test_existing_firestore_version_rejects_archive_byte_drift(self):
        expected_bytes = b"committed immutable PDF"
        content_hash = hashlib.sha256(expected_bytes).hexdigest()
        version_id = f"{content_hash}_1000"
        object_name = (
            f"screenplays/Original_Draft.pdf/versions/{version_id}.pdf"
        )
        archived = MagicMock()
        archived.download_as_bytes.return_value = b"tampered PDF"
        self.bucket.blob.side_effect = None
        self.bucket.blob.return_value = archived

        with patch.object(daemon, "storage_bucket_for_path", return_value=self.bucket):
            with self.assertRaisesRegex(RuntimeError, "bytes do not match"):
                daemon.verify_archived_pdf_version(
                    storage_path=f"gs://source-bucket/{object_name}",
                    storage_generation="4321",
                    project_id="Original_Draft.pdf",
                    version_id=version_id,
                    content_hash=content_hash,
                )

    def test_parent_document_marks_the_archived_pdf_available(self):
        raw = daemon.build_raw_document(
            filename="Draft.pdf",
            model_key="sonnet",
            collection_id="LEMON",
            page_count=100,
            word_count=20_000,
            analysis=complete_analysis("Draft"),
            usage=complete_usage(),
            job_id="job-1",
            content_hash="ab" * 32,
            queued_at_ms=1000,
            tmdb_status=None,
            target_project_id="Original_Draft.pdf",
            storage_path=(
                "gs://source-bucket/screenplays/Original_Draft.pdf/versions/"
                f"{'ab' * 32}_1000.pdf"
            ),
            storage_generation="4321",
            text_character_count=120_000,
            parser_metadata={
                "extraction_method": "pdfplumber",
                "parser_version": "v2",
            },
            model_ids=TEST_MODEL_IDS,
            parser_version=ingest_v9.PARSER_VERSION,
        )

        self.assertTrue(raw["hasPdf"])
        self.assertEqual(raw["storage_generation"], "4321")
        self.assertIn("/versions/", raw["storage_path"])


if __name__ == "__main__":
    unittest.main()
