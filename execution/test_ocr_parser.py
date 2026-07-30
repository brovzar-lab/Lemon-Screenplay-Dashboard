import subprocess
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

os.environ.setdefault("DAEMON_LOG_DIR", tempfile.gettempdir())

import daemon
from execution import ingest_v9
from execution import parse_screenplay_pdf_v2 as parser


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "scanned_screenplay_fixture.pdf"
SCREENPLAY_TEXT = "INT. CASA - NOCHE\n" + "familia secreto memoria accion dialogo " * 120


class TestOcrParser(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.pdf_path = Path(self.temp_dir.name) / "Scanned Draft.pdf"
        self.pdf_path.write_bytes(b"test scanned PDF bytes")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_insufficient_native_text_falls_back_to_bilingual_ocr(self):
        ocr = Mock(return_value=SCREENPLAY_TEXT)
        tesseract = SimpleNamespace(image_to_string=ocr)

        with (
            patch.object(parser, "OCR_AVAILABLE", True),
            patch.object(parser, "extract_text_pdfplumber", return_value=("", "pdfplumber")),
            patch.object(parser, "extract_text_pymupdf", return_value=("", "pymupdf")),
            patch.object(parser, "extract_text_pypdf2", return_value=("", "PyPDF2")),
            patch.object(parser, "get_page_count", return_value=2),
            patch.object(
                parser,
                "convert_from_path",
                return_value=["page-1.jpg", "page-2.jpg"],
                create=True,
            ) as convert,
            patch.object(parser, "pytesseract", tesseract, create=True),
        ):
            result = parser.parse_screenplay(self.pdf_path)

        self.assertEqual(result["metadata"]["extraction_method"], "OCR")
        self.assertGreaterEqual(result["word_count"], parser.MIN_WORD_COUNT)
        self.assertIn("[PAGE 1]", result["text"])
        self.assertIn("[PAGE 2]", result["text"])
        self.assertTrue(
            result["metadata"]["extraction_quality"]["publication_ready"]
        )
        self.assertEqual(
            [item["page"] for item in result["metadata"]["page_diagnostics"]],
            [1, 2],
        )
        self.assertEqual(convert.call_args.kwargs["dpi"], 200)
        self.assertTrue(convert.call_args.kwargs["paths_only"])
        self.assertEqual(ocr.call_count, 2)
        for call in ocr.call_args_list:
            self.assertEqual(call.kwargs["lang"], "eng+spa")
            self.assertEqual(call.kwargs["timeout"], parser.OCR_PAGE_TIMEOUT_SECONDS)

    def test_page_ceiling_stops_ocr_before_rendering(self):
        convert = Mock()
        with (
            patch.object(parser, "OCR_AVAILABLE", True),
            patch.object(parser, "get_page_count", return_value=201),
            patch.object(parser, "convert_from_path", convert, create=True),
        ):
            with self.assertRaisesRegex(ValueError, "exceeds the 200-page OCR limit"):
                parser.parse_screenplay(self.pdf_path, force_ocr=True)

        convert.assert_not_called()

    def test_ocr_error_discards_partial_text(self):
        ocr = Mock(side_effect=[SCREENPLAY_TEXT, RuntimeError("tesseract stopped")])
        tesseract = SimpleNamespace(image_to_string=ocr)

        with (
            patch.object(parser, "OCR_AVAILABLE", True),
            patch.object(parser, "get_page_count", return_value=2),
            patch.object(
                parser,
                "convert_from_path",
                return_value=["page-1.jpg", "page-2.jpg"],
                create=True,
            ),
            patch.object(parser, "pytesseract", tesseract, create=True),
        ):
            with self.assertRaisesRegex(ValueError, "ocr_failed"):
                parser.parse_screenplay(self.pdf_path, force_ocr=True)

    def test_unavailable_ocr_fails_with_a_clear_reason(self):
        with (
            patch.object(parser, "OCR_AVAILABLE", False),
            patch.object(parser, "get_page_count", return_value=2),
        ):
            with self.assertRaisesRegex(ValueError, "ocr_not_available"):
                parser.parse_screenplay(self.pdf_path, force_ocr=True)

    def test_image_only_fixture_produces_a_valid_screenplay_parse(self):
        self.assertTrue(FIXTURE_PATH.exists())
        self.assertLess(len(parser.extract_text_pdfplumber(FIXTURE_PATH)[0].split()), 10)
        page_count = parser.get_page_count(FIXTURE_PATH)
        self.assertEqual(page_count, 2)

        ocr = Mock(return_value=SCREENPLAY_TEXT)
        with (
            patch.object(parser, "OCR_AVAILABLE", True),
            patch.object(
                parser,
                "convert_from_path",
                return_value=[f"fixture-page-{page}.jpg" for page in range(page_count)],
                create=True,
            ),
            patch.object(
                parser,
                "pytesseract",
                SimpleNamespace(image_to_string=ocr),
                create=True,
            ),
        ):
            result = parser.parse_screenplay(FIXTURE_PATH)

        self.assertEqual(result["page_count"], page_count)
        self.assertEqual(result["metadata"]["extraction_method"], "OCR")
        self.assertEqual(
            daemon.validate_screenplay_text(result["text"], FIXTURE_PATH.name),
            (True, "ok"),
        )

    def test_native_extraction_preserves_every_physical_page_marker(self):
        page_text = "INT. CASA - NOCHE familia secreto memoria accion dialogo " * 40
        pages = [
            SimpleNamespace(extract_text=Mock(return_value=f"{page_text} {number}"))
            for number in range(1, 4)
        ]
        pdf = SimpleNamespace(pages=pages)
        pdf_context = Mock()
        pdf_context.__enter__ = Mock(return_value=pdf)
        pdf_context.__exit__ = Mock(return_value=False)

        with (
            patch.object(parser, "get_page_count", return_value=3),
            patch.object(parser.pdfplumber, "open", return_value=pdf_context),
        ):
            result = parser.parse_screenplay(self.pdf_path)

        self.assertEqual(result["metadata"]["extraction_method"], "pdfplumber")
        self.assertEqual(result["metadata"]["parser_version"], "v4-page-evidence")
        self.assertEqual(result["text"].count("[PAGE "), 3)
        self.assertTrue(result["metadata"]["extraction_quality"]["publication_ready"])

    def test_divergent_native_extractors_cannot_publish_a_verdict(self):
        short_page = "INT. CASA - NOCHE familia secreto memoria accion dialogo " * 35
        long_page = "INT. CASA - NOCHE familia secreto memoria accion dialogo " * 160
        short_text = parser.join_marked_pages([short_page, short_page, short_page])
        long_text = parser.join_marked_pages([long_page, long_page, long_page])

        with (
            patch.object(parser, "get_page_count", return_value=3),
            patch.object(
                parser,
                "extract_text_pdfplumber",
                return_value=(short_text, "pdfplumber"),
            ),
            patch.object(
                parser,
                "extract_text_pymupdf",
                return_value=(long_text, "pymupdf"),
            ),
            patch.object(
                parser,
                "extract_text_pypdf2",
                return_value=("", "PyPDF2"),
            ),
        ):
            result = parser.parse_screenplay(self.pdf_path)

        self.assertEqual(result["metadata"]["native_cross_check"]["status"], "divergent")
        self.assertFalse(
            result["metadata"]["extraction_quality"]["publication_ready"]
        )
        self.assertIn(
            "native_extraction_divergence",
            result["metadata"]["extraction_quality"]["issues"],
        )


class TestParserSubprocessGuard(unittest.TestCase):
    def test_timeout_returns_no_parse_and_writes_no_partial_cache(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            pdf_path = root / "Long Scan.pdf"
            pdf_path.write_bytes(b"long scanned screenplay")

            with (
                patch.object(ingest_v9, "LOG_DIR", root),
                patch(
                    "subprocess.run",
                    side_effect=subprocess.TimeoutExpired("parser", 900),
                ) as run,
            ):
                result = ingest_v9.parse_pdf(pdf_path)

            self.assertIsNone(result)
            self.assertEqual(
                run.call_args.kwargs["timeout"],
                ingest_v9.PARSER_SUBPROCESS_TIMEOUT_SECONDS,
            )
            self.assertEqual(list((root / "parsed_v9").rglob("*.json")), [])


if __name__ == "__main__":
    unittest.main()
