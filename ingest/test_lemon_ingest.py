import hashlib
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import lemon_ingest
from lemon_ingest import (
    BatchError,
    MAX_FILE_SIZE_BYTES,
    archive_manifest,
    batch_cost_range,
    batch_counts,
    discover_pdfs,
    folder_lock,
    normalized_title,
    pdf_file_error,
    prepare_batch,
    save_manifest,
    upload_batch,
    validate_manifest,
)


def write_pdf(path: Path, body: bytes = b"screenplay") -> None:
    path.write_bytes(b"%PDF-1.7\n" + body)


class FakeBlob:
    def __init__(self):
        self.present = False
        self.metadata = None
        self.upload_count = 0
        self.generation = "1"

    def exists(self):
        return self.present

    def reload(self):
        return None

    def upload_from_filename(self, _path, **_kwargs):
        self.present = True
        self.upload_count += 1


class FakeBucket:
    name = "test-bucket"

    def __init__(self):
        self.blobs = {}

    def blob(self, name):
        return self.blobs.setdefault(name, FakeBlob())


class FakeDocument:
    def __init__(self, document_id, data):
        self.id = document_id
        self._data = data

    def to_dict(self):
        return self._data


class FakeCollection:
    def __init__(self, name, db):
        self.name = name
        self.db = db
        self.paths = []

    def select(self, _fields):
        return self

    def stream(self, **_kwargs):
        return iter(self.db.archive_documents)

    def where(self, _field, _operator, values):
        self.paths = list(values)
        return self

    def get(self, **_kwargs):
        if self.name != "ingest-queue" or not self.db.confirmed:
            return []
        generation = (
            self.db.storage_generations.pop(0)
            if self.db.storage_generations
            else self.db.storage_generation
        )
        return [
            FakeDocument(
                f"queue-{index}",
                {
                    "storage_path": path,
                    "storage_generation": generation,
                },
            )
            for index, path in enumerate(self.paths)
        ]


class FakeDb:
    project = "lemon-screenplay-dashboard"

    def __init__(
        self,
        confirmed=True,
        archive_documents=None,
        storage_generation="1",
        storage_generations=None,
    ):
        self.confirmed = confirmed
        self.archive_documents = archive_documents or []
        self.storage_generation = storage_generation
        self.storage_generations = list(storage_generations or [])

    def collection(self, name):
        return FakeCollection(name, self)


class FolderBatchTests(unittest.TestCase):
    def test_explicit_coverage_route_is_bound_and_old_batches_remain_v9(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            write_pdf(folder / 'Pilot.pdf')
            manifest, path = prepare_batch(folder, 'LEMON', 'sonnet', engine='coverage_v1')
            bucket = FakeBucket()
            upload_batch(manifest, path, bucket=bucket, db=FakeDb(), sleep=lambda _: None)
            self.assertEqual(next(iter(bucket.blobs.values())).metadata['engine'], 'coverage_v1')
            with self.assertRaises(BatchError):
                prepare_batch(folder, 'LEMON', 'sonnet', engine='v9')
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            write_pdf(folder / 'Legacy.pdf')
            manifest, path = prepare_batch(folder, 'LEMON', 'sonnet')
            manifest.pop('engine', None)
            save_manifest(path, manifest)
            restored, _ = prepare_batch(folder, 'LEMON', 'sonnet')
            self.assertEqual(restored.get('engine', 'v9'), 'v9')

    def test_recursive_plan_blocks_local_duplicates_and_title_collisions(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            (folder / "nested").mkdir()
            write_pdf(folder / "Alpha.pdf", b"alpha")
            write_pdf(folder / "nested" / "Copy.PDF", b"alpha")
            write_pdf(folder / "nested" / "Alpha.pdf", b"different")

            self.assertEqual(len(discover_pdfs(folder)), 3)
            manifest, _ = prepare_batch(folder, "LEMON", "hybrid")
            counts = batch_counts(manifest)
            self.assertEqual(counts["ready"], 1)
            self.assertEqual(counts["skipped_duplicate"], 1)
            self.assertEqual(counts["blocked_title"], 1)

    def test_remote_hash_and_full_slate_title_matches_are_blocked(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            write_pdf(folder / "Old Copy.pdf", b"same")
            write_pdf(folder / "Matadero.pdf", b"new")
            same_hash = hashlib.sha256((folder / "Old Copy.pdf").read_bytes()).hexdigest()
            db = FakeDb(
                archive_documents=[
                    FakeDocument("old", {"content_hash": same_hash, "analysis": {"title": "Archive Copy"}}),
                    FakeDocument("older-name.pdf", {"analysis": {"title": "Matadero"}}),
                ]
            )

            manifest, _ = prepare_batch(folder, "LEMON", "hybrid", db=db)
            counts = batch_counts(manifest)
            self.assertEqual(counts["skipped_existing"], 1)
            self.assertEqual(counts["blocked_title"], 1)

    def test_pdf_boundary_header_and_uppercase_extension(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            uppercase = folder / "Valid.PDF"
            write_pdf(uppercase)
            corrupt = folder / "Corrupt.pdf"
            corrupt.write_bytes(b"not a pdf")
            boundary = folder / "Boundary.pdf"
            with boundary.open("wb") as output:
                output.write(b"%PDF-1.7\n")
                output.seek(MAX_FILE_SIZE_BYTES - 1)
                output.write(b"x")

            self.assertIn(uppercase, discover_pdfs(folder))
            self.assertIsNone(pdf_file_error(uppercase))
            self.assertIn("valid PDF header", pdf_file_error(corrupt))
            self.assertIn("50 MB", pdf_file_error(boundary))

    def test_changed_file_is_blocked_before_upload(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            source = folder / "Alpha.pdf"
            write_pdf(source, b"first")
            manifest, path = prepare_batch(folder, "LEMON", "hybrid")
            write_pdf(source, b"changed")
            bucket = FakeBucket()

            upload_batch(manifest, path, bucket=bucket, db=FakeDb())
            self.assertEqual(manifest["files"][0]["status"], "blocked_changed")
            self.assertEqual(next(iter(bucket.blobs.values())).upload_count, 0)

    def test_resume_reuses_verified_object_and_does_not_upload_twice(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            write_pdf(folder / "Alpha.pdf", b"alpha")
            manifest, path = prepare_batch(folder, "LEMON", "hybrid")
            bucket = FakeBucket()

            upload_batch(manifest, path, bucket=bucket, db=FakeDb())
            blob = next(iter(bucket.blobs.values()))
            self.assertEqual(blob.upload_count, 1)

            manifest["files"][0]["status"] = "uploading"
            save_manifest(path, manifest)
            upload_batch(manifest, path, bucket=bucket, db=FakeDb())
            self.assertEqual(blob.upload_count, 1)
            self.assertEqual(manifest["files"][0]["status"], "queued")

    def test_existing_object_with_wrong_identity_is_blocked(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            write_pdf(folder / "Alpha.pdf")
            manifest, path = prepare_batch(folder, "LEMON", "hybrid")
            bucket = FakeBucket()
            blob = bucket.blob(manifest["files"][0]["object_name"])
            blob.present = True
            blob.metadata = {"uploadId": "somebody-else"}

            upload_batch(manifest, path, bucket=bucket, db=FakeDb())
            self.assertEqual(manifest["files"][0]["status"], "blocked_object_conflict")

    def test_unconfirmed_queue_rechecks_without_uploading_twice(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            write_pdf(folder / "Alpha.pdf", b"alpha")
            manifest, path = prepare_batch(folder, "LEMON", "hybrid")
            bucket = FakeBucket()

            upload_batch(manifest, path, bucket=bucket, db=FakeDb(False), queue_timeout_seconds=0)
            blob = next(iter(bucket.blobs.values()))
            self.assertEqual(blob.upload_count, 1)
            self.assertEqual(manifest["files"][0]["status"], "queue_unconfirmed")

            upload_batch(manifest, path, bucket=bucket, db=FakeDb())
            self.assertEqual(blob.upload_count, 1)
            self.assertEqual(manifest["files"][0]["status"], "queued")

    def test_missing_unconfirmed_object_is_never_reuploaded(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            write_pdf(folder / "Alpha.pdf", b"alpha")
            manifest, path = prepare_batch(folder, "LEMON", "hybrid")
            original_bucket = FakeBucket()
            upload_batch(
                manifest,
                path,
                bucket=original_bucket,
                db=FakeDb(False),
                queue_timeout_seconds=0,
            )
            self.assertEqual(manifest["files"][0]["status"], "queue_unconfirmed")

            missing_object_bucket = FakeBucket()
            upload_batch(manifest, path, bucket=missing_object_bucket, db=FakeDb())

            replacement = next(iter(missing_object_bucket.blobs.values()))
            self.assertEqual(replacement.upload_count, 0)
            self.assertEqual(manifest["files"][0]["status"], "queue_unconfirmed")

            restarted, _ = prepare_batch(folder, "LEMON", "hybrid")
            upload_batch(restarted, path, bucket=missing_object_bucket, db=FakeDb())
            self.assertEqual(replacement.upload_count, 0)
            self.assertEqual(restarted["files"][0]["status"], "queue_unconfirmed")

    def test_changed_or_missing_unconfirmed_source_keeps_uploaded_identity(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            source = folder / "Alpha.pdf"
            write_pdf(source, b"old")
            manifest, path = prepare_batch(folder, "LEMON", "hybrid")
            old_upload_id = manifest["files"][0]["upload_id"]
            manifest["files"][0]["status"] = "queue_unconfirmed"
            save_manifest(path, manifest)

            write_pdf(source, b"new")
            changed, _ = prepare_batch(folder, "LEMON", "hybrid")
            self.assertEqual(changed["files"][0]["status"], "queue_unconfirmed")
            self.assertEqual(changed["files"][0]["upload_id"], old_upload_id)
            self.assertTrue(changed["files"][0]["source_changed"])

            source.unlink()
            missing, _ = prepare_batch(folder, "LEMON", "hybrid")
            self.assertEqual(missing["files"][0]["status"], "queue_unconfirmed")
            self.assertEqual(missing["files"][0]["upload_id"], old_upload_id)

    def test_cli_rechecks_an_all_unconfirmed_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            write_pdf(folder / "Alpha.pdf")
            manifest, path = prepare_batch(folder, "LEMON", "hybrid")
            bucket = FakeBucket()
            upload_batch(manifest, path, bucket=bucket, db=FakeDb(False), queue_timeout_seconds=0)

            argv = ["lemon_ingest.py", "--folder", str(folder), "--yes"]
            with (
                mock.patch.object(sys, "argv", argv),
                mock.patch.object(lemon_ingest, "init_firebase"),
                mock.patch.object(lemon_ingest, "get_firestore", return_value=FakeDb()),
                mock.patch.object(lemon_ingest, "get_storage_bucket", return_value=bucket),
                mock.patch("builtins.input", side_effect=AssertionError("No new spend prompt expected")),
            ):
                self.assertEqual(lemon_ingest.main(), 0)
            self.assertEqual(lemon_ingest.load_manifest(path)["files"][0]["status"], "queued")
            self.assertEqual(next(iter(bucket.blobs.values())).upload_count, 1)

    def test_missing_source_keeps_prior_audit_record(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            source = folder / "Alpha.pdf"
            write_pdf(source)
            manifest, path = prepare_batch(folder, "LEMON", "hybrid")
            manifest["files"][0]["status"] = "queued"
            save_manifest(path, manifest)
            source.unlink()

            refreshed, _ = prepare_batch(folder, "LEMON", "hybrid")
            self.assertEqual(refreshed["files"][0]["status"], "queued")
            self.assertFalse(refreshed["files"][0]["source_present"])

    def test_changed_batch_route_and_second_process_stop_safely(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            write_pdf(folder / "Alpha.pdf")
            prepare_batch(folder, "LEMON", "hybrid")
            with self.assertRaisesRegex(BatchError, "already has a saved batch"):
                prepare_batch(folder, "SUBMISSION", "hybrid")
            with folder_lock(folder):
                with self.assertRaisesRegex(BatchError, "already open"):
                    with folder_lock(folder):
                        pass

    def test_new_batch_is_blocked_after_any_possible_upload(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            write_pdf(folder / "Alpha.pdf")
            manifest, path = prepare_batch(folder, "LEMON", "hybrid")
            manifest["files"][0]["status"] = "queue_unconfirmed"
            save_manifest(path, manifest)
            with self.assertRaisesRegex(BatchError, "may already exist in production"):
                archive_manifest(folder)

    def test_firestore_project_must_be_production(self):
        wrong_client = mock.Mock(project="lemon-studios-os")
        with mock.patch.object(lemon_ingest.firestore, "client", return_value=wrong_client):
            with self.assertRaisesRegex(BatchError, "not lemon-screenplay-dashboard"):
                lemon_ingest.get_firestore()

    def test_tampered_manifest_stops_before_storage(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            write_pdf(folder / "Alpha.pdf")
            manifest, path = prepare_batch(folder, "LEMON", "hybrid")
            manifest["files"][0]["object_name"] = "ingest-queue/LEMON/other/Evil.pdf"
            bucket = FakeBucket()

            with self.assertRaisesRegex(BatchError, "Invalid saved Storage path"):
                upload_batch(manifest, path, bucket=bucket, db=FakeDb())
            self.assertEqual(bucket.blobs, {})

            manifest["files"][0]["object_name"] = (
                f"ingest-queue/LEMON/{manifest['files'][0]['upload_id']}/Alpha.pdf"
            )
            manifest["files"][0]["relative_path"] = "../Alpha.pdf"
            with self.assertRaisesRegex(BatchError, "Unsafe saved path"):
                validate_manifest(manifest, path)

    def test_queue_generation_must_match_uploaded_object(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            write_pdf(folder / "Alpha.pdf")
            manifest, path = prepare_batch(folder, "LEMON", "hybrid")

            upload_batch(
                manifest,
                path,
                bucket=FakeBucket(),
                db=FakeDb(storage_generation="different"),
                queue_timeout_seconds=0,
            )
            self.assertEqual(manifest["files"][0]["status"], "queue_unconfirmed")

    def test_queue_poll_waits_for_the_exact_generation(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            write_pdf(folder / "Alpha.pdf")
            manifest, path = prepare_batch(folder, "LEMON", "hybrid")

            upload_batch(
                manifest,
                path,
                bucket=FakeBucket(),
                db=FakeDb(storage_generations=["old", "1"]),
                queue_timeout_seconds=1,
                sleep=lambda _seconds: None,
            )
            self.assertEqual(manifest["files"][0]["status"], "queued")

    def test_resume_cost_includes_uncertain_upload_states(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            write_pdf(folder / "Alpha.pdf")
            manifest, _ = prepare_batch(folder, "LEMON", "hybrid")
            manifest["files"][0]["status"] = "upload_error"
            self.assertEqual(batch_cost_range(manifest), (0.0, 1.0))

    def test_spanish_title_forms_and_renamed_pending_copy_are_blocked(self):
        self.assertEqual(normalized_title("Café"), normalized_title("Cafe\u0301"))
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            write_pdf(folder / "Zeta.pdf", b"same")
            manifest, path = prepare_batch(folder, "LEMON", "hybrid")
            manifest["files"][0]["status"] = "queue_unconfirmed"
            save_manifest(path, manifest)
            write_pdf(folder / "Alpha.pdf", b"same")

            resumed, _ = prepare_batch(folder, "LEMON", "hybrid")
            counts = batch_counts(resumed)
            self.assertEqual(counts.get("ready", 0), 0)
            self.assertEqual(counts["queue_unconfirmed"], 1)
            self.assertEqual(counts["skipped_duplicate"], 1)

    def test_cli_returns_incomplete_when_file_changes_after_approval(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            write_pdf(folder / "Alpha.pdf")

            def block_after_approval(manifest, _path, **_kwargs):
                manifest["files"][0].update(
                    status="blocked_changed",
                    error="The PDF changed after review.",
                )
                return manifest

            argv = ["lemon_ingest.py", "--folder", str(folder), "--yes"]
            with (
                mock.patch.object(sys, "argv", argv),
                mock.patch.object(lemon_ingest, "init_firebase"),
                mock.patch.object(lemon_ingest, "get_firestore", return_value=FakeDb()),
                mock.patch.object(lemon_ingest, "upload_batch", side_effect=block_after_approval),
            ):
                self.assertEqual(lemon_ingest.main(), 1)


if __name__ == "__main__":
    unittest.main()
