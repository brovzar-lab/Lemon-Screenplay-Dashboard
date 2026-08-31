---
name: logline-extractor
description: Extract compelling loglines from synopses using the Snyder-Coyne hybrid method. Combines Blake Snyder's irony-driven hooks with Story Grid's genre-value stakes. Use when processing a synopsis to generate a logline, when analyzing story premises for marketability, or when refining pitch materials. Triggers on requests to "extract logline," "generate logline from synopsis," "write a logline for this story," or any synopsis-to-logline conversion task.
---

# Snyder-Coyne Logline Extraction Method

Snyder's irony creates the hook (why someone wants to watch). Story Grid's genre-value stakes create the engine (why the story works dramatically). Combined: a logline that sells AND accurately represents the core story.

## The Seven Extractable Components

| # | Component | Source | Extract |
|---|-----------|--------|---------|
| 1 | Hero Adjective | Snyder | Single word: protagonist's flaw, wound, or ironic trait |
| 2 | Hero Type | Both | Role/identity (profession, archetype, position) |
| 3 | Inciting Incident | Story Grid | Event disrupting equilibrium, forcing action |
| 4 | Core Goal | Snyder | What they actively pursue (visible, filmable) |
| 5 | Antagonistic Force | Story Grid | Opposition: person, institution, nature, self |
| 6 | Global Value Stake | Story Grid | Genre's core value at risk (see mapping) |
| 7 | Ironic Hook | Snyder | Contradiction, reversal, fish-out-of-water element |

## Genre-Value Mapping

| Genre | Value Spectrum | Life-Value |
|-------|---------------|------------|
| Action | Life → Death | Physical survival |
| Horror | Life → Damnation | Fate worse than death |
| Thriller | Life → Fate Worse Than Death | Exposure, imprisonment, loss of self |
| Crime | Justice → Injustice | Social order vs. chaos |
| Love Story | Love → Hate (via Indifference) | Emotional survival |
| Status (Domestic) | Success → Failure | Self-worth, belonging |
| Status (Admiration) | Respect → Shame | Reputation, legacy |
| Worldview (Maturation) | Maturity → Naivety | Psychological growth |
| Worldview (Disillusionment) | Meaning → Meaninglessness | Existential survival |
| Morality | Good → Evil | Selfishness vs. altruism |
| Performance | Respect → Shame | Mastery, achievement |

## Extraction Algorithm

Execute in sequence:

### Phase 1: Genre Lock
Scan for genre markers (obligatory scenes, conventions, setting, character types). Lock content genre first—everything flows from this.

### Phase 2: Inciting Incident
Find the "when" moment—first major disruption. Usually in first 15-20% of synopsis. Markers: "discovers," "learns," "is forced to," "must suddenly," "everything changes when."

### Phase 3: Protagonist ID
Locate: character most changed by events, character making hardest choices, character whose goal drives plot. Extract role AND defining flaw/characteristic.

### Phase 4: Goal Extraction
What does protagonist actively pursue post-inciting incident? Must be concrete, visible. "Must escape," "must find," "must stop," "must win," "must prove."

### Phase 5: Antagonistic Force
Who/what blocks the goal? Villain, institution, nature, time, internal conflict. Must create direct opposition.

### Phase 6: Stake Determination
Based on genre, identify worst-case value state. What happens if protagonist fails? Should be explicit or strongly implied in synopsis.

### Phase 7: Irony Detection
Hardest to extract. Scan for:
- Contradiction between hero type and situation (pacifist must kill)
- Reversal of expectation (divorce lawyer falls in love)
- Fish-out-of-water (city person in wilderness)
- Unlikely pairings (enemies must cooperate)
- Internal contradiction (hero's flaw prevents their goal)

## Assembly Templates

**Primary (most versatile):**
```
When [INCITING INCIDENT], a [HERO ADJECTIVE] [HERO TYPE] must [GOAL] against/despite [ANTAGONISTIC FORCE], or [STAKE based on GENRE VALUE].
```

**Irony-Forward (high-concept, comedy):**
```
A [HERO ADJECTIVE] [HERO TYPE] — the [IRONIC ELEMENT] — must [GOAL] when [INCITING INCIDENT], before [STAKE].
```

**Stakes-Forward (thriller, horror):**
```
[STAKE] awaits a [HERO ADJECTIVE] [HERO TYPE] who must [GOAL] after [INCITING INCIDENT] pits them against [ANTAGONISTIC FORCE].
```

## Validation Tests

Assembled logline must pass all six:

| Test | Question | Fail If |
|------|----------|---------|
| Irony | Contains compelling contradiction/hook? | Sounds generic, interchangeable |
| Genre | Content genre identifiable? | Unclear what kind of story |
| Primal Stakes | Connects to survival (physical/emotional/psychological)? | Stakes abstract or low |
| Visual | Can picture scenes from reading? | Too internal, conceptual |
| Casting | Can imagine star wanting this role? | Protagonist passive or generic |
| "So What" | Provokes curiosity or emotional response? | Information without intrigue |

If any test fails, revise by strengthening that specific element.

## Structured Output Format

When extracting, return components as structured data before assembly:

```json
{
  "genre": {
    "primary": "string",
    "secondary": "string or null",
    "confidence": 0.0-1.0
  },
  "components": {
    "hero_adjective": "string",
    "hero_type": "string", 
    "inciting_incident": "string",
    "goal": "string",
    "antagonistic_force": "string",
    "value_stake": "string",
    "ironic_hook": "string or null"
  },
  "assembled_logline": "string",
  "template_used": "primary|irony-forward|stakes-forward",
  "validation": {
    "irony_test": true/false,
    "genre_test": true/false,
    "stakes_test": true/false,
    "visual_test": true/false,
    "casting_test": true/false,
    "so_what_test": true/false
  },
  "revision_notes": "string or null"
}
```

## Template Selection Logic

- **Horror/Thriller:** Use stakes-forward (lead with dread)
- **Comedy/High-Concept:** Use irony-forward (lead with hook)
- **Drama/Character Study:** Use primary (balanced approach)
- **Action:** Use primary or stakes-forward
- **Love Story:** Use primary (goal-driven) or irony-forward if opposites-attract

## Common Extraction Errors

| Error | Symptom | Fix |
|-------|---------|-----|
| Generic adjective | "Determined," "brave," "young" | Find specific flaw or contradiction |
| Passive goal | "Must survive," "must cope" | Make goal active with clear endpoint |
| Missing irony | Logline is accurate but flat | Ask: what's unexpected about THIS hero in THIS situation? |
| Wrong genre lock | Stakes don't match story | Re-analyze obligatory scenes |
| Abstract stakes | "Lose everything," "face consequences" | Name the specific loss tied to genre value |
