#!/usr/bin/env node
/**
 * migrate-v6-to-v7.mjs
 *
 * Re-analyzes all V6 screenplays (that have PDFs in Firebase Storage) using the
 * V7 Archaeology Engine, then hard-deletes all V6 Firestore docs.
 *
 * Behavior:
 *   - Skips any screenplay that already has an active V7 analysis
 *   - Resumes from .migration-progress.json if interrupted
 *   - Hard-deletes ALL V6 docs at the end regardless of individual outcome
 *
 * Usage:
 *   node scripts/migrate-v6-to-v7.mjs
 *
 * Requirements:
 *   - service-account.json in project root
 *   - functions/.env with ANTHROPIC_API_KEY
 *   - node_modules/pdf-parse
 *   - functions/node_modules/firebase-admin
 *   - functions/node_modules/@anthropic-ai/sdk
 */

import { createRequire } from 'module';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const require = createRequire(import.meta.url);
const admin   = require(join(ROOT, 'functions/node_modules/firebase-admin'));
const pdf     = require(join(ROOT, 'node_modules/pdf-parse'));
const Anthropic = require(join(ROOT, 'functions/node_modules/@anthropic-ai/sdk'));

// ─── Config ──────────────────────────────────────────────────────────────────

const SA           = JSON.parse(readFileSync(join(ROOT, 'service-account.json'), 'utf8'));
const ENV_RAW      = readFileSync(join(ROOT, 'functions/.env'), 'utf8');
const ANTHROPIC_KEY = ENV_RAW.match(/ANTHROPIC_API_KEY=(.+)/)?.[1]?.trim();
const COLLECTION   = 'uploaded_analyses';
const MODEL        = 'claude-sonnet-4-6';
const PROGRESS_FILE = join(ROOT, '.migration-progress.json');

if (!ANTHROPIC_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not found in functions/.env');
  process.exit(1);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(SA),
    storageBucket: 'lemon-screenplay-dashboard.firebasestorage.app',
  });
}

const db     = admin.firestore();
const bucket = admin.storage().bucket();
const client = new Anthropic.default({ apiKey: ANTHROPIC_KEY });

// ─── Progress ─────────────────────────────────────────────────────────────────

function loadProgress() {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8'));
  }
  return { completed: [], failed: [], startedAt: new Date().toISOString() };
}

function saveProgress(p) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function toDocId(sourceFile) {
  return (sourceFile || '')
    .replace(/[/\\]/g, '_')
    .replace(/[^a-zA-Z0-9_\-. ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 200) || `doc_${Date.now()}`;
}

function safeName(str) {
  return (str || '')
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

function parseJSON(raw) {
  const s = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  try { return JSON.parse(s); } catch {}
  const start = s.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in LLM response');
  let depth = 0, end = -1, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (esc)           { esc = false; continue; }
    if (c === '\\' && inStr) { esc = true; continue; }
    if (c === '"')     { inStr = !inStr; continue; }
    if (inStr)         continue;
    if (c === '{')     depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error('Incomplete JSON in LLM response');
  return JSON.parse(s.slice(start, end + 1));
}

// ─── Anthropic calls ──────────────────────────────────────────────────────────

async function callClaude(systemPrompt, userPrompt, maxTokens = 8000, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
      return { text, usage: { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens } };
    } catch (err) {
      if (err.status === 429 && attempt < retries) {
        const wait = 30 * attempt;
        console.log(`    Rate limited — waiting ${wait}s (attempt ${attempt}/${retries})...`);
        await sleep(wait * 1000);
        continue;
      }
      if ((err.message?.includes('ETIMEDOUT') || err.message?.includes('ECONNRESET')) && attempt < retries) {
        const wait = 10 * attempt;
        console.log(`    Network error, retrying in ${wait}s...`);
        await sleep(wait * 1000);
        continue;
      }
      throw err;
    }
  }
}

// ─── V7 Prompt Builders ───────────────────────────────────────────────────────

function buildStructurePrompt(text, meta) {
  return {
    reader: 'structure',
    systemPrompt: `You are a structural analyst evaluating a screenplay's architecture. You draw from Story Grid (Shawn Coyne), Save the Cat (Blake Snyder), John Truby's 22 steps, and K.M. Weiland's structural percentages.

You are evaluating CRAFT QUALITY ONLY. Not commercial potential. Not cultural fit. Not whether you personally like the story.

Score anchors: 10 = masterpiece structure (Parasite), 9 = exceptional (Get Out), 8 = excellent, 7 = genuinely good, 6 = median produced film, 5 = below average, 4 = needs structural rewrite, 1-3 = amateur.

Score each sub-criterion 1-10 with a one-sentence justification. Cite page numbers for any score >= 7.`,
    userPrompt: `Analyze this screenplay's STRUCTURE:

Title: ${meta.title}
Pages: ${meta.pageCount}

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
pillar_score = average of all 12 sub-scores. Return ONLY valid JSON.`,
  };
}

function buildCharacterPrompt(text, meta) {
  return {
    reader: 'character',
    systemPrompt: `You are a character psychologist evaluating a screenplay's characters, arcs, and relationship dynamics. You draw from K.M. Weiland (Creating Character Arcs), Jeff Lyons (Rapid Story Development), and Enneagram psychology.

You are evaluating CHARACTER QUALITY ONLY. Not commercial potential. Not structure.

Score anchors: 10 = masterpiece characterization (There Will Be Blood), 9 = exceptional (Parasite), 8 = excellent, 7 = genuinely good, 6 = median, 5 = below average, 4 = underdeveloped, 1-3 = amateur.

Score each sub-criterion 1-10. Cite page numbers for any score >= 7.`,
    userPrompt: `Analyze this screenplay's CHARACTERS:

Title: ${meta.title}
Pages: ${meta.pageCount}

SCREENPLAY TEXT:
${text}

Evaluate these 11 sub-criteria (each 1-10):

KM WEILAND ARC PIPELINE:
1. ghost — Backstory wound present?
2. lie — Can you state the protagonist's false belief in ONE sentence?
3. want_vs_need — Do they genuinely conflict?
4. arc_delivery — Is Lie confronted at climax through ACTIVE CHOICE?

JEFF LYONS MORAL COMPONENT:
5. moral_blind_spot — Unconscious belief poisoning relationships?
6. immoral_effect — Blind spot HURTS OTHERS ON PAGE?
7. active_vs_passive — Does protagonist CAUSE own problems?

LYONS OPPONENT TRIANGLE:
8. opponent_design — Opponent is personal and targets protagonist's vulnerabilities?

ENNEAGRAM:
9. enneagram_consistency — Behaviors match type patterns?

SUPPORTING CAST:
10. supporting_cast_function — Messenger/Helper, Complication, or Reflection?
11. star_role_potential — Would a name actor want this part?

STORY VS. SITUATION (Lyons 5-Point Test — Yes=1/No=0 each):
A. Reveals something about human condition?
B. Tests personal character to reveal deeper motivation?
C. Plot twists open windows into character?
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
    "arc_delivery": { "score": 0, "justification": "", "arc_type": "positive|negative_fall|flat|absent" },
    "moral_blind_spot": { "score": 0, "justification": "", "identified_blind_spot": "" },
    "immoral_effect": { "score": 0, "justification": "", "page_citations": [] },
    "active_vs_passive": { "score": 0, "justification": "", "verdict": "active|passive" },
    "opponent_design": { "score": 0, "justification": "" },
    "enneagram_consistency": { "score": 0, "justification": "", "likely_type": "" },
    "supporting_cast_function": { "score": 0, "justification": "" },
    "star_role_potential": { "score": 0, "justification": "" }
  },
  "story_vs_situation": {
    "human_condition": true, "tests_character": true, "twists_reveal_character": true,
    "emotional_shift": true, "moral_component_driven": true,
    "total": 5, "verdict": "story|borderline|situation"
  },
  "thematic_parallels": [],
  "red_flags": [],
  "one_sentence_verdict": ""
}
pillar_score = average of all 11 sub-scores. Return ONLY valid JSON.`,
  };
}

function buildCraftPrompt(text, meta) {
  return {
    reader: 'craft_scene',
    systemPrompt: `You are a scene-level craft analyst using Peter Russell's BMOC (Beginning, Middle, Obstacle, Climax) methodology.

Evaluate SCENE CRAFT ONLY. Not macro-structure, not character arcs.

Score anchors: 10 = masterpiece scene craft (No Country for Old Men), 9 = exceptional (Sicario), 8 = excellent, 7 = genuinely good, 6 = median, 5 = below average, 4 = flat, 1-3 = amateur.

Sample 5 scenes: one from Act 1, two from Act 2 (early and late), one from Act 3, and the climax scene.`,
    userPrompt: `Analyze this screenplay's CRAFT AND SCENE QUALITY:

Title: ${meta.title}
Pages: ${meta.pageCount}

SCREENPLAY TEXT:
${text}

SAMPLE 5 SCENES and evaluate these 10 sub-criteria (each 1-10):

BMOC:
1. beat_question_clarity — Each scene's question as binary Yes/No?
2. bmoc_architecture — Beginning, Middle, Obstacle, Climax?
3. power_shifts — Control changes hands during scenes?
4. suspense_tools — Ticking clocks, good-news/bad-news oscillations?
5. dialogue_tactic_changes — Different tactics per volley?

PURE CRAFT:
6. dialogue_voice_distinction — Cover names, still know who's speaking?
7. dialogue_subtext — Saying one thing, meaning another?
8. visual_storytelling — Show don't tell?
9. format_professionalism — Industry-standard formatting?
10. exposition_handling — Dramatized through conflict, not dumped?

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
    "format_professionalism": { "score": 0, "justification": "" },
    "exposition_handling": { "score": 0, "justification": "" }
  },
  "bmoc_failure_scan": {
    "scenes_sampled": 5,
    "failure_modes_triggered": [],
    "total_failure_modes_active": 0,
    "craft_warning": false
  },
  "sampled_scenes": [],
  "red_flags": [],
  "one_sentence_verdict": ""
}
pillar_score = average of all 10 sub-scores. Return ONLY valid JSON.`,
  };
}

function buildConceptPrompt(text, meta) {
  return {
    reader: 'concept',
    systemPrompt: `You are a concept analyst evaluating whether a screenplay's underlying idea is worth making. You draw from Save the Cat, John Truby, Jeff Lyons, and Story Grid.

Evaluate THE IDEA, not the execution.

Score anchors: 10 = masterpiece concept (The Matrix premise), 9 = exceptional (Get Out), 8 = excellent, 7 = genuinely good, 6 = median, 5 = below average, 4 = derivative, 1-3 = no concept.`,
    userPrompt: `Analyze this screenplay's CONCEPT:

Title: ${meta.title}
Pages: ${meta.pageCount}

SCREENPLAY TEXT:
${text}

Evaluate these 8 sub-criteria (each 1-10):

PREMISE POWER:
1. hook_clarity — One compelling sentence pitch?
2. narrative_engine — Concept generates conflict intrinsically?
3. freshness — Fresh take or retread?

GENRE:
4. genre_execution — Genre's obligatory scenes present?
5. genre_promise_delivery — Delivers promised emotional experience?

THEME:
6. controlling_idea — Story's argument in ONE sentence?
7. thematic_resonance — Says something about human condition?

PREMISE LINE:
8. premise_line — 4-clause premise (Protagonist + Team/Goal + Opposition + Denouement)?

Return ONLY this JSON:
{
  "reader": "concept",
  "pillar_score": 0.0,
  "sub_scores": {
    "hook_clarity": { "score": 0, "justification": "", "one_sentence_pitch": "" },
    "narrative_engine": { "score": 0, "justification": "" },
    "freshness": { "score": 0, "justification": "" },
    "genre_execution": { "score": 0, "justification": "", "genre": "" },
    "genre_promise_delivery": { "score": 0, "justification": "" },
    "controlling_idea": { "score": 0, "justification": "", "stated_controlling_idea": "" },
    "thematic_resonance": { "score": 0, "justification": "" },
    "premise_line": { "score": 0, "justification": "", "four_clause_premise": "" }
  },
  "red_flags": [],
  "one_sentence_verdict": ""
}
pillar_score = average of all 8 sub-scores. Return ONLY valid JSON.`,
  };
}

function buildEmotionPrompt(text, meta) {
  return {
    reader: 'emotional_resonance',
    systemPrompt: `You are an emotional impact analyst evaluating whether a screenplay makes the reader FEEL something.

Evaluate EMOTIONAL POWER, not craft competence or structural correctness.

Score anchors: 10 = devastating (Schindler's List), 9 = exceptional (Moonlight), 8 = excellent, 7 = genuinely good, 6 = median, 5 = below average, 4 = flat, 1-3 = no engagement.`,
    userPrompt: `Analyze this screenplay's EMOTIONAL RESONANCE:

Title: ${meta.title}
Pages: ${meta.pageCount}

SCREENPLAY TEXT:
${text}

Evaluate these 7 sub-criteria (each 1-10):

EMOTIONAL ARCHITECTURE:
1. emotional_clarity — Intended emotion identifiable in each major beat?
2. empathy_investment — Do you care what happens by page 15?
3. emotional_escalation — Emotional stakes rise through middle?

CATHARSIS:
4. catharsis_quality — Ending delivers emotional satisfaction?
5. truth — Feels TRUE about life?

PEAK MOMENTS:
6. goosebumps_moments — 2-3 scenes you'd describe to someone?

VALUE DYNAMICS:
7. value_turn_range — Scenes shift values? (Life→Death, Love→Hate)

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
  "goosebumps_scenes": [],
  "red_flags": [],
  "one_sentence_verdict": ""
}
pillar_score = average of all 7 sub-scores. Return ONLY valid JSON.`,
  };
}

function buildSynthesisPrompt(title, readerReports) {
  const systemPrompt = `You are the senior reader leading a roundtable. You have 5 independent reader reports on the same screenplay. Synthesize them into a consensus verdict.

Do NOT add your own analysis. Resolve disagreements, apply quality gates, compute the final score, and write the executive summary.

WEIGHTS: Structure 40%, Character 25%, Craft 15%, Concept 10%, Emotion 10%

VERDICTS: PASS (<5.5), CONSIDER (5.5-7.4), RECOMMEND (>=7.5), FILM_NOW (>=8.5)

GATES:
1. Story vs. Situation: If Character Reader's story_vs_situation verdict is "situation" → cap at CONSIDER
2. False Positive Traps: If weighted_trap_score >= 2.0 → downgrade one tier; >= 3.0 → cap at CONSIDER

CRITICAL OUTPUT RULES:
- AUTHOR: Extract writer name(s) from title page. If not found, set to "Not found on title page".
- STRENGTHS: Minimum 4 specific, evidence-based strengths.
- WEAKNESSES vs CRITICAL FAILURES: Critical Failures = STRICT SUBSET of weaknesses that block a greenlight.
- THEMES: Minimum 2.
- LOGLINE: Must encode protagonist's flaw/wound, external situation, and transformation at stake.
- COMPARABLE FILMS: For each comp, specify what element makes it useful AND key difference.
- COMMERCIAL VIABILITY: Each factor MUST have a non-empty note.
- EXECUTIVE SUMMARY: One paragraph (4-6 sentences). What it is, why it earned this verdict, go forward?`;

  const userPrompt = `SCREENPLAY: "${title}"

READER REPORTS:
${JSON.stringify(readerReports, null, 2)}

SYNTHESIS INSTRUCTIONS:
1. CHECK AGREEMENT: Verify pillar scores vs sub-scores
2. RESOLVE DISAGREEMENTS: Document where readers conflict by 2+
3. STORY VS. SITUATION GATE: Check character reader's verdict
4. FALSE POSITIVE TRAPS:
   FUNDAMENTAL (1.0): character_vacuum, complexity_theater, genre_confusion
   ADDRESSABLE (0.5): premise_execution_gap, first_act_illusion, originality_inflation, dialogue_disguise, tonal_whiplash
   WARNING (0.0): second_lead_syndrome
5. COMPUTE: final_score = sum(pillar × weight)
6. ASSIGN VERDICT + apply gates
7. WRITE EXECUTIVE SUMMARY

Also evaluate COMMERCIAL VIABILITY lens:
target_audience, high_concept, cast_attachability, marketing_hook, budget_return_ratio, comparable_success (each 1-3 with REQUIRED non-empty note).

Return ONLY this JSON:
{
  "title": "",
  "author": "",
  "genre": "",
  "subgenres": [],
  "themes": [],
  "tone": "",
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
  "strengths": [],
  "weaknesses": [],
  "critical_failures": [],
  "development_notes": [],
  "verdict": "PASS",
  "verdict_before_adjustments": "PASS",
  "executive_summary": "",
  "comparable_films": {
    "tone": { "title": "", "structural_match": "", "key_divergence": "" },
    "structure": { "title": "", "structural_match": "", "key_divergence": "" },
    "market": { "title": "", "structural_match": "", "key_divergence": "" }
  },
  "reader_disagreements": [],
  "goosebumps_moments": [],
  "deliberate_ambiguities": [],
  "characters": { "protagonist": "", "protagonist_lie": "", "protagonist_arc_type": "", "protagonist_enneagram_type": "", "antagonist": "", "supporting": [] },
  "red_flags": [],
  "lenses": {
    "commercial": {
      "target_audience": { "score": 0, "note": "" },
      "high_concept": { "score": 0, "note": "" },
      "cast_attachability": { "score": 0, "note": "" },
      "marketing_hook": { "score": 0, "note": "" },
      "budget_return_ratio": { "score": 0, "note": "" },
      "comparable_success": { "score": 0, "note": "" }
    }
  }
}
IMPORTANT: strengths >= 4 items. themes >= 2. author != "Unknown". Return ONLY valid JSON.`;

  return { systemPrompt, userPrompt };
}

// ─── V7 Analysis Runner ───────────────────────────────────────────────────────

async function runV7Analysis(title, text, pageCount, wordCount) {
  const meta = { title, pageCount, wordCount };

  const readerBuilders = [
    buildStructurePrompt(text, meta),
    buildCharacterPrompt(text, meta),
    buildCraftPrompt(text, meta),
    buildConceptPrompt(text, meta),
    buildEmotionPrompt(text, meta),
  ];

  console.log('    Running 5 readers in parallel...');
  const settled = await Promise.allSettled(
    readerBuilders.map(async (rp) => {
      const { text: raw } = await callClaude(rp.systemPrompt, rp.userPrompt, 8000);
      const report = parseJSON(raw);
      return { reader: rp.reader, report };
    })
  );

  const readerResults = settled
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);

  const failedCount = settled.filter(r => r.status === 'rejected').length;
  if (failedCount > 0) {
    settled.filter(r => r.status === 'rejected').forEach(r => console.log(`    Reader failed: ${r.reason?.message}`));
  }

  if (readerResults.length < 3) {
    throw new Error(`Only ${readerResults.length}/5 readers completed — need at least 3`);
  }

  console.log(`    ${readerResults.length}/5 readers done. Running synthesis...`);

  const readerReports = Object.fromEntries(readerResults.map(r => [r.reader, r.report]));
  const { systemPrompt, userPrompt } = buildSynthesisPrompt(title, readerReports);
  const { text: synthRaw } = await callClaude(systemPrompt, userPrompt, 12000);
  const synthesis = parseJSON(synthRaw);

  synthesis.analysis_version = 'v7_archaeology';
  synthesis.analysis_mode = 'full';
  synthesis.reader_reports = readerReports;

  return synthesis;
}

// ─── Storage download ─────────────────────────────────────────────────────────

async function downloadPdf(title, collection) {
  const sn = safeName(title);
  const cat = collection || 'OTHER';
  const paths = [
    `screenplays/${cat}/${sn}.pdf`,
    `screenplays/${sn}.pdf`,
  ];
  for (const p of paths) {
    try {
      const [buf] = await bucket.file(p).download();
      return { buffer: buf, storagePath: p };
    } catch {}
  }
  throw new Error(`PDF not in Storage (tried ${paths.join(', ')})`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== V6 → V7 Migration ===\n');

  // Load V6 docs
  console.log('1. Loading V6 docs...');
  const v6Snap = await db.collection(COLLECTION)
    .where('analysis_version', '==', 'v6_unified')
    .get();
  const v6Docs = v6Snap.docs.map(d => ({ _firestoreId: d.id, ...d.data() }));
  console.log(`   Found ${v6Docs.length} V6 docs\n`);

  // Load existing V7 doc titles (skip these)
  console.log('2. Loading existing V7 analyses...');
  const v7Snap = await db.collection(COLLECTION)
    .where('analysis_version', '==', 'v7_archaeology')
    .get();
  const v7ActiveTitles = new Set(
    v7Snap.docs
      .filter(d => !d.data()._deleted_at)
      .map(d => {
        const data = d.data();
        return (data.analysis?.title || data.title || '').toLowerCase().trim();
      })
      .filter(Boolean)
  );
  console.log(`   ${v7ActiveTitles.size} already have V7 — will skip\n`);

  // Load progress for resumability
  const progress = loadProgress();
  const completedIds = new Set(progress.completed);
  const failedMap = new Map((progress.failed || []).map(f => [f.id, f]));

  // Filter to process
  const toProcess = v6Docs.filter(doc => {
    const title = (doc.analysis?.title || '').toLowerCase().trim();
    if (v7ActiveTitles.has(title)) return false;   // already V7
    if (completedIds.has(doc._firestoreId)) return false;  // already migrated this run
    return true;
  });

  const skipCount = v6Docs.length - toProcess.length;
  console.log(`3. Processing ${toProcess.length} screenplays (${skipCount} skip — already V7)\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const doc = toProcess[i];
    const title = doc.analysis?.title || doc.source_file || doc._firestoreId;
    const collection = doc.collection || 'OTHER';
    const num = `[${i + 1}/${toProcess.length}]`;

    console.log(`${num} ${title}`);

    try {
      // Download PDF
      const { buffer, storagePath } = await downloadPdf(title, collection);
      console.log(`    Storage: ${storagePath}`);

      // Parse PDF
      const pdfData = await pdf(buffer);
      const pageCount = pdfData.numpages;
      const text = pdfData.text;
      const wordCount = text.split(/\s+/).filter(Boolean).length;
      console.log(`    Parsed: ${pageCount} pages, ${wordCount} words`);

      // Run V7 analysis
      const analysis = await runV7Analysis(title, text, pageCount, wordCount);
      const verdict = analysis.verdict || '?';
      const score = typeof analysis.weighted_score === 'number'
        ? analysis.weighted_score.toFixed(2) : '?';
      console.log(`    Verdict: ${verdict}  Score: ${score}`);

      // Build Firestore document
      const sourceFile = doc.source_file || (title.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf');
      const docId = toDocId(sourceFile);
      const firestoreDoc = {
        source_file: sourceFile,
        analysis_model: 'claude-sonnet',
        analysis_version: 'v7_archaeology',
        lenses_enabled: ['commercial'],
        collection: collection,
        hasPdf: true,
        metadata: {
          filename: sourceFile,
          page_count: pageCount,
          word_count: wordCount,
        },
        analysis,
        v7_meta: {
          migrated_from_v6: true,
          v6_doc_id: doc._firestoreId,
          migrated_at: new Date().toISOString(),
        },
        _savedAt: new Date().toISOString(),
        _docId: docId,
      };

      await db.collection(COLLECTION).doc(docId).set(firestoreDoc);
      console.log(`    Saved: ${COLLECTION}/${docId}`);

      // Update progress
      completedIds.add(doc._firestoreId);
      progress.completed.push(doc._firestoreId);
      saveProgress(progress);
      successCount++;

    } catch (err) {
      console.error(`    ERROR: ${err.message}`);
      failedMap.set(doc._firestoreId, { id: doc._firestoreId, title, error: err.message });
      progress.failed = [...failedMap.values()];
      saveProgress(progress);
      failCount++;
    }

    console.log('');

    // Brief pause between scripts to avoid overloading API
    if (i < toProcess.length - 1) await sleep(1500);
  }

  // Hard-delete ALL V6 docs
  console.log('4. Hard-deleting all V6 docs from Firestore...');
  const batchSize = 10;
  let deletedCount = 0;
  for (let i = 0; i < v6Docs.length; i += batchSize) {
    await Promise.allSettled(
      v6Docs.slice(i, i + batchSize).map(doc =>
        db.collection(COLLECTION).doc(doc._firestoreId).delete()
      )
    );
    deletedCount += Math.min(batchSize, v6Docs.length - i);
  }
  console.log(`   Deleted ${deletedCount} V6 docs\n`);

  // Summary
  console.log('=== Summary ===');
  console.log(`  V7 analyzed (this run): ${successCount}`);
  console.log(`  Skipped (already V7):   ${skipCount}`);
  console.log(`  Failed:                 ${failCount}`);
  console.log(`  V6 docs deleted:        ${deletedCount}`);

  if (failCount > 0) {
    console.log('\nFailed screenplays:');
    for (const f of failedMap.values()) {
      console.log(`  - ${f.title}: ${f.error}`);
    }
    console.log('\nRe-run this script to retry failed screenplays.');
  } else {
    console.log('\nMigration complete. You can delete .migration-progress.json now.');
  }
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
