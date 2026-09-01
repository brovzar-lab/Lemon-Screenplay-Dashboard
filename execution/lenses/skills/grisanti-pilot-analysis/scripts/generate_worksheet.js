const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel,
  BorderStyle, WidthType, ShadingType, PageBreak, PageNumber, TabStopType, TabStopPosition
} = require("docx");

// ── Brand Colors ──
const DARK_BG = "1A1A2E";
const CYAN = "00D4AA";
const CORAL = "FF6B6B";
const YELLOW = "FFD93D";
const LIGHT_GRAY = "F5F5F5";
const MID_GRAY = "E0E0E0";
const DARK_TEXT = "1A1A2E";
const WHITE = "FFFFFF";
const SECTION_BG = "F0FAFA";

// ── Helpers ──
const DXA_INCH = 1440;
const PAGE_W = 12240; // US Letter
const PAGE_H = 15840;
const MARGIN = DXA_INCH;
const CONTENT_W = PAGE_W - 2 * MARGIN; // 9360

const noBorder = { style: BorderStyle.NONE, size: 0, color: WHITE };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: MID_GRAY };
const thinBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const bottomOnly = { top: noBorder, bottom: { style: BorderStyle.SINGLE, size: 4, color: CYAN }, left: noBorder, right: noBorder };

function sectionTitle(text) {
  return new Paragraph({
    spacing: { before: 360, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: CYAN, space: 4 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 28, font: "Arial", color: DARK_TEXT })]
  });
}

function partHeader(text) {
  return new Paragraph({
    spacing: { before: 480, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, font: "Arial", color: DARK_TEXT })]
  });
}

function subHeader(text) {
  return new Paragraph({
    spacing: { before: 280, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24, font: "Arial", color: DARK_TEXT })]
  });
}

function bodyText(text, opts = {}) {
  return new Paragraph({
    spacing: { before: opts.spaceBefore || 60, after: opts.spaceAfter || 60 },
    children: [new TextRun({ text, size: 21, font: "Arial", color: opts.color || "444444", italics: opts.italics || false, bold: opts.bold || false })]
  });
}

function instructionText(text) {
  return bodyText(text, { italics: true, color: "666666" });
}

function fillBox(label, height = 800) {
  const rows = [];
  // Label row
  rows.push(new TableRow({
    children: [new TableCell({
      borders: { top: thinBorder, left: thinBorder, right: thinBorder, bottom: noBorder },
      width: { size: CONTENT_W, type: WidthType.DXA },
      shading: { fill: SECTION_BG, type: ShadingType.CLEAR },
      margins: { top: 60, bottom: 0, left: 120, right: 120 },
      children: [new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({ text: label, bold: true, size: 20, font: "Arial", color: DARK_TEXT })]
      })]
    })]
  }));
  // Fill area
  rows.push(new TableRow({
    height: { value: height, rule: "atLeast" },
    children: [new TableCell({
      borders: { top: noBorder, left: thinBorder, right: thinBorder, bottom: thinBorder },
      width: { size: CONTENT_W, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: " ", size: 21, font: "Arial" })] })]
    })]
  }));
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows
  });
}

function twoColumnFill(label1, label2, height = 800) {
  const colW = Math.floor((CONTENT_W - 200) / 2);
  function col(label) {
    return new TableCell({
      borders: thinBorders,
      width: { size: colW, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [
        new Paragraph({ spacing: { before: 0, after: 40 }, children: [new TextRun({ text: label, bold: true, size: 20, font: "Arial", color: DARK_TEXT })] }),
        new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text: " ", size: 21, font: "Arial" })] })
      ]
    });
  }
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [colW, CONTENT_W - colW],
    rows: [new TableRow({ height: { value: height, rule: "atLeast" }, children: [col(label1), col(label2)] })]
  });
}

function spacer(h = 120) {
  return new Paragraph({ spacing: { before: h, after: 0 }, children: [] });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function checklistItem(text) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    indent: { left: 360 },
    children: [new TextRun({ text: "\u2610  " + text, size: 21, font: "Arial", color: "444444" })]
  });
}

// ── Build Document ──
const children = [];

// ═══════════════════════════════════════
// COVER PAGE
// ═══════════════════════════════════════
children.push(new Paragraph({ spacing: { before: 3600, after: 0 }, children: [] }));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 0, after: 120 },
  children: [new TextRun({ text: "LEMON STUDIOS", bold: true, size: 44, font: "Arial", color: CYAN })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 0, after: 60 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: CYAN, space: 8 } },
  children: [new TextRun({ text: "STORY WORKSHEET FOR WRITING A TV PILOT", bold: true, size: 36, font: "Arial", color: DARK_TEXT })]
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 200, after: 600 },
  children: [new TextRun({ text: "Based on the Methodology of Jen Grisanti", size: 24, font: "Arial", color: "666666", italics: true })]
}));

// Cover fields
const coverFields = [
  ["Project Title", ""],
  ["Writer", ""],
  ["Date", ""],
];
const coverColW1 = 2400;
const coverColW2 = CONTENT_W - coverColW1;
for (const [label] of coverFields) {
  children.push(new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [coverColW1, coverColW2],
    rows: [new TableRow({
      children: [
        new TableCell({
          borders: noBorders,
          width: { size: coverColW1, type: WidthType.DXA },
          margins: { top: 40, bottom: 40, left: 0, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: label + ":", bold: true, size: 22, font: "Arial", color: DARK_TEXT })] })]
        }),
        new TableCell({
          borders: bottomOnly,
          width: { size: coverColW2, type: WidthType.DXA },
          margins: { top: 40, bottom: 40, left: 120, right: 0 },
          children: [new Paragraph({ children: [new TextRun({ text: " ", size: 22, font: "Arial" })] })]
        })
      ]
    })]
  }));
  children.push(spacer(60));
}

// Format checkboxes
children.push(spacer(200));
children.push(new Paragraph({
  spacing: { before: 0, after: 0 },
  children: [
    new TextRun({ text: "Format:    ", bold: true, size: 22, font: "Arial", color: DARK_TEXT }),
    new TextRun({ text: "\u2610 One-Hour Drama     \u2610 Half-Hour Comedy     \u2610 Limited Series", size: 22, font: "Arial", color: "444444" }),
  ]
}));

children.push(pageBreak());

// ═══════════════════════════════════════
// HOW TO USE
// ═══════════════════════════════════════
children.push(sectionTitle("How to Use This Worksheet"));
children.push(bodyText("This worksheet is your roadmap. Complete it before writing your script. If your logline doesn\u2019t work, your story doesn\u2019t work. If your goal isn\u2019t clear by the end of Act I, your structure will collapse. Every section builds on the one before it."));
children.push(spacer(80));
children.push(bodyText("The most important question in storytelling: What does your central character want?", { bold: true }));
children.push(bodyText("If you don\u2019t know the answer, figure it out before you write a single page."));
children.push(spacer(80));
children.push(bodyText("The system follows a simple chain:", { bold: true }));
children.push(bodyText("\u2022  A TRIGGER INCIDENT forces your character into a DILEMMA."));
children.push(bodyText("\u2022  The choice made in the DILEMMA defines the GOAL."));
children.push(bodyText("\u2022  Every act out reflects back to this GOAL."));
children.push(bodyText("\u2022  OBSTACLES escalate until the ALL IS LOST moment."));
children.push(bodyText("\u2022  The central character ACTIVELY achieves the goal in the resolution."));
children.push(spacer(80));
children.push(bodyText("Work through each section in order. Don\u2019t skip ahead. If you get stuck, the problem is usually upstream\u2014go back and clarify your trigger, dilemma, or goal."));

children.push(pageBreak());

// ═══════════════════════════════════════
// PART 1: FOUNDATION
// ═══════════════════════════════════════
children.push(partHeader("PART 1: FOUNDATION"));
children.push(instructionText("Before you write a single scene, you need to know the world you\u2019re building and why it can sustain hundreds of episodes."));
children.push(spacer(80));

children.push(subHeader("The World"));
children.push(instructionText("What is your world? Is there a strong engine for endless story? The most successful series are built on worlds that generate new conflict organically. Think about what makes your arena unique\u2014what twist sets it apart from what\u2019s been done before?"));
children.push(fillBox("Your World"));
children.push(spacer(100));

children.push(subHeader("The Place"));
children.push(instructionText("Where does your story take place? Does the location fuel the concept? Is there a central meeting place where your core cast comes together?"));
children.push(fillBox("Your Place"));
children.push(spacer(100));

children.push(subHeader("The Time"));
children.push(instructionText("When does your story take place? Present day, period piece, near-future? What historical or cultural context makes your concept most compelling?"));
children.push(fillBox("Your Time Period"));
children.push(spacer(100));

children.push(subHeader("The Hook"));
children.push(instructionText("A hook is the unique element that sets your story apart. It\u2019s the thing that makes someone say \u201CI\u2019ve never seen THAT before.\u201D In Breaking Bad, it\u2019s a chemistry teacher cooking meth. In Mad Men, it\u2019s the world and the secret identity. What is yours?"));
children.push(fillBox("Your Hook"));

children.push(pageBreak());

children.push(subHeader("The Episode 100 Test"));
children.push(instructionText("Can you imagine what episode #100 looks like? If not, rethink your world. A pilot isn\u2019t just a story\u2014it\u2019s a promise of endless stories to come."));
children.push(fillBox("What does Episode 100 look like?"));
children.push(spacer(100));

children.push(subHeader("Format & Formula"));
children.push(instructionText("What is the structure of your series? Is the A story typically the case/procedural engine or the character\u2019s personal journey? What\u2019s the balance of professional to personal? Will your show be serialized, procedural, or a hybrid?"));
children.push(fillBox("Your Formula"));

children.push(pageBreak());

// ═══════════════════════════════════════
// PART 2: SERIES ARCHITECTURE
// ═══════════════════════════════════════
children.push(partHeader("PART 2: SERIES ARCHITECTURE"));
children.push(instructionText("The Series Trigger and Dilemma establish the primary conflict and emotional journey for your central character across Season 1. This is the big-picture engine that drives everything."));
children.push(spacer(80));

children.push(subHeader("Series Trigger"));
children.push(instructionText("What event or decision sets the entire series in motion? This is the inciting incident for the whole show. The Series Trigger answers: WHY are we entering this story NOW?"));
children.push(bodyText("\u2022  Your Series Trigger should set up the arc for Season 1."));
children.push(bodyText("\u2022  It often establishes the emotional hook for your central character."));
children.push(bodyText("\u2022  It sets up WHY they want WHAT they want."));
children.push(bodyText("\u2022  Your central character should REACT to the Series Trigger."));
children.push(fillBox("Series Trigger"));
children.push(spacer(100));

children.push(subHeader("Series Dilemma"));
children.push(instructionText("What is the impossible choice your character faces as a result of the Series Trigger? A dilemma means NEITHER option is comfortable\u2014your character is \u201Cbetween a rock and a hard place.\u201D Present both sides clearly. This is where all the drama comes from."));
children.push(twoColumnFill("Option A \u2014 What happens if they choose this path? What do they risk?", "Option B \u2014 What happens if they choose this path? What do they lose?", 1200));
children.push(fillBox("Series Dilemma (Full Statement)"));

children.push(pageBreak());

// ═══════════════════════════════════════
// CENTRAL CHARACTER SETUP
// ═══════════════════════════════════════
children.push(subHeader("Central Character Setup"));
children.push(instructionText("For your central character, define these four elements. They form the emotional foundation of everything that follows."));
children.push(spacer(60));
children.push(fillBox("The Dream \u2014 What does your character want most deeply?"));
children.push(spacer(80));
children.push(fillBox("The Wound \u2014 What past trauma shaped who they are?"));
children.push(spacer(80));
children.push(fillBox("The Flaw \u2014 What self-defeating behavior comes from the wound?"));
children.push(spacer(80));
children.push(fillBox("The Biggest Fear \u2014 What terrifies them? How does the series force them to confront it?"));
children.push(spacer(80));
children.push(instructionText("Ask yourself: How does the external plot create an opportunity to heal the internal dilemma?"));

children.push(pageBreak());

// ═══════════════════════════════════════
// PART 3: PILOT ARCHITECTURE (A STORY)
// ═══════════════════════════════════════
children.push(partHeader("PART 3: PILOT ARCHITECTURE (A STORY)"));
children.push(instructionText("The Pilot Trigger, Dilemma, and Pursuit are the engine of your pilot episode. They must link directly to the Series Trigger and Dilemma\u2014your pilot conflict is the first step toward the season arc. The pilot would not happen unless the series trigger happened first."));
children.push(spacer(80));

children.push(fillBox("Pilot Trigger \u2014 What specific event in the pilot pushes your central character into an immediate dilemma?"));
children.push(spacer(80));
children.push(fillBox("Pilot Dilemma \u2014 What is the key choice the protagonist must make? Neither option should be easy."));
children.push(spacer(80));
children.push(fillBox("Pilot Pursuit \u2014 What actions does the central character take in response? This is where they become ACTIVE."));
children.push(spacer(80));

children.push(subHeader("External Goal (A Story)"));
children.push(instructionText("Clearly state the external goal that emerges from the pilot dilemma. This goal drives every scene, every obstacle, every act out. If you don\u2019t know, stop here and figure it out."));
children.push(fillBox("External Goal"));
children.push(spacer(80));

children.push(subHeader("Internal Goal (A Story)"));
children.push(instructionText("Why is it important to your character on an emotional level to achieve the external goal? How will achieving it change them inside? The internal goal is what makes us care."));
children.push(fillBox("Internal Goal"));
children.push(spacer(80));

children.push(subHeader("Stakes"));
children.push(instructionText("What is the WORST that will happen if your character does not achieve the goal? Define both external and internal stakes."));
children.push(twoColumnFill("External Stakes (what they lose tangibly)", "Internal Stakes (what it costs them emotionally)", 900));

children.push(pageBreak());

// ═══════════════════════════════════════
// PART 4: LOGLINES
// ═══════════════════════════════════════
children.push(partHeader("PART 4: LOGLINES"));
children.push(instructionText("Write your loglines BEFORE writing your script. Your logline is your story\u2014it\u2019s your roadmap. If the logline doesn\u2019t work, the story doesn\u2019t work."));
children.push(spacer(40));
children.push(bodyText("Formula: WHO (empathy) + DILEMMA (impossible choice) + ACTION (what they do) + GOAL (with irony)", { bold: true }));
children.push(spacer(40));
children.push(instructionText("Example (Breaking Bad): \u201CWhen Walt, a high school chemistry teacher with a wife and a handicapped son, is given a diagnosis of terminal cancer, he turns to what he knows best, chemistry, and decides to make and distribute meth in order to have something to leave his family.\u201D"));
children.push(spacer(80));

children.push(fillBox("Series Logline \u2014 The big-picture logline for the entire series."));
children.push(spacer(80));
children.push(fillBox("Pilot Logline \u2014 A summary of the A story in the pilot episode."));
children.push(spacer(80));
children.push(fillBox("Internal Logline \u2014 The protagonist\u2019s emotional journey. Focus on internal conflict, how it drives decisions, and how it connects to the external goal."));
children.push(spacer(80));
children.push(fillBox("B Story Logline"));
children.push(spacer(80));
children.push(fillBox("C Story Logline"));

children.push(pageBreak());

// ═══════════════════════════════════════
// PART 5: A, B, AND C STORIES
// ═══════════════════════════════════════
children.push(partHeader("PART 5: A, B, AND C STORIES"));
children.push(instructionText("Your A story is the dominant storyline\u2014most act outs end here. Your B story should elevate the A story by exploring the same theme from a different angle. Your C story is often lighter, adding humor or external pressure. Each needs its own trigger, dilemma, and goal."));
children.push(spacer(80));

children.push(subHeader("A Story"));
children.push(instructionText("Your primary storyline. Already defined in Part 3."));
children.push(fillBox("A Story Summary"));
children.push(spacer(100));

children.push(subHeader("B Story"));
children.push(instructionText("The secondary storyline. Often the personal/relational counterpart to the A story\u2019s professional/external conflict. In procedurals, if A is the case, B is the personal story."));
children.push(fillBox("B Story Description"));
children.push(spacer(80));
children.push(fillBox("B Story Trigger & Dilemma"));
children.push(spacer(80));
children.push(fillBox("B Story Goal"));
children.push(spacer(80));
children.push(twoColumnFill("B Story External Stakes", "B Story Internal Stakes", 700));
children.push(spacer(80));
children.push(fillBox("B Story Theme Connection \u2014 How does the B story enhance the themes of the A story?"));

children.push(pageBreak());

children.push(subHeader("C Story"));
children.push(instructionText("The tertiary storyline. Often a runner that provides external pressure, humor, or additional stakes. Even though you spend less time here, it needs a beginning, middle, and end."));
children.push(fillBox("C Story Description"));
children.push(spacer(80));
children.push(fillBox("C Story Trigger & Dilemma"));
children.push(spacer(80));
children.push(fillBox("C Story Goal"));
children.push(spacer(80));
children.push(fillBox("C Story Theme Connection \u2014 How does the C story complement the series theme and elevate the A story?"));
children.push(spacer(100));

children.push(subHeader("Thematic Thread"));
children.push(instructionText("What single theme ties all three storylines together? Think about the hook that connects theme, symbolism, and message across your A, B, and C stories."));
children.push(fillBox("Unifying Theme"));

children.push(pageBreak());

// ═══════════════════════════════════════
// PART 6: CHARACTER ARC \u2014 FIVE QUESTIONS
// ═══════════════════════════════════════
children.push(partHeader("PART 6: CHARACTER ARC \u2014 FIVE QUESTIONS"));
children.push(instructionText("These five questions form the emotional spine of your series. Answer them clearly and your character\u2019s journey will have depth and resonance. If you can\u2019t answer them, your character isn\u2019t ready yet."));
children.push(spacer(80));

children.push(fillBox("1. What is the childhood wound of your central character? Define a past trauma or formative event\u2014something that happened BEFORE we enter the story\u2014that shaped their internal struggles, beliefs, and behavior patterns."));
children.push(spacer(80));
children.push(fillBox("2. How does the Series Trigger and Dilemma split open this wound? The series conflict should reactivate your character\u2019s deepest emotional pain. This is what makes the story feel urgent and personal."));
children.push(spacer(80));
children.push(fillBox("3. What is the negative narrative that comes from these wounds? What self-defeating beliefs does the character hold? This is the lie they tell themselves. (e.g., \u201CI\u2019m not worthy of love,\u201D \u201CIf I show weakness, I\u2019ll be destroyed\u201D)"));
children.push(spacer(80));
children.push(fillBox("4. What is the flaw that comes from the negative narrative? How does the internal lie manifest in their actions and decisions? The flaw is the VISIBLE behavior that makes the character their own worst enemy."));
children.push(spacer(80));
children.push(fillBox("5. How does the flaw/negative narrative get in the way of achieving the goal? This is the engine of internal conflict. The character\u2019s own psychology creates obstacles in their pursuit of the goal."));

children.push(pageBreak());

// ═══════════════════════════════════════
// PART 7: TEASER & ACT BREAKDOWN
// ═══════════════════════════════════════
children.push(partHeader("PART 7: TEASER & ACT BREAKDOWN"));
children.push(instructionText("Break your pilot into structural units. In every act, your central character should take action toward the goal, hit an obstacle, and there should be a reminder of the stakes. Ensure every act ends with a compelling act-out that creates anticipation."));
children.push(spacer(40));
children.push(bodyText("Structure: Teaser + 4 Acts (one-hour drama). For half-hour formats, adjust accordingly\u2014but the principles remain the same.", { bold: true }));
children.push(spacer(80));

// TEASER
children.push(sectionTitle("Teaser / Cold Open"));
children.push(instructionText("Set up the world. Create empathy for the central character. Establish the personal dilemma and/or the Series Trigger. Set up a theme. Show the flaw. End with a question the story will answer."));
children.push(fillBox("Teaser"));
children.push(spacer(60));
children.push(fillBox("Teaser Act-Out (the moment that hooks us)", 500));
children.push(spacer(100));

// ACT 1
children.push(sectionTitle("Act 1"));
children.push(instructionText("Set up the Pilot Trigger and Dilemma. Introduce key characters. Set up the conflict. By the END of this act, we must have TOTAL CLARITY on the A story goal. The B story goal is often established here too. End on the A story."));
children.push(bodyText("CRITICAL: If the goal is not clear by the end of Act 1, the rest of your story cannot build effectively.", { bold: true, color: CORAL }));
children.push(fillBox("Act 1"));
children.push(spacer(60));
children.push(fillBox("Act 1 Act-Out (Break into 2)", 500));

children.push(pageBreak());

// ACT 2
children.push(sectionTitle("Act 2"));
children.push(instructionText("Your central character actively pursues the goal. Escalate the conflict with obstacles in A and B stories. Deepen the stakes. End on an obstacle or escalating obstacle that directly gets in the way of the goal."));
children.push(fillBox("Act 2"));
children.push(spacer(60));
children.push(fillBox("Act 2 Act-Out (Midpoint)", 500));
children.push(spacer(100));

// ACT 3
children.push(sectionTitle("Act 3"));
children.push(instructionText("When your character overcomes one obstacle, present another\u2014escalate. Build toward the \u201Call is lost\u201D moment. The character should be further from the goal than ever."));
children.push(fillBox("Act 3"));
children.push(spacer(60));
children.push(fillBox("Act 3 Act-Out (All Is Lost)", 500));

children.push(pageBreak());

// ACT 4
children.push(sectionTitle("Act 4"));
children.push(instructionText("Resolution. Your central character ACTIVELY solves the goal set up in Act 1\u2014in BOTH the A and B stories. We need to see and feel the moment of achievement. Then set up the long-term stakes that will bring the audience back next week. Show growth between where the character started and where they end."));
children.push(fillBox("Act 4"));
children.push(spacer(60));
children.push(fillBox("Act 4 Act-Out (End of Pilot)", 500));

children.push(pageBreak());

// ═══════════════════════════════════════
// PART 8: STAKES ARC
// ═══════════════════════════════════════
children.push(partHeader("PART 8: STAKES ARC"));
children.push(instructionText("Stakes should escalate throughout your pilot. The audience must understand at every point what your characters have to lose\u2014both externally and internally. Map the escalation."));
children.push(spacer(80));

children.push(subHeader("A Story Stakes Arc"));
children.push(fillBox("Teaser/Act 1 Stakes"));
children.push(spacer(60));
children.push(fillBox("Act 2 Stakes (escalation)"));
children.push(spacer(60));
children.push(fillBox("Act 3 Stakes (highest point)"));
children.push(spacer(60));
children.push(fillBox("Act 4 Stakes (resolution and new stakes for series)"));
children.push(spacer(100));

children.push(subHeader("B Story Stakes Arc"));
children.push(fillBox("B Story Stakes Progression"));

children.push(pageBreak());

// ═══════════════════════════════════════
// PART 9: SERIES SETUP
// ═══════════════════════════════════════
children.push(partHeader("PART 9: SERIES SETUP"));
children.push(instructionText("By the end of your pilot, the audience must have a clear understanding of what your series IS. A common note on pilots: \u201CMove Act IV to Act I.\u201D Don\u2019t spend several acts on backstory\u2014your backstory can reveal itself throughout the story. Give the audience a strong sense of what they\u2019ll be watching from week to week."));
children.push(spacer(80));

children.push(fillBox("What is the series concept as demonstrated by the end of the pilot?"));
children.push(spacer(80));
children.push(fillBox("What question or cliffhanger brings the audience back?"));
children.push(spacer(80));
children.push(fillBox("What does a typical episode look like after the pilot?"));

children.push(pageBreak());

// ═══════════════════════════════════════
// PART 10: SCENE WORK
// ═══════════════════════════════════════
children.push(partHeader("PART 10: SCENE WORK"));
children.push(instructionText("For EVERY scene in your pilot, consider these three elements. If a scene doesn\u2019t serve at least one, cut it. Every scene should have a beginning, middle, and end\u2014and the character should be in a different emotional place at the end than at the start."));
children.push(spacer(80));

children.push(bodyText("1. Wound (WHY) \u2014 How does the character\u2019s past trauma drive their actions in this scene?", { bold: true }));
children.push(bodyText("2. Flaw (CONFLICT) \u2014 How do the character\u2019s internal struggles create obstacles or tension in this scene?", { bold: true }));
children.push(bodyText("3. Desire (WANT) \u2014 What does the character want to achieve in this scene? How does it tie into the overall goal?", { bold: true }));
children.push(spacer(100));

children.push(subHeader("Scene Checklist"));
children.push(checklistItem("Does this scene have a beginning, middle, and end?"));
children.push(checklistItem("Does the character have a goal in this scene?"));
children.push(checklistItem("Is there conflict or a point of tension?"));
children.push(checklistItem("Does the scene move the plot forward?"));
children.push(checklistItem("Does the scene cause change (minor or significant)?"));
children.push(checklistItem("Is the character in a different place emotionally at the end than the start?"));
children.push(checklistItem("Does the last line create anticipation for what\u2019s next?"));

children.push(pageBreak());

// ═══════════════════════════════════════
// PART 11: FINDING YOUR VOICE
// ═══════════════════════════════════════
children.push(partHeader("PART 11: FINDING YOUR VOICE"));
children.push(instructionText("Voice is what separates your script from the hundreds on an executive\u2019s desk. It comes from going further than you ever have\u2014having your characters say the things you would never say out loud because it would make you too vulnerable."));
children.push(spacer(40));
children.push(instructionText("The strongest places to reveal voice are Acts 3 and 4\u2014the escalating obstacle and the \u201Call is lost\u201D moment. When your character is at their lowest, that\u2019s when we learn what they\u2019re truly made of. Draw from your own truth and fictionalize it."));
children.push(spacer(80));

children.push(subHeader("The 20-Minute Test"));
children.push(bodyText("If the audience doesn\u2019t know why they should care within 20 minutes, they change the channel. Make sure you answer \u201CWhy do I care?\u201D as early as possible.", { bold: true }));
children.push(spacer(80));

children.push(subHeader("Universal Themes"));
children.push(instructionText("What universal life experience does your story tap into? The things that connect us all\u2014loss, betrayal, ambition, love, identity, belonging\u2014are the gold. Your personal interpretation of these experiences is your voice."));
children.push(fillBox("What universal theme does your pilot explore?"));

children.push(spacer(200));

// ═══════════════════════════════════════
// FINAL SELF-CHECK
// ═══════════════════════════════════════
children.push(sectionTitle("Final Self-Check"));
children.push(bodyText("Before you write, answer YES to all of these:", { bold: true }));
children.push(spacer(40));
children.push(checklistItem("Is the trigger-dilemma-goal chain clear and connected?"));
children.push(checklistItem("Does the goal stem from the dilemma by the end of Act 1?"));
children.push(checklistItem("Do I empathize with my lead? Do I root for them?"));
children.push(checklistItem("Is my central character ACTIVE in pursuing the goal?"));
children.push(checklistItem("Do all act outs reflect back to the initial goal?"));
children.push(checklistItem("Do B and C stories have their own trigger, dilemma, goal, and resolution?"));
children.push(checklistItem("Do B and C stories elevate the A story thematically?"));
children.push(checklistItem("Are emotional stakes established and escalating?"));
children.push(checklistItem("Is it clear what the series will be by the end of the pilot?"));
children.push(checklistItem("Can I imagine Season 4?"));
children.push(checklistItem("Does my voice come through?"));
children.push(checklistItem("Does every scene move the story forward?"));

children.push(spacer(400));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: "\u2014 Now go write your pilot. \u2014", bold: true, italics: true, size: 24, font: "Arial", color: CYAN })]
}));

// ═══════════════════════════════════════
// ASSEMBLE DOCUMENT
// ═══════════════════════════════════════
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22 } }
    }
  },
  sections: [{
    properties: {
      page: {
        size: { width: PAGE_W, height: PAGE_H },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: "LEMON STUDIOS", size: 16, font: "Arial", color: CYAN, bold: true }),
                     new TextRun({ text: "  |  Story Worksheet", size: 16, font: "Arial", color: "999999" })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 1, color: MID_GRAY, space: 4 } },
          children: [
            new TextRun({ text: "Based on the Methodology of Jen Grisanti  |  Page ", size: 16, font: "Arial", color: "999999" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Arial", color: "999999" })
          ]
        })]
      })
    },
    children
  }]
});

Packer.toBuffer(doc).then(buffer => {
  const path = "/home/claude/Story_Worksheet_Lemon_Studios.docx";
  fs.writeFileSync(path, buffer);
  console.log(`Created: ${path} (${(buffer.length / 1024).toFixed(0)} KB)`);
});
