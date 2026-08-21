import hashlib
import tempfile
import unittest
from pathlib import Path

from execution.model_benchmark import BenchmarkSafetyError, _route_configs, _validated_inputs


class ModelBenchmarkSafetyTests(unittest.TestCase):
    def test_input_requires_exact_hash_approval(self):
        with tempfile.TemporaryDirectory() as directory:
            pdf = Path(directory) / "approved.pdf"
            pdf.write_bytes(b"%PDF-1.4 local fixture")
            digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
            record = _validated_inputs([str(pdf)], [digest])[0]
            self.assertEqual(record["content_sha256"], digest)
            with self.assertRaisesRegex(BenchmarkSafetyError, "not explicitly approved"):
                _validated_inputs([str(pdf)], ["00" * 32])

    def test_plan_records_old_and_candidate_routes(self):
        catalog = {
            "analysisRoutes": {
                "sonnet": {"modelId": "old-sonnet"},
                "opus": {"modelId": "old-opus"},
            },
            "activeHybridRoute": {"promotionVerdicts": ["RECOMMEND"]},
            "candidateAnalysisRoutes": {
                "sonnet": {"modelId": "new-sonnet"},
                "opus": {"modelId": "new-opus"},
                "hybrid": {"promotionVerdicts": ["RECOMMEND"]},
            },
        }
        routes = _route_configs(catalog, "all")
        self.assertEqual(len(routes), 6)
        self.assertEqual({route["generation"] for route in routes}, {"old", "candidate"})
