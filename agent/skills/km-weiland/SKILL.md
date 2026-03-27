---
name: km-weiland
description: Character arc diagnosis, construction, and repair tool based on K.M. Weiland's methodology (Structuring Your Novel, Creating Character Arcs). Analyzes screenplays to detect and evaluate character arcs (positive, negative, flat), builds arcs from scratch using the Ghost > Lie > Want > Need > Theme pipeline, and generates beat-level repair plans when arcs aren't working. Covers protagonist plus up to four key secondary characters. Triggers on "character arc," "K.M. Weiland," "Weiland," "wound," "the Lie," "the Need," "want vs need," "positive arc," "negative arc," "flat arc," "character change," "why isn't my character arc working," "structure percentages," "first plot point," "midpoint," "second plot point," "pinch points," "character arc mapped to structure," "how does my character arc connect to plot," "does my character change," "internal arc," "thematic premise," "diagnose the arc," "fix the arc," "build an arc," "sub-arcs," "secondary character arcs," or any request to build, diagnose, or repair the relationship between character psychology and story structure. Even if the user just says "my character doesn't feel like they're changing" or "the arc feels off" or uploads a screenplay and asks about characters, use this skill.
---

# K.M. Weiland Character Arc Tool

A diagnostic and construction tool for character arcs in screenplays and series, based on K.M. Weiland's framework where structure IS the externalized shape of a character's internal journey.

---

## Core Principle

Every character arc starts with one question: **what does this character falsely believe about themselves or the world?** The answer to that question (the Lie) determines the Want, the Need, the Theme, the structural beats, and the climactic choice. If the Lie is unclear, every downstream beat will feel disconnected.

Structure is not a cage imposed on character. Structure is what transformation looks like from the outside. The reason Act 2 begins at 25% is because that's when a person can no longer pretend they don't have to change. The midpoint exists at 50% because that's when they stop running and start (however badly) trying.

---

## Three Modes

This tool operates in three modes. Identify which mode the user needs based on context. If unclear, ask.

### MODE 1: DIAGNOSE

**When:** User uploads a screenplay (or describes a story in detail) and wants to understand what's happening with the character arcs, whether they're working, and where they break.

**Process:**

1. **Identify the protagonist's arc type** (positive change, negative change: fall/corruption/disillusionment, or flat). State the type and the evidence.

2. **Extract the arc framework for the protagonist:**
   - Ghost (backstory wound)
   - Lie (the false belief the Ghost created)
   - Want (the external goal that serves the Lie)
   - Need (the truth that would free them from the Lie)
   - Theme (the Need stated as universal truth)

   If any element is missing or unclear in the material, flag it explicitly: "The Lie appears to be X, but it's not dramatized clearly enough to confirm."

3. **Map the arc against structure.** For each major beat, evaluate whether it's doing its arc job:

   | Beat | Page % | Arc Function | Status |
   |---|---|---|---|
   | Hook | 1-5% | Lie visible in behavior | Working / Weak / Missing |
   | Inciting Event | 10-12% | World disrupts Lie-driven status quo | Working / Weak / Missing |
   | First Plot Point | 20-25% | Hero forced into Lie-vs-Need arena, no return | Working / Weak / Missing |
   | First Pinch Point | 37-38% | Antagonistic force shows cost of the Lie | Working / Weak / Missing |
   | Midpoint | 50% | Hero shifts reactive to proactive, first move toward Need | Working / Weak / Missing |
   | Second Pinch Point | 62-63% | Partial truth challenged, Lie fights back | Working / Weak / Missing |
   | Third Act Turning Point | 75% | Lie appears to have won completely, Ghost resurfaces | Working / Weak / Missing |
   | Climax | 88-98% | Hero actively chooses Need or rejects it | Working / Weak / Missing |
   | Resolution | 98-100% | New normal reflecting the arc's truth | Working / Weak / Missing |

4. **Identify up to four secondary character arcs.** For each:
   - Name the character and their arc type
   - State their Lie/Need in one line each
   - Describe their arc relationship to the protagonist's arc (mirror, contrast, complication, cautionary, or catalyst -- see reference file for definitions)
   - Flag if the secondary arc is underdeveloped or disconnected from the protagonist's

5. **Produce the diagnostic report** using this structure:

```
# Character Arc Diagnostic: [Title]

## Protagonist Arc: [Character Name]
- **Arc Type:** [Positive Change / Negative: Fall / Negative: Corruption / Negative: Disillusionment / Flat]
- **Ghost:** [one sentence]
- **Lie:** [one sentence]
- **Want:** [one sentence]
- **Need:** [one sentence]
- **Theme:** [one sentence, stated as arguable universal truth]

### Beat Map
[The table from step 3]

### What's Working
[Specific beats and moments where the arc fires correctly]

### What's Broken
[Specific beats where the arc fails, with diagnosis of WHY -- not just "the midpoint is weak" but "the midpoint doesn't shift the hero from reactive to proactive because X"]

### Critical Disconnections
[Places where external plot and internal arc diverge -- where plot events don't force internal reckoning with the Lie]

## Secondary Arc: [Character Name]
- **Arc Type:** [type]
- **Lie/Need:** [brief]
- **Relationship to Protagonist:** [mirror / contrast / complication / cautionary / catalyst]
- **Status:** [Working / Needs Work / Underdeveloped]
- **Notes:** [what's working or broken, 2-3 sentences max]

[Repeat for each secondary character, up to four]

## Arc Ecosystem
[How the arcs interact. Do secondary arcs reinforce the theme? Does anyone embody the Lie the protagonist needs to escape? Does anyone model the Need? Are there contradictions or missed opportunities?]
```

### MODE 2: BUILD

**When:** User wants to construct a character arc from scratch, or has a character concept and needs to build the arc architecture before writing.

**Process:**

1. **Start with the Lie.** Ask: "What does your character falsely believe about themselves or the world?" If the user can't answer, work backward:
   - "What does the character choose at the climax?" (The choice reveals the Need, which reveals the Lie)
   - "What happened to them before the story that they haven't dealt with?" (The Ghost reveals the Lie)
   - "What are they afraid of that they won't admit?" (The fear often IS the Lie)

2. **Build the framework:**
   - Ghost > Lie > Want > Need > Theme
   - Confirm each element connects causally to the next
   - Confirm Want and Need genuinely conflict (if getting the Want wouldn't threaten the Need, there's no tension)

3. **Select the arc type.** Based on the intended ending:
   - Hero accepts the Need at the climax = Positive Change Arc
   - Hero rejects the Need / embraces the Lie = Negative Change Arc (specify: Fall, Corruption, or Disillusionment)
   - Hero already holds the truth, world changes around them = Flat Arc

4. **Map onto structure.** For each major beat, write a one-sentence prescription for what that beat must accomplish for THIS character's specific arc. Not generic advice -- specific to their Lie.

5. **Build secondary arcs** (if requested or if the story has clear secondary characters). For each:
   - Assign an arc type and a Lie/Need
   - Define their relationship to the protagonist's arc
   - Confirm their arc reinforces the theme (same thematic question, different answer or angle)

6. **Deliver the arc blueprint** as a structured document following the report format above, with prescriptions instead of diagnoses.

### MODE 3: FIX

**When:** User has a diagnosed arc (from Mode 1 or from their own analysis) that isn't working, and wants specific repair options.

**Process:**

1. **Confirm the diagnosis.** Restate what's broken and verify with the user. Don't skip this step -- fixing the wrong problem wastes pages.

2. **Identify the root cause.** Arc problems cascade. A weak climax is usually a symptom of a weak midpoint, which is usually a symptom of an unclear Lie. Work upstream:
   - If the climax doesn't land > check if the midpoint established the partial truth the climax completes
   - If the midpoint is flat > check if the Lie is specific enough to generate a genuine shift
   - If the Lie is vague > check if the Ghost is dramatized enough to make the Lie feel inevitable
   - If the external plot feels disconnected > check if the antagonist embodies or weaponizes the Lie

3. **Generate repair options.** For each broken beat, provide 2-3 specific alternatives. Not vague suggestions ("make it more emotional") but concrete structural moves:

```
### Midpoint Repair Options

**The problem:** [Character] doesn't shift from reactive to proactive at the midpoint. They're still just responding to events.

**Option A:** [Specific scene/beat where the character makes a choice that reflects partial acceptance of the Need. Describe what happens, what it costs, why it's still inadequate.]

**Option B:** [Different approach to the same beat. Different choice, different cost, same structural function.]

**Option C:** [Third approach if applicable.]

**Downstream impact:** Whichever option you choose, the Second Pinch Point (62-63%) needs to directly challenge the partial truth established here. Currently it [does/doesn't] do that.
```

4. **Check for cascade effects.** Any fix at one beat may require adjustments at adjacent beats. Flag these explicitly.

5. **Address secondary arc fixes** if their arcs are also broken, particularly where broken secondary arcs are weakening the protagonist's arc.

---

## The Weiland Framework: Quick Reference

### The Five Components

- **Ghost:** The backstory wound. Something happened (or didn't happen) before the story that the character carries without fully understanding it. Created the Lie.
- **Lie:** The false belief the character holds as a defense mechanism. NOT the same as the character's flaw (the flaw is behavior; the Lie is the belief producing the behavior).
- **Want:** What the hero pursues externally. Always serves the Lie at some level. Drives the visible plot.
- **Need:** The truth that would free the character. Usually the direct opposite of the Lie. Invisible to the hero in Act 1; progressively revealed.
- **Theme:** The Need stated as universal truth. Not a sentiment ("love is important") but an arguable claim ("the need for control destroys what you're trying to protect").

### Arc Types

**Positive Change Arc:** Hero begins in Lie, ends having accepted Need. Most common.

**Negative Change Arc (three variations):**
- **The Fall:** Hero begins with a truth, is corrupted, ends having accepted a Lie
- **The Corruption:** Hero begins with a Lie, is offered the Need, rejects it, embraces the Lie completely
- **The Disillusionment:** Hero begins with an idealistic Lie, forced to confront a darker truth

**Flat Arc:** Hero holds a truth from the start. The world embodies the Lie. The hero's truth changes the world (or fails to, in tragic flat arcs). Secondary characters carry the transformation arcs.

### Structure Percentages

| Beat | % | Arc Function |
|---|---|---|
| Hook | 1-5% | Lie visible in behavior, Ghost's shadow present |
| Inciting Event | 10-12% | World disrupts the hero's Lie-driven status quo |
| First Plot Point | 20-25% | Point of no return; hero enters Lie-vs-Need arena |
| First Pinch Point | 37-38% | Antagonistic force shows what happens if Lie wins |
| Midpoint | 50% | Reactive > Proactive; first genuine (inadequate) move toward Need |
| Second Pinch Point | 62-63% | Partial truth challenged; Lie fights back harder |
| Third Act Turning Point | 75% | Lie appears to win; Ghost resurfaces; darkest moment |
| Climax | 88-98% | Hero actively chooses: accept Need or reject it |
| Resolution | 98-100% | New normal under the arc's truth |

**Full structural mapping with diagnostic questions for each beat, all three arc types, and secondary arc patterns:** read `references/arc-types-and-structure.md`

---

## Common Arc Failures

Flag these when you see them. They're the most frequent problems:

- **No Lie.** A character who's basically fine and just needs to solve an external problem. No arc, no transformation, no theme.
- **Lie without Ghost.** A false belief with no backstory explanation, so it feels like a writing choice instead of a character truth.
- **Want and Need that don't conflict.** Getting the Want wouldn't threaten the Need. No tension.
- **Midpoint that doesn't shift the hero.** Nothing changes at 50% except the plot. Character stays reactive.
- **Dark Night that isn't dark enough.** At 75%, there should be no visible path forward. If obvious options remain, the Lie hasn't been tested enough.
- **Climax that resolves without a choice.** The arc resolves because of what happens TO the hero, not because of what the hero CHOOSES. Passive resolution.
- **External events that don't mirror internal arc.** Plot and character feel like two parallel stories. The antagonist doesn't represent the Lie.
- **Theme that's a sentiment.** "Love is important" can't be argued against, so it does nothing. Real themes are arguable claims.

---

## Integration With Other Skills

This tool focuses specifically on character arc architecture mapped to structure. For adjacent work:

- **Enneagram typing of characters** > use `enneagram-analyst` (existing scripts) or `enneagram-architect` (building from scratch). Feed the Enneagram type back into the Weiland framework: the Enneagram type's core fear often maps directly to the Ghost, and the type's integration direction maps to the Need.
- **Story Grid structural analysis** > use `story-grid-expert`. Weiland's percentage map and Story Grid's Five Commandments operate on the same material from different angles. The First Plot Point (Weiland) aligns with the Inciting Incident of the Global Story (Story Grid). Cross-reference for maximum precision.
- **Truby's 22 steps and genre forms** > use `truby-expert`. Truby's "moral argument" is essentially Weiland's Theme. His "weakness and need" maps to her Lie and Need. Use both when the genre demands specific structural beats Weiland's general framework doesn't specify.
- **Jeff Lyons' Rapid Story Development** > use `lyons-story-engine`. Lyons builds the story engine from Enneagram psychology; Weiland maps it to structure. They're complementary. Run Lyons first to build the moral component and opponent triangle, then use Weiland to map it onto structural percentages.
- **Scene-level writing and rewriting** > use `co-writer` or `story-ninja`. This tool diagnoses and prescribes at the beat level. For actual page-level execution (writing scenes, dialogue, rewriting drafts), hand off to the writing tools.
- **Grisanti TV methodology** > use `grisanti-series-development` or `grisanti-pilot-analysis`. For series, Grisanti's engine and dilemma framework operates at the series level while Weiland's arc maps to the pilot episode structure.

---

## Reference Files

- `references/arc-types-and-structure.md` -- Full breakdown of all arc types (positive, negative x3, flat) mapped to precise structural percentages, beat-by-beat diagnostic questions, secondary arc relationship patterns, and sub-arc construction guidelines
