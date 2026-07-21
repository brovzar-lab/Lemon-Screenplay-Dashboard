import hashlib
import importlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from execution import ingest_v9


class TestParseCache(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.log_dir_patch = patch.object(ingest_v9, "LOG_DIR", self.root)
        self.log_dir_patch.start()
        self._reset_cleanup_state()

    def tearDown(self):
        self.log_dir_patch.stop()
        self.temp_dir.cleanup()

    @staticmethod
    def _reset_cleanup_state() -> None:
        if hasattr(ingest_v9, "_parse_cache_last_cleanup_at"):
            ingest_v9._parse_cache_last_cleanup_at = None
        if hasattr(ingest_v9, "_parse_cache_size_bytes"):
            ingest_v9._parse_cache_size_bytes = None

    def _pdf(self, directory: str, filename: str, content: bytes) -> Path:
        path = self.root / directory / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return path

    @staticmethod
    def _fake_parser(command, **_kwargs):
        input_path = Path(command[command.index("--input") + 1])
        output_dir = Path(command[command.index("--output") + 1])
        payload = input_path.read_bytes()
        marker = hashlib.sha256(payload).hexdigest()
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"{input_path.stem}.json"
        output_path.write_text(
            json.dumps(
                {
                    "filename": input_path.name,
                    "word_count": 600,
                    "page_count": 90,
                    "text": marker,
                }
            ),
            encoding="utf-8",
        )
        return SimpleNamespace(returncode=0, stderr="")

    def test_same_filename_with_different_bytes_is_parsed_twice(self):
        first_pdf = self._pdf("first", "Revision.pdf", b"first screenplay bytes")
        second_pdf = self._pdf("second", "Revision.pdf", b"second screenplay bytes")

        with patch("subprocess.run", side_effect=self._fake_parser) as run:
            first = ingest_v9.parse_pdf(first_pdf)
            second = ingest_v9.parse_pdf(second_pdf)

        self.assertEqual(run.call_count, 2)
        self.assertNotEqual(first["text"], second["text"])

    def test_same_bytes_with_different_filenames_reuse_one_parse(self):
        payload = b"identical screenplay bytes"
        first_pdf = self._pdf("first", "Draft One.pdf", payload)
        second_pdf = self._pdf("second", "Renamed Draft.pdf", payload)

        with patch("subprocess.run", side_effect=self._fake_parser) as run:
            first = ingest_v9.parse_pdf(first_pdf)
            second = ingest_v9.parse_pdf(second_pdf)

        self.assertEqual(run.call_count, 1)
        self.assertEqual(first["text"], second["text"])

    def test_parser_version_change_invalidates_cached_parse(self):
        pdf_path = self._pdf("source", "Draft.pdf", b"screenplay bytes")

        with patch("subprocess.run", side_effect=self._fake_parser) as run:
            with patch.object(ingest_v9, "PARSER_VERSION", "parser-a", create=True):
                ingest_v9.parse_pdf(pdf_path)
            with patch.object(ingest_v9, "PARSER_VERSION", "parser-b", create=True):
                ingest_v9.parse_pdf(pdf_path)

        self.assertEqual(run.call_count, 2)

    def test_cache_path_uses_parser_version_and_sha256(self):
        payload = b"cache identity bytes"
        pdf_path = self._pdf("source", "Draft.pdf", payload)
        expected_hash = hashlib.sha256(payload).hexdigest()

        with patch("subprocess.run", side_effect=self._fake_parser):
            ingest_v9.parse_pdf(pdf_path)

        cache_files = list((self.root / "parsed_v9").rglob("*.json"))
        self.assertEqual(len(cache_files), 1)
        self.assertEqual(cache_files[0].name, f"{expected_hash}.json")
        self.assertEqual(cache_files[0].parent.name, ingest_v9.PARSER_VERSION)

    def test_cleanup_removes_expired_files_then_oldest_to_enforce_size_cap(self):
        cache_dir = self.root / "cache"
        cache_dir.mkdir()
        stale = cache_dir / f"{'a' * 64}.json"
        oldest = cache_dir / f"{'b' * 64}.json"
        newest = cache_dir / f"{'c' * 64}.json"
        unsafe_filename_cache = cache_dir / "Draft.json"
        stale.write_bytes(b"s" * 8)
        oldest.write_bytes(b"o" * 12)
        newest.write_bytes(b"n" * 12)
        unsafe_filename_cache.write_bytes(b"legacy filename cache")
        os.utime(stale, (800, 800))
        os.utime(oldest, (950, 950))
        os.utime(newest, (990, 990))
        os.utime(unsafe_filename_cache, (990, 990))

        remaining_bytes = ingest_v9._cleanup_parse_cache(
            cache_dir,
            now=1_000,
            max_age_seconds=100,
            max_bytes=20,
        )

        self.assertFalse(stale.exists())
        self.assertFalse(oldest.exists())
        self.assertFalse(unsafe_filename_cache.exists())
        self.assertTrue(newest.exists())
        self.assertEqual(remaining_bytes, 12)

    def test_shared_hash_helper_matches_daemon_sha256_contract(self):
        identity = importlib.import_module("execution.content_identity")
        payload = b"same raw-byte hashing contract"
        pdf_path = self._pdf("source", "Draft.pdf", payload)

        self.assertEqual(
            identity.compute_content_hash(pdf_path),
            hashlib.sha256(payload).hexdigest(),
        )


if __name__ == "__main__":
    unittest.main()
