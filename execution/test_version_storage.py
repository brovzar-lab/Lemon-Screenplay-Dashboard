import unittest
from datetime import datetime, timezone

from execution.content_identity import build_version_id
from execution.ingest_v9 import (
    PERMANENT_DOCUMENT_GUARD_BYTES,
    _analysis_run_evidence,
    assert_permanent_document_size,
    build_version_document,
    encoded_firestore_document_size,
    write_analysis_transaction,
)
from execution.v9_test_fixtures import (
    CONTENT_HASH,
    MODEL_IDS,
    PROJECT_ID,
    QUEUED_AT_MS,
    VERSION_ID,
    raw_analysis as untrusted_raw_analysis,
    prepare_q2_analysis,
    trusted_raw,
)
from execution.trust_manifest import attach_trust_manifest
from execution.trust_manifest import validate_permanent_analysis


class FakeSnapshot:
    def __init__(self, data=None):
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return self._data


class FakeReference:
    def __init__(self, name, data=None):
        self.name = name
        self.snapshot = FakeSnapshot(data)
        self.read_transactions = []

    def get(self, transaction=None):
        self.read_transactions.append(transaction)
        return self.snapshot


class FakeTransaction:
    def __init__(self):
        self.operations = []

    def create(self, reference, data):
        self.operations.append(("create", reference, data))

    def set(self, reference, data):
        self.operations.append(("set", reference, data))


def raw_analysis():
    return trusted_raw()


class TestImmutableVersionStorage(unittest.TestCase):
    def test_version_id_is_stable_for_daemon_retries(self):
        first_attempt = build_version_id(CONTENT_HASH, QUEUED_AT_MS)
        queue_timestamp = datetime.fromtimestamp(QUEUED_AT_MS / 1000, tz=timezone.utc)
        retry = build_version_id(CONTENT_HASH, queue_timestamp)

        self.assertEqual(first_attempt, VERSION_ID)
        self.assertEqual(retry, first_attempt)

    def test_version_document_uses_firestore_native_types(self):
        document = build_version_document(
            raw_analysis(),
            project_id=PROJECT_ID,
            version_id=VERSION_ID,
            version_number=1,
            queued_at_ms=QUEUED_AT_MS,
        )

        self.assertIs(type(document["version_number"]), int)
        self.assertIsInstance(document["created_at"], datetime)
        self.assertEqual(document["created_at"].tzinfo, timezone.utc)
        self.assertEqual(int(document["created_at"].timestamp() * 1000), QUEUED_AT_MS)
        self.assertLess(
            encoded_firestore_document_size(document),
            PERMANENT_DOCUMENT_GUARD_BYTES,
        )

    def test_oversized_trusted_hybrid_is_rejected_before_firestore_write(self):
        raw = untrusted_raw_analysis()
        raw["analysis"]["executive_summary"] = "X" * 910_000
        raw["analysis"]["_hybrid_mode"] = {
            "promoted_to_opus": False,
            "sonnet_verdict": "CONSIDER",
            "final_model": "sonnet",
            "sonnet_analysis_evidence": _analysis_run_evidence(
                raw["analysis"],
                include_boundary=True,
            ),
        }
        prepare_q2_analysis(
            raw["analysis"],
            raw["metadata"],
            "sonnet",
        )
        trusted = attach_trust_manifest(
            raw,
            selection_request="hybrid",
            pipeline_model_tier="hybrid",
            effective_model_tier="sonnet",
            model_ids=MODEL_IDS,
            origin_kind="daemon_queue",
            origin_id="oversized-hybrid",
        )
        document = build_version_document(
            trusted,
            project_id=PROJECT_ID,
            version_id=VERSION_ID,
            version_number=1,
            queued_at_ms=QUEUED_AT_MS,
        )

        self.assertGreater(
            encoded_firestore_document_size(document),
            PERMANENT_DOCUMENT_GUARD_BYTES,
        )
        with self.assertRaisesRegex(ValueError, "permanent-write guard"):
            assert_permanent_document_size(
                document,
                "Immutable version document",
            )

    def test_parent_and_version_are_written_on_one_transaction(self):
        transaction = FakeTransaction()
        parent_ref = FakeReference("parent")
        version_ref = FakeReference("version")

        version_number = write_analysis_transaction(
            transaction,
            parent_ref,
            version_ref,
            raw_analysis(),
            project_id=PROJECT_ID,
            version_id=VERSION_ID,
            queued_at_ms=QUEUED_AT_MS,
        )

        self.assertEqual(version_number, 1)
        self.assertEqual([operation[0] for operation in transaction.operations], ["create", "set"])
        self.assertIs(transaction.operations[0][1], version_ref)
        self.assertIs(transaction.operations[1][1], parent_ref)
        self.assertTrue(all(tx is transaction for tx in parent_ref.read_transactions))
        self.assertTrue(all(tx is transaction for tx in version_ref.read_transactions))
        self.assertEqual(transaction.operations[0][2]["version_id"], VERSION_ID)
        self.assertEqual(transaction.operations[1][2]["latest_version_id"], VERSION_ID)

    def test_renamed_revision_produces_two_self_validating_documents(self):
        transaction = FakeTransaction()
        parent_ref = FakeReference(
            "parent",
            {
                "source_file": "Original Project Name.pdf",
                "version_count": 2,
            },
        )
        version_ref = FakeReference("version")
        raw = raw_analysis()

        write_analysis_transaction(
            transaction,
            parent_ref,
            version_ref,
            raw,
            project_id=PROJECT_ID,
            version_id=VERSION_ID,
            queued_at_ms=QUEUED_AT_MS,
        )

        version_document = transaction.operations[0][2]
        parent_document = transaction.operations[1][2]
        self.assertEqual(
            parent_document["source_file"],
            "Original Project Name.pdf",
        )
        self.assertEqual(
            parent_document["latest_source_file"],
            raw["source_file"],
        )
        validate_permanent_analysis(version_document)
        validate_permanent_analysis(parent_document)

    def test_retrying_an_existing_version_does_not_advance_the_parent(self):
        transaction = FakeTransaction()
        parent_ref = FakeReference("parent", {"version_count": 1})
        existing_version = raw_analysis()
        existing_version["version_number"] = 1
        version_ref = FakeReference(
            "version",
            existing_version,
        )

        version_number = write_analysis_transaction(
            transaction,
            parent_ref,
            version_ref,
            raw_analysis(),
            project_id=PROJECT_ID,
            version_id=VERSION_ID,
            queued_at_ms=QUEUED_AT_MS,
        )

        self.assertEqual(version_number, 1)
        self.assertEqual(transaction.operations, [])


if __name__ == "__main__":
    unittest.main()
