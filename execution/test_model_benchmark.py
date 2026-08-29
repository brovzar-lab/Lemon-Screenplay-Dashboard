import hashlib
import json
import copy
import tempfile
import threading
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock, patch
from types import SimpleNamespace

from execution.model_benchmark import (
    BenchmarkSafetyError,
    LocalCostCap,
    PRODUCTION_AUDITOR_SERVICE_ACCOUNT,
    PRODUCTION_PROJECT_IAM_CONTRACT_SHA256,
    PRODUCTION_STORAGE_ACL_CONTRACT_SHA256,
    PRODUCTION_STORAGE_IAM_CONTRACT_SHA256,
    STAGING_IDENTITY_READER_CONTRACT_SHA256,
    STAGING_PROJECT_IAM_CONTRACT_SHA256,
    STAGING_STORAGE_IAM_CONTRACT_SHA256,
    build_manifest,
    _candidate_preflight,
    _catalog_sha256,
    _checkpoint_run_call,
    _engine_output_sha256,
    _atomic_write_json,
    _load_engine,
    _load_deployment_receipt,
    _model_configuration,
    _production_auditor_contract,
    _deployment_config_sha256,
    _assert_private_candidate_iam_policy,
    _validate_live_isolation_proof,
    _validate_deployment_receipt_freshness,
    _paid_dispatch_platform_recheck,
    _verify_live_candidate_safety,
    _validate_staging_identity_proof,
    _route_configs,
    _record_run_failure,
    _refresh_manifest_cost_totals,
    _resumable_runs,
    _runtime_pricing_sha256,
    _resolve_candidate_deployment,
    _run_paid,
    _run_smoke,
    _sha256_json,
    _validate_resume_manifest,
    _validate_resume_ledger,
    _validate_local_rejected_artifacts,
    _smoke_route_configs,
    _validate_candidate_proxy,
    _validated_inputs,
)


def _release(git_sha="d" * 40, catalog_sha256=None):
    return {
        "git_sha": git_sha,
        "source_clean": True,
        "catalog_sha256": catalog_sha256 or _catalog_sha256(),
        "pricing_sha256": _runtime_pricing_sha256(),
        "build_timestamp": "2026-08-27T12:00:00Z",
        "deployment_config_sha256": "c" * 64,
        "cloud_run_revision": "llmproxycandidate-00001-abc",
        "inference_geo": "global",
    }


def _local_source(git_sha="d" * 40):
    return {"git_sha": git_sha, "source_clean": True}


def _deployment_receipt_fixture(
    *,
    proxy_url="https://candidate.example/llmProxyCandidate",
    git_sha="a" * 40,
    run_id="123e4567-e89b-42d3-a456-426614174000",
    cap_microusd=8_000_000,
    prior_microusd=106_425,
):
    catalog = json.loads(
        (Path(__file__).parents[1] / "src/config/anthropic-model-catalog.json")
        .read_text(encoding="utf-8")
    )
    runtime_account = (
        "benchmark-runtime@lemon-screenplay-staging.iam.gserviceaccount.com"
    )
    production_firestore_inventory = {
        "databases": [{
            "name": "projects/lemon-screenplay-dashboard/databases/(default)",
            "database_id": "(default)",
            "location_id": "nam5",
        }],
        "backups": [],
        "backup_schedules": [],
    }
    staging_firestore_databases = [
        "projects/lemon-screenplay-staging/databases/(default)",
        "projects/lemon-screenplay-staging/databases/model-benchmarks",
    ]
    staging_storage_buckets = [
        "gcf-v2-sources-549848020392-us-central1",
        "gcf-v2-uploads-549848020392.us-central1.cloudfunctions.appspot.com",
    ]
    production_service_accounts = [{
        "email": (
            "firebase-adminsdk-fbsvc@lemon-screenplay-dashboard."
            "iam.gserviceaccount.com"
        ),
        "disabled": False,
        "unique_id": "123456789012345678901",
        "resource_sha256": "4" * 64,
        "policy_sha256": "5" * 64,
        "binding_count": 0,
    }, {
        "email": PRODUCTION_AUDITOR_SERVICE_ACCOUNT,
        "disabled": False,
        "unique_id": "223456789012345678901",
        "resource_sha256": "6" * 64,
        "policy_sha256": "7" * 64,
        "binding_count": 1,
    }]
    auditor_contract = _production_auditor_contract("549848020392")
    proof = {
        "status": "passed_complete_static_iam_inventory",
        "scanner_version": "standalone-project-iam-and-resource-inventory-v2",
        "runtime_service_account": runtime_account,
        "staging_project_id": "lemon-screenplay-staging",
        "staging_project_number": "549848020392",
        "production_project_id": "lemon-screenplay-dashboard",
        "production_storage_bucket": (
            "lemon-screenplay-dashboard.firebasestorage.app"
        ),
        "production_firestore_inventory": production_firestore_inventory,
        "production_firestore_inventory_sha256": _sha256_json(
            production_firestore_inventory
        ),
        "production_firestore_database_count": 1,
        "production_firestore_backup_count": 0,
        "production_firestore_backup_schedule_count": 0,
        "staging_firestore_databases": staging_firestore_databases,
        "staging_storage_buckets": staging_storage_buckets,
        "staging_data_resource_inventory_sha256": _sha256_json({
            "databases": staging_firestore_databases,
            "buckets": staging_storage_buckets,
        }),
        "verified_at": "2026-08-28T12:00:00Z",
        "production_project_number": "493694843892",
        "production_project_resource_sha256": "1" * 64,
        "production_project_iam_policy_sha256": "2" * 64,
        "production_project_iam_contract_sha256": (
            PRODUCTION_PROJECT_IAM_CONTRACT_SHA256
        ),
        "production_project_binding_count": 24,
        "production_service_accounts": production_service_accounts,
        "production_service_account_count": len(production_service_accounts),
        "production_service_account_inventory_sha256": _sha256_json(
            production_service_accounts
        ),
        "production_auditor_service_account": auditor_contract[
            "service_account"
        ],
        "production_auditor_role": auditor_contract["role"],
        "production_auditor_wif_principal": auditor_contract[
            "workload_identity_principal"
        ],
        "production_auditor_permissions": auditor_contract["permissions"],
        "production_auditor_contract_sha256": _sha256_json(auditor_contract),
        "production_auditor_role_definition_sha256": "8" * 64,
        "permission_contract_sha256": "3" * 64,
        "production_project_scope_state": "STANDALONE_NO_PARENT",
        "production_access_state": "NO_STAGING_IDENTITY_ALLOW_BINDING",
    }
    proof["proof_sha256"] = _sha256_json(proof)
    storage_acl_proof = {
        "status": "passed_no_runtime_access_acl",
        "scanner_version": "legacy-acl-full-object-version-inventory-v2",
        "runtime_service_account": runtime_account,
        "production_storage_bucket": (
            "lemon-screenplay-dashboard.firebasestorage.app"
        ),
        "production_project_number": "493694843892",
        "verified_at": "2026-08-28T12:00:00Z",
        "bucket_access_mode": "legacy_acl_full_inventory",
        "bucket_metadata_sha256": "8" * 64,
        "bucket_iam_policy_sha256": "9" * 64,
        "bucket_iam_contract_sha256": PRODUCTION_STORAGE_IAM_CONTRACT_SHA256,
        "acl_principal_contract_sha256": (
            PRODUCTION_STORAGE_ACL_CONTRACT_SHA256
        ),
        "object_version_count": 115,
        "soft_deleted_object_count": 0,
        "object_acl_inventory_sha256": "a" * 64,
    }
    storage_acl_proof["proof_sha256"] = _sha256_json(storage_acl_proof)
    effective_invokers = sorted([
        "serviceAccount:benchmark-caller@lemon-screenplay-staging.iam.gserviceaccount.com",
        "serviceAccount:benchmark-deployer@lemon-screenplay-staging.iam.gserviceaccount.com",
        (
            "serviceAccount:firebase-adminsdk-fbsvc@lemon-screenplay-staging."
            "iam.gserviceaccount.com"
        ),
        "serviceAccount:549848020392-compute@developer.gserviceaccount.com",
        "serviceAccount:lemon-screenplay-staging@appspot.gserviceaccount.com",
        "serviceAccount:service-549848020392@gcp-sa-cloudbuild.iam.gserviceaccount.com",
        "serviceAccount:service-549848020392@gcf-admin-robot.iam.gserviceaccount.com",
        "serviceAccount:service-549848020392@gcp-sa-pubsub.iam.gserviceaccount.com",
        "serviceAccount:service-549848020392@serverless-robot-prod.iam.gserviceaccount.com",
        "user:billyrovzar@gmail.com",
    ])
    identity_contract = {
        "project_id": "lemon-screenplay-staging",
        "project_number": "549848020392",
        "runtime_service_account": runtime_account,
        "caller_service_account": (
            "benchmark-caller@lemon-screenplay-staging.iam.gserviceaccount.com"
        ),
        "deployer_service_account": (
            "benchmark-deployer@lemon-screenplay-staging.iam.gserviceaccount.com"
        ),
        "reviewed_effective_invokers": effective_invokers,
        "staging_storage_buckets": staging_storage_buckets,
        "workload_identity_provider": (
            "projects/549848020392/locations/global/workloadIdentityPools/"
            "github-staging/providers/github-lemon-screenplay"
        ),
        "workload_identity_pool": (
            "projects/549848020392/locations/global/workloadIdentityPools/"
            "github-staging"
        ),
        "workload_identity_subject": (
            "principal://iam.googleapis.com/projects/549848020392/locations/global/"
            "workloadIdentityPools/github-staging/subject/"
            "repo:brovzar-lab/Lemon-Screenplay-Dashboard:environment:staging"
        ),
        "github_repository": "brovzar-lab/Lemon-Screenplay-Dashboard",
        "github_ref": "refs/heads/main",
        "github_environment": "staging",
        "github_ref_protected_required": True,
        "staging_project_iam_contract_sha256": (
            STAGING_PROJECT_IAM_CONTRACT_SHA256
        ),
        "staging_storage_iam_contract_sha256": (
            STAGING_STORAGE_IAM_CONTRACT_SHA256
        ),
        "staging_metadata_reader_contract_sha256": (
            STAGING_IDENTITY_READER_CONTRACT_SHA256
        ),
    }
    privileged_emails = sorted([
        "benchmark-caller@lemon-screenplay-staging.iam.gserviceaccount.com",
        "benchmark-deployer@lemon-screenplay-staging.iam.gserviceaccount.com",
        runtime_account,
        "firebase-adminsdk-fbsvc@lemon-screenplay-staging.iam.gserviceaccount.com",
        "549848020392-compute@developer.gserviceaccount.com",
        "lemon-screenplay-staging@appspot.gserviceaccount.com",
    ])
    privileged_inventory = [
        {
            "email": email,
            "policy_sha256": f"{index:x}" * 64,
            "key_inventory_sha256": f"{index + 6:x}" * 64,
            "system_managed_key_count": 2,
        }
        for index, email in enumerate(privileged_emails, start=1)
    ]
    identity_contract.update({
        "privileged_service_accounts": privileged_emails,
        "provider_managed_invoker_service_agents": sorted([
            "service-549848020392@gcp-sa-cloudbuild.iam.gserviceaccount.com",
            "service-549848020392@gcf-admin-robot.iam.gserviceaccount.com",
            "service-549848020392@gcp-sa-pubsub.iam.gserviceaccount.com",
            "service-549848020392@serverless-robot-prod.iam.gserviceaccount.com",
        ]),
    })
    staging_identity_proof = {
        "status": "passed_reviewed_staging_identity_contract",
        "scanner_version": "staging-identity-and-effective-invokers-v2",
        "verified_at": "2026-08-28T12:00:00Z",
        **identity_contract,
        "identity_contract_sha256": _sha256_json(identity_contract),
        "project_resource_sha256": "b" * 64,
        "project_iam_policy_sha256": "c" * 64,
        "direct_run_policy_sha256": "d" * 64,
        "secret_policy_sha256": "e" * 64,
        "privileged_service_account_inventory_sha256": _sha256_json(
            privileged_inventory
        ),
        "privileged_service_account_inventory": privileged_inventory,
        "workload_identity_provider_sha256": "7" * 64,
        "workload_identity_provider_inventory_sha256": "0" * 64,
        "workload_identity_pool_sha256": "8" * 64,
        "workload_identity_pool_policy_sha256": "9" * 64,
        "role_definitions_sha256": "2" * 64,
        "staging_metadata_reader_role_definition_sha256": "4" * 64,
        "staging_storage_resources_sha256": "3" * 64,
    }
    staging_identity_proof["proof_sha256"] = _sha256_json(
        staging_identity_proof
    )
    digest = "sha256:" + "4" * 64
    receipt = {
        "project_id": "lemon-screenplay-staging",
        "region": "us-central1",
        "function_name": "llmProxyCandidate",
        "function_uri": proxy_url,
        "cloud_run_service": (
            "projects/lemon-screenplay-staging/locations/us-central1/services/"
            "llmproxycandidate"
        ),
        "cloud_run_revision": "llmproxycandidate-00005-abc",
        "runtime_service_account": runtime_account,
        "runtime": "nodejs22",
        "entry_point": "llmProxyCandidate",
        "runtime_update_policy": "automatic",
        "runtime_version": None,
        "build_service_account": (
            "projects/lemon-screenplay-staging/serviceAccounts/"
            "549848020392-compute@developer.gserviceaccount.com"
        ),
        "docker_repository": (
            "projects/lemon-screenplay-staging/locations/us-central1/"
            "repositories/gcf-artifacts"
        ),
        "available_memory": "512M",
        "available_cpu": "0.3333",
        "ingress_settings": "ALLOW_ALL",
        "timeout_seconds": 3600,
        "max_instance_count": 5,
        "concurrency": 1,
        "build_resource": "projects/549848020392/locations/us-central1/builds/build-1",
        "container_image": (
            "us-central1-docker.pkg.dev/lemon-screenplay-staging/gcf-artifacts/"
            f"candidate@{digest}"
        ),
        "container_image_digest": digest,
        "function_resource_sha256": "5" * 64,
        "revision_resource_sha256": "6" * 64,
        "git_sha": git_sha,
        "catalog_sha256": _catalog_sha256(),
        "pricing_sha256": _runtime_pricing_sha256(),
        "inference_geo": "global",
        "run_id": run_id,
        "cap_microusd": cap_microusd,
        "prior_audit_spend_microusd": prior_microusd,
        "build_timestamp": "2026-08-28T12:01:00.000Z",
        "deployment_config_sha256": _deployment_config_sha256(
            catalog, run_id, cap_microusd, prior_microusd, "global"
        ),
        "firebase_config_project_id": "lemon-screenplay-staging",
        "runtime_environment_sha256": "7" * 64,
        "secret_environment_variables": [{
            "key": "BENCHMARK_ANTHROPIC_API_KEY",
            "projectId": "549848020392",
            "secret": "BENCHMARK_ANTHROPIC_API_KEY",
            "version": "7",
        }],
        "staging_project_number": "549848020392",
        "production_isolation_proof": proof,
        "production_storage_acl_proof": storage_acl_proof,
        "staging_identity_proof": staging_identity_proof,
    }
    receipt["receipt_sha256"] = _sha256_json(receipt)
    return receipt, catalog


class ModelBenchmarkSafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.pdf_path = Path(self.temp_dir.name) / "test.pdf"
        self.pdf_path.write_bytes(b"benchmark screenplay bytes")
        self.pdf_sha256 = hashlib.sha256(self.pdf_path.read_bytes()).hexdigest()

    def tearDown(self):
        self.temp_dir.cleanup()

    def _input_record(self):
        return {
            "path": str(self.pdf_path),
            "filename": self.pdf_path.name,
            "content_sha256": self.pdf_sha256,
        }

    def test_approved_unicode_filename_is_preserved_exactly(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            filename = "La Sazón de Mamá_D8.pdf"
            path = Path(temp_dir) / filename
            path.write_bytes(b"approved screenplay bytes")
            digest = hashlib.sha256(path.read_bytes()).hexdigest()

            record = _validated_inputs([str(path)], [digest])[0]

        self.assertEqual(record["filename"], filename)

    def test_rejected_output_hash_matches_engine_integral_float_normalization(self):
        self.assertEqual(
            _engine_output_sha256({"score": 7.0, "nested": [1.0, 2.5]}),
            _engine_output_sha256({"score": 7, "nested": [1, 2.5]}),
        )

    def test_discarded_call_requires_a_finite_rejected_output_status(self):
        run = {
            "usage": {
                "calls": [],
                "failed_calls": [{
                    "call_id": "6" * 64,
                    "disposition": "discarded_unusable",
                    "rejected_output_status": "unknown",
                }],
            },
        }
        with self.assertRaisesRegex(
            BenchmarkSafetyError,
            "declare exact rejected-output availability",
        ):
            _validate_local_rejected_artifacts(run, Path(self.temp_dir.name))

    def test_orphan_correction_target_is_rejected_without_artifact_directory(self):
        run = {
            "usage": {
                "calls": [{
                    "response_id": "msg_orphan_target",
                    "correction_source": {
                        "source_response_id": "msg_missing_source",
                    },
                }],
                "failed_calls": [],
            },
        }
        with self.assertRaisesRegex(
            BenchmarkSafetyError,
            "not bound to one exact source and target call",
        ):
            _validate_local_rejected_artifacts(run, Path(self.temp_dir.name))

        dangling_state = {
            "usage": {
                "calls": [{
                    "response_id": "msg_dangling_state",
                    "correction_delivery_state": "settled_after_dispatch",
                }],
                "failed_calls": [],
            },
        }
        with self.assertRaisesRegex(
            BenchmarkSafetyError,
            "lacks its source lineage",
        ):
            _validate_local_rejected_artifacts(
                dangling_state,
                Path(self.temp_dir.name),
            )

    def test_correction_replay_is_hash_bound_to_source_artifact_and_target(self):
        run_dir = Path(self.temp_dir.name)
        artifact_dir = run_dir / "engine" / "rejected-responses"
        artifact_dir.mkdir(parents=True, mode=0o700)
        artifact_dir.chmod(0o700)
        report = {"reader": "structure", "pillar_score": 7}
        rejected_output = [{
            "type": "tool_use",
            "name": "submit_structure_report",
            "input": {
                "contract": "submit_structure_report",
                "application_schema_sha256": "3" * 64,
                "report_json": json.dumps(report),
            },
        }]
        rejected_output_sha256 = _engine_output_sha256(rejected_output)
        replay_report_sha256 = _engine_output_sha256(report)
        artifact = {
            "stage": "reader",
            "attempt": 1,
            "request_sha256": "1" * 64,
            "prompt_sha256": "2" * 64,
            "schema_sha256": "3" * 64,
            "response_id": "msg_reader_1",
            "requested_model": "claude-sonnet-5",
            "returned_model": "claude-sonnet-5",
            "validation_rule": "missing required field",
            "disposition": "discarded_unusable",
            "rejected_output_sha256": rejected_output_sha256,
            "rejected_output": rejected_output,
        }
        encoded = (
            json.dumps(
                artifact,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            )
            + "\n"
        ).encode("utf-8")
        artifact_sha256 = hashlib.sha256(encoded).hexdigest()
        artifact_path = artifact_dir / f"reader-{artifact_sha256}.json"
        artifact_path.write_bytes(encoded)
        artifact_path.chmod(0o600)
        correction_source = {
            "source_response_id": "msg_reader_1",
            "source_request_sha256": "1" * 64,
            "source_attempt_number": 1,
            "rejected_output_sha256": rejected_output_sha256,
            "rejected_artifact_sha256": artifact_sha256,
            "replay_report_sha256": replay_report_sha256,
        }
        source = {
            "call_id": "4" * 64,
            "stage": "reader",
            "reader_name": "structure",
            "pipeline_pass": "sonnet",
            "boundary_run": 1,
            "logical_retry": 0,
            "attempt_number": 1,
            "response_id": "msg_reader_1",
            "request_sha256": "1" * 64,
            "prompt_sha256": "2" * 64,
            "prompt_contract_version": "v9-test-prompt",
            "schema_mode": "compact_strict_tool",
            "schema_sha256": "3" * 64,
            "transport_schema_sha256": "8" * 64,
            "started_at": "2026-08-27T12:00:00Z",
            "completed_at": "2026-08-27T12:00:01Z",
            "requested_model": "claude-sonnet-5",
            "returned_model": "claude-sonnet-5",
            "validation_reason": "missing required field",
            "disposition": "discarded_unusable",
            "downstream_consumption": "correction_only",
            "rejected_output_status": "available",
            "rejected_output_sha256": rejected_output_sha256,
            "rejected_artifact_sha256": artifact_sha256,
            "rejected_artifact_path": str(artifact_path),
            "correction_replay": {
                "delivery_state": "settled_after_dispatch",
                "target_call_id": "7" * 64,
                "target_response_id": "msg_reader_2",
                "target_response_id_status": "available",
                "target_request_sha256": "5" * 64,
                "target_prompt_sha256": "6" * 64,
                "target_attempt_number": 2,
                "replay_report_sha256": replay_report_sha256,
            },
        }
        target = {
            "call_id": "7" * 64,
            "stage": "reader",
            "reader_name": "structure",
            "pipeline_pass": "sonnet",
            "boundary_run": 1,
            "logical_retry": 1,
            "attempt_number": 2,
            "response_id": "msg_reader_2",
            "requested_model": "claude-sonnet-5",
            "request_sha256": "5" * 64,
            "prompt_sha256": "6" * 64,
            "prompt_contract_version": "v9-test-prompt",
            "schema_mode": "compact_strict_tool",
            "schema_sha256": "3" * 64,
            "transport_schema_sha256": "8" * 64,
            "started_at": "2026-08-27T12:00:02Z",
            "completed_at": "2026-08-27T12:00:03Z",
            "disposition": "used",
            "correction_source": correction_source,
            "correction_delivery_state": "settled_after_dispatch",
        }
        run = {"usage": {"calls": [source, target], "failed_calls": []}}

        _validate_local_rejected_artifacts(run, run_dir)

        mislabeled_success = copy.deepcopy(run)
        mislabeled_success["usage"]["calls"][0][
            "downstream_consumption"
        ] = "correction_attempted"
        mislabeled_success["usage"]["calls"][0]["correction_replay"][
            "delivery_state"
        ] = "uncertain_after_dispatch"
        mislabeled_success["usage"]["calls"][1][
            "correction_delivery_state"
        ] = "uncertain_after_dispatch"
        with self.assertRaisesRegex(
            BenchmarkSafetyError,
            "not bound to one exact source and target call",
        ):
            _validate_local_rejected_artifacts(mislabeled_success, run_dir)

        mislabeled_ambiguous = copy.deepcopy(run)
        ambiguous_source, ambiguous_target = mislabeled_ambiguous["usage"]["calls"]
        mislabeled_ambiguous["usage"]["calls"] = [ambiguous_source]
        mislabeled_ambiguous["usage"]["failed_calls"] = [ambiguous_target]
        ambiguous_target["response_id"] = None
        ambiguous_target["uncertainty_status"] = "reservation_held"
        ambiguous_source["correction_replay"].update({
            "target_response_id": None,
            "target_response_id_status": "unavailable",
        })
        with self.assertRaisesRegex(
            BenchmarkSafetyError,
            "not bound to one exact source and target call",
        ):
            _validate_local_rejected_artifacts(mislabeled_ambiguous, run_dir)

        reversed_time = copy.deepcopy(run)
        reversed_time["usage"]["calls"][1][
            "started_at"
        ] = "2026-08-27T11:59:59Z"
        with self.assertRaisesRegex(
            BenchmarkSafetyError,
            "chronology is inconsistent",
        ):
            _validate_local_rejected_artifacts(reversed_time, run_dir)

        schema_drift = copy.deepcopy(run)
        schema_drift["usage"]["calls"][1]["schema_sha256"] = "0" * 64
        with self.assertRaisesRegex(
            BenchmarkSafetyError,
            "not bound to one exact source and target call",
        ):
            _validate_local_rejected_artifacts(schema_drift, run_dir)

        target["correction_source"]["replay_report_sha256"] = "8" * 64
        with self.assertRaisesRegex(
            BenchmarkSafetyError,
            "not bound to one exact source and target call",
        ):
            _validate_local_rejected_artifacts(run, run_dir)

        target["correction_source"]["replay_report_sha256"] = (
            replay_report_sha256
        )

        def write_tampered_artifact(tampered_output):
            tampered_output_sha256 = _engine_output_sha256(tampered_output)
            tampered_artifact = {
                **artifact,
                "rejected_output_sha256": tampered_output_sha256,
                "rejected_output": tampered_output,
            }
            tampered_encoded = (
                json.dumps(
                    tampered_artifact,
                    ensure_ascii=False,
                    separators=(",", ":"),
                    sort_keys=True,
                )
                + "\n"
            ).encode("utf-8")
            artifact_path.write_bytes(tampered_encoded)
            artifact_path.chmod(0o600)
            tampered_artifact_sha256 = hashlib.sha256(tampered_encoded).hexdigest()
            source["rejected_output_sha256"] = tampered_output_sha256
            source["rejected_artifact_sha256"] = tampered_artifact_sha256
            target["correction_source"][
                "rejected_output_sha256"
            ] = tampered_output_sha256
            target["correction_source"][
                "rejected_artifact_sha256"
            ] = tampered_artifact_sha256

        tamper_cases = {
            "tool name": lambda output: output[0].update({
                "name": "submit_concept_report",
            }),
            "contract": lambda output: output[0]["input"].update({
                "contract": "submit_concept_report",
            }),
            "application schema": lambda output: output[0]["input"].update({
                "application_schema_sha256": "9" * 64,
            }),
        }
        for label, mutate in tamper_cases.items():
            with self.subTest(tamper=label):
                tampered_output = copy.deepcopy(rejected_output)
                mutate(tampered_output)
                write_tampered_artifact(tampered_output)
                with self.assertRaisesRegex(
                    BenchmarkSafetyError,
                    "does not match its exact tool and schema",
                ):
                    _validate_local_rejected_artifacts(run, run_dir)

    def test_local_cap_records_each_conservative_preflight_and_settlement(self):
        cap = LocalCostCap(1.0, {
            "modelProfiles": {
                "model-1": {
                    "inputUsdPerMillion": 1,
                    "outputUsdPerMillion": 1,
                },
            },
        })
        usage = {
            "actual_cost_microusd": 10_000,
            "actual_cost_usd": 0.01,
            "calls": [{"response_id": "msg_budget"}],
        }

        cap.call(
            lambda **_kwargs: (None, "ok", usage),
            {"sonnet": "model-1"},
            model_key="sonnet",
            system_blocks=[],
            user_blocks=[],
            max_tokens=10,
            stage="triage",
            logical_retry=0,
        )

        self.assertEqual(len(cap.checks), 1)
        check = cap.checks[0]
        self.assertEqual(check["decision"], "settled")
        self.assertEqual(check["spent_before_usd"], 0.0)
        self.assertEqual(check["settled_cost_usd"], 0.01)
        self.assertEqual(usage["calls"][0]["budget_check"], check)

    def test_local_cap_reserves_the_effective_adaptive_high_ceiling(self):
        from execution import ingest_v9

        model_id = "claude-sonnet-5"
        cap = LocalCostCap(
            1.0,
            {
                "modelProfiles": {
                    model_id: {
                        "inputUsdPerMillion": 2,
                        "outputUsdPerMillion": 10,
                    },
                },
            },
            output_token_ceiling=ingest_v9.effective_max_tokens,
        )
        usage = {
            "actual_cost_microusd": 1,
            "actual_cost_usd": 0.000001,
            "calls": [{"response_id": "msg_adaptive_headroom"}],
        }

        cap.call(
            lambda **_kwargs: (None, "ok", usage),
            {"sonnet": model_id},
            model_key="sonnet",
            system_blocks=[],
            user_blocks=[],
            thinking_budget=8_000,
            max_tokens=4_000,
            stage="reader",
        )

        self.assertEqual(cap.checks[0]["output_tokens_upper_bound"], 32_000)

    def test_local_cap_never_assumes_an_ambiguous_failure_was_free(self):
        cap = LocalCostCap(1.0, {
            "modelProfiles": {
                "model-1": {
                    "inputUsdPerMillion": 1,
                    "outputUsdPerMillion": 1,
                },
            },
        })

        with self.assertRaisesRegex(RuntimeError, "response lost") as raised:
            cap.call(
                lambda **_kwargs: (_ for _ in ()).throw(
                    RuntimeError("response lost after dispatch")
                ),
                {"sonnet": "model-1"},
                model_key="sonnet",
                system_blocks=[],
                user_blocks=[],
                max_tokens=10,
                stage="reader",
            )

        self.assertGreater(cap.spent_usd, 0)
        self.assertEqual(
            cap.checks[0]["decision"],
            "charged_conservative_uncertain_ceiling",
        )
        self.assertEqual(
            raised.exception.usage["failed_calls"][0]["uncertainty_status"],
            "client_result_unsettled",
        )

    def test_invalid_proxy_settlement_is_charged_checkpointed_and_visible(self):
        cap = LocalCostCap(1.0, {
            "modelProfiles": {
                "model-1": {
                    "inputUsdPerMillion": 1,
                    "outputUsdPerMillion": 1,
                },
            },
        })
        checkpoints = []
        call_id = "8" * 64
        malformed_usage = {
            "calls": [{
                "call_id": call_id,
                "requested_model": "model-1",
                "returned_model": "model-1",
                "response_id": "msg_invalid_settlement",
                "stage": "reader",
                "pipeline_pass": "sonnet",
                "boundary_run": 1,
                "logical_retry": 0,
                "usage": {
                    "input_tokens": 10,
                    "output_tokens": 2,
                    "cache_creation_input_tokens": 0,
                    "cache_read_input_tokens": 0,
                    "call_count": 1,
                },
            }],
        }

        with patch(
            "execution.ingest_v9._BENCHMARK_CALL_CHECKPOINT",
            checkpoints.append,
        ), self.assertRaisesRegex(BenchmarkSafetyError, "settled cost") as raised:
            cap.call(
                lambda **_kwargs: (None, "unusable", malformed_usage),
                {"sonnet": "model-1"},
                model_key="sonnet",
                system_blocks=[],
                user_blocks=[],
                max_tokens=10,
                stage="reader",
                pipeline_pass="sonnet",
            )

        failed = raised.exception.usage["failed_calls"][0]
        self.assertEqual(cap.spent_microusd, cap.checks[0]["request_ceiling_microusd"])
        self.assertEqual(failed["call_id"], call_id)
        self.assertEqual(failed["failure_state"], "invalid_cost_settlement")
        self.assertEqual(failed["budget_check"]["decision"], "charged_conservative_invalid_settlement")
        self.assertEqual(checkpoints, [failed])

    def test_resume_reconciles_a_paid_model_mismatch_as_server_settled(self):
        call_id = "9" * 64
        call_usage = {
            "input_tokens": 10,
            "output_tokens": 2,
            "cache_creation_input_tokens": 0,
            "cache_read_input_tokens": 0,
            "actual_cost_microusd": 10,
            "charged_cost_microusd": 10,
            "estimated_cost_nanousd": 10_000,
            "rounding_variance_nanousd": 0,
            "rounding_reason": None,
            "inference_geo": "global",
            "service_tier": "standard",
        }
        local_call = {
            "call_id": call_id,
            "requested_model": "claude-sonnet-5",
            "returned_model": "claude-opus-5",
            "response_id": "msg_wrong_model",
            "stop_reason": "end_turn",
            "stage": "reader",
            "pipeline_pass": "sonnet",
            "reader_name": "structure",
            "logical_retry": 0,
            "boundary_run": 1,
            "request_sha256": "1" * 64,
            "prompt_sha256": "2" * 64,
            "schema_mode": "strict_tool",
            "schema_sha256": "3" * 64,
            "transport_schema_sha256": "4" * 64,
            "failure_state": "model_provenance_mismatch",
            "disposition": "discarded_unusable",
            "budget_check": {"request_ceiling_microusd": 1_000},
            "usage": call_usage,
        }
        contracts = {
            "prompt_bundle_sha256": "5" * 64,
            "schema_bundle_sha256": "6" * 64,
        }
        manifest = {
            "prior_audit_spend_microusd": 106_425,
            "prior_audit_call_count": 2,
            "prior_audit_uncertain_call_count": 0,
            "prior_audit_uncertain_spend_microusd": 0,
            "actual_cost_microusd": 10,
            "contracts": contracts,
            "runs": [{
                "status": "failed",
                "input_sha256": self.pdf_sha256,
                "route": "sonnet",
                "generation": "candidate",
                "provenance": {"calls": [], "failed_calls": [local_call]},
            }],
        }
        server_call = {
            "call_id": call_id,
            "status": "settled",
            "requested_model": "claude-sonnet-5",
            "returned_model": "claude-opus-5",
            "response_id": "msg_wrong_model",
            "stop_reason": "end_turn",
            "screenplay_sha256": self.pdf_sha256,
            "route": "sonnet",
            "generation": "candidate",
            "pipeline_stage": "reader",
            "pipeline_pass": "sonnet",
            "reader_name": "structure",
            "retry_number": 0,
            "boundary_run": 1,
            "prompt_bundle_sha256": contracts["prompt_bundle_sha256"],
            "schema_bundle_sha256": contracts["schema_bundle_sha256"],
            "request_sha256": "1" * 64,
            "prompt_sha256": "2" * 64,
            "schema_mode": "strict_tool",
            "schema_sha256": "3" * 64,
            "transport_schema_sha256": "4" * 64,
            "reservation_ceiling_microusd": 900,
            "reserved_microusd": 0,
            "actual_cost_microusd": 10,
            "charged_cost_microusd": 10,
            "estimated_cost_nanousd": 10_000,
            "rounding_variance_nanousd": 0,
            "rounding_reason": None,
            "usage": {
                "input_tokens": 10,
                "output_tokens": 2,
                "cache_creation_input_tokens": 0,
                "cache_read_input_tokens": 0,
                "inference_geo": "global",
                "service_tier": "standard",
            },
        }
        ledger = {
            "run": {
                "spent_microusd": 10,
                "reserved_microusd": 0,
                "uncertain_call_count": 0,
                "uncertain_spend_microusd": 0,
                "call_count": 1,
            },
            "audit": {
                "spent_microusd": 106_435,
                "reserved_microusd": 0,
                "uncertain_call_count": 0,
                "uncertain_spend_microusd": 0,
                "call_count": 3,
            },
            "calls": [server_call],
        }

        _validate_resume_ledger(manifest, ledger)
        server_call["returned_model"] = "claude-sonnet-5"
        with self.assertRaisesRegex(BenchmarkSafetyError, "does not reconcile"):
            _validate_resume_ledger(manifest, ledger)

    def test_local_cap_reserves_concurrent_reader_ceiling_before_dispatch(self):
        cap = LocalCostCap(0.061, {
            "modelProfiles": {
                "model-1": {
                    "inputUsdPerMillion": 1,
                    "outputUsdPerMillion": 1,
                },
            },
        })
        started = threading.Event()
        release = threading.Event()
        failures = []

        def slow_call(**_kwargs):
            started.set()
            release.wait(2)
            return None, "ok", {
                "actual_cost_microusd": 1_000,
                "actual_cost_usd": 0.001,
                "calls": [{"response_id": "msg_first"}],
            }

        def run_first():
            try:
                cap.call(
                    slow_call,
                    {"sonnet": "model-1"},
                    model_key="sonnet",
                    system_blocks=[],
                    user_blocks=[],
                    max_tokens=10,
                    stage="reader",
                )
            except Exception as error:  # pragma: no cover - assertion below reports it
                failures.append(error)

        worker = threading.Thread(target=run_first)
        worker.start()
        self.assertTrue(started.wait(1))
        try:
            with self.assertRaisesRegex(BenchmarkSafetyError, "remaining local cap"):
                cap.call(
                    lambda **_kwargs: None,
                    {"sonnet": "model-1"},
                    model_key="sonnet",
                    system_blocks=[],
                    user_blocks=[],
                    max_tokens=10,
                    stage="reader",
                )
        finally:
            release.set()
            worker.join(2)

        self.assertFalse(failures)
        self.assertEqual(cap.checks[0]["decision"], "settled")
        self.assertEqual(cap.checks[1]["decision"], "rejected_before_dispatch")

    def test_platform_drift_blocks_dispatch_and_releases_local_reservation(self):
        called = False

        def original(**_kwargs):
            nonlocal called
            called = True

        cap = LocalCostCap(
            1.0,
            {
                "modelProfiles": {
                    "model-1": {
                        "inputUsdPerMillion": 1,
                        "outputUsdPerMillion": 1,
                    },
                },
            },
            pre_dispatch_check=Mock(
                side_effect=BenchmarkSafetyError("candidate platform drifted")
            ),
        )

        with self.assertRaisesRegex(BenchmarkSafetyError, "platform drifted"):
            cap.call(
                original,
                {"sonnet": "model-1"},
                model_key="sonnet",
                system_blocks=[],
                user_blocks=[],
                max_tokens=10,
                stage="reader",
            )

        self.assertFalse(called)
        self.assertEqual(cap.reserved_microusd, 0)
        self.assertEqual(cap.spent_microusd, 0)
        self.assertEqual(
            cap.checks[0]["decision"],
            "rejected_platform_drift_before_dispatch",
        )

    def test_failure_manifest_preserves_sanitized_reason_and_review_evidence(self):
        from execution import ingest_v9

        usage = ingest_v9.empty_usage()
        usage["calls"] = [{
            "response_id": "msg_rejected",
            "rejected_artifact_sha256": "a" * 64,
        }]
        error = ingest_v9.GenreDetectionIncompleteError(
            "Genre detection failed: non-comedy genres must not declare comedy pairing",
            usage,
            review_evidence={
                "validation_reason": (
                    "non-comedy genres must not declare comedy pairing"
                ),
                "rejected_responses": [{
                    "rejected_artifact_sha256": "a" * 64,
                }],
            },
        )
        run = {"status": "planned"}

        _record_run_failure(run, error)

        self.assertEqual(run["status"], "failed")
        self.assertEqual(run["failure"]["type"], "GenreDetectionIncompleteError")
        self.assertEqual(run["failure"]["review_kind"], "genre_detection_review")
        self.assertEqual(
            run["failure"]["review_evidence"]["validation_reason"],
            "non-comedy genres must not declare comedy pairing",
        )
        self.assertIn("non-comedy genres", run["failure"]["message"])
        self.assertEqual(run["provenance"]["response_ids"], ["msg_rejected"])

    def test_late_local_integrity_failure_keeps_checkpointed_spend_and_provenance(self):
        call = {
            "call_id": "7" * 64,
            "requested_model": "claude-sonnet-5",
            "returned_model": "claude-sonnet-5",
            "response_id": "msg_settled_before_local_failure",
            "stage": "claim_verification",
            "pipeline_pass": "sonnet",
            "boundary_run": 1,
            "logical_retry": 0,
            "validation_result": "passed",
            "disposition": "used",
            "failure_state": None,
            "usage": {
                "input_tokens": 100,
                "output_tokens": 20,
                "cache_creation_input_tokens": 0,
                "cache_read_input_tokens": 0,
                "call_count": 1,
                "actual_cost_microusd": 321,
                "charged_cost_microusd": 321,
                "estimated_cost_nanousd": 321_000,
                "rounding_variance_nanousd": 0,
                "rounding_reason": None,
            },
        }
        run = {"status": "running", "checkpointed_calls": [call]}
        error = BenchmarkSafetyError(
            "Paid benchmark requires the local V9 engine to be the exact clean merged commit."
        )

        _record_run_failure(run, error)
        manifest = {"runs": [run]}
        _refresh_manifest_cost_totals(manifest)

        self.assertEqual(run["usage"]["actual_cost_microusd"], 321)
        self.assertEqual(run["provenance"]["calls"], [call])
        self.assertEqual(
            run["provenance"]["response_ids"],
            ["msg_settled_before_local_failure"],
        )
        self.assertEqual(manifest["actual_cost_microusd"], 321)
        self.assertEqual(manifest["independent_cost_status"], "complete")
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
        error.usage = {
            "actual_cost_microusd": 12_500,
            "actual_cost_usd": 0.0125,
        }

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

    def test_post_dispatch_timeout_is_conservatively_charged_and_fully_recorded(self):
        from execution import ingest_v9

        model_id = "claude-sonnet-5"
        cap = LocalCostCap(1.0, {
            "modelProfiles": {
                model_id: {
                    "inputUsdPerMillion": 2,
                    "outputUsdPerMillion": 10,
                },
            },
        })
        context = {
            "run_id": "timeout-proof",
            "screenplay_sha256": "a" * 64,
            "route": "sonnet",
            "generation": "candidate",
            "prompt_bundle_sha256": "b" * 64,
            "schema_bundle_sha256": "c" * 64,
        }
        original = ingest_v9.MODEL_IDS["sonnet"]
        ingest_v9.MODEL_IDS["sonnet"] = model_id
        ingest_v9.configure_benchmark_online_transport(
            context,
            lambda: "short-lived",
            _release(),
        )
        sentinel = "PRIVATE_SCREENPLAY_SENTINEL"
        try:
            with patch.object(
                ingest_v9.requests,
                "post",
                side_effect=ingest_v9.requests.Timeout(sentinel),
            ):
                with self.assertRaises(ingest_v9.LlmCallFailedError) as raised:
                    cap.call(
                        ingest_v9.call_llm,
                        ingest_v9.MODEL_IDS,
                        model_key="sonnet",
                        system_blocks=[{"type": "text", "text": "system"}],
                        user_blocks=[{"type": "text", "text": sentinel}],
                        max_tokens=10,
                        proxy_url="https://candidate.example/llmProxyCandidate",
                        stage="triage",
                        pipeline_pass="triage",
                        boundary_run=1,
                    )
        finally:
            ingest_v9.clear_benchmark_online_transport()
            ingest_v9.MODEL_IDS["sonnet"] = original

        usage = ingest_v9.failed_usage(raised.exception)
        failed = usage["failed_calls"][0]
        self.assertEqual(
            usage["actual_cost_microusd"],
            cap.checks[0]["request_ceiling_microusd"],
        )
        self.assertRegex(failed["call_id"], r"^[a-f0-9]{64}$")
        self.assertRegex(failed["request_sha256"], r"^[a-f0-9]{64}$")
        self.assertRegex(failed["prompt_sha256"], r"^[a-f0-9]{64}$")
        self.assertIsNone(failed["returned_model"])
        self.assertIsNone(failed["response_id"])
        self.assertEqual(failed["expected_release"], _release())
        self.assertEqual(failed["uncertainty_status"], "client_result_unsettled")
        self.assertEqual(failed["downstream_consumption"], "not_consumed")
        self.assertEqual(failed["usage"]["actual_cost_microusd"], usage["actual_cost_microusd"])
        self.assertNotIn(sentinel, json.dumps({"usage": usage, "checks": cap.checks}))

    def test_atomic_checkpoint_failure_preserves_the_previous_manifest(self):
        path = Path(self.temp_dir.name) / "manifest.json"
        with patch(
            "execution.model_benchmark.ARTIFACTS_ROOT",
            Path(self.temp_dir.name),
        ), patch(
            "execution.model_benchmark.ROOT",
            Path(self.temp_dir.name),
        ):
            _atomic_write_json(path, {"status": "safe", "cost": 123})

            with patch(
                "execution.model_benchmark.os.replace",
                side_effect=OSError("simulated interruption"),
            ):
                with self.assertRaisesRegex(OSError, "interruption"):
                    _atomic_write_json(path, {"status": "truncated", "cost": 999})

        self.assertEqual(
            json.loads(path.read_text(encoding="utf-8")),
            {"status": "safe", "cost": 123},
        )

    def test_interrupted_settled_call_is_journaled_and_never_redispatched(self):
        path = Path(self.temp_dir.name) / "interrupted-manifest.json"
        contracts = {
            "prompt_bundle_sha256": "a" * 64,
            "schema_bundle_sha256": "b" * 64,
        }
        run = {
            "status": "running",
            "input_sha256": self.pdf_sha256,
            "route": "sonnet",
            "generation": "candidate",
        }
        manifest = {
            "contracts": contracts,
            "prior_audit_spend_microusd": 106_425,
            "prior_audit_call_count": 2,
            "prior_audit_uncertain_call_count": 0,
            "prior_audit_uncertain_spend_microusd": 0,
            "actual_cost_microusd": 0,
            "runs": [run],
        }
        call = {
            "call_id": "f" * 64,
            "requested_model": "claude-sonnet-5",
            "returned_model": "claude-sonnet-5",
            "response_id": "msg_interrupted",
            "stage": "reader",
            "pipeline_pass": "sonnet",
            "reader_name": "structure",
            "logical_retry": 0,
            "boundary_run": 1,
            "request_sha256": "1" * 64,
            "prompt_sha256": "2" * 64,
            "schema_mode": "strict_tool",
            "schema_sha256": "3" * 64,
            "transport_schema_sha256": "4" * 64,
            "budget_check": {"request_ceiling_microusd": 1_000},
            "validation_result": "pending_application_validation",
            "usage": {
                "input_tokens": 1,
                "output_tokens": 2,
                "cache_creation_input_tokens": 3,
                "cache_read_input_tokens": 4,
                "actual_cost_microusd": 12,
                "charged_cost_microusd": 12,
                "estimated_cost_nanousd": 12_000,
                "rounding_variance_nanousd": 0,
                "rounding_reason": None,
            },
        }
        lock = threading.Lock()
        with patch(
            "execution.model_benchmark.ARTIFACTS_ROOT",
            Path(self.temp_dir.name),
        ), patch(
            "execution.model_benchmark.ROOT",
            Path(self.temp_dir.name),
        ):
            _checkpoint_run_call(manifest, run, path, call, lock)
            finalized = {
                **call,
                "validation_result": "passed",
                "disposition": "used",
            }
            _checkpoint_run_call(manifest, run, path, finalized, lock)

        stored = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(stored["actual_cost_microusd"], 12)
        self.assertEqual(stored["runs"][0]["checkpointed_calls"], [finalized])
        ledger = {
            "run": {
                "spent_microusd": 12,
                "reserved_microusd": 0,
                "uncertain_call_count": 0,
                "uncertain_spend_microusd": 0,
                "call_count": 1,
            },
            "audit": {
                "spent_microusd": 106_437,
                "reserved_microusd": 0,
                "uncertain_call_count": 0,
                "uncertain_spend_microusd": 0,
                "call_count": 3,
            },
            "calls": [{
                "call_id": call["call_id"],
                "status": "settled",
                "requested_model": call["requested_model"],
                "returned_model": call["returned_model"],
                "response_id": call["response_id"],
                "actual_cost_microusd": 12,
                "usage": {
                    "input_tokens": 1,
                    "output_tokens": 2,
                    "cache_creation_input_tokens": 3,
                    "cache_read_input_tokens": 4,
                },
                "screenplay_sha256": self.pdf_sha256,
                "route": "sonnet",
                "generation": "candidate",
                "pipeline_stage": "reader",
                "pipeline_pass": "sonnet",
                "reader_name": "structure",
                "retry_number": 0,
                "boundary_run": 1,
                "prompt_bundle_sha256": contracts["prompt_bundle_sha256"],
                "schema_bundle_sha256": contracts["schema_bundle_sha256"],
                "request_sha256": "1" * 64,
                "prompt_sha256": "2" * 64,
                "schema_mode": "strict_tool",
                "schema_sha256": "3" * 64,
                "transport_schema_sha256": "4" * 64,
                "reservation_ceiling_microusd": 900,
                "reserved_microusd": 0,
                "charged_cost_microusd": 12,
                "estimated_cost_nanousd": 12_000,
                "rounding_variance_nanousd": 0,
                "rounding_reason": None,
            }],
        }
        _validate_resume_ledger(stored, ledger)
        mismatched_usage = copy.deepcopy(ledger)
        mismatched_usage["calls"][0]["usage"]["input_tokens"] = 99
        with self.assertRaisesRegex(BenchmarkSafetyError, "does not reconcile"):
            _validate_resume_ledger(stored, mismatched_usage)
        with self.assertRaisesRegex(BenchmarkSafetyError, "manual review"):
            _resumable_runs(stored["runs"])

    def test_resume_skips_completed_runs_and_refuses_ambiguous_runs(self):
        completed = {"status": "complete", "input_sha256": "a" * 64}
        planned = {"status": "planned", "input_sha256": "b" * 64}
        self.assertEqual(_resumable_runs([completed, planned]), [planned])

        with self.assertRaisesRegex(BenchmarkSafetyError, "manual review"):
            _resumable_runs([{**planned, "status": "running"}])
        with self.assertRaisesRegex(BenchmarkSafetyError, "manual review"):
            _resumable_runs([{**planned, "status": "failed"}])

    def test_resume_validates_a_completed_seal_against_the_current_cap(self):
        from execution.test_trust_manifest import TrustManifestTests
        from execution.trust_manifest import build_benchmark_trust_seal

        seal_inputs = TrustManifestTests._benchmark_seal_inputs()
        trust_seal = build_benchmark_trust_seal(**seal_inputs)
        source = seal_inputs["source"]
        usage = seal_inputs["usage"]
        analysis = seal_inputs["analysis"]
        contracts = seal_inputs["contracts"]
        release = seal_inputs["release"]
        local_source_proof = seal_inputs["local_source_proof"]
        run = {
            "status": "complete",
            "input_sha256": source["source_sha256"],
            "input_filename": source["filename"],
            "route": seal_inputs["route"],
            "generation": "candidate",
            "model_id": seal_inputs["model_ids"]["sonnet"],
            "sonnet_model_id": seal_inputs["model_ids"]["sonnet"],
            "analysis": analysis,
            "usage": usage,
            "source_evidence": source,
            "parser_metadata": seal_inputs["parser_metadata"],
            "trust_seal": trust_seal,
            "model_ids": seal_inputs["model_ids"],
            "effective_model_tier": seal_inputs["effective_model_tier"],
            "release": release,
            "local_source_proof": local_source_proof,
            "checkpointed_calls": copy.deepcopy(usage["calls"]),
            "provenance": {
                "calls": usage["calls"],
                "response_ids": [call["response_id"] for call in usage["calls"]],
            },
        }
        model_configuration = _model_configuration(run)
        locked_at = "2026-08-27T13:00:00Z"
        run["output_lock"] = {
            "locked_at": locked_at,
            "source_sha256": source["source_sha256"],
            "page_evidence_sha256": source["page_evidence_sha256"],
            "scene_count_evidence_sha256": source[
                "scene_count_evidence"
            ]["evidence_sha256"],
            "model_configuration": model_configuration,
            "model_configuration_sha256": _sha256_json(model_configuration),
            "contract_bundle": contracts,
            "local_source_proof": local_source_proof,
            "trust_seal_integrity_sha256": trust_seal["integrity_sha256"],
            "analysis_sha256": _sha256_json(analysis),
            "usage_sha256": _sha256_json(usage),
            "verdict": analysis["verdict"],
        }
        run["output_lock"]["machine_output_sha256"] = _sha256_json({
            "locked_at": locked_at,
            "source_evidence": source,
            "model_configuration": model_configuration,
            "contracts": contracts,
            "analysis": analysis,
            "usage": usage,
            "trust_seal": trust_seal,
        })
        input_record = {
            "path": str(self.pdf_path),
            "filename": source["filename"],
            "content_sha256": source["source_sha256"],
        }
        planned = {
            key: value
            for key, value in run.items()
            if key in {
                "input_sha256", "input_filename", "route", "generation",
                "model_id", "sonnet_model_id",
            }
        }
        calibration = {
            "applied": False,
            "prompt_sha256": None,
            "prompt_stored": False,
        }
        manifest = {
            "inputs": [{
                key: value for key, value in input_record.items() if key != "path"
            }],
            "runs": [run],
            "contracts": contracts,
            "calibration": calibration,
            "candidate_preflight": {"release": release},
            "cost_cap_microusd": 40_000_000,
            "prior_audit_spend_microusd": 106_425,
            "actual_cost_microusd": usage["actual_cost_microusd"],
            "budget_checks": [
                copy.deepcopy(call["budget_check"])
                for call in usage["calls"]
            ],
        }
        common = {
            "inputs": [input_record],
            "planned_runs": [planned],
            "contracts": contracts,
            "release": release,
            "max_cost_usd": 40.0,
            "prior_audit_spend_usd": 0.106425,
            "calibration": calibration,
            "ledger": None,
        }

        _validate_resume_manifest(manifest, **common)
        self.assertEqual(_resumable_runs(manifest["runs"]), [])

        missing = copy.deepcopy(manifest)
        missing.pop("budget_checks")
        with self.assertRaisesRegex(BenchmarkSafetyError, "journal is missing"):
            _validate_resume_manifest(missing, **common)

        truncated = copy.deepcopy(manifest)
        truncated["budget_checks"].pop()
        with self.assertRaisesRegex(BenchmarkSafetyError, "does not match"):
            _validate_resume_manifest(truncated, **common)

        duplicated = copy.deepcopy(manifest)
        duplicated["budget_checks"].append(
            copy.deepcopy(duplicated["budget_checks"][-1])
        )
        with self.assertRaisesRegex(BenchmarkSafetyError, "does not match"):
            _validate_resume_manifest(duplicated, **common)

        mismatched = copy.deepcopy(manifest)
        mismatched["cost_cap_microusd"] = 39_000_000
        with self.assertRaisesRegex(BenchmarkSafetyError, "trust seal is invalid"):
            _validate_resume_manifest(
                mismatched,
                **{**common, "max_cost_usd": 39.0},
            )

    def test_resume_refuses_changed_source_contract_or_release(self):
        release = _release()
        inputs = [{
            "path": str(self.pdf_path),
            "filename": self.pdf_path.name,
            "content_sha256": self.pdf_sha256,
        }]
        run = {
            "status": "planned",
            "input_sha256": self.pdf_sha256,
            "input_filename": self.pdf_path.name,
            "route": "sonnet",
            "generation": "candidate",
            "model_id": "claude-sonnet-5",
        }
        contracts = {
            "prompt_bundle_sha256": "a" * 64,
            "schema_bundle_sha256": "b" * 64,
        }
        calibration = {
            "applied": False,
            "prompt_sha256": None,
            "prompt_stored": False,
        }
        manifest = {
            "inputs": [{key: value for key, value in inputs[0].items() if key != "path"}],
            "runs": [copy.deepcopy(run)],
            "contracts": contracts,
            "calibration": calibration,
            "candidate_preflight": {"release": release},
            "cost_cap_microusd": 1_000_000,
            "prior_audit_spend_microusd": 106_425,
            "prior_audit_call_count": 2,
            "prior_audit_uncertain_call_count": 0,
            "prior_audit_uncertain_spend_microusd": 0,
            "actual_cost_microusd": 0,
            "budget_checks": [],
        }
        common = {
            "inputs": inputs,
            "planned_runs": [run],
            "contracts": contracts,
            "release": release,
            "max_cost_usd": 1.0,
            "prior_audit_spend_usd": 0.106425,
            "calibration": calibration,
            "ledger": {
                "run": None,
                "audit": {
                    "spent_microusd": 106_425,
                    "reserved_microusd": 0,
                    "uncertain_call_count": 0,
                    "uncertain_spend_microusd": 0,
                    "call_count": 2,
                },
                "calls": [],
            },
        }
        _validate_resume_manifest(manifest, **common)

        changed = copy.deepcopy(common)
        changed["inputs"][0]["content_sha256"] = "0" * 64
        with self.assertRaisesRegex(BenchmarkSafetyError, "source identity"):
            _validate_resume_manifest(manifest, **changed)

        changed = copy.deepcopy(common)
        changed["release"]["git_sha"] = "0" * 40
        with self.assertRaisesRegex(BenchmarkSafetyError, "release"):
            _validate_resume_manifest(manifest, **changed)

        changed = copy.deepcopy(common)
        changed["contracts"] = {"prompt_bundle_sha256": "0" * 64}
        with self.assertRaisesRegex(BenchmarkSafetyError, "contracts"):
            _validate_resume_manifest(manifest, **changed)

        incomplete_lock = copy.deepcopy(manifest)
        incomplete_lock["runs"][0]["status"] = "complete"
        with self.assertRaisesRegex(BenchmarkSafetyError, "immutable lock"):
            _validate_resume_manifest(incomplete_lock, **common)

        completed_manifest = copy.deepcopy(manifest)
        completed_manifest["actual_cost_microusd"] = 10
        completed = completed_manifest["runs"][0]
        call = {
            "call_id": "f" * 64,
            "requested_model": "claude-sonnet-5",
            "returned_model": "claude-sonnet-5",
            "response_id": "msg_resume",
            "stage": "reader",
            "pipeline_pass": "sonnet",
            "reader_name": "structure",
            "logical_retry": 0,
            "boundary_run": 1,
            "request_sha256": "1" * 64,
            "prompt_sha256": "2" * 64,
            "schema_mode": "strict_tool",
            "schema_sha256": "3" * 64,
            "transport_schema_sha256": "4" * 64,
            "budget_check": {
                "request_ceiling_microusd": 1_000,
                "sequence": 1,
                "spent_before_microusd": 0,
                "reserved_before_microusd": 0,
                "remaining_before_microusd": 1_000_000,
                "decision": "settled",
                "settled_cost_microusd": 10,
                "spent_after_microusd": 10,
                "reserved_after_microusd": 0,
            },
            "usage": {
                "input_tokens": 1,
                "output_tokens": 2,
                "cache_creation_input_tokens": 0,
                "cache_read_input_tokens": 0,
                "actual_cost_microusd": 10,
                "charged_cost_microusd": 10,
                "estimated_cost_nanousd": 10_000,
                "rounding_variance_nanousd": 0,
                "rounding_reason": None,
            },
        }
        analysis = {"verdict": "CONSIDER"}
        usage = {"calls": [call]}
        source_evidence = {
            "source_sha256": self.pdf_sha256,
            "page_evidence_sha256": "5" * 64,
        }
        local_source_proof = {
            "before": {"git_sha": release["git_sha"], "clean": True},
            "after": {"git_sha": release["git_sha"], "clean": True},
        }
        trust_seal = {"integrity_sha256": "6" * 64}
        completed.update({
            "status": "complete",
            "analysis": analysis,
            "usage": usage,
            "source_evidence": source_evidence,
            "parser_metadata": {},
            "trust_seal": trust_seal,
            "model_ids": {"sonnet": "claude-sonnet-5"},
            "effective_model_tier": "sonnet",
            "release": release,
            "local_source_proof": local_source_proof,
            "checkpointed_calls": [copy.deepcopy(call)],
            "provenance": {"calls": [call], "response_ids": ["msg_resume"]},
        })
        completed_manifest["budget_checks"] = [
            copy.deepcopy(call["budget_check"])
        ]
        model_configuration = _model_configuration(completed)
        locked_at = "2026-08-27T13:00:00Z"
        completed["output_lock"] = {
            "locked_at": locked_at,
            "source_sha256": self.pdf_sha256,
            "page_evidence_sha256": "5" * 64,
            "model_configuration": model_configuration,
            "model_configuration_sha256": _sha256_json(model_configuration),
            "contract_bundle": contracts,
            "local_source_proof": local_source_proof,
            "trust_seal_integrity_sha256": "6" * 64,
            "analysis_sha256": _sha256_json(analysis),
            "usage_sha256": _sha256_json(usage),
            "verdict": "CONSIDER",
            "machine_output_sha256": _sha256_json({
                "locked_at": locked_at,
                "source_evidence": source_evidence,
                "model_configuration": model_configuration,
                "contracts": contracts,
                "analysis": analysis,
                "usage": usage,
                "trust_seal": trust_seal,
            }),
        }
        settled_ledger = {
            "run": {
                "spent_microusd": 10,
                "reserved_microusd": 0,
                "uncertain_call_count": 0,
                "uncertain_spend_microusd": 0,
                "call_count": 1,
            },
            "audit": {
                "spent_microusd": 106_435,
                "reserved_microusd": 0,
                "uncertain_call_count": 0,
                "uncertain_spend_microusd": 0,
                "call_count": 3,
            },
            "calls": [{
                "call_id": "f" * 64,
                "status": "settled",
                "requested_model": "claude-sonnet-5",
                "returned_model": "claude-sonnet-5",
                "response_id": "msg_resume",
                "actual_cost_microusd": 10,
                "usage": {
                    "input_tokens": 1,
                    "output_tokens": 2,
                    "cache_creation_input_tokens": 0,
                    "cache_read_input_tokens": 0,
                },
                "screenplay_sha256": self.pdf_sha256,
                "route": "sonnet",
                "generation": "candidate",
                "pipeline_stage": "reader",
                "pipeline_pass": "sonnet",
                "reader_name": "structure",
                "retry_number": 0,
                "boundary_run": 1,
                "prompt_bundle_sha256": contracts["prompt_bundle_sha256"],
                "schema_bundle_sha256": contracts["schema_bundle_sha256"],
                "request_sha256": "1" * 64,
                "prompt_sha256": "2" * 64,
                "schema_mode": "strict_tool",
                "schema_sha256": "3" * 64,
                "transport_schema_sha256": "4" * 64,
                "reservation_ceiling_microusd": 900,
                "reserved_microusd": 0,
                "charged_cost_microusd": 10,
                "estimated_cost_nanousd": 10_000,
                "rounding_variance_nanousd": 0,
                "rounding_reason": None,
            }],
        }
        with patch("execution.trust_manifest.validate_benchmark_trust_seal"):
            _validate_resume_manifest(
                completed_manifest,
                **{**common, "ledger": settled_ledger},
            )
        altered = copy.deepcopy(completed_manifest)
        altered["runs"][0]["analysis"]["verdict"] = "FILM_NOW"
        with self.assertRaisesRegex(BenchmarkSafetyError, "output lock"):
            _validate_resume_manifest(
                altered,
                **{**common, "ledger": settled_ledger},
            )
        extra = copy.deepcopy(settled_ledger)
        extra["calls"].append({
            "call_id": "e" * 64,
            "status": "in_progress",
        })
        with patch("execution.trust_manifest.validate_benchmark_trust_seal"):
            with self.assertRaisesRegex(BenchmarkSafetyError, "call ledgers differ"):
                _validate_resume_manifest(
                    completed_manifest,
                    **{**common, "ledger": extra},
                )

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
                self._input_record(),
                "https://candidate.example/llmProxyCandidate",
                None,
                Mock(),
                "run-1",
                {"prompt_bundle_sha256": "b" * 64, "schema_bundle_sha256": "c" * 64},
                lambda: "token",
                _release(),
                _local_source(),
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
                self._input_record(),
                "https://candidate.example/llmProxyCandidate",
                None,
                Mock(),
                "run-1",
                {"prompt_bundle_sha256": "b" * 64, "schema_bundle_sha256": "c" * 64},
                lambda: "token",
                _release(),
                _local_source(),
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
                self._input_record(),
                "https://candidate.example/llmProxyCandidate",
                None,
                Mock(),
                "run-1",
                {"prompt_bundle_sha256": "b" * 64, "schema_bundle_sha256": "c" * 64},
                lambda: "token",
                _release(),
                _local_source(),
            )

        self.assertEqual(raised.exception.usage["actual_cost_microusd"], 300)
        self.assertEqual(
            [call["response_id"] for call in raised.exception.usage["calls"]],
            ["msg_cold", "msg_full"],
        )

    def test_completed_paid_run_is_hash_locked_with_exact_source_and_route(self):
        from execution import ingest_v9

        usage = ingest_v9.empty_usage()
        usage.update({
            "call_count": 1,
            "actual_cost_microusd": 123,
            "actual_cost_usd": 0.000123,
            "calls": [{"response_id": "msg_locked"}],
        })
        analysis = {"verdict": "CONSIDER", "adjusted_score": 7.1}
        claim_usage = ingest_v9.empty_usage()
        claim_usage.update({
            "call_count": 1,
            "actual_cost_microusd": 10,
            "actual_cost_usd": 0.00001,
            "calls": [{"response_id": "msg_claim"}],
        })
        engine = SimpleNamespace(
            parse_pdf=Mock(return_value={
                "text": "[PAGE 1]\nINT. HOUSE - DAY",
                "page_count": 1,
                "word_count": 4,
                "metadata": {
                    "extraction_method": "pymupdf",
                    "page_evidence_sha256": "d" * 64,
                    "extraction_quality": {"publication_ready": True},
                    "native_cross_check": {"word_count_agreement_ratio": 0.98},
                },
            }),
            validate_parsed_source=Mock(),
            MODEL_IDS={"sonnet": "claude-sonnet-5"},
            call_llm=Mock(),
            configure_benchmark_online_transport=Mock(),
            clear_benchmark_online_transport=Mock(),
            run_nonbinding_cold_read=Mock(return_value=(
                {"evidence": {}, "response_ids": []},
                ingest_v9.empty_usage(),
            )),
            run_v9_stable=Mock(return_value=(analysis, usage)),
            run_claim_verification=Mock(return_value=(
                {"status": "passed_independent_model_review"},
                claim_usage,
            )),
            attach_verified_citation_quality=Mock(),
            merge_usage=ingest_v9.merge_usage,
            empty_usage=ingest_v9.empty_usage,
        )
        run = {
            "route": "sonnet",
            "model_id": "claude-sonnet-5",
            "sonnet_model_id": "claude-sonnet-5",
            "generation": "candidate",
        }

        with (
            patch(
                "execution.model_benchmark._verify_local_source",
                return_value=_local_source(),
            ),
            patch(
                "execution.trust_manifest.build_benchmark_trust_seal",
                return_value={"integrity_sha256": "e" * 64},
            ),
            patch("execution.trust_manifest.validate_benchmark_trust_seal"),
        ):
            _run_paid(
                engine,
                run,
                self._input_record(),
                "https://candidate.example/llmProxyCandidate",
                None,
                Mock(),
                "run-1",
                {"prompt_bundle_sha256": "b" * 64, "schema_bundle_sha256": "c" * 64},
                lambda: "token",
                _release(),
                _local_source(),
            )

        self.assertEqual(run["source_evidence"]["page_evidence_sha256"], "d" * 64)
        self.assertEqual(run["output_lock"]["source_sha256"], self.pdf_sha256)
        self.assertEqual(run["output_lock"]["model_configuration"]["generation"], "candidate")
        self.assertEqual(run["output_lock"]["verdict"], "CONSIDER")
        engine.run_claim_verification.assert_called_once()
        for field in ("analysis_sha256", "usage_sha256", "machine_output_sha256"):
            self.assertRegex(run["output_lock"][field], r"^[a-f0-9]{64}$")

    def test_independent_claim_verification_rejects_a_central_contradiction(self):
        from execution import ingest_v9

        targets = [{
            "claim_id": f"claim.{index}",
            "claim": "Mara marries Juan." if index == 0 else f"Claim {index} is supported.",
            "claim_type": "factual" if index == 0 else "evaluative",
            "verdict_driving": True,
            "story_fact_check_required": index == 0,
            "evidence_scope": "local" if index == 0 else "evaluative",
            "provided_page_citations": [],
            "provided_citation_evidence": [],
        } for index in range(10)]
        raw = {"claims": [{
            "claim_id": target["claim_id"],
            "classification": "Contradicted" if index == 0 else "Supported",
            "story_fact_classification": (
                "Contradicted"
                if index == 0
                else "No concrete story fact"
            ),
            "unsupported_story_facts": [],
            "page_citations": [1],
            "citation_evidence": [{
                "page": 1,
                "excerpt": (
                    "Mara never marries Juan in the final scene."
                    if index == 0 else "The physical page supports this claim."
                ),
            }],
        } for index, target in enumerate(targets)]}

        with self.assertRaisesRegex(ValueError, "factual screenplay claim"):
            ingest_v9._validate_claim_verification(raw, targets)

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
                with patch(
                    "execution.model_benchmark.ARTIFACTS_ROOT",
                    Path(directory),
                ), patch(
                    "execution.model_benchmark.ROOT",
                    Path(directory),
                ):
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

        candidate = _route_configs(catalog, "all", "candidate")
        self.assertEqual(len(candidate), 3)
        self.assertEqual({route["generation"] for route in candidate}, {"candidate"})

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
            "release": _release(),
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
                _release(),
            )
        sent = post.call_args.kwargs["json"]
        self.assertEqual(sent["benchmark"]["screenplay_sha256"], "a" * 64)
        self.assertNotIn("SECRET", str(sent))
        self.assertNotIn("screenplay", sent["messages"][0]["content"].lower())

    def test_paid_url_accepts_only_the_dedicated_candidate(self):
        with self.assertRaisesRegex(BenchmarkSafetyError, "cannot use a local"):
            _validate_candidate_proxy(
                "http://127.0.0.1:5001/project/us-central1/llmProxyCandidate"
            )
        self.assertTrue(_validate_candidate_proxy(
            "https://us-central1-project.cloudfunctions.net/llmProxyCandidate"
        ))
        with self.assertRaisesRegex(BenchmarkSafetyError, "dedicated"):
            _validate_candidate_proxy(
                "https://us-central1-project.cloudfunctions.net/llmProxy"
            )

    def test_deployment_receipt_binds_the_full_production_storage_acl_proof(self):
        receipt, catalog = _deployment_receipt_fixture()
        path = Path(self.temp_dir.name) / "deployment-receipt.json"
        path.write_text(json.dumps(receipt), encoding="utf-8")
        with patch(
            "execution.model_benchmark.ARTIFACTS_ROOT",
            Path(self.temp_dir.name),
        ), patch(
            "execution.model_benchmark.ROOT",
            Path(self.temp_dir.name),
        ):
            loaded = _load_deployment_receipt(
                str(path),
                receipt["receipt_sha256"],
                proxy_url=receipt["function_uri"],
                expected_git_sha=receipt["git_sha"],
                expected_catalog_sha256=receipt["catalog_sha256"],
                run_id=receipt["run_id"],
                cap_microusd=receipt["cap_microusd"],
                prior_audit_spend_microusd=receipt[
                    "prior_audit_spend_microusd"
                ],
                catalog=catalog,
            )
        self.assertEqual(
            loaded["production_storage_acl_proof"]["object_version_count"],
            115,
        )

        tampered = copy.deepcopy(receipt)
        tampered["production_storage_acl_proof"]["object_version_count"] = 116
        tampered["receipt_sha256"] = _sha256_json({
            key: value
            for key, value in tampered.items()
            if key != "receipt_sha256"
        })
        path.write_text(json.dumps(tampered), encoding="utf-8")
        with patch(
            "execution.model_benchmark.ARTIFACTS_ROOT",
            Path(self.temp_dir.name),
        ), patch(
            "execution.model_benchmark.ROOT",
            Path(self.temp_dir.name),
        ):
            with self.assertRaisesRegex(
                BenchmarkSafetyError,
                "Production Storage ACL proof",
            ):
                _load_deployment_receipt(
                    str(path),
                    tampered["receipt_sha256"],
                    proxy_url=tampered["function_uri"],
                    expected_git_sha=tampered["git_sha"],
                    expected_catalog_sha256=tampered["catalog_sha256"],
                    run_id=tampered["run_id"],
                    cap_microusd=tampered["cap_microusd"],
                    prior_audit_spend_microusd=tampered[
                        "prior_audit_spend_microusd"
                    ],
                    catalog=catalog,
                )

    def test_live_isolation_rejects_service_account_inventory_drift(self):
        receipt, _ = _deployment_receipt_fixture()
        approved = receipt["production_isolation_proof"]
        result = _validate_live_isolation_proof(
            approved,
            receipt,
            approved["verified_at"],
        )
        self.assertEqual(result["production_service_account_count"], 2)

        drifted = copy.deepcopy(approved)
        drifted["production_service_accounts"][0]["binding_count"] = 1
        drifted["production_service_account_inventory_sha256"] = _sha256_json(
            drifted["production_service_accounts"]
        )
        drifted["proof_sha256"] = _sha256_json({
            key: value for key, value in drifted.items() if key != "proof_sha256"
        })
        with self.assertRaisesRegex(BenchmarkSafetyError, "approved contract"):
            _validate_live_isolation_proof(
                drifted,
                receipt,
                drifted["verified_at"],
            )

    def test_live_safety_uses_workflow_receipt_without_local_production_scanner(self):
        receipt, _ = _deployment_receipt_fixture()
        with patch(
            "execution.model_benchmark._validate_deployment_receipt_freshness",
            return_value={"maximum_age_seconds": 21_600},
        ) as freshness, patch(
            "execution.model_benchmark._verify_live_private_endpoint",
            return_value={"anonymous_http_status": 403},
        ), patch(
            "execution.model_benchmark.subprocess.run",
        ) as run:
            result = _verify_live_candidate_safety(
                receipt["function_uri"],
                receipt,
            )

        run.assert_not_called()
        freshness.assert_called_once_with(receipt)
        self.assertEqual(
            result["proof_source"],
            "github_workflow_deployment_receipt",
        )
        self.assertEqual(
            result["deployment_receipt_sha256"],
            receipt["receipt_sha256"],
        )
        self.assertEqual(result["anonymous_http_status"], 403)
        self.assertEqual(
            result["production_isolation"]["proof_sha256"],
            receipt["production_isolation_proof"]["proof_sha256"],
        )

    def test_deployment_receipt_proofs_must_be_recent(self):
        receipt, _ = _deployment_receipt_fixture()
        fresh = _validate_deployment_receipt_freshness(
            receipt,
            datetime(2026, 8, 28, 12, 30, tzinfo=timezone.utc),
        )
        self.assertLess(max(fresh["proof_ages_seconds"].values()), 3600)
        with self.assertRaisesRegex(BenchmarkSafetyError, "stale"):
            _validate_deployment_receipt_freshness(
                receipt,
                datetime(2026, 8, 28, 18, 1, 1, tzinfo=timezone.utc),
            )
        future = copy.deepcopy(receipt)
        future["staging_identity_proof"]["verified_at"] = (
            datetime(2026, 8, 28, 12, 30, tzinfo=timezone.utc)
            + timedelta(minutes=6)
        ).isoformat()
        with self.assertRaisesRegex(BenchmarkSafetyError, "future-dated"):
            _validate_deployment_receipt_freshness(
                future,
                datetime(2026, 8, 28, 12, 30, tzinfo=timezone.utc),
            )

    def test_every_paid_dispatch_rechecks_receipt_freshness(self):
        receipt, _ = _deployment_receipt_fixture()
        with patch(
            "execution.model_benchmark._validate_deployment_receipt_freshness",
            side_effect=BenchmarkSafetyError(
                "Deployment receipt proofs are stale or future-dated."
            ),
        ) as freshness, patch(
            "execution.model_benchmark._resolve_candidate_deployment",
        ) as resolve, patch(
            "execution.model_benchmark._verify_live_private_endpoint",
        ) as private:
            with self.assertRaisesRegex(BenchmarkSafetyError, "stale"):
                _paid_dispatch_platform_recheck(
                    receipt["function_uri"],
                    receipt["git_sha"],
                    receipt["catalog_sha256"],
                    receipt,
                )
        freshness.assert_called_once_with(receipt)
        resolve.assert_not_called()
        private.assert_not_called()

    def test_staging_identity_rejects_protected_ref_drift(self):
        receipt, _ = _deployment_receipt_fixture()
        proof = copy.deepcopy(receipt["staging_identity_proof"])
        proof["github_ref"] = "refs/heads/unreviewed"
        contract_keys = (
            "project_id",
            "project_number",
            "runtime_service_account",
            "caller_service_account",
            "deployer_service_account",
            "reviewed_effective_invokers",
            "staging_storage_buckets",
            "workload_identity_provider",
            "workload_identity_subject",
            "github_repository",
            "github_ref",
            "github_environment",
            "github_ref_protected_required",
        )
        proof["identity_contract_sha256"] = _sha256_json({
            key: proof[key] for key in contract_keys
        })
        proof["proof_sha256"] = _sha256_json({
            key: value for key, value in proof.items() if key != "proof_sha256"
        })
        with self.assertRaisesRegex(BenchmarkSafetyError, "identity proof"):
            _validate_staging_identity_proof(proof, "549848020392")

    def test_candidate_iam_requires_only_the_dedicated_caller(self):
        caller = (
            "serviceAccount:benchmark-caller@lemon-screenplay-staging."
            "iam.gserviceaccount.com"
        )
        _assert_private_candidate_iam_policy({
            "bindings": [{"role": "roles/run.invoker", "members": [caller]}]
        })
        for policy in (
            {"bindings": []},
            {"bindings": [{"role": "roles/run.invoker", "members": ["allUsers"]}]},
            {"bindings": [{
                "role": "roles/run.invoker",
                "members": [caller],
                "condition": {"expression": "request.time < timestamp('2099-01-01T00:00:00Z')"},
            }]},
        ):
            with self.assertRaisesRegex(BenchmarkSafetyError, "exact benchmark caller"):
                _assert_private_candidate_iam_policy(policy)

    def test_paid_endpoint_is_bound_to_the_platform_function_and_revision(self):
        proxy_url = (
            "https://us-central1-lemon-screenplay-staging.cloudfunctions.net/"
            "llmProxyCandidate"
        )
        git_sha = "a" * 40
        catalog_sha = _catalog_sha256()
        function = {
            "name": (
                "projects/lemon-screenplay-staging/locations/us-central1/functions/"
                "llmProxyCandidate"
            ),
            "state": "ACTIVE",
            "buildConfig": {
                "runtime": "nodejs22",
                "entryPoint": "llmProxyCandidate",
                "build": "projects/1/locations/us-central1/builds/build-1",
                "dockerRepository": (
                    "projects/lemon-screenplay-staging/locations/us-central1/"
                    "repositories/gcf-artifacts"
                ),
                "automaticUpdatePolicy": {},
            },
            "serviceConfig": {
                "uri": proxy_url,
                "service": (
                    "projects/lemon-screenplay-staging/locations/us-central1/services/"
                    "llmproxycandidate"
                ),
                "serviceAccountEmail": (
                    "benchmark-runtime@lemon-screenplay-staging.iam.gserviceaccount.com"
                ),
                "availableMemory": "512M",
                "availableCpu": "0.3333",
                "timeoutSeconds": 3600,
                "maxInstanceCount": 5,
                "maxInstanceRequestConcurrency": 1,
                "allTrafficOnLatestRevision": True,
                "ingressSettings": "ALLOW_ALL",
                "revision": "llmproxycandidate-00005-abc",
                "environmentVariables": {
                    "BENCHMARK_GIT_SHA": git_sha,
                    "BENCHMARK_SOURCE_CLEAN": "true",
                    "BENCHMARK_CATALOG_SHA256": catalog_sha,
                    "BENCHMARK_STAGING_FIRESTORE_PROJECT_ID": (
                        "lemon-screenplay-staging"
                    ),
                    "BENCHMARK_PRODUCTION_FIRESTORE_PROJECT_ID": (
                        "lemon-screenplay-dashboard"
                    ),
                    "BENCHMARK_STORAGE_BUCKET": (
                        "lemon-screenplay-dashboard.firebasestorage.app"
                    ),
                    "BENCHMARK_INFERENCE_GEO": "global",
                },
            },
        }
        revision = {
            "metadata": {"name": "llmproxycandidate-00005-abc"},
            "spec": {
                "serviceAccountName": (
                    "benchmark-runtime@lemon-screenplay-staging.iam.gserviceaccount.com"
                ),
                "containerConcurrency": 1,
                "containers": [{
                    "image": (
                        "us-central1-docker.pkg.dev/lemon-screenplay-staging/"
                        "gcf-artifacts/candidate@sha256:" + "f" * 64
                    ),
                }],
            },
            "status": {"imageDigest": "sha256:" + "f" * 64},
        }
        responses = [
            Mock(returncode=0, stdout=json.dumps(function)),
            Mock(returncode=0, stdout=json.dumps(revision)),
        ]
        with patch(
            "execution.model_benchmark.subprocess.run",
            side_effect=responses,
        ):
            receipt = _resolve_candidate_deployment(proxy_url, git_sha, catalog_sha)

        self.assertEqual(receipt["function_uri"], proxy_url)
        self.assertEqual(receipt["cloud_run_revision"], "llmproxycandidate-00005-abc")
        self.assertEqual(receipt["container_image_digest"], "sha256:" + "f" * 64)
        self.assertRegex(receipt["receipt_sha256"], r"^[a-f0-9]{64}$")

        wrong_function = copy.deepcopy(function)
        wrong_function["serviceConfig"]["uri"] = "https://spoof.run.app"
        with patch(
            "execution.model_benchmark.subprocess.run",
            return_value=Mock(returncode=0, stdout=json.dumps(wrong_function)),
        ):
            with self.assertRaisesRegex(BenchmarkSafetyError, "proxy-url"):
                _resolve_candidate_deployment(proxy_url, git_sha, catalog_sha)

    def test_identity_token_provider_requires_the_dedicated_staging_caller(self):
        from execution.model_benchmark import IdentityTokenProvider

        with self.assertRaisesRegex(BenchmarkSafetyError, "dedicated staging"):
            IdentityTokenProvider(
                "https://candidate.test",
                "broad-production@lemon-screenplay-dashboard.iam.gserviceaccount.com",
            )

    def test_paid_smoke_is_refused_before_artifact_or_network_work(self):
        with self.assertRaisesRegex(BenchmarkSafetyError, "Paid smoke mode"):
            build_manifest(SimpleNamespace(execute=True, smoke=True))

    def test_candidate_preflight_requires_distinct_production_isolation_targets(self):
        response = Mock(status_code=200)
        response.json.return_value = {
            "service": "llmProxyCandidate",
            "run_id": "staging-smoke",
            "cap_usd": 1,
            "cap_microusd": 1_000_000,
            "prior_audit_spend_microusd": 106_425,
            "audit_id": "v9-trust-remediation-20260827",
            "audit_limit_microusd": 40_000_000,
            "database_id": "model-benchmarks",
            "runtime_project_id": "lemon-screenplay-staging",
            "inference_geo": "global",
            "service_tier": "standard_only",
            "allowed_models": [
                "claude-haiku-4-5-20251001",
                "claude-sonnet-4-6",
                "claude-sonnet-5",
                "claude-opus-4-7",
                "claude-opus-5",
            ],
            "release": {
                "source_clean": True,
                "deployment_config_sha256": "c" * 64,
                "cloud_run_revision": "llmproxycandidate-00001-abc",
                "git_sha": "a" * 40,
                "catalog_sha256": _catalog_sha256(),
                "pricing_sha256": _runtime_pricing_sha256(),
                "build_timestamp": "2026-08-27T12:00:00Z",
                "inference_geo": "global",
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
                _catalog_sha256(),
            )
        self.assertEqual(
            result["isolation"]["targets"]["production_default_database"],
            "projects/lemon-screenplay-dashboard/databases/(default)",
        )

        original_revision = response.json.return_value["release"][
            "cloud_run_revision"
        ]
        for invalid_revision in (
            "local-emulator",
            "llmproxycandidate-0001-abc",
            "unrelated-service-00001-abc",
        ):
            response.json.return_value["release"][
                "cloud_run_revision"
            ] = invalid_revision
            with self.subTest(cloud_run_revision=invalid_revision):
                with patch(
                    "execution.model_benchmark.requests.get",
                    return_value=response,
                ):
                    with self.assertRaisesRegex(
                        BenchmarkSafetyError,
                        "Cloud Run revision",
                    ):
                        _candidate_preflight(
                            "https://example.run.app/llmProxyCandidate",
                            lambda: "short-lived",
                            "staging-smoke",
                            1,
                            True,
                            "a" * 40,
                            _catalog_sha256(),
                        )
        response.json.return_value["release"][
            "cloud_run_revision"
        ] = original_revision

        for field, bad_value in (
            ("audit_id", None),
            ("audit_id", "different-audit"),
            ("audit_limit_microusd", None),
            ("audit_limit_microusd", 39_999_999),
        ):
            original = response.json.return_value.get(field)
            response.json.return_value[field] = bad_value
            with self.subTest(field=field, bad_value=bad_value):
                with patch(
                    "execution.model_benchmark.requests.get",
                    return_value=response,
                ):
                    with self.assertRaisesRegex(
                        BenchmarkSafetyError,
                        "cumulative audit ledger",
                    ):
                        _candidate_preflight(
                            "https://example.run.app/llmProxyCandidate",
                            lambda: "short-lived",
                            "staging-smoke",
                            1,
                            True,
                            "a" * 40,
                            _catalog_sha256(),
                        )
            response.json.return_value[field] = original

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
                    _catalog_sha256(),
                )

        response.json.return_value["isolation"]["targets"][
            "production_default_database"
        ] = "projects/lemon-screenplay-dashboard/databases/(default)"
        response.json.return_value["isolation"]["targets"][
            "staging_default_database"
        ] = "projects/unapproved-staging/databases/(default)"
        with patch("execution.model_benchmark.requests.get", return_value=response):
            with self.assertRaisesRegex(BenchmarkSafetyError, "confused staging"):
                _candidate_preflight(
                    "https://example.run.app/llmProxyCandidate",
                    lambda: "short-lived",
                    "staging-smoke",
                    1,
                    True,
                    "a" * 40,
                    _catalog_sha256(),
                )

        response.json.return_value["runtime_project_id"] = "lemon-screenplay-dashboard"
        response.json.return_value["isolation"]["targets"][
            "staging_default_database"
        ] = "projects/lemon-screenplay-staging/databases/(default)"
        with patch("execution.model_benchmark.requests.get", return_value=response):
            with self.assertRaisesRegex(BenchmarkSafetyError, "approved staging"):
                _candidate_preflight(
                    "https://example.run.app/llmProxyCandidate",
                    lambda: "short-lived",
                    "staging-smoke",
                    1,
                    True,
                    "a" * 40,
                    _catalog_sha256(),
                )

    def test_online_transport_uses_stable_call_ids_and_one_http_attempt(self):
        from execution import ingest_v9

        context = {
            "run_id": "staging-smoke",
            "screenplay_sha256": "a" * 64,
            "route": "sonnet",
            "generation": "candidate",
            "prompt_bundle_sha256": "b" * 64,
            "schema_bundle_sha256": "c" * 64,
        }
        response = Mock(status_code=200)
        response.json.return_value = {
            "text": "ok",
            "tool_uses": [],
            "content": [{"type": "text", "text": "ok"}],
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
                "charged_cost_microusd": 12,
                "estimated_cost_nanousd": 12_000,
                "estimated_cost_usd": 0.000012,
                "rounding_variance_nanousd": 0,
                "rounding_variance_usd": 0.0,
                "rounding_reason": None,
                "inference_geo": "global",
                "service_tier": "standard",
            },
            "release": _release(),
        }
        original = ingest_v9.MODEL_IDS["sonnet"]
        ingest_v9.MODEL_IDS["sonnet"] = "claude-sonnet-5"
        ingest_v9.configure_benchmark_online_transport(
            context,
            lambda: "short-lived",
            _release(),
        )
        try:
            with patch.object(ingest_v9.requests, "post", return_value=response) as post:
                first = ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "user"}],
                    model_key="sonnet",
                    retries=3,
                    stage="reader",
                    pipeline_pass="sonnet",
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
                    pipeline_pass="sonnet",
                    reader_name="structure",
                    boundary_run=1,
                    logical_retry=1,
                )
                second_id = post.call_args.kwargs["json"]["benchmark"]["call_id"]
                ingest_v9.call_llm(
                    system_blocks=[{"type": "text", "text": "system"}],
                    user_blocks=[{"type": "text", "text": "user"}],
                    model_key="sonnet",
                    retries=3,
                    stage="reader",
                    pipeline_pass="opus",
                    reader_name="structure",
                    boundary_run=1,
                    logical_retry=0,
                )
                opus_pass_id = post.call_args.kwargs["json"]["benchmark"]["call_id"]
            self.assertNotEqual(first_id, second_id)
            self.assertNotEqual(first_id, opus_pass_id)
            self.assertEqual(first[2]["calls"][0]["call_id"], first_id)
            self.assertEqual(post.call_count, 3)
        finally:
            ingest_v9.clear_benchmark_online_transport()
            ingest_v9.MODEL_IDS["sonnet"] = original
