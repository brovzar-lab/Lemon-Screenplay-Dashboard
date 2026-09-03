"""Offline tests for the coverage_v1 canary runner.

Run: python3 -m execution.test_coverage_v1_canary
No network, no PROXY_SERVICE_KEY, no paid or subscription inference — the
transport and parser are always local fakes.
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import coverage_v1 as cv  # noqa: E402
import coverage_v1_canary as canary  # noqa: E402
from test_coverage_v1 import (  # noqa: E402
    SCREENPLAY_TEXT,
    FakeTransport,
    settled_usage,
    supported_audit,
    valid_coverage,
)


def fake_parse(_pdf_path, _content_hash):
    return {"text": SCREENPLAY_TEXT, "page_count": 6, "word_count": 380}


def make_pdfs(root: Path, count: int):
    entries = []
    for i in range(1, count + 1):
        pdf = root / f"script-{i}.pdf"
        pdf.write_bytes(f"%PDF-1.4 fake screenplay {i}".encode("utf-8"))
        entries.append({"pdf": str(pdf), "title": f"Guión {i}"})
    return entries


def paid_responses(script_count: int, drill_index: int = 2):
    """Scripted responses in transport order for a clean batch with a drill.

    Per normal script: coverage, audit. The drill script's kill run consumes
    only its coverage call; the resume run consumes only the audit.
    """
    responses = []
    for i in range(1, script_count + 1):
        coverage = valid_coverage()
        responses.append((coverage, settled_usage(200_000)))
        responses.append((supported_audit(coverage), settled_usage(80_000)))
    return responses


class DryRunTests(unittest.TestCase):
    def test_dry_run_plans_without_any_transport(self):
        root = Path(tempfile.mkdtemp())
        entries = make_pdfs(root, 3)
        scorecard = canary.run_canary(
            entries,
            out_dir=root / "out",
            execute=False,
            parse_fn=fake_parse,
            parser_version="test-parser",
        )
        self.assertEqual(scorecard["mode"], "dry_run")
        self.assertEqual(
            [s["status"] for s in scorecard["scripts"]], ["planned"] * 3
        )
        self.assertTrue(all(s["lens_stack"] for s in scorecard["scripts"]))
        self.assertEqual(scorecard["totals"]["call_count"], 0)
        self.assertFalse(scorecard["hard_failures"])
        self.assertTrue((root / "out" / "scorecard.json").is_file())

    def test_missing_pdf_is_a_hard_failure(self):
        root = Path(tempfile.mkdtemp())
        scorecard = canary.run_canary(
            [{"pdf": str(root / "nope.pdf"), "title": "Fantasma"}],
            out_dir=root / "out",
            execute=False,
            parse_fn=fake_parse,
            parser_version="test-parser",
        )
        self.assertEqual(scorecard["scripts"][0]["status"], "missing_pdf")
        self.assertTrue(scorecard["hard_failures"])

    def test_execute_without_service_key_refuses_before_any_call(self):
        root = Path(tempfile.mkdtemp())
        entries = make_pdfs(root, 1)
        import os

        self.assertIsNone(os.getenv("PROXY_SERVICE_KEY"))
        with self.assertRaises(canary.CanaryError):
            canary.run_canary(
                entries,
                out_dir=root / "out",
                execute=True,
                parse_fn=fake_parse,
                parser_version="test-parser",
            )


class PaidBatchTests(unittest.TestCase):
    def run_batch(self, script_count=3, **overrides):
        root = Path(tempfile.mkdtemp())
        entries = make_pdfs(root, script_count)
        transport = FakeTransport(paid_responses(script_count))
        kwargs = dict(
            out_dir=root / "out",
            execute=True,
            transport=transport,
            parse_fn=fake_parse,
            parser_version="test-parser",
            max_total_usd=10.0,
            max_script_usd=1.5,
        )
        kwargs.update(overrides)
        scorecard = canary.run_canary(entries, **kwargs)
        return scorecard, transport, root

    def test_clean_batch_with_resume_drill(self):
        scorecard, transport, root = self.run_batch(3)
        self.assertFalse(scorecard["hard_failures"])
        self.assertEqual(
            [s["status"] for s in scorecard["scripts"]], ["sealed"] * 3
        )
        # 3 scripts × 2 calls; the drill's induced kill costs no extra call.
        self.assertEqual(len(transport.calls), 6)

        drill = scorecard["resume_drill"]
        self.assertTrue(drill["repaid_nothing"])
        self.assertTrue(drill["resumed_coverage_replayed"])
        self.assertEqual(drill["resume_run_call_count"], 1)
        self.assertEqual(drill["killed_after_calls"], 1)

        # The drill script's cost includes the killed run's coverage charge.
        drill_row = scorecard["scripts"][1]
        self.assertAlmostEqual(drill_row["cost"]["charged_usd"], 0.28)
        self.assertEqual(drill_row["cost"]["call_count"], 2)
        self.assertAlmostEqual(scorecard["totals"]["charged_usd"], 0.84)
        self.assertEqual(scorecard["totals"]["call_count"], 6)

        bars = scorecard["automated_bars"]
        self.assertTrue(bars["batch_within_authorization"])
        self.assertTrue(bars["every_script_within_cap"])
        self.assertTrue(bars["max_seven_calls_per_script"])
        self.assertTrue(bars["zero_unverified_citations"])
        self.assertTrue(bars["resume_repaid_nothing"])
        self.assertTrue(bars["settled_cost_target_060"])

        # Reports were written for every script.
        reports = sorted((root / "out" / "reports").glob("*.json"))
        self.assertEqual(len(reports), 3)
        first = json.loads(reports[0].read_text(encoding="utf-8"))
        self.assertEqual(first["analysis_version"], "coverage_v1")
        self.assertEqual(len(first["coverage"]["development_priorities"]), 3)

    def test_v12_call_ceiling_accepts_required_paths_but_not_retries(self):
        self.assertTrue(canary._within_call_ceiling([
            {"cost": {"call_count": 3}},
            {"cost": {"call_count": 6}},
            {"cost": {"call_count": 7}},
        ]))
        self.assertFalse(canary._within_call_ceiling([
            {"cost": {"call_count": 8}},
        ]))

    def test_unknown_spend_stops_batch_and_charges_full_reserve(self):
        class UnknownSpendTransport:
            def __init__(self):
                self.calls = []

            def __call__(self, **kwargs):
                self.calls.append(kwargs)
                raise OSError("connection ended after dispatch")

        root = Path(tempfile.mkdtemp())
        transport = UnknownSpendTransport()
        scorecard = canary.run_canary(
            make_pdfs(root, 2),
            out_dir=root / "out",
            execute=True,
            transport=transport,
            parse_fn=fake_parse,
            parser_version="test-parser",
            max_total_usd=3.0,
            max_script_usd=1.5,
            resume_drill_index=99,
        )

        self.assertEqual(len(transport.calls), 1)
        self.assertEqual(len(scorecard["scripts"]), 1)
        self.assertEqual(
            scorecard["scripts"][0]["status"],
            "failed_closed_unknown_spend",
        )
        self.assertGreater(scorecard["totals"]["uncertain_usd"], 0)
        self.assertLessEqual(scorecard["totals"]["charged_usd"], 1.5)

    def test_checkpoints_survive_across_canary_invocations(self):
        # Live failure 2026-09-01: the store lived INSIDE the per-run
        # artifacts dir, so a failed run's paid coverage was re-bought by
        # the next invocation. The store is now shared across runs.
        root = Path(tempfile.mkdtemp())
        entries = make_pdfs(root, 1)
        coverage = valid_coverage()
        first = FakeTransport(
            [
                (coverage, settled_usage(200_000)),
                RuntimeError("audit stopped before dispatch"),
            ]
        )
        scorecard1 = canary.run_canary(
            entries,
            out_dir=root / "run-1",
            execute=True,
            transport=first,
            parse_fn=fake_parse,
            parser_version="test-parser",
            resume_drill_index=99,
        )
        self.assertEqual(scorecard1["scripts"][0]["status"], "failed_closed")

        # Second invocation, different out_dir: coverage must replay free —
        # the transport only carries the audit response.
        second = FakeTransport([(supported_audit(coverage), settled_usage())])
        scorecard2 = canary.run_canary(
            entries,
            out_dir=root / "run-2",
            execute=True,
            transport=second,
            parse_fn=fake_parse,
            parser_version="test-parser",
            resume_drill_index=99,
        )
        self.assertEqual(scorecard2["scripts"][0]["status"], "sealed")
        self.assertEqual(len(second.calls), 1)

    def test_batch_cap_refuses_scripts_it_cannot_cover(self):
        # $0.28 per script; cap the batch so the third script is refused.
        scorecard, transport, _root = self.run_batch(
            3, max_total_usd=1.9, max_script_usd=1.5
        )
        statuses = [s["status"] for s in scorecard["scripts"]]
        self.assertEqual(statuses[:2], ["sealed", "sealed"])
        self.assertEqual(statuses[2], "refused_batch_cap")
        self.assertEqual(len(transport.calls), 4)
        self.assertTrue(
            any("refused" in failure for failure in scorecard["hard_failures"])
        )

    def test_contract_failure_charges_are_still_counted(self):
        root = Path(tempfile.mkdtemp())
        entries = make_pdfs(root, 1)
        broken = valid_coverage()
        del broken["development_priorities"]
        transport = FakeTransport(
            [
                (broken, settled_usage(200_000)),
                (broken, settled_usage(50_000)),
            ]
        )
        scorecard = canary.run_canary(
            entries,
            out_dir=root / "out",
            execute=True,
            transport=transport,
            parse_fn=fake_parse,
            parser_version="test-parser",
            resume_drill_index=99,
        )
        row = scorecard["scripts"][0]
        self.assertEqual(row["status"], "failed_closed")
        self.assertAlmostEqual(row["charged_usd_before_failure"], 0.25)
        self.assertAlmostEqual(scorecard["totals"]["charged_usd"], 0.25)
        self.assertAlmostEqual(scorecard["totals"]["settled_usd"], 0.25)
        self.assertEqual(scorecard["totals"]["call_count"], 2)
        self.assertAlmostEqual(row["cost_before_failure"]["settled_usd"], 0.25)
        self.assertTrue(scorecard["hard_failures"])


class CliTests(unittest.TestCase):
    def test_execute_flag_alone_is_refused(self):
        root = Path(tempfile.mkdtemp())
        manifest = root / "canary.json"
        manifest.write_text(
            json.dumps(make_pdfs(root, 1)), encoding="utf-8"
        )
        exit_code = canary.main(["--manifest", str(manifest), "--execute"])
        self.assertEqual(exit_code, 2)


if __name__ == "__main__":
    unittest.main(verbosity=1)
