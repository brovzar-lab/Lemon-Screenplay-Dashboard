---
name: grisanti-series-development
description: Develop original television series from scratch using Jen Grisanti's full methodology. Triggers when user wants to create, develop, build, or break a new TV show, series, or pilot from an idea or concept. Use for phrases like "I have an idea for a show," "help me develop a series," "build a TV pilot," "break a new show," "series development," "I want to create a TV series about," "develop this concept into a show," "what would this look like as a series," or any request to take a concept and develop it into a structured television series. This is the GENERATIVE development tool — for analyzing existing scripts, use grisanti-pilot-analysis instead. Covers the Triangle of the Wound, series trigger and dilemma, pilot trigger and dilemma, the engine, and full series architecture. Even if the user just casually mentions a TV idea, use this skill to help them develop it.
---

# Grisanti Series Development

Develop original television series from concept to pilot outline using Jen Grisanti's complete methodology — drawn from her 15+ years as a studio executive at CBS/Paramount and Spelling Television, and as Writing Instructor for NBC's Writers on the Verge.

This skill is a **generative development tool**. It takes an idea and builds it into a fully structured series and pilot. For analyzing existing pilot scripts, use `grisanti-pilot-analysis`.

## Core Principle

Every great series answers one question with total clarity: **What does your central character want, and why can't they have it?**

The answer lives at two levels — the SERIES level (the macro engine) and the PILOT level (the specific story of episode one). Both must be developed. Both must be clear. If either is muddy, the show doesn't work.

The system follows a simple chain:
- A **TRIGGER INCIDENT** forces the character into a **DILEMMA**
- The choice made in the DILEMMA defines the **GOAL**
- Every act out reflects back to this GOAL
- **OBSTACLES** escalate until the **ALL IS LOST** moment
- The central character **ACTIVELY** achieves the goal in the resolution

If you get stuck at any point, the problem is usually upstream — go back and clarify the trigger, dilemma, or goal.

---

## Workflow Modes

When the user brings a concept, **ask them how they want to work**:

### Mode A: Full Development Pass
Generate a comprehensive development document covering all elements in one pass. The user reviews and refines from there. Best for users who already have a strong sense of their concept and want to see the full architecture quickly.

### Mode B: Interactive Build
Walk through each development element sequentially, discussing and refining before moving on. Best for early-stage ideas that need excavation, or when the user wants to think through each layer.

**Always ask. Never assume.**

---

## Enneagram Integration

This skill integrates **enneagram-architect** automatically during character development. Grisanti's framework addresses the Wound, the Flaw, the Dream, and the Biggest Fear — concepts that map directly to Enneagram psychology (core wound, passion/fixation, basic desire, basic fear). When developing the central character and supporting cast in Step 3, use enneagram-architect to:

- Identify the optimal Enneagram type based on the character's wound and flaw
- Map the character's growth arc using Enneagram levels of health
- Position protagonist and antagonist types for maximum dramatic conflict
- Ensure supporting cast types create complementary and opposing dynamics

The Enneagram work enriches the Grisanti character development — it doesn't replace it. The Triangle of the Wound, the Five Questions, and the Dream/Wound/Flaw/Fear framework remain the primary structure. The Enneagram adds psychological depth and precision to those elements.

---

## Development Pipeline

Work through these elements in order. In Mode B, each becomes a conversation. In Mode A, generate all and present as a unified document.

### 1. The Concept & World (Foundation)

Before any character work, establish the **franchise**:

- **The World**: What is this world? Is there a strong engine for endless story? What twist sets it apart from what's been done?
- **The Place**: Where does the story take place? Does the location fuel the concept? Is there a central meeting place where the core cast comes together?
- **The Time**: When does the story take place? What historical or cultural context makes the concept most compelling?
- **The Hook**: The unique element that makes someone say "I've never seen THAT before." In Breaking Bad, it's a chemistry teacher cooking meth. In Mad Men, it's the secret identity inside the world.

**Format & Formula**: What is the structure of the series? Is the A story typically the case/procedural engine or the character's personal journey? What's the balance of professional to personal? Serialized, procedural, or hybrid?

### 2. Series Trigger & Dilemma (Series Architecture)

The **Series Trigger** is the macro inciting incident — the event that sets the ENTIRE series in motion. Everything traces back to this moment.

The Series Trigger answers: **WHY are we entering this story NOW?**
- It sets up the arc for Season 1
- It often establishes the emotional hook for the central character
- It sets up WHY they want WHAT they want
- The central character should REACT to the Series Trigger

The **Series Dilemma** is the impossible choice this trigger forces. A true dilemma offers at least two options, NEITHER of which is acceptable.

**Develop both sides explicitly**:
- **Option A** — What happens if they choose this path? What do they risk?
- **Option B** — What happens if they choose this path? What do they lose?

**Test**: Can you articulate both sides of the dilemma in one sentence each? If you can only articulate one side, it's not a dilemma — it's just a problem.

### 3. Central Character & Triangle of the Wound

The character's psychology drives everything. Build four elements using Grisanti's framework, then deepen with Enneagram typing via **enneagram-architect**:

**The Dream**: What does the character want most deeply?

**The Wound**: A formative childhood or early-life trauma that created an emotional void. This is backstory — we may never see it directly, but it drives everything.

**The Flaw**: The self-sabotaging behavioral pattern the wound created. This is how the character operates in the present — the recurring way they get in their own way. It's VISIBLE behavior the audience can see.

**The Biggest Fear**: What terrifies them? How does the series force them to confront it?

These form the **Triangle of the Wound**:

```
         THE WOUND
        (Childhood Trauma)
            /    \
           /      \
          /        \
    THE FLAW ---- THE REACTION
(Self-Sabotaging   (Destructive Response
    Behavior)       to Inciting Incident)
```

When the story's inciting incident hits, the wound dictates a specific, often destructive response — **The Reaction**. This is what launches the character into the series.

**The critical question**: How does the external plot create an opportunity to heal the internal dilemma?

**Enneagram Deepening**: After establishing the Dream, Wound, Flaw, and Fear, use enneagram-architect to identify the character's Enneagram type. The Grisanti Wound maps to the Enneagram core wound. The Flaw maps to the passion/fixation. The Dream maps to the basic desire. The Biggest Fear maps to the basic fear. Use the Enneagram type to validate internal consistency and deepen the character's psychology.

**Five Questions for Character Arc** (see `references/assessment.md` for full detail):
1. What is the childhood wound?
2. How does the Series Trigger split open this wound?
3. What is the negative narrative (the lie they tell themselves)?
4. What is the flaw that comes from the negative narrative?
5. How does the flaw get in the way of achieving the goal?

### 4. Pilot Trigger, Dilemma & Pursuit (Pilot Architecture)

The Pilot Trigger, Dilemma, and Pursuit are the engine of the pilot episode. They must link directly to the Series Trigger and Dilemma — the pilot conflict is the first step toward the season arc. **The pilot would not happen unless the series trigger happened first.**

**Pilot Trigger**: The specific event in Episode 1 that pushes the character into an immediate dilemma. Distinct from the Series Trigger — it's the episode-level inciting incident that flows from it.

**Pilot Dilemma**: The key choice the protagonist must make in this episode. Neither option should be easy. The choice made here defines the external goal of the pilot.

**Pilot Pursuit**: The actions the central character takes in response to the dilemma. This is where the character becomes ACTIVE, not reactive. These actions define the external goal.

### 5. Goal Architecture

Goals operate at multiple levels. All must be developed:

**External Goal (A Story)**: What does the character want to achieve? This goal drives every scene, every obstacle, every act out. All pivotal points connect back to this goal. If there's a season arc, the pilot goal should be one step toward that larger goal.

**Internal Goal (A Story)**: Why is it important to the character on an emotional level to achieve the external goal? How will achieving it change them inside? The internal goal is what makes us care.

**The Irony Test**: The most powerful goals contain irony — the character ends up in a position opposite to where they started.

**Goal-Resonance Check**: Every scene must connect to the goal. If a scene doesn't serve the goal, it doesn't belong.

### 6. Stakes & The 20-Minute Rule

Within 20 minutes of the pilot, the audience must know: **Why do I care?**

**Develop**:
- **External Stakes**: What they lose tangibly if they fail
- **Internal Stakes**: What it costs them emotionally if they fail
- What is the WORST possible outcome?

Stakes must escalate through the pilot:
- **Teaser/Act 1**: Initial establishment
- **Act 2**: Escalation
- **Act 3**: Highest point (All Is Lost)
- **Act 4**: Resolution plus new stakes for the series

### 7. Loglines

Write loglines BEFORE writing the script. The logline is the roadmap — if the logline doesn't work, the story doesn't work.

Formula: **WHO** (empathy) + **DILEMMA** (impossible choice) + **ACTION** (what they do) + **GOAL** (with irony)

Develop five loglines:
1. **Series Logline** — Big-picture logline for the entire series
2. **Pilot Logline** — Summary of the A story in the pilot
3. **Internal Logline** — The protagonist's emotional journey in the pilot
4. **B Story Logline**
5. **C Story Logline**

If the loglines don't work after all the development, something upstream is broken — diagnose which element is weak and revisit.

### 8. A/B/C Story Architecture

**A Story**: The central character's main storyline. Carries the pilot goal. Already defined in Step 4.

**B Story**: The secondary storyline. Often the personal/relational counterpart to the A story's professional/external conflict. In procedurals, if A is the case, B is the personal story. Must have its own trigger, dilemma, and goal. Must thematically elevate the A story — explore the same theme from a different angle.

**C Story**: The tertiary storyline. Often a runner providing external pressure, humor, or additional stakes. Even with less screen time, it needs a beginning, middle, and end. Must have its own trigger, dilemma, and goal.

**Each story needs**: Trigger → Dilemma → Goal → Obstacles → Escalation → "All is Lost" → Resolution

**Thematic Thread**: What single theme ties all three storylines together? The hook that connects theme, symbolism, and message across A, B, and C stories.

**Rules**:
- Acts begin and end on the A story
- B story must thematically elevate the A story (not just coexist)
- Every scene must move plot forward — character development alone isn't enough
- Balance professional and personal storylines

### 9. Pilot Structure (Teaser + 4 Acts)

The standard pilot structure is **Teaser + 4 Acts** for one-hour drama. See `references/structure.md` for full act-by-act breakdown.

Key structural principles:
- **Teaser**: Set up the world, create empathy, establish dilemma/trigger, show the flaw, end with a question
- **Act 1**: Pilot Trigger and Dilemma. **Goal MUST be crystal clear by end of Act 1.** If it's not, the rest collapses.
- **Act 2**: Active pursuit, escalating obstacles, deepening stakes. Ends on midpoint obstacle.
- **Act 3**: Escalation to the "All Is Lost" moment. Character furthest from the goal. **This is where VOICE lives.**
- **Act 4**: Resolution. Character ACTIVELY solves the goal. Show growth. Set up series stakes.

**Format determination**: Ask the user what format they're targeting (one-hour drama, half-hour comedy, half-hour cable, limited series) and build the structural outline accordingly. For alternate structures (2-act comedy, 3-act comedy, cable without breaks), see `references/structure.md`.

### 10. Episodic Structure (Episodes 2+)

After the pilot, all subsequent episodes follow the **Episodic Teaser + 4 Act** structure. See `references/structure.md` for the full episodic template.

Key differences from pilot:
- Episodic storylines are self-contained while connecting to overarching series arcs
- Backstory and world-building from the pilot can be referenced but NOT repeated in full
- Focus on NEW conflicts, challenges, and character dynamics
- Themes resonate with the pilot but are explored in new ways

### 11. Voice & Finding Your Truth

Voice is what separates a script from the hundreds on an executive's desk. It comes from going further than you ever have — having characters say things you would never say out loud because it would make you too vulnerable.

The strongest places to reveal voice are **Acts 3 and 4** — the escalating obstacle and the "all is lost" moment.

**Ask**: Where in this material does the writer hear their own truth fictionalized? Where can they go deeper?

**Universal Themes**: What universal life experience does the story tap into? Loss, betrayal, ambition, love, identity, belonging — the writer's personal interpretation of these experiences IS their voice.

### 12. The Engine & Series Sustainability

The engine is what makes the show renewable — the mechanism that generates new stories every week while maintaining the series-long arc.

**Types of engines**:
- **Franchise engine**: The world itself generates stories (hospital, law firm, police precinct)
- **Character engine**: The character's wound/flaw creates recurring conflict
- **Relationship engine**: The central relationships generate endless tension
- **Mystery engine**: An overarching mystery sustains through reveals and complications

Most strong shows have more than one engine running simultaneously.

**Development questions**:
- Where do new stories come from each week?
- What keeps the central conflict from resolving too quickly (or too slowly)?
- What does a typical episode look like after the pilot?
- What question or cliffhanger at the end of the pilot brings the audience back?

---

## Output: The Development Document

Whether generated in one pass or built interactively, the final deliverable should include:

1. **Series Logline** — One sentence, WHO + DILEMMA + ACTION + GOAL
2. **Pilot Logline** — A story summary
3. **Internal Logline** — Emotional journey
4. **The World & Engine** — The franchise, place, time, unique hook, format/formula
5. **Series Trigger & Dilemma** — The macro inciting incident and impossible choice (both sides)
6. **Central Character** — Dream, Wound, Flaw, Biggest Fear, Triangle of the Wound, Five Questions, Enneagram type and mapping
7. **Pilot Trigger, Dilemma & Pursuit** — Episode-one inciting incident, impossible choice, and active pursuit
8. **Goal Architecture** — External and internal goals at series and pilot level
9. **Stakes** — External, internal, worst-case, and escalation arc through pilot
10. **A/B/C Stories** — Each storyline's trigger, dilemma, goal, stakes, and thematic connection
11. **Pilot Structural Outline** — Teaser + 4 Act breakdown with act outs mapped to the goal
12. **Episodic Template** — What Episodes 2+ look like structurally
13. **Series Trajectory** — Season 1 arc, what the series concept looks like by end of pilot, what brings the audience back
14. **Voice Opportunities** — Where in this material the writer's truth lives, universal themes, where to go deeper

## Deliverable: Story Worksheet

The development document can also be output as a **Story Worksheet** — a Lemon Studios-branded .docx document that follows Grisanti's methodology section by section (Foundation → Series Architecture → Pilot Architecture → Loglines → A/B/C Stories → Character Arc → Structural Breakdown → Stakes Arc → Series Setup → Scene Work → Voice).

### Generating a Blank Worksheet
To produce a blank, fillable Story Worksheet .docx:
```bash
node /mnt/skills/user/grisanti-series-development/scripts/generate_worksheet.js
```
This creates `Story_Worksheet_Lemon_Studios.docx` in the working directory.

### Generating a Pre-Filled Worksheet
When the user has completed the development pipeline (Mode A or Mode B), offer to export their work as a filled-in Story Worksheet. To do this, read the `scripts/generate_worksheet.js` file, modify the fill box content to include the developed material, and generate the document. The worksheet serves as both a development tool and a reference document the writer keeps alongside the script.

---

## Quick Diagnostics

**If the concept feels generic**: The engine isn't specific enough. What makes THIS world generate stories that no other world can?

**If the character feels thin**: The Triangle of the Wound isn't fully developed. Go deeper on the childhood trauma and how it specifically creates the flaw. Cross-reference the Enneagram type — does the wound match the type's core wound?

**If the dilemma isn't landing**: Only one side is clear. Develop BOTH horns — the audience must feel why neither option is acceptable.

**If the pilot feels like all setup**: The series is starting too late. Move the series trigger earlier. "Move Act IV to Act I."

**If you can't see future seasons**: The engine is too narrow. Broaden the world, add more sources of conflict, or deepen the character's wound.

**If the goal is unclear**: It didn't stem properly from the dilemma. Revisit the dilemma first — the goal should be the character's response to the impossible choice.

**If stuck anywhere**: The problem is usually upstream. Go back and clarify the trigger, dilemma, or goal.

---

## Giving Development Notes

Structure feedback as:

1. **What's strong and why** (give the principle)
2. **What's not working and why** (give the principle)
3. **Specific suggestion** (concrete, actionable)
4. **Question for the writer** (helps them think deeper)

All notes should clarify or strengthen the central character's journey from wound through dilemma to goal.
