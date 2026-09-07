"""No-network private-worker ownership checks."""
import os
import tempfile
import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta, timezone

os.environ.setdefault("DAEMON_LOG_DIR", tempfile.gettempdir())
import daemon


class RolloutOwnershipTests(unittest.TestCase):
    def test_stale_normal_worker_cannot_park_or_fail_a_newly_bound_pilot(self):
        db = MagicMock()
        ref = db.collection.return_value.document.return_value
        ref.get.return_value.exists = True
        ref.get.return_value.to_dict.return_value = {"status": "pending", "rollout_id": "new-pilot"}
        with patch.dict(os.environ, {"LEMON_PILOT_ROLLOUT_ID": ""}), \
                patch.object(daemon, "_db", db), \
                patch.object(daemon.fb_firestore, "transactional", side_effect=lambda f: f):
            daemon.mark_waiting_for_engine("one", pending_only=True)
            daemon.mark_terminal_failed("one", ValueError("old snapshot"), pending_only=True)
            daemon.mark_needs_review("one", "old dependency", pending_only=True)
        db.transaction.return_value.update.assert_not_called()
        ref.update.assert_not_called()

    def test_pilot_and_normal_workers_are_disjoint(self):
        env = {"LEMON_PILOT_ROLLOUT_ID": "five", "LEMON_PILOT_JOB_IDS": "one",
               "LEMON_RELEASE_SHA": "a" * 40}
        job = {"rollout_id": "five", "rollout_release_sha": "a" * 40,
               "engine": "coverage_v1", "rollout_enabled": True}
        with patch.dict(os.environ, env):
            self.assertTrue(daemon.owns_rollout_job("one", job))
            for other in ({}, {**job, "rollout_enabled": False}, {**job, "engine": "v9"},
                          {**job, "rollout_release_sha": "b" * 40}):
                self.assertFalse(daemon.owns_rollout_job("one", other))
            self.assertFalse(daemon.owns_rollout_job("two", job))
            with patch.object(daemon, "download_pdf") as download:
                daemon.process_job({"id": "unrelated", "engine": "v9"})
                download.assert_not_called()
        with patch.dict(os.environ, {"LEMON_PILOT_ROLLOUT_ID": ""}):
            self.assertTrue(daemon.owns_rollout_job("ordinary", {"engine": "v9"}))
            self.assertFalse(daemon.owns_rollout_job("one", job))

    def test_checkout_must_match_and_be_clean(self):
        with patch.dict(os.environ, {"LEMON_PILOT_ROLLOUT_ID": "five", "LEMON_RELEASE_SHA": "a" * 40}), \
                patch.object(daemon, "CONCURRENCY", 1):
            for outputs in [("b" * 40, ""), ("a" * 40, " M daemon.py")]:
                with patch.object(daemon.subprocess, "check_output", side_effect=outputs):
                    with self.assertRaises(daemon.TerminalJobError):
                        daemon.verify_pilot_checkout()

    def test_fresh_transactional_ownership_blocks_claim_resume_and_orphan_mutation(self):
        env = {"LEMON_PILOT_ROLLOUT_ID": "five", "LEMON_PILOT_JOB_IDS": "one",
               "LEMON_RELEASE_SHA": "a" * 40, "LEMON_ENGINE_COVERAGE_V1": "1"}
        base = {"rollout_id": "five", "rollout_release_sha": "a" * 40,
                "engine": "coverage_v1", "rollout_enabled": True}
        db = MagicMock()
        ref = MagicMock(id="one")
        initial = MagicMock(id="one", reference=ref)
        fresh = MagicMock(id="one", exists=True)
        ref.get.return_value = fresh
        cutoff = datetime.now(timezone.utc)
        with patch.dict(os.environ, env), patch.object(daemon, "_db", db), \
                patch.object(daemon.fb_firestore, "transactional", side_effect=lambda f: f), \
                patch.object(daemon, "pilot_job_snapshots", return_value=[initial]), \
                patch.object(daemon, "verify_pilot_checkout"):
            for status in ("pending", "waiting_for_engine", "waiting_for_budget", "processing"):
                initial.to_dict.return_value = {**base, "status": status}
                fresh.to_dict.return_value = {
                    **base, "status": status, "rollout_enabled": False,
                    "budget_resume_at": cutoff - timedelta(days=1),
                    "last_heartbeat_at": cutoff - timedelta(days=1),
                }
                fresh.get.side_effect = lambda key: fresh.to_dict.return_value.get(key)
                if status == "pending":
                    self.assertIsNone(daemon.claim_pending_job())
                elif status == "waiting_for_engine":
                    self.assertEqual(daemon.resume_waiting_for_engine_jobs(), 0)
                elif status == "waiting_for_budget":
                    self.assertEqual(daemon.resume_due_budget_jobs(cutoff), 0)
                else:
                    self.assertEqual(daemon.recover_orphaned_job(ref, cutoff), "unchanged")
                db.transaction.return_value.update.assert_not_called()


if __name__ == "__main__":
    unittest.main()
