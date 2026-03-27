/**
 * V7 Multi-Reader Prompt Client
 *
 * Builds prompts for the 5-reader Screenplay Archaeology Engine.
 * Each reader evaluates the script independently using methodology-specific criteria.
 * The Synthesis pass resolves disagreements and produces the consensus verdict.
 *
 * Reader weights: Structure 40%, Character 25%, Craft 15%, Concept 10%, Emotion 10%
 */

import type { LensName } from './promptClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReaderName = 'structure' | 'character' | 'craft_scene' | 'concept' | 'emotional_resonance';

export interface ScriptMetadata {
  title: string;
  pageCount: number;
  wordCount: number;
}

export interface ReaderPrompt {
  reader: ReaderName;
  systemPrompt: string;
  userPrompt: string;
}

export interface SynthesisPromptInput {
  title: string;
  readerReports: Record<ReaderName, Record<string, unknown>>;
  lenses: LensName[];
  calibrationPrompt?: string;
}

// ─── Reader Weights ──────────────────────────────────────────────────────────

export const READER_WEIGHTS: Record<ReaderName, number> = {
  structure: 0.40,
  character: 0.25,
  craft_scene: 0.15,
  concept: 0.10,
  emotional_resonance: 0.10,
};

export const ALL_READERS: ReaderName[] = [
  'structure',
  'character',
  'craft_scene',
  'concept',
  'emotional_resonance',
];

// ─── Triage Prompt (Haiku — fast, cheap) ─────────────────────────────────────

export function buildTriagePrompt(
  text: string,
  metadata: ScriptMetadata,
): string {
  return `You are a script reader doing a QUICK ASSESSMENT of a screenplay.
Read the text and provide a 1-10 score and a one-sentence verdict.

Score anchors: 8+ = exceptional, 7 = genuinely good, 6 = median, 5 = below average, 4 = needs work, 1-3 = amateur.

Title: ${metadata.title}
Pages: ${metadata.pageCount}
Words: ${metadata.wordCount}

SCREENPLAY TEXT:
${text}

Return ONLY this JSON:
{
  "triage_score": 0,
  "verdict": "",
  "genre": "",
  "logline": "",
  "should_deep_analyze": false
}

Set should_deep_analyze to true if triage_score >= 5.
Return ONLY valid JSON.`;
}

// ─── Structure Reader ────────────────────────────────────────────────────────

function buildStructureReaderPrompt(text: string, metadata: ScriptMetadata): ReaderPrompt {
  const systemPrompt = `You are a structural analyst evaluating a screenplay's architecture. You draw from Story Grid (Shawn Coyne), Save the Cat (Blake Snyder), John Truby's 22 steps, and K.M. Weiland's structural percentages.

You are evaluating CRAFT QUALITY ONLY. Not commercial potential. Not cultural fit. Not whether you personally like the story.

Score anchors: 10 = masterpiece structure (Parasite), 9 = exceptional (Get Out), 8 = excellent, 7 = genuinely good, 6 = median produced film, 5 = below average, 4 = needs structural rewrite, 1-3 = amateur.

Score each sub-criterion 1-10 with a one-sentence justification. Cite page numbers for any score >= 7.`;

  const userPrompt = `Analyze this screenplay's STRUCTURE:

Title: ${metadata.title}
Pages: ${metadata.pageCount}

SCREENPLAY TEXT:
${text}

Evaluate these 12 sub-criteria (each 1-10):

STORY GRID:
1. beginning_hook — Does Act 1 (first 25%) establish world, character, stakes with an inciting incident?
2. middle_build — Does Act 2 (50%) deliver progressively escalating complications?
3. ending_payoff — Does Act 3 (25%) resolve through genre's core event?
4. inciting_incident — Clear event that upsets the balance? By page 12-15?
5. progressive_complications — Do difficulties escalate? Are they ascending in severity?
6. crisis_quality — Best Bad Choice or Irreconcilable Goods? Both options have real costs?
7. climax_delivery — Active choice by protagonist delivering genre's obligatory core event?

SAVE THE CAT:
8. beat_timing — Do the 15 beats land within expected page ranges?

WEILAND STRUCTURE:
9. first_plot_point — Point of no return at 20-25% where hero enters Lie-vs-Need arena?
10. midpoint — Hero shifts reactive to proactive at 50%?
11. third_act_turning_point — Lie appears to have won at 75%? Ghost resurfaces?

SCENE ECONOMY:
12. scene_necessity — Does every scene earn its place?

Red flags to check:
- No inciting incident by page 15
- Middle has no escalation (lateral, not ascending)
- Climax doesn't deliver genre's obligatory core event
- Act 3 < 15% of script
- No genuine crisis dilemma

Return ONLY this JSON:
{
  "reader": "structure",
  "pillar_score": 0.0,
  "sub_scores": {
    "beginning_hook": { "score": 0, "justification": "", "page_citations": [] },
    "middle_build": { "score": 0, "justification": "", "page_citations": [] },
    "ending_payoff": { "score": 0, "justification": "", "page_citations": [] },
    "inciting_incident": { "score": 0, "justification": "", "page_citations": [] },
    "progressive_complications": { "score": 0, "justification": "", "page_citations": [] },
    "crisis_quality": { "score": 0, "justification": "", "page_citations": [] },
    "climax_delivery": { "score": 0, "justification": "", "page_citations": [] },
    "beat_timing": { "score": 0, "justification": "", "page_citations": [] },
    "first_plot_point": { "score": 0, "justification": "", "page_citations": [] },
    "midpoint": { "score": 0, "justification": "", "page_citations": [] },
    "third_act_turning_point": { "score": 0, "justification": "", "page_citations": [] },
    "scene_necessity": { "score": 0, "justification": "", "page_citations": [] }
  },
  "red_flags": [],
  "one_sentence_verdict": ""
}

pillar_score = average of all 12 sub-scores.
Return ONLY valid JSON.`;

  return { reader: 'structure', systemPrompt, userPrompt };
}

// ─── Character Reader ────────────────────────────────────────────────────────

function buildCharacterReaderPrompt(text: string, metadata: ScriptMetadata): ReaderPrompt {
  const systemPrompt = `You are a character psychologist evaluating a screenplay's characters, arcs, and relationship dynamics. You draw from K.M. Weiland (Creating Character Arcs), Jeff Lyons (Rapid Story Development), and Enneagram psychology.

You are evaluating CHARACTER QUALITY ONLY. Not commercial potential. Not structure.

Score anchors: 10 = masterpiece characterization (There Will Be Blood), 9 = exceptional (Parasite), 8 = excellent, 7 = genuinely good, 6 = median, 5 = below average, 4 = underdeveloped, 1-3 = amateur.

Score each sub-criterion 1-10. Cite page numbers for any score >= 7.`;

  const userPrompt = `Analyze this screenplay's CHARACTERS:

Title: ${metadata.title}
Pages: ${metadata.pageCount}

SCREENPLAY TEXT:
${text}

Evaluate these 11 sub-criteria (each 1-10):

KM WEILAND ARC PIPELINE:
1. ghost — Backstory wound present? Something before the story the character carries?
2. lie — Can you state the protagonist's false belief in ONE sentence?
3. want_vs_need — Do they genuinely conflict? Would getting Want threaten Need?
4. arc_delivery — Is Lie confronted at climax through ACTIVE CHOICE (not something happening TO them)?

JEFF LYONS MORAL COMPONENT:
5. moral_blind_spot — Unconscious belief poisoning relationships? Statable in one sentence?
6. immoral_effect — Blind spot HURTS OTHERS ON PAGE? Not internal angst — visible damage.
7. active_vs_passive — Does protagonist CAUSE own problems (active) or do problems FIND them (passive)?

LYONS OPPONENT TRIANGLE:
8. opponent_design — Opponent is (a) single person, (b) personal, (c) targets protagonist's specific vulnerabilities?

ENNEAGRAM:
9. enneagram_consistency — Can you identify likely type? Do behaviors match type patterns?

SUPPORTING CAST:
10. supporting_cast_function — Classify each: Messenger/Helper, Complication/Red Herring, or Reflection/Cautionary Tale. Are there Reflection characters?
11. star_role_potential — Would a name actor want this part?

STORY VS. SITUATION (Lyons 5-Point Test):
Score each Yes (1) or No (0):
A. Reveals something about human condition?
B. Tests personal character to reveal deeper motivation?
C. Plot twists open windows into character (not just raise stakes)?
D. Ends in different emotional space than it began?
E. Driven by strong moral component through the middle?

Return ONLY this JSON:
{
  "reader": "character",
  "pillar_score": 0.0,
  "sub_scores": {
    "ghost": { "score": 0, "justification": "", "page_citations": [] },
    "lie": { "score": 0, "justification": "", "identified_lie": "" },
    "want_vs_need": { "score": 0, "justification": "", "want": "", "need": "" },
    "arc_delivery": { "score": 0, "justification": "", "arc_type": "positive|negative_fall|negative_corruption|negative_disillusionment|flat|absent" },
    "moral_blind_spot": { "score": 0, "justification": "", "identified_blind_spot": "" },
    "immoral_effect": { "score": 0, "justification": "", "page_citations": [] },
    "active_vs_passive": { "score": 0, "justification": "", "verdict": "active|passive" },
    "opponent_design": { "score": 0, "justification": "" },
    "enneagram_consistency": { "score": 0, "justification": "", "likely_type": "", "confidence": "high|medium|low" },
    "supporting_cast_function": { "score": 0, "justification": "", "reflection_characters_count": 0 },
    "star_role_potential": { "score": 0, "justification": "" }
  },
  "story_vs_situation": {
    "human_condition": true,
    "tests_character": true,
    "twists_reveal_character": true,
    "emotional_shift": true,
    "moral_component_driven": true,
    "total": 5,
    "verdict": "story|borderline|situation"
  },
  "red_flags": [],
  "one_sentence_verdict": ""
}

pillar_score = average of all 11 sub-scores.
Return ONLY valid JSON.`;

  return { reader: 'character', systemPrompt, userPrompt };
}

// ─── Craft & Scene Reader ────────────────────────────────────────────────────

function buildCraftSceneReaderPrompt(text: string, metadata: ScriptMetadata): ReaderPrompt {
  const systemPrompt = `You are a scene-level craft analyst using Peter Russell's BMOC (Beginning, Middle, Obstacle, Climax) methodology. You evaluate writing quality at the micro-structural level.

Evaluate SCENE CRAFT ONLY. Not macro-structure, not character arcs, not concept.

Score anchors: 10 = masterpiece scene craft (No Country for Old Men), 9 = exceptional (Sicario), 8 = excellent, 7 = genuinely good, 6 = median, 5 = below average, 4 = flat, 1-3 = amateur.

Sample 5 scenes: one from Act 1, two from Act 2 (early and late), one from Act 3, and the climax scene.`;

  const userPrompt = `Analyze this screenplay's CRAFT AND SCENE QUALITY:

Title: ${metadata.title}
Pages: ${metadata.pageCount}

SCREENPLAY TEXT:
${text}

SAMPLE 5 SCENES across the script and evaluate these 9 sub-criteria (each 1-10):

BMOC (PETER RUSSELL):
1. beat_question_clarity — Can each scene's question be phrased as binary Yes/No?
2. bmoc_architecture — Does each scene have Beginning, Middle, Obstacle, Climax points?
3. power_shifts — Does control change hands during scenes?
4. suspense_tools — Ticking clocks, good-news/bad-news oscillations, stake escalations?
5. dialogue_tactic_changes — Different tactics per volley (charm→deflection→accusation→threat)?

PURE CRAFT:
6. dialogue_voice_distinction — Cover names, still know who's speaking?
7. dialogue_subtext — Saying one thing, meaning another?
8. visual_storytelling — Show don't tell? Emotions delivered through action/image?
9. format_professionalism — Industry-standard formatting, clean action lines?

BMOC FAILURE MODE SCAN (on 5 sampled scenes):
1. Mushy beat question
2. Passive antagonist
3. No power shift
4. Missing/decorative ticking clock
5. Stakes don't escalate
6. BMOC points deliver info, not choices
7. Split beat used as cheat
8. Antagonist too weak
9. No tactic changes in dialogue
10. Surprise from random events, not character

Return ONLY this JSON:
{
  "reader": "craft_scene",
  "pillar_score": 0.0,
  "sub_scores": {
    "beat_question_clarity": { "score": 0, "justification": "" },
    "bmoc_architecture": { "score": 0, "justification": "" },
    "power_shifts": { "score": 0, "justification": "" },
    "suspense_tools": { "score": 0, "justification": "" },
    "dialogue_tactic_changes": { "score": 0, "justification": "" },
    "dialogue_voice_distinction": { "score": 0, "justification": "" },
    "dialogue_subtext": { "score": 0, "justification": "" },
    "visual_storytelling": { "score": 0, "justification": "" },
    "format_professionalism": { "score": 0, "justification": "" }
  },
  "bmoc_failure_scan": {
    "scenes_sampled": 5,
    "failure_modes_triggered": [
      { "mode": "mushy_beat_question", "scenes_affected": 0 },
      { "mode": "passive_antagonist", "scenes_affected": 0 },
      { "mode": "no_power_shift", "scenes_affected": 0 },
      { "mode": "missing_ticking_clock", "scenes_affected": 0 },
      { "mode": "stakes_dont_escalate", "scenes_affected": 0 },
      { "mode": "info_not_choices", "scenes_affected": 0 },
      { "mode": "split_beat_cheat", "scenes_affected": 0 },
      { "mode": "antagonist_too_weak", "scenes_affected": 0 },
      { "mode": "no_tactic_changes", "scenes_affected": 0 },
      { "mode": "random_surprise", "scenes_affected": 0 }
    ],
    "total_failure_modes_active": 0,
    "craft_warning": false
  },
  "sampled_scenes": [
    { "location": "Act 1", "page": 0, "beat_question": "", "bmoc_quality": "strong|adequate|weak" },
    { "location": "Act 2 early", "page": 0, "beat_question": "", "bmoc_quality": "strong|adequate|weak" },
    { "location": "Act 2 late", "page": 0, "beat_question": "", "bmoc_quality": "strong|adequate|weak" },
    { "location": "Act 3", "page": 0, "beat_question": "", "bmoc_quality": "strong|adequate|weak" },
    { "location": "Climax", "page": 0, "beat_question": "", "bmoc_quality": "strong|adequate|weak" }
  ],
  "red_flags": [],
  "one_sentence_verdict": ""
}

pillar_score = average of all 9 sub-scores. craft_warning = true if 3+ failure modes active.
Return ONLY valid JSON.`;

  return { reader: 'craft_scene', systemPrompt, userPrompt };
}

// ─── Concept Reader ──────────────────────────────────────────────────────────

function buildConceptReaderPrompt(text: string, metadata: ScriptMetadata): ReaderPrompt {
  const systemPrompt = `You are a concept analyst evaluating whether a screenplay's underlying idea is worth making. You draw from Save the Cat (Blake Snyder), John Truby, Jeff Lyons, and Story Grid.

Evaluate THE IDEA, not the execution. A brilliant concept with mediocre execution scores high here.

Score anchors: 10 = masterpiece concept (The Matrix premise), 9 = exceptional (Get Out), 8 = excellent, 7 = genuinely good, 6 = median, 5 = below average, 4 = derivative, 1-3 = no concept.`;

  const userPrompt = `Analyze this screenplay's CONCEPT:

Title: ${metadata.title}
Pages: ${metadata.pageCount}

SCREENPLAY TEXT:
${text}

Evaluate these 8 sub-criteria (each 1-10):

PREMISE POWER:
1. hook_clarity — Can you pitch this in ONE compelling sentence?
2. narrative_engine — Does the concept intrinsically generate conflict?
3. freshness — Save the Cat "same but different." Fresh take or retread?

GENRE:
4. genre_execution — Story Grid: genre's obligatory scenes present?
5. genre_promise_delivery — Delivers the emotional experience the genre promises?

THEME:
6. controlling_idea — Story Grid: story's argument about life in ONE sentence?
7. thematic_resonance — Says something about human condition? Arguable claim, not sentiment?

PREMISE LINE (LYONS):
8. premise_line — Can you write 4-clause premise (Protagonist + Team/Goal + Opposition + Denouement with emotional change)?

Return ONLY this JSON:
{
  "reader": "concept",
  "pillar_score": 0.0,
  "sub_scores": {
    "hook_clarity": { "score": 0, "justification": "", "one_sentence_pitch": "" },
    "narrative_engine": { "score": 0, "justification": "" },
    "freshness": { "score": 0, "justification": "" },
    "genre_execution": { "score": 0, "justification": "", "genre": "", "obligatory_scenes_present": [], "obligatory_scenes_missing": [] },
    "genre_promise_delivery": { "score": 0, "justification": "" },
    "controlling_idea": { "score": 0, "justification": "", "stated_controlling_idea": "" },
    "thematic_resonance": { "score": 0, "justification": "" },
    "premise_line": { "score": 0, "justification": "", "four_clause_premise": "" }
  },
  "red_flags": [],
  "one_sentence_verdict": ""
}

pillar_score = average of all 8 sub-scores.
Return ONLY valid JSON.`;

  return { reader: 'concept', systemPrompt, userPrompt };
}

// ─── Emotional Resonance Reader ──────────────────────────────────────────────

function buildEmotionalResonanceReaderPrompt(text: string, metadata: ScriptMetadata): ReaderPrompt {
  const systemPrompt = `You are an emotional impact analyst evaluating whether a screenplay makes the reader FEEL something. You draw from Peter Russell's BMOC, K.M. Weiland, Jeff Lyons, and Story Grid.

Evaluate EMOTIONAL POWER, not craft competence or structural correctness. A structurally imperfect script that makes you cry scores high here.

Score anchors: 10 = devastating (Schindler's List), 9 = exceptional (Moonlight), 8 = excellent, 7 = genuinely good, 6 = median, 5 = below average, 4 = flat, 1-3 = no engagement.`;

  const userPrompt = `Analyze this screenplay's EMOTIONAL RESONANCE:

Title: ${metadata.title}
Pages: ${metadata.pageCount}

SCREENPLAY TEXT:
${text}

Evaluate these 7 sub-criteria (each 1-10):

EMOTIONAL ARCHITECTURE:
1. emotional_clarity — Intended emotion identifiable in each major beat?
2. empathy_investment — Do you care what happens by page 15?
3. emotional_escalation — Emotional stakes rise through the middle, not just plot stakes?

CATHARSIS:
4. catharsis_quality — Ending delivers emotional satisfaction?
5. truth — Feels TRUE about life? Theme is an arguable truth, not greeting-card sentiment?

PEAK MOMENTS:
6. goosebumps_moments — Are there 2-3 scenes you'd describe to someone? That stick?

VALUE DYNAMICS:
7. value_turn_range — Scenes shift values? (Life→Death, Love→Hate, Justice→Tyranny). Wider = more power.

Return ONLY this JSON:
{
  "reader": "emotional_resonance",
  "pillar_score": 0.0,
  "sub_scores": {
    "emotional_clarity": { "score": 0, "justification": "" },
    "empathy_investment": { "score": 0, "justification": "" },
    "emotional_escalation": { "score": 0, "justification": "" },
    "catharsis_quality": { "score": 0, "justification": "" },
    "truth": { "score": 0, "justification": "" },
    "goosebumps_moments": { "score": 0, "justification": "" },
    "value_turn_range": { "score": 0, "justification": "", "value_spectrum": "" }
  },
  "goosebumps_scenes": [
    { "page": 0, "description": "", "why_it_works": "" }
  ],
  "red_flags": [],
  "one_sentence_verdict": ""
}

pillar_score = average of all 7 sub-scores.
If you cannot identify ANY goosebumps scenes, that IS the signal — score goosebumps_moments low.
Return ONLY valid JSON.`;

  return { reader: 'emotional_resonance', systemPrompt, userPrompt };
}

// ─── Synthesis Prompt ────────────────────────────────────────────────────────

export function buildSynthesisPrompt(input: SynthesisPromptInput): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are the senior reader leading a roundtable. You have 5 independent reader reports on the same screenplay. Synthesize them into a consensus verdict.

Do NOT add your own analysis. Resolve disagreements, apply quality gates, compute the final score, and write the executive summary.

WEIGHTS: Structure 40%, Character 25%, Craft 15%, Concept 10%, Emotion 10%

VERDICTS: PASS (<5.5), CONSIDER (5.5-7.4), RECOMMEND (>=7.5), FILM_NOW (>=8.5)

GATES:
1. Story vs. Situation: If Character Reader's story_vs_situation verdict is "situation" → cap at CONSIDER
2. False Positive Traps: If weighted_trap_score >= 2.0 → downgrade one tier; >= 3.0 → cap at CONSIDER

EXECUTIVE SUMMARY: One paragraph (4-6 sentences). What it is, why it earned this verdict, should you go forward. NO development notes, NO prescriptions.`;

  let userPrompt = `SCREENPLAY: "${input.title}"

READER REPORTS:
${JSON.stringify(input.readerReports, null, 2)}

SYNTHESIS INSTRUCTIONS:

1. CHECK AGREEMENT: For each pillar score, verify consistency with sub-scores
2. RESOLVE DISAGREEMENTS: Document where readers conflict by 2+ and why
3. STORY VS. SITUATION GATE: Check character reader's story_vs_situation verdict
4. FALSE POSITIVE TRAPS: Check using cross-reader data:
   🔴 FUNDAMENTAL (weight 1.0): character_vacuum (char: star_role<5 AND supporting<5), complexity_theater (struct: scene_necessity<5 AND complications<5), genre_confusion (concept: genre_execution<5 AND promise<5)
   🟡 ADDRESSABLE (weight 0.5): premise_execution_gap (concept pillar - avg(struct,craft) >= 2.0), first_act_illusion (struct: beginning>=7 AND (middle<5 OR ending<5)), originality_inflation (concept: freshness>=7 AND craft pillar<5), dialogue_disguise (craft: voice>=7 AND struct: complications<5), tonal_whiplash (emotion: clarity<5 AND craft: format>=6)
   ⚪ WARNING (weight 0.0): second_lead_syndrome (char: supporting>=7 AND star_role<5)
5. COMPUTE: final_score = sum(pillar × weight)
6. ASSIGN VERDICT + apply gates
7. WRITE EXECUTIVE SUMMARY: 1 paragraph, include whether to go forward
8. LIST 3 COMPARABLE FILMS: tone comp, structure comp, market comp`;

  // Inject calibration if present
  if (input.calibrationPrompt?.trim()) {
    userPrompt += `\n\n═══ PRODUCER CALIBRATION ═══\n${input.calibrationPrompt.trim()}\nApply these biases to the synthesis without overriding the methodology.\n`;
  }

  // Add lens instructions if requested
  if (input.lenses.length > 0) {
    userPrompt += `\n\nAlso evaluate these optional LENSES and include in the output:\n`;
    if (input.lenses.includes('commercial')) userPrompt += `- COMMERCIAL VIABILITY: target_audience, high_concept, cast_attachability, marketing_hook, budget_return_ratio, comparable_success (each 1-3)\n`;
    if (input.lenses.includes('latam')) userPrompt += `- LATAM MARKET FIT: cultural_resonance, regional_casting, theatrical_appeal, marketing_viability, coproduction_potential (each 1-10)\n`;
    if (input.lenses.includes('production')) userPrompt += `- PRODUCTION READINESS: script_polish, character_casting, production_feasibility, risk_profile (each 0-100)\n`;
    if (input.lenses.includes('coproduction')) userPrompt += `- CO-PRODUCTION: mexico_us, mexico_spain, other_territories (each 1-10)\n`;
  }

  userPrompt += `

Return ONLY this JSON:
{
  "title": "",
  "author": "",
  "genre": "",
  "subgenres": [],
  "logline": "",
  "analysis_version": "v7_archaeology",
  "pillar_scores": {
    "structure": { "score": 0, "weight": 0.40 },
    "character": { "score": 0, "weight": 0.25 },
    "craft_scene": { "score": 0, "weight": 0.15 },
    "concept": { "score": 0, "weight": 0.10 },
    "emotional_resonance": { "score": 0, "weight": 0.10 }
  },
  "weighted_score": 0.00,
  "story_vs_situation": { "score": 0, "verdict": "story|borderline|situation", "gate_applied": false },
  "false_positive_check": {
    "traps_evaluated": [
      { "name": "character_vacuum", "triggered": false, "tier": "fundamental", "weight": 1.0, "evidence": "" },
      { "name": "complexity_theater", "triggered": false, "tier": "fundamental", "weight": 1.0, "evidence": "" },
      { "name": "genre_confusion", "triggered": false, "tier": "fundamental", "weight": 1.0, "evidence": "" },
      { "name": "premise_execution_gap", "triggered": false, "tier": "addressable", "weight": 0.5, "evidence": "" },
      { "name": "first_act_illusion", "triggered": false, "tier": "addressable", "weight": 0.5, "evidence": "" },
      { "name": "originality_inflation", "triggered": false, "tier": "addressable", "weight": 0.5, "evidence": "" },
      { "name": "dialogue_disguise", "triggered": false, "tier": "addressable", "weight": 0.5, "evidence": "" },
      { "name": "tonal_whiplash", "triggered": false, "tier": "addressable", "weight": 0.5, "evidence": "" },
      { "name": "second_lead_syndrome", "triggered": false, "tier": "warning", "weight": 0.0, "evidence": "" }
    ],
    "weighted_trap_score": 0.0,
    "verdict_adjustment": "none|downgrade_one|cap_consider"
  },
  "verdict": "PASS",
  "verdict_before_adjustments": "PASS",
  "executive_summary": "",
  "comparable_films": {
    "tone": { "title": "", "similarity": "" },
    "structure": { "title": "", "similarity": "" },
    "market": { "title": "", "similarity": "" }
  },
  "reader_disagreements": [],
  "goosebumps_moments": [],
  "characters": { "protagonist": "", "protagonist_lie": "", "protagonist_arc_type": "", "protagonist_enneagram_type": "", "antagonist": "", "supporting": [] },
  "red_flags": [],
  "lenses": {}
}

Return ONLY valid JSON.`;

  return { systemPrompt, userPrompt };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Build all 5 reader prompts for parallel execution */
export function buildAllReaderPrompts(
  text: string,
  metadata: ScriptMetadata,
): ReaderPrompt[] {
  return [
    buildStructureReaderPrompt(text, metadata),
    buildCharacterReaderPrompt(text, metadata),
    buildCraftSceneReaderPrompt(text, metadata),
    buildConceptReaderPrompt(text, metadata),
    buildEmotionalResonanceReaderPrompt(text, metadata),
  ];
}

/** Build a single reader prompt by name */
export function buildReaderPrompt(
  reader: ReaderName,
  text: string,
  metadata: ScriptMetadata,
): ReaderPrompt {
  const builders: Record<ReaderName, () => ReaderPrompt> = {
    structure: () => buildStructureReaderPrompt(text, metadata),
    character: () => buildCharacterReaderPrompt(text, metadata),
    craft_scene: () => buildCraftSceneReaderPrompt(text, metadata),
    concept: () => buildConceptReaderPrompt(text, metadata),
    emotional_resonance: () => buildEmotionalResonanceReaderPrompt(text, metadata),
  };
  return builders[reader]();
}
