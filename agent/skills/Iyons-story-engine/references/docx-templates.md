# Document Generation Templates

Specifications for each .docx deliverable this skill produces. For all documents, follow the docx skill at `/mnt/skills/public/docx/SKILL.md` for technical execution.

## Universal Document Standards

- **Page size**: US Letter (12240 x 15840 DXA)
- **Margins**: 1 inch all sides (1440 DXA)
- **Font**: Arial 12pt body, Arial Bold for headings
- **Header**: Project title + character name(s)
- **Footer**: "Lyons Story Engine / Rapid Story Development (Routledge, 2020)" + page number
- **Color scheme**: Headers in dark navy (#1B2A4A), table header backgrounds in light blue (#D5E8F0), accent text in dark gray (#333333)
- **Table style**: Light gray borders (#CCCCCC), header row shaded, cell padding 80/120 DXA
- **Output path**: `/mnt/user-data/outputs/`
- **Filename pattern**: `[ProjectName]_[DocumentType].docx` (e.g., `Matadero_Moral_Component.docx`)

---

## 1. Moral Component Worksheet

**Filename**: `[Project]_Moral_Component.docx`

**Structure**:
- H1: Moral Component Worksheet
- H2: Project Info (project title, protagonist name, Enneagram type)
- H2: The Three Elements
  - **Moral Blind Spot**: Single sentence statement in bold, followed by explanation paragraph
  - **Immoral Effect**: Description of how the blind spot hurts others (visible behavior, not internal angst)
  - **Dynamic Moral Tension**: How every serious choice stems from the above
- H2: Discovery Method
  - **Worldview Question 1**: "What would they have to believe about other people to justify acting badly?" with answer
  - **Worldview Question 2**: "What would they have to believe about themselves to justify that worldview?" with answer
- H2: Enneagram Building Blocks (table format)
  - Row: Core Fear/Poison | [type-specific data]
  - Row: Core Desire/Distortion | [type-specific data]
  - Row: De-Evolution Pattern | [type → devo type, theme]
  - Row: Enneagram Low Point | [type-specific low point]
- H2: Connection Statement
  - One paragraph explicitly linking all three elements and showing how the Enneagram data supports the moral component

---

## 2. Protagonist Enneagram Profile

**Filename**: `[Project]_Protagonist_Profile.docx`

**Structure**:
- H1: Protagonist Enneagram Profile
- H2: Character Summary (name, type number + name, rationale for typing, emotional center)
- H2: Core Psychology (table with all fields: fear, poison, desire, distortion, focus of attention, survival strategy, core image)
- H2: Communication Profile (table: speaking style, speaking attitude, blind spots, distortion filters)
- H2: Conflict Profile (table: common pinches, pinch behaviors)
- H2: Story Low Point (paragraph)
- H2: Evolution and De-Evolution
  - **Evolution** (safety): Type number, theme, what healthy movement looks like
  - **De-Evolution** (fear): Type number, theme, what unhealthy movement looks like
- H2: Protagonist Change Triangle
  - **Start Statement**: Where the character begins
  - **Evolution Statement (+)**: Endpoint under safety
  - **De-Evolution Statement (-)**: Endpoint under fear

---

## 3. Protagonist Change Triangle

**Filename**: `[Project]_Change_Triangle.docx`

**Structure**:
- H1: Protagonist Change Triangle
- H2: Character Info (name, type)
- Visual representation: Three labeled sections arranged to suggest a triangle
  - **START** (top): Statement + cited Enneagram resources (focus of attention, core image, survival strategy)
  - **EVOLUTION (+)** (bottom left): Statement + cited resources (evolution point, hexad/triad circuit direction, safety theme)
  - **DE-EVOLUTION (-)** (bottom right): Statement + cited resources (de-evolution point, fear direction, low point)
- H2: Enneagram Resources Summary (table listing which specific type data supports each corner)

---

## 4. Common & Uncommon Hot Buttons Worksheet

**Filename**: `[Project]_Hot_Buttons.docx`

**Structure**:
- H1: Common & Uncommon Hot Buttons Worksheet
- H2: Character Info (name, type)
- H2: Common Pinches (table: pinch description, source in type data)
- H2: Common Pinch Behaviors (table: behavior, when triggered)
- H2: Uncommon Pinches (table: pinch description, rationale for consistency with type, writer's note)
  - Each uncommon pinch must pass three validation tests noted in a "Validation" column:
    1. Consistent with Enneagram style?
    2. Right for this individual?
    3. Fits pattern of decline or elevation?
- H2: Communication Blind Spots (bulleted list with story application)
- H2: Distortion Filters (bulleted list with story application)
- H2: Opponent's Attack Plan
  - Table: Which button | How opponent pushes it | Story moment/context

---

## 5. Opponent Triangle Worksheet

**Filename**: `[Project]_Opponent_Triangle.docx`

**Structure**:
- H1: Opponent Triangle Worksheet
- H2: Protagonist/Opponent Info (protagonist name + type, opponent name + de-evolution type)
- H2: The Triangle
  - **Pattern of Decline** (Enneagram): Type-specific deterioration pattern from type data
  - **Pattern of Decline** (Story): Custom to this character/story, beat by beat
  - **Opponent Profile** (Enneagram): From de-evolution point, worst qualities of that type
  - **Opponent Profile** (Story): Custom, how this specific opponent embodies those qualities
  - **Character Consequence**: Emotional state if protagonist never changes
  - **Action Consequence**: Plot outcome if protagonist never changes
- H2: The 8-Weapon Arsenal (table format)
  - Column 1: Weapon (the 8 categories)
  - Column 2: Enneagram Source Data (from type tables)
  - Column 3: Story Application (how opponent uses this specific weapon in this story)

---

## 6. Story Middle Architecture

**Filename**: `[Project]_Story_Middle.docx`

**Structure**:
- H1: Story Middle Architecture
- H2: Project Info
- H2: Layer 1 -- Classic Story Middle
  - Table with 7 rows: Beat Name | Content | Connection to Blind Spot (Yes/No + explanation)
  - Beats: Inciting Incident, First Reversal, Midpoint (note DUAL stakes), Second Reversal, Doom Moment/Low Point, Final Battle, Resolution
- H2: Layer 2 -- Narrative Engine Middle
  - The offer-refusal loop mapped to specific story moments
  - Table: Loop Pass # | Immoral Effect | Problem | Proactive Choice | Proactive Effect | Offer to Change | Refusal | Stakes Level
- H2: Pattern of Decline
  - Beat-by-beat showing Enneagram-consistent deterioration
  - Table: Story Beat | Protagonist Behavior | De-Evolution Indicator | Distance from De-Evolution Point
- H2: Pattern of Elevation (7 steps)
  - Table: Step # | Step Name | Story Content | Enneagram Indicator
  - 7 rows from Doom Moment through Moment of Truth
- H2: Active/Passive Check
  - One paragraph assessment: Is this middle generating an active or passive protagonist? Evidence cited.

---

## 7. Premise Line Document

**Filename**: `[Project]_Premise_Line.docx`

**Structure**:
- H1: Premise Line
- H2: Project Info
- H2: The Four Clauses (each in its own styled block)
  - **Clause 1 -- Protagonist**: Event + character (inciting incident)
  - **Clause 2 -- Team/Goal**: Core relationship + tangible goal
  - **Clause 3 -- Opposition**: Opponent + adventure milestones + midpoint complication
  - **Clause 4 -- Denouement**: Doom moment + final battle + resolution + emotional change
- H2: Combined Premise Line
  - The full premise as one or two sentences, set in bold/larger font
- H2: Structural Notes
  - Any gaps revealed by the premise line exercise. If Clause 4 was difficult to write, note what's missing and why.

---

## 8. Supporting Cast Architecture

**Filename**: `[Project]_Supporting_Cast.docx`

**Structure**:
- H1: Supporting Cast Architecture
- H2: Protagonist Info (name, type, wings, de-evolution point)
- H2: Wing-Based Cast Pool
  - Paragraph explaining the natural cast pool: wings + de-evolution type
- H2: Cast Table
  - Columns: Character Name | Enneagram Style | Wing Relationship to Protagonist | Functional Grouping | Window Into Protagonist | Team Stage Behaviors (if applicable)
  - One row per significant supporting character
- H2: Cast Balance Assessment
  - Count of characters per grouping (Messenger/Helper, Complication/Red-Herring, Reflection/Cautionary Tale)
  - Flag if Reflection characters are absent or underrepresented

---

## 9. Screenplay Structural Diagnosis

**Filename**: `[Project]_Structural_Diagnosis.docx`

**Structure**:
- H1: Screenplay Structural Diagnosis
- H2: Project Info (title, writer, draft date, pages)
- H2: Story vs Situation (5-Point Test)
  - Table: Question | Yes/No | Evidence
  - Verdict line: "This script is a [STORY/SITUATION]" with score (e.g., 4/5)
- H2: Protagonist Enneagram Typing
  - Type assignment with specific evidence from the script
- H2: Moral Component Diagnosis
  - Blind spot clarity (can it be stated in one sentence?)
  - Immoral effect visibility (hurts others or just internal?)
  - Active vs passive loop assessment
- H2: Middle Structure Audit
  - Classic layer: table of 7 beats, present/absent/weak
  - Narrative engine layer: offer-refusal loop present? protagonist causing own problems?
  - Pattern of decline: visible? Enneagram-consistent?
  - Pattern of elevation: awakening steps present or magic bounce-back?
- H2: Opposition Evaluation
  - Single personified human? De-evolution mirror? Attacks vulnerabilities? Personal? Changes?
- H2: Supporting Cast Classification
  - Table: Character | Grouping | Assessment
- H2: Premise Line Test
  - Attempt to write the 4-clause premise. Note where it breaks down.
- H2: Prioritized Recommendations
  - Numbered list, most critical first. Each recommendation: what's wrong, why it matters, what to do about it. Direct, specific, actionable. No hedging.

---

## 10. Full Development Package

**Filename**: `[Project]_Full_Development_Package.docx`

**Structure**:
- Title page with project name and date
- Table of Contents (auto-generated from headings)
- Section breaks between each document
- Assembled from all completed worksheets in step order:
  1. Moral Component Worksheet
  2. Protagonist Enneagram Profile
  3. Protagonist Change Triangle
  4. Common & Uncommon Hot Buttons
  5. Opponent Triangle
  6. Story Middle Architecture
  7. Premise Line
  8. Supporting Cast Architecture
- Only include sections that have been completed. Note any missing sections at the end.
