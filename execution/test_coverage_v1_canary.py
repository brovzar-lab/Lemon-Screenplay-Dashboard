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
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))

import coverage_v1 as cv  # noqa: E402
import coverage_v1_canary as canary  # noqa: E402
from test_coverage_v1 import (  # noqa: E402
    CALL12_FIXTURE,
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

    def test_qualification_manifest_binds_audit_ledger_and_sources(self):
        root = Path(tempfile.mkdtemp())
        entries = make_pdfs(root, 1)
        entries[0]["content_sha256"] = canary.compute_content_hash(
            Path(entries[0]["pdf"])
        )
        ledger = root / "approved-ledger.json"
        ledger.write_text('{"approved":true}', encoding="utf-8")
        manifest = root / "qualification.json"
        manifest.write_text(json.dumps({
            "schema_version": canary.QUALIFICATION_MANIFEST_VERSION,
            "qualification": {
                "minimum_ready": 1,
                "required_ready_titles": ["Guión 1"],
                "max_calls_per_script": canary.MAX_CANARY_CALLS_PER_SCRIPT,
                "max_total_usd": 1.5,
                "max_script_usd": 1.5,
                "approved_audit_ledger": {
                    "path": ledger.name,
                    "sha256": canary.compute_content_hash(ledger),
                },
            },
            "scripts": entries,
        }), encoding="utf-8")

        loaded_entries, qualification = canary.load_manifest(manifest)

        self.assertEqual(loaded_entries, entries)
        self.assertTrue(
            qualification["approved_audit_ledger"]["verified"]
        )
        ledger.write_text('{"approved":false}', encoding="utf-8")
        with self.assertRaises(canary.CanaryError):
            canary.load_manifest(manifest)

    def test_paid_qualification_checks_every_source_hash_before_inference(self):
        root = Path(tempfile.mkdtemp())
        entries = make_pdfs(root, 2)
        for entry in entries:
            entry["content_sha256"] = canary.compute_content_hash(
                Path(entry["pdf"])
            )
        entries[1]["content_sha256"] = "0" * 64
        transport_calls = []

        with self.assertRaises(canary.CanaryError):
            canary.run_canary(
                entries,
                out_dir=root / "out",
                execute=True,
                transport=lambda **kwargs: transport_calls.append(kwargs),
                parse_fn=fake_parse,
                parser_version="test-parser",
                qualification={
                    "minimum_ready": 1,
                    "required_ready_titles": ["Guión 1"],
                },
            )

        self.assertEqual(transport_calls, [])


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
        self.assertTrue(bars["within_configured_call_cap"])
        self.assertTrue(bars["ready_reports_zero_unverified_citations"])
        self.assertTrue(bars["every_report_sealed"])
        self.assertTrue(bars["ready_reports_zero_unresolved_evidence"])
        self.assertTrue(bars["ready_reports_citation_integrity_verified"])
        self.assertTrue(
            bars["ready_reports_zero_focused_evidence_contradictions"]
        )
        self.assertTrue(bars["all_reports_zero_unresolved_evidence"])
        self.assertTrue(bars["all_reports_citation_integrity_verified"])
        self.assertTrue(bars["release_quality_passed"])
        self.assertTrue(bars["resume_repaid_nothing"])
        self.assertTrue(bars["invocation_settled_cost_target_060"])

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
        ], 7))
        self.assertFalse(canary._within_call_ceiling([
            {"cost": {"call_count": 8}},
        ], 7))

    def test_scorecard_names_configured_cap_and_disabled_checks_truthfully(self):
        scorecard, _transport, _root = self.run_batch(
            1, resume_drill_index=0, max_calls_per_script=11
        )

        self.assertEqual(scorecard["configured_max_calls_per_script"], 11)
        self.assertEqual(
            scorecard["resume_drill"],
            {"status": "not_run", "repaid_nothing": None},
        )
        row = scorecard["scripts"][0]
        self.assertIn("fact_audit_support_rate", row)
        self.assertNotIn("support_rate", row)
        self.assertIn("invocation_cost", row)
        bars = scorecard["automated_bars"]
        self.assertTrue(bars["within_configured_call_cap"])
        self.assertNotIn("max_seven_calls_per_script", bars)
        self.assertIsNone(bars["resume_repaid_nothing"])
        self.assertTrue(bars["invocation_settled_cost_target_060"])
        self.assertNotIn("settled_cost_target_060", bars)

    def test_gold_qualification_allows_two_safe_review_reports(self):
        required = [f"Script {index}" for index in range(1, 8)]
        rows = []
        for index in range(1, 21):
            sealed = index <= 18
            rows.append({
                "title": f"Script {index}",
                "status": "sealed" if sealed else "needs_review",
                "cost": {"call_count": 2},
                "citations_unverified": 0,
                "release_quality": {
                    "sealed": sealed,
                    "central_failures": 0 if sealed else 1,
                    "unresolved_evidence": 0 if sealed else 1,
                    "citation_integrity_verified": sealed,
                    "focused_evidence_contradictions": 0,
                },
            })
        policy = {
            "minimum_ready": 18,
            "required_ready_titles": required,
        }

        bars = canary._release_quality_bars(rows, policy)

        self.assertFalse(bars["every_report_sealed"])
        self.assertEqual(bars["ready_count"], 18)
        self.assertEqual(bars["needs_review_count"], 2)
        self.assertTrue(bars["all_required_titles_ready"])
        self.assertTrue(bars["only_safe_terminal_states"])
        self.assertTrue(bars["ready_reports_zero_unresolved_evidence"])
        self.assertTrue(bars["ready_reports_citation_integrity_verified"])
        self.assertFalse(bars["all_reports_zero_unresolved_evidence"])
        self.assertFalse(bars["all_reports_citation_integrity_verified"])
        self.assertTrue(bars["release_quality_passed"])

        rows[0]["status"] = "needs_review"
        rows[18]["status"] = "sealed"
        rows[18]["release_quality"] = {
            "sealed": True,
            "central_failures": 0,
            "unresolved_evidence": 0,
            "citation_integrity_verified": True,
            "focused_evidence_contradictions": 0,
        }
        required_bars = canary._release_quality_bars(rows, policy)
        self.assertFalse(required_bars["all_required_titles_ready"])
        self.assertFalse(required_bars["release_quality_passed"])

    def test_call12_shaped_report_fails_release_quality_bars(self):
        report = CALL12_FIXTURE["quality_snapshot"]

        quality = canary._report_quality(report)

        self.assertFalse(quality["sealed"])
        self.assertEqual(quality["unresolved_evidence"], 1)
        self.assertFalse(quality["citation_integrity_verified"])
        self.assertEqual(quality["focused_evidence_contradictions"], 1)

        report = {
            **report,
            "verdict": "CONSIDER",
            "confidence": "medium",
            "film_now_nominated": False,
            "human_review_recommended": True,
            "review_reasons": ["sequence evidence is unresolved"],
            "cost": {
                "charged_usd": 0.28,
                "settled_usd": 0.28,
                "uncertain_usd": 0.0,
                "call_count": 2,
            },
            "coverage": valid_coverage(),
        }
        report["fact_audit"] = {
            **report["fact_audit"],
            "support_rate": 0.8409,
        }
        report["citation_verification"] = {
            **report["citation_verification"],
            "total": 10,
        }
        root = Path(tempfile.mkdtemp())
        with patch.object(
            canary.coverage_v1,
            "run_coverage_v1",
            return_value=(report, {
                "actual_cost_microusd": 280_000,
                "call_count": 2,
                "calls": [],
            }),
        ):
            scorecard = canary.run_canary(
                make_pdfs(root, 1),
                out_dir=root / "out",
                execute=True,
                transport=lambda **_kwargs: None,
                parse_fn=fake_parse,
                parser_version="test-parser",
                resume_drill_index=0,
            )

        self.assertFalse(scorecard["automated_bars"]["release_quality_passed"])
        self.assertTrue(any(
            "release quality bars failed" in failure
            for failure in scorecard["hard_failures"]
        ))

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
            prior_charged_usd=0.2,
            prior_call_count=1,
            resume_drill_index=99,
        )
        self.assertEqual(scorecard2["scripts"][0]["status"], "sealed")
        self.assertEqual(len(second.calls), 1)
        self.assertAlmostEqual(
            scorecard2["scripts"][0]["cost"]["charged_usd"], 0.26
        )
        self.assertAlmostEqual(
            scorecard2["scripts"][0]["invocation_cost"]["charged_usd"],
            0.06,
        )
        self.assertAlmostEqual(scorecard2["totals"]["charged_usd"], 0.26)
        self.assertEqual(scorecard2["totals"]["call_count"], 2)

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

    def test_prior_settled_spend_reduces_batch_headroom(self):
        root = Path(tempfile.mkdtemp())
        transport_calls = []

        scorecard = canary.run_canary(
            make_pdfs(root, 1),
            out_dir=root / "out",
            execute=True,
            transport=lambda **kwargs: transport_calls.append(kwargs),
            parse_fn=fake_parse,
            parser_version="test-parser",
            max_total_usd=1.5,
            max_script_usd=1.0,
            prior_charged_usd=0.6,
            prior_call_count=3,
            resume_drill_index=0,
        )

        self.assertEqual(transport_calls, [])
        self.assertEqual(
            scorecard["scripts"][0]["status"], "refused_batch_cap"
        )
        self.assertEqual(scorecard["totals"]["charged_usd"], 0.6)
        self.assertEqual(scorecard["totals"]["settled_usd"], 0.6)
        self.assertEqual(scorecard["totals"]["call_count"], 3)

    def test_required_failure_stops_and_persists_progress(self):
        root = Path(tempfile.mkdtemp())
        entries = make_pdfs(root, 2)
        for entry in entries:
            entry["content_sha256"] = canary.compute_content_hash(
                Path(entry["pdf"])
            )
        policy = {
            "minimum_ready": 1,
            "required_ready_titles": ["Guión 1"],
        }

        with patch.object(
            canary.coverage_v1,
            "run_coverage_v1",
            side_effect=cv.CoverageContractError("literal sequence failed"),
        ) as run:
            scorecard = canary.run_canary(
                entries,
                out_dir=root / "out",
                execute=True,
                transport=lambda **_kwargs: None,
                parse_fn=fake_parse,
                parser_version="test-parser",
                max_total_usd=3.0,
                max_script_usd=1.5,
                qualification=policy,
                resume_drill_index=0,
            )

        self.assertEqual(run.call_count, 1)
        self.assertEqual(len(scorecard["scripts"]), 1)
        self.assertIn("required screenplay Guión 1", scorecard[
            "stopped_early_reason"
        ])
        progress = json.loads(
            (root / "out" / "progress.json").read_text(encoding="utf-8")
        )
        self.assertEqual(progress["scripts"][0]["status"], "failed_closed")
        self.assertEqual(progress["run_status"], "finished")

    def test_required_needs_review_makes_qualification_unrecoverable(self):
        reason = canary._qualification_stop_reason(
            [{"title": "Cosquillitas", "status": "needs_review"}],
            20,
            {
                "minimum_ready": 18,
                "required_ready_titles": ["Cosquillitas"],
            },
        )

        self.assertIn("required screenplay Cosquillitas", reason)

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
