import copy
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

os.environ.setdefault("DAEMON_LOG_DIR", tempfile.gettempdir())

from execution import ingest_v9
from execution.source_evidence import join_marked_pages
from execution.trust_manifest import attach_trust_manifest
from execution.v9_test_fixtures import (
    HAIKU_MODEL_ID,
    MODEL_ID,
    MODEL_IDS as TEST_MODEL_IDS,
    complete_analysis,
    q2_parsed_source,
    raw_analysis,
)


def marked_screenplay(page_count=100):
    return join_marked_pages(["INT. HOUSE - DAY"] * page_count)


class ProxyCostTelemetryTests(unittest.TestCase):
    @staticmethod
    def _proxy_usage(actual_cost_microusd=0, input_tokens=10, output_tokens=5):
        return {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 0,
            "call_count": 1,
            "actual_cost_microusd": actual_cost_microusd,
            "actual_cost_usd": actual_cost_microusd / 1_000_000,
        }

    @staticmethod
    def _validate_synthesis(report):
        return ingest_v9._validate_synthesis_report(
            report,
            report.get("reader_reports"),
            "Source Draft",
            "Fixture Writer",
        )

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
            "usage": {
                "input_tokens": 0,
                "output_tokens": 0,
                "cache_creation_input_tokens": 0,
                "cache_read_input_tokens": 0,
                "call_count": 1,
                "actual_cost_microusd": 0,
                "actual_cost_usd": 0.0,
            },
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
                "usage": {
                    "input_tokens": 100,
                    "output_tokens": 20,
                    "cache_creation_input_tokens": 30,
                    "cache_read_input_tokens": 40,
                    "call_count": 1,
                    "actual_cost_microusd": 725,
                    "actual_cost_usd": 0.000725,
                },
            }],
        )
        self.assertEqual(post.call_args.kwargs["json"]["job_id"], "queue-job-1")

    def test_settled_response_without_exact_usage_is_terminal(self):
        for field, value in (
            ("input_tokens", 10.5),
            ("cache_read_input_tokens", 1.5),
            ("call_count", 1.5),
            ("actual_cost_microusd", 1.5),
            ("actual_cost_usd", 0.5),
        ):
            with self.subTest(field=field):
                response = MagicMock()
                response.status_code = 200
                usage = self._proxy_usage(500)
                usage[field] = value
                response.json.return_value = {
                    "text": "paid but unaccounted",
                    "tool_uses": [],
                    "response_id": "msg_bad_usage",
                    "model": "claude-sonnet-4-6",
                    "stop_reason": "end_turn",
                    "usage": usage,
                }

                with patch.object(
                    ingest_v9.requests,
                    "post",
                    return_value=response,
                ) as post:
                    with self.assertRaises(ingest_v9.LlmAccountingError):
                        ingest_v9.call_llm(
                            system_blocks=[],
                            user_blocks=[],
                            model_key="sonnet",
                            proxy_url="https://proxy.test",
                            retries=3,
                        )

                self.assertEqual(post.call_count, 1)

    def test_candidate_sonnet_and_opus_requests_use_adaptive_high_without_sampling(self):
        for route, model_id in ingest_v9.CANDIDATE_MODEL_IDS.items():
            response = MagicMock()
            response.status_code = 200
            response.json.return_value = {
                "text": "ok",
                "tool_uses": [],
                "response_id": f"msg_{route}_candidate",
                "model": model_id,
                "stop_reason": "end_turn",
                "usage": self._proxy_usage(),
            }
            with (
                patch.dict(ingest_v9.MODEL_IDS, {route: model_id}),
                patch.object(ingest_v9.requests, "post", return_value=response) as post,
            ):
                ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "screenplay"}],
                    model_key=route,
                    thinking_budget=8_000,
                    max_tokens=4_000,
                    proxy_url="https://proxy.test",
                    retries=1,
                )
            body = post.call_args.kwargs["json"]
            self.assertEqual(body["model"], model_id)
            self.assertEqual(body["thinking"], {"type": "adaptive"})
            self.assertEqual(body["output_config"], {"effort": "high"})
            self.assertEqual(body["max_tokens"], 12_000)
            self.assertNotIn("temperature", body)
            self.assertNotIn("top_p", body)
            self.assertNotIn("top_k", body)

    def test_haiku_manual_thinking_does_not_inherit_candidate_rules(self):
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "text": "ok",
            "tool_uses": [],
            "response_id": "msg_haiku_manual",
            "model": ingest_v9.MODEL_IDS["haiku"],
            "stop_reason": "end_turn",
            "usage": self._proxy_usage(),
        }
        with patch.object(ingest_v9.requests, "post", return_value=response) as post:
            ingest_v9.call_llm(
                system_blocks=[{"type": "text", "text": "system"}],
                user_blocks=[{"type": "text", "text": "screenplay"}],
                model_key="haiku",
                thinking_budget=8_000,
                proxy_url="https://proxy.test",
                retries=1,
            )
        body = post.call_args.kwargs["json"]
        self.assertEqual(body["thinking"], {"type": "enabled", "budget_tokens": 8_000})
        self.assertEqual(body["temperature"], 1.0)
        self.assertNotIn("output_config", body)

    def test_unknown_route_and_returned_model_fallback_fail_closed(self):
        with self.assertRaisesRegex(ingest_v9.LlmRequestRejectedError, "silent fallback"):
            ingest_v9.call_llm(
                system_blocks=[],
                user_blocks=[],
                model_key="not-a-route",
                proxy_url="https://proxy.test",
                retries=1,
            )

        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "text": "ok",
            "tool_uses": [],
            "response_id": "msg_wrong_model",
            "model": "claude-opus-4-7",
            "stop_reason": "end_turn",
            "usage": self._proxy_usage(),
        }
        with patch.object(ingest_v9.requests, "post", return_value=response):
            with self.assertRaisesRegex(
                ingest_v9.LlmProvenanceError,
                "did not match",
            ) as raised:
                ingest_v9.call_llm(
                    system_blocks=[],
                    user_blocks=[],
                    model_key="sonnet",
                    proxy_url="https://proxy.test",
                    retries=1,
                    stage="reader",
                    pipeline_pass="sonnet",
                    boundary_run=2,
                    reader_name="structure",
                )

        settled_call = raised.exception.usage["calls"][0]
        self.assertEqual(settled_call["stage"], "reader")
        self.assertEqual(settled_call["pipeline_pass"], "sonnet")
        self.assertEqual(settled_call["boundary_run"], 2)
        self.assertEqual(settled_call["reader_name"], "structure")
        self.assertEqual(settled_call["disposition"], "discarded_unusable")
        self.assertEqual(settled_call["usage"], self._proxy_usage())

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
            "usage": self._proxy_usage(),
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
            "usage": self._proxy_usage(812),
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
        self.assertIn('"citation_evidence"', full_contract)

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
            "usage": self._proxy_usage(913),
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
            "usage": self._proxy_usage(1_117),
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
            "usage": self._proxy_usage(321),
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
            "usage": self._proxy_usage(654),
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
            "usage": self._proxy_usage(777),
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
            self._validate_synthesis(candidate)

        candidate = complete_analysis("Malformed Pillar")
        candidate["pillar_scores"]["concept"] = "strong"

        with self.assertRaisesRegex(ValueError, "concept"):
            self._validate_synthesis(candidate)

        candidate = complete_analysis("Model Verdict Mismatch")
        candidate["verdict_before_adjustments"] = "PASS"
        validated = self._validate_synthesis(candidate)
        self.assertEqual(validated["verdict_before_adjustments"], "CONSIDER")

    def test_synthesis_validator_requires_verdict_gate_inputs(self):
        candidate = complete_analysis("Missing Failures")
        candidate.pop("critical_failures")

        with self.assertRaisesRegex(ValueError, "critical failures"):
            self._validate_synthesis(candidate)

        candidate = complete_analysis("Invalid Story Gate")
        candidate["story_vs_situation"]["verdict"] = "unknown"
        validated = self._validate_synthesis(candidate)
        self.assertEqual(
            {
                key: validated["story_vs_situation"][key]
                for key in ("score", "verdict", "gate_applied")
            },
            {"score": 5, "verdict": "story", "gate_applied": False},
        )

        candidate = complete_analysis("Situation Gate")
        character_gate = candidate["reader_reports"]["character"][
            "story_vs_situation"
        ]
        character_gate.update({
            "human_condition": True,
            "tests_character": True,
            "twists_reveal_character": False,
            "emotional_shift": False,
            "moral_component_driven": False,
            "total": 5,
            "verdict": "story",
        })
        validated = self._validate_synthesis(candidate)
        self.assertEqual(
            {
                key: validated["story_vs_situation"][key]
                for key in ("score", "verdict", "gate_applied")
            },
            {"score": 2, "verdict": "situation", "gate_applied": True},
        )

        candidate = complete_analysis("Source Author")
        candidate["title"] = "Invented Title"
        candidate["author"] = "Invented Writer"
        validated = self._validate_synthesis(candidate)
        self.assertEqual(validated["title"], "Source Draft")
        self.assertEqual(validated["author"], "Fixture Writer")

    def test_synthesis_validator_rejects_missing_decision_evidence(self):
        candidate = complete_analysis("Missing Genre")
        candidate.pop("genre")

        with self.assertRaisesRegex(ValueError, "genre"):
            self._validate_synthesis(candidate)

        for field, value in (
            ("themes", ["", "  "]),
            ("strengths", ["", " ", "\t", "\n"]),
            ("weaknesses", []),
        ):
            candidate = complete_analysis(f"Blank {field}")
            candidate[field] = value
            with self.assertRaisesRegex(ValueError, field):
                self._validate_synthesis(candidate)

        candidate = complete_analysis("Blank Comparable")
        candidate["comparable_films"]["tone"]["title"] = ""
        with self.assertRaisesRegex(ValueError, "tone comparable"):
            self._validate_synthesis(candidate)

        candidate = complete_analysis("Blank Character")
        candidate["characters"]["protagonist"] = ""
        with self.assertRaisesRegex(ValueError, "character evidence"):
            self._validate_synthesis(candidate)

        candidate = complete_analysis("Invented Character")
        candidate["characters"].update({
            "protagonist": "Invented Person",
            "protagonist_evidence": {
                "kind": "person",
                "page_citations": [1],
                "citation_evidence": [{
                    "page": 1,
                    "excerpt": "INT. HOUSE - DAY",
                }],
            },
        })
        with self.assertRaisesRegex(ValueError, "absent from its evidence"):
            self._validate_synthesis(candidate)

    def test_synthesis_validator_requires_and_recomputes_all_traps(self):
        candidate = complete_analysis("Missing Traps")
        candidate["false_positive_check"]["traps_evaluated"] = []
        with self.assertRaisesRegex(ValueError, "false-positive traps"):
            self._validate_synthesis(candidate)

        candidate = complete_analysis("Computed Traps")
        character = candidate["reader_reports"]["character"]
        character["sub_scores"]["star_role_potential"]["score"] = 4
        character["sub_scores"]["supporting_cast_function"]["score"] = 4
        concept = candidate["reader_reports"]["concept"]
        for metric in concept["sub_scores"].values():
            metric["score"] = 9.5
        candidate["false_positive_check"]["weighted_trap_score"] = 0
        candidate["false_positive_check"]["verdict_adjustment"] = "none"

        validated = self._validate_synthesis(candidate)

        self.assertEqual(
            validated["false_positive_check"]["weighted_trap_score"],
            1.5,
        )
        self.assertEqual(
            validated["false_positive_check"]["verdict_adjustment"],
            "none",
        )

        structure = candidate["reader_reports"]["structure"]
        structure["sub_scores"]["scene_necessity"]["score"] = 4
        structure["sub_scores"]["progressive_complications"]["score"] = 4
        candidate["reader_reports"]["craft_scene"]["sub_scores"][
            "dialogue_voice_distinction"
        ]["score"] = 6
        validated = self._validate_synthesis(candidate)
        self.assertEqual(
            validated["false_positive_check"]["weighted_trap_score"],
            2.5,
        )
        self.assertEqual(
            validated["false_positive_check"]["verdict_adjustment"],
            "downgrade_one",
        )

    def test_synthesis_validator_derives_penalty_from_validated_severity(self):
        candidate = complete_analysis("Signed Model Penalty")
        candidate["weaknesses"] = [
            "The third act resolves through coincidence.",
            "The midpoint turn arrives late.",
        ]
        candidate["critical_failures"] = [
            {
                "weakness_index": 0,
                "reader": "structure",
                "metric": "ending_payoff",
                "description": "The third act resolves through coincidence.",
                "severity": "major",
                "penalty": -0.8,
            }
        ]
        candidate["critical_failure_total_penalty"] = 9.0

        validated = self._validate_synthesis(candidate)

        self.assertEqual(validated["critical_failures"][0]["penalty"], 0.8)
        self.assertEqual(validated["critical_failure_total_penalty"], 0.8)

        equal_set = copy.deepcopy(candidate)
        equal_set["weaknesses"] = [candidate["weaknesses"][0]]
        with self.assertRaisesRegex(ValueError, "strict subset"):
            self._validate_synthesis(equal_set)

        candidate["critical_failures"][0]["description"] = "Invented fatal issue."
        with self.assertRaisesRegex(ValueError, "linked to a unique weakness"):
            self._validate_synthesis(candidate)
        candidate["critical_failures"][0]["description"] = candidate["weaknesses"][0]

        candidate["critical_failures"][0]["severity"] = ["major"]
        with self.assertRaisesRegex(ValueError, "invalid severity"):
            self._validate_synthesis(candidate)

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
            "usage": self._proxy_usage(),
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
                "error_type": "LlmPreCallRetryableError",
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

    def test_ambiguous_transport_failure_is_not_retried(self):
        with patch.object(
            ingest_v9.requests,
            "post",
            side_effect=ingest_v9.requests.ConnectionError(
                "connection dropped after dispatch"
            ),
        ) as post, patch.object(ingest_v9.time, "sleep") as sleep:
            with self.assertRaises(ingest_v9.LlmCallFailedError) as raised:
                ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "screenplay"}],
                    model_key="sonnet",
                    proxy_url="https://proxy.test",
                    retries=3,
                )

        self.assertEqual(post.call_count, 1)
        sleep.assert_not_called()
        self.assertEqual(len(raised.exception.attempt_history), 1)

    def test_dry_run_estimate_scales_with_screenplay_word_count(self):
        short_script = ingest_v9.estimate_cost(2_000, "sonnet", "full")
        feature_script = ingest_v9.estimate_cost(20_000, "sonnet", "full")

        self.assertGreater(float(feature_script.removeprefix("~$")), float(short_script.removeprefix("~$")))

    def test_genre_failure_stops_with_paid_response_provenance(self):
        usage = ingest_v9.empty_usage()
        usage["call_count"] = 1
        usage["calls"] = [{"response_id": "msg_genre"}]

        with patch.object(
            ingest_v9,
            "call_llm",
            return_value=(None, "not valid JSON", usage),
        ):
            with self.assertRaises(
                ingest_v9.GenreDetectionIncompleteError
            ) as raised:
                ingest_v9.run_genre_detection(
                    {"type": "text", "text": "screenplay"},
                    proxy_url=None,
                )

        self.assertEqual(
            raised.exception.usage["calls"],
            [{
                "response_id": "msg_genre",
                "disposition": "discarded_unusable",
            }],
        )

    def test_semantically_empty_or_unknown_genre_fails_closed(self):
        for raw in ({}, {"external_genre": "interpretive dance"}):
            usage = ingest_v9.empty_usage()
            usage["call_count"] = 1
            usage["calls"] = [{"response_id": "msg_genre"}]
            with patch.object(
                ingest_v9,
                "call_llm",
                return_value=(None, json.dumps(raw), usage),
            ):
                with self.assertRaises(
                    ingest_v9.GenreDetectionIncompleteError
                ) as raised:
                    ingest_v9.run_genre_detection(
                        {"type": "text", "text": "screenplay"},
                        proxy_url=None,
                    )

            self.assertEqual(
                raised.exception.usage["calls"][0]["disposition"],
                "discarded_unusable",
            )

    def test_contradictory_primary_comedy_flags_fail_closed(self):
        base = {
            "comedy_paired_genre": "Action",
            "comedy_subgenre": "Buddy Comedy",
            "comedic_tone": True,
            "internal_genre": "Immaturity → Maturity",
            "confidence": "high",
            "one_line_why": "The story is built around escalating comic conflict.",
        }
        for external_genre, is_comedy in (
            ("Society", True),
            ("Comedy", False),
        ):
            usage = ingest_v9.empty_usage()
            usage["call_count"] = 1
            usage["calls"] = [{"response_id": "msg_genre"}]
            with patch.object(
                ingest_v9,
                "call_llm",
                return_value=(None, json.dumps({
                    **base,
                    "external_genre": external_genre,
                    "is_comedy": is_comedy,
                }), usage),
            ):
                with self.assertRaisesRegex(
                    ingest_v9.GenreDetectionIncompleteError,
                    "contradicts",
                ):
                    ingest_v9.run_genre_detection(
                        {"type": "text", "text": "screenplay"},
                        proxy_url=None,
                    )

    def test_genre_failure_prevents_reader_and_synthesis_calls(self):
        error = ingest_v9.GenreDetectionIncompleteError(
            "genre unavailable",
            ingest_v9.empty_usage(),
            review_evidence={"error_type": "ValueError"},
        )
        with patch.object(
            ingest_v9,
            "run_genre_detection",
            side_effect=error,
        ), patch.object(ingest_v9, "call_llm") as call_llm:
            with self.assertRaises(ingest_v9.GenreDetectionIncompleteError):
                ingest_v9.run_v9_full(
                    text=marked_screenplay(1),
                    title="Genre Failure",
                    page_count=1,
                    word_count=4,
                    model_key="sonnet",
                    proxy_url="https://proxy.test",
                )

        call_llm.assert_not_called()

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

    def test_triage_semantics_fail_closed_and_threshold_is_code_owned(self):
        base = {
            "triage_score": 6,
            "verdict": "CONSIDER",
            "genre": "Drama",
            "logline": "A family confronts a buried secret.",
            "should_deep_analyze": True,
        }
        invalid = (
            ("score_nan", {"triage_score": float("nan")}, "triage_score"),
            ("score_range", {"triage_score": 11}, "triage_score"),
            ("verdict", {"verdict": "BANANA"}, "verdict"),
            ("genre", {"genre": ""}, "genre"),
            ("logline", {"logline": ""}, "logline"),
            ("flag", {"should_deep_analyze": "yes"}, "should_deep_analyze"),
        )
        for name, override, message in invalid:
            with self.subTest(name=name):
                usage = ingest_v9.empty_usage()
                usage["calls"] = [{"response_id": f"msg_{name}"}]
                with patch.object(
                    ingest_v9,
                    "call_llm",
                    return_value=(None, json.dumps({**base, **override}), usage),
                ):
                    with self.assertRaisesRegex(ingest_v9.V9RunError, message):
                        ingest_v9.run_v9_triage(
                            "INT. HOUSE - DAY",
                            "Draft",
                            90,
                            20_000,
                            None,
                        )
                self.assertEqual(
                    usage["calls"][0]["disposition"],
                    "discarded_unusable",
                )

        usage = ingest_v9.empty_usage()
        usage["calls"] = [{"response_id": "msg_threshold"}]
        with patch.object(
            ingest_v9,
            "call_llm",
            return_value=(None, json.dumps({
                **base,
                "triage_score": 9,
                "verdict": "recommend",
                "should_deep_analyze": False,
            }), usage),
        ):
            analysis, _usage = ingest_v9.run_v9_triage(
                "INT. HOUSE - DAY",
                "Draft",
                90,
                20_000,
                None,
            )

        self.assertEqual(analysis["verdict"], "recommend")
        self.assertIs(analysis["should_deep_analyze"], True)

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
                "model_route": "haiku",
            },
            "response_ids": ["msg_triage_cold_read"],
        }
        screenplay_text = marked_screenplay()
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
            q2_parsed_source()["text"],
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
                text=marked_screenplay(),
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
                    text=marked_screenplay(),
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

    def test_non_enum_genres_fail_before_reader_dispatch(self):
        invalid_detections = (
            {
                "external_genre": "Drama",
                "is_comedy": False,
                "comedy_paired_genre": "",
                "comedy_subgenre": "",
            },
            {
                "external_genre": "Sci-Fi",
                "is_comedy": False,
                "comedy_paired_genre": "",
                "comedy_subgenre": "",
            },
            {
                "external_genre": "Comedy",
                "is_comedy": True,
                "comedy_paired_genre": "Drama",
                "comedy_subgenre": "Rom-Com",
            },
        )
        for invalid in invalid_detections:
            stages = []

            def invalid_genre_call(**kwargs):
                stages.append(kwargs["stage"])
                usage = self._successful_call_usage(
                    f"msg_invalid_genre_{len(stages)}",
                    stage="genre_detection",
                )
                return None, json.dumps({
                    **invalid,
                    "comedic_tone": invalid["is_comedy"],
                    "internal_genre": "Maturation",
                    "confidence": "high",
                    "one_line_why": "A deliberately invalid routing label.",
                }), usage

            with self.subTest(invalid=invalid), patch.object(
                ingest_v9,
                "call_llm",
                side_effect=invalid_genre_call,
            ):
                with self.assertRaises(ingest_v9.GenreDetectionIncompleteError):
                    ingest_v9.run_v9_full(
                        text=marked_screenplay(),
                        title="Invalid Genre Draft",
                        page_count=100,
                        word_count=20_000,
                        model_key="sonnet",
                        proxy_url="https://proxy.test",
                        pipeline_pass="sonnet",
                    )
            self.assertEqual(stages, ["genre_detection"])

    def test_cli_ambiguous_cold_read_stops_before_full_analysis(self):
        cold_failure = ingest_v9.LlmCallFailedError(
            "connection dropped after cold-read dispatch",
            attempt_history=[{
                "attempt": 1,
                "outcome": "failed",
                "error_type": "ConnectionError",
            }],
            requested_model=HAIKU_MODEL_ID,
            stage="genre_detection",
            pipeline_pass="cold_read",
            boundary_run=0,
            reader_name=None,
        )
        parsed = {
            "text": marked_screenplay(2),
            "page_count": 2,
            "word_count": 8,
            "metadata": {},
        }
        with tempfile.TemporaryDirectory() as temp_dir:
            pdf_path = os.path.join(temp_dir, "Cold Read Draft.pdf")
            with open(pdf_path, "wb") as screenplay:
                screenplay.write(b"screenplay bytes")
            stable = MagicMock()
            persist = MagicMock()
            with (
                patch.object(ingest_v9, "check_already_in_firestore", return_value=False),
                patch.object(ingest_v9, "compute_content_hash", return_value="a" * 64),
                patch.object(ingest_v9, "parse_pdf", return_value=parsed),
                patch.object(ingest_v9, "validate_parsed_source"),
                patch.object(
                    ingest_v9,
                    "archive_cli_pdf_version",
                    return_value=("gs://bucket/archive.pdf", "1001"),
                ),
                patch.object(
                    ingest_v9,
                    "run_nonbinding_cold_read",
                    side_effect=cold_failure,
                ),
                patch.object(ingest_v9, "run_v9_stable", stable),
                patch.object(
                    ingest_v9,
                    "persist_analysis_or_save_fallback",
                    persist,
                ),
            ):
                result = ingest_v9.ingest_one(
                    Path(pdf_path),
                    "LEMON",
                    "sonnet",
                    "full",
                    True,
                    True,
                    False,
                    "https://proxy.test",
                )

        self.assertEqual(result, "fail")
        stable.assert_not_called()
        persist.assert_not_called()

    def test_ambiguous_reader_transport_failure_is_never_redispatched(self):
        reader_calls = {}

        def fail_reader(**kwargs):
            reader_name = kwargs["reader_name"]
            reader_calls[reader_name] = reader_calls.get(reader_name, 0) + 1
            raise ingest_v9.LlmCallFailedError(
                "connection dropped after dispatch",
                attempt_history=[{
                    "attempt": 1,
                    "outcome": "failed",
                    "error_type": "ConnectionError",
                }],
                requested_model=MODEL_ID,
                stage="reader",
                pipeline_pass="sonnet",
                boundary_run=1,
                reader_name=reader_name,
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
            side_effect=fail_reader,
        ), patch.object(ingest_v9.time, "sleep") as sleep:
            with self.assertRaises(ingest_v9.LlmCallFailedError):
                ingest_v9.run_v9_full(
                    text=marked_screenplay(),
                    title="Ambiguous Reader Draft",
                    page_count=100,
                    word_count=20_000,
                    model_key="sonnet",
                    proxy_url="https://proxy.test",
                    pipeline_pass="sonnet",
                )

        self.assertEqual(
            reader_calls,
            {reader: 1 for reader in ingest_v9.READER_WEIGHTS},
        )
        sleep.assert_not_called()

    def test_ambiguous_synthesis_transport_failure_is_never_redispatched(self):
        synthesis_calls = 0
        fixture_analysis = complete_analysis("Ambiguous Synthesis Draft")

        def fail_synthesis(**kwargs):
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
            raise ingest_v9.LlmCallFailedError(
                "connection dropped after synthesis dispatch",
                attempt_history=[{
                    "attempt": 1,
                    "outcome": "failed",
                    "error_type": "ConnectionError",
                }],
                requested_model=MODEL_ID,
                stage="synthesis",
                pipeline_pass="sonnet",
                boundary_run=1,
                reader_name=None,
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
            side_effect=fail_synthesis,
        ), patch.object(ingest_v9.time, "sleep") as sleep:
            with self.assertRaises(ingest_v9.LlmCallFailedError):
                ingest_v9.run_v9_full(
                    text=marked_screenplay(),
                    title="Ambiguous Synthesis Draft",
                    page_count=100,
                    word_count=20_000,
                    model_key="sonnet",
                    proxy_url="https://proxy.test",
                    pipeline_pass="sonnet",
                )

        self.assertEqual(synthesis_calls, 1)
        sleep.assert_not_called()

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
                    text=marked_screenplay(),
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
                    text=marked_screenplay(),
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
                    text=marked_screenplay(1),
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
            "usage": self._proxy_usage(),
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
            "usage": self._proxy_usage(),
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

    def test_model_mismatch_requires_exact_settled_usage(self):
        malformed = self._proxy_usage(actual_cost_microusd=725)
        malformed["actual_cost_usd"] = 0.0
        for invalid_usage in (None, malformed):
            response = MagicMock()
            response.status_code = 502
            response.json.return_value = {
                "code": "MODEL_PROVENANCE_MISMATCH",
                "error": "Anthropic returned a different model.",
                "isRetryable": False,
                "requested_model": MODEL_ID,
                "returned_model": "claude-opus-4-7",
                "response_id": "msg_wrong_model",
                "stop_reason": "end_turn",
                "usage": invalid_usage,
            }

            with self.subTest(invalid_usage=invalid_usage), patch.object(
                ingest_v9.requests,
                "post",
                return_value=response,
            ) as post:
                with self.assertRaises(ingest_v9.LlmAccountingError) as raised:
                    ingest_v9.call_llm(
                        system_blocks=[{"type": "text", "text": "system"}],
                        user_blocks=[{"type": "text", "text": "screenplay"}],
                        model_key="sonnet",
                        proxy_url="https://proxy.test",
                        retries=3,
                    )

            self.assertFalse(hasattr(raised.exception, "usage"))
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

    def test_candidate_uncertainty_preserves_exact_cap_charge_and_call_id(self):
        uncertain = MagicMock()
        uncertain.status_code = 503
        uncertain_body = {
            "code": "BENCHMARK_SPEND_UNCERTAIN",
            "error": "The provider result is uncertain.",
            "isRetryable": False,
            "manualReviewRequired": True,
            "benchmark_accounting": {
                "call_id": "set-by-dispatch",
                "requested_model": MODEL_ID,
                "uncertainty_status": "charged_reservation",
                "charged_cost_microusd": 125_000,
                "charged_cost_usd": 0.125,
                "reserved_cost_microusd": 0,
                "reserved_cost_usd": 0.0,
                "cap_cost_microusd": 125_000,
                "cap_cost_usd": 0.125,
            },
        }
        uncertain.json.return_value = uncertain_body
        context = {
            "run_id": "run-1",
            "screenplay_sha256": "a" * 64,
            "route": "sonnet",
            "generation": "old",
            "prompt_bundle_sha256": "b" * 64,
            "structured_output_schema_sha256": "c" * 64,
        }

        ingest_v9.configure_benchmark_online_transport(context, lambda: "token")
        try:
            def dispatch(*_args, **kwargs):
                uncertain_body["benchmark_accounting"]["call_id"] = (
                    kwargs["json"]["benchmark"]["call_id"]
                )
                return uncertain

            with patch.object(
                ingest_v9.requests,
                "post",
                side_effect=dispatch,
            ) as post:
                with self.assertRaises(ingest_v9.LlmAccountingError) as raised:
                    ingest_v9.call_llm(
                        system_blocks=[{"type": "text", "text": "system"}],
                        user_blocks=[{"type": "text", "text": "screenplay"}],
                        model_key="sonnet",
                        proxy_url="https://candidate.test",
                        stage="reader",
                        pipeline_pass="sonnet",
                        boundary_run=1,
                        reader_name="structure",
                    )
        finally:
            ingest_v9.clear_benchmark_online_transport()

        self.assertEqual(post.call_count, 1)
        self.assertEqual(raised.exception.usage["actual_cost_microusd"], 125_000)
        failed = raised.exception.usage["failed_calls"][0]
        self.assertEqual(
            failed["call_id"],
            post.call_args.kwargs["json"]["benchmark"]["call_id"],
        )
        self.assertEqual(failed["uncertainty_status"], "charged_reservation")
        self.assertEqual(failed["cap_cost_microusd"], 125_000)


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

    def test_failed_opus_promotion_preserves_completed_sonnet_usage(self):
        sonnet_usage = ingest_v9.empty_usage()
        sonnet_usage.update({
            "input_tokens": 1_000,
            "output_tokens": 100,
            "call_count": 7,
            "actual_cost_microusd": 10_000,
            "actual_cost_usd": 0.01,
            "calls": [{"response_id": "msg_sonnet"}],
        })
        opus_usage = ingest_v9.empty_usage()
        opus_usage.update({
            "input_tokens": 200,
            "output_tokens": 20,
            "call_count": 1,
            "actual_cost_microusd": 4_000,
            "actual_cost_usd": 0.004,
            "calls": [{"response_id": "msg_opus"}],
        })
        opus_error = ingest_v9.SynthesisIncompleteError(
            "opus synthesis unusable",
            opus_usage,
            review_evidence={"attempts": 1},
        )

        with patch.object(
            ingest_v9,
            "run_v9_stable",
            side_effect=[
                ({"verdict": "RECOMMEND", "weighted_score": 8.0}, sonnet_usage),
                opus_error,
            ],
        ):
            with self.assertRaises(ingest_v9.SynthesisIncompleteError) as raised:
                ingest_v9.run_v9_hybrid(
                    text="INT. HOUSE - DAY",
                    title="Draft",
                    page_count=100,
                    word_count=20_000,
                    proxy_url=None,
                )

        self.assertEqual(raised.exception.usage["call_count"], 8)
        self.assertEqual(raised.exception.usage["actual_cost_microusd"], 14_000)
        self.assertEqual(
            [call["response_id"] for call in raised.exception.usage["calls"]],
            ["msg_sonnet", "msg_opus"],
        )


if __name__ == "__main__":
    unittest.main()
