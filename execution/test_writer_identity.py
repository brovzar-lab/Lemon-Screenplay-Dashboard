import os
import tempfile
import unittest
from pathlib import Path

os.environ.setdefault("DAEMON_LOG_DIR", "/tmp/lemon-daemon-test")

import daemon
from execution import ingest_v9
from execution.content_identity import build_version_id


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
            analysis={"title": "Renamed Draft"},
            usage={"input_tokens": 10, "output_tokens": 5},
            job_id="job-123",
            content_hash=CONTENT_HASH,
            queued_at_ms=QUEUED_AT_MS,
            tmdb_status=None,
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = Path(temp_dir) / "Renamed Draft.pdf"
            pdf_path.write_bytes(b"writer parity fixture")
            cli_doc = ingest_v9.build_raw_document(
                pdf_path=pdf_path,
                parsed={"page_count": 101, "word_count": 22_000},
                analysis={"title": "Renamed Draft"},
                collection="LEMON",
                model_key="sonnet",
                mode="full",
                total_usage={"input_tokens": 10, "output_tokens": 5},
                total_duration_ms=1_000,
                content_hash=CONTENT_HASH,
                queued_at_ms=QUEUED_AT_MS,
            )

        daemon_identity = {key: daemon_doc[key] for key in EXPECTED_IDENTITY}
        cli_identity = {key: cli_doc[key] for key in EXPECTED_IDENTITY}
        self.assertEqual(daemon_identity, EXPECTED_IDENTITY)
        self.assertEqual(cli_identity, EXPECTED_IDENTITY)
        self.assertEqual(daemon_identity, cli_identity)
        self.assertEqual(daemon_doc["queued_at_ms"], QUEUED_AT_MS)
        self.assertEqual(cli_doc["queued_at_ms"], QUEUED_AT_MS)
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
                )


if __name__ == "__main__":
    unittest.main()
