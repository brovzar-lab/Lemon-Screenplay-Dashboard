# AI-Assisted Rewrite Strategies

## Table of Contents

1. The 7 Rewrite Passes (Detailed)
2. Scene Surgery Protocol
3. The "Kill Your Darlings" Method
4. Tone Consistency Audit
5. Subtext Elevation Techniques
6. Pacing Diagnostics
7. Before/After Rewrite Examples

---

## 1. The 7 Rewrite Passes (Detailed)

### Pass 1: Structure

**Goal:** Ensure every scene earns its place and the architecture is sound.

**Process:**

1. Create a one-line summary for every scene
2. For each scene, ask: "If I cut this, does the story still work?"
3. If yes → cut it or merge it with another scene
4. Check act breaks: Are they in the right places?
5. Verify escalation: Does each sequence raise the stakes?

**AI Prompt:**

```
Analyze these scene summaries for structural weaknesses:
[LIST SCENE SUMMARIES]

Identify:
- Scenes that can be cut without losing story
- Scenes that should be combined
- Gaps where a scene is missing
- Pacing issues (too many similar scenes in a row)
- Act break placement (is the inciting incident too late? 
  midpoint too early?)
```

**Red Flags:**

- Scene exists only for exposition (merge into an action scene)
- Two scenes achieve the same story purpose (pick the stronger one)
- No scene turns (nothing changes from start to end of the scene)
- Protagonist absent for 10+ pages

### Pass 2: Character

**Goal:** Ensure character arcs are earned, consistent, and emotionally resonant.

**Process:**

1. Track protagonist's WANT and NEED across every act
2. Verify transformation milestones (when does each change start?)
3. Check: Does the protagonist make the story happen, or does it happen to them?
4. Ensure supporting characters have their own agendas (not just serving the plot)
5. Verify the antagonist has a legitimate point of view

**AI Prompt:**

```
Track [CHARACTER NAME]'s arc across these beats:
[KEY BEATS/SCENES]

Analyze:
- Is the character active (making choices) or passive?
- At what point does their transformation begin?
- Is the change earned or sudden?
- What scene is missing to make the arc feel complete?
- Does the character have at least one moment of surprising 
  vulnerability AND one moment of surprising strength?
```

**Integration:** Use `enneagram-v2` for psychological depth in character rewrites.

### Pass 3: Dialogue

**Goal:** Every line sounds like the character speaking, contains subtext, and serves the scene.

**The Dialogue Audit:**

```
For each scene with significant dialogue:
1. Cover character names. Can you tell who's speaking?
   NO → Rewrite for distinct voices
2. Is any line pure exposition?
   YES → Find a way to dramatize the information
3. Does any character say exactly what they feel?
   YES → Add subtext, make them talk AROUND it
4. Is any speech longer than 4 lines?
   YES → Break it up, add interruptions, or cut
5. Would removing this exchange lose anything?
   NO → Cut it
```

**AI Prompt:**

```
Rewrite this dialogue exchange with stronger subtext:
[CURRENT DIALOGUE]

Context: [Relationship, what just happened, what's at stake]

Rules:
- No character says what they actually mean
- Shorten every line by at least 30%
- Add at least one moment of silence or non-answer
- Make the power dynamic shift at least once
- Each line should do double duty (reveal character AND advance plot)
```

### Pass 4: Tension

**Goal:** Ensure the screenplay never lets the audience relax (in the wrong places).

**Tension Mapping:**

```
For each scene, rate tension 1-10:
- Scene 1: [rating]
- Scene 2: [rating]
- Scene 3: [rating]
...

RULES:
- Tension should NEVER drop below 4 for more than 2 consecutive scenes
- Overall trajectory should escalate (Act 3 higher than Act 1)
- After a 9-10 moment, one scene of 5-6 gives the audience air
- Two consecutive low-tension scenes = pacing problem
```

**Tension Tools:**

- **Dramatic irony** — Audience knows something the character doesn't
- **Ticking clocks** — Time pressure (explicit or implied)
- **Competing agendas** — Multiple characters want different things
- **Unspoken threats** — What MIGHT happen is scarier than what does
- **Questions** — Plant questions the audience needs answered

**AI Prompt:**

```
This sequence of scenes feels flat. Diagnose why and fix it:
[SCENE DESCRIPTIONS WITH TENSION RATINGS]

For each low-tension scene, suggest ONE specific addition that 
raises stakes without changing the plot. Options include:
- Adding a ticking clock
- Revealing information to the audience (dramatic irony)
- Adding a complication or reversal
- Introducing a competing agenda
- Increasing personal stakes for the protagonist
```

### Pass 5: Theme

**Goal:** Ensure the screenplay has something to say, and says it through story, not speeches.

**Theme Check:**

1. State the controlling idea in one sentence (e.g., "Justice prevails when an individual stands against corruption despite personal cost")
2. Does the climax prove or disprove this idea?
3. Does EVERY major subplot echo the theme from a different angle?
4. Is the theme expressed through CHARACTER CHOICES, not dialogue?
5. Would removing any thematic reference lose meaning?

**AI Prompt:**

```
The controlling idea of this screenplay is: [THEME]

Review these key scenes and analyze:
[SCENE DESCRIPTIONS]

1. Which scenes express the theme organically?
2. Which scenes miss the thematic opportunity?
3. Where does the theme become too on-the-nose?
4. Suggest 3 subtle ways to reinforce the theme through 
   character behavior, not dialogue
```

### Pass 6: Visual

**Goal:** Ensure this is a MOVIE, not a filmed play.

**Visual Audit Questions:**

- Can you describe 5 images from this screenplay that haunt the viewer?
- Is any important scene just two people talking in a room? Can you add physical action?
- Are environments used to externalize emotion?
- Are there visual motifs that recur and evolve?
- Would the story work as a radio play? (If yes, it's not visual enough)

**AI Prompt:**

```
This scene is too "talky." Rewrite it with stronger visual 
storytelling:
[CURRENT SCENE]

Add physical behavior, environmental interaction, and visual 
subtext. Characters should be DOING something while talking.
The location should contribute to the mood.
Cut dialogue by 40% and replace with visual beats.
```

### Pass 7: Polish

**Goal:** Every word earns its place. Professional presentation.

**Line-Level Checklist:**

- [ ] Action lines in active voice, present tense
- [ ] No paragraph longer than 3 lines
- [ ] First mention of characters = CAPS
- [ ] Consistent character names throughout
- [ ] No typos, grammar errors, or formatting issues
- [ ] Page count appropriate (90-120 for features)
- [ ] Sound design written in CAPS ("A GUNSHOT echoes")
- [ ] No parentheticals that duplicate what the dialogue conveys
- [ ] Scene headers consistent (INT./EXT. LOCATION - TIME)

## 2. Scene Surgery Protocol

When a scene isn't working but you're not sure why.

**Diagnostic Steps:**

1. **What's the scene ABOUT?** (Not plot — emotion)
2. **What CHANGES?** (Value shift from start to end)
3. **Where's the CONFLICT?** (Who wants what from whom?)
4. **Where's the TURN?** (The moment it shifts)
5. **What does the audience KNOW?** (Info advantage/disadvantage)

**If you can't answer these → the scene needs to be rewritten from concept, not polished.**

**AI Prompt:**

```
This scene isn't working. Diagnose why:
[SCENE TEXT]

Apply the 5-question diagnostic:
1. What is this scene about emotionally?
2. What value shifts (positive to negative or vice versa)?
3. Where is the conflict specifically?
4. Where does the scene turn?
5. What does the audience know that characters don't (or vice versa)?

For each missing element, suggest a specific fix.
Then rewrite the scene incorporating those fixes.
```

## 3. The "Kill Your Darlings" Method

Cutting beloved material that doesn't serve the story.

**Decision Framework:**

```
Does this moment serve the STORY or the WRITER?
├── STORY: It advances plot, develops character, or deepens theme
│   └── KEEP IT
└── WRITER: It's clever, well-written, or personally meaningful
    ├── Does removing it hurt the story?
    │   ├── YES → KEEP IT (it serves both)
    │   └── NO → CUT IT (save in a "darlings" file)
    └── Can you use the best part elsewhere?
        ├── YES → TRANSPLANT IT
        └── NO → CUT IT
```

**AI Prompt:**

```
I need to cut [X] pages from this screenplay. Currently at [Y] pages.

Here are the scene summaries with page counts:
[SCENES]

Identify the most cuttable scenes/moments, prioritizing:
1. Scenes that duplicate information given elsewhere
2. Subplots that don't connect to the main theme
3. Dialogue exchanges that run longer than necessary
4. Action sequences that don't escalate stakes
5. Transitions that can be compressed

For each suggested cut, explain what's lost and whether 
it truly matters to the audience experience.
```

## 4. Tone Consistency Audit

**Common Tone Problems:**

- Comedy scene in a thriller that breaks tension accidentally
- Tonal whiplash between scenes (horror → slapstick → horror)
- Inconsistent violence level (stylized then suddenly realistic)
- Character humor level changing without reason

**AI Prompt:**

```
Read these scene summaries and flag any tone inconsistencies:
[SCENE SUMMARIES WITH TONE NOTES]

The intended tone is: [OVERALL TONE]

Flag any scenes that break the tonal contract with the audience.
For each flagged scene, suggest how to adjust it to fit the 
overall tone while keeping its story function.
```

## 5. Subtext Elevation Techniques

**Technique 1: Object Language**
Characters communicate through objects: giving, withholding, breaking, protecting things

**Technique 2: Physical Space**
Proximity = emotional closeness. Characters moving closer/farther reveals relationship shifts

**Technique 3: The Unfinished Sentence**
What characters DON'T finish saying reveals more than what they do

**Technique 4: Deflection Dialogue**
Characters answer different questions than the ones asked

**Technique 5: The Loaded Ordinary**
Ordinary activities (cooking, driving, cleaning) become charged with unspoken meaning

**AI Prompt:**

```
Elevate the subtext in this exchange:
[CURRENT DIALOGUE]

Apply at least 2 subtext techniques:
- Object language
- Physical space manipulation
- Unfinished sentences
- Deflection dialogue
- Loaded ordinary activity

The surface conversation should seem normal. The emotional 
undercurrent should be clearly felt but never explicitly stated.
```

## 6. Pacing Diagnostics

### The Page-Turn Test

Read the screenplay and note every point where you'd stop reading:

- These are pacing problems
- Each one needs a hook, twist, or question planted before it

### Scene Length Balance

- **Under 1 page**: Good for transitions, but multiple in a row = choppy
- **1-3 pages**: Ideal for most scenes
- **3-5 pages**: Major scenes only (confrontations, set pieces)
- **Over 5 pages**: Almost certainly needs cutting

### Sequence Pacing

Group scenes into sequences (5-8 scenes each). Each sequence should:

1. Open with a mini-hook
2. Build through complications
3. End with a mini-climax that launches the next sequence

## 7. Before/After Rewrite Examples

### Exposition Rewrite

**BEFORE (on-the-nose):**

```
DETECTIVE HARRIS
I've been on the force for twenty years.
I've seen a lot of bad things. This case 
reminds me of the Morrison case from 2010.

ROOKIE
What happened in the Morrison case?

DETECTIVE HARRIS
A family was murdered. We never caught 
the killer. It haunts me to this day.
```

**AFTER (dramatized):**

```
Harris stares at the crime scene photos. His hand goes to the 
scar on his neck. Touches it. He hasn't done that in years.

ROOKIE
You okay?

Harris pins the photo to the board. Right next to a faded 
photo already there. Same staging. Same pose.

ROOKIE
When's that from?

HARRIS
Before you were born.

He walks out. The rookie looks between the photos. 
They're identical.
```

### Tension Rewrite

**BEFORE (flat):**

```
INT. RESTAURANT - NIGHT

Sarah and Tom sit across from each other. 

SARAH
I know about the money.

TOM
What money?

SARAH
The money you stole from the company.

TOM
I can explain.
```

**AFTER (tension-built):**

```
INT. RESTAURANT - NIGHT

Sarah watches Tom order the most expensive wine on 
the menu. She waits until the waiter leaves.

SARAH
Remember when we bought our first car? That 
Civic? You counted out every dollar in singles.

TOM
(smiling)
We celebrated with drive-through tacos.

SARAH
What happened to that guy?

Tom's smile fades. He sees it now — the way Sarah's hands 
rest too casually on the table. The way she hasn't touched 
her food.

TOM
Sarah—

SARAH
(sliding an envelope across the table)
I spoke to accounting.

The wine arrives. Neither of them drink.
```
