import os
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault("DAEMON_LOG_DIR", "/tmp/lemon-daemon-test")

import daemon
from execution import ingest_v9
from execution.firebase_config import resolve_storage_bucket


class TestFirebaseBucketResolution(unittest.TestCase):
    def test_bucket_uses_production_default_and_environment_override(self):
        self.assertEqual(
            resolve_storage_bucket({}),
            "lemon-screenplay-dashboard.firebasestorage.app",
        )
        self.assertEqual(
            resolve_storage_bucket({
                "FIREBASE_STORAGE_BUCKET": "lemon-screenplays-test.example",
            }),
            "lemon-screenplays-test.example",
        )

    def test_cli_requests_the_resolved_bucket_even_when_admin_is_initialized(self):
        prior_db = ingest_v9._db
        prior_bucket = ingest_v9._bucket
        ingest_v9._db = None
        ingest_v9._bucket = None
        try:
            with (
                patch.dict(
                    os.environ,
                    {"FIREBASE_STORAGE_BUCKET": "cli-override.firebasestorage.app"},
                ),
                patch.object(ingest_v9, "FIREBASE_AVAILABLE", True),
                patch.object(ingest_v9.firebase_admin, "_apps", {"default": object()}),
                patch.object(ingest_v9.firestore, "client", return_value=MagicMock()),
                patch.object(
                    ingest_v9.fb_storage,
                    "bucket",
                    return_value=MagicMock(),
                ) as bucket,
            ):
                self.assertTrue(ingest_v9.init_firebase())

            bucket.assert_called_once_with("cli-override.firebasestorage.app")
        finally:
            ingest_v9._db = prior_db
            ingest_v9._bucket = prior_bucket

    def test_daemon_requests_its_named_bucket_even_when_admin_is_initialized(self):
        prior_db = daemon._db
        prior_bucket = daemon._bucket
        daemon._db = None
        daemon._bucket = None
        try:
            with (
                patch.object(daemon, "STORAGE_BUCKET", "daemon-override.firebasestorage.app"),
                patch.object(daemon.firebase_admin, "_apps", {"default": object()}),
                patch.object(daemon.fb_firestore, "client", return_value=MagicMock()),
                patch.object(
                    daemon.fb_storage,
                    "bucket",
                    return_value=MagicMock(),
                ) as bucket,
            ):
                daemon.init_firebase()

            bucket.assert_called_once_with("daemon-override.firebasestorage.app")
        finally:
            daemon._db = prior_db
            daemon._bucket = prior_bucket


if __name__ == "__main__":
    unittest.main()
