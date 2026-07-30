#!/usr/bin/env python3
"""
Parse Screenplay PDF - VERSION 2 (with OCR support)

Purpose: Extract text content from screenplay PDFs, including scanned PDFs via OCR
Inputs: PDF file path
Outputs: Structured JSON with screenplay content
Dependencies: PyPDF2, pdfplumber, pymupdf, pytesseract, pdf2image

Usage:
    python execution/parse_screenplay_pdf_v2.py --input screenplay.pdf
    python execution/parse_screenplay_pdf_v2.py --input .tmp/screenplays/myscript.pdf --output .tmp/parsed/
    python execution/parse_screenplay_pdf_v2.py --input screenplay.pdf --ocr  # Force OCR
"""

import argparse
import json
import logging
import sys
import tempfile
from pathlib import Path
from typing import Dict, Any, Tuple

try:
    from execution.source_evidence import (
        build_page_evidence,
        join_marked_pages,
        sha256_json,
    )
except ModuleNotFoundError:  # Direct script execution adds execution/ to sys.path.
    from source_evidence import build_page_evidence, join_marked_pages, sha256_json

# Standard PDF extraction
import PyPDF2
import pdfplumber

# Enhanced extraction
try:
    import fitz  # pymupdf
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False

# OCR support
try:
    import pytesseract
    from pdf2image import convert_from_path
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('.tmp/parse_v2.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Minimum viable text length (words) to consider extraction successful
MIN_WORD_COUNT = 500  # A screenplay should have at least 500 words
OCR_DPI = 200
OCR_LANGUAGES = "eng+spa"
MAX_OCR_PAGES = 200
OCR_RENDER_TIMEOUT_SECONDS = 300
OCR_PAGE_TIMEOUT_SECONDS = 45


def extract_text_pypdf2(pdf_path: Path) -> Tuple[str, str]:
    """
    Extract text using PyPDF2.

    Args:
        pdf_path: Path to PDF file

    Returns:
        Tuple of (extracted text, method name)
    """
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            page_texts = []

            for page in reader.pages:
                page_texts.append(page.extract_text() or "")

            return join_marked_pages(page_texts), 'PyPDF2'
    except Exception as e:
        logger.warning(f"PyPDF2 extraction failed: {e}")
        return "", 'PyPDF2_failed'


def extract_text_pdfplumber(pdf_path: Path) -> Tuple[str, str]:
    """
    Extract text using pdfplumber (usually best for native PDFs).

    Args:
        pdf_path: Path to PDF file

    Returns:
        Tuple of (extracted text, method name)
    """
    try:
        with pdfplumber.open(pdf_path) as pdf:
            page_texts = []

            for page in pdf.pages:
                page_texts.append(page.extract_text() or "")

            return join_marked_pages(page_texts), 'pdfplumber'
    except Exception as e:
        logger.warning(f"pdfplumber extraction failed: {e}")
        return "", 'pdfplumber_failed'


def extract_text_pymupdf(pdf_path: Path) -> Tuple[str, str]:
    """
    Extract text using PyMuPDF (fitz) - often works better than others.

    Args:
        pdf_path: Path to PDF file

    Returns:
        Tuple of (extracted text, method name)
    """
    if not PYMUPDF_AVAILABLE:
        return "", 'pymupdf_not_available'

    try:
        doc = fitz.open(pdf_path)
        page_texts = []

        for page in doc:
            page_texts.append(page.get_text() or "")

        doc.close()
        return join_marked_pages(page_texts), 'pymupdf'
    except Exception as e:
        logger.warning(f"PyMuPDF extraction failed: {e}")
        return "", 'pymupdf_failed'


def extract_text_ocr(pdf_path: Path, dpi: int = OCR_DPI) -> Tuple[str, str]:
    """
    Extract text using OCR (for scanned PDFs).

    Args:
        pdf_path: Path to PDF file
        dpi: DPI for image conversion (higher = better quality but slower)

    Returns:
        Tuple of (extracted text, method name)
    """
    if not OCR_AVAILABLE:
        logger.error("OCR packages not available. Install pytesseract and pdf2image.")
        return "", 'ocr_not_available'

    page_count = get_page_count(pdf_path)
    if page_count <= 0:
        logger.error(f"OCR could not determine the page count for {pdf_path.name}.")
        return "", 'ocr_page_count_failed'
    if page_count > MAX_OCR_PAGES:
        raise ValueError(
            f"{pdf_path.name} has {page_count} pages and exceeds the "
            f"{MAX_OCR_PAGES}-page OCR limit."
        )

    try:
        logger.info(
            f"Converting {page_count} PDF pages to disk-backed images "
            f"(DPI: {dpi}, languages: {OCR_LANGUAGES})..."
        )
        with tempfile.TemporaryDirectory(prefix="lemon-ocr-") as image_dir:
            image_paths = convert_from_path(
                pdf_path,
                dpi=dpi,
                output_folder=image_dir,
                fmt="jpeg",
                grayscale=True,
                thread_count=2,
                paths_only=True,
                timeout=OCR_RENDER_TIMEOUT_SECONDS,
            )
            if len(image_paths) != page_count:
                logger.error(
                    f"OCR rendered {len(image_paths)} of {page_count} pages; "
                    "discarding the incomplete result."
                )
                return "", 'ocr_incomplete'

            page_texts = []
            for i, image_path in enumerate(image_paths, 1):
                logger.info(f"OCR processing page {i}/{page_count}...")
                page_text = pytesseract.image_to_string(
                    image_path,
                    lang=OCR_LANGUAGES,
                    timeout=OCR_PAGE_TIMEOUT_SECONDS,
                )
                page_texts.append(page_text or "")

        return join_marked_pages(page_texts), 'OCR'
    except Exception as e:
        logger.error(f"OCR extraction failed: {e}")
        return "", 'ocr_failed'


def get_page_count(pdf_path: Path) -> int:
    """
    Get total page count from PDF.

    Args:
        pdf_path: Path to PDF file

    Returns:
        Number of pages
    """
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            return len(reader.pages)
    except Exception as e:
        logger.error(f"Failed to get page count: {e}")
        return 0


def parse_screenplay(
    pdf_path: Path,
    force_ocr: bool = False,
    ocr_dpi: int = OCR_DPI,
) -> Dict[str, Any]:
    """
    Parse a screenplay PDF and extract structured content.

    Tries multiple extraction methods in order of preference:
    1. pdfplumber (best for native PDFs)
    2. PyMuPDF (good fallback)
    3. PyPDF2 (widely compatible)
    4. OCR (for scanned PDFs)

    Args:
        pdf_path: Path to PDF file
        force_ocr: If True, skip other methods and use OCR directly

    Returns:
        Dictionary with screenplay content and metadata
    """
    logger.info(f"Parsing {pdf_path.name}...")

    page_count = get_page_count(pdf_path)
    if page_count <= 0:
        raise ValueError(f"Could not determine the page count for {pdf_path.name}.")

    text = ""
    method = ""
    evidence = None
    attempts = []

    def record_candidate(
        candidate_text: str,
        candidate_method: str,
    ) -> Tuple[int, Dict[str, Any] | None]:
        if not candidate_text:
            attempts.append(
                {
                    "method": candidate_method,
                    "words": 0,
                    "publication_ready": False,
                    "issues": ["no_text_extracted"],
                }
            )
            return 0, None
        candidate_evidence = build_page_evidence(
            candidate_text,
            page_count,
            candidate_method,
        )
        quality = candidate_evidence["extraction_quality"]
        candidate_words = sum(
            item["words"] for item in candidate_evidence["page_diagnostics"]
        )
        attempts.append(
            {
                "method": candidate_method,
                "words": candidate_words,
                "publication_ready": quality["publication_ready"],
                "coverage_ratio": quality["coverage_ratio"],
                "issues": quality["issues"],
            }
        )
        return candidate_words, candidate_evidence

    candidates = []

    if force_ocr:
        logger.info("Force OCR mode enabled")
        text, method = extract_text_ocr(pdf_path, dpi=ocr_dpi)
        word_count, evidence = record_candidate(text, method)
        if evidence is not None:
            candidates.append((word_count, text, method, evidence))
    else:
        # Try extraction methods in order
        extraction_methods = [
            ("pdfplumber", extract_text_pdfplumber),
            ("pymupdf", extract_text_pymupdf),
            ("PyPDF2", extract_text_pypdf2),
        ]

        selected_native = None
        for method_name, extract_func in extraction_methods:
            logger.info(f"Trying {method_name}...")
            candidate_text, candidate_method = extract_func(pdf_path)
            word_count, candidate_evidence = record_candidate(
                candidate_text,
                candidate_method,
            )
            if candidate_evidence is not None:
                candidates.append(
                    (
                        word_count,
                        candidate_text,
                        candidate_method,
                        candidate_evidence,
                    )
                )

            if (
                word_count >= MIN_WORD_COUNT
                and candidate_evidence is not None
                and candidate_evidence["extraction_quality"]["publication_ready"]
            ):
                logger.info(f"✓ {method_name} succeeded: {word_count} words")
                if selected_native is None:
                    selected_native = (
                        word_count,
                        candidate_text,
                        candidate_method,
                        candidate_evidence,
                    )
            else:
                issues = (
                    candidate_evidence["extraction_quality"]["issues"]
                    if candidate_evidence is not None
                    else ["no_text_extracted"]
                )
                logger.warning(
                    f"✗ {method_name} not publication-ready: "
                    f"{word_count} words, issues={issues}"
                )

        if selected_native is not None:
            word_count, text, method, evidence = selected_native

        # OCR is the evidence fallback when native methods are too short or
        # fail to preserve enough readable pages.
        if evidence is None or not evidence["extraction_quality"]["publication_ready"]:
            logger.warning(
                "No native method produced publication-ready page evidence; "
                "attempting OCR..."
            )
            ocr_text, ocr_method = extract_text_ocr(pdf_path, dpi=ocr_dpi)
            ocr_words, ocr_evidence = record_candidate(ocr_text, ocr_method)
            if ocr_evidence is not None:
                candidates.append((ocr_words, ocr_text, ocr_method, ocr_evidence))
                if (
                    ocr_words >= MIN_WORD_COUNT
                    and ocr_evidence["extraction_quality"]["publication_ready"]
                ):
                    text = ocr_text
                    method = ocr_method
                    evidence = ocr_evidence

    # Preserve the strongest incomplete result so the daemon can route it to
    # Needs Review with diagnostics instead of losing the evidence in an error.
    if (
        (evidence is None or not evidence["extraction_quality"]["publication_ready"])
        and candidates
    ):
        word_count, text, method, evidence = max(
            candidates,
            key=lambda candidate: (
                candidate[3]["extraction_quality"]["publication_ready"],
                candidate[3]["extraction_quality"]["coverage_ratio"],
                candidate[0],
            ),
        )
    else:
        word_count = (
            sum(item["words"] for item in evidence["page_diagnostics"])
            if evidence is not None
            else 0
        )

    if word_count < MIN_WORD_COUNT:
        logger.error(f"All extraction methods failed for {pdf_path.name} (got {word_count} words)")
        raise ValueError(
            f"Could not extract sufficient text from {pdf_path.name}. "
            f"Got {word_count} words, need {MIN_WORD_COUNT}. "
            f"Last extraction result: {method or 'unknown'}."
        )

    if evidence is None:
        raise ValueError(f"No page evidence was produced for {pdf_path.name}.")

    native_ready_attempts = [
        attempt
        for attempt in attempts
        if attempt["method"] != "OCR"
        and attempt["publication_ready"]
        and attempt["words"] >= MIN_WORD_COUNT
    ]
    native_word_counts = [attempt["words"] for attempt in native_ready_attempts]
    if len(native_word_counts) >= 2:
        native_agreement_ratio = round(
            min(native_word_counts) / max(native_word_counts),
            4,
        )
        native_cross_check_status = (
            "corroborated"
            if native_agreement_ratio >= 0.65
            else "divergent"
        )
    elif len(native_word_counts) == 1:
        native_agreement_ratio = 1.0
        native_cross_check_status = "single_native_method"
    else:
        native_agreement_ratio = None
        native_cross_check_status = "ocr_only"
    native_cross_check = {
        "status": native_cross_check_status,
        "methods_compared": [
            attempt["method"] for attempt in native_ready_attempts
        ],
        "word_counts": {
            attempt["method"]: attempt["words"]
            for attempt in native_ready_attempts
        },
        "word_count_agreement_ratio": native_agreement_ratio,
    }

    if native_cross_check_status == "divergent":
        # Never let extractor order decide which contradictory screenplay text
        # receives a verdict. Preserve the fullest candidate for diagnosis, but
        # make the source terminally Needs Review before any paid model call.
        native_candidates = [
            candidate
            for candidate in candidates
            if candidate[2] != "OCR"
            and candidate[0] >= MIN_WORD_COUNT
            and candidate[3]["extraction_quality"]["publication_ready"]
        ]
        if native_candidates:
            word_count, text, method, evidence = max(
                native_candidates,
                key=lambda candidate: candidate[0],
            )
        quality = evidence["extraction_quality"]
        if "native_extraction_divergence" not in quality["issues"]:
            quality["issues"].append("native_extraction_divergence")
        quality["status"] = "incomplete"
        quality["publication_ready"] = False
        evidence_core = {
            "page_evidence_version": evidence["page_evidence_version"],
            "extraction_quality": quality,
            "page_diagnostics": evidence["page_diagnostics"],
        }
        evidence["evidence_sha256"] = sha256_json(evidence_core)

    # Get metadata
    file_size = pdf_path.stat().st_size

    # Basic content analysis
    line_count = len(text.split('\n'))

    # Create structured output
    result = {
        'filename': pdf_path.name,
        'file_size_bytes': file_size,
        'page_count': page_count,
        'word_count': word_count,
        'line_count': line_count,
        'text': text,
        'metadata': {
            'extraction_method': method,
            'text_length': len(text),
            'parser_version': 'v4-page-evidence',
            'page_evidence_version': evidence['page_evidence_version'],
            'extraction_quality': evidence['extraction_quality'],
            'page_diagnostics': evidence['page_diagnostics'],
            'page_evidence_sha256': evidence['evidence_sha256'],
            'extraction_attempts': attempts,
            'native_cross_check': native_cross_check,
        }
    }

    logger.info(f"✓ Parsed {pdf_path.name}: {page_count} pages, {word_count} words (method: {method})")
    return result


def save_parsed_content(content: Dict[str, Any], output_path: Path) -> None:
    """
    Save parsed content to JSON.

    Args:
        content: Parsed screenplay content
        output_path: Path to save JSON
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(content, f, indent=2, ensure_ascii=False)

    logger.info(f"Saved parsed content to {output_path}")


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description='Parse screenplay PDF and extract text content (V2 with OCR)'
    )

    parser.add_argument(
        '--input',
        type=str,
        required=True,
        help='Path to PDF file or directory of PDFs'
    )

    parser.add_argument(
        '--output',
        type=str,
        default='.tmp/parsed',
        help='Directory to save parsed JSON files (default: .tmp/parsed)'
    )

    parser.add_argument(
        '--ocr',
        action='store_true',
        help='Force OCR mode (skip standard extraction methods)'
    )

    parser.add_argument(
        '--dpi',
        type=int,
        default=OCR_DPI,
        help=f'DPI for OCR image conversion (default: {OCR_DPI})'
    )

    return parser.parse_args()


def main() -> int:
    """Main entry point."""
    args = parse_arguments()

    try:
        input_path = Path(args.input)
        output_dir = Path(args.output)

        # Process single file or directory
        if input_path.is_file():
            pdf_files = [input_path]
        elif input_path.is_dir():
            pdf_files = list(input_path.glob('*.pdf'))
        else:
            raise FileNotFoundError(f"Input not found: {input_path}")

        if not pdf_files:
            raise ValueError("No PDF files found")

        logger.info(f"Found {len(pdf_files)} PDF file(s) to process")
        if args.ocr:
            logger.info("Force OCR mode enabled")

        # Process each PDF
        successful = 0
        failed = 0

        for pdf_path in pdf_files:
            try:
                content = parse_screenplay(
                    pdf_path,
                    force_ocr=args.ocr,
                    ocr_dpi=args.dpi,
                )

                # Save to output directory
                output_filename = pdf_path.stem + '.json'
                output_path = output_dir / output_filename
                save_parsed_content(content, output_path)

                successful += 1

            except Exception as e:
                logger.error(f"✗ Failed to parse {pdf_path.name}: {e}")
                print(f"PARSE_ERROR: {e}", file=sys.stderr)
                failed += 1

        print(f"\n✓ Parsed {successful} files")
        if failed > 0:
            print(f"✗ {failed} files failed")

        return 0 if failed == 0 else 1

    except Exception as e:
        logger.error(f"Script failed: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
