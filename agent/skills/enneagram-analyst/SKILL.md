---
name: enneagram-analyst
description: Analyze existing screenplays to extract Enneagram types for each character with detailed breakdowns including type, wing, current level, potential arc trajectory, and relationship dynamics. Use when user uploads a screenplay (PDF, Final Draft, or text) and asks for Enneagram analysis, character typing, arc assessment, or wants to understand why characters behave as they do. Triggers on phrases like "analyze this screenplay," "what Enneagram types are these characters," "type my characters," "extract the Enneagram," "diagnose this character," or "how can I align the arc with their type."
---

# Enneagram Analyst

Analyze screenplays to identify character Enneagram types and assess arc alignment.

## Core Methodology

This skill uses Jeff Lyons' Rapid Story Development framework combined with the Enneagram Institute's Levels of Development to provide:
1. **Type identification** based on core fears, desires, and behavioral patterns
2. **Level assessment** to pinpoint where characters sit psychologically
3. **Arc trajectory analysis** showing current path and alignment recommendations
4. **Relationship dynamics** mapping how characters serve story functions

## Analysis Workflow

### Step 1: Initial Read and Character Inventory

List all significant characters. For each, note:
- Key decisions they make (reveals motivation)
- How they respond under pressure (reveals center and type)
- What they avoid or pursue obsessively (reveals fear/desire)
- How they treat others (reveals survival strategy)

### Step 2: Type Identification

For each major character, determine:

**A. Emotional Center**
- Head (5, 6, 7): Anxiety-driven, mental processing, "what if" orientation
- Heart (2, 3, 4): Shame-driven, image/identity focus, "how am I perceived" orientation  
- Body (8, 9, 1): Anger-driven, action/control focus, "what should be done" orientation

**B. Core Pattern**
Cross-reference character behavior against type profiles in `references/type-profiles.md`:
- What do they fear most? (Core Fear)
- What do they pursue most? (Core Desire)
- How do they protect themselves? (Survival Strategy)
- What can't they see about themselves? (Blind Spot)

**C. Wing Assessment**
Identify which adjacent type flavors their behavior:
- Does the character lean toward one wing consistently?
- Do they shift wings in different contexts?

### Step 3: Level Assessment

Using `references/levels-of-development.md`, identify:

**Current Operating Level**
- Where does the character spend most of their screen time?
- Characters often fluctuate 1-2 levels depending on context

**Level Indicators**
- Levels 1-3 (Healthy): Self-aware, flexible, capable of genuine connection
- Levels 4-6 (Average): Defensive, driven by fear, using survival strategies
- Levels 7-9 (Unhealthy): Destructive patterns, blind spot fully controlling behavior

### Step 4: Arc Trajectory Analysis

**Current Arc Direction**
- Positive (ascending levels): Moving toward health/integration
- Negative (descending levels): Moving toward dysfunction/disintegration
- Flat: Maintaining level while affecting others
- Tragic: Growth achieved too late or undone

**Key Beats to Identify**
- Inciting Incident: Does it target the character's blind spot?
- Midpoint: Is there an offer to change?
- Doom Moment: Does it hit their type-specific low point?
- Climax: Is there a moment of truth regarding their blind spot?

**Arc Alignment Assessment**
Flag misalignments:
- Doom moment doesn't match type's specific low point
- Transformation happens without confronting blind spot
- Decline behaviors don't match de-evolution point
- Resolution doesn't demonstrate changed behavior

### Step 5: Relationship Dynamics Mapping

Using `references/relationship-dynamics.md`, assess:

**Opponent Analysis**
- Does opponent target protagonist's blind spots, pinches, and distortion filters?
- Is opponent based on protagonist's de-evolution point?
- Does opponent block protagonist's evolution path?

**Ally Analysis**  
- Do allies model the protagonist's evolution point?
- Do allies provide wing resources?
- Are there false allies enabling the blind spot?

**Romantic Relationship Analysis**
- What type dynamics drive the attraction?
- What type dynamics drive the conflict?
- Does the relationship serve the arc?

**Mentor Analysis**
- Does mentor embody what protagonist needs to learn?
- Is mentor a healthy version of protagonist's type or evolution point?

## Output Format

For each analyzed screenplay, provide:

### Character Breakdown (per major character)

```
CHARACTER: [Name]
TYPE: [Number] - [Name] ([Wing])
LEVEL: [Current operating level, 1-9]
CENTER: [Head/Heart/Body]

EVIDENCE:
- Core Fear Observed: [specific scene/behavior]
- Core Desire Observed: [specific scene/behavior]  
- Survival Strategy: [how they protect themselves]
- Blind Spot: [what they can't see]

CURRENT ARC:
- Direction: [Positive/Negative/Flat/Tragic]
- Starting Level: [X] → Ending Level: [Y]
- Key Transformation Moment: [scene/beat]

ARC ALIGNMENT ISSUES:
- [List any misalignments between behavior and type]

RECOMMENDATIONS:
- [Specific adjustments to align arc with type]
```

### Relationship Map

```
PROTAGONIST: [Type]
├── OPPONENT: [Type] - [How they target protagonist]
├── ALLY: [Type] - [What they model/provide]
├── LOVE INTEREST: [Type] - [Dynamic at play]
└── MENTOR: [Type] - [What they teach]

DYNAMICS ASSESSMENT:
- [What's working]
- [What's missing or misaligned]
- [Recommendations for strengthening relationships]
```

### Structural Notes

Broader observations about:
- Whether the moral component is Enneagram-consistent
- Missing character functions (e.g., no one models evolution point)
- Type clustering that creates monotony or opportunity
- Beat-by-beat suggestions for key scenes

## Reference Files

- `references/type-profiles.md` - Complete profiles for all nine types
- `references/levels-of-development.md` - Nine levels for each type with behavioral markers
- `references/relationship-dynamics.md` - Opponent, ally, lover, mentor design patterns

## Integration Notes

This skill provides character psychology analysis. For structural integration:
- Story Grid methodology connects to genre obligations and controlling idea
- Save the Cat connects to beat-by-beat structure

This skill stands alone but complements structural analysis tools.
