#!/usr/bin/env python3
"""
Parse Screenplay PDF

Purpose: Extract text content from screenplay PDFs
Inputs: PDF file path
Outputs: Structured JSON with screenplay content
Dependencies: PyPDF2, pdfplumber

Usage:
    python execution/parse_screenplay_pdf.py --input screenplay.pdf
    python execution/parse_screenplay_pdf.py --input .tmp/screenplays/myscript.pdf --output .tmp/parsed/
"""

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any, Optional

import PyPDF2
import pdfplumber

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('.tmp/parse.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)


def extract_text_pypdf2(pdf_path: Path) -> str:
    """
    Extract text using PyPDF2 (fallback method).
    
    Args:
        pdf_path: Path to PDF file
        
    Returns:
        Extracted text
    """
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text_parts = []
            
            for page in reader.pages:
                text_parts.append(page.extract_text())
            
            return '\n'.join(text_parts)
    except Exception as e:
        logger.error(f"PyPDF2 extraction failed: {e}")
        return ""


def extract_text_pdfplumber(pdf_path: Path) -> str:
    """
    Extract text using pdfplumber (primary method).
    
    Args:
        pdf_path: Path to PDF file
        
    Returns:
        Extracted text
    """
    try:
        with pdfplumber.open(pdf_path) as pdf:
            text_parts = []
            
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            
            return '\n'.join(text_parts)
    except Exception as e:
        logger.error(f"pdfplumber extraction failed: {e}")
        return ""


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


def parse_screenplay(pdf_path: Path) -> Dict[str, Any]:
    """
    Parse a screenplay PDF and extract structured content.
    
    Args:
        pdf_path: Path to PDF file
        
    Returns:
        Dictionary with screenplay content and metadata
    """
    logger.info(f"Parsing {pdf_path.name}...")
    
    # Try pdfplumber first (better quality), fallback to PyPDF2
    text = extract_text_pdfplumber(pdf_path)
    if not text or len(text) < 100:
        logger.warning("pdfplumber extraction insufficient, trying PyPDF2...")
        text = extract_text_pypdf2(pdf_path)
    
    if not text or len(text) < 100:
        raise ValueError(f"Could not extract text from {pdf_path.name}")
    
    # Get metadata
    page_count = get_page_count(pdf_path)
    file_size = pdf_path.stat().st_size
    
    # Basic content analysis
    word_count = len(text.split())
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
            'extraction_method': 'pdfplumber' if len(extract_text_pdfplumber(pdf_path)) >= 100 else 'PyPDF2',
            'text_length': len(text)
        }
    }
    
    logger.info(f"✓ Parsed {pdf_path.name}: {page_count} pages, {word_count} words")
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
        description='Parse screenplay PDF and extract text content'
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
        
        # Process each PDF
        successful = 0
        failed = 0
        
        for pdf_path in pdf_files:
            try:
                content = parse_screenplay(pdf_path)
                
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
