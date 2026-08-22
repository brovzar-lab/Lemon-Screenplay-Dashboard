import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from execution.model_benchmark import (
    BenchmarkSafetyError,
    _load_engine,
    _route_configs,
    _run_smoke,
    _smoke_route_configs,
    _validate_candidate_proxy,
    _validated_inputs,
)


class ModelBenchmarkSafetyTests(unittest.TestCase):
    def test_benchmark_engine_blocks_every_remote_persistence_entry(self):
        from execution import ingest_v9

        names = (
            "init_firebase",
            "write_analysis_transaction",
            "write_to_firestore",
            "persist_analysis_or_save_fallback",
            "archive_cli_pdf_version",
            "check_already_in_firestore",
        )
        originals = {name: getattr(ingest_v9, name) for name in names}
        with tempfile.TemporaryDirectory() as directory:
            try:
                engine = _load_engine(Path(directory))
                for name in names:
                    with self.assertRaisesRegex(BenchmarkSafetyError, "persistence is disabled"):
                        getattr(engine, name)()
            finally:
                for name, original in originals.items():
                    setattr(ingest_v9, name, original)

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

    def test_smoke_plan_calls_only_the_three_approved_accessibility_models(self):
        catalog = {
            "analysisRoutes": {"haiku": {"modelId": "claude-haiku-4-5-20251001"}},
            "candidateAnalysisRoutes": {
                "sonnet": {"modelId": "claude-sonnet-5"},
                "opus": {"modelId": "claude-opus-5"},
            },
        }
        routes = _smoke_route_configs(catalog)
        self.assertEqual(
            [route["model_id"] for route in routes],
            ["claude-haiku-4-5-20251001", "claude-sonnet-5", "claude-opus-5"],
        )

    def test_smoke_request_sends_hash_but_no_screenplay_text_or_filename(self):
        response = Mock(status_code=200)
        response.json.return_value = {
            "text": "READY",
            "model": "claude-sonnet-5",
            "response_id": "msg_smoke",
            "stop_reason": "end_turn",
            "usage": {"actual_cost_usd": 0.0001},
            "release": {"git_sha": "d" * 40},
        }

        class DirectCap:
            @staticmethod
            def call(original, _model_ids, **kwargs):
                return original(**kwargs)

        run = {
            "model_id": "claude-sonnet-5",
            "route": "sonnet",
            "generation": "candidate",
            "pipeline_stage": "reader",
            "reader_name": "structure",
        }
        with patch("execution.model_benchmark.requests.post", return_value=response) as post:
            _run_smoke(
                run,
                {"content_sha256": "a" * 64, "filename": "SECRET.pdf"},
                "https://example.run.app/llmProxyCandidate",
                DirectCap(),
                "staging-smoke",
                lambda: "short-lived",
            )
        sent = post.call_args.kwargs["json"]
        self.assertEqual(sent["benchmark"]["screenplay_sha256"], "a" * 64)
        self.assertNotIn("SECRET", str(sent))
        self.assertNotIn("screenplay", sent["messages"][0]["content"].lower())

    def test_paid_url_accepts_only_the_dedicated_candidate(self):
        self.assertFalse(_validate_candidate_proxy(
            "http://127.0.0.1:5001/project/us-central1/llmProxyCandidate"
        ))
        self.assertTrue(_validate_candidate_proxy(
            "https://us-central1-project.cloudfunctions.net/llmProxyCandidate"
        ))
        with self.assertRaisesRegex(BenchmarkSafetyError, "dedicated"):
            _validate_candidate_proxy(
                "https://us-central1-project.cloudfunctions.net/llmProxy"
            )

    def test_online_transport_uses_stable_call_ids_and_one_http_attempt(self):
        from execution import ingest_v9

        context = {
            "run_id": "staging-smoke",
            "screenplay_sha256": "a" * 64,
            "route": "sonnet",
            "generation": "candidate",
            "prompt_bundle_sha256": "b" * 64,
            "structured_output_schema_sha256": "c" * 64,
        }
        response = Mock(status_code=200)
        response.json.return_value = {
            "text": "ok",
            "tool_uses": [],
            "model": "claude-sonnet-5",
            "response_id": "msg_test",
            "stop_reason": "end_turn",
            "usage": {
                "input_tokens": 1,
                "output_tokens": 1,
                "cache_creation_input_tokens": 0,
                "cache_read_input_tokens": 0,
                "call_count": 1,
                "actual_cost_microusd": 12,
                "actual_cost_usd": 0.000012,
            },
            "release": {"git_sha": "d" * 40},
        }
        original = ingest_v9.MODEL_IDS["sonnet"]
        ingest_v9.MODEL_IDS["sonnet"] = "claude-sonnet-5"
        ingest_v9.configure_benchmark_online_transport(context, lambda: "short-lived")
        try:
            with patch.object(ingest_v9.requests, "post", return_value=response) as post:
                first = ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "user"}],
                    model_key="sonnet",
                    retries=3,
                    stage="reader",
                    reader_name="structure",
                    boundary_run=1,
                    logical_retry=0,
                )
                first_id = post.call_args.kwargs["json"]["benchmark"]["call_id"]
                ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "user"}],
                    model_key="sonnet",
                    retries=3,
                    stage="reader",
                    reader_name="structure",
                    boundary_run=1,
                    logical_retry=1,
                )
                second_id = post.call_args.kwargs["json"]["benchmark"]["call_id"]
            self.assertNotEqual(first_id, second_id)
            self.assertEqual(first[2]["calls"][0]["call_id"], first_id)
            self.assertEqual(post.call_count, 2)
        finally:
            ingest_v9.clear_benchmark_online_transport()
            ingest_v9.MODEL_IDS["sonnet"] = original
