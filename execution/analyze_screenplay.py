#!/usr/bin/env python3
"""
Analyze Screenplay with AI

Purpose: Use Claude or GPT to analyze screenplay content
Inputs: Parsed screenplay JSON from parse_screenplay_pdf.py
Outputs: AI analysis JSON with structured insights
Dependencies: anthropic, openai

Usage:
    python execution/analyze_screenplay.py --input .tmp/parsed/myscript.json
    python execution/analyze_screenplay.py --input .tmp/parsed/ --model claude
"""

import argparse
import json
import logging
import sys
import os
from pathlib import Path
from typing import Dict, Any, Optional
from dotenv import load_dotenv

try:
    from anthropic import Anthropic
except ImportError:
    Anthropic = None

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('.tmp/analysis.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Analysis prompt template
ANALYSIS_PROMPT = """You are a professional screenplay analyst. Analyze the following screenplay and provide a comprehensive assessment in JSON format.

Screenplay Title: {title}
Page Count: {page_count}
Word Count: {word_count}

SCREENPLAY TEXT:
{text}

Please provide your analysis in the following JSON structure:
{{
  "title": "extracted or inferred title",
  "author": "author name if mentioned, otherwise 'Unknown'",
  "logline": "one-sentence premise (25-40 words)",
  "genre": "primary genre",
  "subgenres": ["list", "of", "subgenres"],
  "themes": ["major", "themes"],
  "tone": "overall tone (e.g., dark, comedic, dramatic)",
  "structure": {{
    "format_quality": "professional/amateur/needs_work",
    "act_breaks": "where major act breaks occur",
    "pacing": "fast/medium/slow, with notes"
  }},
  "characters": {{
    "protagonist": "name and brief description",
    "antagonist": "name and brief description",
    "supporting": ["key supporting characters"]
  }},
  "assessment": {{
    "strengths": ["list", "of", "strengths"],
    "weaknesses": ["list", "of", "weaknesses"],
    "marketability": "high/medium/low with explanation",
    "rating": "1-10 overall score"
  }},
  "notes": ["any additional observations or recommendations"]
}}

IMPORTANT: Return ONLY the JSON object, no additional text."""


def analyze_with_claude(text: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze screenplay using Claude.
    
    Args:
        text: Screenplay text
        metadata: Screenplay metadata (page count, etc.)
        
    Returns:
        Analysis results as dictionary
    """
    if not Anthropic:
        raise ImportError("anthropic package not installed")
    
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not found in .env")
    
    client = Anthropic(api_key=api_key)
    
    # Truncate text if too long (Claude has 200k token limit, but let's be conservative)
    max_chars = 400000  # ~100k tokens
    if len(text) > max_chars:
        logger.warning(f"Text too long ({len(text)} chars), truncating to {max_chars}")
        text = text[:max_chars] + "\n\n[... truncated ...]"
    
    prompt = ANALYSIS_PROMPT.format(
        title=metadata.get('filename', 'Unknown'),
        page_count=metadata.get('page_count', 'Unknown'),
        word_count=metadata.get('word_count', 'Unknown'),
        text=text
    )
    
    logger.info("Sending to Claude for analysis...")
    
    try:
        message = client.messages.create(
            model="claude-3-7-sonnet-20250219",
            max_tokens=4096,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        response_text = message.content[0].text
        
        # Parse JSON response
        analysis = json.loads(response_text)
        logger.info("✓ Claude analysis complete")
        return analysis
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Claude response as JSON: {e}")
        # Return raw response if JSON parsing fails
        return {"raw_response": response_text, "error": "JSON parse failed"}
    except Exception as e:
        logger.error(f"Claude analysis failed: {e}")
        raise


def analyze_with_gpt(text: str, metadata: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze screenplay using GPT.
    
    Args:
        text: Screenplay text
        metadata: Screenplay metadata
        
    Returns:
        Analysis results as dictionary
    """
    if not OpenAI:
        raise ImportError("openai package not installed")
    
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise ValueError("OPENAI_API_KEY not found in .env")
    
    client = OpenAI(api_key=api_key)
    
    # GPT-4 has 128k token limit
    max_chars = 300000
    if len(text) > max_chars:
        logger.warning(f"Text too long ({len(text)} chars), truncating to {max_chars}")
        text = text[:max_chars] + "\n\n[... truncated ...]"
    
    prompt = ANALYSIS_PROMPT.format(
        title=metadata.get('filename', 'Unknown'),
        page_count=metadata.get('page_count', 'Unknown'),
        word_count=metadata.get('word_count', 'Unknown'),
        text=text
    )
    
    logger.info("Sending to GPT for analysis...")
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a professional screenplay analyst. Always respond with valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        response_text = response.choices[0].message.content
        analysis = json.loads(response_text)
        logger.info("✓ GPT analysis complete")
        return analysis
        
    except Exception as e:
        logger.error(f"GPT analysis failed: {e}")
        raise


def analyze_screenplay(parsed_json_path: Path, model: str = "claude") -> Dict[str, Any]:
    """
    Analyze a screenplay from parsed JSON.
    
    Args:
        parsed_json_path: Path to parsed screenplay JSON
        model: AI model to use ("claude" or "gpt")
        
    Returns:
        Complete analysis with metadata
    """
    logger.info(f"Analyzing {parsed_json_path.name} with {model}...")
    
    # Load parsed screenplay
    with open(parsed_json_path, 'r', encoding='utf-8') as f:
        parsed_data = json.load(f)
    
    text = parsed_data['text']
    metadata = {
        'filename': parsed_data['filename'],
        'page_count': parsed_data['page_count'],
        'word_count': parsed_data['word_count']
    }
    
    # Run analysis
    if model.lower() == "claude":
        analysis = analyze_with_claude(text, metadata)
    elif model.lower() == "gpt":
        analysis = analyze_with_gpt(text, metadata)
    else:
        raise ValueError(f"Unknown model: {model}")
    
    # Combine with metadata
    result = {
        'source_file': parsed_data['filename'],
        'analysis_model': model,
        'metadata': metadata,
        'analysis': analysis
    }
    
    return result


def save_analysis(analysis: Dict[str, Any], output_path: Path) -> None:
    """Save analysis to JSON."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(analysis, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Saved analysis to {output_path}")


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description='Analyze screenplay using AI'
    )
    
    parser.add_argument(
        '--input',
        type=str,
        required=True,
        help='Path to parsed JSON file or directory'
    )
    
    parser.add_argument(
        '--output',
        type=str,
        default='.tmp/analysis',
        help='Directory to save analysis JSON (default: .tmp/analysis)'
    )
    
    parser.add_argument(
        '--model',
        type=str,
        choices=['claude', 'gpt'],
        default='claude',
        help='AI model to use (default: claude)'
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
            json_files = [input_path]
        elif input_path.is_dir():
            json_files = list(input_path.glob('*.json'))
        else:
            raise FileNotFoundError(f"Input not found: {input_path}")
        
        if not json_files:
            raise ValueError("No JSON files found")
        
        logger.info(f"Found {len(json_files)} file(s) to analyze")
        
        # Analyze each screenplay
        successful = 0
        failed = 0
        
        for json_path in json_files:
            try:
                analysis = analyze_screenplay(json_path, args.model)
                
                # Save analysis
                output_filename = json_path.stem + '_analysis.json'
                output_path = output_dir / output_filename
                save_analysis(analysis, output_path)
                
                successful += 1
                
            except Exception as e:
                logger.error(f"✗ Failed to analyze {json_path.name}: {e}")
                failed += 1
        
        print(f"\n✓ Analyzed {successful} screenplays")
        if failed > 0:
            print(f"✗ {failed} analyses failed")
        
        return 0 if failed == 0 else 1
        
    except Exception as e:
        logger.error(f"Script failed: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
