import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

os.environ.setdefault("DAEMON_LOG_DIR", tempfile.gettempdir())

import daemon


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
        self.destination.exists.return_value = True
        self.destination.generation = 4321
        self.destination.metadata = {
            "content_hash": "ab" * 32,
            "source_generation": "998877",
        }
        with patch.object(daemon, "storage_bucket_for_path", return_value=self.bucket):
            path, generation = daemon.archive_pdf_version(
                storage_path=f"gs://source-bucket/{self.source.name}",
                storage_generation="998877",
                project_id="Original_Draft.pdf",
                version_id=f"{'ab' * 32}_1000",
                content_hash="ab" * 32,
            )

        self.assertEqual(path, f"gs://source-bucket/{self.destination.name}")
        self.assertEqual(generation, "4321")
        self.bucket.copy_blob.assert_not_called()

    def test_parent_document_marks_the_archived_pdf_available(self):
        raw = daemon.build_raw_document(
            filename="Draft.pdf",
            model_key="sonnet",
            collection_id="LEMON",
            page_count=100,
            word_count=20_000,
            analysis={"title": "Draft"},
            usage={},
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
        )

        self.assertTrue(raw["hasPdf"])
        self.assertEqual(raw["storage_generation"], "4321")
        self.assertIn("/versions/", raw["storage_path"])


if __name__ == "__main__":
    unittest.main()
