import unittest
from datetime import datetime, timezone

from execution.content_identity import build_version_id
from execution.ingest_v9 import (
    build_version_document,
    write_analysis_transaction,
)


CONTENT_HASH = "cd" * 32
QUEUED_AT_MS = 1_784_588_800_123
VERSION_ID = f"{CONTENT_HASH}_{QUEUED_AT_MS}"


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
    return {
        "source_file": "Revision.pdf",
        "analysis_version": "v9_archaeology",
        "analysis": {"title": "Revision"},
        "content_hash": CONTENT_HASH,
        "identity_status": "verified",
        "queued_at_ms": QUEUED_AT_MS,
    }


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
            project_id="Revision.pdf",
            version_id=VERSION_ID,
            version_number=1,
            queued_at_ms=QUEUED_AT_MS,
        )

        self.assertIs(type(document["version_number"]), int)
        self.assertIsInstance(document["created_at"], datetime)
        self.assertEqual(document["created_at"].tzinfo, timezone.utc)
        self.assertEqual(int(document["created_at"].timestamp() * 1000), QUEUED_AT_MS)

    def test_parent_and_version_are_written_on_one_transaction(self):
        transaction = FakeTransaction()
        parent_ref = FakeReference("parent")
        version_ref = FakeReference("version")

        version_number = write_analysis_transaction(
            transaction,
            parent_ref,
            version_ref,
            raw_analysis(),
            project_id="Revision.pdf",
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

    def test_retrying_an_existing_version_does_not_advance_the_parent(self):
        transaction = FakeTransaction()
        parent_ref = FakeReference("parent", {"version_count": 1})
        version_ref = FakeReference(
            "version",
            {"version_id": VERSION_ID, "version_number": 1},
        )

        version_number = write_analysis_transaction(
            transaction,
            parent_ref,
            version_ref,
            raw_analysis(),
            project_id="Revision.pdf",
            version_id=VERSION_ID,
            queued_at_ms=QUEUED_AT_MS,
        )

        self.assertEqual(version_number, 1)
        self.assertEqual(transaction.operations, [])


if __name__ == "__main__":
    unittest.main()
