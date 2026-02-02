#!/usr/bin/env python3
"""
Analyze Screenplay with AI - VERSION 3 (Strict Evaluation Thresholds)

Purpose: Use Claude or GPT to analyze screenplay content with strict evaluation criteria
Based on: evaluation-thresholds.md

Features:
- 7 Weighted Dimensions (Concept 20%, Structure 15%, Protagonist 15%, etc.)
- Critical Failures = Automatic PASS
- Commercial Viability Score (CVS) requirement
- Strict thresholds: RECOMMEND ≥7.5, CONSIDER 5.5-7.4, PASS <5.5
- Target distribution: ~5% RECOMMEND, ~25% CONSIDER, ~70% PASS

Inputs: Parsed screenplay JSON from parse_screenplay_pdf.py
Outputs: AI analysis JSON with dimension scores, CVS, critical failures, and verdict
Dependencies: anthropic, openai

Usage:
    python execution/analyze_screenplay_v3.py --input .tmp/parsed/myscript.json
    python execution/analyze_screenplay_v3.py --input .tmp/parsed/ --model claude
"""

import argparse
import json
import logging
import sys
import os
from pathlib import Path
from typing import Dict, Any, Optional
from dotenv import load_dotenv
import httpx

# Import retry utilities
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log
)

try:
    from anthropic import Anthropic
    from anthropic import (
        APIConnectionError,
        APITimeoutError,
        RateLimitError,
        InternalServerError,
        BadRequestError,
    )
    ANTHROPIC_AVAILABLE = True
except ImportError:
    Anthropic = None
    ANTHROPIC_AVAILABLE = False
    APIConnectionError = APITimeoutError = RateLimitError = InternalServerError = BadRequestError = Exception

try:
    from openai import OpenAI
    from openai import (
        APIConnectionError as OpenAIConnectionError,
        RateLimitError as OpenAIRateLimitError,
        APITimeoutError as OpenAITimeoutError,
    )
    OPENAI_AVAILABLE = True
except ImportError:
    OpenAI = None
    OPENAI_AVAILABLE = False
    OpenAIConnectionError = OpenAIRateLimitError = OpenAITimeoutError = Exception

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('.tmp/analysis_v3.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Retry configuration
MAX_RETRIES = 5
MIN_WAIT_SECONDS = 4
MAX_WAIT_SECONDS = 60

# Retryable exceptions for Anthropic
ANTHROPIC_RETRYABLE = (
    APIConnectionError,
    APITimeoutError,
    RateLimitError,
    InternalServerError,
    httpx.ConnectError,
    httpx.TimeoutException,
    ConnectionError,
    TimeoutError,
)

# Retryable exceptions for OpenAI
OPENAI_RETRYABLE = (
    OpenAIConnectionError,
    OpenAIRateLimitError,
    OpenAITimeoutError,
    httpx.ConnectError,
    httpx.TimeoutException,
    ConnectionError,
    TimeoutError,
)


def create_anthropic_retry():
    """Create retry decorator for Anthropic API calls."""
    return retry(
        retry=retry_if_exception_type(ANTHROPIC_RETRYABLE),
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=2, min=MIN_WAIT_SECONDS, max=MAX_WAIT_SECONDS),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True
    )


def create_openai_retry():
    """Create retry decorator for OpenAI API calls."""
    return retry(
        retry=retry_if_exception_type(OPENAI_RETRYABLE),
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=2, min=MIN_WAIT_SECONDS, max=MAX_WAIT_SECONDS),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True
    )


# ENHANCED Analysis prompt template with strict evaluation thresholds
ANALYSIS_PROMPT = """You are a development analyst whose reputation depends on two things: never championing a script that wastes production resources, and never passing on a script that another company turns into a hit.

**Your operational philosophy:**
- Default to skepticism, not cynicism
- Demand evidence on the page, not potential in theory
- A CONSIDER is not a consolation prize—it's a genuine belief that development can solve identified problems
- A RECOMMEND puts your credibility on the line; issue sparingly
- A PASS is not an insult—most professional scripts get passed

**Calibration benchmark:** Target distribution is approximately 5% RECOMMEND, 25% CONSIDER, 70% PASS.

---

Screenplay Title: {title}
Page Count: {page_count}
Word Count: {word_count}

SCREENPLAY TEXT:
{text}

---

## SCORING INSTRUCTIONS

Score each of the seven dimensions from 1-10 using these criteria:

### CONCEPT (Weight: 20%)
- 9-10: Instantly compelling hook. Sellable in one sentence. Clear audience. Fresh take or bold new territory.
- 7-8: Strong hook requiring minimal explanation. Audience identifiable. Marketable with competent campaign.
- 5-6: Premise clear but not distinctive. Execution-dependent.
- 3-4: Generic or confused concept. Requires explanation. Audience unclear.
- 1-2: No discernible hook. Cannot articulate why anyone would watch.

### STRUCTURE (Weight: 15%)
- 9-10: Impeccable architecture. Every scene earns its place. Pacing feels inevitable. Surprises feel earned.
- 7-8: Solid three-act structure. Clear act breaks. Momentum sustained. Minor pacing issues.
- 5-6: Functional structure with visible seams. Some saggy sections.
- 3-4: Structural problems hurt the read. Unclear act breaks. Missing or weak beats.
- 1-2: No discernible structure. Events feel random. No momentum.

### PROTAGONIST (Weight: 15%)
- 9-10: Unforgettable character. Clear want and need. Agency drives plot. Transformation earned. Actor-bait role.
- 7-8: Compelling protagonist with clear goals. Active in driving story. Arc visible and satisfying.
- 5-6: Functional protagonist. Goals present. Somewhat active. Arc exists but could be sharper.
- 3-4: Passive or unclear protagonist. Goals muddy. Story happens to them.
- 1-2: Cannot identify goals. Pure reactivity. No investment reason. No arc.

### SUPPORTING CAST (Weight: 10%)
- 9-10: Memorable ensemble. Every character feels like a person. Actors would fight for these roles.
- 7-8: Strong supporting characters with distinct voices. Enhance protagonist's journey.
- 5-6: Functional supporting cast. Serve the plot. Some distinction.
- 3-4: Characters feel like types. Interchangeable. Serve mechanical purposes.
- 1-2: Supporting cast nonexistent or indistinguishable.

### DIALOGUE (Weight: 10%)
- 9-10: Quotable lines. Every character sounds distinct. Subtext rich. Exposition invisible.
- 7-8: Strong dialogue voice. Good ear. Subtext present. Characters distinguishable.
- 5-6: Serviceable dialogue. Gets information across. Some subtext.
- 3-4: On-the-nose dialogue. Characters explain rather than reveal.
- 1-2: Wooden or unnatural speech. All characters sound identical.

### GENRE EXECUTION (Weight: 15%)
- 9-10: Masterful genre command. Delivers expected pleasures with fresh execution. Satisfies and potentially expands audience.
- 7-8: Solid genre execution. Obligatory scenes present and effective. Delivers the goods.
- 5-6: Adequate genre execution. Hits required beats without distinction.
- 3-4: Weak genre execution. Missing obligatory scenes. Core audience disappointed.
- 1-2: Genre confusion. Doesn't understand what audience expects.

### ORIGINALITY (Weight: 15%)
- 9-10: Fresh voice announcing distinct writer. Haven't seen this exact thing before. Makes you rethink the genre.
- 7-8: Clear voice. Distinctive perspective. Personal stamp on familiar territory.
- 5-6: Competent but not distinctive. Could have been written by many writers.
- 3-4: Derivative. Obvious influences dominate. Feels assembled from other films.
- 1-2: Plagiaristic in feel. No discernible voice. Pure imitation.

---

## CRITICAL FAILURES (Automatic PASS)

Check for these. ANY Critical Failure = automatic PASS regardless of scores:

**Concept-Level Failures:**
- No discernible hook (cannot articulate what makes this worth watching in one sentence)
- Audience confusion (cannot identify who would pay to see this)
- Derivative without elevation (indistinguishable from obvious influences)
- Tone incoherence (script cannot decide what it wants to be)

**Protagonist Failures:**
- Passive protagonist (events happen TO character through middle of second act or beyond)
- Goal absence (cannot articulate what protagonist wants by end of first act)
- Unearned transformation (character changes without adequate pressure)
- Likeability vacuum (no qualities creating audience investment)

**Structural Failures:**
- Missing engine (no clear dramatic question sustaining momentum)
- Second act collapse (pages 30-90 lack progressive complication)
- Climax deflation (final confrontation fails to pay off setup)
- Ending betrayal (resolution contradicts story's implicit promise)

**Execution Failures:**
- Amateur formatting (consistent violation of screenplay conventions)
- Overwriting (action lines routinely exceed 4 lines; speeches exceed 5 lines)
- Unfilmables (heavy reliance on internal states camera cannot capture)

---

## VERDICT THRESHOLDS (STRICT)

Calculate weighted score: (Concept × 0.20) + (Structure × 0.15) + (Protagonist × 0.15) + (Supporting Cast × 0.10) + (Dialogue × 0.10) + (Genre Execution × 0.15) + (Originality × 0.15)

### FILM NOW (Elite Tier - Less than 1% of scripts) requires ALL of:
- Weighted Score >= 8.5
- Concept >= 9 (undeniable hook)
- Protagonist >= 9 (unforgettable lead role)
- Originality >= 9 (singular voice)
- ALL dimensions >= 8 (no exceptions - excellence across the board)
- Zero Critical Failures
- Zero Major Weaknesses (not even one)
- Commercial Viability Score >= 15

FILM NOW also requires passing these qualitative tests:
- Lightning Test: Immediate, visceral hook within first 10 pages that creates NEED to know what happens
- Goosebumps Test: At least 3 moments of genuine emotional response (laughed out loud, eyes welled up, heart raced, audible gasp)
- Career Risk Test: Would stake professional reputation on this without hesitation

FILM NOW means: "Stop everything and make this movie NOW. This is once-in-a-generation material."

### RECOMMEND requires ALL of:
- Weighted Score >= 7.5
- Concept >= 8
- NO dimension below 6
- Protagonist >= 7
- Genre Execution >= 7
- Zero Critical Failures
- Maximum ONE Major Weakness
- Commercial Viability Score >= 8

### CONSIDER requires ALL of:
- Weighted Score 5.5 to 7.4
- Concept >= 6
- No more than TWO dimensions below 5
- Zero Critical Failures
- Clear, articulable development path exists
- Problems fixable within 1-2 drafts

### PASS if ANY of:
- Weighted Score < 5.5
- ANY Critical Failure present
- Concept < 5
- Protagonist < 4
- THREE or more dimensions < 5
- Problems require page-one rewrite
- Commercial Viability Score < 6

---

## COMMERCIAL VIABILITY MATRIX

Rate each factor 1-3, sum for Commercial Viability Score (CVS):

| Factor | 3 pts | 2 pts | 1 pt |
|--------|-------|-------|------|
| Target Audience | Clear demographic with theatrical habits | Identifiable but may prefer streaming | Niche or unclear |
| High Concept | One-sentence pitch sells it | Takes 2-3 sentences | Requires explanation |
| Cast Attachability | Multiple star roles | 1-2 attachable roles | No obvious vehicles |
| Marketing Hook | Clear trailer/poster image | Marketable with creativity | Difficult without spoiling |
| Budget/Return Ratio | Appropriate to likely returns | Modest concerns | Exceeds commercial ceiling |
| Comparable Success | Recent comps performed well | Mixed performance | No comps or comps failed |

CVS 15-18: Strong commercial prospect
CVS 11-14: Viable with right execution
CVS 7-10: Commercial concerns present
CVS 6 or below: Commercial viability in serious question

**CVS below 8 = Cannot RECOMMEND regardless of weighted score**

---

Provide your analysis in the following JSON structure:

{{
  "title": "extracted or inferred title",
  "author": "author name if mentioned, otherwise 'Unknown'",
  "logline": "one-sentence premise (25-40 words)",
  "genre": "primary genre",
  "subgenres": ["list", "of", "subgenres"],
  "themes": ["major", "themes"],
  "tone": "overall tone",

  "dimension_scores": {{
    "concept": {{
      "score": 1-10,
      "justification": "specific evidence from script"
    }},
    "structure": {{
      "score": 1-10,
      "justification": "specific evidence from script"
    }},
    "protagonist": {{
      "score": 1-10,
      "justification": "specific evidence from script"
    }},
    "supporting_cast": {{
      "score": 1-10,
      "justification": "specific evidence from script"
    }},
    "dialogue": {{
      "score": 1-10,
      "justification": "specific evidence from script"
    }},
    "genre_execution": {{
      "score": 1-10,
      "justification": "specific evidence from script"
    }},
    "originality": {{
      "score": 1-10,
      "justification": "specific evidence from script"
    }},
    "weighted_score": "calculated float to 2 decimal places"
  }},

  "critical_failures": ["list any critical failures found, or empty array if none"],
  "major_weaknesses": ["list major weaknesses found"],

  "commercial_viability": {{
    "target_audience": {{ "score": 1-3, "note": "brief explanation" }},
    "high_concept": {{ "score": 1-3, "note": "brief explanation" }},
    "cast_attachability": {{ "score": 1-3, "note": "brief explanation" }},
    "marketing_hook": {{ "score": 1-3, "note": "brief explanation" }},
    "budget_return_ratio": {{ "score": 1-3, "note": "brief explanation" }},
    "comparable_success": {{ "score": 1-3, "note": "brief explanation" }},
    "cvs_total": "sum of above (6-18)"
  }},

  "structure_analysis": {{
    "format_quality": "professional/amateur/needs_work",
    "act_breaks": "where major act breaks occur",
    "pacing": "fast/medium/slow with notes"
  }},

  "characters": {{
    "protagonist": "name and brief description with goal clarity assessment",
    "antagonist": "name and brief description",
    "supporting": ["key supporting characters with distinctiveness notes"]
  }},

  "standout_scenes": [
    {{
      "scene": "brief description",
      "why": "what makes it standout"
    }}
  ],

  "comparable_films": [
    {{
      "title": "similar produced film",
      "similarity": "how this screenplay compares",
      "box_office_relevance": "success/mixed/failure"
    }}
  ],

  "target_audience": {{
    "primary_demographic": "age range and description",
    "gender_skew": "male/female/neutral",
    "interests": ["specific audience interests"]
  }},

  "budget_tier": {{
    "category": "micro (<$1M) / low ($1-10M) / medium ($10-50M) / high ($50M+)",
    "justification": "brief explanation"
  }},

  "assessment": {{
    "strengths": ["list of specific strengths with evidence"],
    "weaknesses": ["list of specific weaknesses with evidence"],
    "development_notes": ["prescriptive suggestions if CONSIDER - what specific changes would elevate to RECOMMEND"],
    "marketability": "high/medium/low with detailed explanation",
    "recommendation": "PASS/CONSIDER/RECOMMEND/FILM NOW",
    "recommendation_rationale": "2-3 sentence explanation citing weighted score, any critical failures, CVS, and threshold requirements met or not met"
  }},

  "film_now_assessment": {{
    "qualifies": true/false,
    "lightning_test": "Description of the visceral hook in first 10 pages, or null if not exceptional",
    "goosebumps_moments": ["Page X: description of emotional moment", "Page Y: description", "Page Z: description"] or [],
    "career_risk_test": "Would you stake your career on this? Explanation",
    "legacy_potential": "Could this be remembered in 20 years? Why or why not",
    "disqualifying_factors": ["List any factors preventing FILM NOW status"] or []
  }},

  "verdict_statement": "Use appropriate template: For FILM NOW: 'FILM NOW: [TITLE] represents exceptional material that demands immediate greenlight consideration. The Lightning: [hook]. The Craft: Weighted score of X.XX with no dimension below 8. The Commercial Case: CVS of XX/18. [Star potential]. Urgency: This screenplay will not remain available.' For RECOMMEND: 'Based on [specific strengths], this screenplay demonstrates commercial viability and craft execution that warrant immediate development consideration. [Key castable role] presents a strong attachment opportunity.' For CONSIDER: 'This screenplay shows genuine [specific merits] but requires development attention to [specific issues]. With [specific fixes], this project could achieve RECOMMEND status.' For PASS: 'While [acknowledge any strengths], this screenplay [specific core problem]. The development investment required to address [fundamental issues] exceeds the value of the current material.'"
}}

IMPORTANT: Return ONLY the JSON object, no additional text. Score BEFORE determining verdict to avoid confirmation bias."""


# Model configuration
CLAUDE_MODELS = {
    'sonnet': 'claude-3-7-sonnet-20250219',
    'haiku': 'claude-3-5-haiku-20241022',
    'opus': 'claude-3-opus-20240229'
}

@create_anthropic_retry()
def _call_claude_api(client, prompt: str, model_name: str = 'sonnet') -> str:
    """
    Internal function to make Claude API call with retry logic.

    Args:
        client: Anthropic client
        prompt: The prompt to send
        model_name: Which Claude model to use ('sonnet', 'haiku', or 'opus')

    Returns:
        Response text from Claude
    """
    model = CLAUDE_MODELS.get(model_name, CLAUDE_MODELS['sonnet'])
    message = client.messages.create(
        model=model,
        max_tokens=8192,
        timeout=httpx.Timeout(120.0, connect=10.0),  # 2 min total, 10s connect
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    return message.content[0].text


def analyze_with_claude(text: str, metadata: Dict[str, Any], api_key: Optional[str] = None, model_name: str = 'sonnet') -> Dict[str, Any]:
    """
    Analyze screenplay using Claude with retry logic for network failures.

    Args:
        text: Screenplay text
        metadata: Screenplay metadata (page count, etc.)
        api_key: Optional API key (overrides .env file)
        model_name: Which Claude model to use ('sonnet', 'haiku', or 'opus')

    Returns:
        Analysis results as dictionary
    """
    if not ANTHROPIC_AVAILABLE:
        raise ImportError("anthropic package not installed")

    # Use provided API key or load from environment/.env
    if api_key:
        key = api_key
    else:
        key = os.environ.get('ANTHROPIC_API_KEY') or os.getenv('ANTHROPIC_API_KEY')
        if not key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment or .env file")

    client = Anthropic(api_key=key)

    # Truncate text if too long (Claude has 200k token limit, but let's be conservative)
    # Haiku has smaller context, so use less for haiku
    max_chars = 200000 if model_name == 'haiku' else 400000
    if len(text) > max_chars:
        logger.warning(f"Text too long ({len(text)} chars), truncating to {max_chars}")
        text = text[:max_chars] + "\n\n[... truncated ...]"

    prompt = ANALYSIS_PROMPT.format(
        title=metadata.get('filename', 'Unknown'),
        page_count=metadata.get('page_count', 'Unknown'),
        word_count=metadata.get('word_count', 'Unknown'),
        text=text
    )

    logger.info(f"Sending to Claude ({model_name}) for analysis...")

    try:
        response_text = _call_claude_api(client, prompt, model_name)

        # Parse JSON response
        analysis = json.loads(response_text)
        logger.info(f"✓ Claude ({model_name}) analysis complete")
        return analysis

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Claude response as JSON: {e}")
        # Return raw response if JSON parsing fails
        return {"raw_response": response_text, "error": "JSON parse failed"}
    except RateLimitError as e:
        logger.error(f"Rate limit exceeded after {MAX_RETRIES} retries: {e}")
        raise
    except APIConnectionError as e:
        logger.error(f"Network connection failed after {MAX_RETRIES} retries: {e}")
        raise
    except APITimeoutError as e:
        logger.error(f"Request timed out after {MAX_RETRIES} retries: {e}")
        raise
    except Exception as e:
        logger.error(f"Claude analysis failed: {type(e).__name__}: {e}")
        raise


@create_openai_retry()
def _call_openai_api(client, prompt: str) -> str:
    """
    Internal function to make OpenAI API call with retry logic.

    Args:
        client: OpenAI client
        prompt: The prompt to send

    Returns:
        Response text from GPT
    """
    response = client.chat.completions.create(
        model="gpt-4o",
        timeout=httpx.Timeout(120.0, connect=10.0),  # 2 min total, 10s connect
        messages=[
            {"role": "system", "content": "You are a professional development executive. Always respond with valid JSON only."},
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"}
    )
    return response.choices[0].message.content


def analyze_with_gpt(text: str, metadata: Dict[str, Any], api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Analyze screenplay using GPT with retry logic for network failures.

    Args:
        text: Screenplay text
        metadata: Screenplay metadata
        api_key: Optional API key (overrides .env file)

    Returns:
        Analysis results as dictionary
    """
    if not OPENAI_AVAILABLE:
        raise ImportError("openai package not installed")

    # Use provided API key or load from environment/.env
    if api_key:
        key = api_key
    else:
        key = os.environ.get('OPENAI_API_KEY') or os.getenv('OPENAI_API_KEY')
        if not key:
            raise ValueError("OPENAI_API_KEY not found in .env")

    client = OpenAI(api_key=key)

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
        response_text = _call_openai_api(client, prompt)
        analysis = json.loads(response_text)
        logger.info("✓ GPT analysis complete")
        return analysis

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse GPT response as JSON: {e}")
        return {"raw_response": response_text, "error": "JSON parse failed"}
    except OpenAIRateLimitError as e:
        logger.error(f"Rate limit exceeded after {MAX_RETRIES} retries: {e}")
        raise
    except OpenAIConnectionError as e:
        logger.error(f"Network connection failed after {MAX_RETRIES} retries: {e}")
        raise
    except OpenAITimeoutError as e:
        logger.error(f"Request timed out after {MAX_RETRIES} retries: {e}")
        raise
    except Exception as e:
        logger.error(f"GPT analysis failed: {type(e).__name__}: {e}")
        raise


def analyze_screenplay(parsed_json_path: Path, model: str = "claude", api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Analyze a screenplay from parsed JSON.

    Args:
        parsed_json_path: Path to parsed screenplay JSON
        model: AI model to use ("claude", "claude-haiku", "claude-sonnet", "claude-opus", or "gpt")
        api_key: Optional API key (overrides .env)

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

    # Map model argument to API model name
    model_lower = model.lower()

    # Run analysis
    if model_lower in ("claude", "claude-sonnet"):
        analysis = analyze_with_claude(text, metadata, api_key, model_name='sonnet')
    elif model_lower == "claude-haiku":
        analysis = analyze_with_claude(text, metadata, api_key, model_name='haiku')
    elif model_lower == "claude-opus":
        analysis = analyze_with_claude(text, metadata, api_key, model_name='opus')
    elif model_lower == "gpt":
        analysis = analyze_with_gpt(text, metadata, api_key)
    else:
        raise ValueError(f"Unknown model: {model}. Use claude, claude-haiku, claude-sonnet, claude-opus, or gpt")

    # Combine with metadata
    result = {
        'source_file': parsed_data['filename'],
        'analysis_model': model,
        'analysis_version': 'v3_strict_thresholds',
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
        description='Analyze screenplay using AI (V3 Strict Thresholds)'
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
        default='.tmp/analysis_v3',
        help='Directory to save analysis JSON (default: .tmp/analysis_v3)'
    )
    
    parser.add_argument(
        '--model',
        type=str,
        choices=['claude', 'claude-haiku', 'claude-sonnet', 'claude-opus', 'gpt'],
        default='claude',
        help='AI model to use: claude (default=sonnet), claude-haiku (cheap/fast), claude-sonnet, claude-opus (best), gpt'
    )
    
    parser.add_argument(
        '--api-key',
        type=str,
        help='Anthropic API key (alternative to .env file)'
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
                analysis = analyze_screenplay(json_path, args.model, args.api_key)
                
                # Save analysis
                output_filename = json_path.stem + '_analysis_v3.json'
                output_path = output_dir / output_filename
                save_analysis(analysis, output_path)
                
                successful += 1
                
            except Exception as e:
                logger.error(f"✗ Failed to analyze {json_path.name}: {e}")
                failed += 1
        
        print(f"\n✓ Analyzed {successful} screenplays (V3 Strict Thresholds)")
        if failed > 0:
            print(f"✗ {failed} analyses failed")
        
        return 0 if failed == 0 else 1
        
    except Exception as e:
        logger.error(f"Script failed: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
