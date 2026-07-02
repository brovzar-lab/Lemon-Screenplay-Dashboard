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
import os
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

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
            text_parts = []

            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)

            return '\n'.join(text_parts), 'PyPDF2'
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
            text_parts = []

            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)

            return '\n'.join(text_parts), 'pdfplumber'
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
        text_parts = []

        for page in doc:
            page_text = page.get_text()
            if page_text:
                text_parts.append(page_text)

        doc.close()
        return '\n'.join(text_parts), 'pymupdf'
    except Exception as e:
        logger.warning(f"PyMuPDF extraction failed: {e}")
        return "", 'pymupdf_failed'


def extract_text_ocr(pdf_path: Path, dpi: int = 300) -> Tuple[str, str]:
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

    try:
        logger.info(f"Converting PDF to images (DPI: {dpi})...")
        images = convert_from_path(pdf_path, dpi=dpi)

        text_parts = []
        total_pages = len(images)

        for i, image in enumerate(images, 1):
            logger.info(f"OCR processing page {i}/{total_pages}...")
            page_text = pytesseract.image_to_string(image)
            if page_text:
                text_parts.append(page_text)

        return '\n'.join(text_parts), 'OCR'
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


def parse_screenplay(pdf_path: Path, force_ocr: bool = False) -> Dict[str, Any]:
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

    text = ""
    method = ""

    if force_ocr:
        logger.info("Force OCR mode enabled")
        text, method = extract_text_ocr(pdf_path)
    else:
        # Try extraction methods in order
        extraction_methods = [
            ("pdfplumber", extract_text_pdfplumber),
            ("pymupdf", extract_text_pymupdf),
            ("PyPDF2", extract_text_pypdf2),
        ]

        for method_name, extract_func in extraction_methods:
            logger.info(f"Trying {method_name}...")
            text, method = extract_func(pdf_path)
            word_count = len(text.split()) if text else 0

            if word_count >= MIN_WORD_COUNT:
                logger.info(f"✓ {method_name} succeeded: {word_count} words")
                break
            else:
                logger.warning(f"✗ {method_name} insufficient: {word_count} words (need {MIN_WORD_COUNT})")

        # If all standard methods fail, try OCR
        if len(text.split()) < MIN_WORD_COUNT:
            logger.warning("All standard methods failed, attempting OCR...")
            text, method = extract_text_ocr(pdf_path)

    word_count = len(text.split()) if text else 0

    if word_count < MIN_WORD_COUNT:
        logger.error(f"All extraction methods failed for {pdf_path.name} (got {word_count} words)")
        raise ValueError(f"Could not extract sufficient text from {pdf_path.name}. Got {word_count} words, need {MIN_WORD_COUNT}.")

    # Get metadata
    page_count = get_page_count(pdf_path)
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
            'parser_version': 'v2'
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
        default=300,
        help='DPI for OCR image conversion (default: 300)'
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
                content = parse_screenplay(pdf_path, force_ocr=args.ocr)

                # Save to output directory
                output_filename = pdf_path.stem + '.json'
                output_path = output_dir / output_filename
                save_parsed_content(content, output_path)

                successful += 1

            except Exception as e:
                logger.error(f"✗ Failed to parse {pdf_path.name}: {e}")
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
