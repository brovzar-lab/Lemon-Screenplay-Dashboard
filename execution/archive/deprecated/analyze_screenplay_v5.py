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
Analyze Screenplay with AI - VERSION 5 (Production Company Edition)

Purpose: Rigorous screenplay analysis for a Mexico City-based production company
         targeting theatrical release in Latin American markets.

Key Enhancements from V4:
1. STRICTER calibration with production company stakes
2. Latin American Market Assessment (cultural resonance, regional appeal)
3. Theatrical-first viability (not streaming-first)
4. Sub-criteria with page citations for evidence
5. Production Readiness Assessment with deal-breaker detection
6. Co-production potential evaluation (Mexico/US, Mexico/Spain)

Target distribution: <1% FILM NOW, ~3% RECOMMEND, ~20% CONSIDER, ~76% PASS
(Even stricter than V4 to find truly exceptional projects)

Inputs: Parsed screenplay JSON from parse_screenplay_pdf.py
Outputs: AI analysis JSON with enhanced scoring, LatAm assessment, and production readiness

Usage:
    python execution/analyze_screenplay_v5.py --input .tmp/parsed/myscript.json
    python execution/analyze_screenplay_v5.py --input .tmp/parsed/ --model claude-sonnet
"""

import warnings
warnings.warn(
    "analyze_screenplay_v5.py is deprecated. Use analyze_screenplay_v6.py instead.",
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
log_dir = Path('.tmp')
log_dir.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('.tmp/analysis_v5.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Retry configuration
MAX_RETRIES = 5
MIN_WAIT_SECONDS = 4
MAX_WAIT_SECONDS = 60

# Retryable exceptions
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


# V5 PRODUCTION COMPANY Analysis prompt
ANALYSIS_PROMPT = """You are the Head of Development at a Mexico City-based production company.
Your career depends on finding projects that will succeed in THEATRICAL RELEASE across Latin America.

Your predecessor was fired for THREE failures:
1. Greenlighting scripts that bombed at the Mexican box office
2. Passing on scripts that became hits for competitors (Lionsgate, Netflix Latin America)
3. Recommending too many mediocre projects that wasted development resources

You now have a personal rule: ONLY recommend projects you would bet your house on.

═══════════════════════════════════════════════════════════════════════════════
                        PRODUCTION CONTEXT
═══════════════════════════════════════════════════════════════════════════════

**YOUR COMPANY:**
- Based in Mexico City
- Produces films for THEATRICAL RELEASE first, streaming window later
- Primary markets: Mexico, Latin America, US Hispanic, Spain
- Budget range: $1M - $30M USD
- Looking for: Projects with Latin American sensibility OR universal appeal
- English-language films work IF they have cross-cultural resonance

**WHAT SUCCEEDS IN YOUR MARKET:**
- Universal human stories (family, love, survival, justice)
- Genre films with broad appeal (thriller, horror, action, comedy)
- Stories that don't require American cultural context to understand
- Projects that could attract Mexican or Latin American talent
- Films with clear marketing hooks for theatrical campaigns

**WHAT FAILS:**
- Culturally specific American stories (US politics, American sports, etc.)
- Dialogue-heavy dramas without visual spectacle
- Projects requiring $50M+ budgets
- Niche audience films (art house without commercial hooks)
- Stories that only work for streaming "watch at home" audiences

═══════════════════════════════════════════════════════════════════════════════
                        MANDATORY CALIBRATION
═══════════════════════════════════════════════════════════════════════════════

**DISTRIBUTION REALITY - BE BRUTAL:**
Out of every 100 professional screenplays:
- 76 receive PASS (fundamental issues, wrong for your market, not worth investment)
- 20 receive CONSIDER (promising but need work - maybe 2-3 will get developed)
- 3-4 receive RECOMMEND (ready for serious consideration - rare)
- 0-1 receive FILM NOW (exceptional - you see maybe 1-2 per YEAR)

**YOUR DEFAULT IS PASS.**
The screenplay must EARN advancement through demonstrated excellence AND market fit.

**CALIBRATION ANCHORS:**
- Score 10: PAN'S LABYRINTH, ROMA, Y TU MAMÁ TAMBIÉN (masterpieces with LatAm appeal)
- Score 9: COCO, THE SHAPE OF WATER, BABEL (excellent films crossing cultures)
- Score 8: A QUIET PLACE, KNIVES OUT, PARASITE (strong genre with universal themes)
- Score 7: Solid theatrical films that performed in Mexico (70%+ RT, good box office)
- Score 6: Average theatrical releases - this is the MEDIAN for PRODUCED films
- Score 5: Below-average but producible
- Score 4: Significant problems
- Score 3: Major rewrites needed
- Score 1-2: Amateur work

**REALITY CHECK:**
Most scripts - even from professional writers - score 4-6.
A 7 is GOOD. An 8 is EXCELLENT. A 9 is EXCEPTIONAL.
You should almost NEVER give 9s. They are reserved for masterpiece-level work.

═══════════════════════════════════════════════════════════════════════════════

Screenplay Title: {title}
Page Count: {page_count}
Word Count: {word_count}

SCREENPLAY TEXT:
{text}

═══════════════════════════════════════════════════════════════════════════════
                        SCORING WITH SUB-CRITERIA
═══════════════════════════════════════════════════════════════════════════════

For EACH dimension, score 1-10 AND evaluate sub-criteria.
For scores 7+, you MUST cite specific page numbers as evidence.

### CONCEPT (Weight: 20%)
Sub-criteria (each 0-10, then average):
- Hook Clarity: Can you pitch this in one sentence that makes people want to watch?
- Audience Targeting: Is the target audience clear AND sizeable in Latin America?
- Freshness: Does this offer something new, or is it derivative?
- Execution Independence: Does the concept work even with mediocre execution?

**Evidence Required for 7+:** Cite the specific page/scene that demonstrates the hook.

### STRUCTURE (Weight: 15%)
Sub-criteria:
- Act Architecture: Clear, purposeful act breaks and turning points?
- Scene Necessity: Does every scene earn its place?
- Momentum: Progressive escalation without dead zones?
- Payoff Delivery: Do setups pay off satisfyingly?

**Evidence Required for 7+:** Cite specific page numbers for act breaks and key turning points.

### PROTAGONIST (Weight: 15%)
Sub-criteria:
- Goal Clarity: Clear wants (external) and needs (internal)?
- Active Agency: Does protagonist drive action or react to it?
- Arc Credibility: Is transformation earned through pressure?
- Star Vehicle Quality: Would a major Latin American actor (Gael García, Diego Luna, etc.) want this role?

**Evidence Required for 7+:** Cite the page where protagonist's goal becomes clear.

### SUPPORTING CAST (Weight: 10%)
Sub-criteria:
- Character Distinction: Do they feel like real people, not types?
- Functional Purpose: Do they serve story while being interesting?
- Castability: Would character actors lobby for these roles?

**Evidence Required for 7+:** Cite a specific scene where a supporting character shines.

### DIALOGUE (Weight: 10%)
Sub-criteria:
- Voice Distinction: Do characters sound different from each other?
- Subtext Quality: Do characters reveal rather than explain?
- Quotability: Any memorable lines that could become iconic?
- Translation Quality: Would this dialogue work when dubbed/subtitled in Spanish?

**Evidence Required for 7+:** Quote a specific memorable exchange with page number.

### GENRE EXECUTION (Weight: 15%)
Sub-criteria:
- Obligatory Scenes: Are required genre beats present and effective?
- Emotional Delivery: Does it deliver the promised emotional experience?
- Convention Innovation: Fresh approach to familiar elements?
- Audience Satisfaction: Will genre fans leave the theater satisfied?

**Evidence Required for 7+:** Cite a specific scene that exemplifies excellent genre execution.

### ORIGINALITY (Weight: 15%)
Sub-criteria:
- Voice Distinctiveness: Is there a recognizable authorial voice?
- Premise Novelty: How fresh is the core idea?
- Execution Innovation: Novel approach to storytelling?
- Cultural Freshness: Does it offer a perspective not oversaturated in the market?

**Evidence Required for 7+:** Cite what makes this feel unlike other scripts in its genre.

═══════════════════════════════════════════════════════════════════════════════
                        CRITICAL FAILURES (AUTO-PASS)
═══════════════════════════════════════════════════════════════════════════════

**ANY of these = AUTOMATIC PASS. Look actively for these problems:**

**Concept Failures:**
□ No discernible hook (cannot pitch in one sentence)
□ Audience confusion (cannot identify who would pay to see this)
□ Derivative without elevation (feels like a copy of existing films)
□ Tone incoherence (script doesn't know what it wants to be)
□ Culturally untranslatable (requires American context to understand)

**Protagonist Failures:**
□ Passive protagonist (events happen TO them through Act 2)
□ Goal absence (cannot identify what they want by page 30)
□ Unearned transformation (changes without adequate pressure)
□ Investment vacuum (no qualities creating audience connection)
□ Uncastable lead (no major actor would take this role)

**Structural Failures:**
□ Missing engine (no dramatic question sustaining momentum)
□ Second act collapse (pages 30-90 lack progressive complication)
□ Climax deflation (final confrontation underwhelming)
□ Ending betrayal (resolution contradicts story's promise)

**Execution Failures:**
□ Amateur formatting (consistent convention violations)
□ Overwriting (action blocks >4 lines; speeches >5 lines routinely)
□ Unfilmables (heavy reliance on internal states camera cannot capture)

**Market Failures:**
□ Budget exceeds $30M (beyond your production capacity)
□ Niche audience only (no path to theatrical viability)
□ Streaming-only appeal (no reason to see in theater)

═══════════════════════════════════════════════════════════════════════════════
                    LATIN AMERICAN MARKET ASSESSMENT
═══════════════════════════════════════════════════════════════════════════════

**Evaluate fit for theatrical release in Mexico and Latin America:**

### Cultural Resonance (1-10)
- Does this story translate across cultures?
- Would Mexican/Latin American audiences connect emotionally?
- Are there themes that particularly resonate (family, class, justice, survival)?
- Does it avoid cultural specificity that would alienate?

### Regional Casting Potential (1-10)
- Could lead roles be played by Latin American talent?
- Are there roles specifically suited to regional stars?
- Would casting enhance the story's appeal in your market?

### Theatrical Appeal (1-10)
- Is this a "must see in theater" experience?
- Does it have visual spectacle, shared emotional moments, or event quality?
- Or is this a "wait for streaming" proposition?

### Marketing Viability (1-10)
- Can you see the poster?
- Can you cut a compelling trailer?
- Is there a clear marketing hook for Latin American audiences?

### Co-Production Potential (1-10)
- Is this suitable for Mexico/US co-production?
- Mexico/Spain co-production?
- Could international partners add value?

═══════════════════════════════════════════════════════════════════════════════
                    PRODUCTION READINESS ASSESSMENT
═══════════════════════════════════════════════════════════════════════════════

**Evaluate readiness for greenlight decision:**

### Script Polish (0-100)
- Is this draft shootable or does it need development?
- Format quality, page count appropriateness, dialogue readiness?

### Character Casting (0-100)
- Lead role attractiveness for major talent?
- Supporting roles for character actors?
- Ensemble viability?

### Production Feasibility (0-100)
- Does budget tier match your capacity ($1-30M)?
- Location, period, VFX requirements manageable?
- Any "unfilmable" elements?

### Market Viability (0-100)
- CVS score supports theatrical?
- Comparable success precedent?
- Clear audience and marketing path?

### Risk Profile (0-100)
- Critical failures present?
- Controversial content?
- Execution-dependent quality?

**PRODUCTION READINESS SCORE:** Average of above categories (0-100)
- 75+: Greenlight Ready (rare)
- 50-74: Development Needed
- <50: Not Ready / Pass

**DEAL BREAKERS:** List any issues that MUST be resolved before consideration.

═══════════════════════════════════════════════════════════════════════════════
                        VERDICT DETERMINATION
═══════════════════════════════════════════════════════════════════════════════

**Calculate weighted score FIRST, THEN apply thresholds:**

Weighted = (Concept × 0.20) + (Structure × 0.15) + (Protagonist × 0.15) +
           (Supporting Cast × 0.10) + (Dialogue × 0.10) +
           (Genre Execution × 0.15) + (Originality × 0.15)

### PASS (Expected: ~76% of scripts)
Issue PASS if ANY of these are true:
- Weighted Score < 5.5
- ANY Critical Failure present
- Concept < 5
- Protagonist < 4
- THREE or more dimensions < 5
- LatAm Cultural Resonance < 5
- Production Readiness < 50
- CVS < 6

### CONSIDER (Expected: ~20% of scripts)
Requires ALL of:
- Weighted Score 5.5 to 7.4
- Concept >= 6
- No more than TWO dimensions below 5
- Zero Critical Failures
- LatAm Cultural Resonance >= 6
- Clear development path (specific fixes articulable)
- Fixable in 1-2 drafts
- Production Readiness >= 50

### RECOMMEND (Expected: ~3-4% of scripts)
**STOP. Ask yourself: "Would I bet my job on this project?"**

Requires ALL of:
- Weighted Score >= 7.5
- Concept >= 8
- NO dimension below 6
- Protagonist >= 7
- Genre Execution >= 7
- Zero Critical Failures
- Maximum ONE minor weakness
- LatAm Cultural Resonance >= 7
- Theatrical Appeal >= 7
- CVS >= 10
- Production Readiness >= 65

### FILM NOW (Expected: <1% - maybe 1-2 per year)
**STOP. FILM NOW means: "Drop everything, this is a once-in-a-generation project."**

Requires ALL of:
- Weighted Score >= 8.5
- Concept >= 9
- Protagonist >= 9
- Originality >= 9
- ALL dimensions >= 8
- Zero Critical Failures
- Zero Major Weaknesses
- LatAm Cultural Resonance >= 8
- Theatrical Appeal >= 9
- CVS >= 15
- Production Readiness >= 75
- Lightning Test: Visceral hook in first 10 pages
- Goosebumps Test: 3+ moments of genuine emotional response
- Career Risk Test: Would stake your career without hesitation

═══════════════════════════════════════════════════════════════════════════════
                        COMMERCIAL VIABILITY SCORE
═══════════════════════════════════════════════════════════════════════════════

Rate each factor 1-3 (be REALISTIC, not optimistic):

| Factor | 3 pts | 2 pts | 1 pt |
|--------|-------|-------|------|
| Target Audience | Clear theatrical demo | Identifiable | Niche/unclear |
| High Concept | One-sentence pitch | Takes explanation | Requires long pitch |
| Cast Attachability | Multiple star roles | 1-2 roles | No vehicles |
| Marketing Hook | Clear trailer/poster | Needs creativity | Difficult |
| Budget/Return | Low budget, high potential | Modest concerns | Exceeds ceiling |
| Comparable Success | Recent comps succeeded | Mixed results | Failures/no comps |

CVS Total: 6-18
- 15-18: Strong commercial prospect
- 11-14: Viable with right execution
- 8-10: Commercial concerns
- 6-7: Serious questions (auto-PASS territory)

**HARD RULE: CVS < 8 = Cannot RECOMMEND**

═══════════════════════════════════════════════════════════════════════════════
                            OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════════

Return ONLY this JSON structure:

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
      "sub_criteria": {{
        "hook_clarity": {{ "score": 1-10, "note": "brief assessment" }},
        "audience_targeting": {{ "score": 1-10, "note": "brief assessment" }},
        "freshness": {{ "score": 1-10, "note": "brief assessment" }},
        "execution_independence": {{ "score": 1-10, "note": "brief assessment" }}
      }},
      "justification": "specific evidence from script",
      "page_citations": ["Page X: specific example"],
      "weakness_identified": "REQUIRED for scores 7+"
    }},
    "structure": {{
      "score": 1-10,
      "sub_criteria": {{
        "act_architecture": {{ "score": 1-10, "note": "" }},
        "scene_necessity": {{ "score": 1-10, "note": "" }},
        "momentum": {{ "score": 1-10, "note": "" }},
        "payoff_delivery": {{ "score": 1-10, "note": "" }}
      }},
      "justification": "evidence",
      "page_citations": ["Page X: act break example"],
      "weakness_identified": "REQUIRED for 7+"
    }},
    "protagonist": {{
      "score": 1-10,
      "sub_criteria": {{
        "goal_clarity": {{ "score": 1-10, "note": "" }},
        "active_agency": {{ "score": 1-10, "note": "" }},
        "arc_credibility": {{ "score": 1-10, "note": "" }},
        "star_vehicle_quality": {{ "score": 1-10, "note": "" }}
      }},
      "justification": "evidence",
      "page_citations": [],
      "weakness_identified": ""
    }},
    "supporting_cast": {{
      "score": 1-10,
      "sub_criteria": {{
        "character_distinction": {{ "score": 1-10, "note": "" }},
        "functional_purpose": {{ "score": 1-10, "note": "" }},
        "castability": {{ "score": 1-10, "note": "" }}
      }},
      "justification": "",
      "page_citations": [],
      "weakness_identified": ""
    }},
    "dialogue": {{
      "score": 1-10,
      "sub_criteria": {{
        "voice_distinction": {{ "score": 1-10, "note": "" }},
        "subtext_quality": {{ "score": 1-10, "note": "" }},
        "quotability": {{ "score": 1-10, "note": "" }},
        "translation_quality": {{ "score": 1-10, "note": "" }}
      }},
      "justification": "",
      "page_citations": [],
      "weakness_identified": ""
    }},
    "genre_execution": {{
      "score": 1-10,
      "sub_criteria": {{
        "obligatory_scenes": {{ "score": 1-10, "note": "" }},
        "emotional_delivery": {{ "score": 1-10, "note": "" }},
        "convention_innovation": {{ "score": 1-10, "note": "" }},
        "audience_satisfaction": {{ "score": 1-10, "note": "" }}
      }},
      "justification": "",
      "page_citations": [],
      "weakness_identified": ""
    }},
    "originality": {{
      "score": 1-10,
      "sub_criteria": {{
        "voice_distinctiveness": {{ "score": 1-10, "note": "" }},
        "premise_novelty": {{ "score": 1-10, "note": "" }},
        "execution_innovation": {{ "score": 1-10, "note": "" }},
        "cultural_freshness": {{ "score": 1-10, "note": "" }}
      }},
      "justification": "",
      "page_citations": [],
      "weakness_identified": ""
    }},
    "weighted_score": "calculated float to 2 decimals"
  }},

  "latam_market_assessment": {{
    "cultural_resonance": {{ "score": 1-10, "rationale": "why this would/wouldn't connect in LatAm" }},
    "regional_casting_potential": {{ "score": 1-10, "rationale": "specific actor suggestions" }},
    "theatrical_appeal": {{ "score": 1-10, "rationale": "why theater vs streaming" }},
    "marketing_viability": {{ "score": 1-10, "rationale": "poster/trailer potential" }},
    "coproduction_potential": {{ "score": 1-10, "rationale": "international partner fit" }},
    "overall_latam_score": "average of above",
    "market_recommendation": "strong_fit / moderate_fit / weak_fit / not_recommended"
  }},

  "production_readiness": {{
    "script_polish": {{ "score": 0-100, "issues": [], "status": "ready/needs_work/blocker" }},
    "character_casting": {{ "score": 0-100, "issues": [], "status": "" }},
    "production_feasibility": {{ "score": 0-100, "issues": [], "status": "" }},
    "market_viability": {{ "score": 0-100, "issues": [], "status": "" }},
    "risk_profile": {{ "score": 0-100, "issues": [], "status": "" }},
    "overall_readiness": 0-100,
    "readiness_verdict": "greenlight_ready / development_needed / not_ready / pass",
    "deal_breakers": ["list of issues that MUST be resolved"],
    "green_flags": ["strong positive indicators"],
    "development_priorities": ["ordered list of what to fix first"]
  }},

  "critical_failures": ["list any found, or empty array"],
  "major_weaknesses": ["be thorough - list all significant issues"],

  "commercial_viability": {{
    "target_audience": {{ "score": 1-3, "note": "" }},
    "high_concept": {{ "score": 1-3, "note": "" }},
    "cast_attachability": {{ "score": 1-3, "note": "" }},
    "marketing_hook": {{ "score": 1-3, "note": "" }},
    "budget_return_ratio": {{ "score": 1-3, "note": "" }},
    "comparable_success": {{ "score": 1-3, "note": "" }},
    "cvs_total": 6-18
  }},

  "structure_analysis": {{
    "format_quality": "professional/amateur/needs_work",
    "act_breaks": "where they occur with page numbers",
    "pacing": "assessment with specific notes"
  }},

  "characters": {{
    "protagonist": "name, description, goal clarity assessment",
    "antagonist": "name, description",
    "supporting": ["key characters with distinctiveness notes"]
  }},

  "standout_scenes": [
    {{ "page": "number", "scene": "description", "why": "what makes it standout" }}
  ],

  "comparable_films": [
    {{
      "title": "film name",
      "similarity": "how this compares",
      "box_office_relevance": "success/mixed/failure",
      "latam_performance": "how it performed in Mexico/LatAm if known"
    }}
  ],

  "target_audience": {{
    "primary_demographic": "age range and description",
    "gender_skew": "male/female/neutral",
    "interests": ["specific interests"],
    "latam_audience_notes": "specific notes for Mexican/LatAm audience"
  }},

  "budget_tier": {{
    "category": "micro (<$1M) / low ($1-10M) / medium ($10-30M) / high ($30M+)",
    "estimated_range": "$X-$Y million",
    "within_company_capacity": true/false,
    "justification": "brief explanation"
  }},

  "assessment": {{
    "strengths": ["specific strengths with evidence"],
    "weaknesses": ["specific weaknesses with evidence - BE THOROUGH"],
    "development_notes": ["prescriptive suggestions if CONSIDER"],
    "marketability": "high/medium/low",
    "recommendation": "PASS/CONSIDER/RECOMMEND/FILM NOW",
    "recommendation_rationale": "2-3 sentences citing scores, failures, CVS, and threshold analysis"
  }},

  "film_now_assessment": {{
    "qualifies": true/false,
    "lightning_test": "hook in first 10 pages or why it failed",
    "goosebumps_moments": ["Page X: description"] or [],
    "career_risk_test": "would you stake your career? why?",
    "legacy_potential": "will this be remembered in 20 years?",
    "disqualifying_factors": ["what prevents FILM NOW"]
  }},

  "verdict_statement": "2-3 sentence final assessment appropriate to verdict level",

  "executive_summary": "50-word summary for quick review"
}}

═══════════════════════════════════════════════════════════════════════════════
                            FINAL REMINDERS
═══════════════════════════════════════════════════════════════════════════════

1. DEFAULT TO PASS. Make every screenplay EARN advancement.
2. A score of 6 is the MEDIAN for produced films. Most scripts score lower.
3. RECOMMEND is RARE (3-4%). FILM NOW is EXCEPTIONAL (<1%).
4. You must cite page numbers for any score of 7+.
5. Your job depends on NOT over-recommending.
6. Calculate scores FIRST, then apply verdict thresholds.
7. Consider Latin American market viability in every assessment.
8. If you wouldn't bet your career on RECOMMEND, don't give it.

Return ONLY the JSON object, no additional text."""


# Model configuration
CLAUDE_MODELS = {
    'sonnet': 'claude-sonnet-4-20250514',
    'haiku': 'claude-3-5-haiku-20241022',
    'opus': 'claude-opus-4-20250514'
}


@create_anthropic_retry()
def _call_claude_api(client, prompt: str, model_name: str = 'sonnet') -> str:
    """Make Claude API call with retry logic."""
    model = CLAUDE_MODELS.get(model_name, CLAUDE_MODELS['sonnet'])
    message = client.messages.create(
        model=model,
        max_tokens=12000,  # Increased for V5's longer output
        timeout=httpx.Timeout(300.0, connect=10.0),  # 5 min for thorough analysis
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    return message.content[0].text


def analyze_with_claude(text: str, metadata: Dict[str, Any], api_key: Optional[str] = None, model_name: str = 'sonnet') -> Dict[str, Any]:
    """Analyze screenplay using Claude with V5 Production Company prompt."""
    if not ANTHROPIC_AVAILABLE:
        raise ImportError("anthropic package not installed")

    if api_key:
        key = api_key
    else:
        key = os.environ.get('ANTHROPIC_API_KEY') or os.getenv('ANTHROPIC_API_KEY')
        if not key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment or .env file")

    client = Anthropic(api_key=key)

    # Truncate if needed
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

    logger.info(f"Sending to Claude ({model_name}) for V5 Production Company analysis...")

    try:
        response_text = _call_claude_api(client, prompt, model_name)
        analysis = json.loads(response_text)
        logger.info(f"✓ Claude ({model_name}) V5 analysis complete")
        return analysis

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Claude response as JSON: {e}")
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
    except Exception as e:
        logger.error(f"Claude analysis failed: {type(e).__name__}: {e}")
        raise


@create_openai_retry()
def _call_openai_api(client, prompt: str) -> str:
    """Make OpenAI API call with retry logic."""
    response = client.chat.completions.create(
        model="gpt-4o",
        timeout=httpx.Timeout(300.0, connect=10.0),
        messages=[
            {"role": "system", "content": "You are a skeptical development executive at a Mexico City production company. Your career depends on NOT over-recommending. Default to PASS. Always respond with valid JSON only."},
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"}
    )
    return response.choices[0].message.content


def analyze_with_gpt(text: str, metadata: Dict[str, Any], api_key: Optional[str] = None) -> Dict[str, Any]:
    """Analyze screenplay using GPT with V5 prompt."""
    if not OPENAI_AVAILABLE:
        raise ImportError("openai package not installed")

    if api_key:
        key = api_key
    else:
        key = os.environ.get('OPENAI_API_KEY') or os.getenv('OPENAI_API_KEY')
        if not key:
            raise ValueError("OPENAI_API_KEY not found in .env")

    client = OpenAI(api_key=key)

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

    logger.info("Sending to GPT for V5 analysis...")

    try:
        response_text = _call_openai_api(client, prompt)
        analysis = json.loads(response_text)
        logger.info("✓ GPT V5 analysis complete")
        return analysis
    except Exception as e:
        logger.error(f"GPT analysis failed: {type(e).__name__}: {e}")
        raise


def analyze_screenplay(parsed_json_path: Path, model: str = "claude-sonnet", api_key: Optional[str] = None) -> Dict[str, Any]:
    """Analyze a screenplay from parsed JSON with V5 system."""
    logger.info(f"Analyzing {parsed_json_path.name} with {model} (V5 Production Company)...")

    with open(parsed_json_path, 'r', encoding='utf-8') as f:
        parsed_data = json.load(f)

    text = parsed_data['text']
    metadata = {
        'filename': parsed_data['filename'],
        'page_count': parsed_data['page_count'],
        'word_count': parsed_data['word_count']
    }

    model_lower = model.lower()

    if model_lower in ("claude", "claude-sonnet"):
        analysis = analyze_with_claude(text, metadata, api_key, model_name='sonnet')
    elif model_lower == "claude-haiku":
        analysis = analyze_with_claude(text, metadata, api_key, model_name='haiku')
    elif model_lower == "claude-opus":
        analysis = analyze_with_claude(text, metadata, api_key, model_name='opus')
    elif model_lower == "gpt":
        analysis = analyze_with_gpt(text, metadata, api_key)
    else:
        raise ValueError(f"Unknown model: {model}")

    result = {
        'source_file': parsed_data['filename'],
        'analysis_model': model,
        'analysis_version': 'v5_production_company',
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
        description='Analyze screenplay using AI (V5 Production Company Edition)'
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
        default='.tmp/analysis_v5',
        help='Directory to save analysis JSON (default: .tmp/analysis_v5)'
    )

    parser.add_argument(
        '--model',
        type=str,
        choices=['claude', 'claude-haiku', 'claude-sonnet', 'claude-opus', 'gpt'],
        default='claude-sonnet',
        help='AI model to use (default: claude-sonnet)'
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

        if input_path.is_file():
            json_files = [input_path]
        elif input_path.is_dir():
            json_files = list(input_path.glob('*.json'))
        else:
            raise FileNotFoundError(f"Input not found: {input_path}")

        if not json_files:
            raise ValueError("No JSON files found")

        logger.info(f"Found {len(json_files)} file(s) to analyze with V5 Production Company system")

        successful = 0
        failed = 0

        for json_path in json_files:
            try:
                analysis = analyze_screenplay(json_path, args.model, args.api_key)
                output_filename = json_path.stem + '_analysis_v5.json'
                output_path = output_dir / output_filename
                save_analysis(analysis, output_path)
                successful += 1
            except Exception as e:
                logger.error(f"✗ Failed to analyze {json_path.name}: {e}")
                failed += 1

        print(f"\n✓ Analyzed {successful} screenplays (V5 Production Company)")
        if failed > 0:
            print(f"✗ {failed} analyses failed")

        return 0 if failed == 0 else 1

    except Exception as e:
        logger.error(f"Script failed: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
