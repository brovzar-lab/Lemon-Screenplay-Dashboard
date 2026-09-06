"""No-network checks at the bounded reader's public transport/checkpoint seam."""
import copy
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import coverage_v1 as legacy
import coverage_reader as reader
from test_coverage_v1 import SCREENPLAY_TEXT, FEATURE_STACK, valid_coverage, settled_usage


class MemoryStore(legacy.CheckpointStore):
    def __init__(self):
        self.records = {}

    def load(self, key, stage):
        return copy.deepcopy(self.records.get((key, stage)))

    def save(self, key, stage, record):
        self.records[key, stage] = copy.deepcopy(record)


def review():
    return {
        "screenplay_read": True, "ending_checked": True,
        "existing_setup_checked": True, "citations_checked": True,
        "consistency_checked": True, "issues": [],
        "summary": "No material factual issue located in this independent pass.",
    }


class BoundedReaderTests(unittest.TestCase):
    def run_reader(self, outputs, store=None, **kwargs):
        requests = []

        def transport(**request):
            requests.append(request)
            value = outputs.pop(0)
            if isinstance(value, BaseException):
                raise value
            return copy.deepcopy(value), "", settled_usage()

        result = reader.run_coverage_v1(
            text=SCREENPLAY_TEXT, title="Offline fixture", page_count=6,
            word_count=500, content_sha256="a" * 64, parser_version=kwargs.pop('parser_version', 'fixture-v1'),
            checkpoint_store=store or MemoryStore(), transport=transport,
            max_cost_usd=2.0, **kwargs,
        )
        return result, requests

    def test_two_call_report_and_zero_call_publication_replay(self):
        store = MemoryStore()
        (report, usage), requests = self.run_reader([valid_coverage(), review()], store)
        self.assertEqual(report["status"], "sealed")
        self.assertEqual(len(requests), 2)
        self.assertEqual(usage["call_count"], 2)
        self.assertNotIn("support_rate", report.get("fact_audit", {}))
        self.assertEqual(report["engine_version"], "coverage-v1.2-bounded-1")
        (replayed, usage), requests = self.run_reader([], store)
        self.assertEqual(replayed, report)
        self.assertEqual(requests, [])
        self.assertEqual(usage["call_count"], 0)

    def test_unavailable_review_preserves_draft_without_another_call(self):
        store = MemoryStore()
        (report, _), requests = self.run_reader([valid_coverage(), TimeoutError("transport interrupted")], store)
        self.assertEqual(report["status"], "needs_review")
        self.assertEqual(report["coverage"]["synopsis"], valid_coverage()["synopsis"])
        self.assertEqual(len(requests), 2)
        self.assertTrue(report["accounting"]["reservation_pending"])
        (_, _), requests = self.run_reader([], store)
        self.assertEqual(requests, [])

    def test_one_shared_structure_correction_before_final_review(self):
        broken = valid_coverage()
        broken["verdict"] = "INVALID"
        (report, _), requests = self.run_reader([broken, valid_coverage(), review()])
        self.assertEqual(report["status"], "sealed")
        self.assertEqual(len(requests), 3)

    def test_uncertain_and_contradicted_facts_remain_review_not_repurchased(self):
        audit = review()
        audit["issues"] = [{"field": "story_spine.ending", "category": "factual",
            "severity": "major", "note": "The ending requires the human reader's decision.",
            "page": 0, "excerpt": ""}]
        (report, _), requests = self.run_reader([valid_coverage(), audit])
        self.assertEqual(report["status"], "needs_review")
        self.assertEqual(len(requests), 2)
        self.assertEqual(report["independent_review"], audit)

    def test_taste_disagreement_does_not_block_or_change_the_verdict(self):
        audit = review()
        audit["issues"] = [{"field": "development_priorities", "category": "interpretation",
            "severity": "minor", "note": "A different pacing choice is also defensible.",
            "page": 0, "excerpt": ""}]
        (report, _), _ = self.run_reader([valid_coverage(), audit])
        self.assertEqual(report["status"], "sealed")
        self.assertEqual(report["coverage"]["verdict"], valid_coverage()["verdict"])

    def test_not_applicable_lenses_do_not_require_invented_quotes(self):
        coverage = valid_coverage()
        coverage["lens_notes"][-1].update(grade="not_applicable", page=0, excerpt="")
        (report, _), requests = self.run_reader([coverage, review()])
        self.assertEqual(report["status"], "sealed")
        self.assertEqual(len(requests), 2)
        self.assertEqual(report["coverage"]["lens_notes"][-1]["grade"], "not_applicable")

    def test_impossible_page_cannot_become_ready(self):
        coverage = valid_coverage()
        coverage["story_spine"]["major_turns"][0]["page"] = 900
        (report, _), _ = self.run_reader([coverage, coverage, review()])
        self.assertEqual(report["status"], "needs_review")
        self.assertTrue(any("page" in issue.lower() for issue in report["review_reasons"]))

    def test_a_caller_cannot_expand_the_three_call_contract(self):
        with self.assertRaises(ValueError):
            self.run_reader([], max_calls=17)

    def test_settlement_save_failure_recovers_the_receipt_without_repurchasing(self):
        class InterruptedStore(MemoryStore):
            interrupted = False

            def save(self, key, stage, record):
                payload = record['payload']
                if (stage == 'budget' and payload.get('calls_started') == 2
                        and payload.get('in_flight') is None and not self.interrupted):
                    self.interrupted = True
                    raise OSError('simulated lost settlement acknowledgment')
                super().save(key, stage, record)

        store = InterruptedStore()
        (report, _), requests = self.run_reader([valid_coverage(), review()], store)
        budget = next(record['payload'] for (_, stage), record in store.records.items() if stage == 'budget')
        self.assertEqual(len(requests), 2)
        self.assertIsNone(budget['in_flight'])
        self.assertEqual(budget['usage']['call_count'], 2)
        self.assertFalse(report['accounting']['reservation_pending'])
        self.assertEqual(report['status'], 'sealed')
        (replayed, usage), requests = self.run_reader([], store)
        self.assertEqual(replayed, report)
        self.assertEqual(usage['call_count'], 0)
        self.assertEqual(requests, [])

    def test_reviewer_checks_the_final_normalized_citations(self):
        coverage = valid_coverage()
        true_page = coverage['strengths'][0]['page']
        coverage['strengths'][0]['page'] = 5 if true_page != 5 else 2
        (report, _), requests = self.run_reader([coverage, review()])
        reviewed = json.loads(requests[-1]['user_blocks'][-1]['text'].split('Coverage to review:\n')[1])
        self.assertEqual(reviewed['strengths'][0]['page'], true_page)
        self.assertEqual(report['coverage'], reviewed)

    def test_empty_substantive_fields_never_seal(self):
        coverage = valid_coverage()
        coverage['lens_notes'][0]['analysis'] = ''
        (report, _), requests = self.run_reader([coverage, coverage, review()])
        self.assertEqual(report['status'], 'needs_review')
        self.assertLessEqual(len(requests), 3)
        self.assertEqual(requests[1]['stage'], 'coverage_reader.correction')

    def test_approved_cosquillitas_findings_stay_visible_without_semantic_retry_loop(self):
        fixture = json.loads((Path(__file__).parent / 'fixtures/cosquillitas_call12_regression.json').read_text())
        audit = review()
        audit['issues'] = [
            {'field': 'concerns', 'category': 'factual', 'severity': 'major',
             'note': 'The approved evidence registry establishes the camera, knowledge and provenance; only activation remains unresolved.', 'page': 0, 'excerpt': ''},
            {'field': 'story_spine.climax', 'category': 'factual', 'severity': 'major',
             'note': 'Preserve the approved literal order: ' + ' '.join(fixture['literal_climax_and_ending'][5:11]), 'page': 0, 'excerpt': ''},
        ]
        (report, _), requests = self.run_reader([valid_coverage(), audit])
        self.assertEqual(len(requests), 2)
        self.assertEqual(report['status'], 'needs_review')
        self.assertEqual(report['independent_review']['issues'], audit['issues'])
        self.assertEqual(report['coverage']['verdict'], valid_coverage()['verdict'])

    def test_unknown_score_fields_are_not_published_even_when_correction_is_unavailable(self):
        coverage = valid_coverage()
        coverage['screenplay_score'] = 9.8
        (report, _), _ = self.run_reader([coverage, TimeoutError('offline')])
        self.assertEqual(report['status'], 'needs_review')
        self.assertNotIn('screenplay_score', report['coverage'])

    def test_a_tampered_draft_cannot_be_replayed(self):
        store = MemoryStore()
        self.run_reader([valid_coverage(), review()], store)
        key, stage = next((key, stage) for key, stage in store.records if stage == 'draft')
        store.records[key, stage]['payload']['coverage']['verdict'] = 'PASS'
        # Remove only this in-memory publication fixture to exercise draft integrity.
        store.records.pop((key, 'report'))
        with self.assertRaises(legacy.CheckpointTamperedError):
            self.run_reader([], store)

    def test_changed_parser_cannot_hide_an_unsettled_source_reservation(self):
        store = MemoryStore()
        with self.assertRaises(legacy.CoverageUnresolvedSpendError):
            self.run_reader([TimeoutError('lost provider response')], store)
        with self.assertRaises(legacy.CheckpointTamperedError):
            self.run_reader([valid_coverage(), review()], store, parser_version='changed-parser')

    def test_malformed_usage_keeps_the_reservation_and_prevents_new_calls(self):
        for bad in ({}, {**settled_usage(), 'actual_cost_microusd': -1},
                    {**settled_usage(), 'calls': []}):
            with self.subTest(usage=bad):
                store = MemoryStore()
                with patch(__name__ + '.settled_usage', return_value=bad):
                    with self.assertRaises(legacy.CoverageUnresolvedSpendError):
                        self.run_reader([valid_coverage()], store)
                budget = next(record['payload'] for (_, stage), record in store.records.items() if stage == 'budget')
                self.assertIsNotNone(budget['in_flight'])
                self.assertEqual(budget['calls_started'], 1)
                with self.assertRaises(legacy.CoverageBudgetExceededError):
                    self.run_reader([], store)


if __name__ == "__main__":
    unittest.main()
