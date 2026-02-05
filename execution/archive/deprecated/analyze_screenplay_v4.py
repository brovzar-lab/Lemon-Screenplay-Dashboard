#!/usr/bin/env python3
"""
⚠️  DEPRECATED - DO NOT USE ⚠️

This version has been superseded by analyze_screenplay_v6.py
All features from this version have been consolidated into V6.

For new analyses, use:
    python execution/analyze_screenplay_v6.py --input script.json

This file is archived for reference only.

---
Original docstring:
Analyze Screenplay with AI - VERSION 4 (Calibrated Evaluation)

Purpose: Use Claude or GPT to analyze screenplay content with ENFORCED calibration
Based on: V3 + comprehensive review findings

Key Changes from V3:
1. MANDATORY calibration enforcement in prompt
2. Devil's advocate requirement for high scores
3. Comparative anchoring to known films
4. Statistical reality checks embedded in prompt
5. Explicit skepticism framing
6. Score-before-verdict enforcement

Target distribution: <1% FILM NOW, ~5% RECOMMEND, ~25% CONSIDER, ~70% PASS

Inputs: Parsed screenplay JSON from parse_screenplay_pdf.py
Outputs: AI analysis JSON with calibrated dimension scores, CVS, critical failures, and verdict
Dependencies: anthropic, openai

Usage:
    python execution/analyze_screenplay_v4.py --input .tmp/parsed/myscript.json
    python execution/analyze_screenplay_v4.py --input .tmp/parsed/ --model claude-sonnet
"""

import warnings
warnings.warn(
    "analyze_screenplay_v4.py is deprecated. Use analyze_screenplay_v6.py instead.",
    DeprecationWarning,
    stacklevel=2
)

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
        logging.FileHandler('.tmp/analysis_v4.log'),
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


# V4 CALIBRATED Analysis prompt template with ENFORCED calibration
ANALYSIS_PROMPT = """You are a development analyst at a major studio whose career depends on accurate evaluation. Your predecessor was fired for two failures: greenlighting scripts that bombed, and passing on scripts that became hits for competitors.

═══════════════════════════════════════════════════════════════════════════════
                            MANDATORY CALIBRATION RULES
═══════════════════════════════════════════════════════════════════════════════

Before you begin analysis, internalize these statistical realities:

**DISTRIBUTION REQUIREMENTS:**
In any batch of 100 professional screenplays submitted to a major studio:
- 70 receive PASS (they have fundamental issues that cannot be economically fixed)
- 25 receive CONSIDER (promising but need development work)
- 4-5 receive RECOMMEND (ready for serious consideration)
- 0-1 receive FILM NOW (exceptional - maybe 1 per year across all submissions)

**YOUR DEFAULT POSITION IS PASS.**
The screenplay must EARN its way up through demonstrated excellence.

**CALIBRATION ANCHORS - Memorize these reference points:**
- Score 10: THE GODFATHER, CHINATOWN, THE SHAWSHANK REDEMPTION (all-time masterpieces)
- Score 9: THE SOCIAL NETWORK, PULP FICTION, GET OUT (modern classics)
- Score 8: SUPERBAD, GONE GIRL, ARRIVAL (excellent studio films)
- Score 7: Solid produced films with 70%+ RT scores
- Score 6: Average produced Hollywood films (this is the MEDIAN for PRODUCED films)
- Score 5: Below-average but producible scripts
- Score 4: Scripts with significant problems
- Score 3: Scripts requiring major rewrites
- Score 1-2: Amateur work with fundamental failures

**CRITICAL REALITY CHECK:**
Most screenplays you read - even from professional writers - will score in the 4-6 range.
A score of 7 is GOOD. A score of 8 is EXCELLENT. A score of 9 is EXCEPTIONAL.
DO NOT give 8s and 9s casually. These scores should be rare.

═══════════════════════════════════════════════════════════════════════════════

Screenplay Title: {title}
Page Count: {page_count}
Word Count: {word_count}

SCREENPLAY TEXT:
{text}

═══════════════════════════════════════════════════════════════════════════════
                              SCORING METHODOLOGY
═══════════════════════════════════════════════════════════════════════════════

**DEVIL'S ADVOCATE REQUIREMENT:**
For EVERY dimension, before assigning a score of 7 or higher, you MUST:
1. Identify at least ONE specific weakness or limitation in that dimension
2. Ask yourself: "Is this dimension truly better than 70% of professional screenplays?"
3. If you cannot articulate a clear weakness, your score may be too high
4. Scores of 9-10 require you to identify what prevents a perfect score

**SCORE EACH DIMENSION 1-10:**

### CONCEPT (Weight: 20%)
Ask: "Can I pitch this in one compelling sentence? Who is the clear audience?"
- 9-10: RARE. Instant "I'd pay to see that." Jaws, Get Out, The Hangover-level hooks.
- 7-8: Strong hook. Clear audience. Would get a meeting.
- 5-6: Premise is clear but not distinctive. Execution-dependent.
- 3-4: Generic. "We've seen this before." Audience unclear.
- 1-2: No hook. Cannot articulate why anyone would watch.

### STRUCTURE (Weight: 15%)
Ask: "Does every scene earn its place? Is there momentum?"
- 9-10: RARE. Impeccable. Chinatown, The Usual Suspects level architecture.
- 7-8: Solid three acts. Clear escalation. Minor pacing issues.
- 5-6: Functional but with visible seams. Some saggy sections.
- 3-4: Structural problems hurt the read. Missing beats.
- 1-2: No structure. Events feel random.

### PROTAGONIST (Weight: 15%)
Ask: "Would an A-list actor fight for this role? Clear wants and needs?"
- 9-10: RARE. Unforgettable. Travis Bickle, Clarice Starling, Daniel Plainview level.
- 7-8: Compelling lead with clear goals. Active. Satisfying arc.
- 5-6: Functional. Goals present. Somewhat active. Arc exists.
- 3-4: Passive or unclear. Story happens to them.
- 1-2: No discernible goals. No reason to invest.

### SUPPORTING CAST (Weight: 10%)
Ask: "Do supporting characters feel like real people or plot functions?"
- 9-10: RARE. Ensemble where every character could lead their own film.
- 7-8: Strong distinctions. Actors would lobby for these roles.
- 5-6: Functional. Serve the plot with some distinction.
- 3-4: Interchangeable types. Mechanical purposes.
- 1-2: Indistinguishable or absent.

### DIALOGUE (Weight: 10%)
Ask: "Any quotable lines? Do characters sound distinct? Subtext present?"
- 9-10: RARE. Tarantino, Sorkin, Coen Brothers level. Memorable lines.
- 7-8: Strong voice. Characters distinguishable. Good subtext.
- 5-6: Serviceable. Gets information across.
- 3-4: On-the-nose. Characters explain rather than reveal.
- 1-2: Wooden. All characters sound identical.

### GENRE EXECUTION (Weight: 15%)
Ask: "Does this deliver what genre fans expect? Obligatory scenes present?"
- 9-10: RARE. Defines or redefines the genre. Scream, Die Hard level.
- 7-8: Solid delivery. Obligatory scenes effective. Satisfies fans.
- 5-6: Adequate. Hits beats without distinction.
- 3-4: Missing obligatory scenes. Fans would be disappointed.
- 1-2: Genre confusion. Doesn't understand audience expectations.

### ORIGINALITY (Weight: 15%)
Ask: "Have I seen this exact thing before? Is there a distinctive voice?"
- 9-10: RARE. Announces a singular talent. Charlie Kaufman, Jordan Peele debuts.
- 7-8: Clear voice. Personal stamp on familiar territory.
- 5-6: Competent but not distinctive. Could be written by many.
- 3-4: Derivative. Obvious influences dominate.
- 1-2: Pure imitation. No voice.

═══════════════════════════════════════════════════════════════════════════════
                              CRITICAL FAILURES
═══════════════════════════════════════════════════════════════════════════════

**ANY Critical Failure = AUTOMATIC PASS regardless of scores.**

Look actively for these problems. If present, the screenplay fails:

**Concept Failures:**
□ No discernible hook (cannot articulate premise in one sentence)
□ Audience confusion (cannot identify target demographic)
□ Derivative without elevation (indistinguishable from influences)
□ Tone incoherence (script cannot decide what it is)

**Protagonist Failures:**
□ Passive protagonist (events happen TO them through act 2)
□ Goal absence (cannot identify what they want by page 30)
□ Unearned transformation (changes without adequate pressure)
□ Investment vacuum (no qualities creating audience connection)

**Structural Failures:**
□ Missing engine (no dramatic question sustaining momentum)
□ Second act collapse (pages 30-90 lack progressive complication)
□ Climax deflation (final confrontation underwhelming)
□ Ending betrayal (resolution contradicts story's promise)

**Execution Failures:**
□ Amateur formatting (consistent convention violations)
□ Overwriting (action blocks routinely >4 lines; speeches >5 lines)
□ Unfilmables (heavy reliance on internal states)

═══════════════════════════════════════════════════════════════════════════════
                              VERDICT DETERMINATION
═══════════════════════════════════════════════════════════════════════════════

**Calculate weighted score FIRST:**
(Concept × 0.20) + (Structure × 0.15) + (Protagonist × 0.15) + (Supporting Cast × 0.10) + (Dialogue × 0.10) + (Genre Execution × 0.15) + (Originality × 0.15)

**THEN apply verdict thresholds STRICTLY:**

### PASS (Expected: ~70% of scripts)
Issue PASS if ANY of these are true:
- Weighted Score < 5.5
- ANY Critical Failure present
- Concept < 5
- Protagonist < 4
- THREE or more dimensions < 5
- Problems require page-one rewrite
- CVS < 6

### CONSIDER (Expected: ~25% of scripts)
Requires ALL of:
- Weighted Score 5.5 to 7.4
- Concept >= 6
- No more than TWO dimensions below 5
- Zero Critical Failures
- Clear development path (you can articulate specific fixes)
- Fixable in 1-2 drafts (not a page-one rewrite)

### RECOMMEND (Expected: ~5% of scripts)
**STOP. Before marking RECOMMEND, ask yourself:**
"Is this truly in the top 5% of professional screenplays I've read? Would I stake my reputation on this?"

Requires ALL of:
- Weighted Score >= 7.5
- Concept >= 8 (must be genuinely high-concept)
- NO dimension below 6 (no weak links)
- Protagonist >= 7
- Genre Execution >= 7
- Zero Critical Failures
- Maximum ONE Major Weakness (and it must be minor)
- CVS >= 8

### FILM NOW (Expected: <1% of scripts - maybe 1 per year)
**STOP. FILM NOW is reserved for once-in-a-generation material.**
Ask: "Would I bet my career that this will be remembered in 20 years?"

Requires ALL of:
- Weighted Score >= 8.5
- Concept >= 9 (undeniable, cannot be ignored)
- Protagonist >= 9 (role actors will kill for)
- Originality >= 9 (singular voice announcing major talent)
- ALL dimensions >= 8 (excellence across every aspect)
- Zero Critical Failures
- Zero Major Weaknesses
- CVS >= 15
- Passes Lightning Test (visceral hook in first 10 pages)
- Passes Goosebumps Test (3+ moments of genuine emotional response)
- Passes Career Risk Test (would stake reputation without hesitation)

═══════════════════════════════════════════════════════════════════════════════
                          COMMERCIAL VIABILITY SCORE
═══════════════════════════════════════════════════════════════════════════════

Rate each factor 1-3 (be realistic, not optimistic):

| Factor | 3 pts | 2 pts | 1 pt |
|--------|-------|-------|------|
| Target Audience | Clear theatrical demographic | Identifiable, streaming-friendly | Niche/unclear |
| High Concept | One-sentence pitch sells it | Takes explanation | Requires long pitch |
| Cast Attachability | Multiple star roles | 1-2 attachable | No obvious vehicles |
| Marketing Hook | Clear trailer/poster | Marketable with creativity | Difficult to market |
| Budget/Return Ratio | Low budget, high return potential | Modest concerns | Exceeds ceiling |
| Comparable Success | Recent comps succeeded | Mixed results | No comps or failures |

**CVS INTERPRETATION:**
- 15-18: Strong commercial prospect
- 11-14: Viable with right execution
- 8-10: Commercial concerns
- 6-7: Serious commercial questions

**HARD RULE: CVS < 8 = Cannot RECOMMEND regardless of craft quality**

═══════════════════════════════════════════════════════════════════════════════
                              OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════════

Provide your analysis in this JSON structure:

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
      "justification": "specific evidence from script",
      "weakness_identified": "what prevents higher score (REQUIRED for scores 7+)"
    }},
    "structure": {{
      "score": 1-10,
      "justification": "specific evidence from script",
      "weakness_identified": "what prevents higher score (REQUIRED for scores 7+)"
    }},
    "protagonist": {{
      "score": 1-10,
      "justification": "specific evidence from script",
      "weakness_identified": "what prevents higher score (REQUIRED for scores 7+)"
    }},
    "supporting_cast": {{
      "score": 1-10,
      "justification": "specific evidence from script",
      "weakness_identified": "what prevents higher score (REQUIRED for scores 7+)"
    }},
    "dialogue": {{
      "score": 1-10,
      "justification": "specific evidence from script",
      "weakness_identified": "what prevents higher score (REQUIRED for scores 7+)"
    }},
    "genre_execution": {{
      "score": 1-10,
      "justification": "specific evidence from script",
      "weakness_identified": "what prevents higher score (REQUIRED for scores 7+)"
    }},
    "originality": {{
      "score": 1-10,
      "justification": "specific evidence from script",
      "weakness_identified": "what prevents higher score (REQUIRED for scores 7+)"
    }},
    "weighted_score": "calculated float to 2 decimal places"
  }},

  "calibration_check": {{
    "score_distribution_realistic": "Yes/No - Are your scores consistent with 70% PASS target?",
    "anchoring_applied": "Which reference films did you compare this to?",
    "devil_advocate_applied": "Did you identify weaknesses for all scores 7+?"
  }},

  "critical_failures": ["list any critical failures found, or empty array if none"],
  "major_weaknesses": ["list major weaknesses - be thorough"],

  "commercial_viability": {{
    "target_audience": {{ "score": 1-3, "note": "be realistic" }},
    "high_concept": {{ "score": 1-3, "note": "be realistic" }},
    "cast_attachability": {{ "score": 1-3, "note": "be realistic" }},
    "marketing_hook": {{ "score": 1-3, "note": "be realistic" }},
    "budget_return_ratio": {{ "score": 1-3, "note": "be realistic" }},
    "comparable_success": {{ "score": 1-3, "note": "be realistic" }},
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
    "weaknesses": ["list of specific weaknesses with evidence - be thorough"],
    "development_notes": ["prescriptive suggestions if CONSIDER"],
    "marketability": "high/medium/low",
    "recommendation": "PASS/CONSIDER/RECOMMEND/FILM NOW",
    "recommendation_rationale": "2-3 sentences citing weighted score, critical failures if any, CVS, and which threshold requirements were met or failed"
  }},

  "film_now_assessment": {{
    "qualifies": true/false,
    "lightning_test": "Description of hook in first 10 pages, or why it failed",
    "goosebumps_moments": ["Page X: description"] or [],
    "career_risk_test": "Would you stake your career? Why or why not?",
    "legacy_potential": "Will this be remembered in 20 years?",
    "disqualifying_factors": ["factors preventing FILM NOW"] or []
  }},

  "verdict_statement": "For PASS: 'While [acknowledge strengths], this screenplay [specific problem]. The development investment required exceeds current value.' For CONSIDER: 'This screenplay shows [merits] but requires development to address [issues]. With [specific fixes], could achieve RECOMMEND.' For RECOMMEND: 'Based on [strengths], this demonstrates commercial viability and craft warranting development consideration.' For FILM NOW: 'FILM NOW: [TITLE] represents exceptional material demanding immediate greenlight.'"
}}

═══════════════════════════════════════════════════════════════════════════════
                              FINAL REMINDERS
═══════════════════════════════════════════════════════════════════════════════

1. DEFAULT TO PASS. Make the screenplay earn its way up.
2. A score of 6 is the median for PRODUCED films. Most scripts score lower.
3. RECOMMEND is rare. FILM NOW is exceptional.
4. Identify weaknesses for every dimension scored 7+.
5. Your job security depends on NOT over-recommending.
6. Score BEFORE determining verdict to avoid confirmation bias.

Return ONLY the JSON object, no additional text."""


# Model configuration
CLAUDE_MODELS = {
    'sonnet': 'claude-sonnet-4-20250514',
    'haiku': 'claude-3-5-haiku-20241022',
    'opus': 'claude-opus-4-20250514'
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
        timeout=httpx.Timeout(180.0, connect=10.0),  # 3 min total for longer analysis
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

    logger.info(f"Sending to Claude ({model_name}) for V4 calibrated analysis...")

    try:
        response_text = _call_claude_api(client, prompt, model_name)

        # Parse JSON response
        analysis = json.loads(response_text)
        logger.info(f"✓ Claude ({model_name}) V4 analysis complete")
        return analysis

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Claude response as JSON: {e}")
        # Try to extract JSON from response
        try:
            import re
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                analysis = json.loads(json_match.group())
                logger.warning("Extracted JSON from response with extra text")
                return analysis
        except:
            pass
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
        timeout=httpx.Timeout(180.0, connect=10.0),
        messages=[
            {"role": "system", "content": "You are a skeptical development executive at a major studio. Your job depends on NOT over-recommending scripts. Default to PASS. Always respond with valid JSON only."},
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

    logger.info("Sending to GPT for V4 calibrated analysis...")

    try:
        response_text = _call_openai_api(client, prompt)
        analysis = json.loads(response_text)
        logger.info("✓ GPT V4 analysis complete")
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


def analyze_screenplay(parsed_json_path: Path, model: str = "claude-sonnet", api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Analyze a screenplay from parsed JSON.

    Args:
        parsed_json_path: Path to parsed screenplay JSON
        model: AI model to use ("claude", "claude-haiku", "claude-sonnet", "claude-opus", or "gpt")
        api_key: Optional API key (overrides .env)

    Returns:
        Complete analysis with metadata
    """
    logger.info(f"Analyzing {parsed_json_path.name} with {model} (V4 Calibrated)...")

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
        'analysis_version': 'v4_calibrated',
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
        description='Analyze screenplay using AI (V4 Calibrated Evaluation)'
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
        default='.tmp/analysis_v4',
        help='Directory to save analysis JSON (default: .tmp/analysis_v4)'
    )

    parser.add_argument(
        '--model',
        type=str,
        choices=['claude', 'claude-haiku', 'claude-sonnet', 'claude-opus', 'gpt'],
        default='claude-sonnet',
        help='AI model to use (default: claude-sonnet for better calibration)'
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

        logger.info(f"Found {len(json_files)} file(s) to analyze with V4 Calibrated system")

        # Analyze each screenplay
        successful = 0
        failed = 0

        for json_path in json_files:
            try:
                analysis = analyze_screenplay(json_path, args.model, args.api_key)

                # Save analysis
                output_filename = json_path.stem + '_analysis_v4.json'
                output_path = output_dir / output_filename
                save_analysis(analysis, output_path)

                successful += 1

            except Exception as e:
                logger.error(f"✗ Failed to analyze {json_path.name}: {e}")
                failed += 1

        print(f"\n✓ Analyzed {successful} screenplays (V4 Calibrated)")
        if failed > 0:
            print(f"✗ {failed} analyses failed")

        return 0 if failed == 0 else 1

    except Exception as e:
        logger.error(f"Script failed: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
