# AI Screenplay Analysis V3 System: Comprehensive Technical Review

**Document Version:** 1.0
**Date:** February 2026
**Purpose:** Complete technical documentation of the V3 screenplay analysis system with calibration assessment and enhancement recommendations

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [The 7 Weighted Dimensions](#3-the-7-weighted-dimensions)
4. [Verdict Threshold System](#4-verdict-threshold-system)
5. [Commercial Viability Score (CVS)](#5-commercial-viability-score-cvs)
6. [Critical Failures Detection](#6-critical-failures-detection)
7. [Current Performance Analysis](#7-current-performance-analysis)
8. [Calibration Issues Identified](#8-calibration-issues-identified)
9. [Enhancement Recommendations](#9-enhancement-recommendations)
10. [Appendices](#10-appendices)

---

## 1. Executive Summary

### What the System Does

The V3 Analysis System is an AI-powered screenplay evaluation tool that analyzes full screenplay text and produces a comprehensive assessment including:

- **7 Weighted Dimension Scores** (1-10 scale)
- **Commercial Viability Score** (6-18 points)
- **Critical Failure Detection** (automatic PASS triggers)
- **Final Verdict** (FILM NOW / RECOMMEND / CONSIDER / PASS)
- **Detailed narrative analysis** (characters, structure, comparable films, etc.)

### Current State Assessment

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| FILM NOW Rate | <1% | 21% (28/133) | **SEVERELY INFLATED** |
| RECOMMEND Rate | ~5% | 56% (75/133) | **SEVERELY INFLATED** |
| CONSIDER Rate | ~25% | 16% (21/133) | UNDER-REPRESENTED |
| PASS Rate | ~70% | 7% (9/133) | **SEVERELY DEFLATED** |
| Average Weighted Score | 5.0-6.0 | 7.73 | **TOO HIGH** |

### Critical Finding

**The system is operating with severe positive bias.** The AI model is not adhering to the strict calibration instructions in the prompt, resulting in a recommendation distribution that is completely inverted from the intended targets. This fundamentally undermines the system's utility as a development tool.

---

## 2. System Architecture Overview

### Technical Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    ANALYSIS PIPELINE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  PDF Parser  │───▶│   Parsed     │───▶│  AI Model    │       │
│  │              │    │   JSON       │    │  (Claude/    │       │
│  │              │    │              │    │   GPT)       │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                                        │               │
│         │                                        ▼               │
│         │                              ┌──────────────┐          │
│         │                              │  Analysis    │          │
│         │                              │  JSON Output │          │
│         │                              └──────────────┘          │
│         │                                        │               │
│         ▼                                        ▼               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    PROMPT TEMPLATE                        │   │
│  │  • Role definition (development analyst)                 │   │
│  │  • Scoring instructions (7 dimensions)                   │   │
│  │  • Critical failure checklist                            │   │
│  │  • Verdict thresholds (strict)                           │   │
│  │  • Commercial viability matrix                           │   │
│  │  • JSON output schema                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Supported AI Models

| Model | Key | Context Window | Cost | Recommended Use |
|-------|-----|----------------|------|-----------------|
| Claude Sonnet | `claude` | 200K tokens | Medium | Default analysis |
| Claude Haiku | `claude-haiku` | 200K tokens | Low | Batch processing |
| Claude Opus | `claude-opus` | 200K tokens | High | Critical evaluations |
| GPT-4o | `gpt` | 128K tokens | Medium | Alternative analysis |

### Data Flow

1. **Input:** Parsed screenplay JSON containing:
   - `filename`: Original PDF filename
   - `page_count`: Number of pages
   - `word_count`: Total words
   - `text`: Full screenplay text

2. **Processing:**
   - Prompt template populated with screenplay data
   - API call to selected AI model
   - JSON response parsed and validated

3. **Output:** Analysis JSON containing:
   - Source file metadata
   - Analysis model used
   - Version identifier (`v3_strict_thresholds`)
   - Complete analysis object

---

## 3. The 7 Weighted Dimensions

The V3 system evaluates screenplays across seven dimensions, each with specific weights that reflect their relative importance to commercial viability.

### Weight Distribution

```
┌─────────────────────────────────────────────────────────────┐
│  CONCEPT          ████████████████████  20%                 │
│  STRUCTURE        ███████████████       15%                 │
│  PROTAGONIST      ███████████████       15%                 │
│  GENRE EXECUTION  ███████████████       15%                 │
│  ORIGINALITY      ███████████████       15%                 │
│  SUPPORTING CAST  ██████████            10%                 │
│  DIALOGUE         ██████████            10%                 │
└─────────────────────────────────────────────────────────────┘
```

### Weighted Score Calculation

```
Weighted Score = (Concept × 0.20) + (Structure × 0.15) + (Protagonist × 0.15)
               + (Supporting Cast × 0.10) + (Dialogue × 0.10)
               + (Genre Execution × 0.15) + (Originality × 0.15)
```

---

### 3.1 CONCEPT (Weight: 20%)

**Definition:** The core premise, hook, and marketability of the idea itself—independent of execution.

**Scoring Rubric:**

| Score | Description | Criteria |
|-------|-------------|----------|
| 9-10 | **Exceptional** | Instantly compelling hook. Sellable in one sentence. Clear audience. Fresh take or bold new territory. |
| 7-8 | **Strong** | Strong hook requiring minimal explanation. Audience identifiable. Marketable with competent campaign. |
| 5-6 | **Adequate** | Premise clear but not distinctive. Execution-dependent. |
| 3-4 | **Weak** | Generic or confused concept. Requires explanation. Audience unclear. |
| 1-2 | **Failing** | No discernible hook. Cannot articulate why anyone would watch. |

**Key Questions:**
- Can you describe this movie in one compelling sentence?
- Who is the clear target audience?
- What makes this different from what's already been made?
- Would this concept get a meeting at a studio?

---

### 3.2 STRUCTURE (Weight: 15%)

**Definition:** The architectural design of the narrative—how scenes build, connect, and pay off.

**Scoring Rubric:**

| Score | Description | Criteria |
|-------|-------------|----------|
| 9-10 | **Exceptional** | Impeccable architecture. Every scene earns its place. Pacing feels inevitable. Surprises feel earned. |
| 7-8 | **Strong** | Solid three-act structure. Clear act breaks. Momentum sustained. Minor pacing issues. |
| 5-6 | **Adequate** | Functional structure with visible seams. Some saggy sections. |
| 3-4 | **Weak** | Structural problems hurt the read. Unclear act breaks. Missing or weak beats. |
| 1-2 | **Failing** | No discernible structure. Events feel random. No momentum. |

**Key Questions:**
- Where are the act breaks? Are they clear and compelling?
- Does the middle build progressively or sag?
- Does the climax pay off what's been set up?
- Is there narrative momentum—a reason to keep reading?

---

### 3.3 PROTAGONIST (Weight: 15%)

**Definition:** The central character's clarity of goals, agency in the story, and transformation arc.

**Scoring Rubric:**

| Score | Description | Criteria |
|-------|-------------|----------|
| 9-10 | **Exceptional** | Unforgettable character. Clear want and need. Agency drives plot. Transformation earned. Actor-bait role. |
| 7-8 | **Strong** | Compelling protagonist with clear goals. Active in driving story. Arc visible and satisfying. |
| 5-6 | **Adequate** | Functional protagonist. Goals present. Somewhat active. Arc exists but could be sharper. |
| 3-4 | **Weak** | Passive or unclear protagonist. Goals muddy. Story happens to them. |
| 1-2 | **Failing** | Cannot identify goals. Pure reactivity. No investment reason. No arc. |

**Key Questions:**
- What does the protagonist want? What do they need?
- Do they drive the story or does the story happen to them?
- Would an A-list actor want to play this role?
- Is the transformation believable and earned?

---

### 3.4 SUPPORTING CAST (Weight: 10%)

**Definition:** The distinctiveness, depth, and functionality of non-protagonist characters.

**Scoring Rubric:**

| Score | Description | Criteria |
|-------|-------------|----------|
| 9-10 | **Exceptional** | Memorable ensemble. Every character feels like a person. Actors would fight for these roles. |
| 7-8 | **Strong** | Strong supporting characters with distinct voices. Enhance protagonist's journey. |
| 5-6 | **Adequate** | Functional supporting cast. Serve the plot. Some distinction. |
| 3-4 | **Weak** | Characters feel like types. Interchangeable. Serve mechanical purposes. |
| 1-2 | **Failing** | Supporting cast nonexistent or indistinguishable. |

**Key Questions:**
- Could you describe each major supporting character without referencing their plot function?
- Do they have their own wants and perspectives?
- Would character actors lobby for these roles?
- Do they challenge or complement the protagonist in meaningful ways?

---

### 3.5 DIALOGUE (Weight: 10%)

**Definition:** The quality, distinctiveness, and subtlety of spoken lines.

**Scoring Rubric:**

| Score | Description | Criteria |
|-------|-------------|----------|
| 9-10 | **Exceptional** | Quotable lines. Every character sounds distinct. Subtext rich. Exposition invisible. |
| 7-8 | **Strong** | Strong dialogue voice. Good ear. Subtext present. Characters distinguishable. |
| 5-6 | **Adequate** | Serviceable dialogue. Gets information across. Some subtext. |
| 3-4 | **Weak** | On-the-nose dialogue. Characters explain rather than reveal. |
| 1-2 | **Failing** | Wooden or unnatural speech. All characters sound identical. |

**Key Questions:**
- Are there quotable lines you'd remember after reading?
- Could you identify who's speaking without character names?
- Is exposition delivered naturally or announced?
- Is there subtext—meaning beneath the surface?

---

### 3.6 GENRE EXECUTION (Weight: 15%)

**Definition:** How well the screenplay delivers on genre expectations and obligatory scenes.

**Scoring Rubric:**

| Score | Description | Criteria |
|-------|-------------|----------|
| 9-10 | **Exceptional** | Masterful genre command. Delivers expected pleasures with fresh execution. Satisfies and potentially expands audience. |
| 7-8 | **Strong** | Solid genre execution. Obligatory scenes present and effective. Delivers the goods. |
| 5-6 | **Adequate** | Adequate genre execution. Hits required beats without distinction. |
| 3-4 | **Weak** | Weak genre execution. Missing obligatory scenes. Core audience disappointed. |
| 1-2 | **Failing** | Genre confusion. Doesn't understand what audience expects. |

**Key Questions:**
- Does this deliver what its genre audience expects?
- Are the obligatory scenes present and effective?
- Does it fulfill genre conventions while feeling fresh?
- Would core genre fans be satisfied?

---

### 3.7 ORIGINALITY (Weight: 15%)

**Definition:** The freshness of voice, perspective, and approach—how much this feels like it could only come from this writer.

**Scoring Rubric:**

| Score | Description | Criteria |
|-------|-------------|----------|
| 9-10 | **Exceptional** | Fresh voice announcing distinct writer. Haven't seen this exact thing before. Makes you rethink the genre. |
| 7-8 | **Strong** | Clear voice. Distinctive perspective. Personal stamp on familiar territory. |
| 5-6 | **Adequate** | Competent but not distinctive. Could have been written by many writers. |
| 3-4 | **Weak** | Derivative. Obvious influences dominate. Feels assembled from other films. |
| 1-2 | **Failing** | Plagiaristic in feel. No discernible voice. Pure imitation. |

**Key Questions:**
- Does this feel like it could only come from this writer?
- Is there a distinctive voice or perspective?
- Does it bring something new to familiar territory?
- Would you want to read this writer's next script?

---

## 4. Verdict Threshold System

The V3 system uses strict thresholds to determine the final verdict. These are designed to be **cumulative**—meeting one criterion isn't enough; ALL criteria for a tier must be satisfied.

### 4.1 FILM NOW (Elite Tier - Target: <1% of scripts)

**Definition:** "Stop everything and make this movie NOW. This is once-in-a-generation material."

**Required Criteria (ALL must be met):**

| Requirement | Threshold |
|-------------|-----------|
| Weighted Score | ≥ 8.5 |
| Concept Score | ≥ 9 |
| Protagonist Score | ≥ 9 |
| Originality Score | ≥ 9 |
| All Dimensions | ≥ 8 (no exceptions) |
| Critical Failures | Zero |
| Major Weaknesses | Zero |
| CVS | ≥ 15 |

**Qualitative Tests Required:**

1. **Lightning Test:** Immediate, visceral hook within first 10 pages that creates NEED to know what happens
2. **Goosebumps Test:** At least 3 moments of genuine emotional response (laughed out loud, eyes welled up, heart raced, audible gasp)
3. **Career Risk Test:** Would stake professional reputation on this without hesitation

---

### 4.2 RECOMMEND (Target: ~5% of scripts)

**Definition:** "This screenplay demonstrates commercial viability and craft execution that warrant immediate development consideration."

**Required Criteria (ALL must be met):**

| Requirement | Threshold |
|-------------|-----------|
| Weighted Score | ≥ 7.5 |
| Concept Score | ≥ 8 |
| Protagonist Score | ≥ 7 |
| Genre Execution Score | ≥ 7 |
| Minimum Any Dimension | ≥ 6 (no dimension below 6) |
| Critical Failures | Zero |
| Major Weaknesses | Maximum 1 |
| CVS | ≥ 8 |

---

### 4.3 CONSIDER (Target: ~25% of scripts)

**Definition:** "This screenplay shows genuine merit but requires development attention. With specific fixes, this project could achieve RECOMMEND status."

**Required Criteria (ALL must be met):**

| Requirement | Threshold |
|-------------|-----------|
| Weighted Score | 5.5 - 7.4 |
| Concept Score | ≥ 6 |
| Dimensions Below 5 | Maximum 2 |
| Critical Failures | Zero |
| Development Path | Must be clear and articulable |
| Fix Scope | Fixable within 1-2 drafts |

---

### 4.4 PASS (Target: ~70% of scripts)

**Definition:** "While [acknowledge any strengths], this screenplay [specific core problem]. The development investment required exceeds the value of the current material."

**Trigger Conditions (ANY one triggers PASS):**

| Trigger | Threshold |
|---------|-----------|
| Weighted Score | < 5.5 |
| Any Critical Failure | Present |
| Concept Score | < 5 |
| Protagonist Score | < 4 |
| Dimensions Below 5 | 3 or more |
| Development Scope | Requires page-one rewrite |
| CVS | < 6 |

---

## 5. Commercial Viability Score (CVS)

The CVS is a 6-factor matrix that evaluates commercial potential independently from craft quality.

### Scoring Matrix

Each factor is scored 1-3 points, yielding a total of 6-18 points.

| Factor | 3 Points | 2 Points | 1 Point |
|--------|----------|----------|---------|
| **Target Audience** | Clear demographic with theatrical habits | Identifiable but may prefer streaming | Niche or unclear |
| **High Concept** | One-sentence pitch sells it | Takes 2-3 sentences | Requires explanation |
| **Cast Attachability** | Multiple star roles | 1-2 attachable roles | No obvious vehicles |
| **Marketing Hook** | Clear trailer/poster image | Marketable with creativity | Difficult without spoiling |
| **Budget/Return Ratio** | Appropriate to likely returns | Modest concerns | Exceeds commercial ceiling |
| **Comparable Success** | Recent comps performed well | Mixed performance | No comps or comps failed |

### CVS Interpretation

| CVS Range | Interpretation | Verdict Impact |
|-----------|----------------|----------------|
| 15-18 | Strong commercial prospect | Can support FILM NOW/RECOMMEND |
| 11-14 | Viable with right execution | Can support RECOMMEND |
| 8-10 | Commercial concerns present | Maximum CONSIDER regardless of craft |
| 6-7 | Commercial viability in serious question | Strong PASS indicator |

**Hard Rule:** CVS below 8 = Cannot RECOMMEND regardless of weighted score

---

## 6. Critical Failures Detection

Critical Failures are fundamental problems that trigger an automatic PASS regardless of all other scores.

### 6.1 Concept-Level Failures

| Failure | Definition |
|---------|------------|
| **No discernible hook** | Cannot articulate what makes this worth watching in one sentence |
| **Audience confusion** | Cannot identify who would pay to see this |
| **Derivative without elevation** | Indistinguishable from obvious influences |
| **Tone incoherence** | Script cannot decide what it wants to be |

### 6.2 Protagonist Failures

| Failure | Definition |
|---------|------------|
| **Passive protagonist** | Events happen TO character through middle of second act or beyond |
| **Goal absence** | Cannot articulate what protagonist wants by end of first act |
| **Unearned transformation** | Character changes without adequate pressure |
| **Likeability vacuum** | No qualities creating audience investment |

### 6.3 Structural Failures

| Failure | Definition |
|---------|------------|
| **Missing engine** | No clear dramatic question sustaining momentum |
| **Second act collapse** | Pages 30-90 lack progressive complication |
| **Climax deflation** | Final confrontation fails to pay off setup |
| **Ending betrayal** | Resolution contradicts story's implicit promise |

### 6.4 Execution Failures

| Failure | Definition |
|---------|------------|
| **Amateur formatting** | Consistent violation of screenplay conventions |
| **Overwriting** | Action lines routinely exceed 4 lines; speeches exceed 5 lines |
| **Unfilmables** | Heavy reliance on internal states camera cannot capture |

---

## 7. Current Performance Analysis

### 7.1 Dataset Overview

| Collection | Count | Period |
|------------|-------|--------|
| 2005 Black List | 18 | 2005 |
| 2006 Black List | 10 | 2006 |
| 2007 Black List | 96 | 2007 |
| 2020 Black List | 0* | 2020 |
| Random Samples | 9 | Various |
| **Total** | **133** | — |

*Note: Some files may have parsing errors showing weighted score of 1.0

### 7.2 Current Recommendation Distribution

```
ACTUAL DISTRIBUTION vs TARGET

FILM NOW:    28 (21.0%) ████████████████████████████████████████▌ vs  1% target
RECOMMEND:   75 (56.4%) █████████████████████████████████████████████████████████████████ vs  5% target
CONSIDER:    21 (15.8%) ████████████████████▋                     vs 25% target
PASS:         9 ( 6.8%) █████████▋                                vs 70% target
```

### 7.3 Weighted Score Distribution

| Statistic | Value | Expected Range |
|-----------|-------|----------------|
| Mean | 7.73 | 5.0-6.0 |
| Median | ~7.8 | ~5.5 |
| Mode | 7.5-8.0 | 5.0-6.0 |
| Lowest (valid) | 5.95 | Should have more <5.5 |
| Highest | 8.85 | Appropriate |

### 7.4 CVS Distribution

| CVS Score | Count | Percentage |
|-----------|-------|------------|
| 18 (max) | 16 | 12% |
| 17 | 18 | 14% |
| 16 | 27 | 20% |
| 15 | 22 | 17% |
| 14 | 18 | 14% |
| 13 | 16 | 12% |
| 12 | 7 | 5% |
| 11 | 1 | <1% |
| 9 | 1 | <1% |
| 6 (min) | 7 | 5% |

**Observation:** CVS scores are heavily clustered in the 13-18 range (77%), with almost no scripts receiving concerning scores (6-10).

---

## 8. Calibration Issues Identified

### 8.1 Primary Issue: Positive Scoring Bias

The AI model is systematically scoring screenplays higher than the rubrics intend:

**Evidence:**
- Average weighted score (7.73) is 29% higher than expected midpoint (6.0)
- Only 9 scripts received PASS (6.8%) vs target of 70%
- 28 scripts received FILM NOW (21%) vs target of <1%

**Root Causes:**
1. **Haiku Model Limitations:** Claude Haiku (used for batch processing) may lack the critical judgment depth of Opus/Sonnet
2. **Prompt Doesn't Enforce Calibration:** While targets are stated, there's no mechanism to ensure adherence
3. **LLM Positivity Bias:** AI models tend toward generous evaluation unless explicitly constrained
4. **Black List Selection Bias:** These scripts were already curated—they're pre-filtered quality

### 8.2 Secondary Issue: FILM NOW Threshold Enforcement

The FILM NOW criteria require ALL dimensions ≥ 8, yet scripts with dimensions at 7 or below are receiving FILM NOW verdicts:

**Example Issues:**
- Scripts with Supporting Cast at 7 receiving FILM NOW
- Scripts with 1-2 Major Weaknesses receiving FILM NOW
- Qualitative tests (Lightning, Goosebumps, Career Risk) appear rubber-stamped

### 8.3 Tertiary Issue: Critical Failure Detection

Critical failures are rarely identified:
- Only 9 scripts have any critical failures flagged
- Many scripts that should have structural or protagonist issues pass the check
- "Tone incoherence" and "derivative without elevation" are almost never cited

### 8.4 Data Quality Issues

Several scripts show weighted scores of exactly 1.0 or 1.00:
- Scott Pilgrim's Precious Little Life (parsing error)
- Honeymoon with Harry (no text provided)
- Several others (7 total)

These represent parsing failures, not actual screenplay evaluations.

---

## 9. Enhancement Recommendations

### 9.1 Immediate Fixes (High Priority)

#### 9.1.1 Implement Calibration Enforcement

Add explicit calibration constraints to the prompt:

```
**MANDATORY CALIBRATION CHECK:**
Before finalizing your verdict, verify your distribution aligns with these targets:
- If you would RECOMMEND this script, ask yourself: "Is this truly in the top 5%
  of professional screenplays I've ever read?" If not, downgrade to CONSIDER.
- If you would rate FILM NOW, ask yourself: "Would I stake my career on this
  being the best script of the year?" If not, downgrade to RECOMMEND at most.
- Default position should be PASS. Only elevate when script earns it.

STATISTICAL REALITY CHECK:
In any batch of 20 professional screenplays:
- Expect 14 PASS ratings
- Expect 5 CONSIDER ratings
- Expect 1 RECOMMEND rating
- Expect 0 FILM NOW ratings (FILM NOW should be ~1 per 100 scripts)
```

#### 9.1.2 Use Stronger Model for Final Verdicts

```python
# Two-pass approach:
# 1. Initial analysis with Haiku (fast, cheap)
# 2. Verdict verification with Sonnet/Opus for borderline cases

if initial_weighted_score >= 7.0:
    verify_with_opus(screenplay)  # Higher scrutiny for potential RECOMMENDs
```

#### 9.1.3 Add Comparative Anchoring

Include reference comparisons in the prompt:

```
**CALIBRATION ANCHORS:**
- The Godfather screenplay = 9.5 weighted score
- Average produced Hollywood film = 6.0 weighted score
- Typical Black List script = 7.0 weighted score
- Entry-level professional screenplay = 5.0 weighted score
- Amateur screenplay = 3.0 weighted score

Score relative to these anchors.
```

### 9.2 Medium-Term Enhancements

#### 9.2.1 Multi-Pass Analysis Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                 ENHANCED ANALYSIS PIPELINE                     │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  PASS 1: Quick Read (Haiku)                                   │
│  └─ First 30 pages only                                       │
│  └─ Check for immediate critical failures                     │
│  └─ Gut reaction score (1-10)                                 │
│  └─ If < 5, flag for PASS fast-track                         │
│                                                                │
│  PASS 2: Full Analysis (Sonnet)                               │
│  └─ Complete screenplay read                                  │
│  └─ All 7 dimensions scored                                   │
│  └─ CVS calculated                                            │
│  └─ Initial verdict proposed                                  │
│                                                                │
│  PASS 3: Devil's Advocate (Opus)                              │
│  └─ Challenge all scores above 7                              │
│  └─ Find reasons NOT to recommend                             │
│  └─ Verify critical failure detection                         │
│  └─ Final calibrated verdict                                  │
│                                                                │
└───────────────────────────────────────────────────────────────┘
```

#### 9.2.2 Add Negative Prompting

Explicitly instruct the model to find flaws:

```
**DEVIL'S ADVOCATE REQUIREMENT:**
Before assigning any score above 6, you must identify at least ONE specific
weakness or concern in that dimension. Scores of 9-10 require identifying
what prevents a perfect 10.

For each dimension, provide:
- Score
- Evidence supporting the score
- Evidence AGAINST the score (mandatory for scores ≥7)
- Net justification
```

#### 9.2.3 Implement Statistical Normalization

Post-process scores to enforce distribution:

```python
def normalize_batch_scores(analyses: list) -> list:
    """Force distribution alignment through statistical normalization."""
    weighted_scores = [a['weighted_score'] for a in analyses]

    # Calculate percentile ranks
    for analysis in analyses:
        percentile = calculate_percentile(analysis['weighted_score'], weighted_scores)

        # Map percentile to forced verdict
        if percentile >= 99:
            forced_verdict = 'FILM NOW'
        elif percentile >= 95:
            forced_verdict = 'RECOMMEND'
        elif percentile >= 70:
            forced_verdict = 'CONSIDER'
        else:
            forced_verdict = 'PASS'

        analysis['normalized_verdict'] = forced_verdict

    return analyses
```

### 9.3 Advanced Enhancements (Development Executive Quality)

#### 9.3.1 Add Market Intelligence Integration

Connect to box office and streaming data:

```python
def calculate_market_score(screenplay: dict) -> float:
    """Calculate market viability based on current trends."""
    genre = screenplay['genre']

    # Get recent performance data for genre
    genre_performance = get_box_office_trends(genre, years=3)
    streaming_demand = get_streaming_search_trends(genre)
    production_pipeline = get_greenlit_projects_by_genre(genre)

    # Factor in market saturation
    saturation_penalty = calculate_saturation(genre, production_pipeline)

    return (genre_performance * 0.4 +
            streaming_demand * 0.3 +
            (1 - saturation_penalty) * 0.3)
```

#### 9.3.2 Add Talent Attachment Probability

```python
def calculate_attachment_probability(screenplay: dict) -> dict:
    """Estimate likelihood of key talent attachment."""
    protagonist_profile = extract_character_profile(screenplay['protagonist'])

    return {
        'a_list_lead': estimate_fit(protagonist_profile, A_LIST_ACTORS),
        'director_fit': identify_suitable_directors(screenplay),
        'package_potential': calculate_package_score(screenplay),
    }
```

#### 9.3.3 Add Budget-to-Box-Office Projection

```python
def project_financial_performance(screenplay: dict) -> dict:
    """Project likely financial performance based on comparables."""
    budget_estimate = estimate_production_budget(screenplay)
    comparable_films = find_comparable_films(screenplay, limit=10)

    return {
        'estimated_budget': budget_estimate,
        'projected_domestic': calculate_projected_box_office(comparable_films, 'domestic'),
        'projected_international': calculate_projected_box_office(comparable_films, 'international'),
        'streaming_value': estimate_streaming_license_value(screenplay),
        'roi_probability': calculate_roi_probability(budget_estimate, comparable_films),
    }
```

#### 9.3.4 Add Writer Track Record Weighting

```python
def factor_writer_history(screenplay: dict, writer_data: dict) -> float:
    """Adjust scores based on writer's professional track record."""
    credits = writer_data.get('produced_credits', [])

    if not credits:
        return 0.0  # No adjustment for unknown writers

    success_rate = calculate_success_rate(credits)
    average_box_office = calculate_average_performance(credits)
    critical_reception = calculate_critical_average(credits)

    return (success_rate * 0.4 +
            normalize(average_box_office) * 0.3 +
            normalize(critical_reception) * 0.3)
```

### 9.4 Prompt Engineering Improvements

#### 9.4.1 Add Specific Page References

Require page-number citations for all claims:

```
For each justification, you MUST cite specific page numbers:
- "Strong dialogue voice (see pages 14-15 diner scene, page 67 confession)"
- "Passive protagonist (pages 32-58: events happen to character with no agency)"

Claims without page references will be considered unsupported.
```

#### 9.4.2 Add Comparative Scoring

Require comparison to a known benchmark:

```
Before scoring each dimension, compare to this calibration film:
- For comedy: Compare to the SUPERBAD screenplay
- For thriller: Compare to the GONE GIRL screenplay
- For drama: Compare to THE SOCIAL NETWORK screenplay

Ask: "Is this screenplay's [DIMENSION] better than, equal to, or worse than the calibration film?"
```

#### 9.4.3 Add Forced Ranking

If processing multiple screenplays, require ranking:

```
After analyzing all screenplays in this batch, rank them from best to worst.
Verify that your rankings align with your scores.
Adjust scores if rankings contradict them.
```

---

## 10. Appendices

### Appendix A: Sample Analysis Output (FILM NOW - The Hangover)

```json
{
  "title": "The Hangover",
  "author": "Jon Lucas & Scott Moore",
  "weighted_score": 8.65,
  "recommendation": "FILM NOW",
  "dimension_scores": {
    "concept": { "score": 9 },
    "structure": { "score": 8 },
    "protagonist": { "score": 8 },
    "supporting_cast": { "score": 9 },
    "dialogue": { "score": 9 },
    "genre_execution": { "score": 9 },
    "originality": { "score": 8 }
  },
  "cvs_total": 18,
  "critical_failures": [],
  "major_weaknesses": [
    "Potential offensive stereotypes",
    "Extremely raunchy humor might limit audience"
  ]
}
```

**Calibration Issue:** This screenplay has 2 major weaknesses listed, but FILM NOW requires zero major weaknesses. This should have been RECOMMEND.

### Appendix B: Sample Analysis Output (PASS - Kill Grandma)

```json
{
  "title": "Kill Grandma",
  "weighted_score": 6.55,
  "recommendation": "PASS",
  "critical_failures": [
    "Tone incoherence (script struggles to maintain consistent tone through third act)"
  ]
}
```

**Correct Behavior:** Critical failure triggered PASS despite adequate weighted score.

### Appendix C: Known Data Quality Issues

| File | Issue | Resolution |
|------|-------|------------|
| Scott Pilgrim's Precious Little Life | No screenplay text | Re-parse PDF |
| Honeymoon with Harry | No text provided | Re-parse PDF |
| 5 other files | Weighted score = 1.0 | Identify and re-process |

### Appendix D: Recommended Next Steps

1. **Immediate:** Fix 7 parsing errors showing score of 1.0
2. **Week 1:** Implement calibration enforcement in prompt
3. **Week 2:** Re-analyze batch with Sonnet instead of Haiku
4. **Week 3:** Add devil's advocate pass for RECOMMEND candidates
5. **Week 4:** Implement statistical normalization for batch processing
6. **Ongoing:** Track actual distribution and adjust calibration

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 2026 | Claude | Initial comprehensive review |

---

*This document provides a complete technical analysis of the V3 Screenplay Analysis System. For implementation details, see `analyze_screenplay_v3.py` in the `/execution` directory.*
