import os
import tempfile
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault("DAEMON_LOG_DIR", tempfile.gettempdir())

from execution import ingest_v9


class ProxyCostTelemetryTests(unittest.TestCase):
    def test_proxy_call_sends_job_identity_and_returns_exact_cost(self):
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {
            "text": "ok",
            "tool_uses": [],
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
        self.assertEqual(post.call_args.kwargs["json"]["job_id"], "queue-job-1")

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
            "model": "claude-sonnet-4-6",
            "stop_reason": "end_turn",
            "usage": {},
        }

        with patch.object(
            ingest_v9.requests,
            "post",
            side_effect=[unavailable, success],
        ) as post, patch.object(ingest_v9.time, "sleep") as sleep:
            _tool, text, _usage = ingest_v9.call_llm(
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
