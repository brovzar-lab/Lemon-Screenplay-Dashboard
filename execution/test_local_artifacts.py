import tempfile
import unittest
from pathlib import Path

from execution.local_artifacts import secure_local_path


class LocalArtifactContainmentTests(unittest.TestCase):
    def test_path_must_stay_inside_a_real_non_symlink_root(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            base = Path(temp_dir)
            root = base / "artifacts"
            root.mkdir()
            self.assertEqual(
                secure_local_path(root / "run" / "manifest.json", root),
                root / "run" / "manifest.json",
            )
            with self.assertRaisesRegex(ValueError, "escapes its trusted root"):
                secure_local_path(base / "outside.json", root)

            outside = base / "outside"
            outside.mkdir()
            (root / "linked").symlink_to(outside, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "contains a symlink"):
                secure_local_path(root / "linked" / "rejected.json", root)

            linked_root = base / "linked-root"
            linked_root.symlink_to(root, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "root must be a real directory"):
                secure_local_path(linked_root / "rejected.json", linked_root)


if __name__ == "__main__":
    unittest.main()
