import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from types import SimpleNamespace

from execution.model_benchmark import (
    BenchmarkSafetyError,
    LocalCostCap,
    _candidate_preflight,
    _load_engine,
    _route_configs,
    _run_paid,
    _run_smoke,
    _smoke_route_configs,
    _validate_candidate_proxy,
    _validated_inputs,
)


class ModelBenchmarkSafetyTests(unittest.TestCase):
    def test_local_cap_counts_a_settled_paid_error(self):
        cap = LocalCostCap(1.0, {
            "modelProfiles": {
                "model-1": {
                    "inputUsdPerMillion": 1,
                    "outputUsdPerMillion": 1,
                },
            },
        })
        error = RuntimeError("paid response was unusable")
        error.usage = {"actual_cost_usd": 0.0125}

        def fail(**_kwargs):
            raise error

        with self.assertRaisesRegex(RuntimeError, "unusable"):
            cap.call(
                fail,
                {"sonnet": "model-1"},
                model_key="sonnet",
                system_blocks=[],
                user_blocks=[],
                max_tokens=10,
            )

        self.assertEqual(cap.spent_usd, 0.0125)

    def test_paid_run_merges_cold_read_usage_into_full_failure(self):
        from execution import ingest_v9

        cold_usage = ingest_v9.empty_usage()
        cold_usage.update({
            "call_count": 1,
            "actual_cost_microusd": 100,
            "actual_cost_usd": 0.0001,
            "calls": [{"response_id": "msg_cold"}],
        })
        full_usage = ingest_v9.empty_usage()
        full_usage.update({
            "call_count": 1,
            "actual_cost_microusd": 200,
            "actual_cost_usd": 0.0002,
            "calls": [{"response_id": "msg_full"}],
        })
        full_error = ingest_v9.V9RunError("full run failed", full_usage)
        engine = SimpleNamespace(
            parse_pdf=Mock(return_value={
                "text": "[PAGE 1]\nINT. HOUSE - DAY",
                "page_count": 1,
                "word_count": 4,
                "metadata": {},
            }),
            validate_parsed_source=Mock(),
            MODEL_IDS={"sonnet": "model-1"},
            call_llm=Mock(),
            configure_benchmark_online_transport=Mock(),
            clear_benchmark_online_transport=Mock(),
            run_nonbinding_cold_read=Mock(return_value=(
                {"evidence": {}, "response_ids": ["msg_cold"]},
                cold_usage,
            )),
            run_v9_stable=Mock(side_effect=full_error),
            merge_usage=ingest_v9.merge_usage,
            empty_usage=ingest_v9.empty_usage,
        )

        with self.assertRaises(ingest_v9.V9RunError) as raised:
            _run_paid(
                engine,
                {
                    "route": "sonnet",
                    "model_id": "model-1",
                    "sonnet_model_id": "model-1",
                    "generation": "old",
                },
                {"path": "/tmp/test.pdf", "filename": "test.pdf", "content_sha256": "a" * 64},
                "https://candidate.example/llmProxyCandidate",
                None,
                Mock(),
                "run-1",
                {"prompt_bundle_sha256": "b" * 64, "structured_output_schema_sha256": "c" * 64},
                lambda: "token",
            )

        self.assertEqual(raised.exception.usage["actual_cost_microusd"], 300)
        self.assertEqual(
            [call["response_id"] for call in raised.exception.usage["calls"]],
            ["msg_cold", "msg_full"],
        )

    def test_paid_run_preserves_uncertain_cold_read_cost_and_stops(self):
        from execution import ingest_v9

        cold_usage = ingest_v9.empty_usage()
        cold_usage.update({
            "actual_cost_microusd": 125_000,
            "actual_cost_usd": 0.125,
            "failed_calls": [{
                "call_id": "call-cold-uncertain",
                "requested_model": "model-1",
                "uncertainty_status": "charged_reservation",
            }],
        })
        cold_error = ingest_v9.LlmAccountingError("cold read spend uncertain")
        cold_error.usage = cold_usage
        engine = SimpleNamespace(
            parse_pdf=Mock(return_value={
                "text": "[PAGE 1]\nINT. HOUSE - DAY",
                "page_count": 1,
                "word_count": 4,
                "metadata": {},
            }),
            validate_parsed_source=Mock(),
            MODEL_IDS={"sonnet": "model-1"},
            call_llm=Mock(),
            configure_benchmark_online_transport=Mock(),
            clear_benchmark_online_transport=Mock(),
            run_nonbinding_cold_read=Mock(side_effect=cold_error),
            run_v9_stable=Mock(),
            merge_usage=ingest_v9.merge_usage,
            empty_usage=ingest_v9.empty_usage,
        )

        with self.assertRaises(ingest_v9.LlmAccountingError) as raised:
            _run_paid(
                engine,
                {
                    "route": "sonnet",
                    "model_id": "model-1",
                    "sonnet_model_id": "model-1",
                    "generation": "old",
                },
                {"path": "/tmp/test.pdf", "filename": "test.pdf", "content_sha256": "a" * 64},
                "https://candidate.example/llmProxyCandidate",
                None,
                Mock(),
                "run-1",
                {"prompt_bundle_sha256": "b" * 64, "structured_output_schema_sha256": "c" * 64},
                lambda: "token",
            )

        self.assertEqual(raised.exception.usage["actual_cost_microusd"], 125_000)
        self.assertEqual(
            raised.exception.usage["failed_calls"][0]["call_id"],
            "call-cold-uncertain",
        )
        engine.run_v9_stable.assert_not_called()

    def test_paid_run_preserves_all_usage_when_citation_validation_fails(self):
        from execution import ingest_v9

        cold_usage = ingest_v9.empty_usage()
        cold_usage.update({
            "call_count": 1,
            "actual_cost_microusd": 100,
            "actual_cost_usd": 0.0001,
            "calls": [{"response_id": "msg_cold"}],
        })
        full_usage = ingest_v9.empty_usage()
        full_usage.update({
            "call_count": 1,
            "actual_cost_microusd": 200,
            "actual_cost_usd": 0.0002,
            "calls": [{"response_id": "msg_full"}],
        })
        citation_error = ValueError("citation evidence failed")
        engine = SimpleNamespace(
            parse_pdf=Mock(return_value={
                "text": "[PAGE 1]\nINT. HOUSE - DAY",
                "page_count": 1,
                "word_count": 4,
                "metadata": {},
            }),
            validate_parsed_source=Mock(),
            MODEL_IDS={"sonnet": "model-1"},
            call_llm=Mock(),
            configure_benchmark_online_transport=Mock(),
            clear_benchmark_online_transport=Mock(),
            run_nonbinding_cold_read=Mock(return_value=(
                {"evidence": {}, "response_ids": ["msg_cold"]},
                cold_usage,
            )),
            run_v9_stable=Mock(return_value=({}, full_usage)),
            attach_verified_citation_quality=Mock(side_effect=citation_error),
            merge_usage=ingest_v9.merge_usage,
            empty_usage=ingest_v9.empty_usage,
        )

        with self.assertRaisesRegex(ValueError, "citation evidence") as raised:
            _run_paid(
                engine,
                {
                    "route": "sonnet",
                    "model_id": "model-1",
                    "sonnet_model_id": "model-1",
                    "generation": "old",
                },
                {"path": "/tmp/test.pdf", "filename": "test.pdf", "content_sha256": "a" * 64},
                "https://candidate.example/llmProxyCandidate",
                None,
                Mock(),
                "run-1",
                {"prompt_bundle_sha256": "b" * 64, "structured_output_schema_sha256": "c" * 64},
                lambda: "token",
            )

        self.assertEqual(raised.exception.usage["actual_cost_microusd"], 300)
        self.assertEqual(
            [call["response_id"] for call in raised.exception.usage["calls"]],
            ["msg_cold", "msg_full"],
        )

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

    def test_candidate_preflight_requires_distinct_production_isolation_targets(self):
        response = Mock(status_code=200)
        response.json.return_value = {
            "service": "llmProxyCandidate",
            "run_id": "staging-smoke",
            "cap_usd": 1,
            "database_id": "model-benchmarks",
            "runtime_project_id": "lemon-screenplay-staging",
            "allowed_models": [
                "claude-haiku-4-5-20251001",
                "claude-sonnet-5",
                "claude-opus-5",
            ],
            "release": {
                "source_clean": True,
                "deployment_config_sha256": "c" * 64,
                "cloud_run_revision": "llmproxycandidate-00001-abc",
                "git_sha": "a" * 40,
                "catalog_sha256": "b" * 64,
            },
            "isolation": {
                "named_database": "allowed",
                "staging_default_database": "denied",
                "production_default_database": "denied",
                "production_storage": "denied",
                "targets": {
                    "staging_default_database": (
                        "projects/lemon-screenplay-staging/databases/(default)"
                    ),
                    "production_default_database": (
                        "projects/lemon-screenplay-dashboard/databases/(default)"
                    ),
                    "production_storage_bucket": (
                        "lemon-screenplay-dashboard.firebasestorage.app"
                    ),
                },
            },
        }
        with patch("execution.model_benchmark.requests.get", return_value=response):
            result = _candidate_preflight(
                "https://example.run.app/llmProxyCandidate",
                lambda: "short-lived",
                "staging-smoke",
                1,
                True,
                "a" * 40,
                "b" * 64,
            )
        self.assertEqual(
            result["isolation"]["targets"]["production_default_database"],
            "projects/lemon-screenplay-dashboard/databases/(default)",
        )

        response.json.return_value["isolation"]["targets"][
            "production_default_database"
        ] = "projects/lemon-screenplay-staging/databases/(default)"
        with patch("execution.model_benchmark.requests.get", return_value=response):
            with self.assertRaisesRegex(BenchmarkSafetyError, "production Firestore"):
                _candidate_preflight(
                    "https://example.run.app/llmProxyCandidate",
                    lambda: "short-lived",
                    "staging-smoke",
                    1,
                    True,
                    "a" * 40,
                    "b" * 64,
                )

        response.json.return_value["isolation"]["targets"][
            "production_default_database"
        ] = "projects/lemon-screenplay-dashboard/databases/(default)"
        response.json.return_value["isolation"]["targets"][
            "staging_default_database"
        ] = "projects/lemon-sp-dashboard-stg-493694/databases/(default)"
        with patch("execution.model_benchmark.requests.get", return_value=response):
            with self.assertRaisesRegex(BenchmarkSafetyError, "confused staging"):
                _candidate_preflight(
                    "https://example.run.app/llmProxyCandidate",
                    lambda: "short-lived",
                    "staging-smoke",
                    1,
                    True,
                    "a" * 40,
                    "b" * 64,
                )

        response.json.return_value["runtime_project_id"] = "lemon-screenplay-dashboard"
        response.json.return_value["isolation"]["targets"][
            "staging_default_database"
        ] = "projects/lemon-screenplay-staging/databases/(default)"
        with patch("execution.model_benchmark.requests.get", return_value=response):
            self.assertEqual(
                _candidate_preflight(
                    "https://example.run.app/llmProxyCandidate",
                    lambda: "short-lived",
                    "staging-smoke",
                    1,
                    True,
                    "a" * 40,
                    "b" * 64,
                )["runtime_project_id"],
                "lemon-screenplay-dashboard",
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
