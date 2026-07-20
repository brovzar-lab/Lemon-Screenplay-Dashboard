import os
import sys
import types
import unittest
from unittest.mock import Mock, patch

os.environ.setdefault("DAEMON_LOG_DIR", "/tmp/lemon-daemon-test")
os.environ.setdefault("DAEMON_ORPHAN_SWEEP_INTERVAL", "1")

# The watchdog itself has no Firebase dependency. Stub the Admin SDK so this
# focused unit test can import daemon.py without production credentials/packages.
firebase_admin = types.ModuleType("firebase_admin")
firebase_admin._apps = []
firebase_admin.credentials = types.ModuleType("credentials")
firebase_admin.firestore = types.ModuleType("firestore")
firebase_admin.storage = types.ModuleType("storage")
sys.modules["firebase_admin"] = firebase_admin

import daemon  # noqa: E402


class TestOrphanWatchdog(unittest.TestCase):
    def test_repeats_sweeps_until_shutdown(self):
        stop_event = Mock()
        stop_event.wait.side_effect = [False, False, True]

        with patch.object(daemon, "sweep_orphaned_jobs") as sweep:
            daemon.run_orphan_watchdog(stop_event)

        self.assertEqual(sweep.call_count, 2)
        stop_event.wait.assert_called_with(timeout=daemon.ORPHAN_SWEEP_SECS)


if __name__ == "__main__":
    unittest.main()
