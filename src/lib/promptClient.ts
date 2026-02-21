/**
 * Client-side V6 prompt builder.
 *
 * This is a thin wrapper that dynamically loads the prompt text only when
 * needed (i.e., when using the dev proxy path). The prompt is identical to
 * functions/src/prompts.ts — kept in sync manually.
 *
 * In production the Cloud Function builds the prompt server-side, so this
 * module is only imported for local development.
 */

export type LensName = 'latam' | 'commercial' | 'production' | 'coproduction';

/**
 * Build the V6 prompt for the Anthropic API.
 * Uses a lazy-loaded prompt module to keep the main bundle small.
 *
 * @param calibrationPrompt Optional calibration profile text from the admin's
 *   feedback loop. Injected between core instructions and screenplay text.
 */
export function buildV6PromptClient(
  text: string,
  metadata: { title: string; pageCount: number; wordCount: number },
  lenses: LensName[],
  calibrationPrompt?: string,
): string {
  // Core quality prompt with placeholders replaced
  let prompt = CORE_PROMPT
    .replace('{title}', metadata.title)
    .replace('{page_count}', String(metadata.pageCount))
    .replace('{word_count}', String(metadata.wordCount))
    .replace('{text}', text);

  // Inject calibration profile if provided
  if (calibrationPrompt && calibrationPrompt.trim().length > 0) {
    // Insert before the screenplay text by appending after the core prompt
    prompt += '\n\n' + '═'.repeat(79) + '\n';
    prompt += '              PRODUCER CALIBRATION (adjust analysis accordingly)\n';
    prompt += '═'.repeat(79) + '\n';
    prompt += calibrationPrompt.trim() + '\n';
    prompt += '\nIMPORTANT: Apply these calibration adjustments while maintaining the V6 scoring framework.\n';
    prompt += 'The calibration biases should shift your evaluation, not override the methodology.\n';
  }

  // Add lens instructions
  const lensTexts = lenses.map((l) => LENS_PROMPTS[l]).filter(Boolean);

  if (lensTexts.length > 0) {
    prompt += '\n\n' + '═'.repeat(79) + '\n';
    prompt += '                    OPTIONAL LENSES (Include in output)\n';
    prompt += '═'.repeat(79) + '\n';
    prompt += lensTexts.join('\n');
    prompt += `\n\nAdd a "lenses" object to your JSON output.\nFor each lens NOT enabled, include it as: "lens_name": { "enabled": false }\n\n"lenses": {\n    "latam_market": { "enabled": ${lenses.includes('latam')} },\n    "commercial_viability": { "enabled": ${lenses.includes('commercial')} },\n    "production_readiness": { "enabled": ${lenses.includes('production')} },\n    "coproduction": { "enabled": ${lenses.includes('coproduction')} }\n}\n`;
  } else {
    prompt += `\n\nAdd an empty "lenses" object to your JSON output:\n\n"lenses": {\n    "latam_market": { "enabled": false },\n    "commercial_viability": { "enabled": false },\n    "production_readiness": { "enabled": false },\n    "coproduction": { "enabled": false }\n}\n`;
  }

  return prompt;
}

// ─── Prompts (trimmed versions for client — full detail in functions/src/prompts.ts) ──

const CORE_PROMPT = `You are a screenplay analyst evaluating CRAFT AND EXECUTION QUALITY.

Your analysis must be RIGOROUS and PROFESSIONAL. You've analyzed thousands of scripts
and understand that most professional screenplays score 4-6. A 7 is genuinely good.
An 8 is exceptional. 9s are almost never given.

CRITICAL: You are evaluating the screenplay's quality as a PIECE OF WRITING.
Do NOT let market fit, budget, regional appeal, or commercial potential influence quality scores.

SCORE ANCHORS: 10 = masterpiece (Pan's Labyrinth), 9 = exceptional (Get Out), 8 = excellent (Parasite),
7 = genuinely good, 6 = median produced film, 5 = below average, 4 = needs rewrite, 1-2 = amateur.

V6 EXECUTION-FIRST WEIGHTS:
- Execution Craft 40% (Structure 15%, Scene-Writing 15%, Dialogue 10%)
- Character System 30% (Protagonist 15%, Supporting Cast 10%, Relationships 5%)
- Conceptual Strength 20% (Premise 10%, Theme 10%)
- Voice & Tone 10%

WEIGHTED SCORE:
Execution Craft = (Structure × 0.375) + (Scene-Writing × 0.375) + (Dialogue × 0.25)
Character System = (Protagonist × 0.50) + (Supporting Cast × 0.333) + (Relationships × 0.167)
Conceptual Strength = (Premise × 0.50) + (Theme × 0.50)
FINAL = (Execution × 0.40) + (Character × 0.30) + (Concept × 0.20) + (Voice × 0.10)

CRITICAL FAILURES: MINOR -0.3, MODERATE -0.5, MAJOR -0.8, CRITICAL -1.2 (cap -3.0)

FALSE POSITIVE TRAPS — WEIGHTED TIER SYSTEM (check after scoring):

🔴 FUNDAMENTAL (weight 1.0 — hard to fix, signals deep craft issues):
1. Character Vacuum — Great atmosphere/concept but no compelling protagonist. Development can't easily add what's missing.
2. Complexity Theater — Convoluted structure creates illusion of depth. The writer may be confused about their own story.
3. Genre Confusion — Script doesn't know what it is. Marketed as one genre but executes as another. Hard to develop when the movie hasn't been found.

🟡 ADDRESSABLE (weight 0.5 — fixable in development, common for acquired scripts):
4. Premise > Execution gap (2+ pts) — Great concept, weak delivery. This is what development rewrites fix.
5. First Act Illusion — Strong opening, weaker Act 2-3. Writer has voice; structure needs editorial guidance.
6. Originality Inflation — Novel concept over-credited. Fresh idea with mediocre execution is still a valuable acquisition.
7. Dialogue Disguise — Witty dialogue masks thin plotting. Fixable if characters are strong (upgrade to 🔴 if co-triggered with Character Vacuum).
8. Tonal Whiplash — Inconsistent tone undermines scenes. Common in early drafts, fixable with a strong director.

⚪ WARNING (weight 0.0 — informational only, may be a development opportunity):
9. Second Lead Syndrome — Supporting character is more interesting than protagonist. May signal the real movie is hiding inside.

WEIGHTED VERDICT ADJUSTMENT:
- Calculate weighted_trap_score = sum of triggered trap weights
- If weighted_trap_score >= 2.0: downgrade one tier
- If weighted_trap_score >= 3.0: cap at CONSIDER
- ⚪ Warning traps are flagged but NEVER penalize the verdict

VERDICTS: PASS (<5.5), CONSIDER (5.5-7.4), RECOMMEND (>=7.5), FILM_NOW (>=8.5)
After verdict, apply the weighted false positive adjustment above.

Screenplay Title: {title}
Page Count: {page_count}
Word Count: {word_count}

SCREENPLAY TEXT:
{text}

Return ONLY this JSON structure (no other text):

{
  "title": "extracted title",
  "author": "author or 'Unknown'",
  "logline": "one-sentence premise (25-40 words)",
  "genre": "primary genre",
  "subgenres": [],
  "themes": [],
  "tone": "overall tone",
  "core_quality": {
    "execution_craft": {
      "score": 0.0,
      "structure": { "score": 0, "sub_criteria": { "act_architecture": { "score": 0, "note": "" }, "scene_necessity": { "score": 0, "note": "" }, "momentum": { "score": 0, "note": "" }, "payoff_delivery": { "score": 0, "note": "" } }, "justification": "", "page_citations": [], "weakness_identified": "" },
      "scene_writing": { "score": 0, "sub_criteria": { "scene_construction": { "score": 0, "note": "" }, "visual_storytelling": { "score": 0, "note": "" }, "economy": { "score": 0, "note": "" }, "transitions": { "score": 0, "note": "" } }, "justification": "", "page_citations": [], "weakness_identified": "" },
      "dialogue": { "score": 0, "sub_criteria": { "voice_distinction": { "score": 0, "note": "" }, "subtext_quality": { "score": 0, "note": "" }, "functionality": { "score": 0, "note": "" }, "speakability": { "score": 0, "note": "" } }, "justification": "", "page_citations": [], "weakness_identified": "" }
    },
    "character_system": {
      "score": 0.0,
      "protagonist": { "score": 0, "sub_criteria": { "goal_clarity": { "score": 0, "note": "" }, "active_agency": { "score": 0, "note": "" }, "arc_credibility": { "score": 0, "note": "" }, "investment": { "score": 0, "note": "" } }, "justification": "", "page_citations": [], "weakness_identified": "" },
      "supporting_cast": { "score": 0, "sub_criteria": { "character_distinction": { "score": 0, "note": "" }, "functional_purpose": { "score": 0, "note": "" }, "ensemble_balance": { "score": 0, "note": "" } }, "justification": "", "page_citations": [], "weakness_identified": "" },
      "relationships": { "score": 0, "sub_criteria": { "relationship_dynamics": { "score": 0, "note": "" }, "conflict_generation": { "score": 0, "note": "" }, "emotional_stakes": { "score": 0, "note": "" } }, "justification": "" }
    },
    "conceptual_strength": {
      "score": 0.0,
      "premise": { "score": 0, "sub_criteria": { "hook_clarity": { "score": 0, "note": "" }, "narrative_engine": { "score": 0, "note": "" }, "freshness": { "score": 0, "note": "" }, "execution_independence": { "score": 0, "note": "" } }, "justification": "", "page_citations": [] },
      "theme": { "score": 0, "sub_criteria": { "thematic_clarity": { "score": 0, "note": "" }, "organic_integration": { "score": 0, "note": "" }, "complexity": { "score": 0, "note": "" }, "resonance": { "score": 0, "note": "" } }, "justification": "" }
    },
    "voice_and_tone": { "score": 0, "sub_criteria": { "authorial_voice": { "score": 0, "note": "" }, "tonal_consistency": { "score": 0, "note": "" }, "genre_awareness": { "score": 0, "note": "" }, "confidence": { "score": 0, "note": "" } }, "justification": "" },
    "weighted_score": 0.00,
    "false_positive_check": {
      "traps_evaluated": [
        { "name": "character_vacuum", "triggered": false, "tier": "fundamental", "weight": 1.0, "assessment": "" },
        { "name": "complexity_theater", "triggered": false, "tier": "fundamental", "weight": 1.0, "assessment": "" },
        { "name": "genre_confusion", "triggered": false, "tier": "fundamental", "weight": 1.0, "assessment": "" },
        { "name": "premise_execution_gap", "triggered": false, "tier": "addressable", "weight": 0.5, "assessment": "" },
        { "name": "first_act_illusion", "triggered": false, "tier": "addressable", "weight": 0.5, "assessment": "" },
        { "name": "originality_inflation", "triggered": false, "tier": "addressable", "weight": 0.5, "assessment": "" },
        { "name": "dialogue_disguise", "triggered": false, "tier": "addressable", "weight": 0.5, "assessment": "" },
        { "name": "tonal_whiplash", "triggered": false, "tier": "addressable", "weight": 0.5, "assessment": "" },
        { "name": "second_lead_syndrome", "triggered": false, "tier": "warning", "weight": 0.0, "assessment": "" }
      ],
      "traps_triggered_count": 0,
      "weighted_trap_score": 0.0,
      "risk_level": "low",
      "verdict_adjustment": "none",
      "adjusted_verdict": "PASS",
      "adjustment_rationale": ""
    },
    "critical_failures": [],
    "critical_failure_total_penalty": 0.0,
    "major_weaknesses": [],
    "verdict": "PASS",
    "verdict_rationale": ""
  },
  "characters": { "protagonist": "", "antagonist": "", "supporting": [] },
  "structure_analysis": { "format_quality": "professional", "act_breaks": "", "pacing": "" },
  "standout_scenes": [],
  "comparable_films": [],
  "assessment": { "strengths": [], "weaknesses": [], "development_notes": [] },
  "executive_summary": ""
}

Score each sub-criterion 1-10. Cite page numbers for any score 7+. Identify weaknesses even for good scripts.
Return ONLY valid JSON.`;

const LENS_PROMPTS: Record<string, string> = {
  commercial: `
LENS: COMMERCIAL VIABILITY SCORE (CVS)
Rate each factor 1-3. Output in "lenses.commercial_viability":
{ "enabled": true, "assessment": { "target_audience": { "score": 1-3, "note": "" }, "high_concept": { "score": 1-3, "note": "" }, "cast_attachability": { "score": 1-3, "note": "" }, "marketing_hook": { "score": 1-3, "note": "" }, "budget_return_ratio": { "score": 1-3, "note": "" }, "comparable_success": { "score": 1-3, "note": "" }, "cvs_total": 6-18, "commercial_outlook": "", "box_office_ceiling": "", "key_commercial_strengths": [], "key_commercial_concerns": [] } }`,
  latam: `
LENS: LATIN AMERICAN MARKET FIT
Evaluating for Mexico City production company. Score cultural resonance, casting potential, theatrical appeal, marketing viability, coproduction potential (each 1-10).
Output in "lenses.latam_market": { "enabled": true, "assessment": { "cultural_resonance": { "score": 0, "rationale": "" }, "regional_casting_potential": { "score": 0, "rationale": "" }, "theatrical_appeal": { "score": 0, "rationale": "" }, "marketing_viability": { "score": 0, "rationale": "" }, "coproduction_potential": { "score": 0, "rationale": "" }, "overall_latam_score": 0.0, "recommendation": "", "specific_concerns": [], "opportunities": [] } }`,
  production: `
LENS: PRODUCTION READINESS
Score script_polish, character_casting, production_feasibility, risk_profile (each 0-100).
Output in "lenses.production_readiness": { "enabled": true, "assessment": { "script_polish": { "score": 0, "issues": [], "status": "" }, "character_casting": { "score": 0, "issues": [], "status": "" }, "production_feasibility": { "score": 0, "issues": [], "status": "" }, "risk_profile": { "score": 0, "issues": [], "status": "" }, "overall_readiness": 0, "readiness_verdict": "", "deal_breakers": [], "green_flags": [], "development_priorities": [] } }`,
  coproduction: `
LENS: CO-PRODUCTION POTENTIAL
Score mexico_us, mexico_spain, other_territories (each 1-10).
Output in "lenses.coproduction": { "enabled": true, "assessment": { "mexico_us": { "score": 0, "rationale": "" }, "mexico_spain": { "score": 0, "rationale": "" }, "other_territories": { "score": 0, "territories": [], "rationale": "" }, "best_structure": "", "overall_coproduction_score": 0.0 } }`,
};
