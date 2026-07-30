import copy
import json
import os
import tempfile
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault("DAEMON_LOG_DIR", tempfile.gettempdir())

from execution import ingest_v9
from execution.trust_manifest import attach_trust_manifest
from execution.v9_test_fixtures import (
    HAIKU_MODEL_ID,
    MODEL_ID,
    MODEL_IDS as TEST_MODEL_IDS,
    complete_analysis,
    raw_analysis,
)


class ProxyCostTelemetryTests(unittest.TestCase):
    @staticmethod
    def _schema_example(schema):
        if "enum" in schema:
            return copy.deepcopy(schema["enum"][0])
        value_type = schema.get("type")
        if value_type == "object":
            properties = schema.get("properties", {})
            return {
                field: ProxyCostTelemetryTests._schema_example(
                    properties[field]
                )
                for field in schema.get("required", [])
            }
        if value_type == "array":
            minimum_items = schema.get("minItems", 0)
            return [
                ProxyCostTelemetryTests._schema_example(schema["items"])
                for _index in range(minimum_items)
            ]
        if value_type == "string":
            return "evidence"
        if value_type == "boolean":
            return False
        if value_type == "integer":
            return 5
        if value_type == "number":
            return 5.0
        raise AssertionError(f"Unsupported test schema: {schema}")

    @staticmethod
    def _successful_call_usage(
        response_id,
        *,
        stage,
        reader_name=None,
        model_id=MODEL_ID,
        pipeline_pass="sonnet",
    ):
        usage = ingest_v9.empty_usage()
        usage["call_count"] = 1
        usage["by_model"] = {
            model_id: {
                field: 1 if field == "call_count" else 0
                for field in ingest_v9.USAGE_COUNTER_FIELDS
            },
        }
        usage["calls"] = [{
            "response_id": response_id,
            "requested_model": model_id,
            "returned_model": model_id,
            "stop_reason": "end_turn",
            "successful_attempt": 1,
            "retry_history": [{
                "attempt": 1,
                "outcome": "success",
                "response_id": response_id,
            }],
            "stage": stage,
            "pipeline_pass": pipeline_pass,
            "boundary_run": 1,
            "reader_name": reader_name,
            "disposition": "pending",
        }]
        return usage

    def test_proxy_call_sends_job_identity_and_returns_exact_cost(self):
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "text": "ok",
            "tool_uses": [],
            "response_id": "msg_01JTRUST",
            "model": "claude-sonnet-4-6",
            "stop_reason": "end_turn",
            "usage": {
                "input_tokens": 100,
                "output_tokens": 20,
                "cache_creation_input_tokens": 30,
                "cache_read_input_tokens": 40,
                "call_count": 1,
                "actual_cost_microusd": 725,
                "actual_cost_usd": 0.000725,
            },
        }

        with patch.object(ingest_v9.requests, "post", return_value=response) as post:
            _tool, text, usage = ingest_v9.call_llm(
                system_blocks=[{"type": "text", "text": "system"}],
                user_blocks=[{"type": "text", "text": "screenplay"}],
                model_key="sonnet",
                proxy_url="https://proxy.test",
                job_id="queue-job-1",
                retries=1,
            )

        self.assertEqual(text, "ok")
        self.assertEqual(usage["call_count"], 1)
        self.assertEqual(usage["actual_cost_microusd"], 725)
        self.assertEqual(
            usage["by_model"]["claude-sonnet-4-6"]["input_tokens"],
            100,
        )
        self.assertEqual(
            usage["calls"],
            [{
                "response_id": "msg_01JTRUST",
                "requested_model": "claude-sonnet-4-6",
                "returned_model": "claude-sonnet-4-6",
                "stop_reason": "end_turn",
                "successful_attempt": 1,
                "retry_history": [{
                    "attempt": 1,
                    "outcome": "success",
                    "response_id": "msg_01JTRUST",
                }],
                "stage": "unspecified",
                "pipeline_pass": "unspecified",
                "boundary_run": 0,
                "reader_name": None,
                "disposition": "pending",
            }],
        )
        self.assertEqual(post.call_args.kwargs["json"]["job_id"], "queue-job-1")

    def test_tool_request_uses_a_strict_anthropic_compatible_schema(self):
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "text": "",
            "tool_uses": [{
                "id": "toolu_craft",
                "name": "submit_craft_scene_report",
                "input": {"reader": "craft_scene"},
            }],
            "response_id": "msg_strict_craft",
            "model": "claude-opus-4-7",
            "stop_reason": "tool_use",
            "usage": {},
        }

        with patch.object(ingest_v9.requests, "post", return_value=response) as post:
            ingest_v9.call_llm(
                system_blocks=[{"type": "text", "text": "system"}],
                user_blocks=[{"type": "text", "text": "screenplay"}],
                model_key="opus",
                tool=ingest_v9.CRAFT_SCENE_TOOL,
                proxy_url="https://proxy.test",
                retries=1,
            )

        sent_tool = post.call_args.kwargs["json"]["tools"][0]
        self.assertIs(sent_tool["strict"], True)

        def assert_strict_compatible(node):
            if isinstance(node, dict):
                self.assertNotIn("minimum", node)
                self.assertNotIn("maximum", node)
                self.assertNotIn("minItems", node)
                if node.get("type") == "object":
                    self.assertIs(node.get("additionalProperties"), False)
                for value in node.values():
                    assert_strict_compatible(value)
            elif isinstance(node, list):
                for value in node:
                    assert_strict_compatible(value)

        strict_tools = [
            ingest_v9._strict_tool_definition(tool)
            for tool in [
                *ingest_v9.READER_TOOLS.values(),
                ingest_v9.SYNTHESIS_TOOL,
            ]
        ]
        for strict_tool in strict_tools:
            self.assertIs(strict_tool["strict"], True)
            assert_strict_compatible(strict_tool["input_schema"])

        assert_strict_compatible(sent_tool["input_schema"])
        self.assertNotIn("strict", ingest_v9.CRAFT_SCENE_TOOL)
        self.assertIn(
            "maximum",
            ingest_v9.CRAFT_SCENE_TOOL["input_schema"]["properties"][
                "pillar_score"
            ],
        )

    def test_v9_reports_use_a_compact_strict_json_envelope(self):
        for source_tool in [
            *ingest_v9.READER_TOOLS.values(),
            ingest_v9.SYNTHESIS_TOOL,
        ]:
            envelope = ingest_v9._strict_json_envelope_definition(source_tool)
            self.assertIs(envelope["strict"], True)
            self.assertEqual(envelope["name"], source_tool["name"])
            self.assertLess(len(json.dumps(envelope)), 1_000)
            self.assertEqual(
                envelope["input_schema"],
                {
                    "type": "object",
                    "properties": {
                        "contract": {
                            "type": "string",
                            "enum": [source_tool["name"]],
                        },
                        "report_json": {"type": "string"},
                    },
                    "required": ["contract", "report_json"],
                    "additionalProperties": False,
                },
            )

    def test_compact_envelope_preserves_and_validates_the_full_reader_report(self):
        report = self._schema_example(
            ingest_v9.CRAFT_SCENE_TOOL["input_schema"]
        )
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "text": "",
            "tool_uses": [{
                "id": "toolu_compact_craft",
                "name": "submit_craft_scene_report",
                "input": {
                    "contract": "submit_craft_scene_report",
                    "report_json": json.dumps(report),
                },
            }],
            "response_id": "msg_compact_craft",
            "model": "claude-opus-4-7",
            "stop_reason": "tool_use",
            "usage": {"actual_cost_microusd": 812},
        }

        with patch.object(ingest_v9.requests, "post", return_value=response) as post:
            tool_input, _text, usage = ingest_v9.call_llm(
                system_blocks=[{"type": "text", "text": "system"}],
                user_blocks=[{"type": "text", "text": "screenplay"}],
                model_key="opus",
                tool=ingest_v9.CRAFT_SCENE_TOOL,
                compact_json_envelope=True,
                proxy_url="https://proxy.test",
                retries=1,
            )

        self.assertEqual(tool_input, report)
        self.assertEqual(usage["actual_cost_microusd"], 812)
        payload = post.call_args.kwargs["json"]
        self.assertLess(len(json.dumps(payload["tools"][0])), 1_000)
        full_contract = payload["messages"][0]["content"][-1]["text"]
        self.assertIn('"bmoc_failure_scan"', full_contract)
        self.assertIn('"page_citations"', full_contract)

        incomplete = copy.deepcopy(report)
        incomplete.pop("bmoc_failure_scan")
        response.json.return_value["tool_uses"][0]["input"]["report_json"] = (
            json.dumps(incomplete)
        )
        with patch.object(ingest_v9.requests, "post", return_value=response):
            with self.assertRaisesRegex(
                ingest_v9.LlmOutputContractError,
                "bmoc_failure_scan",
            ) as raised:
                ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "screenplay"}],
                    model_key="opus",
                    tool=ingest_v9.CRAFT_SCENE_TOOL,
                    compact_json_envelope=True,
                    proxy_url="https://proxy.test",
                    retries=1,
                )
        self.assertEqual(raised.exception.usage["actual_cost_microusd"], 812)

        unexpected = copy.deepcopy(report)
        unexpected["unapproved_score"] = 10
        response.json.return_value["tool_uses"][0]["input"]["report_json"] = (
            json.dumps(unexpected)
        )
        with patch.object(ingest_v9.requests, "post", return_value=response):
            with self.assertRaisesRegex(
                ingest_v9.LlmOutputContractError,
                "unapproved_score",
            ):
                ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "screenplay"}],
                    model_key="opus",
                    tool=ingest_v9.CRAFT_SCENE_TOOL,
                    compact_json_envelope=True,
                    proxy_url="https://proxy.test",
                    retries=1,
                )

    def test_compact_envelope_rejects_malformed_json_with_settled_usage(self):
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "text": "",
            "tool_uses": [{
                "id": "toolu_bad_json",
                "name": "submit_structure_report",
                "input": {
                    "contract": "submit_structure_report",
                    "report_json": '{"reader":"structure"',
                },
            }],
            "response_id": "msg_bad_json",
            "model": "claude-opus-4-7",
            "stop_reason": "tool_use",
            "usage": {"actual_cost_microusd": 913},
        }

        with patch.object(ingest_v9.requests, "post", return_value=response):
            with self.assertRaisesRegex(
                ingest_v9.LlmOutputContractError,
                "valid JSON",
            ) as raised:
                ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "screenplay"}],
                    model_key="opus",
                    tool=ingest_v9.STRUCTURE_TOOL,
                    compact_json_envelope=True,
                    proxy_url="https://proxy.test",
                    retries=1,
                )

        self.assertEqual(raised.exception.usage["actual_cost_microusd"], 913)

    def test_compact_envelope_preserves_and_validates_full_synthesis(self):
        report = self._schema_example(
            ingest_v9.SYNTHESIS_TOOL["input_schema"]
        )
        report["critical_failures"] = []
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "text": "",
            "tool_uses": [{
                "id": "toolu_compact_synthesis",
                "name": "submit_synthesis_report",
                "input": {
                    "contract": "submit_synthesis_report",
                    "report_json": json.dumps(report),
                },
            }],
            "response_id": "msg_compact_synthesis",
            "model": "claude-opus-4-7",
            "stop_reason": "tool_use",
            "usage": {"actual_cost_microusd": 1_117},
        }

        with patch.object(ingest_v9.requests, "post", return_value=response):
            tool_input, _text, _usage = ingest_v9.call_llm(
                system_blocks=[{"type": "text", "text": "system"}],
                user_blocks=[{"type": "text", "text": "reports"}],
                model_key="opus",
                tool=ingest_v9.SYNTHESIS_TOOL,
                compact_json_envelope=True,
                proxy_url="https://proxy.test",
                retries=1,
            )

        self.assertEqual(tool_input, report)

    def test_wrong_tool_envelope_is_rejected_with_settled_usage(self):
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "text": "",
            "tool_uses": [{
                "id": "toolu_wrong",
                "name": "submit_structure_report",
                "input": {"reader": "craft_scene"},
            }],
            "response_id": "msg_wrong_tool",
            "model": "claude-opus-4-7",
            "stop_reason": "tool_use",
            "usage": {"actual_cost_microusd": 321},
        }

        with patch.object(ingest_v9.requests, "post", return_value=response) as post:
            with self.assertRaisesRegex(
                ingest_v9.LlmOutputContractError,
                "expected submit_craft_scene_report",
            ) as raised:
                ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "screenplay"}],
                    model_key="opus",
                    tool=ingest_v9.CRAFT_SCENE_TOOL,
                    proxy_url="https://proxy.test",
                    retries=3,
                )

        self.assertEqual(post.call_count, 1)
        self.assertEqual(raised.exception.usage["actual_cost_microusd"], 321)
        self.assertEqual(
            raised.exception.usage["calls"][0]["response_id"],
            "msg_wrong_tool",
        )

    def test_truncated_tool_output_is_rejected_with_settled_usage(self):
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "text": "",
            "tool_uses": [],
            "response_id": "msg_truncated_tool",
            "model": "claude-opus-4-7",
            "stop_reason": "max_tokens",
            "usage": {"actual_cost_microusd": 654},
        }

        with patch.object(ingest_v9.requests, "post", return_value=response) as post:
            with self.assertRaisesRegex(
                ingest_v9.LlmOutputContractError,
                "max_tokens",
            ) as raised:
                ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "screenplay"}],
                    model_key="opus",
                    tool=ingest_v9.CRAFT_SCENE_TOOL,
                    proxy_url="https://proxy.test",
                    retries=3,
                )

        self.assertEqual(post.call_count, 1)
        self.assertEqual(raised.exception.usage["actual_cost_microusd"], 654)

    def test_missing_tool_input_is_rejected_with_settled_usage(self):
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "text": "",
            "tool_uses": [{
                "id": "toolu_missing_input",
                "name": "submit_craft_scene_report",
            }],
            "response_id": "msg_missing_tool_input",
            "model": "claude-opus-4-7",
            "stop_reason": "tool_use",
            "usage": {"actual_cost_microusd": 777},
        }

        with patch.object(ingest_v9.requests, "post", return_value=response) as post:
            with self.assertRaisesRegex(
                ingest_v9.LlmOutputContractError,
                "not an object",
            ) as raised:
                ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "screenplay"}],
                    model_key="opus",
                    tool=ingest_v9.CRAFT_SCENE_TOOL,
                    proxy_url="https://proxy.test",
                    retries=3,
                )

        self.assertEqual(post.call_count, 1)
        self.assertEqual(raised.exception.usage["actual_cost_microusd"], 777)

    def test_synthesis_validator_rejects_non_numeric_score_before_publication(self):
        candidate = complete_analysis("Malformed Synthesis")
        candidate["weighted_score"] = "high"

        with self.assertRaisesRegex(ValueError, "weighted score"):
            ingest_v9._validate_synthesis_report(candidate)

        candidate = complete_analysis("Malformed Pillar")
        candidate["pillar_scores"]["concept"] = "strong"

        with self.assertRaisesRegex(ValueError, "concept"):
            ingest_v9._validate_synthesis_report(candidate)

    def test_synthesis_validator_requires_verdict_gate_inputs(self):
        candidate = complete_analysis("Missing Failures")
        candidate.pop("critical_failures")

        with self.assertRaisesRegex(ValueError, "critical failures"):
            ingest_v9._validate_synthesis_report(candidate)

        candidate = complete_analysis("Invalid Story Gate")
        candidate["story_vs_situation"]["verdict"] = "unknown"

        with self.assertRaisesRegex(ValueError, "story-vs-situation verdict"):
            ingest_v9._validate_synthesis_report(candidate)

    def test_daily_dollar_limit_is_not_retried_as_a_rate_limit(self):
        response = MagicMock()
        response.status_code = 429
        response.json.return_value = {
            "code": "DAILY_BUDGET_EXCEEDED",
            "error": "Daily AI budget exhausted.",
            "resetAt": "2026-07-22T00:00:00.000Z",
        }

        with patch.object(ingest_v9.requests, "post", return_value=response) as post:
            with self.assertRaises(ingest_v9.DailyBudgetExceededError) as raised:
                ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "screenplay"}],
                    model_key="sonnet",
                    proxy_url="https://proxy.test",
                    job_id="queue-job-1",
                    retries=3,
                )

        self.assertEqual(post.call_count, 1)
        self.assertEqual(raised.exception.reset_at, "2026-07-22T00:00:00.000Z")

    def test_non_retryable_upstream_rejection_is_not_retried(self):
        response = MagicMock()
        response.status_code = 400
        response.json.return_value = {
            "code": "UPSTREAM_INVALID_REQUEST",
            "error": "Anthropic rejected the request before model generation.",
            "isRetryable": False,
        }

        with patch.object(ingest_v9.requests, "post", return_value=response) as post:
            with self.assertRaises(ingest_v9.LlmRequestRejectedError):
                ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "screenplay"}],
                    model_key="opus",
                    tool=ingest_v9.CRAFT_SCENE_TOOL,
                    compact_json_envelope=True,
                    proxy_url="https://proxy.test",
                    retries=3,
                )

        self.assertEqual(post.call_count, 1)

    def test_transient_pre_call_accounting_outage_retries_then_succeeds(self):
        unavailable = MagicMock()
        unavailable.status_code = 503
        unavailable.json.return_value = {
            "code": "PRE_CALL_ACCOUNTING_UNAVAILABLE",
            "error": "No model call was made.",
            "isRetryable": True,
        }
        unavailable.raise_for_status.side_effect = ingest_v9.requests.HTTPError(
            "503 accounting unavailable"
        )
        success = MagicMock()
        success.status_code = 200
        success.json.return_value = {
            "text": "ok after retry",
            "tool_uses": [],
            "response_id": "msg_after_retry",
            "model": "claude-sonnet-4-6",
            "stop_reason": "end_turn",
            "usage": {},
        }

        with patch.object(
            ingest_v9.requests,
            "post",
            side_effect=[unavailable, success],
        ) as post, patch.object(ingest_v9.time, "sleep") as sleep:
            _tool, text, usage = ingest_v9.call_llm(
                system_blocks=[{"type": "text", "text": "system"}],
                user_blocks=[{"type": "text", "text": "screenplay"}],
                model_key="sonnet",
                proxy_url="https://proxy.test",
                job_id="queue-job-1",
                retries=3,
            )

        self.assertEqual(text, "ok after retry")
        self.assertEqual(post.call_count, 2)
        sleep.assert_called_once_with(5)
        self.assertEqual(usage["calls"][0]["retry_history"], [
            {
                "attempt": 1,
                "outcome": "failed",
                "error_type": "HTTPError",
            },
            {
                "attempt": 2,
                "outcome": "success",
                "response_id": "msg_after_retry",
            },
        ])

    def test_exhausted_call_preserves_every_failed_attempt_and_stage(self):
        unavailable = MagicMock()
        unavailable.status_code = 503
        unavailable.json.return_value = {
            "code": "PRE_CALL_ACCOUNTING_UNAVAILABLE",
            "error": "No model call was made.",
            "isRetryable": True,
        }
        unavailable.raise_for_status.side_effect = ingest_v9.requests.HTTPError(
            "503 accounting unavailable"
        )

        with patch.object(
            ingest_v9.requests,
            "post",
            return_value=unavailable,
        ) as post, patch.object(ingest_v9.time, "sleep"):
            with self.assertRaises(ingest_v9.LlmCallFailedError) as raised:
                ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "screenplay"}],
                    model_key="sonnet",
                    proxy_url="https://proxy.test",
                    retries=3,
                    stage="reader",
                    pipeline_pass="sonnet",
                    boundary_run=2,
                    reader_name="structure",
                )

        self.assertEqual(post.call_count, 3)
        self.assertEqual(
            [attempt["attempt"] for attempt in raised.exception.attempt_history],
            [1, 2, 3],
        )
        usage = ingest_v9.failed_usage(raised.exception)
        self.assertEqual(usage["failed_calls"][0]["stage"], "reader")
        self.assertEqual(usage["failed_calls"][0]["boundary_run"], 2)

    def test_dry_run_estimate_scales_with_screenplay_word_count(self):
        short_script = ingest_v9.estimate_cost(2_000, "sonnet", "full")
        feature_script = ingest_v9.estimate_cost(20_000, "sonnet", "full")

        self.assertGreater(float(feature_script.removeprefix("~$")), float(short_script.removeprefix("~$")))

    def test_genre_fallback_keeps_the_paid_response_provenance(self):
        usage = ingest_v9.empty_usage()
        usage["call_count"] = 1
        usage["calls"] = [{"response_id": "msg_genre"}]

        with patch.object(
            ingest_v9,
            "call_llm",
            return_value=(None, "not valid JSON", usage),
        ):
            _detection, returned_usage = ingest_v9.run_genre_detection(
                {"type": "text", "text": "screenplay"},
                proxy_url=None,
            )

        self.assertEqual(
            returned_usage["calls"],
            [{
                "response_id": "msg_genre",
                "disposition": "discarded_unusable",
            }],
        )

    def test_malformed_triage_response_keeps_successful_call_usage(self):
        usage = ingest_v9.empty_usage()
        usage["call_count"] = 1
        usage["calls"] = [{"response_id": "msg_triage"}]

        with patch.object(
            ingest_v9,
            "call_llm",
            return_value=(None, "not valid JSON", usage),
        ):
            with self.assertRaises(ingest_v9.V9RunError) as raised:
                ingest_v9.run_v9_triage(
                    "INT. HOUSE - DAY",
                    "Draft",
                    90,
                    20_000,
                    None,
                )

        self.assertIs(raised.exception.usage, usage)
        self.assertEqual(
            raised.exception.usage["calls"],
            [{
                "response_id": "msg_triage",
                "disposition": "discarded_unusable",
            }],
        )

    def test_reader_and_synthesis_recovery_produce_a_complete_manifest(self):
        synthesis_attempt = 0
        reader_attempts = {}
        fixture_analysis = complete_analysis("Recovered Draft")
        fixture_analysis.pop("_boundary_reruns")

        def fake_call_llm(**kwargs):
            nonlocal synthesis_attempt, reader_attempts
            stage = kwargs["stage"]
            reader_name = kwargs.get("reader_name")
            if stage == "reader":
                reader_attempts[reader_name] = reader_attempts.get(reader_name, 0) + 1
                response_id = (
                    f"msg_reader_{reader_name}_{reader_attempts[reader_name]}"
                )
                usage = self._successful_call_usage(
                    response_id,
                    stage=stage,
                    reader_name=reader_name,
                )
                if (
                    reader_name == "emotional_resonance"
                    and reader_attempts[reader_name] == 1
                ):
                    return None, "missing tool result", usage
                return (
                    copy.deepcopy(
                        fixture_analysis["reader_reports"][reader_name]
                    ),
                    "",
                    usage,
                )

            self.assertEqual(stage, "synthesis")
            synthesis_attempt += 1
            response_id = f"msg_synthesis_{synthesis_attempt}"
            usage = self._successful_call_usage(
                response_id,
                stage=stage,
            )
            if synthesis_attempt == 1:
                return None, "missing tool result", usage
            return copy.deepcopy(fixture_analysis), "", usage

        genre_detection = ingest_v9.parse_detection({
            "external_genre": "Society",
            "confidence": "high",
        })
        triage_usage = self._successful_call_usage(
            "msg_triage_cold_read",
            stage="triage",
            model_id=HAIKU_MODEL_ID,
            pipeline_pass="triage",
        )
        ingest_v9.set_successful_call_disposition(triage_usage, "used")
        cold_read = {
            "evidence": {
                "triage_score": 6.1,
                "verdict": "consider",
                "genre": "horror",
                "logline": "A cold read linked to an exact response.",
            },
            "response_ids": ["msg_triage_cold_read"],
        }
        screenplay_text = "INT. HOUSE - DAY\n" * 2_000
        with patch.object(
            ingest_v9,
            "run_genre_detection",
            return_value=(genre_detection, ingest_v9.empty_usage()),
        ), patch.object(
            ingest_v9,
            "call_llm",
            side_effect=fake_call_llm,
        ), patch.object(
            ingest_v9.time,
            "sleep",
        ), patch.dict(
            os.environ,
            {"LEMON_BOUNDARY_RERUNS": "0"},
        ):
            analysis, usage = ingest_v9.run_v9_stable(
                text=screenplay_text,
                title="Recovered Draft",
                page_count=100,
                word_count=20_000,
                model_key="sonnet",
                proxy_url="https://proxy.test",
                pipeline_pass="sonnet",
                cold_read=cold_read,
            )
        usage = ingest_v9.merge_usage(triage_usage, usage)

        dispositions = {
            call["response_id"]: call["disposition"]
            for call in usage["calls"]
        }
        self.assertEqual(
            dispositions["msg_reader_emotional_resonance_1"],
            "discarded_unusable",
        )
        self.assertEqual(
            dispositions["msg_reader_emotional_resonance_2"],
            "used",
        )
        self.assertEqual(
            dispositions["msg_synthesis_1"],
            "discarded_unusable",
        )
        self.assertEqual(dispositions["msg_synthesis_2"], "used")
        self.assertEqual(analysis["analysis_quality"]["status"], "complete")
        self.assertEqual(
            analysis["_cold_read"],
            {
                "used_in_synthesis": True,
                **cold_read,
            },
        )
        self.assertEqual(
            analysis["analysis_quality"]["failed_readers"],
            [],
        )
        self.assertEqual(analysis["analysis_quality"]["completed_readers"], 5)
        self.assertEqual(analysis["failed_reader_errors"], {})

        raw = raw_analysis()
        raw["analysis"] = analysis
        raw["usage"] = usage
        raw["metadata"]["character_count"] = len(screenplay_text)
        ingest_v9.attach_verified_citation_quality(
            raw["analysis"],
            raw["metadata"],
            raw["metadata"]["page_count"],
        )
        raw["actual_cost_microusd"] = usage["actual_cost_microusd"]
        raw["actual_cost_usd"] = usage["actual_cost_usd"]
        trusted = attach_trust_manifest(
            raw,
            selection_request="sonnet",
            pipeline_model_tier="sonnet",
            effective_model_tier="sonnet",
            model_ids=TEST_MODEL_IDS,
            origin_kind="daemon_queue",
            origin_id="queue-recovered",
        )

        self.assertEqual(
            trusted["trust_manifest"]["readers"]["quality_status"],
            "complete",
        )
        self.assertTrue(
            trusted["trust_manifest"]["readers"]["publication_ready"]
        )

    def test_missing_craft_identity_gets_a_corrective_retry_and_recovers(self):
        fixture_analysis = complete_analysis("Craft Recovery Draft")
        craft_user_blocks = []
        craft_attempts = 0
        compact_flags = []

        def fake_call_llm(**kwargs):
            nonlocal craft_attempts
            compact_flags.append(kwargs.get("compact_json_envelope"))
            stage = kwargs["stage"]
            reader_name = kwargs.get("reader_name")
            if stage == "reader":
                report = copy.deepcopy(
                    fixture_analysis["reader_reports"][reader_name]
                )
                if reader_name == "craft_scene":
                    craft_attempts += 1
                    craft_user_blocks.append(
                        copy.deepcopy(kwargs["user_blocks"])
                    )
                    if craft_attempts == 1:
                        report.pop("reader")
                return (
                    report,
                    "",
                    self._successful_call_usage(
                        f"msg_reader_{reader_name}_{craft_attempts or 1}",
                        stage=stage,
                        reader_name=reader_name,
                    ),
                )
            return (
                copy.deepcopy(fixture_analysis),
                "",
                self._successful_call_usage(
                    "msg_synthesis",
                    stage=stage,
                ),
            )

        genre_detection = ingest_v9.parse_detection({
            "external_genre": "Society",
            "confidence": "high",
        })
        with patch.object(
            ingest_v9,
            "run_genre_detection",
            return_value=(genre_detection, ingest_v9.empty_usage()),
        ), patch.object(
            ingest_v9,
            "call_llm",
            side_effect=fake_call_llm,
        ), patch.object(
            ingest_v9.time,
            "sleep",
        ):
            analysis, _usage = ingest_v9.run_v9_full(
                text="INT. HOUSE - DAY\n" * 2_000,
                title="Craft Recovery Draft",
                page_count=100,
                word_count=20_000,
                model_key="opus",
                proxy_url="https://proxy.test",
                pipeline_pass="opus",
            )

        self.assertEqual(craft_attempts, 2)
        self.assertEqual(analysis["analysis_quality"]["status"], "complete")
        self.assertEqual(len(craft_user_blocks[0]), 3)
        self.assertEqual(len(craft_user_blocks[1]), 4)
        repair_instruction = craft_user_blocks[1][-1]["text"]
        self.assertIn("reader identity mismatch", repair_instruction)
        self.assertIn("submit_craft_scene_report", repair_instruction)
        self.assertTrue(compact_flags)
        self.assertTrue(all(compact_flags))

    def test_non_retryable_rejection_stops_reader_report_recovery(self):
        reader_calls = {}

        def reject_reader(**kwargs):
            reader_name = kwargs["reader_name"]
            reader_calls[reader_name] = reader_calls.get(reader_name, 0) + 1
            raise ingest_v9.LlmRequestRejectedError(
                "request rejected before model generation"
            )

        genre_detection = ingest_v9.parse_detection({
            "external_genre": "Society",
            "confidence": "high",
        })
        with patch.object(
            ingest_v9,
            "run_genre_detection",
            return_value=(genre_detection, ingest_v9.empty_usage()),
        ), patch.object(
            ingest_v9,
            "call_llm",
            side_effect=reject_reader,
        ):
            with self.assertRaises(ingest_v9.LlmRequestRejectedError):
                ingest_v9.run_v9_full(
                    text="INT. HOUSE - DAY\n" * 2_000,
                    title="Rejected Draft",
                    page_count=100,
                    word_count=20_000,
                    model_key="opus",
                    proxy_url="https://proxy.test",
                    pipeline_pass="opus",
                )

        self.assertEqual(
            reader_calls,
            {reader: 1 for reader in ingest_v9.READER_WEIGHTS},
        )

    def test_exhausted_reader_panel_blocks_synthesis_and_preserves_review_evidence(
        self,
    ):
        synthesis_calls = 0
        reader_attempts = {}
        fixture_analysis = complete_analysis("Incomplete Draft")

        def fake_call_llm(**kwargs):
            nonlocal synthesis_calls, reader_attempts
            stage = kwargs["stage"]
            reader_name = kwargs.get("reader_name")
            if stage == "synthesis":
                synthesis_calls += 1
                return copy.deepcopy(fixture_analysis), "", self._successful_call_usage(
                    "msg_synthesis_should_not_run",
                    stage=stage,
                )

            reader_attempts[reader_name] = reader_attempts.get(reader_name, 0) + 1
            usage = self._successful_call_usage(
                f"msg_reader_{reader_name}_{reader_attempts[reader_name]}",
                stage=stage,
                reader_name=reader_name,
            )
            if reader_name == "emotional_resonance":
                return None, "missing tool result", usage
            return (
                copy.deepcopy(fixture_analysis["reader_reports"][reader_name]),
                "",
                usage,
            )

        genre_detection = ingest_v9.parse_detection({
            "external_genre": "Society",
            "confidence": "high",
        })
        with patch.object(
            ingest_v9,
            "run_genre_detection",
            return_value=(genre_detection, ingest_v9.empty_usage()),
        ), patch.object(
            ingest_v9,
            "call_llm",
            side_effect=fake_call_llm,
        ), patch.object(
            ingest_v9.time,
            "sleep",
        ):
            with self.assertRaises(
                ingest_v9.ReaderPanelIncompleteError
            ) as raised:
                ingest_v9.run_v9_full(
                    text="INT. HOUSE - DAY\n" * 2_000,
                    title="Incomplete Draft",
                    page_count=100,
                    word_count=20_000,
                    model_key="sonnet",
                    proxy_url="https://proxy.test",
                    pipeline_pass="sonnet",
                )

        self.assertEqual(synthesis_calls, 0)
        self.assertEqual(reader_attempts["emotional_resonance"], 3)
        self.assertTrue(raised.exception.review_required)
        self.assertEqual(
            raised.exception.review_kind,
            "reader_panel_review",
        )
        self.assertEqual(
            raised.exception.review_evidence["failed_readers"],
            ["emotional_resonance"],
        )
        self.assertEqual(
            raised.exception.review_evidence["completed_readers"],
            4,
        )
        self.assertEqual(
            raised.exception.review_evidence["completed_reader_names"],
            ["character", "concept", "craft_scene", "structure"],
        )

    def test_exhausted_synthesis_blocks_verdict_after_complete_reader_panel(self):
        synthesis_calls = 0
        fixture_analysis = complete_analysis("Unsynthesized Draft")

        def fake_call_llm(**kwargs):
            nonlocal synthesis_calls
            stage = kwargs["stage"]
            reader_name = kwargs.get("reader_name")
            if stage == "reader":
                return (
                    copy.deepcopy(fixture_analysis["reader_reports"][reader_name]),
                    "",
                    self._successful_call_usage(
                        f"msg_reader_{reader_name}",
                        stage=stage,
                        reader_name=reader_name,
                    ),
                )
            synthesis_calls += 1
            return (
                None,
                "missing tool result",
                self._successful_call_usage(
                    f"msg_synthesis_{synthesis_calls}",
                    stage=stage,
                ),
            )

        genre_detection = ingest_v9.parse_detection({
            "external_genre": "Society",
            "confidence": "high",
        })
        with patch.object(
            ingest_v9,
            "run_genre_detection",
            return_value=(genre_detection, ingest_v9.empty_usage()),
        ), patch.object(
            ingest_v9,
            "call_llm",
            side_effect=fake_call_llm,
        ), patch.object(
            ingest_v9.time,
            "sleep",
        ):
            with self.assertRaises(
                ingest_v9.SynthesisIncompleteError
            ) as raised:
                ingest_v9.run_v9_full(
                    text="INT. HOUSE - DAY\n" * 2_000,
                    title="Unsynthesized Draft",
                    page_count=100,
                    word_count=20_000,
                    model_key="sonnet",
                    proxy_url="https://proxy.test",
                    pipeline_pass="sonnet",
                )

        self.assertEqual(synthesis_calls, 3)
        self.assertEqual(raised.exception.review_kind, "synthesis_review")
        self.assertEqual(
            raised.exception.review_evidence["completed_readers"],
            5,
        )
        self.assertEqual(
            raised.exception.review_evidence["completed_reader_names"],
            [
                "character",
                "concept",
                "craft_scene",
                "emotional_resonance",
                "structure",
            ],
        )
        self.assertEqual(
            raised.exception.review_evidence["failed_readers"],
            [],
        )
        self.assertEqual(
            raised.exception.review_evidence["synthesis_attempts"],
            3,
        )

    def test_full_engine_rejects_unlinked_cold_read_before_model_work(self):
        with patch.object(ingest_v9, "call_llm") as call_llm:
            with self.assertRaisesRegex(ValueError, "response_ids"):
                ingest_v9.run_v9_full(
                    text="INT. HOUSE - DAY",
                    title="Unlinked Draft",
                    page_count=1,
                    word_count=500,
                    model_key="sonnet",
                    proxy_url="https://proxy.test",
                    cold_read={
                        "evidence": {
                            "triage_score": 6.0,
                            "verdict": "consider",
                        },
                    },
                )

        call_llm.assert_not_called()

    def test_missing_response_identity_is_terminal_without_retry(self):
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "text": "settled but untraceable",
            "tool_uses": [],
            "model": "claude-sonnet-4-6",
            "stop_reason": "end_turn",
            "usage": {},
        }

        with patch.object(ingest_v9.requests, "post", return_value=response) as post:
            with self.assertRaises(ingest_v9.LlmProvenanceError):
                ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "screenplay"}],
                    model_key="sonnet",
                    proxy_url="https://proxy.test",
                    job_id="queue-job-1",
                    retries=3,
                )

        self.assertEqual(post.call_count, 1)

    def test_missing_returned_model_is_never_guessed(self):
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "text": "settled but model-less",
            "tool_uses": [],
            "response_id": "msg_model_missing",
            "stop_reason": "end_turn",
            "usage": {},
        }

        with patch.object(ingest_v9.requests, "post", return_value=response) as post:
            with self.assertRaises(ingest_v9.LlmProvenanceError):
                ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "screenplay"}],
                    model_key="sonnet",
                    proxy_url="https://proxy.test",
                    job_id="queue-job-1",
                    retries=3,
                )

        self.assertEqual(post.call_count, 1)

    def test_post_call_accounting_uncertainty_is_terminal_without_retry(self):
        uncertain = MagicMock()
        uncertain.status_code = 503
        uncertain.json.return_value = {
            "code": "POST_CALL_ACCOUNTING_UNCERTAIN",
            "error": "A paid call may have completed.",
            "isRetryable": False,
            "manualReviewRequired": True,
        }

        with patch.object(
            ingest_v9.requests,
            "post",
            return_value=uncertain,
        ) as post, patch.object(ingest_v9.time, "sleep") as sleep:
            with self.assertRaises(ingest_v9.LlmAccountingError):
                ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "screenplay"}],
                    model_key="sonnet",
                    proxy_url="https://proxy.test",
                    job_id="queue-job-1",
                    retries=3,
                )

        self.assertEqual(post.call_count, 1)
        sleep.assert_not_called()


class HybridCostAggregationTests(unittest.TestCase):
    def test_hybrid_counts_every_sonnet_and_opus_call_at_its_own_rate(self):
        sonnet_usage = {
            "input_tokens": 1_000,
            "output_tokens": 100,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 0,
            "call_count": 7,
            "actual_cost_microusd": 10_000,
            "actual_cost_usd": 0.01,
            "finish_reason": "end_turn",
            "by_model": {
                "claude-sonnet-4-6": {
                    "input_tokens": 1_000,
                    "output_tokens": 100,
                    "cache_creation_input_tokens": 0,
                    "cache_read_input_tokens": 0,
                    "call_count": 7,
                    "actual_cost_microusd": 10_000,
                }
            },
        }
        opus_usage = {
            "input_tokens": 2_000,
            "output_tokens": 200,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 0,
            "call_count": 7,
            "actual_cost_microusd": 40_000,
            "actual_cost_usd": 0.04,
            "finish_reason": "end_turn",
            "by_model": {
                "claude-opus-4-7": {
                    "input_tokens": 2_000,
                    "output_tokens": 200,
                    "cache_creation_input_tokens": 0,
                    "cache_read_input_tokens": 0,
                    "call_count": 7,
                    "actual_cost_microusd": 40_000,
                }
            },
        }

        with patch.object(
            ingest_v9,
            "run_v9_stable",
            side_effect=[
                ({"verdict": "RECOMMEND", "weighted_score": 8.0}, sonnet_usage),
                ({"verdict": "RECOMMEND", "weighted_score": 8.3}, opus_usage),
            ],
        ) as run_stable:
            _analysis, usage = ingest_v9.run_v9_hybrid(
                text="INT. HOUSE - DAY",
                title="Draft",
                page_count=100,
                word_count=20_000,
                proxy_url=None,
                job_id="queue-job-1",
            )

        self.assertEqual(usage["call_count"], 14)
        self.assertEqual(usage["input_tokens"], 3_000)
        self.assertEqual(usage["actual_cost_microusd"], 50_000)
        self.assertEqual(usage["actual_cost_usd"], 0.05)
        self.assertEqual(set(usage["by_model"]), {
            "claude-sonnet-4-6",
            "claude-opus-4-7",
        })
        self.assertEqual(run_stable.call_count, 2)
        for call in run_stable.call_args_list:
            self.assertEqual(call.kwargs["job_id"], "queue-job-1")


if __name__ == "__main__":
    unittest.main()
