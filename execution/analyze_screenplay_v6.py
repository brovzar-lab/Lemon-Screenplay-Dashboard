#!/usr/bin/env python3
"""
Analyze Screenplay with AI - VERSION 6 (Unified: V5 Depth + V6 Architecture)

Purpose: Rigorous screenplay analysis for a Mexico City-based production company
         using a Core + Lenses architecture that separates CRAFT QUALITY from
         MARKET/PRODUCTION factors.

This unified V6 combines:
- V5's thorough sub-criteria, calibration standards, and production company context
- V6's Core + Lenses architecture (market factors don't contaminate quality score)
- V6's False Positive Trap Detection
- V6's Execution-First Weighting
- V5's Production Readiness Assessment (as a lens)
- V5's detailed critical failures and page citation requirements

Key Principles:
1. Core Quality Score is NEVER influenced by market, budget, or regional factors
2. Execution-First Weights: 40% Execution, 30% Character, 20% Concept, 10% Voice
3. Optional Lenses: LatAm, Commercial, Budget, Production Readiness, Co-Production
4. False Positive Trap Detection: 6 traps that catch inflated scores
5. V5's strict calibration anchors (Pan's Labyrinth = 10, MEDIAN produced = 6)

Target distribution: <1% FILM NOW, ~3% RECOMMEND, ~20% CONSIDER, ~76% PASS

Usage:
    # Pure quality analysis (default)
    python execution/analyze_screenplay_v6.py --input script.json

    # With specific lenses
    python execution/analyze_screenplay_v6.py --input script.json --lens latam --lens commercial

    # With all lenses (recommended for full production assessment)
    python execution/analyze_screenplay_v6.py --input script.json --all-lenses

    # Custom budget ceiling
    python execution/analyze_screenplay_v6.py --input script.json --lens budget --budget-ceiling 15
"""

import argparse
import json
import logging
import sys
import os
from pathlib import Path
from typing import Dict, Any, Optional, List
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

load_dotenv()

# Configure logging
log_dir = Path('.tmp')
log_dir.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('.tmp/analysis_v6.log'),
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


def create_anthropic_retry():
    """Create retry decorator for Anthropic API calls."""
    return retry(
        retry=retry_if_exception_type(ANTHROPIC_RETRYABLE),
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=2, min=MIN_WAIT_SECONDS, max=MAX_WAIT_SECONDS),
        before_sleep=before_sleep_log(logger, logging.WARNING),
        reraise=True
    )


# =============================================================================
# V6 UNIFIED CORE QUALITY PROMPT (V5 Depth + V6 Architecture)
# =============================================================================

CORE_QUALITY_PROMPT = """You are a screenplay analyst evaluating CRAFT AND EXECUTION QUALITY.

Your analysis must be RIGOROUS and PROFESSIONAL. You've analyzed thousands of scripts
and understand that most professional screenplays score 4-6. A 7 is genuinely good.
An 8 is exceptional. 9s are almost never given.

═══════════════════════════════════════════════════════════════════════════════
                        CRITICAL INSTRUCTION
═══════════════════════════════════════════════════════════════════════════════

You are evaluating the screenplay's quality as a PIECE OF WRITING.
This analysis measures CRAFT AND EXECUTION only.

Do NOT let these factors influence your quality scores:
- Market fit or commercial potential
- Budget requirements or constraints
- Regional/cultural market appeal
- Production feasibility
- Whether it would succeed at box office

Your ONLY question: "Is this screenplay well-executed as a craft?"
(Market and production factors are evaluated separately in optional lenses.)

═══════════════════════════════════════════════════════════════════════════════
                        MANDATORY CALIBRATION STANDARDS
═══════════════════════════════════════════════════════════════════════════════

**SCORE ANCHORS (What each score ACTUALLY means):**

- Score 10: PAN'S LABYRINTH, CHINATOWN, NETWORK (masterpieces studied in film schools)
           Flawless craft. Every scene necessary. Zero wasted moments.
           You might score ONE script per year at this level.

- Score 9: JUNO, GET OUT, ROMA, THE SHAPE OF WATER (exceptional craft with distinctive voice)
           Near-perfect execution. Memorable in every dimension.
           You give this to maybe 2-3 scripts per year.

- Score 8: A QUIET PLACE, KNIVES OUT, ARRIVAL, PARASITE (excellent execution)
           Strong craft across all dimensions. Would stake your reputation on this.
           Top 5% of professional work.

- Score 7: Solid produced films (70%+ RT, good reviews)
           Clear strengths, minor weaknesses. This is genuinely GOOD.
           Top 15% of professional screenplays.

- Score 6: Average for PRODUCED films - this is the MEDIAN
           Meets professional standards. Workable but unremarkable.
           Many produced films score here.

- Score 5: Below-average but producible
           Clear craft issues but fundamentals present.

- Score 4: Significant problems across dimensions
           Would need substantial rewrite.

- Score 3: Major rewrites needed
           Core concept may have potential but execution fails.

- Score 1-2: Amateur work
           Fundamental misunderstanding of screenwriting craft.

**REALITY CHECK:**
Most professional scripts score 4-6. Your DEFAULT assumption is that a script
is average (5-6) until it PROVES otherwise with specific evidence.
If you're giving more than 20% of scripts scores of 7+, you're being too generous.

═══════════════════════════════════════════════════════════════════════════════
                    V6 EXECUTION-FIRST SCORING SYSTEM
═══════════════════════════════════════════════════════════════════════════════

Weight distribution PRIORITIZES EXECUTION over CONCEPT (because a great concept
with poor execution fails, but strong execution elevates a simple concept):

### EXECUTION CRAFT (40% of total score)

**Structure (15%)**
Sub-criteria (score each 1-10, average for dimension score):
- Act Architecture: Clear, purposeful act breaks and turning points?
- Scene Necessity: Does EVERY scene earn its place? Could any be cut without loss?
- Momentum: Progressive escalation without dead zones or repetitive beats?
- Payoff Delivery: Do ALL setups pay off satisfyingly? Any Chekhov's guns unfired?

**Evidence Required for 7+:** Cite specific page numbers for act breaks, major turning points.
**Weakness Required for 7+:** Even excellent scripts have weaknesses. Identify the weak spot.

**Scene-Writing (15%)**
Sub-criteria:
- Scene Construction: Clear entry/exit, conflict, and change in EACH scene?
- Visual Storytelling: Does the script think in IMAGES, not just dialogue?
- Economy: Maximum impact with minimum elements? No overwriting?
- Transitions: Smooth scene-to-scene flow? Purpose to each cut?

**Evidence Required for 7+:** Cite a specific scene that exemplifies strong craft.

**Dialogue (10%)**
Sub-criteria:
- Voice Distinction: Do characters sound DIFFERENT from each other? Cover names test?
- Subtext Quality: Do characters REVEAL rather than EXPLAIN? What's unsaid?
- Functionality: Does dialogue advance BOTH plot AND character simultaneously?
- Speakability: Does it sound natural spoken aloud? Or literary/stilted?

**Evidence Required for 7+:** Quote a specific memorable exchange with page number.

═══════════════════════════════════════════════════════════════════════════════

### CHARACTER SYSTEM (30% of total score)

**Protagonist (15%)**
Sub-criteria:
- Goal Clarity: Clear external WANT and internal NEED by page 30?
- Active Agency: Does protagonist DRIVE action or merely REACT to events?
- Arc Credibility: Is transformation EARNED through escalating pressure?
- Investment Qualities: What makes audience ROOT for this character?

**Evidence Required for 7+:** Cite the page where protagonist's goal becomes unmistakably clear.

**Supporting Cast (10%)**
Sub-criteria:
- Character Distinction: Do they feel like REAL PEOPLE, not types or functions?
- Functional Purpose: Do they serve story WHILE being interesting individuals?
- Ensemble Balance: Does the cast work as a SYSTEM? Thematic echoes?

**Evidence Required for 7+:** Cite a specific scene where a supporting character shines independently.

**Relationships (5%)**
Sub-criteria:
- Relationship Dynamics: Clear power dynamics that EVOLVE?
- Conflict Generation: Do relationships CREATE meaningful story tension?
- Emotional Stakes: Are relationship outcomes things we genuinely CARE about?

═══════════════════════════════════════════════════════════════════════════════

### CONCEPTUAL STRENGTH (20% of total score)

**Premise (10%)**
Sub-criteria:
- Hook Clarity: Can you pitch this in ONE compelling sentence?
- Narrative Engine: Does the premise GENERATE story naturally? Built-in conflict?
- Freshness: Is this a NEW take or clearly derivative of existing films?
- Execution Independence: Would this concept work even with average execution?

**Theme (10%)**
Sub-criteria:
- Thematic Clarity: Is there a discernible thematic ARGUMENT (not just topic)?
- Organic Integration: Does theme EMERGE from story, or is it lectured?
- Complexity: Is theme NUANCED, not simplistic good vs. evil?
- Resonance: Does theme connect to UNIVERSAL human experience?

═══════════════════════════════════════════════════════════════════════════════

### VOICE & TONE (10% of total score)

Sub-criteria:
- Authorial Voice: Is there a DISTINCTIVE writer's perspective? Could be only one author?
- Tonal Consistency: Does the script MAINTAIN its intended tone throughout?
- Genre Awareness: Does it understand its genre's CONVENTIONS (and break them purposefully)?
- Confidence: Does the writing feel ASSURED, or uncertain of what it wants to be?

═══════════════════════════════════════════════════════════════════════════════
                    CRITICAL FAILURES (AUTO-PASS TRIGGERS)
═══════════════════════════════════════════════════════════════════════════════

**ANY of these = AUTOMATIC PASS regardless of other scores.**
Look ACTIVELY for these problems. Most scripts have at least one.

**Structural Failures:**
□ No discernible dramatic question by page 30
□ Second act collapse (pages 30-90 lack progressive complication - just "stuff happens")
□ Climax deflation (final confrontation underwhelms after the buildup)
□ Ending betrayal (resolution contradicts the story's implicit promise)
□ Missing engine (no central conflict sustaining momentum)

**Character Failures:**
□ Passive protagonist (events happen TO them through Act 2 - they don't drive action)
□ Goal absence (cannot identify what protagonist WANTS by page 30)
□ Unearned transformation (character changes without adequate pressure/catalyst)
□ Investment vacuum (no qualities creating audience connection - we don't care)

**Execution Failures:**
□ Amateur formatting (consistent convention violations, wrong margins, no sluglines)
□ Overwriting (action blocks >4 lines; speeches >5 lines ROUTINELY, not occasionally)
□ Unfilmables (heavy reliance on internal states camera cannot capture)
□ Tone incoherence (script doesn't know what it wants to be - comedy? drama? satire?)

═══════════════════════════════════════════════════════════════════════════════
                    FALSE POSITIVE TRAP DETECTION
═══════════════════════════════════════════════════════════════════════════════

After scoring, CHECK FOR THESE TRAPS that indicate potentially INFLATED scores:

**TRAP 1: "Premise > Execution" Gap**
- Check: Is Premise score > Execution Craft average by 2+ points?
- Risk: Attractive premise MASKING weak craft
- Test: If you hadn't read the logline, would the pages still be compelling?

**TRAP 2: "First Act Illusion"**
- Check: Is the first 30 pages notably STRONGER than pages 30-90?
- Risk: Strong setup with weak follow-through (common in amateur scripts)
- Test: Is Act 2 as engaging as Act 1? Is Act 3 as strong as the opening?

**TRAP 3: "Character Vacuum"**
- Check: Is Structure score > Character System average by 2+ points?
- Risk: Plot mechanics working without emotional investment
- Test: Do you GENUINELY care what happens to these people? Would you think about them later?

**TRAP 4: "Dialogue Disguise"**
- Check: Is Dialogue score > Scene-Writing score by 2+ points?
- Risk: Witty/stylish dialogue HIDING weak scene construction
- Test: Would scenes work on MUTE? Read only action blocks - still compelling?

**TRAP 5: "Complexity Theater"**
- Check: Is Theme Complexity 8+ but Theme Clarity < 6?
- Risk: Pretending ambiguity is depth (when actually it's confusion)
- Test: Can you articulate the thematic argument in ONE sentence?

**TRAP 6: "Originality Inflation"**
- Check: Is Voice & Tone > 8 but Premise Freshness < 6?
- Risk: Stylish packaging of DERIVATIVE content
- Test: Remove the style - is the underlying STORY still compelling?

═══════════════════════════════════════════════════════════════════════════════
                    VERDICT DETERMINATION (QUALITY-ONLY)
═══════════════════════════════════════════════════════════════════════════════

Calculate weighted score using V6 execution-first weights:

**Weighted Score Calculation:**
Execution Craft = (Structure × 0.375) + (Scene-Writing × 0.375) + (Dialogue × 0.25)
Character System = (Protagonist × 0.50) + (Supporting Cast × 0.333) + (Relationships × 0.167)
Conceptual Strength = (Premise × 0.50) + (Theme × 0.50)

FINAL WEIGHTED = (Execution × 0.40) + (Character × 0.30) +
                 (Concept × 0.20) + (Voice & Tone × 0.10)

═══════════════════════════════════════════════════════════════════════════════

### PASS (Expected: ~76% of scripts)
Issue PASS if ANY of these are true:
- Weighted Score < 5.5
- ANY Critical Failure present
- Protagonist score < 4
- THREE or more sub-dimensions < 5
- Premise score < 4

### CONSIDER (Expected: ~20% of scripts)
Requires ALL of:
- Weighted Score 5.5 to 7.4
- Premise score >= 6
- Zero Critical Failures
- No more than TWO sub-dimensions below 5
- Clear development path identifiable (what specifically would fix it?)

### RECOMMEND (Expected: ~3-4% of scripts)
**STOP. Ask yourself: "Would I stake my professional reputation on this?"**

Requires ALL of:
- Weighted Score >= 7.5
- Premise score >= 8
- Protagonist >= 7
- NO sub-dimension below 6
- Zero Critical Failures
- Maximum ONE major weakness (identify it)

### FILM NOW (Expected: <1% of scripts - maybe 1-2 per YEAR)
**STOP. FILM NOW means: "This is exceptional. Drop everything."**

Requires ALL of:
- Weighted Score >= 8.5
- ALL major dimensions >= 8
- Protagonist >= 9
- Voice & Tone >= 9
- Zero Critical Failures
- Zero Major Weaknesses
- Lightning Test: Visceral hook in first 10 pages that makes you UNABLE to stop reading
- Goosebumps Test: 3+ moments of genuine emotional response while reading

═══════════════════════════════════════════════════════════════════════════════

**VERDICT ADJUSTMENT FOR FALSE POSITIVES:**
- 0 traps triggered: No adjustment
- 1 trap triggered: Flag as "moderate risk" - reviewer should verify
- 2 traps triggered: DOWNGRADE recommendation by ONE tier
- 3+ traps triggered: MAXIMUM recommendation is CONSIDER (regardless of scores)

═══════════════════════════════════════════════════════════════════════════════

Screenplay Title: {title}
Page Count: {page_count}
Word Count: {word_count}

SCREENPLAY TEXT:
{text}

═══════════════════════════════════════════════════════════════════════════════
                            OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════════

Return ONLY this JSON structure:

{{
  "title": "extracted or inferred title",
  "author": "author name if mentioned, otherwise 'Unknown'",
  "logline": "one-sentence premise (25-40 words) - must be compelling pitch",
  "genre": "primary genre",
  "subgenres": ["list", "of", "subgenres"],
  "themes": ["major", "themes", "explored"],
  "tone": "overall tone description",

  "core_quality": {{
    "execution_craft": {{
      "score": 0.0,
      "structure": {{
        "score": 1-10,
        "sub_criteria": {{
          "act_architecture": {{ "score": 1-10, "note": "specific assessment" }},
          "scene_necessity": {{ "score": 1-10, "note": "specific assessment" }},
          "momentum": {{ "score": 1-10, "note": "specific assessment" }},
          "payoff_delivery": {{ "score": 1-10, "note": "specific assessment" }}
        }},
        "justification": "specific evidence from script",
        "page_citations": ["Page X: specific example", "Page Y: turning point"],
        "weakness_identified": "REQUIRED even for 7+ scores - what's the weak spot?"
      }},
      "scene_writing": {{
        "score": 1-10,
        "sub_criteria": {{
          "scene_construction": {{ "score": 1-10, "note": "" }},
          "visual_storytelling": {{ "score": 1-10, "note": "" }},
          "economy": {{ "score": 1-10, "note": "" }},
          "transitions": {{ "score": 1-10, "note": "" }}
        }},
        "justification": "evidence with specific scenes cited",
        "page_citations": ["Page X: standout scene example"],
        "weakness_identified": ""
      }},
      "dialogue": {{
        "score": 1-10,
        "sub_criteria": {{
          "voice_distinction": {{ "score": 1-10, "note": "" }},
          "subtext_quality": {{ "score": 1-10, "note": "" }},
          "functionality": {{ "score": 1-10, "note": "" }},
          "speakability": {{ "score": 1-10, "note": "" }}
        }},
        "justification": "evidence with specific dialogue cited",
        "page_citations": ["Page X: memorable exchange"],
        "weakness_identified": ""
      }}
    }},

    "character_system": {{
      "score": 0.0,
      "protagonist": {{
        "score": 1-10,
        "sub_criteria": {{
          "goal_clarity": {{ "score": 1-10, "note": "" }},
          "active_agency": {{ "score": 1-10, "note": "" }},
          "arc_credibility": {{ "score": 1-10, "note": "" }},
          "investment": {{ "score": 1-10, "note": "what makes us root for them?" }}
        }},
        "justification": "specific evidence",
        "page_citations": ["Page X: goal established"],
        "weakness_identified": ""
      }},
      "supporting_cast": {{
        "score": 1-10,
        "sub_criteria": {{
          "character_distinction": {{ "score": 1-10, "note": "" }},
          "functional_purpose": {{ "score": 1-10, "note": "" }},
          "ensemble_balance": {{ "score": 1-10, "note": "" }}
        }},
        "justification": "",
        "page_citations": [],
        "weakness_identified": ""
      }},
      "relationships": {{
        "score": 1-10,
        "sub_criteria": {{
          "relationship_dynamics": {{ "score": 1-10, "note": "" }},
          "conflict_generation": {{ "score": 1-10, "note": "" }},
          "emotional_stakes": {{ "score": 1-10, "note": "" }}
        }},
        "justification": ""
      }}
    }},

    "conceptual_strength": {{
      "score": 0.0,
      "premise": {{
        "score": 1-10,
        "sub_criteria": {{
          "hook_clarity": {{ "score": 1-10, "note": "" }},
          "narrative_engine": {{ "score": 1-10, "note": "" }},
          "freshness": {{ "score": 1-10, "note": "" }},
          "execution_independence": {{ "score": 1-10, "note": "" }}
        }},
        "justification": "",
        "page_citations": []
      }},
      "theme": {{
        "score": 1-10,
        "sub_criteria": {{
          "thematic_clarity": {{ "score": 1-10, "note": "" }},
          "organic_integration": {{ "score": 1-10, "note": "" }},
          "complexity": {{ "score": 1-10, "note": "" }},
          "resonance": {{ "score": 1-10, "note": "" }}
        }},
        "justification": ""
      }}
    }},

    "voice_and_tone": {{
      "score": 1-10,
      "sub_criteria": {{
        "authorial_voice": {{ "score": 1-10, "note": "" }},
        "tonal_consistency": {{ "score": 1-10, "note": "" }},
        "genre_awareness": {{ "score": 1-10, "note": "" }},
        "confidence": {{ "score": 1-10, "note": "" }}
      }},
      "justification": ""
    }},

    "weighted_score": 0.00,

    "false_positive_check": {{
      "traps_evaluated": [
        {{
          "name": "premise_execution_gap",
          "triggered": true/false,
          "premise_score": X,
          "execution_average": X.X,
          "gap": X.X,
          "assessment": "detailed analysis of the gap"
        }},
        {{
          "name": "first_act_illusion",
          "triggered": true/false,
          "first_act_quality": "assessment",
          "later_acts_quality": "assessment",
          "assessment": "comparison"
        }},
        {{
          "name": "character_vacuum",
          "triggered": true/false,
          "structure_score": X,
          "character_average": X.X,
          "gap": X.X,
          "assessment": "do we genuinely care about these characters?"
        }},
        {{
          "name": "dialogue_disguise",
          "triggered": true/false,
          "dialogue_score": X,
          "scene_writing_score": X,
          "gap": X,
          "assessment": "do scenes work on mute?"
        }},
        {{
          "name": "complexity_theater",
          "triggered": true/false,
          "theme_complexity": X,
          "theme_clarity": X,
          "assessment": "can theme be articulated in one sentence?"
        }},
        {{
          "name": "originality_inflation",
          "triggered": true/false,
          "voice_score": X,
          "premise_freshness": X,
          "assessment": "is underlying story compelling without style?"
        }}
      ],
      "traps_triggered_count": 0,
      "risk_level": "low/moderate/high/critical",
      "verdict_adjustment": "none/downgrade_one_tier/cap_at_consider",
      "adjusted_verdict": "PASS/CONSIDER/RECOMMEND/FILM_NOW",
      "adjustment_rationale": "explanation if adjustment made"
    }},

    "critical_failures": ["list any found - be thorough, or empty array if none"],
    "major_weaknesses": ["list ALL significant issues - even good scripts have these"],

    "verdict": "PASS/CONSIDER/RECOMMEND/FILM_NOW",
    "verdict_rationale": "2-3 sentences explaining verdict based on scores, thresholds, and specific evidence"
  }},

  "characters": {{
    "protagonist": "name, description, goal, what makes them compelling (or not)",
    "antagonist": "name, description (or 'No clear antagonist - story is X type')",
    "supporting": ["key characters with brief distinctive notes"]
  }},

  "structure_analysis": {{
    "format_quality": "professional/amateur/needs_work",
    "act_breaks": "Act 1 ends page X (event), Act 2 ends page Y (event)",
    "pacing": "detailed assessment with specific notes about any slow sections"
  }},

  "standout_scenes": [
    {{ "page": "number", "scene": "brief description", "why": "what makes it exceptional" }}
  ],

  "comparable_films": [
    {{
      "title": "film name",
      "similarity": "specific comparison point",
      "quality_comparison": "better/similar/weaker craft than this script"
    }}
  ],

  "assessment": {{
    "strengths": ["specific strengths with page/scene evidence"],
    "weaknesses": ["specific weaknesses with evidence - BE THOROUGH"],
    "development_notes": ["prescriptive suggestions if CONSIDER/RECOMMEND - what specifically would improve it?"]
  }},

  "executive_summary": "50-word summary focusing on craft quality and key verdict drivers"
}}

═══════════════════════════════════════════════════════════════════════════════
                            FINAL REMINDERS
═══════════════════════════════════════════════════════════════════════════════

1. DEFAULT TO PASS. Every screenplay must EARN advancement through demonstrated craft.
2. Score 6 = MEDIAN for produced films. Most professional scripts score BELOW this.
3. RECOMMEND is RARE (3-4%). FILM NOW is EXCEPTIONAL (<1% - maybe 1-2 per year).
4. You MUST cite page numbers for any score of 7+. No citations = score inflation.
5. Calculate scores FIRST, then apply thresholds, then check false positive traps.
6. Do NOT let market/budget/regional factors influence quality scores.
7. IDENTIFY WEAKNESSES even in good scripts. Perfect scripts don't exist.
8. If false positive traps trigger, apply adjustment AFTER initial verdict.

Return ONLY the JSON object, no additional text before or after."""


# =============================================================================
# LENS PROMPT SECTIONS (Detailed V5-style assessments)
# =============================================================================

LATAM_LENS_PROMPT = """
═══════════════════════════════════════════════════════════════════════════════
                    LENS: LATIN AMERICAN MARKET FIT
═══════════════════════════════════════════════════════════════════════════════

**THIS IS INFORMATIONAL ONLY - IT DOES NOT AFFECT THE CORE QUALITY VERDICT.**

Context: Evaluating for a Mexico City-based production company targeting
theatrical release in Mexico, Latin America, US Hispanic markets, and Spain.

### Cultural Resonance (1-10)
- Does this story translate across cultures?
- Would Mexican/Latin American audiences connect EMOTIONALLY?
- Are there themes that particularly resonate in LatAm (family bonds, class struggle, justice, survival, honor)?
- Does it avoid cultural specificity that would alienate (US-specific politics, American sports, etc.)?
- Would audiences in Mexico City, Buenos Aires, and Bogotá all understand this story?

### Regional Casting Potential (1-10)
- Could lead roles be played by Latin American talent?
- Are there roles suited to regional stars (Gael García Bernal, Diego Luna, Yalitza Aparicio, etc.)?
- Would regional casting ENHANCE the story's authenticity and appeal?
- Are there strong female roles that would attract top Latina actresses?

### Theatrical Appeal (1-10)
- Is this a "must see in theater" experience or "wait for streaming"?
- Does it have visual spectacle that benefits from big screen?
- Shared emotional moments that work best with audience (horror, comedy, crowd-pleasers)?
- Event quality that justifies leaving home?

### Marketing Viability (1-10)
- Can you SEE the poster? What's the image?
- Can you cut a compelling 2-minute trailer?
- Is there a clear marketing hook for Latin American audiences?
- One-sentence pitch that would work in Spanish?

### Co-Production Potential (1-10)
- Suitable for Mexico/US co-production?
- Mexico/Spain co-production (access to European markets)?
- Could international partners add value without diluting story?
- Elements that would attract IMCINE, INCAA, or European fund support?

Output in "lenses.latam_market":
{{
  "enabled": true,
  "assessment": {{
    "cultural_resonance": {{ "score": 1-10, "rationale": "why this would/wouldn't connect emotionally" }},
    "regional_casting_potential": {{ "score": 1-10, "rationale": "specific actor suggestions and fit" }},
    "theatrical_appeal": {{ "score": 1-10, "rationale": "why theater vs streaming for this audience" }},
    "marketing_viability": {{ "score": 1-10, "rationale": "poster/trailer concept, marketing hook" }},
    "coproduction_potential": {{ "score": 1-10, "rationale": "international partner fit, treaty opportunities" }},
    "overall_latam_score": X.X,
    "market_fit_classification": "universal_appeal/english_speaking_ok/latam_specific/niche_arthouse",
    "recommendation": "strong_fit/moderate_fit/weak_fit/not_recommended",
    "specific_concerns": ["list any cultural barriers or market challenges"],
    "opportunities": ["list specific opportunities for LatAm market"]
  }}
}}
"""

COMMERCIAL_LENS_PROMPT = """
═══════════════════════════════════════════════════════════════════════════════
                    LENS: COMMERCIAL VIABILITY SCORE (CVS)
═══════════════════════════════════════════════════════════════════════════════

**THIS IS INFORMATIONAL ONLY - IT DOES NOT AFFECT THE CORE QUALITY VERDICT.**

Rate each factor 1-3 (be REALISTIC, not optimistic):

| Factor | 3 pts | 2 pts | 1 pt |
|--------|-------|-------|------|
| Target Audience | Clear theatrical demographic, sizeable | Identifiable but smaller | Niche/unclear audience |
| High Concept | Pitch in one sentence, immediately compelling | Takes some explanation | Requires long setup |
| Cast Attachability | Multiple star vehicle roles | 1-2 attachable roles | No obvious star vehicles |
| Marketing Hook | Clear trailer/poster, easy campaign | Needs creative marketing | Difficult to market |
| Budget/Return | Low risk, high upside | Modest risk concerns | Significant financial risk |
| Comparable Success | Recent comps succeeded commercially | Mixed track record | Similar films failed |

**CVS SCALE:**
- 15-18: Strong commercial prospect (greenlight territory)
- 11-14: Viable with right execution and cast
- 8-10: Commercial concerns to address
- 6-7: Significant commercial challenges

Output in "lenses.commercial_viability":
{{
  "enabled": true,
  "assessment": {{
    "target_audience": {{ "score": 1-3, "note": "who specifically and market size" }},
    "high_concept": {{ "score": 1-3, "note": "the one-sentence pitch" }},
    "cast_attachability": {{ "score": 1-3, "note": "which roles, which tier of actors" }},
    "marketing_hook": {{ "score": 1-3, "note": "trailer concept, poster image" }},
    "budget_return_ratio": {{ "score": 1-3, "note": "financial risk assessment" }},
    "comparable_success": {{ "score": 1-3, "note": "specific comps and their performance" }},
    "cvs_total": 6-18,
    "commercial_outlook": "strong/viable/challenging/difficult",
    "box_office_ceiling": "estimated domestic ceiling range",
    "key_commercial_strengths": ["list"],
    "key_commercial_concerns": ["list"]
  }}
}}
"""

BUDGET_LENS_PROMPT = """
═══════════════════════════════════════════════════════════════════════════════
                    LENS: BUDGET TIER ASSESSMENT
═══════════════════════════════════════════════════════════════════════════════

**THIS IS INFORMATIONAL ONLY - IT DOES NOT AFFECT THE CORE QUALITY VERDICT.**

Production Budget Ceiling: ${budget_ceiling}M USD

Estimate production budget based on:
- Location requirements (studio vs practical, domestic vs international)
- Period vs contemporary setting
- VFX/stunts/action scope and complexity
- Cast size and likely star power requirements
- Props/costumes/art department needs
- Special equipment (underwater, aerial, etc.)

**BUDGET TIERS:**
- Micro: <$1M (Contained single location, minimal cast, contemporary)
- Low: $1-10M (Standard indie production, practical locations)
- Medium: $10-30M (Moderate scale, some set builds, limited VFX)
- High: $30M+ (Major production requirements, significant VFX/action)

Output in "lenses.budget_tier":
{{
  "enabled": true,
  "ceiling_used": {budget_ceiling}000000,
  "assessment": {{
    "estimated_budget_low": X000000,
    "estimated_budget_high": X000000,
    "category": "micro/low/medium/high",
    "within_ceiling": true/false,
    "key_cost_drivers": [
      "Cost driver 1 with estimated range",
      "Cost driver 2 with estimated range"
    ],
    "potential_savings": [
      "Way to reduce cost 1",
      "Way to reduce cost 2"
    ],
    "production_complexity": "low/medium/high/very_high",
    "location_requirements": "description of key locations",
    "vfx_requirements": "none/minimal/moderate/extensive",
    "period_considerations": "contemporary/recent_period/historical",
    "justification": "detailed explanation of budget estimate"
  }}
}}
"""

PRODUCTION_READINESS_LENS_PROMPT = """
═══════════════════════════════════════════════════════════════════════════════
                    LENS: PRODUCTION READINESS ASSESSMENT
═══════════════════════════════════════════════════════════════════════════════

**THIS IS INFORMATIONAL ONLY - IT DOES NOT AFFECT THE CORE QUALITY VERDICT.**

Evaluate readiness for a greenlight decision.

### Script Polish (0-100)
- Is this draft SHOOTABLE or does it need development passes?
- Format quality, page count appropriateness?
- Dialogue ready for actors or needs work?
- Action lines clear for production departments?

### Character Casting (0-100)
- Lead role attractiveness for major talent?
- Supporting roles attractive for character actors?
- Ensemble castable in reasonable time/budget?

### Production Feasibility (0-100)
- Location requirements manageable?
- Period/VFX requirements within reasonable scope?
- Any "unfilmable" elements that would need rethinking?

### Risk Profile (0-100)
- Controversial content that could affect distribution?
- Execution-dependent quality (needs perfect direction)?
- Single-point-of-failure elements?

**READINESS VERDICTS:**
- 75-100: Greenlight Ready (rare - script is production-ready)
- 50-74: Development Needed (promising but needs work)
- 25-49: Not Ready (significant issues to resolve)
- 0-24: Pass (fundamental problems)

Output in "lenses.production_readiness":
{{
  "enabled": true,
  "assessment": {{
    "script_polish": {{ "score": 0-100, "issues": [], "status": "ready/needs_work/blocker" }},
    "character_casting": {{ "score": 0-100, "issues": [], "status": "" }},
    "production_feasibility": {{ "score": 0-100, "issues": [], "status": "" }},
    "risk_profile": {{ "score": 0-100, "issues": [], "status": "" }},
    "overall_readiness": 0-100,
    "readiness_verdict": "greenlight_ready/development_needed/not_ready/pass",
    "deal_breakers": ["issues that MUST be resolved before greenlight"],
    "green_flags": ["strong positive production indicators"],
    "development_priorities": ["ordered list of what to fix first"],
    "estimated_development_time": "X drafts / X months"
  }}
}}
"""

COPRODUCTION_LENS_PROMPT = """
═══════════════════════════════════════════════════════════════════════════════
                    LENS: CO-PRODUCTION POTENTIAL
═══════════════════════════════════════════════════════════════════════════════

**THIS IS INFORMATIONAL ONLY - IT DOES NOT AFFECT THE CORE QUALITY VERDICT.**

Assess co-production opportunities for a Mexico City-based company.

### Mexico/US Co-production (1-10)
- Cultural bridge elements (border stories, diaspora, shared history)?
- Talent sharing opportunities (bilingual cast, US/Mexico crew)?
- Market expansion potential (US Hispanic + general market)?
- Treaty benefits available?

### Mexico/Spain Co-production (1-10)
- Language/cultural alignment (Spanish language, shared colonial history)?
- European market access through Spain?
- Ibero-American appeal (festivals, distribution)?
- EU funding opportunities through Spanish partner?

### Other Territories (1-10)
- UK, Canada, France, Germany potential?
- Universal story elements that travel?
- Festival circuit appeal (Cannes, Venice, Toronto)?

Output in "lenses.coproduction":
{{
  "enabled": true,
  "assessment": {{
    "mexico_us": {{
      "score": 1-10,
      "rationale": "specific co-production fit assessment",
      "key_elements": ["elements that support this partnership"],
      "potential_partners": ["types of US partners that would fit"]
    }},
    "mexico_spain": {{
      "score": 1-10,
      "rationale": "specific co-production fit assessment",
      "key_elements": ["elements that support this partnership"],
      "eu_fund_eligibility": "assessment of Eurimages, MEDIA, etc."
    }},
    "other_territories": {{
      "score": 1-10,
      "territories": ["list of potential partner countries"],
      "rationale": "why these territories would be interested"
    }},
    "best_structure": "recommended primary co-production structure",
    "treaty_considerations": ["relevant treaties/incentives to leverage"],
    "overall_coproduction_score": X.X
  }}
}}
"""


# Model configuration
CLAUDE_MODELS = {
    'sonnet': 'claude-sonnet-4-20250514',
    'haiku': 'claude-3-5-haiku-20241022',
    'opus': 'claude-opus-4-20250514'
}


def build_v6_prompt(
    text: str,
    metadata: Dict[str, Any],
    lenses: List[str],
    budget_ceiling: float = 30.0
) -> str:
    """Build the complete V6 prompt with core quality and optional lenses."""

    # Start with core quality prompt
    prompt = CORE_QUALITY_PROMPT.format(
        title=metadata.get('filename', 'Unknown'),
        page_count=metadata.get('page_count', 'Unknown'),
        word_count=metadata.get('word_count', 'Unknown'),
        text=text
    )

    # Add lens sections if enabled
    lens_prompts = []

    if 'latam' in lenses:
        lens_prompts.append(LATAM_LENS_PROMPT)

    if 'commercial' in lenses:
        lens_prompts.append(COMMERCIAL_LENS_PROMPT)

    if 'budget' in lenses:
        lens_prompts.append(BUDGET_LENS_PROMPT.format(budget_ceiling=int(budget_ceiling)))

    if 'production' in lenses:
        lens_prompts.append(PRODUCTION_READINESS_LENS_PROMPT)

    if 'coproduction' in lenses:
        lens_prompts.append(COPRODUCTION_LENS_PROMPT)

    if lens_prompts:
        prompt += "\n\n" + "═" * 79 + "\n"
        prompt += "                    OPTIONAL LENSES (Include in output)\n"
        prompt += "═" * 79 + "\n"
        prompt += "\n".join(lens_prompts)

        # Add lenses output structure
        prompt += """

Add a "lenses" object to your JSON output with the following structure.
For each lens NOT enabled, include it as: "lens_name": { "enabled": false }

"lenses": {
    "latam_market": { "enabled": """ + str('latam' in lenses).lower() + """, ... },
    "commercial_viability": { "enabled": """ + str('commercial' in lenses).lower() + """, ... },
    "budget_tier": { "enabled": """ + str('budget' in lenses).lower() + """, ... },
    "production_readiness": { "enabled": """ + str('production' in lenses).lower() + """, ... },
    "coproduction": { "enabled": """ + str('coproduction' in lenses).lower() + """ }
}
"""
    else:
        # No lenses enabled - add empty lenses object instruction
        prompt += """

Add an empty "lenses" object to your JSON output:

"lenses": {
    "latam_market": { "enabled": false },
    "commercial_viability": { "enabled": false },
    "budget_tier": { "enabled": false },
    "production_readiness": { "enabled": false },
    "coproduction": { "enabled": false }
}
"""

    return prompt


@create_anthropic_retry()
def _call_claude_api(client, prompt: str, model_name: str = 'sonnet') -> str:
    """Make Claude API call with retry logic."""
    model = CLAUDE_MODELS.get(model_name, CLAUDE_MODELS['sonnet'])
    message = client.messages.create(
        model=model,
        max_tokens=16000,  # Large output for comprehensive analysis
        timeout=httpx.Timeout(300.0, connect=10.0),  # 5 min for thorough analysis
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    return message.content[0].text


def analyze_with_claude(
    text: str,
    metadata: Dict[str, Any],
    lenses: List[str],
    budget_ceiling: float,
    api_key: Optional[str] = None,
    model_name: str = 'sonnet'
) -> Dict[str, Any]:
    """Analyze screenplay using Claude with V6 Core + Lenses architecture."""
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

    prompt = build_v6_prompt(text, metadata, lenses, budget_ceiling)

    logger.info(f"Sending to Claude ({model_name}) for V6 Core + Lenses analysis...")
    logger.info(f"Lenses enabled: {lenses if lenses else 'None (pure quality analysis)'}")

    try:
        response_text = _call_claude_api(client, prompt, model_name)
        analysis = json.loads(response_text)
        logger.info(f"✓ Claude ({model_name}) V6 analysis complete")
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


def analyze_screenplay(
    parsed_json_path: Path,
    model: str = "claude-sonnet",
    lenses: List[str] = None,
    budget_ceiling: float = 30.0,
    api_key: Optional[str] = None
) -> Dict[str, Any]:
    """Analyze a screenplay from parsed JSON with V6 unified system."""
    lenses = lenses or []

    logger.info(f"Analyzing {parsed_json_path.name} with {model} (V6 Unified)...")

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
        analysis = analyze_with_claude(text, metadata, lenses, budget_ceiling, api_key, model_name='sonnet')
    elif model_lower == "claude-haiku":
        analysis = analyze_with_claude(text, metadata, lenses, budget_ceiling, api_key, model_name='haiku')
    elif model_lower == "claude-opus":
        analysis = analyze_with_claude(text, metadata, lenses, budget_ceiling, api_key, model_name='opus')
    else:
        raise ValueError(f"Unknown model: {model}")

    # Wrap in standard output structure
    result = {
        'source_file': parsed_data['filename'],
        'analysis_model': model,
        'analysis_version': 'v6_unified',
        'lenses_enabled': lenses,
        'budget_ceiling_used': budget_ceiling if 'budget' in lenses else None,
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
    """Parse command-line arguments for V6 analysis."""
    parser = argparse.ArgumentParser(
        description='Analyze screenplay using AI (V6 Unified: V5 Depth + V6 Architecture)'
    )

    # Required arguments
    parser.add_argument(
        '--input',
        type=str,
        required=True,
        help='Path to parsed JSON file or directory'
    )

    # Output configuration
    parser.add_argument(
        '--output',
        type=str,
        default='public/data/analysis_v6',
        help='Directory to save analysis JSON (default: public/data/analysis_v6)'
    )

    # Model selection
    parser.add_argument(
        '--model',
        type=str,
        choices=['claude', 'claude-sonnet', 'claude-haiku', 'claude-opus'],
        default='claude-sonnet',
        help='AI model to use (default: claude-sonnet)'
    )

    # Lens configuration
    lens_group = parser.add_argument_group('Lens Configuration')

    lens_group.add_argument(
        '--lens',
        action='append',
        choices=['latam', 'commercial', 'budget', 'production', 'coproduction'],
        default=[],
        help='Enable specific lens (can be used multiple times)'
    )

    lens_group.add_argument(
        '--all-lenses',
        action='store_true',
        help='Enable all available lenses'
    )

    # Budget lens configuration
    parser.add_argument(
        '--budget-ceiling',
        type=float,
        default=30.0,
        help='Budget ceiling in millions USD for budget lens (default: 30)'
    )

    parser.add_argument(
        '--api-key',
        type=str,
        help='API key (alternative to .env file)'
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

        # Determine which lenses to enable
        lenses = args.lens or []
        if args.all_lenses:
            lenses = ['latam', 'commercial', 'budget', 'production', 'coproduction']

        logger.info(f"Found {len(json_files)} file(s) to analyze with V6 Unified")
        logger.info(f"Lenses: {lenses if lenses else 'None (pure quality analysis)'}")
        if 'budget' in lenses:
            logger.info(f"Budget ceiling: ${args.budget_ceiling}M")

        successful = 0
        failed = 0

        for json_path in json_files:
            try:
                analysis = analyze_screenplay(
                    json_path,
                    args.model,
                    lenses,
                    args.budget_ceiling,
                    args.api_key
                )
                output_filename = json_path.stem + '_analysis_v6.json'
                output_path = output_dir / output_filename
                save_analysis(analysis, output_path)
                successful += 1
            except Exception as e:
                logger.error(f"✗ Failed to analyze {json_path.name}: {e}")
                failed += 1

        print(f"\n✓ Analyzed {successful} screenplays (V6 Unified)")
        if failed > 0:
            print(f"✗ {failed} analyses failed")

        return 0 if failed == 0 else 1

    except Exception as e:
        logger.error(f"Script failed: {e}", exc_info=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
