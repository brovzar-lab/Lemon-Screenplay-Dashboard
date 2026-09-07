"""No-network JSON persistence regressions, including the private paid response."""
import copy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parent))
import coverage_v1 as cv

PRIVATE = Path(__file__).resolve().parents[1] / 'benchmark-artifacts/cosquillitas-review-only-aae1ac6'
CAPTURE = PRIVATE / 'settled-output/94e235c77fd8e21798d9db6d1970a5fec95efd77a6491239c7fba4398d2c93a0/transport_review.json'


class CheckpointHashingTests(unittest.TestCase):
    def round_trip(self, payload, binding):
        with tempfile.TemporaryDirectory() as directory:
            store = cv.LocalCheckpointStore(Path(directory))
            key = 'a' * 64
            store.save(key, 'transport_review', cv._sealed_record(binding, payload))
            restored = cv.LocalCheckpointStore(Path(directory)).load(key, 'transport_review')
            return cv._verified_payload(restored, binding, 'transport_review')

    def test_transport_tuple_survives_json_without_changing_its_fingerprint(self):
        payload = {'result': ({'issues': []}, '', {'exact_cost_variance_usd': 0.0,
                                                'nested': [(1.0, 0.086491)]})}
        original = copy.deepcopy(payload)
        restored = self.round_trip(payload, {'engine': 'offline-fixture'})
        self.assertEqual(restored, json.loads(json.dumps(payload)))
        self.assertEqual(payload, original)

    def test_existing_json_only_fingerprints_do_not_change(self):
        self.assertEqual(
            cv.canonical_json_hash({'zero': 0.0, 'values': [1.0, 1.25, True, None]}),
            'd12370afbf37d310b0c142a86404aafff16c59320df9e57eec1ec246042cdc3c',
        )

    def test_changed_usage_or_binding_is_still_rejected(self):
        binding = {'engine': 'offline-fixture'}
        original = cv._sealed_record(binding, {'result': (None, '', {'cost': 0.0})})
        restored = json.loads(json.dumps(original))
        restored['payload']['result'][2]['cost'] = 1
        with self.assertRaises(cv.CheckpointTamperedError):
            cv._verified_payload(restored, binding, 'transport_review')
        with self.assertRaises(cv.CheckpointTamperedError):
            cv._verified_payload(json.loads(json.dumps(original)),
                                 {'engine': 'another-release'}, 'transport_review')

    @unittest.skipUnless(CAPTURE.exists(), 'Private paid fixture is intentionally not in Git')
    def test_saved_paid_response_round_trips_without_rewriting_original_evidence(self):
        before = CAPTURE.read_bytes()
        self.assertEqual(hashlib.sha256(before).hexdigest(),
                         '3da39a4955092981cbfaa2697bdaf7a530a9957400509d76a7abad0d6d61bd20')
        record = json.loads(before)
        # The old bad wrapper must remain rejected, not retroactively blessed.
        with self.assertRaises(cv.CheckpointTamperedError):
            cv._verified_payload(record, record['binding'], 'transport_review')
        payload = copy.deepcopy(record['payload'])
        payload['result'] = tuple(payload['result'])
        restored = self.round_trip(payload, record['binding'])
        self.assertEqual(restored, record['payload'])
        self.assertEqual(restored['result'][2]['actual_cost_microusd'], 86491)
        self.assertEqual(CAPTURE.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
