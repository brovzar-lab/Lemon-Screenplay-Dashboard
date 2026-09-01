# Standing calibration brief #2 — Hermanos Márquez Castillo (2026-09-01)

Author: Billy Rovzar (human line-by-line audit of the Coverage V1 canary
round-2 report on "Hermanos Márquez Castillo" against the 126-page PDF;
printed page numbers throughout, title-page offset of 1).
Status: **absorbed into the engine** — see the engineering notes at the end
for exactly what became prompt rules, schema, and code. This file is the
verbatim source of record; if the distillation and this text ever disagree,
this text wins.

Note on the audited output: this brief audits the round-2 canary report,
which was produced BEFORE brief #1's fixes landed. The two items marked
RECURRING 1 and the slash half of RECURRING 3 had already been fixed in code
by the time this brief arrived (the `not_applicable` grade and the
slash/lead-word citation normalization); the re-run validates them. The rest
of RECURRING 3 (seal teeth) and everything in Part One were new work,
absorbed as described below.

---

STANDING CALIBRATION BRIEF #2 FOR THE COVERAGE ENGINE
Source: human audit of coverage-v1.0 output on "Hermanos Márquez Castillo" (126-page PDF, 125 printed pages, title page offset of 1), checked line by line against the screenplay. All page numbers below are PRINTED page numbers as they appear in the page header. This brief supersedes nothing in Brief #1; it adds to it. Three defects flagged in Brief #1 recurred in this output and are marked RECURRING. Treat recurring defects as standing bugs, not as one-off misreads.

============================================================
PART ONE: DEFECTS SPECIFIC TO THIS OUTPUT
============================================================

DEFECT 1. FALSE "UNSEEDED" CLAIM THAT DROVE THE VERDICT RATIONALE.
The output states in concerns[0]: "because Eugenio has never before hinted that this loophole exists, it reads as deus ex machina rather than setup-and-payoff," and pass_reason repeats it: the finale "feels like the writers found a way out rather than a way through."
The page: on p.52 Eugenio reads the will aloud in full, including the exact list Fausto later exploits: "no habrá divisiones, no habrán segundos lugares, ni reparticiones, usurpaciones, donaciones o cualquier otra estupidez que se les ocurra." He then looks up, asks "¿Entendieron?", and restates it: "No pueden hacer ningún trato." On p.123 Fausto quotes that same list back and asks "¿dijo algo de heredarlo?" This is textbook plant and payoff, and the story-grid lens in the same document independently calls this resolution "the script's greatest structural achievement."
The note that was actually available and is more useful to the writer: the will's catch-all phrase "o cualquier otra estupidez que se les ocurra" arguably closes the loophole Fausto is exploiting, and Eugenio, a lawyer who has opposed them for a hundred pages, capitulates in one beat with no counterargument before walking out. That is a real weakness in the resolution. Write that note, not the false one.
Rule: never assert that a payoff is unprepared until a backward search has been run for the payoff's exact language. If the payoff quotes a document, a rule, or a line of dialogue, search for that string first. Any "unseeded / deus ex machina / convenient" claim must be accompanied by the search that was run and what it returned.

DEFECT 2. PRESCRIBING A PLANT THAT ALREADY EXISTS (RECURRING, SAME CLASS AS BRIEF #1).
The output states in lemon-coverage and in development_priorities[0] that the mother Esperanza is "established only in cemetery flashbacks before page 117," and recommends adding an Act One scene, "possibly during the reading of Don Lauro's letter."
The page: Esperanza is named and characterized in the opening newsreel on pp.1-2, as Esperanza Blanco, 18, "una mujer sensible, de las artes y la poesía," who "cantaba como el canto de un ruiseñor," whose dream was to be a singer and whom Don Lauro made a mother instead. And the letter the engine guessed at already carries the theme explicitly: on p.29 Eugenio reads Don Lauro's words, "Niños, su madre siempre los hizo creer que eran especiales, sensibles, dignos de dar amor. Pues ¿saben qué? Les voy a quitar esas idioteces de la cabeza así sea lo último que haga." That pays off verbatim in Esperanza's flashback on p.120, "tienes que entender lo especial que eres... Yo te amo y el mundo te ama," and again in Fausto's speech on p.123. There is also a portrait of Esperanza with her four sons replacing Don Lauro's portrait on the office wall in the epilogue (p.122), a payoff the coverage never mentions.
Rule: this is the second consecutive script on which the engine told the writer to build something already built. Before any note of the form "plant X earlier" or "X is not established," run a name search plus a thematic-phrase search across the full script and report the hits. If hits exist, the note must be reframed as "convert the existing mention on p.N into a played scene," and it must cite p.N. Prescribing an existing setup is the single fastest way to lose a writer's trust in the entire document.

DEFECT 3. READING A SETUP AS NOISE BECAUSE THE PUNCHLINE LANDS AFTER THE SCENE.
The output calls the three-minute summit (pp.105-109) "an undifferentiated cascade of 'chinga tu madre'" in which "individual voices collapse into indistinct noise," and builds a genre_contract failure and part of a development priority on that reading.
The page: on p.109, immediately after the cascade, Jaime signs off on the radio with "pobre Doña Esperanza, las feas cosas que sus hijos le desearon." The joke is that the mother all four brothers have just spent three minutes cursing is the sainted Esperanza, whose memory fells the tree eleven pages later. The scene is a disguised setup for the climax with the reveal handed to the host, not a comic plateau.
Rule: before judging a scene as flat, repetitive, or noise, read to the end of the sequence and one page past it. Check specifically whether a third party (a host, a narrator, an onlooker) supplies a button or a reframe after the scene ends. A repetition sequence that ends on a reframe is a structure, not a plateau.

DEFECT 4. SCRIPT-LEVEL CONTINUITY ERRORS NOT REPORTED.
Two internal contradictions in the screenplay went unflagged, and one of them was actively propagated into the output as fact.
(a) On p.1 the newsreel names the brothers' mother "Esperanza Blanco." On p.2, one paragraph later, the same narration says "Quince años después, Rosa también murió." Same woman, two names. Compounding it, a separate character named Rosa, a servant, is introduced on p.5 and becomes Abel's love interest through the final image.
(b) On p.13 Fausto is introduced as "FAUSTO 34, el tercer hermano," the third brother. On p.121 Jaime announces "Fausto, el mayor," the eldest. The output asserts Fausto is the eldest in story_spine.protagonist, and the fact_audit classified that as "supported" while citing ages, without ever surfacing the contradiction.
Rule: add a continuity sweep to every coverage. At minimum, check for: the same character referred to by two names; two characters sharing a name; contradictory ages, birth order, or relationships; and contradictory statements of the rules of any in-world game or contest. Report findings in a dedicated continuity_flags[] field with both page numbers and both quotes. These are among the most immediately useful notes a producer can receive and they cost nothing to find.

DEFECT 5. OVERSTATED PACING CLAIM.
The output states the bribery scene is "repeated approximately 30 times without escalation or variation" and that "the scene turns once and then repeats the turn 30 times."
The page: the sequence does button. On p.83 Eugenio finally answers "30" with "Lo voy a pensar," Fausto immediately tries "¿29?", Eugenio says no, and Fausto concedes "Bueno, 30" with a wink. The scene has an ending joke.
Rule: a pacing note may say a sequence is long or that its escalation is quantitative rather than qualitative. It may not say a sequence has no variation or no turn without first checking the last beat of the sequence. Also, the same scene was given three different page ranges across the document (pp.78-85, pp.80-85, and the development note's pp.78-85 against an actual range of roughly pp.79-84). Every reference to a given sequence must resolve to one page range.

============================================================
PART TWO: RECURRING DEFECTS FROM BRIEF #1, STILL PRESENT
============================================================

RECURRING 1. NON-APPLICABLE LENS STILL GRADED NEGATIVELY.
The horror-contract lens graded this period comedy "weak" while its own analysis text says "This lens does not apply" and "Applying the horror genre contract to this script would be a category error." Brief #1 flagged the identical behavior with the comedy lens on a horror film. Two for two.
Rule, restated and non-negotiable: each lens declares applicability before grading. If not applicable, grade must be "not_applicable," the lens is excluded from every aggregate and from the verdict, and only a one-line genre-fit note is retained. A lens must never emit a negative grade for a genre the script is not in.

RECURRING 2. PAGE NUMBERING IS NON-DETERMINISTIC.
This PDF has a title page, so PDF index equals printed page plus one. Here all seven citation relocations happened to convert correctly from PDF index to printed page. In the Matadero output, one of three relocations landed on a page matching neither numbering system. Inconsistent behavior is worse than a consistent offset because it is unauditable.
Rule, restated: detect the offset once at parse time by reading the printed page number from each page header, store it explicitly, and emit printed page numbers everywhere, in prose and in structured fields alike. State the convention in the output.

RECURRING 3. THE AUDIT AND THE SEAL HAVE NO TEETH, AND IT IS WORSE HERE.
This document sealed with citation_verification reporting 3 unverified and 7 relocated out of 11, while fact_audit reported support_rate 1.0, central_failures empty, and human_review_recommended false. A document carrying three broken citations cannot report a perfect support rate.
Worse, all three "unverified" citations are correct. They failed only because the coverage model writes a literal slash where a dialogue line breaks, as in "la felicidad te perseguirá. Yo te amo / y el mundo te ama." The verifier matches the slash literally and fails. All three quotes exist, on pp.47, 120 and 50, exactly where the engine cited them. So the verifier is producing false negatives on correct work while the seal ignores them entirely.
Rules: strip or normalize the line-break slash and collapse all whitespace before matching. Any nonzero unverified count must block the seal or force human_review_recommended true. support_rate must be computed against citation status, not independently of it.

============================================================
PART THREE: WHAT THIS OUTPUT GOT RIGHT, PRESERVE IT
============================================================
The logline is accurate and conveyable. The genre call is right. The four-archetype analysis and the comedy-engine reasoning are strong, particularly the observation that the premise generates collision between who these men are and what they are required to perform. The Tadeo hunting sequence as the script's structural and comedic centerpiece is correct. The Iker campesino runner being planted, deployed, and abandoned without payoff is correct and properly evidenced across pp.83, 89-97 and 123-126. Rosa lacking an independent want is correct. The point tally cited in the audit (Abel 23, and Fausto effectively eliminated) checks out against p.115. CONSIDER is the right verdict. Keep the champion_reason and pass_reason split; it is the most useful structure in the document. The corrections above change the reasoning inside pass_reason, not the verdict.

---

## Engineering notes (what each item became)

- **Defect 1** → HOUSE RULE 4 strengthened (exact-string search first, report
  the search); AND concerns + `pass_reason` are now audited claims, with the
  audit charter's new absence-claim rule (search the whole script before
  classifying "never set up" claims; a found plant = contradicted). A
  contradicted concern or pass case flags `human_review_recommended` with
  the claim id.
- **Defect 2** → HOUSE RULE 4 ("convert the existing mention on p.N into a
  played scene" phrasing added).
- **Defect 3** → new HOUSE RULE 12 (read to the sequence end plus one page;
  third-party button/reframe = structure, not plateau).
- **Defect 4** → new required `continuity_flags` schema field (validated,
  normalized into the dashboard) + HOUSE RULE 11 (the sweep checklist).
- **Defect 5** → new HOUSE RULE 13 (pacing-claim limits; one page range per
  sequence).
- **Recurring 1** → already fixed after round 2 (`not_applicable` grade,
  schema + prompt + dashboard); the re-run validates it.
- **Recurring 2** → printed-page offset is now detected in code from page
  headers (majority vote, confidence-gated) and the [PAGE N] markers are
  renumbered to printed pages BEFORE the model sees the text, so prompts,
  citations, verification, and relocation all natively use printed numbers;
  the report's `page_convention`/`page_numbering` state the detected offset.
  Unnumbered/scanned documents fall back to physical pages, stated as such.
- **Recurring 3** → slash + lead-word normalization was already fixed after
  round 2; NEW: any nonzero unverified citation count now forces
  `human_review_recommended: true` with the count in `review_reasons` (the
  "block or flag" option chosen: flag, since near-miss false negatives
  should not destroy paid, otherwise-valid work). `support_rate` remains the
  fact-audit's own metric, but the seal-level trust signal now reflects
  citation status through the review flag, so the combination reported here
  (broken citations + no flag) is no longer possible.
