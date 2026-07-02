"""Tests for code-side verdict derivation (derive_verdict / compute_failure_penalty).

Run: python3 execution/test_verdict.py
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ingest_v9 import (  # noqa: E402
    _near_boundary,
    compute_failure_penalty,
    derive_verdict,
    select_stable_result,
)


def failures(*severities):
    return [{"description": "x", "severity": s, "penalty": 0} for s in severities]


class TestFailurePenalty(unittest.TestCase):
    def test_empty_and_malformed(self):
        self.assertEqual(compute_failure_penalty(None), 0.0)
        self.assertEqual(compute_failure_penalty([]), 0.0)
        self.assertEqual(compute_failure_penalty("nope"), 0.0)
        self.assertEqual(compute_failure_penalty(["not-a-dict", 42]), 0.0)

    def test_severity_map(self):
        self.assertEqual(compute_failure_penalty(failures("minor")), 0.3)
        self.assertEqual(compute_failure_penalty(failures("moderate")), 0.5)
        self.assertEqual(compute_failure_penalty(failures("major")), 0.8)
        self.assertEqual(compute_failure_penalty(failures("critical")), 1.2)
        self.assertEqual(compute_failure_penalty(failures("CRITICAL")), 1.2)

    def test_sum_and_cap(self):
        self.assertEqual(compute_failure_penalty(failures("critical", "major")), 2.0)
        # 3 criticals = 3.6 → capped at 3.0
        self.assertEqual(
            compute_failure_penalty(failures("critical", "critical", "critical")), 3.0
        )

    def test_unknown_severity_ignored(self):
        self.assertEqual(compute_failure_penalty(failures("catastrophic")), 0.0)


class TestThresholds(unittest.TestCase):
    def check(self, score, expected):
        self.assertEqual(derive_verdict(score)["verdict"], expected)

    def test_boundaries(self):
        self.check(5.49, "PASS")
        self.check(5.5, "CONSIDER")
        self.check(7.49, "CONSIDER")
        self.check(7.5, "RECOMMEND")
        self.check(8.49, "RECOMMEND")
        self.check(8.5, "FILM_NOW")
        self.check(10.0, "FILM_NOW")
        self.check(0.0, "PASS")


class TestPenaltyRestoredBug(unittest.TestCase):
    """The Reiner bug: a script docked for a critical failure was silently
    restored to its pure weighted sum by the code override, tipping it into
    RECOMMEND. The penalty must survive into the verdict."""

    def test_critical_failure_pulls_recommend_down(self):
        result = derive_verdict(7.5, critical_failures=failures("critical"))
        self.assertEqual(result["adjusted_score"], 6.3)
        self.assertEqual(result["verdict"], "CONSIDER")
        self.assertEqual(result["penalty"], 1.2)
        self.assertTrue(any("critical_failure_penalty" in a for a in result["adjustments"]))

    def test_no_failures_leaves_score_alone(self):
        result = derive_verdict(7.5)
        self.assertEqual(result["adjusted_score"], 7.5)
        self.assertEqual(result["verdict"], "RECOMMEND")
        self.assertEqual(result["adjustments"], [])


class TestGates(unittest.TestCase):
    def test_situation_caps_at_consider(self):
        result = derive_verdict(9.0, situation_verdict="situation")
        self.assertEqual(result["verdict"], "CONSIDER")
        self.assertEqual(result["verdict_before_gates"], "FILM_NOW")

    def test_situation_does_not_raise_pass(self):
        self.assertEqual(
            derive_verdict(4.0, situation_verdict="situation")["verdict"], "PASS"
        )

    def test_story_verdict_no_gate(self):
        self.assertEqual(
            derive_verdict(9.0, situation_verdict="story")["verdict"], "FILM_NOW"
        )

    def test_trap_two_downgrades_one_tier(self):
        self.assertEqual(derive_verdict(9.0, weighted_trap_score=2.0)["verdict"], "RECOMMEND")
        self.assertEqual(derive_verdict(7.6, weighted_trap_score=2.5)["verdict"], "CONSIDER")
        # PASS can't go lower
        self.assertEqual(derive_verdict(4.0, weighted_trap_score=2.0)["verdict"], "PASS")

    def test_trap_three_caps_at_consider(self):
        self.assertEqual(derive_verdict(9.0, weighted_trap_score=3.0)["verdict"], "CONSIDER")
        self.assertEqual(derive_verdict(9.0, weighted_trap_score=3.5)["verdict"], "CONSIDER")

    def test_truncation_caps_at_consider(self):
        result = derive_verdict(9.0, truncated=True)
        self.assertEqual(result["verdict"], "CONSIDER")
        self.assertTrue(any("truncated" in a for a in result["adjustments"]))

    def test_truncation_leaves_pass_alone(self):
        result = derive_verdict(4.0, truncated=True)
        self.assertEqual(result["verdict"], "PASS")
        self.assertEqual(result["adjustments"], [])


class TestCombined(unittest.TestCase):
    def test_penalty_then_gates(self):
        # 8.6 - 0.8 (major) = 7.8 RECOMMEND, then trap 2.0 downgrades → CONSIDER
        result = derive_verdict(
            8.6, critical_failures=failures("major"), weighted_trap_score=2.0
        )
        self.assertEqual(result["adjusted_score"], 7.8)
        self.assertEqual(result["verdict"], "CONSIDER")
        self.assertEqual(len(result["adjustments"]), 2)

    def test_adjustments_trail_is_readable(self):
        result = derive_verdict(
            9.0,
            critical_failures=failures("minor"),
            situation_verdict="situation",
            weighted_trap_score=3.0,
            truncated=True,
        )
        self.assertEqual(result["verdict"], "CONSIDER")
        # Only the first applicable cap records a change; later caps are no-ops
        self.assertTrue(any("story_vs_situation" in a for a in result["adjustments"]))


class TestNearBoundary(unittest.TestCase):
    def test_near_each_boundary(self):
        for b in (5.5, 7.5, 8.5):
            self.assertTrue(_near_boundary(b))
            self.assertTrue(_near_boundary(b - 0.49))
            self.assertTrue(_near_boundary(b + 0.49))
            self.assertFalse(_near_boundary(b - 0.5))
            self.assertFalse(_near_boundary(b + 0.5))

    def test_far_from_boundaries(self):
        for score in (0.0, 3.0, 6.5, 9.5, 10.0):
            self.assertFalse(_near_boundary(score))


def run(score, verdict, model="RECOMMEND"):
    return (score, {"verdict": verdict, "verdict_model": model, "verdict_adjustments": []})


class TestSelectStableResult(unittest.TestCase):
    def test_majority_verdict_and_median_run(self):
        runs = [run(7.3, "CONSIDER"), run(7.6, "RECOMMEND"), run(7.4, "CONSIDER")]
        final = select_stable_result(runs)
        # Median score is 7.4 → its run is the document; majority CONSIDER
        self.assertEqual(final["verdict"], "CONSIDER")
        self.assertEqual(final["_boundary_reruns"]["median_adjusted_score"], 7.4)
        self.assertEqual(final["_boundary_reruns"]["score_spread"], 0.3)

    def test_majority_overrides_median_runs_verdict(self):
        # Median-score run said RECOMMEND but 2 of 3 said CONSIDER
        runs = [run(7.2, "CONSIDER"), run(7.5, "RECOMMEND"), run(7.1, "CONSIDER")]
        final = select_stable_result(runs)
        self.assertEqual(final["_boundary_reruns"]["median_adjusted_score"], 7.2)
        self.assertEqual(final["verdict"], "CONSIDER")

    def test_majority_override_is_recorded(self):
        runs = [run(7.6, "RECOMMEND"), run(7.4, "CONSIDER"), run(7.8, "RECOMMEND")]
        final = select_stable_result(runs)
        # Median 7.6 = RECOMMEND, majority RECOMMEND — no override note
        self.assertEqual(final["verdict"], "RECOMMEND")
        runs2 = [run(5.6, "CONSIDER"), run(5.4, "PASS"), run(5.3, "PASS")]
        final2 = select_stable_result(runs2)
        self.assertEqual(final2["verdict"], "PASS")

    def test_no_majority_keeps_median_verdict(self):
        runs = [run(8.4, "RECOMMEND"), run(8.6, "FILM_NOW"), run(7.4, "CONSIDER")]
        final = select_stable_result(runs)
        # All three differ; median score 8.4 → RECOMMEND stands
        self.assertEqual(final["verdict"], "RECOMMEND")

    def test_metadata_captures_all_runs(self):
        runs = [run(7.3, "CONSIDER"), run(7.6, "RECOMMEND"), run(7.4, "CONSIDER")]
        final = select_stable_result(runs)
        meta = final["_boundary_reruns"]
        self.assertTrue(meta["triggered"])
        self.assertEqual(len(meta["runs"]), 3)
        self.assertEqual(meta["final_verdict"], final["verdict"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
